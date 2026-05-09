data = open('src/App.jsx', encoding='utf-8').read()
lines = data.split('\n')

for term in ['new-visit', 'ordonnance-tab', 'TabContent', 'workspace-content', 'tab-content']:
    idx = data.find(term)
    if idx > 0:
        lineno = data[:idx].count('\n') + 1
        print(f'Found {repr(term)} at line {lineno}')
        for i in range(lineno-1, lineno+8):
            print(f'  {i+1}: {lines[i][:110]}')
        print()
