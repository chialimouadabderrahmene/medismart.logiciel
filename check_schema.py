import sqlite3
c = sqlite3.connect('data/cardiologie.sqlite3')
print(c.execute("SELECT sql FROM sqlite_master WHERE name='patients'").fetchone()[0])
print('---')
print('Columns:')
for r in c.execute("PRAGMA table_info(patients)"):
    print(r)
