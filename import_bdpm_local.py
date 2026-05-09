"""
Import BDPM local files (bdpm/ folder) into the MediSmart medicines_db.
Run from project root: python import_bdpm_local.py
"""
import csv
import io
import sqlite3
import os
import sys
from pathlib import Path

BDPM_DIR = Path("bdpm")
CIS_FILE = BDPM_DIR / "CIS_bdpm.txt"
COMPO_FILE = BDPM_DIR / "CIS_COMPO_bdpm.txt"

# Locate the database
DATA_CANDIDATES = [
    Path("data/medismart.db"),
    Path("data/cabinet.db"),
    Path("backend/data/medismart.db"),
]
DB_PATH = None
for c in DATA_CANDIDATES:
    if c.exists():
        DB_PATH = c
        break

if DB_PATH is None:
    # Try to find it anywhere under data/
    for root, dirs, files in os.walk("."):
        for f in files:
            if f.endswith(".db"):
                DB_PATH = Path(root) / f
                break
        if DB_PATH:
            break

if DB_PATH is None:
    print("ERROR: Could not find database file. Run the app first to create it.")
    sys.exit(1)

print(f"Database: {DB_PATH}")

# ── Load DCI map from CIS_COMPO ──────────────────────────────────────────────
print("Loading DCI/composition data...")
dci_map: dict[str, str] = {}
with open(COMPO_FILE, encoding="latin-1", errors="replace") as f:
    for row in csv.reader(f, delimiter="\t"):
        if len(row) >= 3:
            cis, substance = row[0].strip(), row[2].strip()
            if cis and substance:
                existing = dci_map.get(cis, "")
                if substance not in existing:
                    dci_map[cis] = (existing + " + " + substance).lstrip(" + ")

print(f"  {len(dci_map)} CIS codes with DCI")

# ── Read CIS_bdpm ─────────────────────────────────────────────────────────────
print("Reading CIS_bdpm.txt...")
rows_cis = []
with open(CIS_FILE, encoding="latin-1", errors="replace") as f:
    for row in csv.reader(f, delimiter="\t"):
        if len(row) >= 7:
            rows_cis.append(row)

print(f"  {len(rows_cis)} medicines found")

# ── Connect and upsert ────────────────────────────────────────────────────────
conn = sqlite3.connect(str(DB_PATH))
conn.row_factory = sqlite3.Row

# Ensure columns exist (migrate old DB)
for col, col_type in [("specialty", "TEXT"), ("cis_code", "TEXT"), ("dci", "TEXT"), ("form", "TEXT"), ("route", "TEXT")]:
    try:
        conn.execute(f"ALTER TABLE medicines_db ADD COLUMN {col} {col_type}")
        print(f"  Added column: {col}")
    except sqlite3.OperationalError:
        pass  # already exists

# Pre-load existing CIS codes
existing_cis: set[str] = {
    r[0] for r in conn.execute(
        "SELECT cis_code FROM medicines_db WHERE cis_code IS NOT NULL"
    ).fetchall()
}
print(f"  {len(existing_cis)} already in DB")

batch_insert = []
batch_update = []
skipped = 0

for row in rows_cis:
    cis_code = row[0].strip()
    name = row[1].strip()
    form = row[2].strip()
    route = row[3].strip() if len(row) > 3 else ""

    if not name or not cis_code:
        skipped += 1
        continue

    dci = dci_map.get(cis_code, "")

    if cis_code in existing_cis:
        batch_update.append((name, dci, form, route, cis_code))
    else:
        batch_insert.append((cis_code, name, dci, form, route))
        existing_cis.add(cis_code)

CHUNK = 500
print(f"Inserting {len(batch_insert)} new, updating {len(batch_update)} existing...")

for i in range(0, len(batch_insert), CHUNK):
    conn.executemany(
        "INSERT INTO medicines_db (cis_code, brand_name, dci, form, route, source, specialty) VALUES (?,?,?,?,?,'bdpm','')",
        batch_insert[i : i + CHUNK],
    )
    if i % 5000 == 0:
        print(f"  Inserted {min(i+CHUNK, len(batch_insert))}/{len(batch_insert)}...")

for i in range(0, len(batch_update), CHUNK):
    conn.executemany(
        "UPDATE medicines_db SET brand_name=?, dci=?, form=?, route=?, source='bdpm' WHERE cis_code=?",
        batch_update[i : i + CHUNK],
    )

# Rebuild FTS if table exists
fts = conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='medicines_fts'").fetchone()
if fts:
    print("Rebuilding FTS index...")
    conn.execute("INSERT INTO medicines_fts(medicines_fts) VALUES('rebuild')")

conn.commit()
conn.close()

total = len(batch_insert) + len(batch_update)
print(f"\n✓ Done: {len(batch_insert)} inserted + {len(batch_update)} updated = {total} total ({skipped} skipped)")
print(f"  DB: {DB_PATH}")
