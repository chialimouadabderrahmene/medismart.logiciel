# Cardio Cabinet Pro

Local desktop-style medical software for a cardiologist, inspired by French/Algerian clinic software.

## Structure

```text
backend/
  main.py                 FastAPI API
  schema.sql              SQLite SQL schema
  medications_seed.json   Local medication rules/dataset
  requirements.txt        Python dependencies
data/
  cardiologie.sqlite3     Created automatically
  uploads/                Scanner, IRM, ECG, analyses, PDFs/images
  backups/                Local SQLite backups
src/
  App.jsx                 React clinic interface
  api.js                  Frontend API client
  styles.css              Blue desktop-style UI
src-tauri/
  tauri.conf.json         Tauri desktop window/config
  Cargo.toml              Tauri Rust package
mobile-upload-vercel/
  index.html              Public QR upload page hosted by Vercel
  script.js               Direct upload to Cloudflare Tunnel / local FastAPI
  vercel.json             Rewrites /upload/{patient_id} to the static page
```

## Features Built

- Local SQLite database.
- Login system: default `admin` / `admin123`.
- Patient CRUD.
- Visit medical form with motif, history, exams, diagnostics and treatments.
- Upload documents: scanner, IRM, ECG, analyses, PDF/images.
- QR code endpoint for patient phone upload.
- Local medication dataset.
- Rule-based AI cardio assistant for warnings, interactions, suggestions and consultation summary.
- AI document analysis module for uploaded ECG, lab, imaging and PDF/image documents with OpenRouter (Qwen) or local OCR/rule fallback.
- Doctor validation workflow for AI summaries: draft, accepted, rejected, editable final summary, and confirmed lab-value extraction.
- Save prescription logic.
- Export prescription PDF.
- Appointments with urgent/normal status and SMS/WhatsApp reminder simulation.
- Patient timeline combining visits, documents and prescriptions.
- Drag/drop document upload with image/PDF preview and document notes.
- QR mobile upload: Vercel hosts only the form; files upload directly to the clinic PC through Cloudflare Tunnel.
- Basic ECG visualization panel.
- Audit log.
- Backup endpoint.
- Tauri desktop wrapper.

## Install

Free disk space first. This project needs room for Python and Node dependencies.

```powershell
python -m pip install -r backend\requirements.txt
npm install
```

## Run

Terminal 1:

```powershell
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Terminal 2:

```powershell
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Production static preview is also available after `npm run build`:

```powershell
node server\index.js
```

Open:

```text
http://127.0.0.1:4000
```

## Desktop with Tauri

Tauri files are generated in `src-tauri/`. Install Rust first from `https://rustup.rs/`, then run:

```powershell
npm run desktop:dev
npm run desktop:build
```

`desktop:dev` starts FastAPI and Tauri. The desktop app still stores everything locally in SQLite and local folders.

## API Highlights

