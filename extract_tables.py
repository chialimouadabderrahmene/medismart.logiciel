import re

with open(r'C:\Users\PC SOFT\Desktop\kamel\GestionMedicaleDBbackup_02-05-2026.sql', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

targets = ['examen', 'examenmodel', 'motifexaman', 'medicine', 'fichetraitement', 'fichepaie', 'ordonnance', 'pathologie']
for t in targets:
    found_create = False
    for i, line in enumerate(lines):
        if 'CREATE TABLE ' in line and t in line.lower():
            found_create = True
            print('=== SCHEMA:', t, 'line', i, '===')
            for j in range(i, min(i+60, len(lines))):
                print(lines[j].rstrip())
                if 'ENGINE=' in lines[j] or ');' in lines[j]:
                    break
            print()
            break
    if not found_create:
        print('=== NOT FOUND:', t)

    for i, line in enumerate(lines):
        if 'INSERT INTO' in line and t in line.lower():
            print('=== INSERT sample:', t, '===')
            print(lines[i][:600])
            break
