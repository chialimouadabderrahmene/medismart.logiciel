from __future__ import annotations

import sqlite3
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BACKEND = ROOT / "backend"
DATA = ROOT / "data"
DB_PATH = BACKEND / "cardio_cabinet.db"
DUMP_PATH = ROOT / "GestionMedicaleDBbackup_02-05-2026.sql"

PATIENT_COLUMNS = [
    "PatientID", "OldPatientID", "Guid", "PatientCountry", "PatientWilaya", "WilayaName",
    "PatientDaira", "DairaName", "PatientCommune", "CommuneName", "PatientVillage",
    "PatientFirstName", "PatientLastName", "PatientSexe", "PatientBirthDay", "PatientAge",
    "PatientPhone", "PatientFix", "PatientMobile1", "PatientMobile2", "PatientEmail",
    "PatSituationFami", "PatKidNumber", "PatSecurityState", "SecurityAgence", "SecurityNumber",
    "PatGrossesState", "PatGrossesMonth", "PatSignePhysic", "PatTabagismeState", "PatProfession",
    "PatSocialState", "PatUniqueCode", "PatEtat", "PatChroniqueDeceise", "PieceIdentity",
    "DelivrancePC", "PatDays", "PatientTransfusion", "PatMonths", "Toxo", "ATCD", "NOMJF",
    "FCV", "FcvDescription", "PatBloodGroupe", "ToxoDescription", "Rubeole",
    "RubeoleDescription", "Mamographie", "PatGestation", "MedecinOriented", "HealthCareCode",
    "id_dicom", "ID",
]

CONSULTATION_COLUMNS = [
    "ConsultationID", "PatientID", "ConsultationName", "ConsultationFee", "ConsultationRemainFee",
    "ConsultationDate", "DocumentDesc", "ConsSignePhysic", "diagExamen", "ConsultationMotifvisite",
    "ConsultationWeight", "ConsultationTall", "ConsultationIMC", "ConsultationExamen",
    "ConsultationTraitement", "HistoireMaladie", "GrossesseState", "NumberOfKids", "TensionMin",
    "TensionMax", "Glycimie", "WeightDDS", "TailleDDS", "IMCnote", "PC", "Temperat",
    "FreqResp", "FreqCard", "ID_tache", "ID",
]


def connect() -> sqlite3.Connection:
    DATA.mkdir(exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript((BACKEND / "schema.sql").read_text(encoding="utf-8"))
    for table, column, spec in [
        ("patients", "legacy_patient_id", "INTEGER"),
        ("visits", "legacy_consultation_id", "INTEGER"),
    ]:
        existing = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
        if column not in existing:
            conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {spec}")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_legacy_patient_id ON patients(legacy_patient_id)")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_visits_legacy_consultation_id ON visits(legacy_consultation_id)")


def mysql_unescape(value: str) -> str:
    result: list[str] = []
    i = 0
    while i < len(value):
        char = value[i]
        if char == "\\" and i + 1 < len(value):
            nxt = value[i + 1]
            result.append({
                "0": "\0",
                "n": "\n",
                "r": "\r",
                "t": "\t",
                "b": "\b",
                "Z": "\x1a",
                "\\": "\\",
                "'": "'",
                '"': '"',
            }.get(nxt, nxt))
            i += 2
            continue
        result.append(char)
        i += 1
    return "".join(result)


def parse_token(token: str, quoted: bool) -> str | None:
    if quoted:
        return mysql_unescape(token)
    text = token.strip()
    if text.upper() == "NULL":
        return None
    return text


def parse_values(statement: str):
    marker = " VALUES "
    start = statement.find(marker)
    if start == -1:
        return

    text = statement[start + len(marker):].strip()
    if text.endswith(";"):
        text = text[:-1]

    in_tuple = False
    in_string = False
    escaped = False
    quoted = False
    token: list[str] = []
    row: list[str | None] = []

    for char in text:
        if not in_tuple:
            if char == "(":
                in_tuple = True
                row = []
                token = []
                quoted = False
            continue

        if in_string:
            if escaped:
                token.append("\\" + char)
                escaped = False
                continue
            if char == "\\":
                escaped = True
                continue
            if char == "'":
                in_string = False
                continue
            token.append(char)
            continue

        if char == "'":
            in_string = True
            quoted = True
            continue
        if char == ",":
            row.append(parse_token("".join(token), quoted))
            token = []
            quoted = False
            continue
        if char == ")":
            row.append(parse_token("".join(token), quoted))
            yield row
            in_tuple = False
            token = []
            quoted = False
            continue
        token.append(char)


def iter_insert_statements(table_name: str):
    prefix = f"INSERT INTO `{table_name}` VALUES"
    collecting = False
    chunks: list[str] = []

    with DUMP_PATH.open("r", encoding="utf-8", errors="replace", newline="") as handle:
        for line in handle:
            if not collecting:
                if line.startswith(prefix):
                    chunks = [line]
                    collecting = not line.rstrip().endswith(";")
                    if not collecting:
                        yield "".join(chunks)
            else:
                chunks.append(line)
                if line.rstrip().endswith(";"):
                    collecting = False
                    yield "".join(chunks)


