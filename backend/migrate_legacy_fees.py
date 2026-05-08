#!/usr/bin/env python3
"""
Migrate remaining data from legacy SQL backup:
1. Update visit fees from consultation data (ConsultationFee, ConsultationRemainFee)
2. Import appointments from rdvtable
3. Fix patient antecedent data (maladies, notes)
"""

import re
import sqlite3
from datetime import datetime
from pathlib import Path

BACKEND = Path(__file__).resolve().parent
ROOT = BACKEND.parent
DATA = ROOT / "data"
DB_PATH = DATA / "cardiologie.sqlite3"
SQL_PATH = ROOT / "GestionMedicaleDBbackup_02-05-2026.sql"


def connect():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=OFF")  # OFF for migration
    return conn


def parse_mysql_values(raw_bytes, table_name):
    pattern = rb"INSERT INTO `" + table_name.encode() + rb"` VALUES\s*"
    records = []
    for m in re.finditer(pattern, raw_bytes):
        start = m.end()
        depth = 0
        i = start
        end = len(raw_bytes)
        stmt_end = start
        while i < end:
            ch = raw_bytes[i]
            if ch == ord("("):
                depth += 1
            elif ch == ord(")"):
                depth -= 1
                if depth == 0:
                    stmt_end = i + 1
            elif ch == ord(";") and depth == 0:
                stmt_end = i
                break
            i += 1
        block = raw_bytes[start:stmt_end].decode("utf-8", errors="replace")
        records.extend(parse_value_tuples(block))
    return records


def parse_value_tuples(block):
    results = []
    i = 0
    n = len(block)
    while i < n:
        if block[i] == "(":
            values, i = parse_one_tuple(block, i)
            results.append(values)
        else:
            i += 1
    return results


def parse_one_tuple(block, start):
    i = start + 1
    values = []
    n = len(block)
    while i < n and block[i] != ")":
        while i < n and block[i] in " \t\r\n":
            i += 1
        if i >= n or block[i] == ")":
            break
        if block[i] == "'":
            val, i = parse_quoted_string(block, i)
            values.append(val)
        elif block[i:i+4].upper() == "NULL":
            values.append(None)
            i += 4
        else:
            j = i
            while j < n and block[j] not in ",)":
                j += 1
            val = block[i:j].strip()
            values.append(None if val.upper() == "NULL" else val)
            i = j
        while i < n and block[i] in " \t\r\n,":
            i += 1
    if i < n and block[i] == ")":
        i += 1
    return values, i


def parse_quoted_string(block, start):
    i = start + 1
    parts = []
    n = len(block)
    while i < n:
        if block[i] == "\\" and i + 1 < n:
            nc = block[i + 1]
            esc = {"'": "'", "\\": "\\", "n": "\n", "r": "\r", "t": "\t", "0": "\0"}
            parts.append(esc.get(nc, nc))
            i += 2
        elif block[i] == "'" and i + 1 < n and block[i + 1] == "'":
            parts.append("'")
            i += 2
        elif block[i] == "'":
            i += 1
            break
        else:
            parts.append(block[i])
            i += 1
    return "".join(parts), i


def safe_float(val, default=0.0):
    if val is None:
        return default
    try:
        return float(str(val).strip())
    except (ValueError, TypeError):
        return default


def safe_int(val, default=0):
    if val is None:
        return default
    try:
        return int(float(str(val).strip()))
    except (ValueError, TypeError):
        return default


def safe_str(val):
    return str(val).strip() if val else ""


def safe_date(val):
    if val is None:
        return None
    s = str(val).strip()
    if not s or s.startswith("0000"):
        return None
    for fmt in ["%Y-%m-%d %H:%M:%S", "%Y-%m-%d"]:
        try:
            return datetime.strptime(s[:19], fmt).isoformat()
        except ValueError:
            continue
    return s[:19] if len(s) >= 10 else None


