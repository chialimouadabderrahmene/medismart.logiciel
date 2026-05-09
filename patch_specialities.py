import re
data = open('src/specialities/index.js', encoding='utf-8').read()
# Add "bilan" after "diagnosis" inside patient_tabs arrays (not in TAB_REGISTRY)
new_data = data.replace('"diagnosis",\n      "followup"', '"diagnosis", "bilan",\n      "followup"')
new_data = new_data.replace('"diagnosis",\n      "fiche"', '"diagnosis", "bilan",\n      "fiche"')
# count changes
added = new_data.count('"bilan"') - data.count('"bilan"')
print(f'Added bilan to {added} locations')
open('src/specialities/index.js', 'w', encoding='utf-8').write(new_data)
