data = open('src/App.jsx', encoding='utf-8').read()
lines = data.split('\n')

# WhatsApp
idx = data.find('WhatsApp')
if idx >= 0:
    lineno = data[:idx].count('\n') + 1
    print(f'WhatsApp at line {lineno}:')
    for i in range(lineno-1, lineno+30):
        print(f'  {i+1}: {lines[i][:120]}')

# window.print
idx2 = data.find('window.print')
if idx2 >= 0:
    lineno2 = data[:idx2].count('\n') + 1
    print(f'\nwindow.print at line {lineno2}:')
    for i in range(lineno2-1, lineno2+5):
        print(f'  {i+1}: {lines[i][:120]}')
