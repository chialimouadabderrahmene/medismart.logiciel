data = open('src/App.jsx', encoding='utf-8').read()
lines = data.split('\n')

targets = [
    'page === "patients"',
    'load-more',
    'patientTotal',
    'doctorProfile',
    'BilanPanel',
    'activeTab === "bilan"',
    'Retour',
    'filtered_total',
]
for t in targets:
    idx = data.find(t)
    if idx >= 0:
        lineno = data[:idx].count('\n') + 1
        print(f'--- "{t}" at line {lineno} ---')
        for i in range(max(0, lineno-2), min(len(lines), lineno+4)):
            print(f'  {i+1}: {lines[i][:110]}')
    else:
        print(f'NOT FOUND: {t}')
