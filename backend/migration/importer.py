"""
Import engine: incremental import with checksum-based deduplication,
duplicate detection, dry-run, rollback.
"""
from __future__ import annotations
import hashlib
import json
import sqlite3
import secrets
from datetime import datetime
from typing import Any


def now_iso() -> str:
    return datetime.now().isoformat(sep="T", timespec="seconds")


def _str(v: Any) -> str:
    if v is None:
        return ""
    return str(v).strip()


# ── Checksum ──────────────────────────────────────────────────────────────────

def compute_checksum(row: dict, fields: list[str] | None = None) -> str:
    """Stable checksum from a dict's important fields."""
    if fields is None:
        fields = sorted(row.keys())
    parts = "|".join(f"{k}={_str(row.get(k))}" for k in fields if row.get(k))
    return hashlib.sha256(parts.encode()).hexdigest()[:16]


# ── old_record_links helpers ─────────────────────────────────────────────────

def _find_link(conn: sqlite3.Connection, source_name: str, old_table: str, old_id: str) -> dict | None:
    r = conn.execute(
        "SELECT * FROM old_record_links WHERE source_name=? AND old_table=? AND old_id=? LIMIT 1",
        (source_name, old_table, old_id),
    ).fetchone()
    return dict(r) if r else None


def _upsert_link(conn: sqlite3.Connection, source_name: str, source_type: str,
                 old_table: str, old_id: str, ms_table: str, ms_id: int, checksum: str) -> None:
    conn.execute("""
        INSERT INTO old_record_links
            (source_name, source_type, old_table, old_id, medismart_table, medismart_id, checksum,
             imported_at, last_seen_at)
        VALUES (?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)
        ON CONFLICT(source_name, old_table, old_id) DO UPDATE SET
            medismart_id=excluded.medismart_id,
            checksum=excluded.checksum,
            last_seen_at=CURRENT_TIMESTAMP
    """, (source_name, source_type, old_table, old_id, ms_table, ms_id, checksum))


# ── Duplicate detection ───────────────────────────────────────────────────────

def detect_duplicates(conn: sqlite3.Connection, candidates: list[dict]) -> list[dict]:
    results = []
    for row in candidates:
        nom   = _str(row.get("nom", "")).lower()
        prenom= _str(row.get("prenom", "")).lower()
        dob   = _str(row.get("date_naissance", ""))
        phone = _str(row.get("telephone", ""))
        code  = _str(row.get("code", ""))
        match_id, match_reason = None, None

        if code:
            r = conn.execute("SELECT id FROM patients WHERE code=? LIMIT 1", (code,)).fetchone()
            if r: match_id, match_reason = r[0], f"Code identique ({code})"

        if not match_id and nom and prenom and dob:
            r = conn.execute(
                "SELECT id FROM patients WHERE lower(nom)=? AND lower(prenom)=? AND date_naissance=? LIMIT 1",
                (nom, prenom, dob),
            ).fetchone()
            if r: match_id, match_reason = r[0], "Nom + Prénom + Date naissance identiques"

        if not match_id and phone and len(phone) >= 8:
            r = conn.execute("SELECT id FROM patients WHERE telephone=? LIMIT 1", (phone,)).fetchone()
            if r: match_id, match_reason = r[0], f"Téléphone identique ({phone})"

        new_row = dict(row)
        new_row["duplicate_status"] = "duplicate" if match_id else "new"
        new_row["match_id"] = match_id
        new_row["match_reason"] = match_reason or ""
        results.append(new_row)
    return results


# ── Patient import ────────────────────────────────────────────────────────────

PATIENT_CHECKSUM_FIELDS = ["nom", "prenom", "date_naissance", "telephone", "adresse"]

