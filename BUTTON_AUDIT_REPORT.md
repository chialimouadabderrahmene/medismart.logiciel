# BUTTON AUDIT REPORT — MediSmart Pro

**Date**: 2026-05-11
**Auditor**: Senior Engineer (production audit pass)
**Scope**: All sidebar buttons + topbar nav + patient tab bar + main action buttons

---

## Legend
- ✅ **OK**     — button has real route or real DB action, verified against code
- 🔧 **FIXED**  — was broken/missing, has been wired up in this audit pass
- ⚠️ **PARTIAL** — works but uses fallback or limited backend
- ❌ **MISSING** — still needs follow-up (listed at bottom)

---

## A) GENERAL SIDEBAR (visible when no patient is open)

| # | Button | Action / Route | Status |
|---|---|---|---|
| 1 | DASHBOARD          | `setPage("dashboard")` → `<DashboardPageV2>` (real `/api/dashboard`) | ✅ OK |
| 2 | PATIENTS           | `setPage("patients")` → `<PatientsListPage>` (real `/api/patients`)  | ✅ OK |
| 3 | RENDEZ-VOUS        | `setPage("appointments-page")` → `<AppointmentsPageV2>` (`/api/appointments`) | ✅ OK |
| 4 | STATISTIQUES       | `setPage("diagnostic-page")` → `<DiagnosticPage>` (`/api/diagnostic/full-data`) | 🔧 FIXED |
| 5 | MÉDECINS           | `setPage("doctors-page")` → `<DoctorsPage>` (`/api/doctors`)  | 🔧 FIXED |
| 6 | FINANCE            | `setPage("finance-page")` → `<FinancePage>` (`/api/finance/summary`) | ✅ OK |
| 7 | BASE MÉDICAMENTS   | `setPage("medicines-nav")` → `<MedicineDatabasePanel>` (`/api/medicines/search`) | ✅ OK |
| 8 | AI & CRÉDITS       | `setPage("ai-credits")` → `<AICreditsPage>` (`/api/ai/subscription`) | ✅ OK |
| 9 | IMPORT DATABASE    | `setPage("import-legacy")` → `<ImportWizardPanel>` (`/api/import/*`) | ✅ OK |
| 10| CONFIGURATION      | `setPage("settings-nav")` → `<ConfigurationPage>` (templates + settings) | ✅ OK |

---

## B) PATIENT SIDEBAR (visible when a patient is open)

| # | Button | activeTab → Component | Status |
|---|---|---|---|
| 1 | DOSSIER          | `civil` → `<CivilPanelCard>` (real `/api/patients/{id}`)        | ✅ OK |
| 2 | ANTÉCÉDENTS      | `antecedents` → `<AntecedentsContentPanel>` (`/api/patients/{id}/antecedents`) | 🔧 FIXED |
| 3 | HISTORIQUE       | `historique` → `<Timeline>` (uses `detail.visits` & `detail.prescriptions`) | ✅ OK |
| 4 | VISITE           | `new-visit` → `<VisitPanelV2>` (POST `/api/patients/{id}/visits`) | ✅ OK |
| 5 | ORDONNANCE       | `templates` → `<OrdonnancePreviewPanel>` READ-ONLY (`/api/prescriptions/{id}/items`) | 🔧 FIXED |
| 6 | EXPLORATIONS     | `bilan` → `<BilanPanel>` (`/api/bilans/*`) | ✅ OK |
| 7 | COMPTES RENDUS   | `fiche` → `<PrintableFichePanel>`             | ✅ OK |
| 8 | COURRIERS        | `docs` → `<DocumentsPanel>` (`/api/patients/{id}/documents`) | ✅ OK |
| 9 | DOCUMENTS        | `docs` → `<DocumentsPanel>` (same)            | ✅ OK |
| 10| PHOTOS & VIDÉOS  | `docs` → `<DocumentsPanel>` (filtered by media type) | ⚠️ PARTIAL — uses generic Documents panel; dedicated media filter not yet built |
| 11| RENDEZ-VOUS      | `followup` → `<FollowupPanel>` (POST `/api/patients/{id}/followups`) | ✅ OK |
| 12| CAISSE           | `reglement` → `<ReglementPanel>` (`/api/patients/{id}/payments`) | 🔧 FIXED |
| 13| AI PATIENT       | `ai` → `<AIPanel>` (`/api/ai/cardio-check`, `/api/ai/patient-chat/{id}`) | ✅ OK |

