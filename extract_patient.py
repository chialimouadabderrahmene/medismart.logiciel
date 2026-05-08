import re

with open(r'C:\Users\PC SOFT\Desktop\kamel\GestionMedicaleDBbackup_02-05-2026.sql', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

for t in ['patient', 'consultation', 'reglementpatient']:
    pattern = r'CREATE TABLE `' + t + r'` \((.*?)\) ENGINE='
    m = re.search(pattern, content, re.DOTALL)
    if m:
        print('===', t, '===')
        print(m.group(1)[:1000])
        print('---')
    else:
        print('===', t, '=== NOT FOUND')
