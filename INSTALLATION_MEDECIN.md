# 🏥 MediSmart Pro — Guide d'installation sur PC médecin

Deux méthodes au choix selon votre situation.

---

## ✅ Méthode A — Installateur Windows (.exe) — **RECOMMANDÉE**

Produit un **seul fichier `.exe`** que le médecin double-clique pour installer. Aucune compétence technique requise côté médecin.

### 1. Sur votre PC de développement (préparation, une seule fois)

Pré-requis :
- **Python 3.11+** → https://www.python.org/downloads/ (cocher *Add to PATH*)
- **Node.js 20+** → https://nodejs.org/en/download
- **Rust** (pour Tauri) → https://www.rust-lang.org/tools/install
- **Visual Studio Build Tools** (C++ desktop) → https://visualstudio.microsoft.com/downloads/

Puis dans ce dossier, ouvrez PowerShell/CMD et lancez :

```bat
build-installer.bat
```

Ce script :
1. installe les dépendances Python (FastAPI, SQLAlchemy…)
2. compile le backend en `.exe` avec PyInstaller
3. installe les dépendances npm
4. construit le bundle Tauri (installateur NSIS)

⏱ Durée totale : ~10 min

Le résultat est créé dans :
```
src-tauri\target\release\bundle\nsis\MediSmart_Setup_x.x.x.exe
```

### 2. Sur le PC du médecin

Copier le fichier `MediSmart_Setup_x.x.x.exe` (clé USB, email, cloud…) puis :
- Double-cliquer → suivre l'assistant (3 clics : Suivant, Installer, Terminer)
- Lancer **MediSmart Pro** depuis le menu Démarrer / raccourci bureau
- Le backend démarre automatiquement en arrière-plan
- Login par défaut : `admin` / `admin123`

✅ **Aucun Python, Node ou terminal requis sur le PC du médecin.**

---

## ⚡ Méthode B — Mode portable (dev / test rapide)

Idéale si vous voulez tester avant de créer l'installateur, ou si vous avez besoin de modifier le code chez le médecin.

### Pré-requis sur le PC médecin
- Python 3.11+ (cocher *Add to PATH*)
- Node.js 20+

### Installation

```powershell
# 1. Copier tout le dossier kamel\ sur le PC
# 2. Installer les dépendances
cd C:\chemin\vers\kamel
pip install -r backend\requirements.txt
npm install

# 3. Lancer l'application (ouvre backend + frontend)
npm run dev:full
```

Ouvrir http://127.0.0.1:5173 dans le navigateur.

---

## 📦 Méthode C — Package prêt à copier (Doctor Package)

Si l'installateur Tauri pose problème, générez un dossier auto-portable :

```bat
build-installer.bat           # (optionnel — compile le backend en .exe)
prepare-doctor-package.bat
```

Résultat : un dossier `MediSmart-Doctor-Package\` contenant tout (backend.exe, frontend buildé, DB, scripts `.bat` de lancement).

Le médecin :
1. copie le dossier sur son disque (`C:\MediSmart\` par exemple)
2. double-clique sur `Start-MediSmart.bat`
3. l'application s'ouvre dans son navigateur

---

## 🔑 Configuration initiale (toutes méthodes)

Au premier lancement, le médecin doit :

1. **Se connecter** — `admin` / `admin123`
2. **Changer le mot de passe** (menu Paramètres)
3. **Configurer l'en-tête du cabinet** (bouton *En-tête* dans Modèles) :
   - Nom du médecin
   - Spécialité
   - N° d'ordre des médecins
   - Adresse, téléphone, email
   - **Logo du cabinet** (upload d'image)
4. **Vérifier la base de médicaments** — environ 15 000 médicaments BDPM sont préinstallés. Recherche dans *Médicaments*.

Toutes ces infos sont sauvegardées localement et utilisées automatiquement dans les ordonnances, certificats, bilans, etc.

---

## 🗄 Données & sauvegarde

- **Base de données** : `data\cardiologie.sqlite3` (SQLite, ~58 Mo avec 10 000 patients)
- **Uploads** (scanner, ECG, PDF…) : `data\uploads\`
- **Sauvegardes automatiques** : `data\backups\` (quotidiennes)

💾 **Recommandation** : sauvegarder `data\` régulièrement sur un disque externe ou cloud (Google Drive, OneDrive, clé USB).

---

## 🔧 Dépannage

| Problème | Solution |
|---|---|
| "Backend not reachable" | Vérifier qu'aucun autre processus n'occupe le port 8000 : `netstat -ano \| findstr :8000` |
| Frontend blanc | Vider cache navigateur (`Ctrl+F5`) ou vérifier `npm run build` |
| Logo non affiché | Le logo se recharge automatiquement — cliquer sur *En-tête* et ré-uploader si besoin |
| Antivirus bloque `cardio-backend.exe` | Signer l'exe ou ajouter une exception (faux positif typique PyInstaller) |
| Base vide | Vérifier que `data\cardiologie.sqlite3` a bien été copié avec l'installateur |

---

## ✅ Vérifications effectuées

Le code a été validé :
- ✅ Backend FastAPI démarre (139 routes)
- ✅ `/api/patients`, `/api/medicines/search`, `/api/bilan-catalog`, `/api/document-templates` → 200 OK
- ✅ Build frontend Vite OK (444 Ko JS + 183 Ko CSS)
- ✅ Ordonnances : ajout médicament + validation IA en temps réel (✓ OK / ⚠ Attention / ⛔ Danger)
- ✅ Bilan : ajout d'examen sans doublon, logo partagé avec les modèles
- ✅ Modèles : mode Aperçu (données réelles auto-remplies) / Édition (variables brutes) + IA
- ✅ Médicaments : ajout manuel + recherche BDPM complète
- ✅ Examens : ajout manuel au catalogue depuis le Bilan
