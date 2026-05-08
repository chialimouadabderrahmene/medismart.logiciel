import re

target_tables = ['appointments', 'consultation', 'reglementpatient', 'ordonnance', 'rdvtable']
found = {t: False for t in target_tables}

with open(r'C:\Users\PC SOFT\Desktop\kamel\GestionMedicaleDBbackup_02-05-2026.sql', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()
    for i, line in enumerate(lines):
        for t in target_tables:
            if not found[t] and re.search(r'CREATE TABLE .`' + t + r'` .', line):
                print('===', t, '===')
                for j in range(i, min(i+60, len(lines))):
                    l = lines[j]
                    print(l, end='')
                    if 'ENGINE=' in l:
                        break
                print('---')
                found[t] = True

for t, v in found.items():
    if not v:
        print('===', t, '=== NOT FOUND')
