#!/usr/bin/env python3
"""
Build or update the local SQLite database from the legacy MySQL dump.

Default mode is incremental. Use --fresh to create a clean production DB from
GestionMedicaleDBbackup_02-05-2026.sql, preserving the previous SQLite file in
data/backups first.
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import shutil
import sqlite3
import sys
import uuid
from datetime import datetime
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
DATA = ROOT / "data"
DB_PATH = DATA / "cardiologie.sqlite3"
SQL_PATH = ROOT / "GestionMedicaleDBbackup_02-05-2026.sql"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def parse_mysql_values(raw_bytes: bytes, table_name: str) -> list[list[str | None]]:
    """Extract all INSERT INTO `<table>` VALUES tuples from a MySQL dump."""
    pattern = rb"INSERT INTO `" + table_name.encode() + rb"` VALUES\s*"
    records: list[list[str | None]] = []
    for match in re.finditer(pattern, raw_bytes):
        start = match.end()
        stmt_end = find_statement_end(raw_bytes, start)
        block = raw_bytes[start:stmt_end].decode("utf-8", errors="replace")
        records.extend(parse_value_tuples(block))
    return records


def find_statement_end(raw_bytes: bytes, start: int) -> int:
    """Return the semicolon position for an INSERT, ignoring quoted payloads."""
    in_quote = False
    escaped = False
    i = start
    while i < len(raw_bytes):
        ch = raw_bytes[i]
        if in_quote:
            if escaped:
                escaped = False
            elif ch == ord("\\"):
                escaped = True
            elif ch == ord("'"):
                if i + 1 < len(raw_bytes) and raw_bytes[i + 1] == ord("'"):
                    i += 1
                else:
                    in_quote = False
        else:
            if ch == ord("'"):
                in_quote = True
            elif ch == ord(";"):
                return i
        i += 1
    return len(raw_bytes)


def parse_value_tuples(block: str) -> list[list[str | None]]:
    results: list[list[str | None]] = []
    i = 0
    while i < len(block):
        if block[i] == "(":
            values, i = parse_one_tuple(block, i)
            results.append(values)
        else:
            i += 1
    return results


def parse_one_tuple(block: str, start: int) -> tuple[list[str | None], int]:
    i = start + 1
    values: list[str | None] = []
    while i < len(block) and block[i] != ")":
        while i < len(block) and block[i] in " \t\r\n":
            i += 1
        if i >= len(block) or block[i] == ")":
            break
        if block[i] == "'":
            val, i = parse_quoted_string(block, i)
            values.append(val)
        elif block[i : i + 4].upper() == "NULL":
            values.append(None)
            i += 4
        else:
            j = i
            while j < len(block) and block[j] not in ",)":
                j += 1
            val = block[i:j].strip()
            values.append(None if val.upper() == "NULL" else val)
            i = j
        while i < len(block) and block[i] in " \t\r\n,":
            i += 1
    if i < len(block) and block[i] == ")":
        i += 1
    return values, i


def parse_quoted_string(block: str, start: int) -> tuple[str, int]:
    i = start + 1
    parts: list[str] = []
    while i < len(block):
        if block[i] == "\\" and i + 1 < len(block):
            nc = block[i + 1]
            parts.append({"'": "'", "\\": "\\", "n": "\n", "r": "\r", "t": "\t", "0": "\0"}.get(nc, nc))
            i += 2
        elif block[i] == "'" and i + 1 < len(block) and block[i + 1] == "'":
            parts.append("'")
            i += 2
        elif block[i] == "'":
            i += 1
            break
        else:
            parts.append(block[i])
            i += 1
    return "".join(parts), i


def safe_str(val: object) -> str:
    return "" if val is None else str(val).strip()


def safe_int(val: object, default: int = 0) -> int:
    try:
        return int(float(str(val).strip()))
    except Exception:
        return default


def safe_float(val: object, default: float = 0.0) -> float:
    try:
        raw = str(val).strip().replace(",", ".")
        return float(raw)
    except Exception:
        return default


def safe_date(val: object) -> str | None:
    if val is None:
        return None
    s = str(val).strip()
    if not s or s in {"0000-00-00", "0000-00-00 00:00:00"}:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:19], fmt).isoformat(sep=" ")
        except ValueError:
            continue
    return s[:19] if len(s) >= 10 else None


def maybe_int(val: object) -> int | None:
    if val is None or safe_str(val) == "":
        return None
    parsed = safe_int(val, default=-999999)
    return None if parsed == -999999 else parsed


def maybe_float(val: object) -> float | None:
    if val is None or safe_str(val) == "":
        return None
    parsed = safe_float(val, default=float("nan"))
    return None if parsed != parsed else parsed


def ensure_schema() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    with connect() as conn:
        conn.executescript((BACKEND / "schema.sql").read_text(encoding="utf-8"))
        ensure_legacy_columns(conn)


def ensure_legacy_columns(conn: sqlite3.Connection) -> None:
    ensure_column(conn, "appointments", "legacy_rdv_id", "INTEGER")
    ensure_column(conn, "appointments", "legacy_app_id", "INTEGER")
    ensure_column(conn, "prescriptions", "legacy_ordonnance_id", "INTEGER")
    ensure_column(conn, "generated_documents", "legacy_courrier_id", "INTEGER")
    ensure_column(conn, "generated_documents", "legacy_source", "TEXT")
    ensure_column(conn, "vital_signs", "legacy_consultation_id", "INTEGER")
    ensure_column(conn, "anthropometric_records", "legacy_consultation_id", "INTEGER")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_legacy_rdv ON appointments(legacy_rdv_id) WHERE legacy_rdv_id IS NOT NULL")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_appointments_legacy_app ON appointments(legacy_app_id) WHERE legacy_app_id IS NOT NULL")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_prescriptions_legacy_ord ON prescriptions(legacy_ordonnance_id) WHERE legacy_ordonnance_id IS NOT NULL")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_generated_documents_legacy ON generated_documents(legacy_courrier_id) WHERE legacy_courrier_id IS NOT NULL")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_vitals_legacy_cons ON vital_signs(legacy_consultation_id) WHERE legacy_consultation_id IS NOT NULL")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_anthro_legacy_cons ON anthropometric_records(legacy_consultation_id) WHERE legacy_consultation_id IS NOT NULL")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_patients_legacy ON patients(legacy_patient_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_visits_legacy ON visits(legacy_consultation_id)")


def ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def backup_and_reset_db() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    backup_dir = DATA / "backups"
    backup_dir.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / f"pre_legacy_refresh_{stamp}.sqlite3"
        shutil.copy2(DB_PATH, backup_path)
        print(f"  Previous DB backed up to {backup_path}")
    for suffix in ("", "-wal", "-shm"):
        path = Path(str(DB_PATH) + suffix)
        if path.exists():
            path.unlink()
    ensure_schema()


def existing_map(conn: sqlite3.Connection, table: str, legacy_col: str) -> dict[int, int]:
    rows = conn.execute(f"SELECT id, {legacy_col} FROM {table} WHERE {legacy_col} IS NOT NULL").fetchall()
    return {int(row[legacy_col]): int(row["id"]) for row in rows}


def unique_patient_code(conn: sqlite3.Connection, desired: str, old_id: int) -> str:
    base = (desired or f"P{old_id:06d}").strip()[:80]
    candidate = base
    counter = 1
    while conn.execute("SELECT id FROM patients WHERE code = ?", (candidate,)).fetchone():
        suffix = f"-L{old_id}" if counter == 1 else f"-L{old_id}-{counter}"
        candidate = f"{base[: max(1, 80 - len(suffix))]}{suffix}"
        counter += 1
    return candidate


def build_antecedent_map(raw: bytes) -> dict[int, dict[str, str]]:
    rows = parse_mysql_values(raw, "antecedent")
    result: dict[int, dict[str, str]] = {}
    for row in rows:
        if len(row) >= 9:
            result[safe_int(row[5])] = {
                "chirurgie": safe_str(row[1]),
                "chronique": safe_str(row[2]),
                "family": safe_str(row[3]),
                "other": safe_str(row[4]),
                "gyneco": safe_str(row[7]),
                "obstetric": safe_str(row[8]),
            }
    print(f"  Antecedents: {len(result)}")
    return result


def import_patients(conn: sqlite3.Connection, raw: bytes) -> dict[int, int]:
    rows = parse_mysql_values(raw, "patient")
    antecedents = build_antecedent_map(raw)
    patient_id_map = existing_map(conn, "patients", "legacy_patient_id")
    inserted = skipped = 0
    for row in rows:
        if len(row) < 16:
            skipped += 1
            continue
        old_id = safe_int(row[0])
        if old_id in patient_id_map:
            continue
        first_name = safe_str(row[11])
        last_name = safe_str(row[12])
        if not first_name and not last_name:
            skipped += 1
            continue

        sexe_raw = safe_str(row[13]).lower()
        if sexe_raw in {"1", "m", "masculin", "male"}:
            sexe = "Masculin"
        elif sexe_raw in {"2", "f", "feminin", "female"}:
            sexe = "Feminin"
        else:
            sexe = ""

        phone = safe_str(row[16]) or safe_str(row[18]) or safe_str(row[19])
        addr_parts = [safe_str(row[idx]) for idx in (10, 9, 7, 5) if len(row) > idx and safe_str(row[idx])]
        ant = antecedents.get(old_id, {})
        maladies = "\n".join(
            part for part in [ant.get("chronique", ""), f"Familiaux: {ant.get('family', '')}" if ant.get("family") else ""] if part
        )
        notes = "\n".join(
            part
            for part in [
                f"Chirurgie: {ant.get('chirurgie', '')}" if ant.get("chirurgie") else "",
                ant.get("other", ""),
                f"Gyneco: {ant.get('gyneco', '')}" if ant.get("gyneco") else "",
                f"Obstetrique: {ant.get('obstetric', '')}" if ant.get("obstetric") else "",
            ]
            if part
        )
        try:
            cur = conn.execute(
                """
                INSERT INTO patients
                (nom, prenom, date_naissance, age, sexe, telephone, adresse,
                 groupe_sanguin, profession, situation_familiale, oriente_par,
                 maladies, notes_importantes, allergies, qr_token, legacy_patient_id, code)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    (last_name or "SANS NOM").upper(),
                    first_name or "",
                    safe_date(row[14]),
                    maybe_int(row[15]),
                    sexe,
                    phone,
                    ", ".join(addr_parts),
                    safe_str(row[45]) if len(row) > 45 else "",
                    safe_str(row[30]) if len(row) > 30 else "",
                    safe_str(row[21]) if len(row) > 21 else "",
                    safe_str(row[51]) if len(row) > 51 else "",
                    maladies,
                    notes,
                    "",
                    uuid.uuid4().hex,
                    old_id,
                    unique_patient_code(conn, safe_str(row[32]) if len(row) > 32 else "", old_id),
                ),
            )
            patient_id_map[old_id] = cur.lastrowid
            inserted += 1
        except Exception as exc:
            skipped += 1
            print(f"    Patient {old_id} skipped: {exc}")
        if inserted and inserted % 2000 == 0:
            conn.commit()
            print(f"    ... {inserted} patients inserted")
    conn.commit()
    print(f"  Patients inserted: {inserted}, skipped: {skipped}, mapped: {len(patient_id_map)}")
    return patient_id_map


