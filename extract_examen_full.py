with open('GestionMedicaleDBbackup_02-05-2026.sql', 'r', encoding='utf-8', errors='ignore') as f:
    data = f.read()

bt = chr(96)
key = f'INSERT INTO {bt}examen{bt}'
idx = data.find(key)
# find the end of this full INSERT (could span multiple lines up to ';')
end = idx
depth = 0
while end < len(data):
    c = data[end]
    if c == '(':
        depth += 1
    elif c == ')':
        depth -= 1
    elif c == ';' and depth == 0:
        end += 1
        break
    end += 1

block = data[idx:end]
# parse rows
import re
rows = re.findall(r"\((\d+),'([^']*?)','([^']*?)'", block)
print(f"Found {len(rows)} examen rows")
for r in rows:
    print(f"  ID={r[0]} Type={r[1]} Name={r[2]}")