def import_patients(conn: sqlite3.Connection, rows: list[dict],
                    mapping: dict, job_id: int,
                    on_duplicate: str = "skip",
                    dry_run: bool = False,
                    source_name: str = "",
                    source_type: str = "file",
                    old_table: str = "") -> dict:
    imported = 0
    skipped = 0
    merged = 0
    updated = 0
    errors = []
    patient_id_map: dict[str, int] = {}

    for i, row in enumerate(rows):
        try:
            patient = _apply_mapping(row, mapping)
            nom    = _str(patient.get("nom"))
            prenom = _str(patient.get("prenom"))
            if not nom:
                skipped += 1
                continue

            code_val = _str(patient.get("code")) or None
            dob   = _str(patient.get("date_naissance")) or None
            phone = _str(patient.get("telephone")) or None
            checksum = compute_checksum(patient, PATIENT_CHECKSUM_FIELDS)

            # ── Incremental check via old_record_links ──────────────────────
            old_id = code_val or f"row_{i}"
            link = _find_link(conn, source_name, old_table, old_id) if source_name else None

            if link:
                ms_id = link["medismart_id"]
                if link["checksum"] == checksum:
                    # Identical — skip entirely
                    patient_id_map[code_val or old_id] = ms_id
                    _upsert_link(conn, source_name, source_type, old_table, old_id, "patients", ms_id, checksum)
                    skipped += 1
                    continue
                else:
                    # Data changed — update existing record
                    if not dry_run:
                        _merge_patient(conn, ms_id, patient)
                        _upsert_link(conn, source_name, source_type, old_table, old_id, "patients", ms_id, checksum)
                        conn.execute(
                            "INSERT INTO import_logs (job_id,entity,action,details,created_at) VALUES (?,?,?,?,?)",
                            (job_id, "patient", "update", json.dumps({"id": ms_id, "nom": nom}), now_iso()),
                        )
                    patient_id_map[code_val or old_id] = ms_id
                    updated += 1
                    continue

            # ── Classic duplicate check ─────────────────────────────────────
            existing_id = None
            if code_val:
                r = conn.execute("SELECT id FROM patients WHERE code=? LIMIT 1", (code_val,)).fetchone()
                if r: existing_id = r[0]
            if not existing_id and nom and prenom and dob:
                r = conn.execute(
                    "SELECT id FROM patients WHERE lower(nom)=? AND lower(prenom)=? AND date_naissance=? LIMIT 1",
                    (nom.lower(), prenom.lower(), dob),
                ).fetchone()
                if r: existing_id = r[0]

            if existing_id:
                if on_duplicate == "skip":
                    skipped += 1
                    if code_val: patient_id_map[code_val] = existing_id
                    if source_name and not dry_run:
                        _upsert_link(conn, source_name, source_type, old_table, old_id, "patients", existing_id, checksum)
                    continue
                elif on_duplicate == "merge":
                    if not dry_run:
                        _merge_patient(conn, existing_id, patient)
                        _upsert_link(conn, source_name, source_type, old_table, old_id, "patients", existing_id, checksum)
                        conn.execute("INSERT OR IGNORE INTO old_patient_links (patient_id,old_code,import_job_id) VALUES (?,?,?)",
                                     (existing_id, code_val, job_id))
                    merged += 1
                    if code_val: patient_id_map[code_val] = existing_id
                    continue
                # on_duplicate == "new": fall through to insert

            # ── Insert new ─────────────────────────────────────────────────
            if not dry_run:
                qr = secrets.token_hex(12)
                while conn.execute("SELECT 1 FROM patients WHERE qr_token=?", (qr,)).fetchone():
                    qr = secrets.token_hex(12)
                ts = now_iso()
                insert_code = code_val
                if on_duplicate == "new" and existing_id and insert_code:
                    insert_code = f"{insert_code}_imp"
                cur = conn.execute(
                    """INSERT INTO patients
                    (code,nom,prenom,date_naissance,age,sexe,telephone,adresse,
                     profession,allergies,maladies,notes_importantes,qr_token,created_at,updated_at)
                    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                    (insert_code, nom, prenom, dob,
                     _str(patient.get("age")) or None,
                     _str(patient.get("sexe")) or None,
                     phone,
                     _str(patient.get("adresse")) or None,
                     _str(patient.get("profession")) or None,
                     _str(patient.get("allergies")) or None,
                     _str(patient.get("maladies")) or None,
                     _str(patient.get("notes_importantes")) or None,
                     qr, ts, ts),
                )
                new_id = cur.lastrowid
                if insert_code: patient_id_map[insert_code] = new_id
                if code_val and code_val != insert_code: patient_id_map[code_val] = new_id
                if source_name:
                    _upsert_link(conn, source_name, source_type, old_table, old_id, "patients", new_id, checksum)
                conn.execute("INSERT OR IGNORE INTO old_patient_links (patient_id,old_code,import_job_id) VALUES (?,?,?)",
                             (new_id, code_val, job_id))
                conn.execute("INSERT INTO import_logs (job_id,entity,action,details,created_at) VALUES (?,?,?,?,?)",
                             (job_id, "patient", "insert", json.dumps({"nom": nom, "prenom": prenom}), now_iso()))
            imported += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})

    return {"imported": imported, "skipped": skipped, "merged": merged,
            "updated": updated, "errors": errors, "patient_id_map": patient_id_map}


# ── Visit import ──────────────────────────────────────────────────────────────

VISIT_CHECKSUM_FIELDS = ["patient_code", "date_visite", "diagnostics"]

def import_visits(conn: sqlite3.Connection, rows: list[dict],
                  mapping: dict, job_id: int,
                  patient_id_map: dict[str, int],
                  dry_run: bool = False,
                  source_name: str = "",
                  source_type: str = "file",
                  old_table: str = "") -> dict:
    imported = 0
    skipped = 0
    updated = 0
    errors = []

    for i, row in enumerate(rows):
        try:
            visit = _apply_mapping(row, mapping)
            code = _str(visit.get("patient_code"))
            patient_id = patient_id_map.get(code)
            if not patient_id and code:
                r = conn.execute("SELECT id FROM patients WHERE code=? LIMIT 1", (code,)).fetchone()
                if r: patient_id = r[0]
            if not patient_id:
                skipped += 1
                continue

            checksum = compute_checksum(visit, VISIT_CHECKSUM_FIELDS)
            old_id = _str(row.get("id") or row.get("visit_id") or f"vrow_{i}")
            link = _find_link(conn, source_name, old_table, old_id) if source_name else None

            if link:
                if link["checksum"] == checksum:
                    skipped += 1
                    continue
                else:
                    if not dry_run:
                        _update_visit(conn, link["medismart_id"], visit)
                        _upsert_link(conn, source_name, source_type, old_table, old_id, "visits", link["medismart_id"], checksum)
                    updated += 1
                    continue

            date_v = _str(visit.get("date_visite")) or now_iso()[:10]
            if not dry_run:
                cur = conn.execute(
                    """INSERT INTO visits (patient_id,date_visite,motif,diagnostics,traitements,histoire,created_at)
                    VALUES (?,?,?,?,?,?,?)""",
                    (patient_id, date_v,
                     _str(visit.get("motif")) or None,
                     _str(visit.get("diagnostics")) or None,
                     _str(visit.get("traitements")) or None,
                     _str(visit.get("histoire")) or None,
                     now_iso()),
                )
                if source_name:
                    _upsert_link(conn, source_name, source_type, old_table, old_id, "visits", cur.lastrowid, checksum)
                conn.execute("INSERT INTO import_logs (job_id,entity,action,details,created_at) VALUES (?,?,?,?,?)",
                             (job_id, "visit", "insert", json.dumps({"patient_id": patient_id, "date": date_v}), now_iso()))
            imported += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})

    return {"imported": imported, "skipped": skipped, "updated": updated, "errors": errors}


# ── Appointment import ────────────────────────────────────────────────────────

def import_appointments(conn: sqlite3.Connection, rows: list[dict],
                        mapping: dict, job_id: int,
                        patient_id_map: dict[str, int],
                        dry_run: bool = False,
                        source_name: str = "",
                        source_type: str = "file",
                        old_table: str = "") -> dict:
    imported = 0; skipped = 0; errors = []
    for i, row in enumerate(rows):
        try:
            appt = _apply_mapping(row, mapping)
            code = _str(appt.get("patient_code"))
            patient_id = patient_id_map.get(code)
            if not patient_id and code:
                r = conn.execute("SELECT id FROM patients WHERE code=? LIMIT 1", (code,)).fetchone()
                if r: patient_id = r[0]
            if not patient_id:
                skipped += 1; continue
            scheduled = _str(appt.get("scheduled_at")) or now_iso()
            title = _str(appt.get("title")) or "Consultation"
            status = _str(appt.get("status")) or "scheduled"
            notes = _str(appt.get("notes")) or None
            old_id = _str(row.get("id") or f"arow_{i}")
            checksum = compute_checksum(appt, ["patient_code", "scheduled_at", "title"])
            link = _find_link(conn, source_name, old_table, old_id) if source_name else None
            if link and link["checksum"] == checksum:
                skipped += 1; continue
            if not dry_run:
                r = conn.execute(
                    "SELECT id FROM appointments WHERE patient_id=? AND scheduled_at=? LIMIT 1",
                    (patient_id, scheduled),
                ).fetchone()
                if r:
                    skipped += 1
                    if source_name: _upsert_link(conn, source_name, source_type, old_table, old_id, "appointments", r[0], checksum)
                    continue
                cur = conn.execute(
                    "INSERT INTO appointments (patient_id,scheduled_at,title,status,notes,created_at) VALUES (?,?,?,?,?,?)",
                    (patient_id, scheduled, title, status, notes, now_iso()),
                )
                if source_name: _upsert_link(conn, source_name, source_type, old_table, old_id, "appointments", cur.lastrowid, checksum)
                conn.execute("INSERT INTO import_logs (job_id,entity,action,details,created_at) VALUES (?,?,?,?,?)",
                             (job_id, "appointment", "insert", json.dumps({"patient_id": patient_id, "scheduled_at": scheduled}), now_iso()))
            imported += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})
    return {"imported": imported, "skipped": skipped, "errors": errors}


# ── Medication import ─────────────────────────────────────────────────────────

def import_medications(conn: sqlite3.Connection, rows: list[dict],
                       mapping: dict, job_id: int,
                       dry_run: bool = False) -> dict:
    imported = 0; skipped = 0; errors = []
    for i, row in enumerate(rows):
        try:
            med = _apply_mapping(row, mapping)
            brand = _str(med.get("brand_name"))
            if not brand:
                skipped += 1; continue
            dci = _str(med.get("dci")) or None
            dosage = _str(med.get("dosage_strength")) or None
            form = _str(med.get("form")) or None
            category = _str(med.get("category")) or None
            route = _str(med.get("route")) or None
            if not dry_run:
                r = conn.execute(
                    "SELECT id FROM medicines_db WHERE lower(brand_name)=? LIMIT 1",
                    (brand.lower(),),
                ).fetchone()
                if r:
                    skipped += 1; continue
                conn.execute(
                    "INSERT INTO medicines_db (brand_name,dci,dosage_strength,form,route,category,created_at) VALUES (?,?,?,?,?,?,?)",
                    (brand, dci, dosage, form, route, category, now_iso()),
                )
                conn.execute("INSERT INTO import_logs (job_id,entity,action,details,created_at) VALUES (?,?,?,?,?)",
                             (job_id, "medication", "insert", json.dumps({"brand_name": brand}), now_iso()))
            imported += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})
    return {"imported": imported, "skipped": skipped, "errors": errors}


# ── Payment import ────────────────────────────────────────────────────────────

def import_payments(conn: sqlite3.Connection, rows: list[dict],
                    mapping: dict, job_id: int,
                    patient_id_map: dict[str, int],
                    dry_run: bool = False,
                    source_name: str = "",
                    source_type: str = "file",
                    old_table: str = "") -> dict:
    imported = 0; skipped = 0; errors = []
    for i, row in enumerate(rows):
        try:
            pay = _apply_mapping(row, mapping)
            code = _str(pay.get("patient_code"))
            patient_id = patient_id_map.get(code)
            if not patient_id and code:
                r = conn.execute("SELECT id FROM patients WHERE code=? LIMIT 1", (code,)).fetchone()
                if r: patient_id = r[0]
            if not patient_id:
                skipped += 1; continue
            try: montant = float(pay.get("montant") or 0)
            except (TypeError, ValueError): montant = 0.0
            try: paye = float(pay.get("paye") or 0)
            except (TypeError, ValueError): paye = 0.0
            mode = _str(pay.get("mode_paiement")) or None
            date_pay = _str(pay.get("date_paiement")) or now_iso()[:10]
            old_id = _str(row.get("id") or f"prow_{i}")
            checksum = compute_checksum(pay, ["patient_code", "date_paiement", "montant"])
            link = _find_link(conn, source_name, old_table, old_id) if source_name else None
            if link and link["checksum"] == checksum:
                skipped += 1; continue
            if not dry_run:
                r = conn.execute(
                    "SELECT id FROM visits WHERE patient_id=? AND date_visite=? LIMIT 1",
                    (patient_id, date_pay),
                ).fetchone()
                if r:
                    conn.execute(
                        "UPDATE visits SET visit_fee=?, fee_paid=?, mode_paiement=? WHERE id=?",
                        (montant, paye, mode, r[0]),
                    )
                    if source_name: _upsert_link(conn, source_name, source_type, old_table, old_id, "visits", r[0], checksum)
                else:
                    cur = conn.execute(
                        "INSERT INTO visits (patient_id,date_visite,visit_fee,fee_paid,mode_paiement,created_at) VALUES (?,?,?,?,?,?)",
                        (patient_id, date_pay, montant, paye, mode, now_iso()),
                    )
                    if source_name: _upsert_link(conn, source_name, source_type, old_table, old_id, "visits", cur.lastrowid, checksum)
                conn.execute("INSERT INTO import_logs (job_id,entity,action,details,created_at) VALUES (?,?,?,?,?)",
                             (job_id, "payment", "insert", json.dumps({"patient_id": patient_id, "montant": montant}), now_iso()))
            imported += 1
        except Exception as e:
            errors.append({"row": i, "error": str(e)})
    return {"imported": imported, "skipped": skipped, "errors": errors}


def _apply_mapping(row: dict, mapping: dict) -> dict:
    result = {}
    for ms_field, src_col in mapping.items():
        if src_col and src_col in row:
            result[ms_field] = _str(row[src_col])
    return result


def _merge_patient(conn: sqlite3.Connection, patient_id: int, data: dict) -> None:
    fields = ["telephone", "adresse", "profession", "allergies", "maladies", "notes_importantes"]
    for f in fields:
        v = _str(data.get(f))
        if v:
            existing = conn.execute(f"SELECT {f} FROM patients WHERE id=?", (patient_id,)).fetchone()
            if existing and not existing[0]:
                conn.execute(f"UPDATE patients SET {f}=?, updated_at=? WHERE id=?", (v, now_iso(), patient_id))


def _update_visit(conn: sqlite3.Connection, visit_id: int, data: dict) -> None:
    fields = ["motif", "diagnostics", "traitements", "histoire"]
    for f in fields:
        v = _str(data.get(f))
        if v:
            conn.execute(f"UPDATE visits SET {f}=? WHERE id=?", (v, visit_id))


# ── ImportEngine ──────────────────────────────────────────────────────────────

class ImportEngine:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def preview_with_duplicates(self, rows: list[dict], mapping: dict,
                                limit: int = 50, source_name: str = "", old_table: str = "") -> dict:
        conn = self._connect()
        try:
            mapped = [_apply_mapping(r, mapping) for r in rows[:limit * 4]]
            checked = detect_duplicates(conn, mapped)

            # Mark rows already tracked in old_record_links
            if source_name:
                for i, row in enumerate(rows[:len(checked)]):
                    old_id = _str(row.get("code") or row.get("id") or f"row_{i}")
                    link = _find_link(conn, source_name, old_table, old_id)
                    if link:
                        checksum = compute_checksum(checked[i], PATIENT_CHECKSUM_FIELDS)
                        checked[i]["incremental_status"] = "unchanged" if link["checksum"] == checksum else "changed"
                    else:
                        checked[i]["incremental_status"] = "new"

            stats = {
                "new":       sum(1 for r in checked if r["duplicate_status"] == "new"),
                "duplicate": sum(1 for r in checked if r["duplicate_status"] == "duplicate"),
                "total_checked": len(checked),
            }
            if source_name:
                stats["incremental_new"]     = sum(1 for r in checked if r.get("incremental_status") == "new")
                stats["incremental_changed"] = sum(1 for r in checked if r.get("incremental_status") == "changed")
                stats["incremental_same"]    = sum(1 for r in checked if r.get("incremental_status") == "unchanged")

            return {"rows": checked[:limit], "stats": stats, "total_source": len(rows)}
        finally:
            conn.close()

    def execute(self, job_id: int, patient_rows: list[dict], patient_mapping: dict,
                visit_rows: list[dict], visit_mapping: dict,
                on_duplicate: str = "skip", dry_run: bool = False,
                source_name: str = "", source_type: str = "file",
                patient_table: str = "", visit_table: str = "",
                appointment_rows: list[dict] | None = None, appointment_mapping: dict | None = None,
                appointment_table: str = "",
                medication_rows: list[dict] | None = None, medication_mapping: dict | None = None,
                payment_rows: list[dict] | None = None, payment_mapping: dict | None = None,
                payment_table: str = "") -> dict:
        conn = self._connect()
        try:
            p_result = import_patients(
                conn, patient_rows, patient_mapping, job_id, on_duplicate, dry_run,
                source_name, source_type, patient_table,
            )
            v_result = import_visits(
                conn, visit_rows, visit_mapping, job_id,
                p_result["patient_id_map"], dry_run,
                source_name, source_type, visit_table,
            )
            a_result = import_appointments(
                conn, appointment_rows or [], appointment_mapping or {}, job_id,
                p_result["patient_id_map"], dry_run,
                source_name, source_type, appointment_table,
            ) if appointment_rows else {"imported": 0, "skipped": 0, "errors": []}
            m_result = import_medications(
                conn, medication_rows or [], medication_mapping or {}, job_id, dry_run,
            ) if medication_rows else {"imported": 0, "skipped": 0, "errors": []}
            pay_result = import_payments(
                conn, payment_rows or [], payment_mapping or {}, job_id,
                p_result["patient_id_map"], dry_run,
                source_name, source_type, payment_table,
            ) if payment_rows else {"imported": 0, "skipped": 0, "errors": []}
            all_errors = (p_result["errors"] + v_result["errors"] +
                          a_result["errors"] + m_result["errors"] + pay_result["errors"])
            if not dry_run:
                conn.execute(
                    "UPDATE import_jobs SET status=?,patients_imported=?,visits_imported=?,errors=?,finished_at=? WHERE id=?",
                    ("done", p_result["imported"], v_result["imported"],
                     json.dumps(all_errors), now_iso(), job_id),
                )
                conn.commit()
            return {
                "dry_run": dry_run,
                "patients":     p_result,
                "visits":       v_result,
                "appointments": a_result,
                "medications":  m_result,
                "payments":     pay_result,
                "total_imported": (p_result["imported"] + v_result["imported"] +
                                   a_result["imported"] + m_result["imported"] + pay_result["imported"]),
                "total_errors": len(all_errors),
            }
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()