def main():
    print(f"Reading SQL backup...")
    with open(SQL_PATH, "rb") as f:
        raw = f.read()
    print(f"  File size: {len(raw) / 1024 / 1024:.1f} MB")

    conn = connect()

    # =========================================================
    # 1. Update visit fees from consultations
    # =========================================================
    print("\n=== Updating visit fees ===")
    consultation_rows = parse_mysql_values(raw, "consultation")
    print(f"  Parsed {len(consultation_rows)} consultation records")

    # Build map: legacy_consultation_id -> (fee, remain_fee)
    # Consultation: 0:ID, 1:PatientID, 2:Name, 3:Fee, 4:RemainFee, ...
    updated = 0
    for row in consultation_rows:
        if len(row) < 5:
            continue
        old_cid = safe_int(row[0])
        fee = safe_float(row[3])
        remain = safe_float(row[4])
        if fee <= 0 and remain <= 0:
            continue

        paid = max(fee - remain, 0)
        status = "paid" if remain <= 0 and fee > 0 else ("partial" if paid > 0 else "pending")
        name = safe_str(row[2])

        result = conn.execute(
            """UPDATE visits SET visit_fee = ?, fee_paid = ?, payment_status = ?, visit_type = COALESCE(visit_type, ?)
               WHERE legacy_consultation_id = ?""",
            (fee, paid, status, name or None, old_cid),
        )
        if result.rowcount > 0:
            updated += 1

        if updated % 5000 == 0 and updated > 0:
            conn.commit()
            print(f"    ... {updated} visits updated")

    conn.commit()
    print(f"  Updated {updated} visits with fee data")

    # Check totals
    r = conn.execute("SELECT COUNT(*) as cnt, COALESCE(SUM(visit_fee),0) as total_fees, COALESCE(SUM(fee_paid),0) as total_paid FROM visits WHERE visit_fee > 0").fetchone()
    print(f"  Visits with fees: {r['cnt']}, Total fees: {r['total_fees']:,.0f} DA, Total paid: {r['total_paid']:,.0f} DA")

    # =========================================================
    # 2. Import appointments (rdvtable)
    # =========================================================
    print("\n=== Importing appointments ===")
    existing_appts = conn.execute("SELECT COUNT(*) FROM appointments").fetchone()[0]
    print(f"  Current appointments: {existing_appts}")

    rdv_rows = parse_mysql_values(raw, "rdvtable")
    print(f"  Parsed {len(rdv_rows)} rdvtable records")

    # Build patient ID map (legacy_patient_id -> new id)
    pid_map = {}
    for row in conn.execute("SELECT id, legacy_patient_id FROM patients WHERE legacy_patient_id IS NOT NULL"):
        pid_map[row["legacy_patient_id"]] = row["id"]
    print(f"  Patient ID map: {len(pid_map)} entries")

    # rdvtable: 0:RDVID, 1:PatientID, 2:DateOfRDV, 3:TypeRDV, 4:DateOfInsertion, 5:SubjectRDV
    a_inserted = 0
    a_skipped = 0
    for row in rdv_rows:
        if len(row) < 3:
            a_skipped += 1
            continue
        old_pid = safe_int(row[1])
        new_pid = pid_map.get(old_pid)
        if not new_pid:
            a_skipped += 1
            continue

        rdv_date = safe_date(row[2])
        if not rdv_date:
            a_skipped += 1
            continue

        title = safe_str(row[5]) if len(row) > 5 else ""
        type_rdv = safe_str(row[3]) if len(row) > 3 else "Normal"
        status = "done"

        try:
            conn.execute(
                "INSERT INTO appointments (patient_id, title, scheduled_at, status, notes) VALUES (?, ?, ?, ?, ?)",
                (new_pid, title or type_rdv or "Rendez-vous", rdv_date, status, ""),
            )
            a_inserted += 1
        except Exception:
            a_skipped += 1

        if a_inserted % 2000 == 0 and a_inserted > 0:
            conn.commit()
            print(f"    ... {a_inserted} appointments inserted")

    conn.commit()
    print(f"  Inserted: {a_inserted}, Skipped: {a_skipped}")

    # =========================================================
    # 3. Fix antecedent data (merge into patient notes)
    # =========================================================
    print("\n=== Updating patient antecedents ===")
    antecedent_rows = parse_mysql_values(raw, "antecedent")
    print(f"  Parsed {len(antecedent_rows)} antecedent records")
    # 0:ChroniqueID, 1:ANTCDChirurgie, 2:ANTCDChronique, 3:ANTCDFamilly,
    # 4:ANTCDOther, 5:PatientID, 6:ATCDconjoint, 7:ATCDGeyneco, 8:ATCDObsteterecou

    ant_updated = 0
    for row in antecedent_rows:
        if len(row) < 9:
            continue
        old_pid = safe_int(row[5])
        new_pid = pid_map.get(old_pid)
        if not new_pid:
            continue

        chirurgie = safe_str(row[1])
        chronique = safe_str(row[2])
        family = safe_str(row[3])
        other = safe_str(row[4])
        gyneco = safe_str(row[7])
        obstetric = safe_str(row[8])

        maladies_parts = []
        if chronique:
            maladies_parts.append(chronique)
        if family:
            maladies_parts.append("ATCD Familiaux: " + family)
        maladies = "\n".join(maladies_parts)

        notes_parts = []
        if chirurgie:
            notes_parts.append("ATCD Chirurgie: " + chirurgie)
        if other:
            notes_parts.append(other)
        if gyneco:
            notes_parts.append("Gyneco: " + gyneco)
        if obstetric:
            notes_parts.append("Obstetrique: " + obstetric)
        notes = "\n".join(notes_parts)

        if maladies or notes:
            conn.execute(
                "UPDATE patients SET maladies = ?, notes_importantes = ? WHERE id = ?",
                (maladies, notes, new_pid),
            )
            ant_updated += 1

    conn.commit()
    print(f"  Updated {ant_updated} patients with antecedent data")

    # =========================================================
    # 4. Final summary
    # =========================================================
    total_p = conn.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
    total_v = conn.execute("SELECT COUNT(*) FROM visits").fetchone()[0]
    total_a = conn.execute("SELECT COUNT(*) FROM appointments").fetchone()[0]
    fees = conn.execute("SELECT COALESCE(SUM(visit_fee),0) as f, COALESCE(SUM(fee_paid),0) as p FROM visits").fetchone()

    print(f"\n{'='*50}")
    print(f"MIGRATION COMPLETE")
    print(f"{'='*50}")
    print(f"  Patients:     {total_p}")
    print(f"  Visits:       {total_v}")
    print(f"  Appointments: {total_a}")
    print(f"  Total fees:   {fees['f']:,.0f} DA")
    print(f"  Total paid:   {fees['p']:,.0f} DA")
    print(f"  Balance:      {fees['f'] - fees['p']:,.0f} DA")
    print(f"{'='*50}")

    conn.close()


if __name__ == "__main__":
    main()
