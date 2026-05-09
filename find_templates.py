data = open('src/App.jsx', encoding='utf-8').read()
lines = data.split('\n')

for term in ['DocumentTemplates', 'TemplateEditor', 'generateDocument', 'templateVars', 'PATIENT_NAME', '{{', 'variables', 'auto_fill']:
    idx = data.find(term)
    if idx >= 0:
        lineno = data[:idx].count('\n') + 1
        print(f'\n--- {repr(term)} at line {lineno} ---')
        for i in range(lineno-1, min(len(lines), lineno+8)):
            print(f'  {i+1}: {lines[i][:120]}')
