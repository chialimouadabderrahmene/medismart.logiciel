import re

with open('GestionMedicaleDBbackup_02-05-2026.sql', 'r', encoding='utf-8', errors='ignore') as f:
    data = f.read()

bt = chr(96)  # backtick

for tname in ['motifexaman', 'pathologie', 'examen', 'ordonnancemedicine']:
    key = f'INSERT INTO {bt}{tname}{bt}'
    idx = data.find(key)
    if idx >= 0:
        end = data.find(';', idx) + 1
        print(f'=== {tname} ===')
        print(data[idx:min(idx+2000, end)])
        print()
    else:
        print(f'=== {tname} NOT FOUND ===')
