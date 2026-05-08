import re

with open(r'C:\Users\PC SOFT\Desktop\kamel\GestionMedicaleDBbackup_02-05-2026.sql', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

targets = ['patient', 'consultation', 'reglementpatient', 'appointments', 'ordonnance', 'rdvtable']
for t in targets:
    for i, line in enumerate(lines):
        if 'CREATE TABLE ' in line and '`' + t + '`' in line:
            print('===', t, 'at line', i, '===')
            for j in range(i, min(i+60, len(lines))):
                print(repr(lines[j][:120]))
                if 'ENGINE=' in lines[j]:
                    break
            print('---')
            break
    else:
        print('===', t, '=== NOT FOUND')