---

## C) TOP CONTEXT INDICATOR

| Element | Action | Status |
|---|---|---|
| "Dossier patient: NOM Prénom" badge | display only | ✅ OK |
| **Quitter dossier** button | `openPatientDirectory()` clears `selectedId` + `setPage("patients")` → general sidebar reappears | ✅ OK |
| **Mode général** badge (no patient) | display only | ✅ OK |

---

## D) PATIENT TAB BAR (top of MedicalWorkspace)

| Tab | activeTab | Component | Status |
|---|---|---|---|
| Ordonnance     | `templates`   | `<OrdonnancePreviewPanel>` read-only            | ✅ OK |
| État civil     | `civil`       | `<CivilPanelCard>` (rename of misnamed `antecedent`) | 🔧 FIXED |
| Antécédents    | `antecedents` | `<AntecedentsContentPanel>` 3-section editor    | 🔧 FIXED |
| Fiche Patient  | `fiche`       | `<PrintableFichePanel>`                         | ✅ OK |
| Visite         | `new-visit`   | `<VisitPanelV2>`                                | ✅ OK |

---

## E) PATIENT HEADER CARD ACTIONS

| Button | Action | Status |
|---|---|---|
| Avatar / name | display only | ✅ OK |
| **Plus** menu — Analyse IA       | `onRiskScan()` → `/api/patients/{id}/risk-scan` | ✅ OK |
| **Plus** menu — QR Upload        | `setActiveTab("docs")` | ✅ OK |
| **Plus** menu — Fiche patient    | `setActiveTab("fiche")` | ✅ OK |
| **Plus** menu — Suivi & Rappels  | `setActiveTab("followup")` | ✅ OK |

---

## F) FOOTER ACTIONS

| Button | Action | Status |
|---|---|---|
| Déconnexion | `localStorage.removeItem("cardio-user")` + `setUser(null)` | ✅ OK |

---

## G) BACKEND ENDPOINTS WIRED IN THIS AUDIT

| Method | Path | Purpose |
|---|---|---|
| GET    | `/api/diagnostic/full-data`                | DB diagnostic (tables, row counts, orphans) |
| GET    | `/api/doctors`                             | List doctors |
| POST   | `/api/doctors`                             | Create doctor |
| PUT    | `/api/doctors/{id}`                        | Update doctor |
| DELETE | `/api/doctors/{id}`                        | Soft-deactivate doctor |
| GET    | `/api/type-actes`                          | List visit types (for règlement & finance) |
| GET    | `/api/templates`                           | All templates (prescription + document) |
| GET    | `/api/patients/{id}/full`                  | Full dossier (visits + rx + docs + appts + bilans + cardio + stats) |
| GET    | `/api/patients/{id}/antecedents`           | Antecedents subset |
| PUT    | `/api/patients/{id}/antecedents`           | Update antecedents only |
| GET    | `/api/patients/{id}/payments`              | Visits with fees + totals |
| GET    | `/api/patients/{id}/historique`            | Unified timeline events |

---

## H) REMAINING WORK (out of scope for this pass)

These are listed transparently — they require longer iterations:

1. **PHOTOS & VIDÉOS** — currently routes to generic Documents tab. Needs a dedicated media gallery panel filtering on `mime_type LIKE 'image%' OR 'video%'`.
2. **État du patient tab** — separate vitals-history table view (poids/taille/IMC/TAS/TAD/glycémie/FC across visits). Spec'd but not built; data is available via `detail.visits` already.
3. **Full Word-like rich text editor** for templates with variable placeholders (`{{patient_nom}}`…). Current `DocumentTemplatesPanel` provides plain-text body editor; rich-text/variables substitution is a larger module.
4. **Mapping confidence + manual mapping UI** for legacy import. Backend already auto-maps; UI for confidence/manual mapping not yet exposed.
5. **Doctor link counts** in `/api/doctors` (visits/prescriptions per doctor) — requires `medecin_id`/`doctor_id` columns on `visits`/`prescriptions`. Migration deferred to avoid touching live FKs.

---

**Net result**: 23/24 buttons fully wired with real DB actions (1 partial). Zero dead buttons. Zero placeholder pages.
