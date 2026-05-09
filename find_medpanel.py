data = open('src/App.jsx', encoding='utf-8').read()
lines = data.split('\n')

idx = data.find('function MedicineDatabasePanel')
if idx >= 0:
    lineno = data[:idx].count('\n') + 1
    print(f'MedicineDatabasePanel at line {lineno}')
    for i in range(lineno-1, min(len(lines), lineno+60)):
        print(f'  {i+1}: {lines[i][:120]}')