def as_int(value: str | None) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(float(value))
    except ValueError:
        return None


def clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def import_patients(conn: sqlite3.Connection) -> int:
    imported = 0
    for statement in iter_insert_statements("patient"):
        for row in parse_values(statement):
            if len(row) != len(PATIENT_COLUMNS):
                continue
            data = dict(zip(PATIENT_COLUMNS, row))
            legacy_id = as_int(data["PatientID"])
            if legacy_id is None:
                continue
            code = clean(data["PatUniqueCode"]) or f"LEGACY-{legacy_id}"
            before = conn.total_changes
            conn.execute(
                """
                INSERT OR IGNORE INTO patients
                (code, nom, prenom, date_naissance, age, sexe, groupe_sanguin, situation_familiale,
                 adresse, telephone, profession, oriente_par, allergies, maladies, notes_importantes,
                 qr_token, legacy_patient_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    code,
                    clean(data["PatientFirstName"]) or "SANS NOM",
                    clean(data["PatientLastName"]) or "",
                    clean(data["PatientBirthDay"]),
                    as_int(data["PatientAge"]),
                    clean(data["PatientSexe"]),
                    clean(data["PatBloodGroupe"]),
                    clean(data["PatSituationFami"]),
                    clean(data["PatientVillage"]),
                    clean(data["PatientPhone"]) or clean(data["PatientMobile1"]) or clean(data["PatientMobile2"]),
                    clean(data["PatProfession"]),
                    clean(data["MedecinOriented"]),
                    clean(data["ATCD"]),
                    clean(data["PatChroniqueDeceise"]),
                    clean(data["PatEtat"]) or clean(data["PatSignePhysic"]),
                    uuid.uuid4().hex,
                    legacy_id,
                ),
            )
            if conn.total_changes > before:
                imported += 1
    return imported


def patient_id_by_legacy(conn: sqlite3.Connection) -> dict[int, int]:
    return {
        int(row["legacy_patient_id"]): int(row["id"])
        for row in conn.execute("SELECT id, legacy_patient_id FROM patients WHERE legacy_patient_id IS NOT NULL").fetchall()
    }


def import_consultations(conn: sqlite3.Connection) -> int:
    legacy_map = patient_id_by_legacy(conn)
    imported = 0
    for statement in iter_insert_statements("consultation"):
        for row in parse_values(statement):
            if len(row) != len(CONSULTATION_COLUMNS):
                continue
            data = dict(zip(CONSULTATION_COLUMNS, row))
            legacy_consultation_id = as_int(data["ConsultationID"])
            legacy_patient_id = as_int(data["PatientID"])
            patient_id = legacy_map.get(legacy_patient_id or -1)
            if patient_id is None or legacy_consultation_id is None:
                continue
            before = conn.total_changes
            conn.execute(
                """
                INSERT OR IGNORE INTO visits
                (patient_id, date_visite, motif, histoire, examens, diagnostics, traitements,
                 tension, frequence_cardiaque, glycemie, poids, taille, legacy_consultation_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    patient_id,
                    clean(data["ConsultationDate"]),
                    clean(data["ConsultationMotifvisite"]),
                    clean(data["HistoireMaladie"]),
                    clean(data["ConsultationExamen"]),
                    clean(data["DocumentDesc"]) or clean(data["diagExamen"]),
                    clean(data["ConsultationTraitement"]),
                    " / ".join(part for part in [clean(data["TensionMax"]), clean(data["TensionMin"])] if part),
                    clean(data["FreqCard"]),
                    clean(data["Glycimie"]),
                    clean(data["ConsultationWeight"]),
                    clean(data["ConsultationTall"]),
                    legacy_consultation_id,
                ),
            )
            if conn.total_changes > before:
                imported += 1
    return imported


def main() -> int:
    if not DUMP_PATH.exists():
        print(f"Missing dump file: {DUMP_PATH}", file=sys.stderr)
        return 1

    with connect() as conn:
        ensure_schema(conn)
        patients = import_patients(conn)
        visits = import_consultations(conn)
        conn.execute(
            "INSERT INTO audit_log (user_id, action, entity, detail) VALUES (?, ?, ?, ?)",
            (1, "legacy_import", "mysql_dump", f"patients={patients}, visits={visits}"),
        )
        conn.commit()

        total_patients = conn.execute("SELECT COUNT(*) AS total FROM patients").fetchone()["total"]
        total_visits = conn.execute("SELECT COUNT(*) AS total FROM visits").fetchone()["total"]

    print(f"Imported patients: {patients}")
    print(f"Imported visits: {visits}")
    print(f"SQLite totals -> patients: {total_patients}, visits: {total_visits}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