- `POST /api/auth/login`
- `GET /api/patients`
- `POST /api/patients`
- `PUT /api/patients/{id}`
- `DELETE /api/patients/{id}`
- `POST /api/patients/{id}/visits`
- `POST /api/patients/{id}/documents`
- `POST /api/patients/{id}/documents/upload-mobile`
- `POST /api/patients/{id}/mobile-upload-token`
- `PUT /api/documents/{id}/notes`
- `GET /api/patients/{id}/qr`
- `GET /mobile-upload/{token}`
- `POST /api/ai/cardio-check`
- `GET /api/appointments`
- `POST /api/appointments`
- `PUT /api/appointments/{id}`
- `POST /api/prescriptions`
- `GET /api/prescriptions/{id}/pdf`
- `POST /api/backups`
- `GET /api/audit`
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/upload-mode`
- `POST /api/upload-mode/test`
- `POST /api/tunnel/start`
- `POST /api/tunnel/stop`
- `GET /api/tunnel/status`
- `GET /api/patients/{id}/documents`
- `POST /api/documents/{id}/ai-analyze`
- `GET /api/documents/{id}/ai-analysis`
- `PUT /api/ai-analysis/{id}/accept`
- `PUT /api/ai-analysis/{id}/reject`
- `PUT /api/ai-analysis/{id}/edit`
- `POST /api/ai-analysis/{id}/save-labs`

## Medical Safety

The AI assistant is a local rule-based warning helper. It checks example contraindications, allergies and interactions from `medications_seed.json`. It does not diagnose, prescribe, or replace the cardiologist. The doctor validates every warning and every prescription.

## QR Mobile Upload - Permanent Setup

Medical data remains local on the clinic laptop:

- SQLite stays in `data/cardiologie.sqlite3`.
- Patient files stay in `data/uploads/{patient_id}/`.
- Vercel hosts only the static phone upload page.
- Cloudflare Tunnel only transports the upload request to the local FastAPI backend.
- Vercel never stores patient data or files.

### One-Time Windows Cloudflare Setup

Run these commands once on the clinic laptop:

```powershell
cloudflared login
cloudflared tunnel create cardio-app
cloudflared tunnel route dns cardio-app upload.myclinic.com
cloudflared service install
```

Copy `cloudflare-tunnel/config.example.yml` to the Cloudflare config folder, update the credentials path if needed, then restart the `cloudflared` Windows service.

Example settings in the app:

```text
VERCEL_UPLOAD_URL=https://clinic-upload.vercel.app
PUBLIC_PC_UPLOAD_URL=https://upload.myclinic.com
```

`PUBLIC_PC_UPLOAD_URL` must be public HTTPS. Do not use `localhost`, `127.0.0.1`, or a local Wi-Fi IP in a QR code.

### Doctor Workflow

1. Open a patient profile.
2. Open the `Documents` tab.
3. Click `Nouveau QR 15 min`.
4. The QR opens:

```text
{VERCEL_UPLOAD_URL}/upload/{patient_id}?token={token}&target={PUBLIC_PC_UPLOAD_URL}
```

5. The phone uploads directly to:

```text
{PUBLIC_PC_UPLOAD_URL}/api/patients/{patient_id}/documents/upload-mobile
```

6. The PC app refreshes the Documents tab every 5 seconds. Files uploaded by phone show `source = QR Mobile`.

### Security Rules

- Tokens expire after 15 minutes.
- Tokens are stored hashed in SQLite.
- Allowed files: PDF, JPG, PNG, DICOM.
- Blocked files: EXE, MSI, BAT, CMD, scripts.
- Max mobile upload size: 50 MB.
- If the tunnel is not configured, the app shows `Offline upload unavailable` and refuses to generate a localhost QR.

### Settings Page

Use `Parametres` to configure:

- `VERCEL_UPLOAD_URL`
- `PUBLIC_PC_UPLOAD_URL`
- Google Drive backup email
- Google Drive local sync folder
- AI provider: Disabled, OpenRouter (Qwen), or local OCR
- AI API keys, model name, maximum AI file size, auto-analysis, and manual consent requirement

Use `Test connection` to verify the public tunnel reaches `/api/health`.

### Google Drive Backup

The app creates a local SQLite backup first, then can copy it to a Google Drive Desktop synced folder. Configure `GOOGLE_DRIVE_BACKUP_DIR` to the local synced folder for `kchiali@gmail.com`; Google Drive Desktop will upload it automatically.

Direct Google Drive API upload requires OAuth/Drive connector authorization. Without that authorization, the safe production path is the local synced folder because the backup still starts locally and no patient data is sent to an unauthenticated cloud endpoint.

## Existing MySQL Backup

`GestionMedicaleDBbackup_02-05-2026.sql` is preserved. It is still the original MySQL dump. The new app uses SQLite locally; a future migration script can map the old `patient`, `consultation`, `ordonnance`, and document tables into the new normalized SQLite schema.