def import_visits_and_measurements(conn: sqlite3.Connection, raw: bytes, patient_id_map: dict[int, int]) -> dict[int, int]:
    rows = parse_mysql_values(raw, "consultation")
    visit_id_map = existing_map(conn, "visits", "legacy_consultation_id")
    inserted = skipped = vitals_inserted = anthro_inserted = 0
    for row in rows:
        if len(row) < 15:
            skipped += 1
            continue
        old_cid = safe_int(row[0])
        new_pid = patient_id_map.get(safe_int(row[1]))
        if not new_pid:
            skipped += 1
            continue
        if old_cid in visit_id_map:
            continue

        fee = safe_float(row[3])
        remain = safe_float(row[4])
        paid = fee - remain if fee > remain else 0
        status = "paid" if remain <= 0 and fee > 0 else ("partial" if paid > 0 else "pending")
        tension_min = safe_str(row[18]) if len(row) > 18 else ""
        tension_max = safe_str(row[19]) if len(row) > 19 else ""
        tension = f"{tension_max}/{tension_min}" if tension_max and tension_min else (tension_max or tension_min or "")
        date_v = safe_date(row[5]) or datetime.now().isoformat(sep=" ")

        try:
            cur = conn.execute(
                """
                INSERT INTO visits
                (patient_id, date_visite, motif, histoire, examens, diagnostics, traitements,
                 tension, frequence_cardiaque, glycemie, poids, taille,
                 visit_fee, fee_paid, payment_status, visit_type, legacy_consultation_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_pid,
                    date_v,
                    safe_str(row[9]),
                    safe_str(row[15]) if len(row) > 15 else "",
                    safe_str(row[13]) if len(row) > 13 else "",
                    safe_str(row[8]) if len(row) > 8 else "",
                    safe_str(row[14]) if len(row) > 14 else "",
                    tension,
                    safe_str(row[27]) if len(row) > 27 else "",
                    safe_str(row[20]) if len(row) > 20 else "",
                    safe_str(row[10]) if len(row) > 10 else "",
                    safe_str(row[11]) if len(row) > 11 else "",
                    fee,
                    paid,
                    status,
                    safe_str(row[2]) or None,
                    old_cid,
                ),
            )
            visit_id_map[old_cid] = cur.lastrowid
            inserted += 1
            vitals_inserted += insert_vitals_from_consultation(conn, new_pid, date_v, row, old_cid)
            anthro_inserted += insert_anthro_from_consultation(conn, new_pid, date_v, row, old_cid)
        except sqlite3.IntegrityError:
            skipped += 1
        except Exception as exc:
            skipped += 1
            print(f"    Visit {old_cid} skipped: {exc}")
        if inserted and inserted % 5000 == 0:
            conn.commit()
            print(f"    ... {inserted} visits inserted")
    conn.commit()
    print(f"  Visits inserted: {inserted}, skipped: {skipped}, mapped: {len(visit_id_map)}")
    print(f"  Constants imported: {vitals_inserted}, IMC rows imported: {anthro_inserted}")
    return visit_id_map


def insert_vitals_from_consultation(conn: sqlite3.Connection, patient_id: int, measured_at: str, row: list[str | None], old_cid: int) -> int:
    systolic = maybe_int(row[19]) if len(row) > 19 else None
    diastolic = maybe_int(row[18]) if len(row) > 18 else None
    heart_rate = maybe_int(row[27]) if len(row) > 27 else None
    weight = maybe_float(row[10]) if len(row) > 10 else None
    height = maybe_float(row[11]) if len(row) > 11 else None
    bmi = maybe_float(row[12]) if len(row) > 12 else None
    if not any(value is not None for value in (systolic, diastolic, heart_rate, weight, height, bmi)):
        return 0
    conn.execute(
        """
        INSERT OR IGNORE INTO vital_signs
        (patient_id, measured_at, systolic_bp, diastolic_bp, heart_rate, weight, height, bmi, notes, legacy_consultation_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (patient_id, measured_at, systolic, diastolic, heart_rate, weight, height, bmi, "Import legacy consultation", old_cid),
    )
    return 1


def insert_anthro_from_consultation(conn: sqlite3.Connection, patient_id: int, measured_at: str, row: list[str | None], old_cid: int) -> int:
    weight = maybe_float(row[10]) if len(row) > 10 else None
    height = maybe_float(row[11]) if len(row) > 11 else None
    bmi = maybe_float(row[12]) if len(row) > 12 else None
    if not any(value is not None for value in (weight, height, bmi)):
        return 0
    category = ""
    if bmi:
        category = "Obesite" if bmi >= 30 else "Surpoids" if bmi >= 25 else "Normal" if bmi >= 18.5 else "Insuffisance ponderale"
    conn.execute(
        """
        INSERT OR IGNORE INTO anthropometric_records
        (patient_id, measured_at, weight_kg, height_cm, bmi, bmi_category, notes, legacy_consultation_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (patient_id, measured_at, weight, height, bmi, category, "Import legacy consultation", old_cid),
    )
    return 1


def import_rdvtable(conn: sqlite3.Connection, raw: bytes, patient_id_map: dict[int, int]) -> None:
    rows = parse_mysql_values(raw, "rdvtable")
    existing = existing_map(conn, "appointments", "legacy_rdv_id")
    inserted = skipped = 0
    for row in rows:
        if len(row) < 3:
            skipped += 1
            continue
        old_rdv = safe_int(row[0])
        if old_rdv in existing:
            continue
        pid = patient_id_map.get(safe_int(row[1]))
        scheduled_at = safe_date(row[2])
        if not pid or not scheduled_at:
            skipped += 1
            continue
        title = safe_str(row[5]) if len(row) > 5 else ""
        type_rdv = safe_str(row[3]) if len(row) > 3 else ""
        conn.execute(
            """
            INSERT INTO appointments
            (patient_id, title, scheduled_at, status, notes, legacy_rdv_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (pid, title or type_rdv or "Rendez-vous", scheduled_at, "done", type_rdv, old_rdv),
        )
        inserted += 1
        if inserted and inserted % 2000 == 0:
            conn.commit()
    conn.commit()
    print(f"  RDV inserted: {inserted}, skipped: {skipped}")


def import_calendar_appointments(conn: sqlite3.Connection, raw: bytes) -> None:
    rows = parse_mysql_values(raw, "appointments")
    existing = existing_map(conn, "appointments", "legacy_app_id")
    inserted = 0
    for row in rows:
        if len(row) < 8:
            continue
        old_app = safe_int(row[0])
        if old_app in existing:
            continue
        scheduled_at = safe_date(row[1])
        if not scheduled_at:
            continue
        title = safe_str(row[7]) or safe_str(row[4]) or "Agenda"
        notes = "\n".join(part for part in [safe_str(row[4]), safe_str(row[6])] if part)
        conn.execute(
            """
            INSERT INTO appointments
            (patient_id, title, scheduled_at, status, notes, legacy_app_id)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (None, title, scheduled_at, "normal", notes, old_app),
        )
        inserted += 1
    conn.commit()
    print(f"  Calendar appointments inserted: {inserted}")


def import_visit_types(conn: sqlite3.Connection, raw: bytes) -> None:
    rows = parse_mysql_values(raw, "motif")
    inserted = updated = 0
    for row in rows:
        if len(row) < 3:
            continue
        name = safe_str(row[1])
        if not name:
            continue
        price = safe_float(row[2])
        existing = conn.execute("SELECT id FROM visit_types WHERE lower(trim(name)) = lower(trim(?))", (name,)).fetchone()
        if existing:
            conn.execute("UPDATE visit_types SET price = ?, active = 1 WHERE id = ?", (price, existing["id"]))
            updated += 1
        else:
            conn.execute("INSERT INTO visit_types (name, price, active) VALUES (?, ?, 1)", (name, price))
            inserted += 1
    conn.commit()
    print(f"  Visit types inserted: {inserted}, updated: {updated}")


def import_prescriptions(conn: sqlite3.Connection, raw: bytes, patient_id_map: dict[int, int], visit_id_map: dict[int, int]) -> None:
    rows = parse_mysql_values(raw, "ordonnance")
    existing = existing_map(conn, "prescriptions", "legacy_ordonnance_id")
    inserted = skipped_empty = skipped_patient = 0
    for row in rows:
        if len(row) < 6:
            continue
        old_ord = safe_int(row[0])
        if old_ord in existing:
            continue
        description = safe_str(row[5])
        pathologie = safe_str(row[6]) if len(row) > 6 else ""
        if not description and not pathologie:
            skipped_empty += 1
            continue
        pid = patient_id_map.get(safe_int(row[3]))
        if not pid:
            skipped_patient += 1
            continue
        visit_id = visit_id_map.get(safe_int(row[1])) if safe_str(row[1]) else None
        lines = [line.strip() for line in re.split(r"[\r\n]+", description) if line.strip()]
        if not lines and pathologie:
            lines = [pathologie]
        conn.execute(
            """
            INSERT INTO prescriptions
            (patient_id, visit_id, lines, ai_warnings, consultation_summary, doctor_validated, created_at, legacy_ordonnance_id)
            VALUES (?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (pid, visit_id, json.dumps(lines, ensure_ascii=False), "[]", pathologie, safe_date(row[4]) or datetime.now().isoformat(sep=" "), old_ord),
        )
        inserted += 1
        if inserted and inserted % 2000 == 0:
            conn.commit()
    conn.commit()
    print(f"  Prescriptions inserted: {inserted}, empty legacy rows ignored: {skipped_empty}, patient skipped: {skipped_patient}")


def legacy_doc_category(title: str) -> str:
    t = title.lower()
    if "certificat" in t:
        return "certificat"
    if "rapport" in t or "bilan" in t or "avis" in t:
        return "rapport"
    if "ordonnance" in t:
        return "ordonnance"
    return "general"


def import_courriers(conn: sqlite3.Connection, raw: bytes, patient_id_map: dict[int, int]) -> None:
    rows = parse_mysql_values(raw, "courrier")
    existing = existing_map(conn, "generated_documents", "legacy_courrier_id")
    inserted = skipped = 0
    for row in rows:
        if len(row) < 7:
            skipped += 1
            continue
        old_courrier = safe_int(row[0])
        if old_courrier in existing:
            continue
        pid = patient_id_map.get(safe_int(row[1]))
        body = safe_str(row[5])
        title = safe_str(row[6]) or "Courrier legacy"
        if not pid or not body:
            skipped += 1
            continue
        category = legacy_doc_category(title)
        body_html = (
            '<div data-template-layout="legacy" style="white-space:pre-wrap; '
            'font-family:Arial, Helvetica, sans-serif; font-size:13px; line-height:1.65;">'
            f"{html.escape(body)}"
            "</div>"
        )
        conn.execute(
            """
            INSERT OR IGNORE INTO generated_documents
            (patient_id, template_id, title, body_html, rendered_text, created_at, legacy_courrier_id, legacy_source)
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?)
            """,
            (pid, title[:200], body_html, body_html, safe_date(row[3]) or datetime.now().isoformat(sep=" "), old_courrier, f"courrier:{category}"),
        )
        existing[old_courrier] = old_courrier
        inserted += 1
        if inserted and inserted % 1000 == 0:
            conn.commit()
            print(f"    ... {inserted} courriers inserted")
    conn.commit()
    print(f"  Courriers/generated documents inserted: {inserted}, skipped: {skipped}")


def apply_legacy_configuration(conn: sqlite3.Connection, raw: bytes) -> None:
    rows = parse_mysql_values(raw, "configuration")
    cfg = {safe_str(row[1]): safe_str(row[2]) for row in rows if len(row) >= 3}
    info = cfg.get("Informations supp", "")
    footer = cfg.get("Informations footer", "")
    updates: dict[str, str] = {}
    if cfg.get("Nom docteur"):
        updates["DOCTOR_NAME"] = cfg["Nom docteur"].strip()
    if cfg.get("Address"):
        updates["DOCTOR_ADDRESS"] = cfg["Address"].strip()
        updates["CABINET_ADDRESS"] = cfg["Address"].strip()
    if "CARDIOLOGUE" in info.upper():
        updates["DOCTOR_SPECIALTY"] = "Medecin cardiologue"
    order_match = re.search(r"(?:ordre|ordre\s*:|N[^0-9]{0,4})([0-9][0-9/\- ]{3,})", info, re.IGNORECASE)
    if order_match:
        updates["DOCTOR_ORDER_NUMBER"] = order_match.group(1).strip(" .:-")
    email_match = re.search(r"[\w.\-+]+@[\w.\-]+", footer + "\n" + info, re.IGNORECASE)
    if email_match:
        updates["DOCTOR_EMAIL"] = email_match.group(0)
        updates["GOOGLE_DRIVE_BACKUP_EMAIL"] = email_match.group(0)
    phone_match = re.search(r"(?:0|\+213)[0-9 /.\-]{8,}", footer)
    if phone_match:
        updates["DOCTOR_PHONE"] = phone_match.group(0).strip(" .")
        updates["CABINET_PHONE"] = phone_match.group(0).strip(" .")

    now = datetime.now().isoformat(sep=" ")
    for key, value in updates.items():
        conn.execute(
            """
            INSERT INTO app_settings (key, value, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (key, value, now),
        )
    conn.commit()
    print(f"  Legacy configuration settings applied: {len(updates)}")


def run_app_init() -> None:
    """Seed settings/users/templates without adding the sample patient."""
    os.environ["CARDIO_APP_ROOT"] = str(ROOT)
    os.environ["CARDIO_BACKEND_DIR"] = str(BACKEND)
    os.environ["CARDIO_DATA_DIR"] = str(DATA)
    if str(ROOT) not in sys.path:
        sys.path.insert(0, str(ROOT))
    from backend.main import init_db

    init_db()


def summarize(conn: sqlite3.Connection) -> None:
    tables = ["patients", "visits", "vital_signs", "anthropometric_records", "appointments", "prescriptions", "generated_documents", "documents", "visit_types"]
    print("\nMigration summary")
    print("=" * 56)
    for table in tables:
        total = conn.execute(f"SELECT COUNT(*) AS total FROM {table}").fetchone()["total"]
        print(f"  {table:<24} {total:>8}")
    fees = conn.execute("SELECT COALESCE(SUM(visit_fee), 0), COALESCE(SUM(fee_paid), 0) FROM visits").fetchone()
    print(f"  {'visit fees':<24} {fees[0]:>8.0f} DA")
    print(f"  {'paid fees':<24} {fees[1]:>8.0f} DA")
    print("=" * 56)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fresh", action="store_true", help="backup and recreate data/cardiologie.sqlite3 before importing")
    args = parser.parse_args()

    if not SQL_PATH.exists():
        print(f"ERROR: SQL file not found at {SQL_PATH}")
        sys.exit(1)

    print(f"Reading SQL backup: {SQL_PATH}")
    raw = SQL_PATH.read_bytes()
    print(f"  File size: {len(raw) / 1024 / 1024:.1f} MB")

    if args.fresh:
        print("Fresh mode enabled: rebuilding production SQLite DB.")
        backup_and_reset_db()
    else:
        ensure_schema()

    with connect() as conn:
        ensure_legacy_columns(conn)
        patient_id_map = import_patients(conn, raw)
        visit_id_map = import_visits_and_measurements(conn, raw, patient_id_map)
        import_rdvtable(conn, raw, patient_id_map)
        import_calendar_appointments(conn, raw)
        import_visit_types(conn, raw)
        import_prescriptions(conn, raw, patient_id_map, visit_id_map)
        import_courriers(conn, raw, patient_id_map)
        apply_legacy_configuration(conn, raw)
        summarize(conn)

    print("\nSeeding app defaults and indexes...")
    run_app_init()
    with connect() as conn:
        ensure_legacy_columns(conn)
        summarize(conn)


if __name__ == "__main__":
    main()
