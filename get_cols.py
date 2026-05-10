import re
with open('GestionMedicaleDBbackup_02-05-2026.sql', encoding='utf-8', errors='ignore') as f:
    content = f.read()
m = re.search(r'CREATE TABLE `patient` \((.*?)\) ENGINE=', content, re.DOTALL)
cols = re.findall(r'`(\w+)`', m.group(1)) if m else []
for i, c in enumerate(cols):
    print(i, c)
