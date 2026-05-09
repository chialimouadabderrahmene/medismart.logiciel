data = open('src/App.jsx', encoding='utf-8').read()
lines = data.split('\n')

for term in ['printDocument', 'handlePrint', 'window.print', 'printOrdonnance', 'printPrescription', 'iframe']:
    idx = data.find(term)
    if idx >= 0:
        lineno = data[:idx].count('\n') + 1
        print(f'\n--- {repr(term)} at line {lineno} ---')
        for i in range(lineno-1, min(len(lines), lineno+10)):
            print(f'  {i+1}: {lines[i][:120]}')
