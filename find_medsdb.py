data = open('backend/main.py', encoding='utf-8').read()
lines = data.split('\n')

# Find CREATE TABLE medicines_db
for i, l in enumerate(lines):
    if 'medicines_db' in l and ('CREATE TABLE' in l or 'cis_code' in l):
        print(i+1, l[:110])
