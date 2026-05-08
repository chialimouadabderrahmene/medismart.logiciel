import React, { useEffect, useMemo, useRef, useState } from "react";
import anime from "animejs/lib/anime.es.js";
import {
  Activity,
  AlertTriangle,
  Archive,
  Bell,
  Bot,
  CalendarDays,
  ClipboardList,
  DatabaseBackup,
  Eye,
  FileImage,
  FileText,
  FlaskConical,
  Heart,
  Keyboard,
  LayoutDashboard,
  LogIn,
  LogOut,
  Mic,
  Pill,
  Plus,
  QrCode,
  Save,
  Scan,
  Search,
  Settings,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Upload,
  UserRound,
  Users,
  WalletCards,
  Wifi,
  WifiOff,
  Globe,
  Link,
  CheckCircle,
  XCircle,
  Smartphone,
  Scale,
  FileCheck,
  BookOpen,
  ClipboardPlus,
  Copy,
  Download,
  X,
  DollarSign,
  TrendingUp,
  Clock,
  Filter,
  CreditCard,
  Receipt,
  ChevronRight,
  ChevronLeft,
  Calendar,
  BarChart3,
  Phone,
  Pencil,
  RefreshCw,
  Sparkles,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Printer
} from "lucide-react";
import { api, apiBase } from "./api.js";
import ImportWizardPanel from "./ImportWizardPanel.jsx";
import SetupWizardPanel from "./SetupWizardPanel.jsx";
import SpecialityFieldsPanel from "./SpecialityFieldsPanel.jsx";
import { getSpecialityConfig, buildTabList, SPECIALITY_LIST } from "./specialities/index.js";
import { cloudAi, getCloudConfig, saveCloudConfig, isCloudConfigured } from "./cloudAi.js";

const blankPatient = {
  code: "",
  nom: "",
  prenom: "",
  date_naissance: "",
  age: "",
  sexe: "Feminin",
  groupe_sanguin: "",
  situation_familiale: "",
  adresse: "",
  telephone: "",
  profession: "",
  oriente_par: "",
  allergies: "",
  maladies: "",
  notes_importantes: ""
};

const blankVisit = {
  date_visite: new Date().toISOString().slice(0, 16),
  motif: "",
  histoire: "",
  examens: "",
  diagnostics: "",
  traitements: "",
  tension: "",
  frequence_cardiaque: "",
  glycemie: "",
  poids: "",
  taille: "",
  visit_fee: 0,
  fee_paid: 0,
  payment_status: "pending",
  visit_type: ""
};

const blankAppointment = {
  title: "Consultation cardiologie",
  scheduled_at: new Date().toISOString().slice(0, 16),
  status: "normal",
  reminder_channel: "whatsapp",
  reminder_note: "",
  notes: ""
};

const aiSafetyWarning = "Analyse IA أ  vأ©rifier par le mأ©decin.";
const AI_DECISION_SUPPORT_WARNING = "Analyse IA أ  vأ©rifier par le mأ©decin";

const OR_DEFAULT_MODEL_NAME = "qwen/qwen-2.5-7b-instruct";

const medicalTabs = [
  { id: "profile", label: "Profil Cardio", icon: ShieldCheck },
  { id: "vitals", label: "Constantes", icon: Activity },
  { id: "bmi", label: "IMC / Tour taille", icon: Scale },
  { id: "ecg", label: "ECG", icon: FileImage },
  { id: "scores", label: "Scores", icon: AlertTriangle },
  { id: "imaging", label: "Imagerie / Labs", icon: Stethoscope },
  { id: "diagnosis", label: "Diagnostic / Traitement", icon: Pill },
  { id: "followup", label: "Suivi", icon: CalendarDays },
  { id: "docs", label: "Documents", icon: FileImage },
  { id: "templates", label: "Modeles", icon: FileCheck },
  { id: "medicines", label: "Base Medicaments", icon: BookOpen },
  { id: "ai", label: "AI Mأ©dical", icon: Bot },
  { id: "settings", label: "Parametres", icon: Settings }
];

const sidebarSections = [
  {
    label: "Gأ©nأ©ral",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { id: "patients", label: "Annuaire Patients", icon: Users },
      { id: "appointments-page", label: "Planning & RDV", icon: CalendarDays },
    ],
  },
  {
    label: "Outils",
    items: [
      { id: "medicines-nav", label: "Mأ©dicaments", icon: BookOpen },
      { id: "ai-credits", label: "AI & Crأ©dits", icon: Bot },
    ],
  },
  {
    label: "Administration",
    items: [
      { id: "finance-page", label: "Gestion Finance", icon: DollarSign },
      { id: "import-legacy", label: "Import ancienne base", icon: Upload },
      { id: "settings-nav", label: "Paramأ¨tres", icon: Settings },
    ],
  },
];


function fieldValue(value) {
  return value ?? "";
}

function fullname(patient) {
  return [patient?.nom, patient?.prenom].filter(Boolean).join(" ") || "Nouveau patient";
}

function displayValue(value, fallback = "Non renseigne") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function patientInitials(patient) {
  const first = String(patient?.nom || patient?.prenom || "?").trim().slice(0, 1);
  const second = String(patient?.prenom || "").trim().slice(0, 1);
  return `${first}${second}`.toUpperCase();
}

function calculateAgeFromBirthDate(value) {
  const text = String(value || "").slice(0, 10);
  if (!text) return "";
  const birth = new Date(`${text}T00:00:00`);
  if (Number.isNaN(birth.getTime())) return "";
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const beforeBirthday =
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age >= 0 && age <= 130 ? String(age) : "";
}

function isMalePatient(patient) {
  return String(patient?.sexe || "").trim().toLowerCase().startsWith("masc");
}

function patientGenderClass(patient) {
  return isMalePatient(patient) ? "is-male" : "is-female";
}

function GenderIcon({ patient, size = 20 }) {
  return (
    <span className="gender-symbol" style={{ fontSize: size }} aria-hidden="true">
      {isMalePatient(patient) ? "â™‚" : "â™€"}
    </span>
  );
}

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function patientSearchHaystack(patient) {
  const nom = patient?.nom || "";
  const prenom = patient?.prenom || "";
  return normalizeSearchText([
    nom,
    prenom,
    `${nom} ${prenom}`,
    `${prenom} ${nom}`,
    patient?.code,
    patient?.telephone,
    patient?.adresse,
    patient?.profession,
    patient?.age,
  ].filter(Boolean).join(" "));
}

function patientMatchesSearch(patient, query) {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean);
  if (!terms.length) return true;
  const haystack = patientSearchHaystack(patient);
  const phoneDigits = String(patient?.telephone || "").replace(/\D/g, "");
  return terms.every((term) => {
    const digitTerm = term.replace(/\D/g, "");
    return haystack.includes(term) || (digitTerm.length > 0 && phoneDigits.includes(digitTerm));
  });
}

function isSettingEnabled(value) {
  return ["1", "true", "yes", "oui", "on"].includes(String(value || "").toLowerCase());
}

function cloudAiUsable(subscription) {
  if (!subscription) return isCloudConfigured();
  if (!subscription.active || !subscription.ai_enabled) return false;
  if (subscription.has_ai_key === false) return false;
  return Boolean(subscription.unlimited || Number(subscription.remaining_credits || 0) > 0);
}

async function syncCloudSettingsToBackend() {
  const cfg = getCloudConfig();
  if (!cfg.url || !cfg.doctor_id || !cfg.secret) return false;
  await api.updateSetting("CLOUD_AI_URL", cfg.url.trim());
  await api.updateSetting("CLOUD_AI_DOCTOR_ID", cfg.doctor_id.trim());
  await api.updateSetting("CLOUD_AI_SECRET", cfg.secret.trim());
  return true;
}

function getAnalysisPayload(analysis) {
  if (!analysis) return {};
  const validated = analysis.validated_extracted_json;
  if (validated && typeof validated === "object" && Object.keys(validated).length) return validated;
  const extracted = analysis.extracted_json;
  return extracted && typeof extracted === "object" ? extracted : {};
}

function getAnalysisValues(analysis) {
  const fromRows = (analysis?.lab_values || []).map((item) => ({
    id: item.id,
    analyte: item.analyte || "",
    value: item.value || "",
    unit: item.unit || "",
    reference_range: item.reference_range || "",
    abnormal_flag: item.abnormal_flag || ""
  }));
  if (fromRows.length) return fromRows;
  return (getAnalysisPayload(analysis).extracted_values || []).map((item) => ({
    id: item.id,
    analyte: item.analyte || "",
    value: item.value || "",
    unit: item.unit || "",
    reference_range: item.reference_range || "",
    abnormal_flag: item.abnormal_flag || ""
  }));
}

function riskLevelClass(level) {
  const normalized = String(level || "").toLowerCase().replace("أ©", "e");
  if (normalized.includes("eleve") || normalized.includes("high")) return "ai-risk--high";
  if (normalized.includes("moyen") || normalized.includes("medium")) return "ai-risk--medium";
  return "ai-risk--low";
}

function Field({ label, value, onChange, type = "text", wide = false, inputRef }) {
  return (
    <label className={wide ? "field field--wide" : "field"}>
      <span>{label}</span>
      <input ref={inputRef} type={type} value={fieldValue(value)} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SelectField({ label, value, onChange, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={fieldValue(value)} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </label>
  );
}

function CheckField({ label, checked, onChange }) {
  return (
    <label className="check-field">
      <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function TextArea({ label, value, onChange, compact = false, readOnly = false }) {
  return (
    <label className={compact ? "textbox textbox--compact" : "textbox"}>
      <span>{label}</span>
      <textarea readOnly={readOnly} value={fieldValue(value)} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function LoginGate({ onLogin }) {
  const [form, setForm] = useState({ username: "admin", password: "admin123" });
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    try {
      const result = await api.login(form);
      onLogin(result.user);
    } catch (loginError) {
      setError(loginError.message);
    }
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <img className="login-logo-img" src="/medismart-logo.png" alt="MediSmart" />
        <h1>MediSmart</h1>
        <p>Connexion locale securisee</p>
        <Field label="Utilisateur" value={form.username} onChange={(value) => setForm({ ...form, username: value })} />
        <Field label="Mot de passe" type="password" value={form.password} onChange={(value) => setForm({ ...form, password: value })} />
        {error && <div className="soft-error">{error}</div>}
        <button className="btn btn--primary" type="submit"><LogIn size={16} /> Ouvrir le logiciel</button>
      </form>
    </main>
  );
}

function PatientList({ patients, selectedId, onSelect }) {
  if (patients.length === 0) {
    return (
      <div className="empty-state">
        <Users size={32} />
        <strong>Aucun patient</strong>
        <span>Commencez par ajouter un patient.</span>
      </div>
    );
  }
  return (
    <div className="patient-list">
      {patients.map((patient) => {
        const isActive = patient.id === selectedId;
        return (
          <button
            key={patient.id}
            className={`patient-row ${isActive ? "is-active" : ""}`}
            onClick={() => onSelect(patient.id)}
          >
            <div className={`patient-row-avatar ${patientGenderClass(patient)}`}>
              <GenderIcon patient={patient} size={18} />
            </div>
            <div className="patient-row-info">
              <strong>{patient.nom} {patient.prenom}</strong>
              <span>{patient.code || patient.id} â€¢ {patient.age || "?"} ans</span>
            </div>
            {isActive && <ChevronRight size={14} className="patient-row-arrow" />}
          </button>
        );
      })}
    </div>
  );
}

function NewPatientWorkspace({ form, setForm, onSave, onReset, onCancel, saving, duplicateMatches, patientConflict, onOpenExisting }) {
  const displayName = fullname(form);
  const duplicate = patientConflict || duplicateMatches?.[0];

  return (
    <section className="patient-dossier patient-dossier--create">
      <div className="dossier-back-bar">
        <button className="btn btn--secondary" onClick={onCancel}>
          <ChevronLeft size={18} /> Retour a l'annuaire
        </button>
        <div className="dossier-patient-mini">
          <span className={`dossier-avatar ${patientGenderClass(form)}`}>
            <GenderIcon patient={form} size={18} />
          </span>
          <span className="dossier-name">Creation d'un nouveau dossier patient</span>
        </div>
      </div>

      <section className="patient-create-hero">
        <div className="patient-create-hero__content">
          <span className="hero-id">Nouveau dossier</span>
          <h1>{displayName}</h1>
          <p>Renseignez l'identite du patient, puis enregistrez le dossier en local sans perdre les donnees existantes.</p>
        </div>
        <div className="patient-create-hero__actions">
          <button className="btn btn--secondary" onClick={onReset}>
            <RefreshCw size={16} /> Reinitialiser
          </button>
          <button className="btn btn--primary" onClick={onSave} disabled={saving}>
            <Save size={16} /> Enregistrer le patient
          </button>
        </div>
      </section>

      {duplicate && (
        <section className="soft-warning patient-warning-card">
          <div>
            <strong>Un dossier similaire existe deja.</strong>
            <p>{patientConflict?.message || `${duplicate.nom} ${duplicate.prenom} est deja visible dans la base.`}</p>
          </div>
          {duplicate.id || patientConflict?.existing_patient_id ? (
            <button className="btn btn--secondary" onClick={() => onOpenExisting(patientConflict?.existing_patient_id || duplicate.id)}>
              <Users size={16} /> Ouvrir le dossier existant
            </button>
          ) : null}
        </section>
      )}

      <div className="patient-create-grid">
        <div className="dossier-main">
          <CivilPanelCard
            form={form}
            setForm={setForm}
            selected={null}
            saving={saving}
            onNew={onReset}
            onSave={onSave}
            onDelete={() => {}}
          />
        </div>
        <aside className="dossier-side">
          <section className="tool-card">
            <h3><ShieldCheck size={16} /> Verification rapide</h3>
            <div className="patient-create-checklist">
              <div className={form.nom ? "is-complete" : ""}>Nom renseigne</div>
              <div className={form.prenom ? "is-complete" : ""}>Prenom renseigne</div>
              <div className={form.telephone ? "is-complete" : ""}>Telephone ou contact</div>
              <div className={form.date_naissance || form.age ? "is-complete" : ""}>Age ou date de naissance</div>
            </div>
          </section>
          <section className="tool-card">
            <h3><AlertTriangle size={16} /> Doublons</h3>
            {duplicateMatches?.length ? (
              <div className="patient-create-duplicates">
                {duplicateMatches.slice(0, 4).map((item) => (
                  <button key={item.id} className="patient-create-duplicate" onClick={() => onOpenExisting(item.id)}>
                    <strong>{item.nom} {item.prenom}</strong>
                    <span>{item.code || `ID ${item.id}`} {item.age ? `- ${item.age} ans` : ""}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="empty-note">Aucun doublon detecte parmi les dossiers charges.</p>
            )}
          </section>
        </aside>
      </div>
    </section>
  );
}



function DashboardPage({ dashboard, onNav }) {
  const counts = dashboard?.counts || {};
  const stats = dashboard?.cardio_stats || {};
  const appointments = dashboard?.appointments_today || [];
  const alerts = dashboard?.alerts || [];

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon aprأ¨s-midi" : "Bonsoir";
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const cardioStats = [
    { label: "HTA", value: stats.hta || 0 },
    { label: "Diabأ¨te", value: stats.diabete || 0 },
    { label: "Coronaro.", value: stats.cad || 0 },
    { label: "Insuf. Card.", value: stats.hf || 0 },
  ];
  const maxBar = Math.max(...cardioStats.map((b) => b.value), 1);

  const statsData = [
    { icon: Users, label: "Total Patients", value: counts.patients || 0, tone: "blue" },
    { icon: Stethoscope, label: "Consultations", value: counts.visits || 0, tone: "teal" },
    { icon: Pill, label: "Ordonnances", value: counts.prescriptions || 0, tone: "sky" },
    { icon: Calendar, label: "Rendez-vous", value: counts.appointments || 0, tone: "indigo" },
  ];

  return (
    <div className="dash-pro-layout">
      {/* Hero */}
      <header className="dash-pro-hero">
        <div className="dash-pro-hero__main">
          <h1>{greeting}, Dr.</h1>
          <p>{dateStr} â€” Voici le rأ©sumأ© de votre activitأ©.</p>
        </div>
        <div className="dash-pro-hero__stats">
          <div className="dash-pro-hero__stat">
            <strong>{counts.patients || 0}</strong>
            <span>Patients</span>
          </div>
          <div className="dash-pro-hero__stat">
            <strong>{counts.appointments || 0}</strong>
            <span>RDV</span>
          </div>
        </div>
      </header>

      {/* Stat Cards */}
      <div className="dash-pro-stats">
        {statsData.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="dash-pro-stat-card">
              <div className={`dash-pro-stat-card__icon is-${s.tone}`}>
                <Icon size={22} />
              </div>
              <div className="dash-pro-stat-card__value">{s.value}</div>
              <div className="dash-pro-stat-card__label">{s.label}</div>
            </div>
          );
        })}
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="dash-pro-alerts">
          {alerts.map((a, i) => {
            const level = a.level || "warning";
            const labels = { danger: "Danger", warning: "Attention", info: "Info", success: "OK" };
            const Icon = level === "danger" ? AlertTriangle : level === "info" ? Activity : AlertTriangle;
            return (
              <div key={i} className={`dash-pro-alert is-${level}`}>
                <Icon size={13} />
                <span className="dash-pro-alert__label">{labels[level] || "Alerte"}</span>
                <span className="dash-pro-alert__sep">â€”</span>
                <span>{a.message}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Grid */}
      <div className="dash-pro-grid">
        {/* Appointments */}
        <section className="dash-pro-card">
          <div className="dash-pro-card__header">
            <div className="dash-pro-card__title">
              <CalendarDays size={16} />
              <span>RDV d'aujourd'hui</span>
              <span className="dash-pro-badge">{appointments.length}</span>
            </div>
            <button className="dash-pro-link" onClick={() => onNav("appointments-page")}>Tout voir</button>
          </div>
          <div className="dash-pro-card__body">
            {appointments.length === 0 ? (
              <div className="dash-pro-empty">
                <Calendar size={28} />
                <span>Aucun rendez-vous aujourd'hui</span>
                <button className="dash-pro-pill-btn" onClick={() => onNav("appointments-page")}>
                  <Plus size={13} /> Planifier un RDV
                </button>
              </div>
            ) : (
              <div className="dash-pro-appointments">
                {appointments.slice(0, 6).map((item) => (
                  <div key={item.id} className="dash-pro-appt">
                    <div className={`dash-pro-appt__time ${item.status === "urgent" ? "is-urgent" : ""}`}>
                      {String(item.scheduled_at || "").slice(11, 16)}
                    </div>
                    <div className="dash-pro-appt__info">
                      <strong>{fullname(item)}</strong>
                      <span>{item.motif || "Consultation standard"}</span>
                    </div>
                    <div className={`dash-pro-appt__tag ${item.status === "urgent" ? "is-urgent" : ""}`}>
                      {item.status === "urgent" ? "Urgent" : "Planifie"}
                    </div>
                  </div>
                ))}
                {appointments.length > 6 && (
                  <button className="dash-pro-see-more" onClick={() => onNav("appointments-page")}>
                    Voir les {appointments.length - 6} autres rendez-vous
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Cardio Stats */}
        <section className="dash-pro-card">
          <div className="dash-pro-card__header">
            <div className="dash-pro-card__title">
              <Activity size={16} />
              <span>Pathologies Cardio</span>
              <span className="dash-pro-badge">{cardioStats.reduce((a, s) => a + s.value, 0)}</span>
            </div>
          </div>
          <div className="dash-pro-card__body">
            <div className="dash-pro-bars">
              {cardioStats.map((stat) => (
                <div key={stat.label} className="dash-pro-bar-row">
                  <div className="dash-pro-bar-row__label">{stat.label}</div>
                  <div className="dash-pro-bar-row__track">
                    <div
                      className="dash-pro-bar-row__fill"
                      style={{ width: `${(stat.value / maxBar) * 100}%` }}
                    />
                  </div>
                  <div className="dash-pro-bar-row__value">
                    {stat.value}
                    <small>{maxBar > 0 ? Math.round((stat.value / maxBar) * 100) + "%" : "0%"}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Quick Actions */}
      <div className="dash-pro-quick">
        <button className="dash-pro-quick__btn" onClick={() => onNav("patients")}>
          <span className="dash-pro-quick__icon is-blue"><Plus size={16} /></span>
          <span>Nouveau Patient</span>
        </button>
        <button className="dash-pro-quick__btn" onClick={() => onNav("ai-nav")}>
          <span className="dash-pro-quick__icon is-purple"><Bot size={16} /></span>
          <span>Assistant IA</span>
        </button>
        <button className="dash-pro-quick__btn" onClick={() => onNav("appointments-page")}>
          <span className="dash-pro-quick__icon is-teal"><CalendarDays size={16} /></span>
          <span>Nouveau RDV</span>
        </button>
        <button className="dash-pro-quick__btn" onClick={() => onNav("rx-workflow")}>
          <span className="dash-pro-quick__icon is-indigo"><ClipboardPlus size={16} /></span>
          <span>Ordonnance</span>
        </button>
      </div>
    </div>
  );
}



function DashboardMetricV2({ icon: Icon, label, value, detail, tone }) {
  return (
    <div className={`dash-v2-metric is-${tone || "blue"}`}>
      <span className="dash-v2-metric__icon"><Icon size={18} /></span>
      <span className="dash-v2-metric__label">{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}

function DashboardEmptyV2({ icon: Icon, title, action, onAction }) {
  return (
    <div className="dash-v2-empty">
      <Icon size={24} />
      <span>{title}</span>
      {action && (
        <button className="dash-v2-text-btn" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}

function DashboardPageV2({ dashboard, onNav }) {
  const counts = dashboard?.counts || {};
  const stats = dashboard?.cardio_stats || {};
  const appointments = dashboard?.appointments_today || [];
  const alerts = dashboard?.alerts || [];
  const latest = dashboard?.latest || [];
  const toNumber = (value) => Number(value || 0);

  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const kpis = [
    { icon: Users, label: "Patients", value: toNumber(counts.patients), detail: "Dossiers", tone: "blue" },
    { icon: Stethoscope, label: "Consultations", value: toNumber(counts.visits), detail: "Visites saisies", tone: "teal" },
    { icon: CalendarDays, label: "RDV", value: toNumber(counts.appointments), detail: `${appointments.length} aujourd'hui`, tone: "indigo" },
    { icon: FileText, label: "Documents", value: toNumber(counts.documents), detail: "Pieces patients", tone: "sky" },
    { icon: FlaskConical, label: "Labos", value: toNumber(counts.labs), detail: "Bilans", tone: "amber" },
    { icon: Pill, label: "Ordonnances", value: toNumber(counts.prescriptions), detail: "Prescriptions", tone: "rose" },
  ];

  const cardioStats = [
    { label: "HTA", value: toNumber(stats.hta), detail: "Hypertension" },
    { label: "Diabete", value: toNumber(stats.diabete), detail: "Profil cardio" },
    { label: "Coronarien", value: toNumber(stats.cad), detail: "Diagnostics" },
    { label: "Insuf. card.", value: toNumber(stats.hf), detail: "Diagnostics" },
    { label: "ACFA / rythme", value: toNumber(stats.acfa), detail: "Dossiers" },
    { label: "ECG anormal", value: toNumber(stats.abnormal_ecg), detail: "A revoir" },
    { label: "Haut risque", value: toNumber(stats.high_risk), detail: "Antecedents" },
    { label: "Urgences jour", value: toNumber(stats.urgent_today), detail: "Planning" },
  ];
  const maxBar = Math.max(...cardioStats.map((item) => item.value), 1);
  const cardioTotal = cardioStats.reduce((sum, item) => sum + item.value, 0);

  const attentionItems = alerts.map((item) => {
    const message = item.notes_importantes || item.allergies || item.maladies || "Alerte dossier patient";
    const level = item.notes_importantes ? "danger" : "warning";
    return {
      ...item,
      level,
      title: fullname(item),
      message,
      meta: item.code || `ID ${item.id}`,
    };
  });

  const quickActions = [
    { icon: Plus, label: "Nouveau patient", target: "patients", tone: "blue" },
    { icon: CalendarDays, label: "Planning RDV", target: "appointments-page", tone: "teal" },
    { icon: BookOpen, label: "Medicaments", target: "medicines-nav", tone: "indigo" },
    { icon: DollarSign, label: "Finance", target: "finance-page", tone: "amber" },
  ];

  return (
    <div className="dash-v2-layout">
      <header className="dash-v2-header">
        <div>
          <span className="dash-v2-eyebrow">Tableau de bord</span>
          <h1>Cabinet cardio</h1>
          <p>{dateStr}</p>
        </div>
        <div className="dash-v2-header__actions">
          <button onClick={() => onNav("patients")}><Users size={16} /> Patients</button>
          <button onClick={() => onNav("appointments-page")}><CalendarDays size={16} /> Planning</button>
        </div>
      </header>

      <section className="dash-v2-metrics" aria-label="Indicateurs du cabinet">
        {kpis.map((metric) => (
          <DashboardMetricV2 key={metric.label} {...metric} />
        ))}
      </section>

      <div className="dash-v2-grid">
        <section className="dash-v2-panel dash-v2-panel--agenda">
          <div className="dash-v2-panel__header">
            <div>
              <span className="dash-v2-panel__kicker">Aujourd'hui</span>
              <h2>Agenda clinique</h2>
            </div>
            <button className="dash-v2-text-btn" onClick={() => onNav("appointments-page")}>Tout voir</button>
          </div>
          {appointments.length === 0 ? (
            <DashboardEmptyV2
              icon={Calendar}
              title="Aucun rendez-vous aujourd'hui"
              action="Planifier"
              onAction={() => onNav("appointments-page")}
            />
          ) : (
            <div className="dash-v2-list">
              {appointments.slice(0, 7).map((item) => {
                const urgent = item.status === "urgent";
                return (
                  <article key={item.id} className={`dash-v2-appointment ${urgent ? "is-urgent" : ""}`}>
                    <time>{String(item.scheduled_at || "").slice(11, 16) || "--:--"}</time>
                    <div>
                      <strong>{fullname(item)}</strong>
                      <span>{item.motif || item.title || "Consultation standard"}</span>
                    </div>
                    <em>{urgent ? "Urgent" : "Planifie"}</em>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="dash-v2-panel dash-v2-panel--alerts">
          <div className="dash-v2-panel__header">
            <div>
              <span className="dash-v2-panel__kicker">Priorite</span>
              <h2>Patients a surveiller</h2>
            </div>
            <span className="dash-v2-count">{attentionItems.length}</span>
          </div>
          {attentionItems.length === 0 ? (
            <DashboardEmptyV2 icon={ShieldCheck} title="Aucune alerte active" />
          ) : (
            <div className="dash-v2-alert-list">
              {attentionItems.slice(0, 6).map((item) => (
                <article key={item.id} className={`dash-v2-alert is-${item.level}`}>
                  <span><AlertTriangle size={16} /></span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.message}</p>
                    <small>{item.meta}</small>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="dash-v2-panel dash-v2-panel--wide">
          <div className="dash-v2-panel__header">
            <div>
              <span className="dash-v2-panel__kicker">Cardiologie</span>
              <h2>Charge clinique</h2>
            </div>
            <span className="dash-v2-count">{cardioTotal}</span>
          </div>
          <div className="dash-v2-cardio-grid">
            {cardioStats.map((item) => (
              <div key={item.label} className="dash-v2-cardio-row">
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </div>
                <div className="dash-v2-track" aria-hidden="true">
                  <span style={{ width: `${(item.value / maxBar) * 100}%` }} />
                </div>
                <b>{item.value}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="dash-v2-panel">
          <div className="dash-v2-panel__header">
            <div>
              <span className="dash-v2-panel__kicker">Suivi</span>
              <h2>Consultations recentes</h2>
            </div>
            <button className="dash-v2-text-btn" onClick={() => onNav("patients")}>Patients</button>
          </div>
          {latest.length === 0 ? (
            <DashboardEmptyV2 icon={ClipboardList} title="Aucune consultation saisie" />
          ) : (
            <div className="dash-v2-list">
              {latest.slice(0, 6).map((item) => (
                <article key={item.id} className="dash-v2-visit">
                  <span><Clock size={15} /></span>
                  <div>
                    <strong>{fullname(item)}</strong>
                    <small>{String(item.date_visite || "").replace("T", " ").slice(0, 16) || "Date non renseignee"}</small>
                    <p>{item.motif || item.diagnostics || "Consultation"}</p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="dash-v2-actions" aria-label="Actions rapides">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button key={action.label} className={`dash-v2-action is-${action.tone}`} onClick={() => onNav(action.target)}>
              <span><Icon size={17} /></span>
              <strong>{action.label}</strong>
              <ChevronRight size={16} />
            </button>
          );
        })}
      </section>
    </div>
  );
}



// =====================================================================
// APPOINTMENTS PAGE (today / week / month / custom)
// =====================================================================
function AppointmentsPage({ patients, onSaveAppointment }) {
  const [period, setPeriod] = useState("today");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [urgent, setUrgent] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...blankAppointment });

  async function loadAppointments() {
    setLoading(true);
    try {
      const params = { period };
      if (period === "custom") { params.date_from = dateFrom; params.date_to = dateTo; }
      const data = await api.appointmentsFiltered(params);
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setUrgent(data.urgent || 0);
    } catch (e) { /* */ }
    setLoading(false);
  }

  useEffect(() => { loadAppointments(); }, [period, dateFrom, dateTo]);

  async function handleSave() {
    if (!form.patient_id) return;
    await onSaveAppointment(form);
    setShowForm(false);
    setForm({ ...blankAppointment });
    loadAppointments();
  }

  return (
    <div className="appointments-container">
      <header className="page-header">
        <div className="page-title">
          <h1>Gestion des Rendez-vous</h1>
          <p>Planifiez et suivez vos consultations ({total})</p>
        </div>
        <div className="page-actions">
          <button className="btn btn--primary" onClick={() => setShowForm(!showForm)}>
            <Plus size={18} /> Nouveau RDV
          </button>
        </div>
      </header>

      <div className="filter-bar">
        <div className="filter-chips">
          {["today", "week", "month", "custom"].map((p) => (
            <button 
              key={p} 
              className={`filter-chip ${period === p ? "is-active" : ""}`}
              onClick={() => setPeriod(p)}
            >
              {p === "today" ? "Aujourd'hui" : p === "week" ? "Cette Semaine" : p === "month" ? "Ce Mois" : "Personnalisأ©"}
            </button>
          ))}
        </div>
        
        {period === "custom" && (
          <div className="date-inputs">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            <span>au</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        )}
      </div>

      <div className="dash-pro-stats" style={{ gridTemplateColumns: "repeat(2, 1fr)", maxWidth: "520px" }}>
        <div className="dash-pro-stat-card">
          <div className="dash-pro-stat-card__icon is-blue">
            <CalendarDays size={22} />
          </div>
          <div className="dash-pro-stat-card__value">{total}</div>
          <div className="dash-pro-stat-card__label">Total RDV</div>
        </div>
        <div className="dash-pro-stat-card">
          <div className="dash-pro-stat-card__icon is-indigo">
            <AlertTriangle size={22} />
          </div>
          <div className="dash-pro-stat-card__value">{urgent}</div>
          <div className="dash-pro-stat-card__label">Cas Urgents</div>
        </div>
      </div>

      {showForm && (
        <div className="blue-panel" style={{ padding: '24px', marginBottom: '24px' }}>
          <h3 style={{ marginBottom: '20px' }}>Planifier un nouveau rendez-vous</h3>
          <div className="field-grid">
            <SelectField label="Patient" value={form.patient_id || ""} onChange={(v) => setForm({ ...form, patient_id: Number(v) })}>
              <option value="">-- Choisir un patient --</option>
              {(patients || []).map((p) => <option key={p.id} value={p.id}>{fullname(p)}</option>)}
            </SelectField>
            <Field label="Titre / Motif" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
            <Field label="Date & Heure" type="datetime-local" value={String(form.scheduled_at || "").replace(" ", "T").slice(0, 16)} onChange={(v) => setForm({ ...form, scheduled_at: v })} />
            <SelectField label="Prioritأ©" value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </SelectField>
          </div>
          <TextArea label="Notes complأ©mentaires" value={form.notes || ""} onChange={(v) => setForm({ ...form, notes: v })} />
          <div className="panel-actions" style={{ marginTop: '20px' }}>
            <button className="btn btn--secondary" onClick={() => setShowForm(false)}>Annuler</button>
            <button className="btn btn--primary" onClick={handleSave}><Save size={18} /> Confirmer le RDV</button>
          </div>
        </div>
      )}

      <div className="blue-panel">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Heure</th>
                <th>Patient</th>
                <th>Motif</th>
                <th>Statut</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><strong>{String(r.scheduled_at || "").replace("T", " ").slice(0, 16)}</strong></td>
                  <td>{r.nom ? `${r.nom} ${r.prenom || ""}` : "-"}</td>
                  <td>{r.title}</td>
                  <td>
                    <span className={`badge ${r.status === "urgent" ? "badge--danger" : r.status === "done" ? "badge--success" : "badge--info"}`}>
                      {r.status === "urgent" ? "Urgent" : r.status === "done" ? "Terminأ©" : "Planifiأ©"}
                    </span>
                  </td>
                  <td>
                    <button className="btn-icon" title="Dأ©tails"><Eye size={16} /></button>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="empty-state">
                      <CalendarDays size={48} />
                      <p>Aucun rendez-vous trouvأ© pour cette pأ©riode.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



// =====================================================================
// FINANCE PAGE
// =====================================================================
function FinancePage() {
  const [period, setPeriod] = useState("month");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  async function loadFinance() {
    setLoading(true);
    try {
      const params = {};
      if (period === "custom") { params.date_from = dateFrom; params.date_to = dateTo; }
      else { params.period = period; }
      const result = await api.financeSummary(params);
      setData(result);
    } catch (e) { /* */ }
    setLoading(false);
  }

  useEffect(() => { loadFinance(); }, [period, dateFrom, dateTo]);

  const summary = data?.summary || {};
  const byType = data?.by_type || [];
  const daily = data?.daily || [];
  const topPatients = data?.top_patients || [];
  const maxDaily = Math.max(...daily.map((d) => d.fees || 0), 1);

  function fmtDA(n) { return Number(n || 0).toLocaleString("fr-DZ") + " DA"; }

  const periodLabels = { today: "Aujourd'hui", week: "Cette Semaine", month: "Ce Mois", year: "Cette Annee", custom: "Personnalise" };

  return (
    <div className="finance-container">
      <header className="page-header">
        <div className="page-title">
          <h1><DollarSign size={24} style={{ color: "var(--success)", verticalAlign: "-4px" }} /> Finance & Revenus</h1>
          <p>Suivi des honoraires, paiements et impayes</p>
        </div>
        <div className="filter-bar" style={{ marginBottom: 0 }}>
          <div className="filter-chips">
            {["today", "week", "month", "year", "custom"].map((p) => (
              <button key={p} className={`filter-chip ${period === p ? "is-active" : ""}`} onClick={() => setPeriod(p)}>
                {periodLabels[p]}
              </button>
            ))}
          </div>
          {period === "custom" && (
            <div className="date-inputs">
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span>au</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          )}
        </div>
      </header>

      {loading && <div className="empty-state empty-state--compact"><p>Chargement des donnees financieres...</p></div>}

      <div className="finance-kpi-grid">
        <div className="finance-kpi">
          <div className="finance-kpi-icon" style={{ background: "linear-gradient(135deg, #10b981, #059669)" }}><Receipt size={22} /></div>
          <div>
            <div className="finance-kpi-label">Total Honoraires</div>
            <div className="finance-kpi-value">{fmtDA(summary.total_fees)}</div>
          </div>
        </div>
        <div className="finance-kpi">
          <div className="finance-kpi-icon" style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}><CreditCard size={22} /></div>
          <div>
            <div className="finance-kpi-label">Total Paye</div>
            <div className="finance-kpi-value" style={{ color: "var(--primary)" }}>{fmtDA(summary.total_paid)}</div>
          </div>
        </div>
        <div className="finance-kpi">
          <div className="finance-kpi-icon" style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}><Clock size={22} /></div>
          <div>
            <div className="finance-kpi-label">Impaye</div>
            <div className="finance-kpi-value" style={{ color: "var(--warning)" }}>{fmtDA(summary.total_unpaid)}</div>
          </div>
        </div>
        <div className="finance-kpi">
          <div className="finance-kpi-icon" style={{ background: "linear-gradient(135deg, #8b5cf6, #7c3aed)" }}><Stethoscope size={22} /></div>
          <div>
            <div className="finance-kpi-label">Visites</div>
            <div className="finance-kpi-value">{summary.total_visits || 0}</div>
          </div>
        </div>
      </div>

      <div className="finance-grid">
        <div className="finance-card">
          <div className="finance-card-header"><BarChart3 size={20} /> Revenus par Jour</div>
          <div className="finance-card-content">
            {daily.length === 0 && <div className="empty-state empty-state--compact"><p>Aucune donnee pour cette periode</p></div>}
            {daily.map((d) => (
              <div key={d.day} className="daily-revenue-row">
                <span className="daily-revenue-day">{d.day}</span>
                <div className="daily-revenue-bar">
                  <div className="daily-revenue-fill" style={{ width: `${(d.fees / maxDaily) * 100}%` }} />
                </div>
                <span className="daily-revenue-value">{fmtDA(d.fees)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="finance-card">
          <div className="finance-card-header"><Filter size={20} /> Par Type de Visite</div>
          <div className="finance-card-content">
            {byType.length === 0 && <div className="empty-state empty-state--compact"><p>Aucune donnee</p></div>}
            {byType.length > 0 && (
              <div className="table-responsive">
                <table className="data-table">
                  <thead><tr><th>Type</th><th>Nb</th><th>Total</th><th>Paye</th></tr></thead>
                  <tbody>
                    {byType.map((t, i) => (
                      <tr key={i}>
                        <td><strong>{t.visit_type}</strong></td>
                        <td>{t.count}</td>
                        <td style={{ fontWeight: 700 }}>{fmtDA(t.total_fees)}</td>
                        <td style={{ color: "var(--success)", fontWeight: 600 }}>{fmtDA(t.total_paid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="finance-card">
        <div className="finance-card-header"><Users size={20} /> Top Patients par Revenus</div>
        <div className="finance-card-content">
          {topPatients.length === 0 && <div className="empty-state empty-state--compact"><p>Aucune donnee</p></div>}
          {topPatients.length > 0 && (
            <div className="table-responsive">
              <table className="data-table">
                <thead><tr><th>Patient</th><th>Code</th><th>Visites</th><th>Total</th><th>Paye</th><th>Solde</th></tr></thead>
                <tbody>
                  {topPatients.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.nom} {p.prenom}</td>
                      <td>{p.code || "-"}</td>
                      <td>{p.visit_count}</td>
                      <td style={{ fontWeight: 700 }}>{fmtDA(p.total_fees)}</td>
                      <td style={{ color: "var(--success)", fontWeight: 600 }}>{fmtDA(p.total_paid)}</td>
                      <td style={{ color: p.balance > 0 ? "var(--warning)" : "var(--success)", fontWeight: 700 }}>{fmtDA(p.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PatientHeaderCard({ patient, onTab, onRiskScan }) {
  if (!patient?.id) {
    return (
      <section className="patient-hero patient-hero--empty">
        <div className="hero-content">
          <span className="hero-eyebrow">Dossier Patient</span>
          <h2>Selectionnez un patient pour consulter son dossier</h2>
          <p>L'historique clinique et les constantes apparaitront ici.</p>
        </div>
      </section>
    );
  }

  const hasAllergies = !!patient.allergies;
  const hasHTA = /hta|hypertension/i.test(`${patient.maladies || ""} ${patient.notes_importantes || ""}`);
  const hasDiabete = /diab/i.test(`${patient.maladies || ""} ${patient.notes_importantes || ""}`);
  const isAnticoagulant = /anticoagulant|sintrom|previscan|eliquis|xarelto/i.test(`${patient.maladies || ""} ${patient.notes_importantes || ""} ${patient.traitement_en_cours || ""}`);

  let alertLevel = "ok";
  if (hasAllergies || isAnticoagulant) alertLevel = "danger";
  else if (hasHTA || hasDiabete) alertLevel = "warning";

  const alertLabels = { ok: "Patient Stable", warning: "Facteurs de Risque", danger: "Risque Critique" };
  const alertIcons = { ok: CheckCircle, warning: AlertTriangle, danger: AlertTriangle };
  const AlertIcon = alertIcons[alertLevel];

  const risks = [
    patient.allergies ? { label: "Allergie", tone: "danger" } : null,
    hasHTA ? { label: "HTA", tone: "danger" } : null,
    hasDiabete ? { label: "Diabete", tone: "warning" } : null,
    isAnticoagulant ? { label: "Anticoagulant", tone: "danger" } : null,
    /tabac|fumeur/i.test(`${patient.maladies || ""} ${patient.notes_importantes || ""}`) ? { label: "Tabac", tone: "neutral" } : null,
  ].filter(Boolean);

  const quickStats = [
    { icon: Calendar, label: "Age", value: patient.age ? `${patient.age} ans` : patient.date_naissance },
    { icon: UserRound, label: "Sexe", value: patient.sexe },
    { icon: Heart, label: "Groupe", value: patient.groupe_sanguin },
    { icon: Phone, label: "Telephone", value: patient.telephone },
  ];

  return (
    <section className={`patient-hero patient-hero--${alertLevel}`}>
      <div className="patient-hero-avatar-wrap">
        <div className={`patient-hero-avatar ${patient.sexe === "Masculin" ? "is-male" : "is-female"}`}>
          {patientInitials(patient)}
        </div>
        <span className={`hero-alert-ring is-${alertLevel}`} />
      </div>

      <div className="patient-hero-content">
        <div className="patient-hero-topline">
          <div className="hero-meta-left">
            <span className="hero-id">{patient.code || `ID: ${patient.id}`}</span>
            <span className={`hero-status is-${alertLevel}`}>
              <AlertIcon size={14} /> {alertLabels[alertLevel]}
            </span>
          </div>
        </div>

        <h1 className="hero-name">{fullname(patient)}</h1>

        <div className="hero-quick-stats">
          {quickStats.map((item) => {
            const Icon = item.icon;
            return (
              <div className="quick-stat" key={item.label}>
                <div className="quick-stat-icon"><Icon size={14} /></div>
                <div className="quick-stat-body">
                  <span className="quick-stat-label">{item.label}</span>
                  <strong className="quick-stat-value">{displayValue(item.value, "N/A")}</strong>
                </div>
              </div>
            );
          })}
        </div>

        <div className="hero-risk-tags">
          {risks.map(r => (
            <span key={r.label} className={`risk-tag is-${r.tone}`}>
              {r.tone === "danger" ? <AlertTriangle size={12} /> : r.tone === "warning" ? <AlertTriangle size={12} /> : <CheckCircle size={12} />}
              {r.label}
            </span>
          ))}
          {risks.length === 0 && <span className="risk-tag is-ok"><CheckCircle size={12} /> Aucun risque majeur</span>}
        </div>
      </div>

      <div className="patient-hero-actions">
        <button className="btn btn--primary btn--elevated" onClick={() => onTab?.("new-visit")}>
          <Stethoscope size={18} /> <span>Nouvelle visite</span>
        </button>
        <button className="btn btn--secondary btn--soft" onClick={() => onRiskScan?.()}>
          <Scan size={18} /> <span>Analyse IA</span>
        </button>
        <button className="btn btn--ghost btn--icon" onClick={() => onTab?.("docs")} title="QR Upload">
          <QrCode size={18} />
        </button>
      </div>
    </section>
  );
}

function DeleteConfirmDialog({ name, onConfirm, onCancel }) {
  return (
    <div className="delete-dialog-overlay" onClick={onCancel}>
      <div className="delete-dialog" onClick={e => e.stopPropagation()}>
        <div className="delete-dialog__icon"><AlertTriangle size={28} /></div>
        <h3 className="delete-dialog__title">Supprimer ce dossier ?</h3>
        <p className="delete-dialog__body">
          Le dossier de <strong>{name}</strong> sera définitivement supprimé avec toutes ses consultations, documents et ordonnances.
          <br/><span className="delete-dialog__warn">Cette action est irréversible.</span>
        </p>
        <div className="delete-dialog__actions">
          <button className="btn btn--secondary" onClick={onCancel}>Annuler</button>
          <button className="btn btn--danger" onClick={onConfirm}>
            <Trash2 size={14} /> Supprimer définitivement
          </button>
        </div>
      </div>
    </div>
  );
}

function CivilPanelCard({ form, setForm, onNew, onSave, onDelete, saving, selected }) {
  const update = (key, value) => setForm((current) => {
    if (key === "date_naissance") {
      return { ...current, date_naissance: value, age: calculateAgeFromBirthDate(value) };
    }
    return { ...current, [key]: value };
  });
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setEditing(!selected);
    setConfirmDelete(false);
  }, [selected?.id]);

  async function handleSave() {
    await onSave();
    if (selected) setEditing(false);
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await onDelete();
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const patientName = [form.nom, form.prenom].filter(Boolean).join(" ") || "ce patient";

  return (
    <>
      {confirmDelete && (
        <DeleteConfirmDialog
          name={patientName}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    <section className="patient-details-panel">
      <header className="panel-header">
        <div className="panel-title">
          <UserRound size={18} />
          <span>État Civil & Informations</span>
        </div>
        <div className="panel-actions">
          {!selected ? (
            <>
              <button className="btn btn--secondary" onClick={onNew}>
                <RefreshCw size={16} /> Vider
              </button>
              <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
                <Save size={16} /> Enregistrer
              </button>
            </>
          ) : !editing ? (
            <>
              <button
                className="btn btn--danger-ghost"
                title="Supprimer ce dossier patient"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
              >
                <Trash2 size={14} /> {deleting ? "Suppression…" : "Supprimer"}
              </button>
              <button className="btn btn--secondary" onClick={() => setEditing(true)}>
                <Pencil size={16} /> Modifier
              </button>
            </>
          ) : (
            <>
              <button
                className="btn btn--danger-ghost"
                title="Supprimer ce dossier patient"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
              >
                <Trash2 size={14} /> Supprimer
              </button>
              <button className="btn btn--secondary" onClick={() => setEditing(false)}>Annuler</button>
              <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
                <Save size={16} /> Enregistrer
              </button>
            </>
          )}
        </div>
      </header>


      <div className="panel-content">
        {editing ? (
          <div className="field-grid">

          <Field label="Code" value={form.code} onChange={(value) => update("code", value)} />
          <Field label="Nom" value={form.nom} onChange={(value) => update("nom", value.toUpperCase())} />
          <Field label="Prenom" value={form.prenom} onChange={(value) => update("prenom", value)} />
          <Field label="Naissance" type="date" value={String(form.date_naissance || "").slice(0, 10)} onChange={(value) => update("date_naissance", value)} />
          <Field label="Age" value={form.age} onChange={(value) => update("age", value)} />
          <SelectField label="Sexe" value={form.sexe} onChange={(value) => update("sexe", value)}>
            <option>Feminin</option>
            <option>Masculin</option>
          </SelectField>
          <Field label="Groupe sanguin" value={form.groupe_sanguin} onChange={(value) => update("groupe_sanguin", value)} />
          <Field label="Telephone" value={form.telephone} onChange={(value) => update("telephone", value)} />
          <Field label="Situation" value={form.situation_familiale} onChange={(value) => update("situation_familiale", value)} />
          <Field label="Profession" value={form.profession} onChange={(value) => update("profession", value)} />
          <Field label="Oriente par" value={form.oriente_par} onChange={(value) => update("oriente_par", value)} />
          <Field label="Adresse" wide value={form.adresse} onChange={(value) => update("adresse", value)} />
          <div className="patient-notes-grid">
            <TextArea compact label="Allergies" value={form.allergies} onChange={(value) => update("allergies", value)} />
            <TextArea compact label="Maladies / ATCD" value={form.maladies} onChange={(value) => update("maladies", value)} />
            <TextArea compact label="Notes importantes" value={form.notes_importantes} onChange={(value) => update("notes_importantes", value)} />
          </div>
        </div>
      ) : (
        <div className="patient-details-readonly">
          {/* Group 1: Identite */}
          <div className="info-group info-group--premium">
            <div className="info-group__title"><ShieldCheck size={14} /> Identite</div>
            <div className="info-group__grid">
              {[
                ["Code", form.code || form.id],
                ["Nom", form.nom],
                ["Prenom", form.prenom],
                ["Naissance", form.date_naissance],
                ["Age", form.age ? `${form.age} ans` : ""],
                ["Sexe", form.sexe],
              ].map(([label, value]) => (
                <div key={label} className="info-chip info-chip--premium">
                  <span className="info-chip__label">{label}</span>
                  <span className={`info-chip__value ${value ? "" : "info-chip__value--empty"}`}>{value || "Non renseigne"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Group 2: Contact */}
          <div className="info-group info-group--premium">
            <div className="info-group__title"><Phone size={14} /> Contact</div>
            <div className="info-group__grid">
              {[
                ["Telephone", form.telephone],
                ["Adresse", form.adresse],
                ["Situation", form.situation_familiale],
                ["Profession", form.profession],
                ["Oriente par", form.oriente_par],
              ].map(([label, value]) => (
                <div key={label} className="info-chip info-chip--premium">
                  <span className="info-chip__label">{label}</span>
                  <span className={`info-chip__value ${value ? "" : "info-chip__value--empty"}`}>{value || "Non renseigne"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Group 3: Medical important */}
          <div className="info-group info-group--premium">
            <div className="info-group__title"><Heart size={14} /> Medical important</div>
            <div className="info-group__grid info-group__grid--wide">
              {[
                { label: "Allergies", value: form.allergies, icon: AlertTriangle, tone: "danger" },
                { label: "Maladies / ATCD", value: form.maladies, icon: ShieldCheck, tone: "warning" },
                { label: "Notes importantes", value: form.notes_importantes, icon: FileText, tone: "info" },
              ].map((item) => {
                const Icon = item.icon;
                const toneBg = { danger: "#fef2f2", warning: "#fffbeb", info: "#eff6ff", neutral: "#f8fafc" };
                const toneColor = { danger: "#ef4444", warning: "#f59e0b", info: "#2563eb", neutral: "#64748b" };
                const bg = item.value ? toneBg[item.tone] : toneBg.neutral;
                const color = toneColor[item.tone];
                return (
                  <div key={item.label} className="info-chip info-chip--premium info-chip--medical" style={{ borderLeft: `3px solid ${color}`, background: bg }}>
                    <div className="info-chip__header">
                      <Icon size={13} style={{ color }} />
                      <span className="info-chip__label" style={{ color }}>{item.label}</span>
                    </div>
                    <span className={`info-chip__value ${item.value ? "" : "info-chip__value--empty"}`} style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{item.value || "Non renseigne"}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </div>
    </section>
    </>
  );
}

function VisitPanel({ visit, setVisit, onSave, onDictate }) {
  const update = (key, value) => setVisit((current) => ({ ...current, [key]: value }));
  const [visitTypes, setVisitTypes] = useState([]);
  const columns = [
    ["motif", "Motif"],
    ["histoire", "Histoire"],
    ["examens", "Examens"],
    ["diagnostics", "Diagnostics"],
    ["traitements", "Traitements"]
  ];

  useEffect(() => {
    api.visitTypes().then((d) => setVisitTypes(d.rows || [])).catch(() => {});
  }, []);

  function handleTypeChange(typeName) {
    update("visit_type", typeName);
    const found = visitTypes.find((t) => t.name === typeName);
    if (found) {
      setVisit((c) => ({ ...c, visit_type: typeName, visit_fee: found.price }));
    }
  }

  const paidColor = visit.payment_status === "paid" ? "#10b981" : visit.payment_status === "partial" ? "#f59e0b" : "#94a3b8";
  const paidLabel = visit.payment_status === "paid" ? "Paye" : visit.payment_status === "partial" ? "Partiel" : "En attente";
  const remaining = (Number(visit.visit_fee) || 0) - (Number(visit.fee_paid) || 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 16 }}>
      {/* Vitals row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: 6 }}>
        <Field label="Date" type="datetime-local" value={String(visit.date_visite || "").replace(" ", "T").slice(0, 16)} onChange={(v) => update("date_visite", v)} />
        <Field label="Tension" value={visit.tension} onChange={(v) => update("tension", v)} placeholder="mmHg" />
        <Field label="FC" value={visit.frequence_cardiaque} onChange={(v) => update("frequence_cardiaque", v)} placeholder="bpm" />
        <Field label="Glycemie" value={visit.glycemie} onChange={(v) => update("glycemie", v)} placeholder="g/L" />
        <Field label="Poids" value={visit.poids || ""} onChange={(v) => update("poids", v)} placeholder="kg" />
        <Field label="Taille" value={visit.taille || ""} onChange={(v) => update("taille", v)} placeholder="cm" />
      </div>

      {/* Fee & Payment - compact inline */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 6, padding: 10, background: visit.payment_status === "paid" ? "#f0fdf4" : "#f8fafc", borderRadius: 8, border: `1px solid ${paidColor}30`, borderLeft: `3px solid ${paidColor}` }}>
        <div style={{ flex: "1 1 150px" }}>
          <SelectField label="Type de visite" value={visit.visit_type || ""} onChange={handleTypeChange}>
            <option value="">-- Type --</option>
            {visitTypes.map((t) => <option key={t.id} value={t.name}>{t.name} ({t.price} DA)</option>)}
          </SelectField>
        </div>
        <div style={{ flex: "0 0 100px" }}>
          <Field label="Honoraire" type="number" value={visit.visit_fee || ""} onChange={(v) => update("visit_fee", Number(v))} />
        </div>
        <div style={{ flex: "0 0 100px" }}>
          <Field label="Paye" type="number" value={visit.fee_paid || ""} onChange={(v) => update("fee_paid", Number(v))} />
        </div>
        <div style={{ flex: "0 0 110px" }}>
          <SelectField label="Statut" value={visit.payment_status || "pending"} onChange={(v) => update("payment_status", v)}>
            <option value="pending">En attente</option>
            <option value="partial">Partiel</option>
            <option value="paid">Paye</option>
          </SelectField>
        </div>
        {remaining > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#ef4444", whiteSpace: "nowrap", paddingBottom: 8 }}>Reste: {remaining} DA</span>}
        {remaining <= 0 && visit.visit_fee > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", whiteSpace: "nowrap", paddingBottom: 8 }}>Soldأ© âœ“</span>}
      </div>

      {/* Medical observations */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 8 }}>
        {columns.map(([key, label]) => (
          <TextArea key={key} label={label} value={visit[key]} onChange={(v) => update(key, v)} />
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, paddingTop: 4 }}>
        <button className="btn btn--secondary" style={{ height: 34, fontSize: 12, borderRadius: 8 }} onClick={() => onDictate("histoire")}><Mic size={13} /> Dictee</button>
        <button className="btn btn--primary" style={{ height: 34, fontSize: 12, borderRadius: 8, padding: "0 20px", fontWeight: 700 }} onClick={onSave}><Save size={13} /> Sauvegarder</button>
      </div>
    </div>
  );
}

function ECGChart() {
  const points = [0, 48, 18, 48, 26, 44, 34, 52, 44, 12, 54, 76, 62, 49, 92, 48, 108, 48, 118, 41, 130, 58, 142, 20, 154, 72, 164, 49, 200, 48, 230, 48];
  const polyline = points.reduce((acc, value, index) => {
    if (index % 2 === 0) return `${acc}${value},`;
    return `${acc}${value} `;
  }, "");
  return (
    <svg className="ecg-chart" viewBox="0 0 230 90" role="img" aria-label="Trace ECG">
      <defs>
        <pattern id="grid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M 12 0 L 0 0 0 12" fill="none" stroke="#c9dceb" strokeWidth="0.8" />
        </pattern>
      </defs>
      <rect width="230" height="90" fill="url(#grid)" />
      <polyline points={polyline} fill="none" stroke="#c43737" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LineChart({ rows, fields, height = 120 }) {
  const data = [...(rows || [])].reverse().slice(-12);
  if (!data.length) return <div className="empty-note">Aucune donnee</div>;
  const values = data.flatMap((row) => fields.map((field) => Number(row[field.key])).filter(Number.isFinite));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const pointsFor = (field) => data.map((row, index) => {
    const x = data.length === 1 ? 10 : 10 + (index * 210) / (data.length - 1);
    const raw = Number(row[field.key]);
    const y = Number.isFinite(raw) ? height - 15 - ((raw - min) * (height - 30)) / Math.max(max - min, 1) : height - 15;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg className="trend-chart" viewBox={`0 0 230 ${height}`} role="img" aria-label="Evolution">
      <rect x="0" y="0" width="230" height={height} fill="#fff" />
      {[0, 1, 2, 3].map((line) => <line key={line} x1="8" x2="222" y1={15 + line * 28} y2={15 + line * 28} stroke="#d7e5f0" />)}
      {fields.map((field) => <polyline key={field.key} points={pointsFor(field)} fill="none" stroke={field.color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />)}
    </svg>
  );
}

function ScoreBadge({ label, score }) {
  return (
    <div className={`score-card score-card--${score?.level || "missing"}`}>
      <span>{label}</span>
      <strong>{score?.value ?? "--"}</strong>
      <em>{score?.level || "missing"}</em>
    </div>
  );
}

function CardioProfilePanel({ patient, cardio, onSave }) {
  const [form, setForm] = useState({});
  const keys = [
    ["hypertension", "Hypertension"],
    ["diabetes", "Diabete"],
    ["smoking", "Tabac"],
    ["obesity", "Obesite"],
    ["dyslipidemia", "Dyslipidemie"],
    ["family_history_heart_disease", "Famille cardio"],
    ["previous_infarction", "Infarctus"],
    ["previous_stroke", "AVC/AIT"],
    ["previous_angioplasty", "Angioplastie"],
    ["previous_bypass", "Pontage"],
    ["heart_failure", "Insuffisance cardiaque"],
    ["vascular_disease", "Maladie vasculaire"],
    ["abnormal_renal_function", "Renal anormal"],
    ["abnormal_liver_function", "Foie anormal"],
    ["bleeding_history", "Saignement"],
    ["labile_inr", "INR labile"],
    ["alcohol_or_drugs", "Alcool/AINS"]
  ];

  useEffect(() => {
    setForm(cardio?.profile || {});
  }, [cardio?.profile?.updated_at, patient?.id]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="cardio-profile-grid">
      <section className="tool-card">
        <h3><ShieldCheck size={16} /> Facteurs de risque et evenements</h3>
        <div className="check-grid">
          {keys.map(([key, label]) => <CheckField key={key} label={label} checked={form[key]} onChange={(value) => update(key, value)} />)}
        </div>
        <TextArea compact label="Medicaments actuels" value={form.current_medications || ""} onChange={(value) => update("current_medications", value)} />
        <button className="btn btn--primary" disabled={!patient} onClick={() => onSave(form)}><Save size={16} /> Enregistrer profil cardio</button>
      </section>
      <section className="tool-card">
        <h3><AlertTriangle size={16} /> Alertes patient</h3>
        {(cardio?.alerts || []).map((alert, index) => <div key={index} className={`ai-warning ai-warning--${alert.level}`}>{alert.message}</div>)}
        {!(cardio?.alerts || []).length && <div className="ai-warning ai-warning--ok">Aucune alerte cardio active.</div>}
      </section>
    </div>
  );
}

function VitalsPanel({ patient, cardio, onSave }) {
  const [form, setForm] = useState({ measured_at: new Date().toISOString().slice(0, 16), systolic_bp: "", diastolic_bp: "", heart_rate: "", oxygen_saturation: "", weight: "", height: "", notes: "" });
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  function submit() {
    onSave({
      ...form,
      measured_at: form.measured_at.replace("T", " "),
      systolic_bp: form.systolic_bp ? Number(form.systolic_bp) : null,
      diastolic_bp: form.diastolic_bp ? Number(form.diastolic_bp) : null,
      heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
      oxygen_saturation: form.oxygen_saturation ? Number(form.oxygen_saturation) : null,
      weight: form.weight ? Number(form.weight) : null,
      height: form.height ? Number(form.height) : null
    });
  }

  return (
    <div className="vitals-grid">
      <section className="tool-card">
        <h3><Activity size={16} /> Constantes cardio</h3>
        <div className="compact-form-grid">
          <Field label="Date" type="datetime-local" value={String(form.measured_at || "").replace(" ", "T").slice(0, 16)} onChange={(value) => update("measured_at", value)} />
          <Field label="PAS" value={form.systolic_bp} onChange={(value) => update("systolic_bp", value)} />
          <Field label="PAD" value={form.diastolic_bp} onChange={(value) => update("diastolic_bp", value)} />
          <Field label="FC" value={form.heart_rate} onChange={(value) => update("heart_rate", value)} />
          <Field label="SpO2" value={form.oxygen_saturation} onChange={(value) => update("oxygen_saturation", value)} />
          <Field label="Poids" value={form.weight} onChange={(value) => update("weight", value)} />
          <Field label="Taille cm" value={form.height} onChange={(value) => update("height", value)} />
        </div>
        <button className="btn btn--primary" disabled={!patient} onClick={submit}><Save size={16} /> Ajouter constantes</button>
      </section>
      <section className="tool-card">
        <h3>Evolution TA / FC</h3>
        <LineChart rows={cardio?.vitals || []} fields={[{ key: "systolic_bp", color: "#c74435" }, { key: "diastolic_bp", color: "#2b84bd" }, { key: "heart_rate", color: "#309b72" }]} />
      </section>
      <section className="tool-card document-list">
        <h3>Historique constantes</h3>
        {(cardio?.vitals || []).slice(0, 10).map((vital) => (
          <div key={vital.id} className={`mini-row ${vital.systolic_bp >= 160 ? "is-urgent" : ""}`}>
            <strong>{String(vital.measured_at || "").slice(0, 16)} - {vital.systolic_bp || "--"}/{vital.diastolic_bp || "--"}</strong>
            <span>FC {vital.heart_rate || "--"} / SpO2 {vital.oxygen_saturation || "--"} / BMI {vital.bmi || "--"}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function ScoresPanel({ cardio }) {
  const scores = cardio?.scores || {};
  return (
    <div className="scores-grid">
      <ScoreBadge label="Framingham 10 ans" score={scores.framingham_10y} />
      <ScoreBadge label="CHA2DS2-VASc" score={scores.cha2ds2_vasc} />
      <ScoreBadge label="HAS-BLED" score={scores.has_bled} />
      <ScoreBadge label="ASCVD 10 ans" score={scores.ascvd_10y} />
      <section className="tool-card">
        <h3>Inputs calcul</h3>
        <p className="summary-box">{JSON.stringify(scores.inputs || {}, null, 2)}</p>
        <p className="disclaimer">{scores.disclaimer}</p>
      </section>
    </div>
  );
}

function ECGPanel({ patient, detail, cardio, onSave }) {
  const [form, setForm] = useState({ document_id: "", recorded_at: new Date().toISOString().slice(0, 16), rhythm: "", heart_rate: "", pr_ms: "", qrs_ms: "", qt_ms: "", qtc_ms: "", annotations: "" });
  const [zoom, setZoom] = useState(1);
  const ecgDocs = (detail?.documents || []).filter((doc) => (doc.type_document || "").toLowerCase().includes("ecg") || (doc.mime_type || "").startsWith("image/"));
  const selectedDoc = ecgDocs.find((doc) => String(doc.id) === String(form.document_id)) || ecgDocs[0];
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  function submit() {
    onSave({
      ...form,
      document_id: form.document_id ? Number(form.document_id) : null,
      recorded_at: form.recorded_at.replace("T", " "),
      heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
      pr_ms: form.pr_ms ? Number(form.pr_ms) : null,
      qrs_ms: form.qrs_ms ? Number(form.qrs_ms) : null,
      qt_ms: form.qt_ms ? Number(form.qt_ms) : null,
      qtc_ms: form.qtc_ms ? Number(form.qtc_ms) : null
    });
  }

  return (
    <div className="ecg-layout">
      <section className="tool-card">
        <h3><FileImage size={16} /> ECG viewer</h3>
        <select value={form.document_id || selectedDoc?.id || ""} onChange={(event) => update("document_id", event.target.value)}>
          <option value="">ECG sans fichier</option>
          {ecgDocs.map((doc) => <option key={doc.id} value={doc.id}>{doc.original_name}</option>)}
        </select>
        <input type="range" min="1" max="2.5" step="0.1" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} />
        <div className="ecg-viewer">
          {selectedDoc ? <img style={{ transform: `scale(${zoom})` }} src={`${apiBase}/api/documents/${selectedDoc.id}`} alt="ECG" /> : <ECGChart />}
        </div>
      </section>
      <section className="tool-card">
        <h3>Interpretation assistee</h3>
        <div className="compact-form-grid">
          <Field label="Date ECG" type="datetime-local" value={String(form.recorded_at || "").replace(" ", "T").slice(0, 16)} onChange={(value) => update("recorded_at", value)} />
          <Field label="Rythme" value={form.rhythm} onChange={(value) => update("rhythm", value)} />
          <Field label="FC" value={form.heart_rate} onChange={(value) => update("heart_rate", value)} />
          <Field label="PR ms" value={form.pr_ms} onChange={(value) => update("pr_ms", value)} />
          <Field label="QRS ms" value={form.qrs_ms} onChange={(value) => update("qrs_ms", value)} />
          <Field label="QT ms" value={form.qt_ms} onChange={(value) => update("qt_ms", value)} />
          <Field label="QTc ms" value={form.qtc_ms} onChange={(value) => update("qtc_ms", value)} />
        </div>
        <TextArea compact label="Annotations ECG" value={form.annotations} onChange={(value) => update("annotations", value)} />
        <button className="btn btn--primary" disabled={!patient} onClick={submit}><Save size={16} /> Enregistrer ECG</button>
      </section>
      <section className="tool-card document-list">
        <h3>ECG recents</h3>
        {(cardio?.ecgs || []).slice(0, 8).map((ecg) => (
          <div key={ecg.id} className={`mini-row ${ecg.severity === "critical" ? "is-urgent" : ""}`}>
            <strong>{String(ecg.recorded_at || "").slice(0, 16)} - {ecg.rhythm || "Rythme non renseigne"}</strong>
            <span>FC {ecg.heart_rate || "--"} / QTc {ecg.qtc_ms || "--"} / {ecg.severity}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function ImagingLabsPanel({ patient, cardio, onSaveImaging, onSaveLabs }) {
  const [imaging, setImaging] = useState({ imaging_type: "Echocardiographie", performed_at: new Date().toISOString().slice(0, 16), ejection_fraction: "", valve_status: "", wall_motion: "", report: "" });
  const [lab, setLab] = useState({ measured_at: new Date().toISOString().slice(0, 16), total_cholesterol: "", ldl: "", hdl: "", triglycerides: "", troponin: "", bnp: "", nt_probnp: "", creatinine: "" });
  const ui = (key, value) => setImaging((current) => ({ ...current, [key]: value }));
  const ul = (key, value) => setLab((current) => ({ ...current, [key]: value }));
  const numberOrNull = (value) => value === "" ? null : Number(value);

  return (
    <div className="imaging-labs-grid">
      <section className="tool-card">
        <h3>Imagerie cardio</h3>
        <SelectField label="Type" value={imaging.imaging_type} onChange={(value) => ui("imaging_type", value)}>
          <option>Echocardiographie</option>
          <option>IRM cardiaque</option>
          <option>Scanner coronaire</option>
        </SelectField>
        <div className="compact-form-grid">
          <Field label="Date" type="datetime-local" value={String(imaging.performed_at || "").replace(" ", "T").slice(0, 16)} onChange={(value) => ui("performed_at", value)} />
          <Field label="FEVG %" value={imaging.ejection_fraction} onChange={(value) => ui("ejection_fraction", value)} />
          <Field label="Valves" value={imaging.valve_status} onChange={(value) => ui("valve_status", value)} />
          <Field label="Cinetique" value={imaging.wall_motion} onChange={(value) => ui("wall_motion", value)} />
        </div>
        <TextArea compact label="Compte rendu structure" value={imaging.report} onChange={(value) => ui("report", value)} />
        <button className="btn btn--primary" disabled={!patient} onClick={() => onSaveImaging({ ...imaging, performed_at: imaging.performed_at.replace("T", " "), ejection_fraction: numberOrNull(imaging.ejection_fraction) })}><Save size={16} /> Enregistrer imagerie</button>
      </section>
      <section className="tool-card">
        <h3>Biologie cardio</h3>
        <div className="compact-form-grid">
          <Field label="Date" type="datetime-local" value={String(lab.measured_at || "").replace(" ", "T").slice(0, 16)} onChange={(value) => ul("measured_at", value)} />
          <Field label="Chol total" value={lab.total_cholesterol} onChange={(value) => ul("total_cholesterol", value)} />
          <Field label="LDL" value={lab.ldl} onChange={(value) => ul("ldl", value)} />
          <Field label="HDL" value={lab.hdl} onChange={(value) => ul("hdl", value)} />
          <Field label="TG" value={lab.triglycerides} onChange={(value) => ul("triglycerides", value)} />
          <Field label="Troponine" value={lab.troponin} onChange={(value) => ul("troponin", value)} />
          <Field label="BNP" value={lab.bnp} onChange={(value) => ul("bnp", value)} />
          <Field label="NT-proBNP" value={lab.nt_probnp} onChange={(value) => ul("nt_probnp", value)} />
          <Field label="Creatinine" value={lab.creatinine} onChange={(value) => ul("creatinine", value)} />
        </div>
        <button className="btn btn--primary" disabled={!patient} onClick={() => onSaveLabs(Object.fromEntries(Object.entries({ ...lab, measured_at: lab.measured_at.replace("T", " ") }).map(([key, value]) => [key, key === "measured_at" ? value : numberOrNull(value)])))}><Save size={16} /> Enregistrer biologie</button>
      </section>
      <section className="tool-card">
        <h3>Trends LDL / HDL / Creatinine</h3>
        <LineChart rows={cardio?.labs || []} fields={[{ key: "ldl", color: "#c74435" }, { key: "hdl", color: "#309b72" }, { key: "creatinine", color: "#2b84bd" }]} />
      </section>
    </div>
  );
}

function DiagnosisTreatmentPanel({ patient, cardio, medications, onDiagnosis, onSavePrescription }) {
  const diagnoses = ["Hypertension", "Coronary artery disease", "Heart failure", "Arrhythmia", "Valve disease"];
  const cardioMeds = medications.filter((med) => /IEC|Beta|Statine|Anticoagulant|Diuretique|mineralocorticoide/i.test(`${med.class_name} ${med.name}`));
  const [lines, setLines] = useState([]);

  return (
    <div className="diagnosis-grid">
      <section className="tool-card">
        <h3>Diagnostic cardio rapide</h3>
        <div className="quick-buttons">
          {diagnoses.map((diagnosis) => <button key={diagnosis} className="btn btn--secondary" disabled={!patient} onClick={() => onDiagnosis({ diagnosis })}>{diagnosis}</button>)}
        </div>
        {(cardio?.diagnoses || []).slice(0, 8).map((item) => <div key={item.id} className="mini-row"><strong>{item.diagnosis}</strong><span>{item.status}</span></div>)}
      </section>
      <section className="tool-card">
        <h3>Traitement cardio</h3>
        <div className="medicine-list">
          {cardioMeds.map((med) => (
            <button key={med.id} onClick={() => setLines([...lines, `${med.name} - ${med.dosage || med.default_dose || ""}`])}>
              <strong>{med.name}</strong><small>{med.class_name} / {med.indication}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="tool-card">
        <h3>Ordonnance cardio</h3>
        {lines.map((line, index) => <input key={index} value={line} onChange={(event) => setLines(lines.map((item, i) => i === index ? event.target.value : item))} />)}
        <div className="panel-actions panel-actions--tight">
          <button className="btn btn--secondary" onClick={() => setLines([...lines, ""])}><Plus size={16} /> Ligne</button>
          <button className="btn btn--primary" disabled={!patient || !lines.length} onClick={() => onSavePrescription(lines.filter(Boolean))}><Save size={16} /> Prescription</button>
        </div>
      </section>
    </div>
  );
}

function FollowupPanel({ patient, cardio, appointments, onAutoFollowup, onSaveAppointment }) {
  return (
    <div className="appointment-grid">
      <AppointmentPanel patient={patient} appointments={appointments} onSave={onSaveAppointment} />
      <section className="tool-card document-list">
        <h3>Suivi cardio</h3>
        <button className="btn btn--primary" disabled={!patient} onClick={onAutoFollowup}><CalendarDays size={16} /> Suivi automatique</button>
        {(cardio?.followups || []).slice(0, 10).map((item) => (
          <div key={item.id} className={`mini-row ${item.priority === "urgent" ? "is-urgent" : ""}`}>
            <strong>{String(item.due_at || "").slice(0, 16)} - {item.reason}</strong>
            <span>{item.priority} / {item.status}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function AppointmentPanel({ patient, appointments, onSave }) {
  const [form, setForm] = useState(blankAppointment);
  const patientAppointments = useMemo(
    () => (appointments || []).filter((item) => !patient?.id || item.patient_id === patient.id),
    [appointments, patient]
  );

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="appointment-grid">
      <section className="tool-card">
        <h3><CalendarDays size={16} /> Agenda</h3>
        <Field label="Titre" value={form.title} onChange={(value) => update("title", value)} />
        <Field label="Date / heure" type="datetime-local" value={String(form.scheduled_at || "").replace(" ", "T").slice(0, 16)} onChange={(value) => update("scheduled_at", value)} />
        <SelectField label="Statut" value={form.status} onChange={(value) => update("status", value)}>
          <option value="normal">normal</option>
          <option value="urgent">urgent</option>
        </SelectField>
        <SelectField label="Rappel" value={form.reminder_channel} onChange={(value) => update("reminder_channel", value)}>
          <option value="none">none</option>
          <option value="sms">sms</option>
          <option value="whatsapp">whatsapp</option>
        </SelectField>
        <TextArea compact label="Note rappel" value={form.reminder_note} onChange={(value) => update("reminder_note", value)} />
        <button className="btn btn--primary" disabled={!patient} onClick={() => onSave({ ...form, patient_id: patient.id, scheduled_at: form.scheduled_at.replace("T", " ") })}>
          <Bell size={16} /> Planifier
        </button>
      </section>
      <section className="tool-card document-list">
        <h3><FileText size={16} /> Rendez-vous patient</h3>
        {patientAppointments.slice(0, 9).map((item) => (
          <div key={item.id} className={`mini-row ${item.status === "urgent" ? "is-urgent" : ""}`}>
            <strong>{String(item.scheduled_at || "").slice(0, 16).replace("T", " ")}</strong>
            <span>{item.title} / {item.reminder_channel}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function DocumentsPanel({ patient, detail, onUpload, onSaveNotes, uploadMode }) {
  const [type, setType] = useState("ECG");
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState("");
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [qrNonce, setQrNonce] = useState(Date.now());
  const [qrInfo, setQrInfo] = useState(null);
  const [qrDebug, setQrDebug] = useState(null);
  const [aiSettings, setAiSettings] = useState({});
  const [aiAnalyses, setAiAnalyses] = useState([]);
  const [selectedAnalysisId, setSelectedAnalysisId] = useState(null);
  const [aiLoadingDocId, setAiLoadingDocId] = useState(null);
  const [aiError, setAiError] = useState("");
  const [aiMessage, setAiMessage] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [editingAnalysis, setEditingAnalysis] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState("");
  const [valuesDraft, setValuesDraft] = useState([]);
  const docs = detail?.documents || [];
  const selectedDoc = docs.find((doc) => doc.id === selectedDocId) || docs[0];
  const selectedAnalysis = aiAnalyses.find((item) => item.id === selectedAnalysisId) || aiAnalyses[0];
  const selectedPayload = getAnalysisPayload(selectedAnalysis);
  const uploadReady = Boolean(uploadMode?.upload_ready);
  const setupMessage = uploadMode?.setup_message || "Configurez Cloudflare Tunnel pour activer le QR public.";
  const aiModel = aiSettings.AI_LOCKED_MODEL || aiSettings.AI_MODEL_NAME || OR_DEFAULT_MODEL_NAME;
  const documentAiEnabled = isSettingEnabled(aiSettings.AI_DOCUMENT_AI_ENABLED ?? "true");
  const keyConfigured = aiSettings.AI_OPENROUTER_API_KEY_CONFIGURED === "true";
  const consentRequired = isSettingEnabled(aiSettings.AI_REQUIRE_MANUAL_CONSENT ?? "false");
  const aiAnalysisMode = aiSettings.AI_ANALYSIS_MODE || "short";
  const [cloudSub, setCloudSub] = useState(null);
  const backendCloudReady = aiSettings.CLOUD_AI_CONFIGURED === "true";
  const cloudConfigured = isCloudConfigured() || backendCloudReady;
  const cloudReady = backendCloudReady || (isCloudConfigured() && cloudAiUsable(cloudSub));
  const aiUnavailable = !documentAiEnabled || (!keyConfigured && !cloudReady);

  useEffect(() => {
    if (isCloudConfigured()) {
      syncCloudSettingsToBackend().catch(() => {});
      cloudAi.subscription().then(setCloudSub).catch(() => {});
    }
  }, []);

  const canSendToAi = selectedDoc && !aiUnavailable && (!consentRequired || consentConfirmed);

  useEffect(() => {
    api.getSettings().then((d) => setAiSettings(d.settings || {})).catch(() => {});
  }, []);

  useEffect(() => {
    setSelectedDocId(null);
    setAiAnalyses([]);
    setSelectedAnalysisId(null);
    setConsentConfirmed(false);
    setQrInfo(null);
    setQrDebug(null);
    setAiError("");
    setAiMessage("");
  }, [patient?.id]);

  useEffect(() => {
    api.qrDebug().then(setQrDebug).catch(() => {});
  }, [patient?.id, qrNonce]);

  useEffect(() => {
    if (!selectedDoc?.id) {
      setAiAnalyses([]);
      setSelectedAnalysisId(null);
      return;
    }
    loadAiAnalyses(selectedDoc.id);
  }, [selectedDoc?.id]);

  useEffect(() => {
    setSummaryDraft(selectedAnalysis?.validated_summary || selectedAnalysis?.summary || "");
    setValuesDraft(getAnalysisValues(selectedAnalysis));
    setEditingAnalysis(false);
  }, [selectedAnalysis?.id]);

  function upsertAnalysis(analysis) {
    setAiAnalyses((current) => [analysis, ...current.filter((item) => item.id !== analysis.id)]);
    setSelectedAnalysisId(analysis.id);
  }

  async function loadAiAnalyses(documentId) {
    try {
      const result = await api.documentAiAnalysis(documentId);
      setAiAnalyses(result.rows || []);
      setSelectedAnalysisId(result.rows?.[0]?.id || null);
    } catch (error) {
      setAiError(error.message);
    }
  }

  async function runAiAnalysis(doc, consent = consentConfirmed, reAnalyze = false) {
    if (!doc) return;
    setAiLoadingDocId(doc.id);
    setAiError("");
    setAiMessage("");
    try {
      if (isCloudConfigured()) {
        await syncCloudSettingsToBackend().catch(() => {});
      }
      const result = await api.analyzeDocument(doc.id, { consent_confirmed: consent, analysis_mode: aiAnalysisMode, re_analyze: reAnalyze });
      
      if (result.analysis?.use_cloud && isCloudConfigured()) {
        const cloudResult = await cloudAi.analyzeDocument(doc.id, result.analysis.messages, result.analysis.action_type);
        // Sync cloud result to local DB for persistence
        const synced = await api.syncCloudAnalysis(doc.id, {
          provider: "cloud",
          model: "qwen-2.5-7b",
          data: cloudResult.analysis || cloudResult
        });
        upsertAnalysis(synced.analysis);
        setAiMessage("Analyse Cloud (Qwen) terminأ©e et synchronisأ©e.");
        if (isCloudConfigured()) cloudAi.subscription().then(setCloudSub).catch(() => {});
      } else {
        upsertAnalysis(result.analysis);
        setAiMessage(reAnalyze ? "Rأ©-analyse enregistree en brouillon." : "Analyse IA enregistree en brouillon.");
      }
    } catch (error) {
      setAiError(error.message === "AI analysis unavailable" ? "Analyse IA indisponible" : error.message);
    } finally {
      setAiLoadingDocId(null);
    }
  }

  async function handleUploadClick() {
    const result = await onUpload(type, file, notes);
    setFile(null);
    setNotes("");
    if (result?.id) {
      setSelectedDocId(result.id);
      if (isSettingEnabled(aiSettings.AI_AUTO_ANALYZE_AFTER_UPLOAD) && !consentRequired && documentAiEnabled && (keyConfigured || cloudReady)) {
        await runAiAnalysis({ id: result.id }, false);
      }
    }
  }

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer.files?.[0];
    if (dropped) setFile(dropped);
  }

  function preview() {
    if (!selectedDoc) return <p className="empty-note">Aucun document</p>;
    const url = `${apiBase}/api/documents/${selectedDoc.id}`;
    if ((selectedDoc.mime_type || "").startsWith("image/")) {
      return <img className="doc-preview" src={url} alt={selectedDoc.original_name} />;
    }
    if ((selectedDoc.mime_type || "").includes("pdf")) {
      return <iframe className="doc-preview doc-preview--pdf" src={url} title={selectedDoc.original_name} />;
    }
    return <a className="btn btn--primary" href={url} target="_blank" rel="noreferrer"><Eye size={16} /> Ouvrir</a>;
  }

  function updateValue(index, key, value) {
    setValuesDraft((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [key]: value } : item));
  }

  function addValueRow() {
    setValuesDraft((current) => [...current, { analyte: "", value: "", unit: "", reference_range: "", abnormal_flag: "" }]);
  }

  async function refreshQrLink() {
    if (!patient?.id) return;
    const result = await api.mobileUploadToken(patient.id);
    setQrInfo(result);
    setQrNonce(Date.now());
    api.qrDebug().then(setQrDebug).catch(() => {});
    return result;
  }

  async function testQrLink() {
    const result = qrInfo || await refreshQrLink();
    const link = result?.url;
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
  }

  function editedExtractedJson() {
    return { ...selectedPayload, summary: summaryDraft, extracted_values: valuesDraft, recommendation: aiSafetyWarning };
  }

  async function saveEditedAnalysis() {
    if (!selectedAnalysis) return;
    const result = await api.editAiAnalysis(selectedAnalysis.id, {
      summary: summaryDraft,
      extracted_json: editedExtractedJson(),
      risk_level: selectedAnalysis.risk_level,
      confidence: selectedAnalysis.confidence
    });
    upsertAnalysis(result.analysis);
    setEditingAnalysis(false);
    setAiMessage("Modification enregistree.");
  }

  async function acceptAnalysis() {
    if (!selectedAnalysis) return;
    const result = await api.acceptAiAnalysis(selectedAnalysis.id, {
      summary: summaryDraft,
      extracted_json: editedExtractedJson()
    });
    upsertAnalysis(result.analysis);
    setAiMessage("Analyse acceptee par le medecin.");
  }

  async function rejectAnalysis() {
    if (!selectedAnalysis) return;
    const result = await api.rejectAiAnalysis(selectedAnalysis.id);
    upsertAnalysis(result.analysis);
    setAiMessage("Analyse rejetee.");
  }

  async function saveLabs() {
    if (!selectedAnalysis) return;
    const result = await api.saveAiLabs(selectedAnalysis.id, { values: valuesDraft });
    upsertAnalysis(result.analysis);
    setAiMessage(result.lab_result_id ? "Valeurs enregistrees dans Analyses." : "Valeurs confirmees.");
  }

  const docTypeOptions = [
    { value: "ECG", label: "ECG", icon: Heart },
    { value: "Analyse biologique", label: "Analyse biologique", icon: FlaskConical },
    { value: "Scanner", label: "Scanner", icon: Scan },
    { value: "IRM", label: "IRM", icon: Eye },
    { value: "Echographie", label: "Echographie", icon: Activity },
    { value: "PDF report", label: "PDF report", icon: FileText },
    { value: "Other", label: "Autre", icon: FileImage },
  ];

  const selectedDocType = docTypeOptions.find((o) => o.value === type) || docTypeOptions[0];

  return (
    <div className="docs-pro-layout">
      {/* Left Sidebar: Document List */}
      <aside className="docs-pro-sidebar">
        <div className="docs-pro-sidebar__header">
          <FileText size={18} />
          <h3>Documents</h3>
          <span className="docs-pro-count">{docs.length}</span>
        </div>
        <div className="docs-pro-sidebar__body">
          {docs.map((doc) => (
            <button
              key={doc.id}
              className={`docs-pro-doc ${selectedDoc?.id === doc.id ? "is-active" : ""}`}
              onClick={() => setSelectedDocId(doc.id)}
            >
              <div className="docs-pro-doc__icon">
                {doc.source === "QR Mobile" || doc.source === "mobile-qr" ? <Smartphone size={14} /> : <FileText size={14} />}
              </div>
              <div className="docs-pro-doc__info">
                <strong>{doc.original_name}</strong>
                <span>{doc.type_document}</span>
              </div>
              <span className={`docs-pro-doc__badge ${doc.source === "QR Mobile" || doc.source === "mobile-qr" ? "is-qr" : ""}`}>
                {doc.source === "QR Mobile" || doc.source === "mobile-qr" ? "QR" : doc.type_document?.slice(0, 3)?.toUpperCase()}
              </span>
            </button>
          ))}
          {!docs.length && (
            <div className="docs-pro-empty">
              <FileText size={20} />
              <span>Aucun document</span>
            </div>
          )}
        </div>
      </aside>

      {/* Right: Upload + QR + Preview + AI */}
      <div className="docs-pro-main">
        {/* Upload Card */}
        <section
          className={`docs-pro-card docs-pro-card--upload ${dragging ? "is-dragging" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="docs-pro-card__header">
            <div className="docs-pro-card__header-left">
              <Upload size={16} />
              <h3>Upload documents</h3>
            </div>
          </div>
          <div className="docs-pro-card__body">
            <div className="docs-pro-upload-row">
              <div className="docs-pro-field docs-pro-field--select">
                <label>Type de document</label>
                <div className="docs-pro-select-wrap">
                  <selectedDocType.icon size={14} />
                  <select value={type} onChange={(event) => setType(event.target.value)}>
                    {docTypeOptions.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="docs-pro-field docs-pro-field--file">
                <label>Fichier</label>
                <div className="docs-pro-file-wrap">
                  <input id="doc-file-input" type="file" accept="image/*,.pdf,.dcm,.dicom" onChange={(event) => setFile(event.target.files?.[0])} />
                  <label htmlFor="doc-file-input" className="docs-pro-file-label">
                    <Upload size={14} />
                    <span>{file ? file.name : "Choisir un fichier"}</span>
                  </label>
                </div>
              </div>
            </div>
            <div className="docs-pro-field">
              <TextArea compact label="Notes document" value={notes} onChange={setNotes} />
            </div>
            <button className="docs-pro-upload-btn" disabled={!patient || !file} onClick={handleUploadClick}>
              <Upload size={14} /> Ajouter au dossier
            </button>
            {!patient && <div className="docs-pro-hint">Selectionnez un patient pour uploader un document</div>}
          </div>
        </section>

        {/* QR Card */}
        <section className="docs-pro-card">
          <div className="docs-pro-card__header">
            <div className="docs-pro-card__header-left">
              <QrCode size={16} />
              <h3>QR upload telephone</h3>
            </div>
          </div>
          <div className="docs-pro-card__body">
            <div className="docs-pro-qr">
              {patient && uploadReady ? (
                <img src={`${apiBase}/api/patients/${patient.id}/qr?v=${qrNonce}`} alt="QR patient" />
              ) : (
                <div className="docs-pro-qr__placeholder">
                  <QrCode size={28} />
                  <span>{patient ? setupMessage : "Selectionnez un patient"}</span>
                </div>
              )}
            </div>
            {uploadReady && (
              <div className="docs-pro-qr__url">
                <Link size={12} />
                <span>{qrDebug?.active_url || uploadMode?.active_url || "local"}</span>
              </div>
            )}
            {qrInfo?.url && (
              <a className="docs-pro-qr__link" href={qrInfo.url} target="_blank" rel="noreferrer">{qrInfo.url}</a>
            )}
            <div className="docs-pro-qr__actions">
              <button className="docs-pro-pill-btn" disabled={!patient || !uploadReady} onClick={refreshQrLink}>
                <QrCode size={13} /> Nouveau QR 15 min
              </button>
              <button className="docs-pro-pill-btn" disabled={!patient || !uploadReady} onClick={testQrLink}>
                <Eye size={13} /> Test QR Link
              </button>
            </div>
            {qrDebug && (
              <div className="docs-pro-qr__debug">
                <span className={qrDebug.mobile_route_ok ? "is-ok" : "is-error"}>Mobile: {qrDebug.mobile_route_ok ? "OK" : "Erreur"}</span>
                <span className={qrDebug.upload_route_ok ? "is-ok" : "is-error"}>Upload: {qrDebug.upload_route_ok ? "OK" : "Erreur"}</span>
              </div>
            )}
            {patient && (
              <div className="docs-pro-qr__reports">
                <a href={`${apiBase}/api/patients/${patient.id}/cardiology-report/pdf`} target="_blank" rel="noreferrer">
                  <FileText size={13} /> Compte rendu
                </a>
                <a href={`${apiBase}/api/patients/${patient.id}/hospitalization-letter/pdf`} target="_blank" rel="noreferrer">
                  <FileText size={13} /> Lettre hospit.
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Preview Card */}
        <section className="docs-pro-card docs-pro-card--preview">
          <div className="docs-pro-card__header">
            <div className="docs-pro-card__header-left">
              <Eye size={16} />
              <h3>Apercu</h3>
            </div>
            {selectedDoc && (
              <div className="docs-pro-card__header-right">
                <span className="docs-pro-tag">{selectedDoc.type_document}</span>
              </div>
            )}
          </div>
          <div className="docs-pro-card__body">
            {preview()}
            {selectedDoc && <DocumentNoteEditor doc={selectedDoc} onSave={onSaveNotes} />}
          </div>
        </section>

        {/* AI Analysis Card */}
        <section className="docs-pro-card docs-pro-card--ai">
          <div className="docs-pro-card__header">
            <div className="docs-pro-card__header-left">
              <Bot size={16} />
              <h3>Analyse IA document</h3>
              {selectedAnalysis && (
                <span className={`docs-pro-risk docs-pro-risk--${selectedAnalysis.risk_level || "n-a"}`}>
                  {selectedAnalysis.risk_level || "n/a"}
                </span>
              )}
            </div>
          </div>
          <div className="docs-pro-card__body">
            <div className="docs-pro-ai-meta">
              <span className="docs-pro-ai-badge">Modele: <strong>{aiModel}</strong></span>
              <span className="docs-pro-ai-badge">Mode: <strong>{aiAnalysisMode}</strong></span>
              {cloudSub ? (
                <span className={`docs-pro-ai-badge ${cloudSub.remaining_credits < 5 ? "docs-pro-ai-badge--warn" : ""}`}>
                  Credits: <strong>{cloudSub.unlimited ? "illim." : (cloudSub.remaining_credits || 0)}</strong>
                </span>
              ) : cloudConfigured ? (
                <span className="docs-pro-ai-badge">Cloud credits</span>
              ) : null}
              {aiUnavailable && <span className="docs-pro-ai-badge docs-pro-ai-badge--warn">IA indisponible</span>}
            </div>
            <div className="ai-pro-safety" style={{ marginBottom: 12, fontSize: 12, padding: "8px 12px", background: "#fef2f2", border: "1px solid #fee2e2", borderRadius: 8, color: "#991b1b", display: "flex", alignItems: "center", gap: 8 }}>
              <AlertTriangle size={14} />
              <span>{AI_DECISION_SUPPORT_WARNING}</span>
            </div>
            {consentRequired && (
              <label className="docs-pro-consent">
                <input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} />
                <span>Consentement patient pour analyse IA externe</span>
              </label>
            )}
            <div className="docs-pro-ai-actions">
              <button className="docs-pro-gen-btn" disabled={!canSendToAi || aiLoadingDocId === selectedDoc?.id} onClick={() => runAiAnalysis(selectedDoc, consentConfirmed, false)}>
                <Bot size={14} /> Analyser par IA
              </button>
              <button className="docs-pro-pill-btn" disabled={!canSendToAi || aiLoadingDocId === selectedDoc?.id} onClick={() => runAiAnalysis(selectedDoc, consentConfirmed, true)}>
                <RefreshCw size={14} /> Re-analyser
              </button>
            </div>
            {aiLoadingDocId && <div className="docs-pro-status docs-pro-status--loading">Analyse IA en cours...</div>}
            {aiError && <div className="docs-pro-status docs-pro-status--error">{aiError}</div>}
            {aiMessage && <div className="docs-pro-status docs-pro-status--ok">{aiMessage}</div>}

            {!selectedAnalysis ? (
              <div className="docs-pro-empty">
                <Bot size={20} />
                <span>Aucune analyse IA pour ce document</span>
              </div>
            ) : (
              <div className="docs-pro-ai-grid">
                <section className="docs-pro-ai-section">
                  <div className="docs-pro-ai-section__meta">
                    <span>Type: <strong>{selectedAnalysis.document_type || selectedPayload.document_type || "n/a"}</strong></span>
                    <span>Status: <strong>{selectedAnalysis.status}</strong></span>
                    <span>Confiance: <strong>{Math.round((selectedAnalysis.confidence || 0) * 100)}%</strong></span>
                  </div>
                  <TextArea compact readOnly={!editingAnalysis} label="Resume medical" value={summaryDraft} onChange={setSummaryDraft} />
                  <div className="docs-pro-ai-section__actions">
                    {editingAnalysis ? (
                      <button className="docs-pro-gen-btn" onClick={saveEditedAnalysis}><Save size={14} /> Enregistrer</button>
                    ) : (
                      <button className="docs-pro-pill-btn" onClick={() => setEditingAnalysis(true)}><Pencil size={14} /> Modifier</button>
                    )}
                    <button className="docs-pro-gen-btn" onClick={acceptAnalysis}><CheckCircle size={14} /> Accepter</button>
                    <button className="docs-pro-pill-btn docs-pro-pill-btn--danger" onClick={rejectAnalysis}><XCircle size={14} /> Rejeter</button>
                  </div>
                </section>

                <section className="docs-pro-ai-section">
                  <div className="docs-pro-ai-section__title"><FlaskConical size={14} /> Valeurs detectees</div>
                  {valuesDraft.length ? (
                    <div className="docs-pro-table-wrap">
                      <table className="docs-pro-table">
                        <thead>
                          <tr><th>Analyte</th><th>Valeur</th><th>Unite</th><th>Reference</th><th>Flag</th></tr>
                        </thead>
                        <tbody>
                          {valuesDraft.map((item, index) => (
                            <tr key={`${item.id || "new"}-${index}`}>
                              <td><input disabled={!editingAnalysis} value={item.analyte} onChange={(event) => updateValue(index, "analyte", event.target.value)} /></td>
                              <td><input disabled={!editingAnalysis} value={item.value} onChange={(event) => updateValue(index, "value", event.target.value)} /></td>
                              <td><input disabled={!editingAnalysis} value={item.unit} onChange={(event) => updateValue(index, "unit", event.target.value)} /></td>
                              <td><input disabled={!editingAnalysis} value={item.reference_range} onChange={(event) => updateValue(index, "reference_range", event.target.value)} /></td>
                              <td><input disabled={!editingAnalysis} value={item.abnormal_flag} onChange={(event) => updateValue(index, "abnormal_flag", event.target.value)} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : <p className="docs-pro-empty-text">Aucune valeur structuree detectee</p>}
                  <div className="docs-pro-ai-section__actions">
                    {editingAnalysis && <button className="docs-pro-pill-btn" onClick={addValueRow}><Plus size={14} /> Valeur</button>}
                    <button className="docs-pro-gen-btn" disabled={!valuesDraft.length} onClick={saveLabs}><Save size={14} /> Enregistrer valeurs</button>
                  </div>
                </section>

                <section className="docs-pro-ai-section">
                  <div className="docs-pro-ai-section__title"><AlertTriangle size={14} /> Points importants</div>
                  {(selectedPayload.possible_abnormalities || []).map((item, index) => (
                    <div key={`a-${index}`} className="docs-pro-alert docs-pro-alert--warn">{item}</div>
                  ))}
                  {(selectedPayload.important_points || []).map((item, index) => (
                    <div key={`p-${index}`} className="docs-pro-alert docs-pro-alert--info">{item}</div>
                  ))}
                  <div className="docs-pro-alert docs-pro-alert--ok">Recommandation: {selectedPayload.recommendation || aiSafetyWarning}</div>
                  {selectedPayload.raw_ocr && (
                    <details className="docs-pro-ocr">
                      <summary>Texte brut OCR</summary>
                      <p>{selectedPayload.raw_ocr}</p>
                    </details>
                  )}
                </section>
              </div>
            )}

            <div className="docs-pro-ai-history">
              <div className="docs-pro-ai-history__title">Historique des analyses</div>
              {aiAnalyses.map((item) => (
                <button key={item.id} className={`docs-pro-ai-history__item ${selectedAnalysis?.id === item.id ? "is-active" : ""}`} onClick={() => setSelectedAnalysisId(item.id)}>
                  <span>{String(item.created_at || "").slice(0, 16)}</span>
                  <span>{item.provider} / {item.status}</span>
                  <span className={`docs-pro-ai-history__risk docs-pro-ai-history__risk--${item.risk_level || "n-a"}`}>{item.risk_level || "n/a"}</span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function DocumentNoteEditor({ doc, onSave }) {
  const [value, setValue] = useState(doc?.notes || "");

  useEffect(() => {
    setValue(doc?.notes || "");
  }, [doc?.id, doc?.notes]);

  return (
    <>
      <TextArea compact label="Notes" value={value} onChange={setValue} />
      <div className="panel-actions panel-actions--tight">
        <button className="btn btn--secondary" onClick={() => onSave(doc.id, value)}><Save size={16} /> Note</button>
        <a href={`${apiBase}/api/documents/${doc.id}`} target="_blank" rel="noreferrer">Ouvrir fichier original</a>
      </div>
    </>
  );
}

function PrescriptionPanel({ patient, onSavePrescription, medications }) {
  const [lines, setLines] = useState([""]);
  const [filter, setFilter] = useState("");
  const filtered = medications.filter((med) => {
    const needle = filter.toLowerCase();
    return !needle || med.name.toLowerCase().includes(needle) || (med.dci || "").toLowerCase().includes(needle);
  });

  function addMedication(med) {
    setLines([...lines.filter(Boolean), `${med.name} - ${med.dosage || med.default_dose || ""}`]);
  }

  return (
    <div className="rx-grid">
      <section className="tool-card">
        <h3><Pill size={16} /> Ordonnance</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {lines.map((line, index) => (
            <input key={index} list="medication-suggestions" value={line} placeholder="Ex: ASPEGIC 100 - 1 sachet/j" onChange={(event) => {
              const next = [...lines];
              next[index] = event.target.value;
              setLines(next);
            }} style={{ padding: "10px 12px", border: "1px solid var(--border-light)", borderRadius: 10, fontSize: 14 }} />
          ))}
        </div>
        <datalist id="medication-suggestions">
          {medications.map((med) => <option key={med.id} value={`${med.name} - ${med.dosage || med.default_dose || ""}`} />)}
        </datalist>
        <div className="panel-actions" style={{ marginTop: 16 }}>
          <button className="btn btn--secondary" onClick={() => setLines([...lines, ""])}><Plus size={16} /> Ligne</button>
          <button className="btn btn--primary" disabled={!patient} onClick={() => onSavePrescription(lines.filter(Boolean))}><Save size={16} /> Enregistrer Ordonnance</button>
        </div>
      </section>
      <section className="tool-card">
        <h3><DatabaseBackup size={16} /> Dataset Medicaments</h3>
        <input value={filter} placeholder="Filtrer medicament..." onChange={(event) => setFilter(event.target.value)} style={{ padding: "10px 12px", border: "1px solid var(--border-light)", borderRadius: 10, fontSize: 14, marginBottom: 12, width: "100%" }} />
        <div className="medicine-list">
          {filtered.map((med) => (
            <button key={med.id} onClick={() => addMedication(med)}>
              <strong>{med.name}</strong>
              <small>{med.dci} / {med.indication || med.class_name}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function AIPanel({ patient, aiWarnings, onCheck, specialityConfig }) {
  const [meds, setMeds] = useState("ASPEGIC 100\nSINTROM");
  const [analyses, setAnalyses] = useState("Creatinine, INR, HbA1c");
  const [settings, setSettings] = useState({});
  const [usage, setUsage] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [cloudSub, setCloudSub] = useState(null);

  useEffect(() => {
    api.aiSettings().then((data) => setSettings(data.settings || {})).catch(() => {});
    api.aiUsage().then((data) => setUsage(data.summary || null)).catch(() => {});
    if (isCloudConfigured()) {
      syncCloudSettingsToBackend().catch(() => {});
      cloudAi.subscription().then(setCloudSub).catch((error) => setChatError(error.message || ""));
    }
  }, []);

  useEffect(() => {
    api.aiConversations(patient?.id || null).then((data) => setHistory(data.rows || [])).catch(() => {});
  }, [patient?.id]);

  async function refreshUsage() {
    try {
      const data = await api.aiUsage();
      setUsage(data.summary || null);
      if (isCloudConfigured()) {
        await syncCloudSettingsToBackend().catch(() => {});
        const sub = await cloudAi.subscription();
        setCloudSub(sub);
      }
    } catch (error) {
      setChatError(error.message);
    }
  }

  async function sendChat(nextMessage = message) {
    const text = nextMessage.trim();
    if (!text) return;
    setBusy(true);
    setChatError("");
    setMessage("");
    setMessages((current) => [...current, { role: "user", content: text, id: `local-${Date.now()}` }]);
    try {
      const analysisMode = settings.AI_ANALYSIS_MODE || "short";
      const payload = {
        message: text,
        conversation_id: conversationId,
        provider: "openrouter",
        model: settings.AI_LOCKED_MODEL || settings.AI_MODEL_NAME || OR_DEFAULT_MODEL_NAME,
        include_patient_context: Boolean(patient?.id),
        analysis_mode: analysisMode,
        ...(specialityConfig?.ai_system_prompt
          ? { system_prompt_prefix: specialityConfig.ai_system_prompt }
          : {}),
      };
      if (isCloudConfigured()) {
        await syncCloudSettingsToBackend().catch(() => {});
      }
      const result = patient?.id ? await api.aiPatientChat(patient.id, payload) : await api.aiChat(payload);
      if (result.use_cloud && isCloudConfigured()) {
        const cloudPayload = result.messages?.length
          ? result.messages
          : `${text}\n\n[CONTEXTE PATIENT]\n${JSON.stringify(result.patient_context || {})}`;
        const cloudResult = await cloudAi.chat(cloudPayload, "chat");
        // On cloud success, we might want to save it locally too, but for now just show it
        setMessages(m => [...m, { role: "assistant", content: cloudResult.content || cloudResult.answer || cloudResult.message || "Analyse cloud terminee." }]);
        refreshUsage();
        if (isCloudConfigured()) cloudAi.subscription().then(setCloudSub).catch(() => {});
        return;
      }
      setConversationId(result.conversation?.id || conversationId);
      setMessages(result.messages || []);
      const conversations = await api.aiConversations(patient?.id || null);
      setHistory(conversations.rows || []);
      refreshUsage();
    } catch (error) {
      setChatError(error.message || "Chat IA indisponible.");
    } finally {
      setBusy(false);
    }
  }

  async function openConversation(id) {
    try {
      const data = await api.aiConversation(id);
      setConversationId(id);
      setMessages(data.messages || []);
    } catch (error) {
      setChatError(error.message);
    }
  }

  const lockedModel = settings.AI_LOCKED_MODEL || settings.AI_MODEL_NAME || OR_DEFAULT_MODEL_NAME;
  const hasLocalKey = settings.AI_OPENROUTER_API_KEY_CONFIGURED === "true";
  const backendCloudReady = settings.CLOUD_AI_CONFIGURED === "true";
  const hasCloud = isCloudConfigured() || backendCloudReady;
  const cloudReady = backendCloudReady || (isCloudConfigured() && cloudAiUsable(cloudSub));
  const disabled = !isSettingEnabled(settings.AI_CHAT_ENABLED ?? "true") || (!hasLocalKey && !cloudReady);
  const usageText = usage
    ? usage.limit_tokens > 0
      ? `${usage.total_tokens}/${usage.limit_tokens} tokens`
      : `${usage.total_tokens} tokens`
    : "0 tokens";
  const quickPrompts = [
    { label: "Synthese", icon: FileText, prompt: "Resume la consultation et les points de vigilance." },
    { label: "Precautions", icon: ShieldCheck, prompt: "Verifie les precautions medicamenteuses pour ce patient." },
    { label: "Biologie", icon: FlaskConical, prompt: "Explique les anomalies biologiques importantes si visibles." },
    { label: "A verifier", icon: AlertTriangle, prompt: "Liste les points cliniques a verifier sans poser de diagnostic final." }
  ];
  const globalPrompt = "Fais une analyse globale prudente du dossier: resume clinique, risques, examens manquants et recommandations a verifier. Ne pose pas de diagnostic final. Reponds court.";

  return (
    <div className="ai-pro-layout">
      <div className="ai-pro-main">
        {/* Header */}
        <header className="ai-pro-header">
          <div className="ai-pro-header__left">
            <div className="ai-pro-avatar">
              <Bot size={22} />
            </div>
            <div>
              <h2>IA clinique</h2>
              <div className="ai-pro-meta">
                <span className={`ai-pro-badge ${disabled ? "is-off" : "is-on"}`}>
                  {disabled ? "Hors ligne" : "En ligne"}
                </span>
                <span className="ai-pro-badge ai-pro-badge--model">{lockedModel}</span>
                <span className="ai-pro-badge ai-pro-badge--mode">{settings.AI_ANALYSIS_MODE || "short"}</span>
                {cloudSub ? (
                   <span className={`ai-pro-badge ${cloudSub.remaining_credits < 5 ? "is-off" : "is-on"}`}>
                     Crأ©dits: {cloudSub.unlimited ? "âˆ‍" : (cloudSub.remaining_credits || 0)}
                   </span>
                ) : hasCloud ? (
                   <span className="ai-pro-badge is-on">Cloud credits</span>
                ) : (
                   <span className="ai-pro-badge ai-pro-badge--usage">{usageText}</span>
                )}
              </div>
            </div>
          </div>
          <div className="ai-pro-header__right">
            <button className="ai-pro-header-btn" disabled={busy} onClick={() => { refreshUsage(); if (isCloudConfigured()) cloudAi.subscription().then(setCloudSub).catch(() => {}); }} title="Rafraichir usage">
              <BarChart3 size={15} />
            </button>
          </div>
        </header>

        {/* Safety */}
        <div className="ai-pro-safety">
          <AlertTriangle size={14} />
          <span>{AI_DECISION_SUPPORT_WARNING}</span>
        </div>

        {/* Patient Context */}
        {patient?.id && (
          <div className="ai-pro-context">
            <UserRound size={14} />
            <span>Contexte actif: <strong>{fullname(patient)}</strong></span>
            <span className="ai-pro-context__hint">Constantes, labs, ECG et documents valides inclus automatiquement</span>
          </div>
        )}

        {/* Disabled Banner */}
        {disabled && (
          <div className="ai-pro-banner ai-pro-banner--warning">
            <AlertTriangle size={16} />
            <span>Analyse IA indisponible. Activez les credits IA Cloud avec Doctor ID/Secret, ou configurez une cle OpenRouter locale.</span>
          </div>
        )}

        {/* Quick Actions */}
        <div className="ai-pro-actions">
          <button className="ai-pro-pill-btn ai-pro-pill-btn--primary" disabled={busy || disabled} onClick={() => sendChat(globalPrompt)}>
            <Sparkles size={14} /> Analyse globale
          </button>
          {quickPrompts.map((item) => {
            const Icon = item.icon;
            return (
            <button key={item.label} className="ai-pro-pill-btn" disabled={busy || disabled} onClick={() => sendChat(item.prompt)}>
              <Icon size={14} /> {item.label}
            </button>
            );
          })}
        </div>

        {/* Chat */}
        <div className="ai-pro-chat">
          {!messages.length && (
            <div className="ai-pro-chat__empty">
              <div className="ai-pro-chat__empty-icon"><Bot size={32} /></div>
              <strong>Conversation clinique</strong>
              <span>{patient?.id ? fullname(patient) : "Aucun patient selectionne"}</span>
            </div>
          )}
          <div className="ai-pro-messages">
            {messages.map((item, idx) => (
              <div key={item.id || `${item.role}-${idx}`} className={`ai-pro-msg ai-pro-msg--${item.role}`}>
                <div className="ai-pro-msg__avatar">
                  {item.role === "assistant" ? <Bot size={14} /> : <Stethoscope size={14} />}
                </div>
                <div className="ai-pro-msg__body">
                  <div className="ai-pro-msg__label">{item.role === "assistant" ? "Assistant IA" : "Vous"}</div>
                  <div className="ai-pro-msg__text">{item.content}</div>
                </div>
              </div>
            ))}
            {busy && (
              <div className="ai-pro-msg ai-pro-msg--assistant">
                <div className="ai-pro-msg__avatar"><Bot size={14} /></div>
                <div className="ai-pro-msg__body">
                  <div className="ai-pro-typing"><span /><span /><span /></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input */}
        <div className="ai-pro-input">
          <textarea
            value={message}
            placeholder="Question clinique, synthese, precautions..."
            onChange={(event) => setMessage(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
                event.preventDefault();
                sendChat();
              }
            }}
          />
          <button className="ai-pro-send" disabled={busy || disabled || !message.trim()} onClick={() => sendChat()}>
            <Bot size={16} />
          </button>
        </div>
        {chatError && <div className="ai-pro-error">{chatError}</div>}
      </div>

      {/* Side Stack */}
      <aside className="ai-pro-side">
        {/* Security Card */}
        <div className="ai-pro-card">
          <div className="ai-pro-card__header">
            <ShieldCheck size={16} />
            <h3>Securite ordonnance</h3>
          </div>
          <div className="ai-pro-card__body">
            <TextArea compact label="Medicaments a controler" value={meds} onChange={setMeds} />
            <TextArea compact label="Analyses / contexte" value={analyses} onChange={setAnalyses} />
            <button className="btn btn--primary btn--sm" disabled={!patient} onClick={() => onCheck(meds.split("\n").filter(Boolean), analyses)}>
              <ShieldCheck size={14} /> Verifier interactions
            </button>
            {(aiWarnings?.warnings || aiWarnings?.alerts || []).map((warning, index) => (
              <div key={index} className={`ai-pro-alert ai-pro-alert--${warning.level || "info"}`}>
                <AlertTriangle size={13} />
                <span>{warning.message || warning}</span>
              </div>
            ))}
          </div>
        </div>

        {/* History Card */}
        <div className="ai-pro-card">
          <div className="ai-pro-card__header">
            <Clock size={16} />
            <h3>Conversations</h3>
            <span className="ai-pro-card__count">{history.length}</span>
          </div>
          <div className="ai-pro-card__body">
            <div className="ai-pro-history">
              {history.map((item) => (
                <button key={item.id} className={`ai-pro-history__item ${conversationId === item.id ? "is-active" : ""}`} onClick={() => openConversation(item.id)}>
                  <div className="ai-pro-history__title">{item.title}</div>
                  <div className="ai-pro-history__meta">{String(item.updated_at || "").slice(0, 16).replace("T", " ")} آ· {item.provider}</div>
                </button>
              ))}
              {!history.length && <p className="ai-pro-empty">Aucune conversation</p>}
            </div>
          </div>
        </div>

        {/* Summary Card */}
        <div className="ai-pro-card">
          <div className="ai-pro-card__header">
            <FileText size={16} />
            <h3>Resume IA</h3>
          </div>
          <div className="ai-pro-card__body">
            <p className="ai-pro-summary">{aiWarnings?.summary || "Le resume apparait apres verification."}</p>
            {(aiWarnings?.recommendations || aiWarnings?.suggestions || []).map((item, index) => (
              <div key={index} className="ai-pro-alert ai-pro-alert--info"><span>{item}</span></div>
            ))}
            {aiWarnings?.overall_risk && (
              <div className={`ai-pro-alert ai-pro-alert--${aiWarnings.overall_risk === "high" ? "danger" : aiWarnings.overall_risk === "moderate" ? "warning" : "ok"}`}>
                <ShieldCheck size={13} /> Risque global: <strong>{aiWarnings.overall_risk}</strong>
              </div>
            )}
            {aiWarnings?.disclaimer && <div className="ai-pro-alert ai-pro-alert--info">{aiWarnings.disclaimer}</div>}
          </div>
        </div>
      </aside>
    </div>
  );
}

function SettingsPanel({ uploadMode, onRefreshMode }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uploadMode) return;
    const ts = uploadMode.tunnel?.status;
    if (ts === "starting" || ts === "running") {
      const t = setInterval(() => onRefreshMode(), ts === "starting" ? 2000 : 8000);
      return () => clearInterval(t);
    }
  }, [uploadMode?.tunnel?.status]);

  async function startTunnel() {
    setBusy(true);
    try { await api.tunnelStart(); } catch (e) { /* handled by status poll */ }
    setTimeout(() => { onRefreshMode(); setBusy(false); }, 1500);
  }

  async function stopTunnel() {
    setBusy(true);
    try { await api.tunnelStop(); } catch (e) { /* */ }
    setTimeout(() => { onRefreshMode(); setBusy(false); }, 500);
  }

  const mode = uploadMode?.mode || "local";
  const tunnel = uploadMode?.tunnel || {};
  const isRemote = uploadMode?.mode === "remote" && Boolean(uploadMode?.remote_url);
  const isStarting = tunnel.status === "starting";

  return (
    <div className="settings-grid settings-qr-grid">
      <section className="tool-card settings-card settings-card--qr">
        <h3><Smartphone size={16} /> Mode Upload QR</h3>

        <div className={`tunnel-status ${isRemote ? "tunnel-status--ok" : "tunnel-status--local"}`}>
          {isRemote ? <Globe size={16} /> : <Wifi size={16} />}
          <div>
            <strong>{isRemote ? "Upload internet pret" : "Upload local pret"}</strong>
            <span style={{ display: "block", fontSize: 12, fontWeight: 400, marginTop: 2 }}>
              {isRemote
                ? `Les telephones peuvent envoyer via ${uploadMode?.active_url}`
                : `Les telephones sur le meme Wi-Fi peuvent envoyer via ${uploadMode?.active_url || uploadMode?.local_url || ""}`}
            </span>
          </div>
        </div>

        <div className="mode-cards">
          <div className={`mode-card ${!isRemote ? "mode-card--active" : ""}`}>
            <Wifi size={20} />
            <strong>Mode local</strong>
            <p>QR direct vers ce PC pour les telephones connectes au meme reseau Wi-Fi.</p>
            {isRemote && <button className="btn btn--secondary" disabled={busy} onClick={stopTunnel}>Utiliser mode local</button>}
            {!isRemote && !isStarting && <span className="mode-badge">Actif</span>}
          </div>
          <div className={`mode-card ${isRemote ? "mode-card--active" : ""}`}>
            <Globe size={20} />
            <strong>Cloudflare permanent</strong>
            <p>N'importe quel telephone, Wi-Fi ou localisation apres configuration DNS.</p>
            {!isRemote && !isStarting && uploadMode?.cloudflared_available && (
              <button className="btn btn--primary" disabled={busy} onClick={startTunnel}><Globe size={14} /> Activer upload distant</button>
            )}
            {!isRemote && !isStarting && !uploadMode?.cloudflared_available && (
              <span className="mode-badge mode-badge--warn">cloudflared.exe manquant</span>
            )}
            {isStarting && <span className="mode-badge mode-badge--starting">Demarrage...</span>}
            {isRemote && <span className="mode-badge">Actif</span>}
          </div>
        </div>

        {tunnel.error && (
          <div className="tunnel-status tunnel-status--warn">
            <XCircle size={16} />
            <div>
              <span>{tunnel.error}</span>
              <button className="btn btn--secondary" style={{ marginLeft: 10, fontSize: 11, padding: "3px 10px" }} disabled={busy} onClick={startTunnel}>Reessayer</button>
            </div>
          </div>
        )}
        {tunnel.restart_count > 0 && tunnel.status !== "error" && (
          <div className="tunnel-status tunnel-status--local">
            <Wifi size={14} /> <span>Reconnexion automatique ({tunnel.restart_count}/3)...</span>
          </div>
        )}
      </section>

      <section className="tool-card settings-card settings-card--technical">
        <h3><Settings size={16} /> Informations techniques</h3>
        <table className="info-table">
          <tbody>
            <tr><td>IP locale</td><td><code>{uploadMode?.lan_ip || "..."}</code></td></tr>
            <tr><td>URL locale</td><td><code>{uploadMode?.local_url || "..."}</code></td></tr>
            <tr><td>Mode actif</td><td><strong>{mode}</strong></td></tr>
            <tr><td>Tunnel</td><td>{tunnel.status} {tunnel.url && <code>{tunnel.url}</code>}</td></tr>
            <tr><td>cloudflared</td><td>{uploadMode?.cloudflared_available ? <><CheckCircle size={13} /> Installe</> : <><XCircle size={13} /> Non trouve</>}</td></tr>
            {tunnel.binary_path && <tr><td>Executable</td><td><code>{tunnel.binary_path}</code></td></tr>}
            <tr><td>URL QR active</td><td><code>{uploadMode?.active_url || "..."}</code></td></tr>
          </tbody>
        </table>
        {!uploadMode?.cloudflared_available && (
          <p style={{ fontSize: 12, color: "#92400e", background: "var(--warning-light)", padding: 10, borderRadius: "var(--radius-sm)", border: "1px solid #fcd34d", marginTop: 8 }}>
            <AlertTriangle size={13} style={{ verticalAlign: "middle" }} /> Pour le mode internet, placez <code>cloudflared.exe</code> dans le dossier <code>bin/</code>.
            <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/" target="_blank" rel="noreferrer">Telecharger</a>
          </p>
        )}
      </section>
    </div>
  );
}

// =====================================================================
// BMI / ANTHROPOMETRY PANEL
// =====================================================================
function BMIPanel({ patient }) {
  const [form, setForm] = useState({ measured_at: new Date().toISOString().slice(0, 16), weight_kg: "", height_cm: "", waist_circumference_cm: "", notes: "" });
  const [records, setRecords] = useState([]);
  const [result, setResult] = useState(null);
  const update = (key, value) => setForm((c) => ({ ...c, [key]: value }));

  useEffect(() => { if (patient?.id) loadRecords(); }, [patient?.id]);

  async function loadRecords() {
    try { const data = await api.getAnthropometry(patient.id); setRecords(data.rows || []); } catch (e) { /* */ }
  }

  async function submit() {
    if (!patient?.id) return;
    const payload = {
      measured_at: form.measured_at.replace("T", " "),
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      waist_circumference_cm: form.waist_circumference_cm ? Number(form.waist_circumference_cm) : null,
      notes: form.notes
    };
    const res = await api.addAnthropometry(patient.id, payload);
    setResult(res);
    loadRecords();
    setForm((c) => ({ ...c, weight_kg: "", waist_circumference_cm: "", notes: "" }));
  }

  const bmiColor = (cat) => cat === "Obesite" ? "#dc2626" : cat === "Surpoids" ? "#d97706" : cat === "Insuffisance ponderale" ? "#2563eb" : "#16a34a";

  return (
    <div className="vitals-grid">
      <section className="tool-card">
        <h3><Scale size={16} /> Mesures anthropometriques</h3>
        <div className="compact-form-grid">
          <Field label="Date" type="datetime-local" value={String(form.measured_at || "").replace(" ", "T").slice(0, 16)} onChange={(v) => update("measured_at", v)} />
          <Field label="Poids (kg)" value={form.weight_kg} onChange={(v) => update("weight_kg", v)} />
          <Field label="Taille (cm)" value={form.height_cm} onChange={(v) => update("height_cm", v)} />
          <Field label="Tour de taille (cm)" value={form.waist_circumference_cm} onChange={(v) => update("waist_circumference_cm", v)} />
        </div>
        <TextArea compact label="Notes" value={form.notes} onChange={(v) => update("notes", v)} />
        <button className="btn btn--primary" disabled={!patient} onClick={submit}><Save size={16} /> Enregistrer mesures</button>
        {result && (
          <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: "var(--bg)", border: "1px solid var(--border)" }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: bmiColor(result.bmi_category) }}>{result.bmi ?? "--"}</div>
                <div style={{ fontSize: 12, fontWeight: 600, color: bmiColor(result.bmi_category) }}>{result.bmi_category || "N/A"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>IMC</div>
              </div>
              {result.waist_risk && (
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: result.waist_risk === "Risque eleve" ? "#dc2626" : "#16a34a" }}>{result.waist_risk}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Risque abdominal</div>
                </div>
              )}
            </div>
          </div>
        )}
      </section>
      <section className="tool-card">
        <h3>Evolution IMC</h3>
        <LineChart rows={records} fields={[{ key: "bmi", color: "#2563eb" }, { key: "weight_kg", color: "#16a34a" }]} />
      </section>
      <section className="tool-card document-list">
        <h3>Historique mesures</h3>
        {records.slice(0, 15).map((r) => (
          <div key={r.id} className={`mini-row ${r.bmi_category === "Obesite" ? "is-urgent" : ""}`}>
            <strong>{String(r.measured_at || "").slice(0, 16)} - IMC: {r.bmi ?? "--"} ({r.bmi_category || ""})</strong>
            <span>{r.weight_kg || "--"} kg | {r.height_cm || "--"} cm | Taille: {r.waist_circumference_cm || "--"} cm ({r.waist_risk || ""})</span>
          </div>
        ))}
        {!records.length && <p className="empty-note">Aucune mesure</p>}
      </section>
    </div>
  );
}


// =====================================================================
// MEDICINE DATABASE PANEL
// =====================================================================
function MedicineDatabasePanel() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState(null);
  const [sourceFilter, setSourceFilter] = useState("all");

  useEffect(() => { api.medicinesStats().then(setStats).catch(() => {}); }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(() => { api.searchMedicines(query).then((d) => setResults(d.rows || [])).catch(() => {}); }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const filteredResults = sourceFilter === "all"
    ? results
    : results.filter((item) => (item.source || "").toLowerCase() === sourceFilter);

  const statCards = [
    { label: "Medicaments en base", value: stats?.total || 0 },
    { label: "Sources actives", value: stats?.by_source?.length || 0 },
    { label: "Derniere sync", value: stats?.last_sync ? String(stats.last_sync).slice(0, 16).replace("T", " ") : "jamais" },
  ];

  const quickSearches = [
    "bisoprolol",
    "amlodipine",
    "xarelto",
    "tahor",
    "entresto",
    "glucophage",
  ];

  return (
    <div className="med-db-shell">
      <section className="tool-card med-db-hero">
        <div className="med-db-hero__copy">
          <h3><BookOpen size={16} /> Base medicaments</h3>
          <p>Recherche rapide, lecture claire des precautions et meilleure preparation des ordonnances pour le cabinet.</p>
        </div>
        <div className="med-db-stat-row">
          {statCards.map((card) => (
            <div key={card.label} className="med-db-stat">
              <span>{card.label}</span>
              <strong>{card.value}</strong>
            </div>
          ))}
        </div>
      </section>

      <div className="med-db-toolbar">
        <div className="searchbox med-db-searchbox">
          <Search size={15} />
          <input value={query} placeholder="Rechercher par nom, DCI, substance, indication..." onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="med-db-filters">
          <button className={sourceFilter === "all" ? "filter-chip is-active" : "filter-chip"} onClick={() => setSourceFilter("all")}>Tout</button>
          {(stats?.by_source || []).map((item) => (
            <button
              key={item.source}
              className={sourceFilter === item.source ? "filter-chip is-active" : "filter-chip"}
              onClick={() => setSourceFilter(item.source)}
            >
              {item.source} ({item.count})
            </button>
          ))}
        </div>
        <div className="med-db-quick-searches">
          {quickSearches.map((item) => (
            <button key={item} className="btn btn--secondary" onClick={() => setQuery(item)}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="med-db-grid">
        <section className="tool-card">
          <h3><Search size={16} /> Resultats</h3>
          <div className="medicine-list medicine-list--rich">
            {filteredResults.map((med) => (
              <button key={med.id} className={selected?.id === med.id ? "is-active-doc" : ""} onClick={() => api.getMedicine(med.id).then((d) => setSelected(d.medicine)).catch(() => {})}>
                <div className="medicine-list__row">
                  <strong>{med.brand_name}</strong>
                  <span className="badge badge--info">{med.source || "local"}</span>
                </div>
                <small>{med.dci || "DCI non renseignee"} | {med.form || "-"} {med.dosage_strength || ""}</small>
                <small>{med.route || "voie non renseignee"} {med.laboratory ? `| ${med.laboratory}` : ""}</small>
              </button>
            ))}
            {query.length >= 2 && !filteredResults.length && <p className="empty-note">Aucun resultat pour cette recherche.</p>}
            {query.length < 2 && <p className="empty-note">Commencez par deux lettres pour afficher des resultats.</p>}
          </div>
        </section>

        <section className="tool-card">
          <h3><ClipboardList size={16} /> Fiche medicament</h3>
          {selected ? (
            <div className="medicine-detail">
              <div className="medicine-detail__header">
                <div>
                  <strong>{selected.brand_name}</strong>
                  <span>{selected.dci || selected.active_substance || "DCI non renseignee"}</span>
                </div>
                <span className="badge badge--info">{selected.source || "local"}</span>
              </div>
              <div className="medicine-detail__grid">
                <div><span>Forme</span><strong>{selected.form || "-"}</strong></div>
                <div><span>Dosage</span><strong>{selected.dosage_strength || "-"}</strong></div>
                <div><span>Voie</span><strong>{selected.route || "-"}</strong></div>
                <div><span>CIS</span><strong>{selected.cis_code || "-"}</strong></div>
              </div>
              <div className="medicine-detail__section">
                <span>Indications</span>
                <p>{selected.indications || "Non renseigne"}</p>
              </div>
              <div className="medicine-detail__columns">
                <div className="medicine-detail__section">
                  <span>Contre-indications</span>
                  <p>{selected.contraindications || "Non renseigne"}</p>
                </div>
                <div className="medicine-detail__section">
                  <span>Interactions</span>
                  <p>{selected.interactions || "Non renseigne"}</p>
                </div>
              </div>
              <div className="medicine-detail__columns">
                <div className="medicine-detail__section">
                  <span>Grossesse / allaitement</span>
                  <p>{selected.pregnancy_warnings || selected.breastfeeding_warnings || "Non renseigne"}</p>
                </div>
                <div className="medicine-detail__section">
                  <span>Precautions renales / hepatiques</span>
                  <p>{selected.renal_precautions || selected.hepatic_precautions || "Non renseigne"}</p>
                </div>
              </div>
              {selected.rcp_link && <a href={selected.rcp_link} target="_blank" rel="noreferrer">Voir le RCP</a>}
            </div>
          ) : <p className="empty-note">Selectionnez un medicament pour afficher une fiche claire et exploitable.</p>}
        </section>
      </div>
    </div>
  );
}


// =====================================================================
// PRESCRIPTION WORKFLOW PANEL
// =====================================================================
function PrescriptionWorkflowPanel({ patient }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [previewId, setPreviewId] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => { api.prescriptionTemplates().then((d) => setTemplates(d.rows || [])).catch(() => {}); }, []);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => api.searchMedicines(search).then((d) => setSearchResults(d.rows || [])).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [search]);

  function addMedicine(med) {
    setItems([...items, { medicine_id: med.id, medicine_name: med.brand_name, dci: med.dci, dosage: med.dosage_strength || "", frequency: "", duration: "", instructions: "", quantity: "", renewable: false, is_free_text: false }]);
    setSearch(""); setSearchResults([]);
  }

  function addFreeText() {
    setItems([...items, { medicine_name: "", dci: "", dosage: "", frequency: "", duration: "", instructions: "", quantity: "", renewable: false, is_free_text: true }]);
  }

  function loadTemplate(tmpl) {
    const newItems = (tmpl.items || []).map((it) => ({ ...it, medicine_id: null, quantity: "", renewable: false, is_free_text: false }));
    setItems(newItems);
  }

  function updateItem(idx, key, val) {
    setItems(items.map((item, i) => i === idx ? { ...item, [key]: val } : item));
  }

  function removeItem(idx) {
    setItems(items.filter((_, i) => i !== idx));
  }

  async function submit(validated = false) {
    if (!patient?.id || !items.length) return;
    try {
      const result = await api.createPrescriptionWorkflow({ patient_id: patient.id, items, doctor_validated: validated });
      setWarnings(result.warnings || []);
      setPreviewId(result.id || null);
      setSaveMessage(validated ? "Ordonnance prete a etre relue avant impression." : "Brouillon enregistre. Verifiez l'apercu avant impression.");
    } catch (e) {
      setWarnings([{ level: "danger", message: e.message }]);
      setSaveMessage("");
    }
  }

  return (
    <div className="rx-pro-layout">
      {/* Left: Editor */}
      <div className="rx-pro-main">
        <section className="rx-pro-card">
          <div className="rx-pro-card__header">
            <div className="rx-pro-card__header-left">
              <ClipboardPlus size={16} />
              <h3>Ordonnance Pro</h3>
            </div>
          </div>
          <div className="rx-pro-card__body">
            {/* Templates */}
            {templates.length > 0 && (
              <div className="rx-pro-templates">
                {templates.map((t) => (
                  <button key={t.id} className="rx-pro-template-pill" onClick={() => loadTemplate(t)}>
                    {t.name}
                  </button>
                ))}
              </div>
            )}

            {/* Medication Items */}
            <div className="rx-pro-items">
              {items.map((item, idx) => (
                <div key={idx} className={`rx-pro-item ${item.is_free_text ? "is-free-text" : ""}`}>
                  <div className="rx-pro-item__fields">
                    <input
                      className="rx-pro-item__name"
                      value={item.medicine_name}
                      placeholder={item.is_free_text ? "Texte libre..." : "Medicament"}
                      onChange={(e) => updateItem(idx, "medicine_name", e.target.value)}
                    />
                    <input value={item.dosage} placeholder="Dosage" onChange={(e) => updateItem(idx, "dosage", e.target.value)} />
                    <input value={item.frequency} placeholder="Posologie" onChange={(e) => updateItem(idx, "frequency", e.target.value)} />
                    <input value={item.duration} placeholder="Duree" onChange={(e) => updateItem(idx, "duration", e.target.value)} />
                    <input
                      className="rx-pro-item__instructions"
                      value={item.instructions || ""}
                      placeholder="Instructions"
                      onChange={(e) => updateItem(idx, "instructions", e.target.value)}
                    />
                  </div>
                  <button className="rx-pro-item__remove" onClick={() => removeItem(idx)} title="Supprimer">
                    <X size={14} />
                  </button>
                </div>
              ))}
              {!items.length && (
                <div className="rx-pro-empty-items">
                  <Pill size={20} />
                  <span>Aucun medicament ajoute</span>
                </div>
              )}
            </div>

            {/* Search + Add */}
            <div className="rx-pro-add-row">
              <div className="rx-pro-search">
                <Search size={14} />
                <input
                  value={search}
                  placeholder="Ajouter medicament..."
                  onChange={(e) => setSearch(e.target.value)}
                />
                {searchResults.length > 0 && (
                  <div className="rx-pro-search__dropdown">
                    {searchResults.map((med) => (
                      <button key={med.id} onClick={() => addMedicine(med)}>
                        <strong>{med.brand_name}</strong>
                        <span>{med.dci} | {med.dosage_strength}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="rx-pro-pill-btn" onClick={addFreeText}>
                <Plus size={13} /> Texte libre
              </button>
            </div>

            {/* Actions */}
            <div className="rx-pro-actions">
              <button className="rx-pro-pill-btn rx-pro-pill-btn--secondary" onClick={() => submit(false)}>
                <Save size={14} /> Sauvegarder brouillon
              </button>
              <button className="rx-pro-gen-btn" disabled={!patient || !items.length} onClick={() => submit(true)}>
                <ShieldCheck size={14} /> Generer l'ordonnance
              </button>
            </div>

            {saveMessage && <div className="rx-pro-status">{saveMessage}</div>}
          </div>
        </section>
      </div>

      {/* Right: Preview */}
      <aside className="rx-pro-preview">
        <section className="rx-pro-card rx-pro-card--preview">
          <div className="rx-pro-card__header">
            <div className="rx-pro-card__header-left">
              <Eye size={16} />
              <h3>Apercu avant impression</h3>
            </div>
          </div>
          <div className="rx-pro-card__body">
            {warnings.map((w, i) => (
              <div key={i} className={`rx-pro-alert rx-pro-alert--${w.level}`}>{w.message}</div>
            ))}
            {previewId ? (
              <div className="rx-pro-preview__content">
                <div className="rx-pro-preview__actions">
                  <a className="rx-pro-link" href={api.prescriptionPreview(previewId)} target="_blank" rel="noreferrer">Apercu</a>
                  <a className="rx-pro-link rx-pro-link--primary" href={api.prescriptionPreview(previewId)} target="_blank" rel="noreferrer">Imprimer</a>
                  <a className="rx-pro-link" href={api.prescriptionPdf(previewId)} target="_blank" rel="noreferrer">PDF</a>
                </div>
                <iframe title="Apercu ordonnance" className="rx-pro-iframe" src={api.prescriptionPreview(previewId)} />
              </div>
            ) : (
              <div className="rx-pro-preview__empty">
                <Eye size={24} />
                <span>L'ordonnance apparaitra ici avant impression.</span>
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}


// =====================================================================
// DOCUMENT TEMPLATES PANEL â€” Word-like Editor
// =====================================================================
function DocumentTemplatesPanel({ patient }) {
  const [header, setHeader] = useState(() => { try { return JSON.parse(localStorage.getItem("ms_clinic_header") || "{}"); } catch { return {}; } });
  const [showHeaderEditor, setShowHeaderEditor] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("ordonnance");
  const [generatedDocs, setGeneratedDocs] = useState([]);
  const [saveMsg, setSaveMsg] = useState("");
  const editorRef = useRef(null);

  useEffect(() => { loadTemplates(); }, []);
  useEffect(() => { if (patient?.id) loadGeneratedDocs(); }, [patient?.id]);
  useEffect(() => {
    if (selected && editorRef.current) {
      editorRef.current.innerHTML = selected.body_html || "<p>Saisissez le contenu ici...</p>";
    }
  }, [selected?.id]);

  async function loadTemplates() { try { const d = await api.documentTemplates(); setTemplates(d.rows || []); } catch {} }
  async function loadGeneratedDocs() { if (!patient?.id) return; try { const d = await api.patientGeneratedDocuments(patient.id); setGeneratedDocs(d.rows || []); } catch {} }

  function saveHeader(h) { setHeader(h); localStorage.setItem("ms_clinic_header", JSON.stringify(h)); }
  function handleLogo(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader(); r.onload = ev => saveHeader({ ...header, logo: ev.target.result }); r.readAsDataURL(file);
  }
  function exec(cmd, val = null) { editorRef.current?.focus(); document.execCommand(cmd, false, val); }

  function selectTmpl(tmpl) { setSelected(tmpl); setEditName(tmpl.name); setEditCategory(tmpl.category); }

  async function saveTemplate() {
    if (!selected || !editorRef.current) return;
    await api.updateDocumentTemplate(selected.id, { name: editName, category: editCategory, body_html: editorRef.current.innerHTML });
    setSaveMsg("Modأ¨le enregistrأ© âœ“"); setTimeout(() => setSaveMsg(""), 2500); loadTemplates();
  }
  async function newTemplate() {
    const name = prompt("Nom du nouveau modأ¨le ?"); if (!name) return;
    const tmpl = await api.createDocumentTemplate({ name, category: editCategory, body_html: "<p></p>" });
    await loadTemplates(); if (tmpl?.id) selectTmpl({ ...tmpl, name, category: editCategory, body_html: "<p></p>" });
  }
  async function dupTemplate() { if (!selected) return; await api.duplicateDocumentTemplate(selected.id); loadTemplates(); }

  function buildPrintHtml(withPatient = false) {
    const content = editorRef.current?.innerHTML || "";
    const today = new Date().toLocaleDateString("fr-DZ");
    const pName = patient ? `${patient.prenom || ""} ${patient.nom || ""}`.trim() : "";
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Ordonnance</title><style>
@page{size:A4;margin:15mm 20mm}*{box-sizing:border-box;font-family:'Times New Roman',serif}body{margin:0}
.hdr{display:flex;align-items:flex-start;gap:14px;border-bottom:2px solid #1e40af;padding-bottom:10px;margin-bottom:18px}
.hdr img{max-height:80px;max-width:90px;object-fit:contain}.hdr-info{flex:1}.hdr-info h1{margin:0;font-size:18px;color:#1e40af}
.hdr-info .sp{font-size:13px;color:#374151;margin:2px 0}.hdr-info .ct{font-size:11px;color:#6b7280;margin-top:4px}
.hdr-date{text-align:right;font-size:11px;color:#6b7280;white-space:nowrap}
.pbar{background:#f1f5f9;border-left:3px solid #1e40af;padding:6px 12px;margin-bottom:14px;font-size:11pt}
.body{min-height:180mm;line-height:1.8;font-size:12pt;color:#1a1a1a}
.ftr{margin-top:30px;display:flex;justify-content:space-between;border-top:1px solid #e5e7eb;padding-top:10px;font-size:10pt;color:#6b7280}
ul,ol{padding-left:22px;margin:6px 0}hr{border:none;border-top:1px solid #e2e8f0;margin:10px 0}
table{width:100%;border-collapse:collapse;margin:8px 0}td,th{border:1px solid #e2e8f0;padding:5px 9px;font-size:11pt}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="hdr">${header.logo ? `<img src="${header.logo}" alt="logo"/>` : ""}
<div class="hdr-info"><h1>${header.doctor_name || "Dr. Nom Prأ©nom"}</h1>
<div class="sp">${header.specialty || ""}</div>
<div class="ct">${header.address || ""}${header.phone ? " | Tأ©l: " + header.phone : ""}${header.email ? " | " + header.email : ""}</div></div>
<div class="hdr-date">Date: ${today}</div></div>
${withPatient && pName ? `<div class="pbar">Patient : <strong>${pName}</strong></div>` : ""}
<div class="body">${content}</div>
<div class="ftr"><span>${header.address || ""}</span><span>Signature: ___________________</span></div>
</body></html>`;
  }

  function printDoc() {
    const win = window.open("", "_blank");
    win.document.write(buildPrintHtml(true)); win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  }
  async function generateDoc() {
    if (!patient?.id || !selected || !editorRef.current) return;
    const body_html = buildPrintHtml(true);
    await api.generateDocument({ patient_id: patient.id, template_id: selected.id, title: selected.name, variables: {}, body_html });
    loadGeneratedDocs(); setSaveMsg("Document gأ©nأ©rأ© âœ“"); setTimeout(() => setSaveMsg(""), 2500);
  }

  const catColors = { certificat: "#22c55e", ordonnance: "#3b82f6", rapport: "#f59e0b", general: "#64748b" };
  const catLabels = { ordonnance: "Ordonnances", certificat: "Certificats", rapport: "Rapports", general: "Gأ©nأ©raux" };
  const grouped = ["ordonnance", "certificat", "rapport", "general"].reduce((a, c) => { a[c] = templates.filter(t => t.category === c); return a; }, {});

  return (
    <div className="word-editor-layout">
      {/* SIDEBAR */}
      <aside className="word-editor-sidebar">
        <div className="word-editor-sidebar__head">
          <span>Modأ¨les</span>
          <button className="word-editor-new-btn" onClick={newTemplate} title="Nouveau"><Plus size={13} /></button>
        </div>
        <div className="word-editor-sidebar__body">
          {["ordonnance", "certificat", "rapport", "general"].map(cat => {
            const items = grouped[cat]; if (!items.length) return null;
            return (
              <div key={cat} className="word-editor-group">
                <div className="word-editor-group__label" style={{ color: catColors[cat] }}>{catLabels[cat]}</div>
                {items.map(tmpl => (
                  <button key={tmpl.id} className={`word-editor-tmpl ${selected?.id === tmpl.id ? "is-active" : ""}`}
                    style={selected?.id === tmpl.id ? { borderColor: catColors[cat], background: catColors[cat] + "18" } : {}}
                    onClick={() => selectTmpl(tmpl)}>
                    <FileText size={11} />{tmpl.name}
                  </button>
                ))}
              </div>
            );
          })}
          {!templates.length && <p className="word-editor-empty-tip">Aucun modأ¨le. Crأ©ez-en un.</p>}
        </div>
        {generatedDocs.length > 0 && (
          <div className="word-editor-genlist">
            <div className="word-editor-group__label" style={{ color: "#64748b" }}>Documents gأ©nأ©rأ©s</div>
            {generatedDocs.slice(0, 6).map(doc => (
              <div key={doc.id} className="word-editor-genitem">
                <div><span>{doc.title}</span><small>{String(doc.created_at || "").slice(0, 10)}</small></div>
                <a href={api.generatedDocumentPdf(doc.id)} target="_blank" rel="noreferrer" title="PDF"><Download size={11} /></a>
              </div>
            ))}
          </div>
        )}
      </aside>

      {/* MAIN */}
      <div className="word-editor-main">
        {/* Clinic header bar */}
        <div className="word-editor-clinic-bar">
          <div className="word-editor-clinic-preview" onClick={() => setShowHeaderEditor(v => !v)}>
            {header.logo && <img src={header.logo} alt="logo" style={{ height: 34, objectFit: "contain" }} />}
            <div>
              <strong>{header.doctor_name || "Cliquez pour configurer l'en-tأھte du cabinet..."}</strong>
              {header.specialty && <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: 8 }}>{header.specialty}</span>}
            </div>
            <Settings size={13} style={{ marginLeft: "auto", color: "#64748b" }} />
          </div>
          {showHeaderEditor && (
            <div className="word-editor-header-form">
              <div className="word-editor-header-grid">
                <div className="word-editor-header-grid__logo">
                  <span className="word-editor-lbl">Logo cabinet</span>
                  <div className="word-editor-logo-row">
                    {header.logo && <img src={header.logo} alt="logo" style={{ height: 44, objectFit: "contain", borderRadius: 4 }} />}
                    <label className="word-editor-logo-btn"><Upload size={12} /> Charger<input type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} /></label>
                    {header.logo && <button className="word-editor-logo-rm" onClick={() => saveHeader({ ...header, logo: "" })}>âœ•</button>}
                  </div>
                </div>
                {[["doctor_name", "Nom du mأ©decin", "Dr. Prأ©nom Nom"], ["specialty", "Spأ©cialitأ©", "Cardiologue"], ["address", "Adresse cabinet", "12 Rue..."], ["phone", "Tأ©lأ©phone", "0555..."], ["email", "Email", "contact@..."]].map(([k, lbl, ph]) => (
                  <label key={k} className="word-editor-field-lbl">
                    <span className="word-editor-lbl">{lbl}</span>
                    <input value={header[k] || ""} onChange={e => saveHeader({ ...header, [k]: e.target.value })} placeholder={ph} />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {selected ? (
          <>
            {/* Word Toolbar */}
            <div className="word-toolbar">
              <div className="word-toolbar__grp">
                <input className="word-toolbar__name" value={editName} onChange={e => setEditName(e.target.value)} />
                <select className="word-toolbar__select" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                  <option value="ordonnance">Ordonnance</option>
                  <option value="certificat">Certificat</option>
                  <option value="rapport">Rapport</option>
                  <option value="general">Gأ©nأ©ral</option>
                </select>
              </div>
              <div className="word-toolbar__div" />
              <div className="word-toolbar__grp">
                <button title="Gras (Ctrl+B)" onMouseDown={e => { e.preventDefault(); exec("bold"); }}><Bold size={13} /></button>
                <button title="Italique (Ctrl+I)" onMouseDown={e => { e.preventDefault(); exec("italic"); }}><Italic size={13} /></button>
                <button title="Soulignأ© (Ctrl+U)" onMouseDown={e => { e.preventDefault(); exec("underline"); }}><Underline size={13} /></button>
                <button title="Barrأ©" onMouseDown={e => { e.preventDefault(); exec("strikeThrough"); }} style={{ fontWeight: 700, textDecoration: "line-through", fontSize: 12 }}>S</button>
              </div>
              <div className="word-toolbar__div" />
              <div className="word-toolbar__grp">
                <select title="Taille du texte" onChange={e => exec("fontSize", e.target.value)} defaultValue="" className="word-toolbar__select">
                  <option value="" disabled>Taille</option>
                  {[["1","8pt"],["2","10pt"],["3","12pt"],["4","14pt"],["5","18pt"],["6","24pt"],["7","36pt"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <input type="color" title="Couleur du texte" onChange={e => exec("foreColor", e.target.value)} className="word-toolbar__color" defaultValue="#000000" />
              </div>
              <div className="word-toolbar__div" />
              <div className="word-toolbar__grp">
                <button title="Gauche" onMouseDown={e => { e.preventDefault(); exec("justifyLeft"); }}><AlignLeft size={13} /></button>
                <button title="Centrer" onMouseDown={e => { e.preventDefault(); exec("justifyCenter"); }}><AlignCenter size={13} /></button>
                <button title="Droite" onMouseDown={e => { e.preventDefault(); exec("justifyRight"); }}><AlignRight size={13} /></button>
                <button title="Justifier" onMouseDown={e => { e.preventDefault(); exec("justifyFull"); }}><AlignJustify size={13} /></button>
              </div>
              <div className="word-toolbar__div" />
              <div className="word-toolbar__grp">
                <button title="Liste أ  puces" onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }}><List size={13} /></button>
                <button title="Liste numأ©rotأ©e" onMouseDown={e => { e.preventDefault(); exec("insertOrderedList"); }}><ListOrdered size={13} /></button>
                <button title="Ligne de sأ©paration" onMouseDown={e => { e.preventDefault(); exec("insertHorizontalRule"); }} style={{ fontSize: 13, fontWeight: 700 }}>â€”</button>
              </div>
              <div className="word-toolbar__div" />
              <div className="word-toolbar__grp word-toolbar__actions">
                <button className="word-tbtn word-tbtn--ghost" onClick={saveTemplate}><Save size={12} /> Sauvegarder</button>
                <button className="word-tbtn word-tbtn--ghost" onClick={dupTemplate}><Copy size={12} /> Dupliquer</button>
                <button className="word-tbtn word-tbtn--blue" onClick={printDoc}><Printer size={12} /> Imprimer</button>
                {patient && <button className="word-tbtn word-tbtn--primary" onClick={generateDoc}><FileText size={12} /> Gأ©nأ©rer PDF</button>}
              </div>
            </div>
            {saveMsg && <div className="word-editor-savemsg">{saveMsg}</div>}
            {/* A4 canvas */}
            <div className="word-editor-a4-wrap">
              <div ref={editorRef} className="word-editor-a4" contentEditable suppressContentEditableWarning spellCheck={false} />
            </div>
          </>
        ) : (
          <div className="word-editor-empty">
            <FileCheck size={44} />
            <strong>Sأ©lectionnez un modأ¨le</strong>
            <span>Choisissez dans la bibliothأ¨que ou crأ©ez un nouveau modأ¨le</span>
            <button className="word-tbtn--new-lg" onClick={newTemplate}><Plus size={15} /> Nouveau modأ¨le</button>
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// ENHANCED SETTINGS PANEL
// =====================================================================
function DoctorSettingsPanel() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [secretInputs, setSecretInputs] = useState({ gemini: "", openrouter: "" });

  useEffect(() => {
    api.getSettings().then((d) => setSettings(d.settings || {})).catch(() => {});
  }, []);

  async function save(key, value) {
    setSaving(true);
    try {
      await api.updateSetting(key, value);
      setSettings((c) => ({ ...c, [key]: value }));
    } catch (e) { /* */ }
    setSaving(false);
  }

  async function saveSecret(key, field) {
    const value = secretInputs[field] || "";
    if (!value) return;
    await save(key, value);
    setSecretInputs((current) => ({ ...current, [field]: "" }));
    setSettings((current) => ({ ...current, [`${key}_CONFIGURED`]: "true", [key]: "" }));
  }

  async function clearSecret(key) {
    await save(key, "");
    setSettings((current) => ({ ...current, [`${key}_CONFIGURED`]: "false", [key]: "" }));
  }

  async function testUpload() {
    const result = await api.testUploadMode();
    setTestResult(result.ok ? `Connexion OK: ${result.url}` : `Connexion impossible: ${result.message || result.url || ""}`);
  }

  async function testAiProvider() {
    setTestResult("Test IA en cours...");
    try {
      const result = await api.testAiProvider();
      setTestResult(`IA OK: ${result.provider} / ${result.model} - ${result.message || "OK"}`);
    } catch (error) {
      setTestResult(`IA impossible: ${error.message}`);
    }
  }

  async function copyQrTestLink() {
    const base = settings.VERCEL_UPLOAD_URL || "https://clinic-upload.vercel.app";
    const target = encodeURIComponent(settings.PUBLIC_PC_UPLOAD_URL || "");
    await navigator.clipboard.writeText(`${base.replace(/\/+$/, "")}/upload/1?token=TEST_15_MINUTES&target=${target}`);
    setTestResult("Lien QR de test copie.");
  }

  return (
    <section className="tool-card">
      <h3><UserRound size={16} /> Profil Medecin & Cabinet</h3>
      <div className="compact-form-grid">
        <Field label="Nom du medecin" value={settings.DOCTOR_NAME || ""} onChange={(v) => save("DOCTOR_NAME", v)} />
        <Field label="Specialite" value={settings.DOCTOR_SPECIALTY || ""} onChange={(v) => save("DOCTOR_SPECIALTY", v)} />
        <Field label="Nآ° Ordre" value={settings.DOCTOR_ORDER_NUMBER || ""} onChange={(v) => save("DOCTOR_ORDER_NUMBER", v)} />
        <Field label="Telephone" value={settings.DOCTOR_PHONE || ""} onChange={(v) => save("DOCTOR_PHONE", v)} />
        <Field label="Email" value={settings.DOCTOR_EMAIL || ""} onChange={(v) => save("DOCTOR_EMAIL", v)} />
        <Field label="Adresse cabinet" value={settings.DOCTOR_ADDRESS || ""} onChange={(v) => save("DOCTOR_ADDRESS", v)} />
        <Field label="Nom du cabinet" value={settings.CLINIC_NAME || ""} onChange={(v) => save("CLINIC_NAME", v)} />
      </div>
      <h3 style={{ marginTop: 16 }}><QrCode size={16} /> QR Upload permanent</h3>
      <div className="compact-form-grid">
        <Field label="Vercel upload URL" value={settings.VERCEL_UPLOAD_URL || ""} onChange={(v) => save("VERCEL_UPLOAD_URL", v)} />
        <Field label="Public PC upload URL" value={settings.PUBLIC_PC_UPLOAD_URL || ""} onChange={(v) => save("PUBLIC_PC_UPLOAD_URL", v)} />
        <Field label="Google Drive backup email" value={settings.GOOGLE_DRIVE_BACKUP_EMAIL || "kchiali@gmail.com"} onChange={(v) => save("GOOGLE_DRIVE_BACKUP_EMAIL", v)} />
        <Field label="Google Drive sync folder" value={settings.GOOGLE_DRIVE_BACKUP_DIR || ""} onChange={(v) => save("GOOGLE_DRIVE_BACKUP_DIR", v)} />
      </div>
      <div className="panel-actions panel-actions--tight" style={{ marginTop: 8 }}>
        <button className="btn btn--secondary" onClick={testUpload}><Wifi size={14} /> Test connection</button>
        <button className="btn btn--secondary" onClick={copyQrTestLink}><QrCode size={14} /> Copier QR test</button>
      </div>
      <p style={{ fontSize: 12, color: "#92400e", background: "var(--warning-light)", padding: 10, borderRadius: "var(--radius-sm)", border: "1px solid #fcd34d", marginTop: 8 }}>
        Pour un QR upload permanent, configurez Cloudflare Tunnel une seule fois. Ne mettez jamais localhost dans le QR.
      </p>
      {testResult && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>{testResult}</p>}
      <h3 style={{ marginTop: 16 }}><BookOpen size={16} /> Source Medicaments</h3>
      <div className="compact-form-grid">
        <SelectField label="Source prioritaire" value={settings.MEDICINE_SOURCE_PRIORITY || "bdpm"} onChange={(v) => save("MEDICINE_SOURCE_PRIORITY", v)}>
          <option value="bdpm">BDPM (gratuit)</option>
          <option value="vidal">VIDAL API (payant)</option>
          <option value="local">Local uniquement</option>
        </SelectField>
        <Field label="Cle API VIDAL" value={settings.VIDAL_API_KEY || ""} onChange={(v) => save("VIDAL_API_KEY", v)} />
      </div>
      {saving && <p style={{ fontSize: 12, color: "var(--text-muted)" }}>Enregistrement...</p>}
    </section>
  );
}
 

function SpecialitySettingsSection({ currentId, onChange }) {
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(currentId || "cardiologie");
  const [saved, setSaved] = useState(false);
  const API_BASE = window.__TAURI__ ? "" : "http://127.0.0.1:8000";

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`${API_BASE}/api/setup/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speciality: selected }),
      });
      onChange(selected);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch(e) { console.error(e); }
    setSaving(false);
  };

  return (
    <section className="settings-section">
      <h3>Spécialité médicale</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Changer la spécialité adapte l'interface, les formulaires et l'assistant IA.
        <strong> Aucune donnée n'est supprimée.</strong>
      </p>
      <div className="sw-spec-grid sw-spec-grid--compact">
        {SPECIALITY_LIST.map(s => (
          <button key={s.id}
            className={`sw-spec-btn ${selected === s.id ? "sw-spec-btn--active" : ""}`}
            style={selected === s.id ? { borderColor: s.color, background: `${s.color}15` } : {}}
            onClick={() => { setSelected(s.id); setSaved(false); }}>
            <span className="sw-spec-btn__icon">{s.icon}</span>
            <span className="sw-spec-btn__label">{s.label}</span>
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
        <button className="btn btn--primary" disabled={saving} onClick={handleSave}>
          {saving ? "Enregistrement…" : "Appliquer la spécialité"}
        </button>
        {saved && <span style={{ color: "#10b981", fontSize: 13 }}>✓ Enregistré – rechargez l'app pour l'interface complète</span>}
      </div>
    </section>
  );
}


function DoctorSettingsPanelV2() {
  const [settings, setSettings] = useState({});
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [secretInputs, setSecretInputs] = useState({ gemini: "", openrouter: "", openai: "" });

  useEffect(() => {
    api.getSettings().then((data) => setSettings(data.settings || {})).catch(() => {});
  }, []);

  async function save(key, value) {
    setSaving(true);
    try {
      await api.updateSetting(key, value);
      setSettings((current) => ({ ...current, [key]: value }));
    } finally {
      setSaving(false);
    }
  }

  async function saveSecret(key, field) {
    const value = secretInputs[field] || "";
    if (!value) return;
    await save(key, value);
    setSecretInputs((current) => ({ ...current, [field]: "" }));
    setSettings((current) => ({ ...current, [`${key}_CONFIGURED`]: "true", [key]: "" }));
  }

  async function clearSecret(key) {
    await save(key, "");
    setSettings((current) => ({ ...current, [`${key}_CONFIGURED`]: "false", [key]: "" }));
  }

  async function testUpload() {
    try {
      const result = await api.testUploadMode();
      setTestResult(result.ok ? `QR OK: ${result.url}` : `QR indisponible: ${result.message || result.url || ""}`);
    } catch (error) {
      setTestResult(`QR indisponible: ${error.message}`);
    }
  }

  async function testAiProvider() {
    setTestResult("Test IA en cours...");
    try {
      const result = await api.testAiProvider();
      setTestResult(`IA OK: ${result.provider} / ${result.model} - ${result.message || "OK"}`);
    } catch (error) {
      setTestResult(`IA impossible: ${error.message}`);
    }
  }

  async function copyQrTestLink() {
    try {
      const debug = await api.qrDebug();
      await navigator.clipboard.writeText(debug.qr_format || debug.active_url || "");
      setTestResult("Format QR actif copie.");
    } catch (error) {
      setTestResult(`QR debug indisponible: ${error.message}`);
    }
  }

  function openAdvanced() {
    const ok = window.confirm("Attention: ces paramأ¨tres peuvent dأ©sactiver certaines fonctions.");
    if (ok) setAdvancedOpen(true);
  }

  return (
    <div className="settings-safe-stack settings-safe-stack--modern">
      <section className="tool-card settings-card settings-card--identity">
        <header className="settings-card__header">
          <div>
            <span className="patient-card__eyebrow">Parametres simples</span>
            <h3><UserRound size={16} /> Cabinet et securite</h3>
          </div>
          {saving && <span className="mode-badge mode-badge--starting">Enregistrement...</span>}
        </header>

        <div className="compact-form-grid">
          <Field label="Nom du medecin" value={settings.DOCTOR_NAME || ""} onChange={(value) => save("DOCTOR_NAME", value)} />
          <Field label="Specialite" value={settings.DOCTOR_SPECIALTY || ""} onChange={(value) => save("DOCTOR_SPECIALTY", value)} />
          <Field label="N ordre" value={settings.DOCTOR_ORDER_NUMBER || ""} onChange={(value) => save("DOCTOR_ORDER_NUMBER", value)} />
          <Field label="Telephone" value={settings.DOCTOR_PHONE || ""} onChange={(value) => save("DOCTOR_PHONE", value)} />
          <Field label="Email" value={settings.DOCTOR_EMAIL || ""} onChange={(value) => save("DOCTOR_EMAIL", value)} />
          <Field label="Nom du cabinet" value={settings.CLINIC_NAME || ""} onChange={(value) => save("CLINIC_NAME", value)} />
          <Field label="Adresse cabinet" wide value={settings.DOCTOR_ADDRESS || ""} onChange={(value) => save("DOCTOR_ADDRESS", value)} />
        </div>

        <div className="settings-mini-grid">
          <div className="settings-mini-card settings-mini-card--checks">
            <span>Vأ©rification</span>
            <button className="btn btn--secondary" onClick={testUpload}><Wifi size={14} /> Tester QR</button>
            <button className="btn btn--secondary" onClick={copyQrTestLink}><QrCode size={14} /> Format QR</button>
          </div>
        </div>
      </section>

      <section className="tool-card settings-card settings-card--advanced">
        <header className="settings-card__header">
          <div>
            <span className="patient-card__eyebrow">Avance</span>
            <h3><Settings size={16} /> Technique et modeles</h3>
          </div>
          {!advancedOpen && <button className="btn btn--secondary" onClick={openAdvanced}><ShieldCheck size={14} /> Afficher</button>}
        </header>

        {!advancedOpen ? (
          <div className="settings-locked">
            <AlertTriangle size={20} />
            <strong>Protege pour eviter les erreurs de configuration.</strong>
            <span>Les API keys, URL backend/tunnel et les limites IA sont caches derriere une confirmation.</span>
          </div>
        ) : (
          <>
            <div className="settings-privacy-note">Attention: ces paramأ¨tres peuvent dأ©sactiver certaines fonctions.</div>
            <div className="compact-form-grid">
              <Field label="Public PC upload URL" value={settings.PUBLIC_PC_UPLOAD_URL || ""} onChange={(value) => save("PUBLIC_PC_UPLOAD_URL", value)} />
              <Field label="Google Drive email" value={settings.GOOGLE_DRIVE_BACKUP_EMAIL || "kchiali@gmail.com"} onChange={(value) => save("GOOGLE_DRIVE_BACKUP_EMAIL", value)} />
              <Field label="Google Drive dossier" value={settings.GOOGLE_DRIVE_BACKUP_DIR || ""} onChange={(value) => save("GOOGLE_DRIVE_BACKUP_DIR", value)} />
            </div>

            <div className="compact-form-grid">
              <SelectField label="Source medicaments" value={settings.MEDICINE_SOURCE_PRIORITY || "bdpm"} onChange={(value) => save("MEDICINE_SOURCE_PRIORITY", value)}>
                <option value="bdpm">BDPM gratuit</option>
                <option value="vidal">VIDAL API</option>
                <option value="local">Local uniquement</option>
              </SelectField>
              <Field label="Cle API VIDAL" value={settings.VIDAL_API_KEY || ""} onChange={(value) => save("VIDAL_API_KEY", value)} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}


function MiniMetric({ label, value, tone = "neutral" }) {
  return (
    <div className={`mini-metric mini-metric--${tone}`}>
      <span>{label}</span>
      <strong>{displayValue(value, "--")}</strong>
    </div>
  );
}

function VisitPanelV2({ visit, setVisit, onSave, onDictate }) {
  const [visitTypes, setVisitTypes] = useState([]);
  const update = (key, value) => setVisit((current) => ({ ...current, [key]: value }));
  const remaining = (Number(visit.visit_fee) || 0) - (Number(visit.fee_paid) || 0);
  const paymentStatus = visit.payment_status || "pending";
  const paymentLabel = paymentStatus === "paid" ? "Paye" : paymentStatus === "partial" ? "Partiel" : "En attente";
  const observationFields = [["motif", "Motif"], ["histoire", "Histoire"], ["examens", "Examen"], ["diagnostics", "Diagnostic"], ["traitements", "Conduite / traitement"]];

  useEffect(() => {
    api.visitTypes().then((data) => setVisitTypes(data.rows || [])).catch(() => {});
  }, []);

  function handleTypeChange(typeName) {
    update("visit_type", typeName);
    const found = visitTypes.find((item) => item.name === typeName);
    if (found) setVisit((current) => ({ ...current, visit_type: typeName, visit_fee: found.price }));
  }

  return (
    <div className="clinical-panel visit-panel">
      <section className="clinical-card clinical-card--span">
        <header className="clinical-card__header">
          <div>
            <h3><Stethoscope size={17} /> Nouvelle visite</h3>
            <p>Constantes, paiement et observation medicale au meme endroit.</p>
          </div>
          <div className={`payment-status payment-status--${paymentStatus}`}>{paymentLabel}</div>
        </header>

        <div className="clinical-section-title">Constantes rapides</div>
        <div className="clinical-form-grid clinical-form-grid--vitals">
          <Field label="Date" type="datetime-local" value={String(visit.date_visite || "").replace(" ", "T").slice(0, 16)} onChange={(value) => update("date_visite", value)} />
          <Field label="Tension" value={visit.tension} onChange={(value) => update("tension", value)} />
          <Field label="FC" value={visit.frequence_cardiaque} onChange={(value) => update("frequence_cardiaque", value)} />
          <Field label="Glycemie" value={visit.glycemie} onChange={(value) => update("glycemie", value)} />
          <Field label="Poids" value={visit.poids || ""} onChange={(value) => update("poids", value)} />
          <Field label="Taille" value={visit.taille || ""} onChange={(value) => update("taille", value)} />
        </div>

        <div className={`visit-payment-row visit-payment-row--${paymentStatus}`}>
          <SelectField label="Type de visite" value={visit.visit_type || ""} onChange={handleTypeChange}>
            <option value="">Choisir</option>
            {visitTypes.map((item) => <option key={item.id} value={item.name}>{item.name} ({item.price} DA)</option>)}
          </SelectField>
          <Field label="Honoraire" type="number" value={visit.visit_fee || ""} onChange={(value) => update("visit_fee", Number(value))} />
          <Field label="Paye" type="number" value={visit.fee_paid || ""} onChange={(value) => update("fee_paid", Number(value))} />
          <SelectField label="Statut" value={paymentStatus} onChange={(value) => update("payment_status", value)}>
            <option value="pending">En attente</option>
            <option value="partial">Partiel</option>
            <option value="paid">Paye</option>
          </SelectField>
          <div className="payment-balance">
            <span>Solde</span>
            <strong>{remaining > 0 ? `${remaining} DA` : "Regle"}</strong>
          </div>
        </div>

        <div className="clinical-section-title">Observation clinique</div>
        <div className="clinical-note-grid">
          {observationFields.map(([key, label]) => (
            <TextArea key={key} label={label} value={visit[key]} onChange={(value) => update(key, value)} />
          ))}
        </div>

        <div className="clinical-actions">
          <button className="btn btn--secondary" onClick={() => onDictate("histoire")}><Mic size={14} /> Dictee</button>
          <button className="btn btn--primary" onClick={onSave}><Save size={14} /> Sauvegarder</button>
        </div>
      </section>
    </div>
  );
}

function VitalsPanelV2({ patient, cardio, onSave }) {
  const [form, setForm] = useState({ measured_at: new Date().toISOString().slice(0, 16), systolic_bp: "", diastolic_bp: "", heart_rate: "", oxygen_saturation: "", weight: "", height: "", notes: "" });
  const latest = (cardio?.vitals || [])[0] || {};
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  function submit() {
    onSave({
      ...form,
      measured_at: form.measured_at.replace("T", " "),
      systolic_bp: form.systolic_bp ? Number(form.systolic_bp) : null,
      diastolic_bp: form.diastolic_bp ? Number(form.diastolic_bp) : null,
      heart_rate: form.heart_rate ? Number(form.heart_rate) : null,
      oxygen_saturation: form.oxygen_saturation ? Number(form.oxygen_saturation) : null,
      weight: form.weight ? Number(form.weight) : null,
      height: form.height ? Number(form.height) : null
    });
  }

  return (
    <div className="clinical-split">
      <section className="clinical-card">
        <header className="clinical-card__header">
          <div>
            <h3><Activity size={17} /> Constantes</h3>
            <p>Saisie courte pour la consultation en cours.</p>
          </div>
        </header>
        <div className="clinical-form-grid">
          <Field label="Date" type="datetime-local" value={String(form.measured_at || "").replace(" ", "T").slice(0, 16)} onChange={(value) => update("measured_at", value)} />
          <Field label="PAS" value={form.systolic_bp} onChange={(value) => update("systolic_bp", value)} />
          <Field label="PAD" value={form.diastolic_bp} onChange={(value) => update("diastolic_bp", value)} />
          <Field label="FC" value={form.heart_rate} onChange={(value) => update("heart_rate", value)} />
          <Field label="SpO2" value={form.oxygen_saturation} onChange={(value) => update("oxygen_saturation", value)} />
          <Field label="Poids" value={form.weight} onChange={(value) => update("weight", value)} />
          <Field label="Taille cm" value={form.height} onChange={(value) => update("height", value)} />
        </div>
        <div className="clinical-actions">
          <button className="btn btn--primary" disabled={!patient} onClick={submit}><Save size={14} /> Ajouter</button>
        </div>
      </section>

      <aside className="clinical-side-stack">
        <section className="clinical-card clinical-card--compact">
          <header className="clinical-card__header">
            <h3>Derniere mesure</h3>
          </header>
          <div className="mini-metric-grid">
            <MiniMetric label="TA" value={`${latest.systolic_bp || "--"}/${latest.diastolic_bp || "--"}`} tone={latest.systolic_bp >= 160 ? "danger" : "neutral"} />
            <MiniMetric label="FC" value={latest.heart_rate} />
            <MiniMetric label="SpO2" value={latest.oxygen_saturation} />
            <MiniMetric label="IMC" value={latest.bmi} />
          </div>
        </section>
        <section className="clinical-card clinical-card--compact">
          <header className="clinical-card__header"><h3>Evolution TA / FC</h3></header>
          <LineChart rows={cardio?.vitals || []} fields={[{ key: "systolic_bp", color: "#c74435" }, { key: "diastolic_bp", color: "#2b84bd" }, { key: "heart_rate", color: "#309b72" }]} />
        </section>
        <section className="clinical-card clinical-card--compact">
          <header className="clinical-card__header"><h3>Historique</h3></header>
          <div className="clinical-list">
            {(cardio?.vitals || []).slice(0, 8).map((vital) => (
              <div key={vital.id} className={`mini-row ${vital.systolic_bp >= 160 ? "is-urgent" : ""}`}>
                <strong>{String(vital.measured_at || "").slice(0, 16)} - {vital.systolic_bp || "--"}/{vital.diastolic_bp || "--"}</strong>
                <span>FC {vital.heart_rate || "--"} / SpO2 {vital.oxygen_saturation || "--"} / IMC {vital.bmi || "--"}</span>
              </div>
            ))}
            {!(cardio?.vitals || []).length && <p className="empty-note">Aucune constante</p>}
          </div>
        </section>
      </aside>
    </div>
  );
}

function ScoresPanelV2({ cardio }) {
  const scores = cardio?.scores || {};
  const inputs = Object.entries(scores.inputs || {});
  return (
    <div className="clinical-panel scores-panel">
      <section className="clinical-card clinical-card--span">
        <header className="clinical-card__header">
          <div>
            <h3><AlertTriangle size={17} /> Scores de risque</h3>
            <p>Calculs indicatifs construits depuis le profil cardio, les constantes et les bilans disponibles.</p>
          </div>
        </header>
        <div className="score-grid-v2">
          <ScoreBadge label="Framingham 10 ans" score={scores.framingham_10y} />
          <ScoreBadge label="CHA2DS2-VASc" score={scores.cha2ds2_vasc} />
          <ScoreBadge label="HAS-BLED" score={scores.has_bled} />
          <ScoreBadge label="ASCVD 10 ans" score={scores.ascvd_10y} />
        </div>
      </section>
      <section className="clinical-card">
        <header className="clinical-card__header"><h3>Donnees utilisees</h3></header>
        <div className="score-input-grid">
          {inputs.map(([key, value]) => <MiniMetric key={key} label={key.replaceAll("_", " ")} value={String(value)} />)}
          {!inputs.length && <p className="empty-note">Completez le profil cardio et les constantes.</p>}
        </div>
        {scores.disclaimer && <p className="disclaimer">{scores.disclaimer}</p>}
      </section>
    </div>
  );
}

function ImagingLabsPanelV2({ patient, cardio, onSaveImaging, onSaveLabs }) {
  const [imaging, setImaging] = useState({ imaging_type: "Echocardiographie", performed_at: new Date().toISOString().slice(0, 16), ejection_fraction: "", valve_status: "", wall_motion: "", report: "" });
  const [lab, setLab] = useState({ measured_at: new Date().toISOString().slice(0, 16), total_cholesterol: "", ldl: "", hdl: "", triglycerides: "", troponin: "", bnp: "", nt_probnp: "", creatinine: "" });
  const latestLab = (cardio?.labs || [])[0] || {};
  const latestImaging = (cardio?.imaging || [])[0] || {};
  const ui = (key, value) => setImaging((current) => ({ ...current, [key]: value }));
  const ul = (key, value) => setLab((current) => ({ ...current, [key]: value }));
  const numberOrNull = (value) => value === "" ? null : Number(value);

  return (
    <div className="clinical-panel labs-panel">
      <section className="clinical-card">
        <header className="clinical-card__header">
          <div>
            <h3><Stethoscope size={17} /> Imagerie</h3>
            <p>FEVG, valves, cinetique et conclusion courte.</p>
          </div>
        </header>
        <SelectField label="Type" value={imaging.imaging_type} onChange={(value) => ui("imaging_type", value)}>
          <option>Echocardiographie</option>
          <option>IRM cardiaque</option>
          <option>Scanner coronaire</option>
        </SelectField>
        <div className="clinical-form-grid">
          <Field label="Date" type="datetime-local" value={String(imaging.performed_at || "").replace(" ", "T").slice(0, 16)} onChange={(value) => ui("performed_at", value)} />
          <Field label="FEVG %" value={imaging.ejection_fraction} onChange={(value) => ui("ejection_fraction", value)} />
          <Field label="Valves" value={imaging.valve_status} onChange={(value) => ui("valve_status", value)} />
          <Field label="Cinetique" value={imaging.wall_motion} onChange={(value) => ui("wall_motion", value)} />
        </div>
        <TextArea compact label="Compte rendu" value={imaging.report} onChange={(value) => ui("report", value)} />
        <div className="clinical-actions">
          <button className="btn btn--primary" disabled={!patient} onClick={() => onSaveImaging({ ...imaging, performed_at: imaging.performed_at.replace("T", " "), ejection_fraction: numberOrNull(imaging.ejection_fraction) })}><Save size={14} /> Enregistrer</button>
        </div>
      </section>

      <section className="clinical-card">
        <header className="clinical-card__header">
          <div>
            <h3><FlaskConical size={17} /> Biologie</h3>
            <p>Lipides, troponine, BNP et creatinine.</p>
          </div>
        </header>
        <div className="clinical-form-grid clinical-form-grid--labs">
          <Field label="Date" type="datetime-local" value={String(lab.measured_at || "").replace(" ", "T").slice(0, 16)} onChange={(value) => ul("measured_at", value)} />
          <Field label="Chol total" value={lab.total_cholesterol} onChange={(value) => ul("total_cholesterol", value)} />
          <Field label="LDL" value={lab.ldl} onChange={(value) => ul("ldl", value)} />
          <Field label="HDL" value={lab.hdl} onChange={(value) => ul("hdl", value)} />
          <Field label="TG" value={lab.triglycerides} onChange={(value) => ul("triglycerides", value)} />
          <Field label="Troponine" value={lab.troponin} onChange={(value) => ul("troponin", value)} />
          <Field label="BNP" value={lab.bnp} onChange={(value) => ul("bnp", value)} />
          <Field label="NT-proBNP" value={lab.nt_probnp} onChange={(value) => ul("nt_probnp", value)} />
          <Field label="Creatinine" value={lab.creatinine} onChange={(value) => ul("creatinine", value)} />
        </div>
        <div className="clinical-actions">
          <button className="btn btn--primary" disabled={!patient} onClick={() => onSaveLabs(Object.fromEntries(Object.entries({ ...lab, measured_at: lab.measured_at.replace("T", " ") }).map(([key, value]) => [key, key === "measured_at" ? value : numberOrNull(value)])))}><Save size={14} /> Enregistrer</button>
        </div>
      </section>

      <section className="clinical-card clinical-card--span">
        <header className="clinical-card__header"><h3>Synthese diagnostic</h3></header>
        <div className="mini-metric-grid mini-metric-grid--wide">
          <MiniMetric label="Derniere FEVG" value={latestImaging.ejection_fraction ? `${latestImaging.ejection_fraction}%` : ""} />
          <MiniMetric label="LDL" value={latestLab.ldl} />
          <MiniMetric label="HDL" value={latestLab.hdl} />
          <MiniMetric label="Creatinine" value={latestLab.creatinine} />
          <MiniMetric label="Troponine" value={latestLab.troponin} tone={latestLab.troponin ? "warning" : "neutral"} />
        </div>
        <LineChart rows={cardio?.labs || []} fields={[{ key: "ldl", color: "#c74435" }, { key: "hdl", color: "#309b72" }, { key: "creatinine", color: "#2b84bd" }]} />
      </section>
    </div>
  );
}

function BMIPanelV2({ patient }) {
  const [form, setForm] = useState({ measured_at: new Date().toISOString().slice(0, 16), weight_kg: "", height_cm: "", waist_circumference_cm: "", notes: "" });
  const [records, setRecords] = useState([]);
  const [result, setResult] = useState(null);
  const latest = result || records[0] || {};
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => { if (patient?.id) loadRecords(); }, [patient?.id]);

  async function loadRecords() {
    try { const data = await api.getAnthropometry(patient.id); setRecords(data.rows || []); } catch (e) { /* */ }
  }

  async function submit() {
    if (!patient?.id) return;
    const payload = {
      measured_at: form.measured_at.replace("T", " "),
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      waist_circumference_cm: form.waist_circumference_cm ? Number(form.waist_circumference_cm) : null,
      notes: form.notes
    };
    const response = await api.addAnthropometry(patient.id, payload);
    setResult(response);
    await loadRecords();
    setForm((current) => ({ ...current, weight_kg: "", waist_circumference_cm: "", notes: "" }));
  }

  return (
    <div className="clinical-split">
      <section className="clinical-card">
        <header className="clinical-card__header">
          <div>
            <h3><Scale size={17} /> IMC et anthropometrie</h3>
            <p>Poids, taille et risque abdominal sans quitter le dossier.</p>
          </div>
        </header>
        <div className="clinical-form-grid">
          <Field label="Date" type="datetime-local" value={String(form.measured_at || "").replace(" ", "T").slice(0, 16)} onChange={(value) => update("measured_at", value)} />
          <Field label="Poids kg" value={form.weight_kg} onChange={(value) => update("weight_kg", value)} />
          <Field label="Taille cm" value={form.height_cm} onChange={(value) => update("height_cm", value)} />
          <Field label="Tour taille cm" value={form.waist_circumference_cm} onChange={(value) => update("waist_circumference_cm", value)} />
        </div>
        <TextArea compact label="Notes" value={form.notes} onChange={(value) => update("notes", value)} />
        <div className="clinical-actions">
          <button className="btn btn--primary" disabled={!patient} onClick={submit}><Save size={14} /> Enregistrer</button>
        </div>
      </section>

      <aside className="clinical-side-stack">
        <section className="clinical-card clinical-card--compact bmi-summary-card">
          <header className="clinical-card__header"><h3>Dernier resultat</h3></header>
          <div className="mini-metric-grid">
            <MiniMetric label="IMC" value={latest.bmi} tone={latest.bmi_category === "Obesite" ? "danger" : latest.bmi_category === "Surpoids" ? "warning" : "neutral"} />
            <MiniMetric label="Categorie" value={latest.bmi_category} />
            <MiniMetric label="Tour taille" value={latest.waist_circumference_cm ? `${latest.waist_circumference_cm} cm` : ""} />
            <MiniMetric label="Risque abdominal" value={latest.waist_risk} tone={latest.waist_risk === "Risque eleve" ? "danger" : "neutral"} />
          </div>
        </section>
        <section className="clinical-card clinical-card--compact">
          <header className="clinical-card__header"><h3>Evolution</h3></header>
          <LineChart rows={records} fields={[{ key: "bmi", color: "#2563eb" }, { key: "weight_kg", color: "#16a34a" }]} />
        </section>
        <section className="clinical-card clinical-card--compact">
          <header className="clinical-card__header"><h3>Historique</h3></header>
          <div className="clinical-list">
            {records.slice(0, 8).map((record) => (
              <div key={record.id} className={`mini-row ${record.bmi_category === "Obesite" ? "is-urgent" : ""}`}>
                <strong>{String(record.measured_at || "").slice(0, 16)} - IMC {record.bmi ?? "--"}</strong>
                <span>{record.weight_kg || "--"} kg / {record.height_cm || "--"} cm / taille {record.waist_circumference_cm || "--"} cm</span>
              </div>
            ))}
            {!records.length && <p className="empty-note">Aucune mesure</p>}
          </div>
        </section>
      </aside>
    </div>
  );
}

function MedicalWorkspace({
  activeTab,
  setActiveTab,
  specialityConfig,
  patient,
  detail,
  onUpload,
  onSaveDocumentNotes,
  onSavePrescription,
  medications,
  aiWarnings,
  onAiCheck,
  appointments,
  onSaveAppointment,
  onSaveCardioProfile,
  onSaveVitals,
  onSaveLabs,
  onSaveEcg,
  onSaveImaging,
  onSaveDiagnosis,
  onAutoFollowup,
  uploadMode,
  onRefreshMode,
  visit,
  setVisit,
  onSaveVisit,
  onDictate,
  patientForm,
  setPatientForm,
  onNewPatient,
  onSavePatient,
  onDeletePatient,
  saving
}) {
  const cardio = detail?.cardio || {};

  // Icon lookup for tab registry
  const TAB_ICONS = {
    Stethoscope, Activity, Scale, FileImage, ShieldCheck,
    AlertTriangle, Sparkles, Pill, UserRound, Clock, CalendarDays,
    FileCheck, Bot, Settings, BookOpen, Upload
  };

  const rawTabs = buildTabList(specialityConfig);
  const allTabs = rawTabs.map(t => ({
    ...t,
    icon: TAB_ICONS[t.icon] || FileImage,
  }));

  const groupColors = { consultation: "#10b981", clinique: "#3b82f6", diagnostic: "#8b5cf6", gestion: "#f59e0b", outils: "#64748b" };
  const groupLabels = { consultation: "Consultation", clinique: "Clinique", diagnostic: "Diagnostic", gestion: "Gestion", outils: "Outils" };

  const activeTabData = allTabs.find((t) => t.id === activeTab);
  const activeColor = groupColors[activeTabData?.group] || "#3b82f6";

  // Group tabs for display
  const groups = ["consultation", "clinique", "diagnostic", "gestion", "outils"];

  return (
    <div className="medical-workspace">
      <div className="workspace-main">
        <aside className="workspace-sidebar">
          <div className="workspace-sidebar__nav">
            {groups.map((group) => (
              <div key={group} className="sidebar-group">
                <span className="sidebar-group__label">{groupLabels[group]}</span>
                {allTabs.filter((t) => t.group === group).map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const tabColor = groupColors[group];
                  return (
                    <button
                      key={tab.id}
                      className={`sidebar-nav-item ${isActive ? "is-active" : ""}`}
                      onClick={() => setActiveTab(tab.id)}
                      title={tab.label}
                      style={isActive ? { borderLeftColor: tabColor, background: `${tabColor}10` } : {}}
                    >
                      <span className="sidebar-nav-item__icon" style={isActive ? { color: tabColor } : {}}>
                        <Icon size={16} />
                      </span>
                      <span className="sidebar-nav-item__label">{tab.label}</span>
                      {isActive && <span className="sidebar-nav-item__active-dot" style={{ background: tabColor }} />}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </aside>

        {/* Content */}
        <div className="workspace-content">
          {activeTab === "new-visit" && <VisitPanelV2 visit={visit} setVisit={setVisit} onSave={onSaveVisit} onDictate={onDictate} />}
          {activeTab === "profile" && <CardioProfilePanel patient={patient} cardio={cardio} onSave={onSaveCardioProfile} />}
          {activeTab === "vitals" && <VitalsPanelV2 patient={patient} cardio={cardio} onSave={onSaveVitals} />}
          {activeTab === "bmi" && <BMIPanelV2 patient={patient} />}
          {activeTab === "ecg" && <ECGPanel patient={patient} detail={detail} cardio={cardio} onSave={onSaveEcg} />}
          {activeTab === "scores" && <ScoresPanelV2 cardio={cardio} />}
          {activeTab === "imaging" && <ImagingLabsPanelV2 patient={patient} cardio={cardio} onSaveImaging={onSaveImaging} onSaveLabs={onSaveLabs} />}
          {activeTab === "diagnosis" && <DiagnosisTreatmentPanel patient={patient} cardio={cardio} medications={medications} onDiagnosis={onSaveDiagnosis} onSavePrescription={onSavePrescription} />}
          {activeTab === "followup" && <FollowupPanel patient={patient} cardio={cardio} appointments={appointments} onAutoFollowup={onAutoFollowup} onSaveAppointment={onSaveAppointment} />}
          {activeTab === "fiche" && (
            <CivilPanelCard
              form={patientForm}
              setForm={setPatientForm}
              selected={patient}
              saving={saving}
              onNew={onNewPatient}
              onSave={onSavePatient}
              onDelete={onDeletePatient}
            />
          )}
          {activeTab === "historique" && <Timeline detail={detail} />}
          {activeTab === "docs" && <DocumentsPanel patient={patient} detail={detail} onUpload={onUpload} onSaveNotes={onSaveDocumentNotes} uploadMode={uploadMode} />}
          {activeTab === "templates" && <DocumentTemplatesPanel patient={patient} />}
          {activeTab === "specialty" && <SpecialityFieldsPanel patient={patient} specialityConfig={specialityConfig} />}
          {activeTab === "medicines" && <MedicineDatabasePanel />}
          {activeTab === "ai" && <AIPanel patient={patient} aiWarnings={aiWarnings} onCheck={onAiCheck} specialityConfig={specialityConfig} />}
          {activeTab === "settings" && (
            <div className="settings-workspace">
              <SpecialitySettingsSection
                currentId={specialityConfig?.id || "cardiologie"}
                onChange={() => {}}
              />
              <SettingsPanel uploadMode={uploadMode} onRefreshMode={onRefreshMode} />
              <DoctorSettingsPanelV2 />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Timeline({ detail }) {
  const entries = useMemo(() => {
    const visits = (detail?.visits || []).map((item) => ({
      id: `v-${item.id}`, date: item.date_visite, type: "Visite", color: "#2563eb", bg: "#eff6ff",
      title: item.diagnostics || item.motif || "Consultation",
      body: item.traitements || item.examens || item.histoire || ""
    }));
    const docs = (detail?.documents || []).map((item) => ({
      id: `d-${item.id}`, date: item.uploaded_at, type: "Document", color: "#10b981", bg: "#ecfdf5",
      title: `${item.type_document} - ${item.original_name}`,
      body: item.notes || ""
    }));
    const rx = (detail?.prescriptions || []).map((item) => ({
      id: `p-${item.id}`, date: item.created_at, type: "Ordonnance", color: "#f59e0b", bg: "#fffbeb",
      title: "Ordonnance", body: item.consultation_summary || item.lines || ""
    }));
    return [...visits, ...docs, ...rx].sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }, [detail]);

  const typeIcon = { Visite: Stethoscope, Document: FileImage, Ordonnance: ClipboardPlus };

  return (
    <aside className="timeline timeline--premium">
      <header>
        <div className="timeline-header-left">
          <Clock size={16} />
          <h2>Historique clinique</h2>
        </div>
        <span className="timeline-count">{entries.length} أ©vأ©nements</span>
      </header>
      <div className="timeline-container">
        {entries.slice(0, 30).map((item) => {
          const TypeIcon = typeIcon[item.type] || Clock;
          return (
            <div key={item.id} className="timeline-event">
              <div className="timeline-event__dot" style={{ borderColor: item.color }} />
              <time>{String(item.date || "").slice(0, 16).replace("T", " ")}</time>
              <div className="event-card" style={{ borderLeft: `3px solid ${item.color}` }}>
                <div className="event-card__header">
                  <span className="event-card__badge" style={{ color: item.color, background: item.bg }}>
                    <TypeIcon size={11} /> {item.type}
                  </span>
                  <strong>{item.title}</strong>
                </div>
                {item.body && <p>{String(item.body).slice(0, 140)}{String(item.body).length > 140 ? "..." : ""}</p>}
              </div>
            </div>
          );
        })}
        {!entries.length && (
          <div className="empty-state empty-state--subtle">
            <Clock size={24} />
            <p>Aucun historique pour ce patient</p>
          </div>
        )}
      </div>
    </aside>
  );
}

// =====================================================================
// AI & CRأ‰DITS PAGE (uses cloud API for subscription/credits/HF chat)
// =====================================================================
function CloudConfigCard({ onConfigured }) {
  const cfg = getCloudConfig();
  const [url, setUrl] = useState(cfg.url || "");
  const [doctorId, setDoctorId] = useState(cfg.doctor_id || "");
  const [secret, setSecret] = useState(cfg.secret || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function save() {
    setBusy(true); setMsg("");
    try {
      // Save to browser localStorage (for frontend cloudAi client)
      saveCloudConfig({ url, doctor_id: doctorId, secret });
      // Also sync to local backend settings so Python can use cloud credits directly.
      await api.updateSetting("CLOUD_AI_URL", url.trim());
      await api.updateSetting("CLOUD_AI_DOCTOR_ID", doctorId.trim());
      await api.updateSetting("CLOUD_AI_SECRET", secret.trim());
      // Test the configuration
      const sub = await cloudAi.subscription();
      setMsg(`Connectأ©: ${sub.plan_label} - ${sub.remaining_credits} crأ©dits restants`);
      setTimeout(() => onConfigured && onConfigured(), 800);
    } catch (e) {
      setMsg("Erreur: " + e.message);
    }
    setBusy(false);
  }

  return (
    <section className="card cloud-config-card">
      <header className="card__header"><h2>Configuration IA Cloud</h2></header>
      <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 16 }}>
        L'IA Mأ©dicale (Qwen 2.5 7B) est gأ©rأ©e أ  distance par votre administrateur. Saisissez les identifiants
        qu'il vous a communiquأ©s pour activer l'analyse cloud (via OpenRouter).
      </p>
      <div className="form-grid">
        <label>URL de l'API Cloud
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://medismart-ai-credits.vercel.app" />
        </label>
        <label>Doctor ID
          <input type="text" value={doctorId} onChange={(e) => setDoctorId(e.target.value)} placeholder="uuid fourni par l'admin" />
        </label>
        <label>Secret
          <input type="password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="secret fourni par l'admin" />
        </label>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button className="btn btn--primary" onClick={save} disabled={busy || !url || !doctorId || !secret}>
          {busy ? "Connexion..." : "Connecter"}
        </button>
      </div>
      {msg && <div className={msg.startsWith("Erreur") ? "soft-error" : "soft-ok"} style={{ marginTop: 12 }}>{msg}</div>}
    </section>
  );
}

function AICreditsPage() {
  const [configured, setConfigured] = useState(isCloudConfigured());
  const [sub, setSub] = useState(null);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total_used: 0, cache_hits: 0, daily: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    if (!isCloudConfigured()) { setConfigured(false); return; }
    setLoading(true);
    setError("");
    try {
      const [s, l] = await Promise.all([cloudAi.subscription(), cloudAi.logs()]);
      setSub(s);
      setLogs(l.rows || []);
      setStats({ total_used: l.total_used || 0, cache_hits: l.cache_hits || 0, daily: l.daily || [] });
    } catch (e) {
      setError(e.message || "Erreur de chargement");
    }
    setLoading(false);
  }

  useEffect(() => { if (configured) refresh(); }, [configured]);

  async function disconnectCloud() {
    if (!confirm("Dأ©connecter l'IA cloud ? Les paramأ¨tres seront effacأ©s.")) return;
    saveCloudConfig({ url: "", doctor_id: "", secret: "" });
    // Also clear backend settings so local AI stops redirecting to cloud
    try {
      await api.updateSetting("CLOUD_AI_URL", "");
      await api.updateSetting("CLOUD_AI_DOCTOR_ID", "");
      await api.updateSetting("CLOUD_AI_SECRET", "");
    } catch {}
    setConfigured(false);
    setSub(null);
    setLogs([]);
  }

  // Plan changes & toggle are admin-controlled in cloud mode; not exposed to doctor
  async function changePlan(plan_name) {
    alert("Le changement de plan est gأ©rأ© par votre administrateur. Contactez-le.");
  }
  async function toggleAI() {
    alert("L'activation/dأ©sactivation de l'IA est gأ©rأ©e par votre administrateur. Contactez-le.");
  }

  // Not yet configured: show only the cloud config card
  if (!configured) {
    return (
      <div className="ai-credits-page">
        <header className="directory-header">
          <div className="directory-title">
            <h1>AI & Crأ©dits</h1>
            <p>L'IA Bio-Medical (OpenRouter / Qwen) est gأ©rأ©e par votre administrateur via le cloud.</p>
          </div>
        </header>
        <CloudConfigCard onConfigured={() => setConfigured(true)} />
      </div>
    );
  }

  if (loading) return <div className="ai-credits-page"><div className="ai-credits-loading">Chargementâ€¦</div></div>;
  if (!sub) return (
    <div className="ai-credits-page">
      <div className="soft-error">{error || "Impossible de charger l'abonnement IA"}</div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn--secondary" onClick={refresh}>Rأ©essayer</button>
        <button className="btn btn--ghost" onClick={disconnectCloud} style={{ marginLeft: 8 }}>Reconfigurer</button>
      </div>
    </div>
  );

  const monthly = sub.monthly_credits || 0;
  const used = sub.used_credits || 0;
  const remaining = sub.unlimited ? "âˆ‍" : (sub.remaining_credits || 0);
  const ratio = sub.unlimited ? 0 : (monthly > 0 ? used / monthly : 0);
  let healthClass = "is-ok";
  let healthLabel = "Crأ©dits OK";
  if (!sub.unlimited) {
    if (ratio >= 1) { healthClass = "is-danger"; healthLabel = "أ‰puisأ©"; }
    else if (ratio >= 0.8) { healthClass = "is-warning"; healthLabel = "Crأ©dits faibles"; }
  } else { healthLabel = "Illimitأ©"; }

  const costs = sub.credit_costs || {};
  const costRows = [
    { key: "chat", label: "Chat IA simple", cost: costs.chat ?? 1 },
    { key: "lab_analysis", label: "Analyse Labo / PDF", cost: costs.lab_analysis ?? 3 },
    { key: "ecg_analysis", label: "Analyse ECG", cost: costs.ecg_analysis ?? 5 },
    { key: "image_analysis", label: "Analyse Image", cost: costs.image_analysis ?? 5 },
    { key: "multimodal_analysis", label: "Multimodal / IRM", cost: costs.multimodal_analysis ?? 10 },
  ];

  const plans = sub.plans || {};
  const maxDaily = Math.max(1, ...stats.daily.map((d) => d.credits || 0));

  return (
    <div className="ai-credits-page">
      <header className="directory-header">
        <div className="directory-title">
          <h1>AI & Crأ©dits</h1>
          <p>Suivez votre abonnement IA, vos crأ©dits restants et l'historique d'utilisation.</p>
        </div>
        <div className="ai-credits-toolbar">
          <button className="btn btn--secondary" onClick={refresh} disabled={busy}>Actualiser</button>
          <button className="btn btn--ghost" onClick={disconnectCloud}>Reconfigurer</button>
        </div>
      </header>

      {error && <div className="soft-error">{error}</div>}

      {/* === Top stat cards === */}
      <div className="ai-credits-stats">
        <div className={`ai-credit-card ${healthClass}`}>
          <div className="ai-credit-card__label">Plan actuel</div>
          <div className="ai-credit-card__value">{sub.plan_label}</div>
          <div className="ai-credit-card__sub">{sub.unlimited ? "Crأ©dits illimitأ©s" : `${monthly} crأ©dits / mois`}</div>
        </div>
        <div className={`ai-credit-card ${healthClass}`}>
          <div className="ai-credit-card__label">Crأ©dits restants</div>
          <div className="ai-credit-card__value">{remaining}</div>
          <div className="ai-credit-card__sub">{healthLabel}</div>
        </div>
        <div className="ai-credit-card is-neutral">
          <div className="ai-credit-card__label">Utilisأ©s ce mois</div>
          <div className="ai-credit-card__value">{used}</div>
          <div className="ai-credit-card__sub">Renouvellement: {sub.renewal_date}</div>
        </div>
        <div className="ai-credit-card is-neutral">
          <div className="ai-credit-card__label">أ‰conomie cache</div>
          <div className="ai-credit-card__value">{stats.cache_hits}</div>
          <div className="ai-credit-card__sub">Analyses rأ©utilisأ©es</div>
        </div>
      </div>

      {!sub.unlimited && (
        <div className="ai-credit-progress">
          <div className="ai-credit-progress__bar">
            <div className={`ai-credit-progress__fill ${healthClass}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>
          <div className="ai-credit-progress__label">{used} / {monthly} crأ©dits utilisأ©s</div>
        </div>
      )}

      {/* === Plans === */}
      <section className="ai-credits-section">
        <h2>Plans disponibles</h2>
        <div className="ai-credits-plans">
          {Object.entries(plans).map(([key, p]) => (
            <div key={key} className={`ai-credit-plan ${sub.plan_name === key ? "is-current" : ""}`}>
              <div className="ai-credit-plan__name">{p.label}</div>
              <div className="ai-credit-plan__credits">
                {p.unlimited ? "âˆ‍" : p.monthly_credits}
                <span>{p.unlimited ? "illimitأ©s" : "crأ©dits/mois"}</span>
              </div>
              {sub.plan_name === key ? (
                <div className="ai-credit-plan__current">Plan actuel</div>
              ) : (
                <button className="btn btn--primary ai-credit-plan__btn" onClick={() => changePlan(key)} disabled={busy}>
                  Choisir
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* === Costs === */}
      <section className="ai-credits-section">
        <h2>Coأ»t par action</h2>
        <table className="ai-credits-table">
          <thead><tr><th>Action</th><th>Crأ©dits</th></tr></thead>
          <tbody>
            {costRows.map((r) => (
              <tr key={r.key}><td>{r.label}</td><td><strong>{r.cost}</strong></td></tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* === Daily usage chart === */}
      {stats.daily.length > 0 && (
        <section className="ai-credits-section">
          <h2>Utilisation (30 derniers jours)</h2>
          <div className="ai-credits-chart">
            {stats.daily.slice().reverse().map((d) => (
              <div key={d.day} className="ai-credits-chart__bar" title={`${d.day}: ${d.credits} crأ©dits`}>
                <div className="ai-credits-chart__fill" style={{ height: `${(d.credits / maxDaily) * 100}%` }} />
                <div className="ai-credits-chart__day">{d.day.slice(8)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* === Recent actions === */}
      <section className="ai-credits-section">
        <h2>Derniأ¨res actions ({logs.length})</h2>
        {logs.length === 0 ? (
          <div className="empty-state empty-state--subtle"><Bot size={20} /><p>Aucune action IA enregistrأ©e pour le moment.</p></div>
        ) : (
          <table className="ai-credits-table">
            <thead><tr><th>Date</th><th>Action</th><th>Crأ©dits</th><th>Statut</th></tr></thead>
            <tbody>
              {logs.slice(0, 20).map((log) => (
                <tr key={log.id}>
                  <td>{String(log.created_at || "").slice(0, 16).replace("T", " ")}</td>
                  <td>{log.action_type}</td>
                  <td><strong>{log.credits_used}</strong></td>
                  <td>
                    {log.cached ? <span className="badge badge--info">Cache</span>
                    : log.success ? <span className="badge badge--ok">OK</span>
                    : <span className="badge badge--err">أ‰chec</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="ai-safety-note">
        <AlertTriangle size={14} /> Analyse IA أ  vأ©rifier par le mأ©decin. Aucun diagnostic ou prescription automatique.
      </div>
    </div>
  );
}

function BackendSplash({ ready, failed }) {
  return (
    <div className="backend-splash">
      <div className="backend-splash__card">
        <div className="backend-splash__logo">
          <Heart size={40} fill="currentColor" />
        </div>
        <h1 className="backend-splash__title">MediSmart Pro</h1>
        <p className="backend-splash__sub">Medical Intelligence</p>
        {failed ? (
          <>
            <div className="backend-splash__error">
              Impossible de dأ©marrer le serveur. Relancez l'application.
            </div>
            <button className="backend-splash__retry" onClick={() => window.location.reload()}>
              Rأ©essayer
            </button>
          </>
        ) : (
          <div className="backend-splash__loader">
            <div className="backend-splash__bar" />
          </div>
        )}
        <p className="backend-splash__hint">
          {failed ? "Erreur de dأ©marrage" : "Dأ©marrage du serveur mأ©dicalâ€¦"}
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [backendReady, setBackendReady] = useState(false);
  const [backendFailed, setBackendFailed] = useState(false);
  const [setupDone, setSetupDone] = useState(true);   // assume done; corrected after backend check
  const [specialityId, setSpecialityId] = useState("cardiologie");
  const specialityConfig = getSpecialityConfig(specialityId);
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("cardio-user") || "null"));
  const [dashboard, setDashboard] = useState(null);
  const [patients, setPatients] = useState([]);
  const [patientTotal, setPatientTotal] = useState(0);
  const [appointments, setAppointments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [detail, setDetail] = useState(null);
  const [patientForm, setPatientForm] = useState(blankPatient);
  const [visit, setVisit] = useState(blankVisit);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState("dashboard");
  const [navCollapsed, setNavCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState("new-visit");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [medications, setMedications] = useState([]);
  const [aiWarnings, setAiWarnings] = useState(null);
  const [uploadMode, setUploadMode] = useState(null);
  const [backupMessage, setBackupMessage] = useState("");
  const [patientConflict, setPatientConflict] = useState(null);
  const searchRef = useRef(null);

  const selectedPatient = detail?.patient || null;
  const duplicateMatches = useMemo(() => {
    const nom = (patientForm.nom || "").trim().toLowerCase();
    const prenom = (patientForm.prenom || "").trim().toLowerCase();
    if (nom.length < 2 || prenom.length < 2) return [];
    return patients.filter((patient) => {
      if (selectedPatient?.id && patient.id === selectedPatient.id) return false;
      return (patient.nom || "").trim().toLowerCase() === nom && (patient.prenom || "").trim().toLowerCase() === prenom;
    });
  }, [patients, patientForm.nom, patientForm.prenom, selectedPatient?.id]);
  const visibleSearchResults = useMemo(
    () => search.trim() ? patients.filter((patient) => patientMatchesSearch(patient, search)).slice(0, 8) : [],
    [patients, search]
  );

  useEffect(() => {
    const calculated = calculateAgeFromBirthDate(patientForm.date_naissance);
    if (!calculated) return;
    setPatientForm((current) => {
      if (String(current.age || "") === calculated) return current;
      return { ...current, age: calculated };
    });
  }, [patientForm.date_naissance]);

  async function refreshPatient(patientId = selectedPatient?.id) {
    if (!patientId) return;
    const data = await api.patient(patientId);
    setDetail(data);
    setPatientForm(data.patient);
  }

  async function refreshUploadMode() {
    try {
      const m = await api.uploadMode();
      setUploadMode(m);
    } catch (e) { /* ignore */ }
  }

  async function load() {
    const [dashResult, patientRowsResult, medsResult, apptsResult] = await Promise.allSettled([
      api.dashboard(),
      api.patients(search),
      api.medications(),
      api.appointments(),
    ]);

    const issues = [];

    if (dashResult.status === "fulfilled") {
      setDashboard(dashResult.value);
    } else {
      issues.push(`Dashboard: ${dashResult.reason?.message || dashResult.reason}`);
    }

    if (patientRowsResult.status === "fulfilled") {
      const rows = patientRowsResult.value.rows || [];
      setPatients(rows);
      setPatientTotal(patientRowsResult.value.filtered_total ?? patientRowsResult.value.total ?? rows.length);
    } else {
      issues.push(`Patients: ${patientRowsResult.reason?.message || patientRowsResult.reason}`);
    }

    if (medsResult.status === "fulfilled") {
      setMedications(medsResult.value.rows || []);
    } else {
      issues.push(`Medicaments: ${medsResult.reason?.message || medsResult.reason}`);
    }

    if (apptsResult.status === "fulfilled") {
      setAppointments(apptsResult.value.rows || []);
    } else {
      issues.push(`RDV: ${apptsResult.reason?.message || apptsResult.reason}`);
    }

    setError(issues.length ? issues.join(" | ") : "");
    refreshUploadMode();
  }

  async function runBackup() {
    try {
      const result = await api.backup();
      const driveText = result.google_drive_copy
        ? `Backup cree et copie Google Drive: ${result.google_drive_copy}`
        : `Backup local cree: ${result.file_path}. Configurez le dossier Google Drive dans Parametres.`;
      setBackupMessage(driveText);
      setError("");
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    let attempts = 0;
    const MAX = 60;
    const id = setInterval(async () => {
      attempts++;
      try {
        const r = await fetch("http://127.0.0.1:8000/api/health");
        if (r.ok || r.status < 500) {
          setBackendReady(true);
          clearInterval(id);
        }
      } catch {
        if (attempts >= MAX) {
          setBackendFailed(true);
          clearInterval(id);
        }
      }
    }, 500);
    return () => clearInterval(id);
  }, []);

  // Load setup status + speciality after backend is ready
  useEffect(() => {
    if (!backendReady) return;
    const API_BASE = window.__TAURI__ ? "" : "http://127.0.0.1:8000";
    fetch(`${API_BASE}/api/setup/status`)
      .then(r => r.json())
      .then(d => {
        setSetupDone(!!d.setup_complete);
        if (d.speciality) setSpecialityId(d.speciality);
      })
      .catch(() => setSetupDone(true)); // on error, don't block the app
  }, [backendReady]);

  useEffect(() => {
    if (user && backendReady) load();
  }, [user, backendReady]);

  useEffect(() => {
    if (!user) return;
    const timer = setTimeout(() => api.patients(search).then((data) => {
      setPatients(data.rows || []);
      setPatientTotal(data.filtered_total ?? data.total ?? data.rows?.length ?? 0);
    }).catch((err) => setError(err.message)), 180);
    return () => clearTimeout(timer);
  }, [search, user]);

  useEffect(() => {
    if (!selectedId) return;
    refreshPatient(selectedId).catch((err) => setError(err.message));
  }, [selectedId]);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.ctrlKey && event.key.toLowerCase() === "n") {
        event.preventDefault();
        startNewPatient();
      }
      if (event.ctrlKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        savePatient();
      }
      if (event.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  useEffect(() => {
    anime({
      targets: ".tool-card, .stat-card, .widget-panel, .blue-panel, .patient-card-modern, .dashboard-card, .info-item, .patient-hero",
      opacity: [0, 1],
      translateY: [12, 0],
      delay: anime.stagger(30),
      duration: 350,
      easing: "easeOutQuad"
    });
  }, [selectedId, page, activeTab, dashboard]);


  useEffect(() => {
    if (!selectedPatient?.id || activeTab !== "docs") return;
    const timer = window.setInterval(() => {
      refreshPatient(selectedPatient.id).catch((err) => setError(err.message));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedPatient?.id, activeTab]);

  useEffect(() => {
    const tunnelStatus = uploadMode?.tunnel?.status;
    const shouldPoll =
      uploadMode?.mode === "remote" &&
      (tunnelStatus === "starting" || !String(uploadMode?.active_url || "").startsWith("https://"));
    if (!shouldPoll) return;
    const timer = window.setInterval(() => {
      refreshUploadMode();
    }, 1500);
    return () => window.clearInterval(timer);
  }, [uploadMode?.mode, uploadMode?.tunnel?.status, uploadMode?.active_url]);

  const importantText = selectedPatient?.notes_importantes || selectedPatient?.allergies || "Aucune alerte patient selectionnee.";

  async function handleLogin(nextUser) {
    localStorage.setItem("cardio-user", JSON.stringify(nextUser));
    setUser(nextUser);
  }

  function startNewPatient() {
    setCreatingPatient(true);
    setPatientConflict(null);
    setSelectedId(null);
    setDetail(null);
    setPatientForm(blankPatient);
    setAiWarnings(null);
    setPage("patients");
  }

  function openPatient(patientId) {
    setCreatingPatient(false);
    setPatientConflict(null);
    setSelectedId(patientId);
    setPage("patients");
    setActiveTab("profile");
  }

  function openPatientDirectory() {
    setCreatingPatient(false);
    setPatientConflict(null);
    setSelectedId(null);
    setDetail(null);
    setPatientForm(blankPatient);
    setPage("patients");
  }

  function handleNavClick(navId) {
    setPage(navId);
    const tabMap = { "patients": "profile", "ecg-nav": "ecg", "imaging-nav": "imaging", "labs-nav": "imaging", "bmi-nav": "bmi", "medicines-nav": "medicines", "templates-nav": "templates", "settings-nav": "settings" };
    if (tabMap[navId]) setActiveTab(tabMap[navId]);
  }

  async function savePatient() {
    if (!String(patientForm.nom || "").trim() || !String(patientForm.prenom || "").trim()) {
      setError("Nom et prenom du patient sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const calculatedAge = calculateAgeFromBirthDate(patientForm.date_naissance);
      const payload = { ...patientForm, age: calculatedAge ? Number(calculatedAge) : (patientForm.age ? Number(patientForm.age) : null) };
      if (selectedPatient?.id) {
        await api.updatePatient(selectedPatient.id, payload);
        setPatientConflict(null);
        await load();
        await refreshPatient(selectedPatient.id);
      } else {
        const created = await api.createPatient(payload);
        setCreatingPatient(false);
        setPatientConflict(null);
        setSelectedId(created.id);
        await load();
        await refreshPatient(created.id);
        setActiveTab("profile");
      }
    } catch (saveError) {
      if (saveError.details?.existing_patient_id) {
        setPatientConflict(saveError.details);
      }
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function deletePatient() {
    if (!selectedPatient?.id) return;
    const patientId = selectedPatient.id;
    try {
      await api.deletePatient(patientId);
      // Clear all patient-related state immediately so UI doesn't show deleted data
      setDetail(null);
      setSelectedId(null);
      setCreatingPatient(false);
      setPatientForm(blankPatient);
      setPatientConflict(null);
      setPage("patients");
      setActiveTab("new-visit");
      setError("");
      // Reload list and dashboard in background
      await load();
    } catch (e) {
      setError(`Erreur suppression patient: ${e.message || "Erreur inconnue"}`);
    }
  }

  async function saveVisit() {
    if (!selectedPatient?.id) return;
    if (!String(visit.motif || "").trim() && !String(visit.diagnostics || "").trim()) {
      setError("Veuillez remplir au moins le motif ou le diagnostic.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.createVisit(selectedPatient.id, { ...visit, date_visite: visit.date_visite.replace("T", " ") });
      setVisit(blankVisit);
      await refreshPatient(selectedPatient.id);
      setDashboard(await api.dashboard());
    } catch (e) {
      setError(`Erreur enregistrement consultation: ${e.message || "Erreur inconnue"}`);
    } finally {
      setSaving(false);
    }
  }

  async function uploadDocument(type, file, notes) {
    if (!selectedPatient?.id) return;
    if (!file) { setError("Aucun fichier sélectionné."); return; }
    setError("");
    try {
      const form = new FormData();
      form.append("type_document", type);
      form.append("notes", notes || "");
      form.append("file", file);
      const result = await api.uploadDocument(selectedPatient.id, form);
      await refreshPatient(selectedPatient.id);
      setDashboard(await api.dashboard());
      return result;
    } catch (e) {
      setError(`Erreur upload document: ${e.message || "Erreur inconnue"}`);
      throw e;
    }
  }

  async function saveDocumentNotes(documentId, notes) {
    await api.updateDocumentNotes(documentId, { notes });
    setDetail((current) => ({
      ...current,
      documents: (current?.documents || []).map((doc) => doc.id === documentId ? { ...doc, notes } : doc)
    }));
  }

  async function savePrescription(lines) {
    if (!selectedPatient?.id) return;
    if (!lines?.length) { setError("Ordonnance vide."); return; }
    setError("");
    try {
      const result = await api.savePrescription({ patient_id: selectedPatient.id, lines, doctor_validated: false });
      setAiWarnings({ warnings: result.warnings });
      await refreshPatient(selectedPatient.id);
      if (result.id) window.open(`${apiBase}/api/prescriptions/${result.id}/pdf`, "_blank");
    } catch (e) {
      setError(`Erreur ordonnance: ${e.message || "Erreur inconnue"}`);
    }
  }

  async function aiCheck(meds, analyses) {
    if (!selectedPatient?.id) return;
    setError("");
    try {
      const result = await api.aiCheck({ patient_id: selectedPatient.id, medications: meds, analyses });
      setAiWarnings(result);
    } catch (e) {
      setError(`Erreur analyse IA: ${e.message || "Erreur inconnue"}`);
    }
  }

  async function runRiskScan() {
    if (!selectedPatient?.id) return;
    try {
      const result = await api.patientRiskScan(selectedPatient.id);
      setAiWarnings(result);
      setActiveTab("ai");
    } catch (scanError) {
      setError(scanError.message);
    }
  }

  async function saveAppointment(payload) {
    await api.createAppointment(payload);
    const [appts, dash] = await Promise.all([api.appointments(), api.dashboard()]);
    setAppointments(appts.rows);
    setDashboard(dash);
    await refreshPatient(payload.patient_id);
  }

  async function saveCardioProfile(payload) {
    if (!selectedPatient?.id) return;
    await api.updateCardioProfile(selectedPatient.id, payload);
    await refreshPatient(selectedPatient.id);
    setDashboard(await api.dashboard());
  }

  async function saveVitals(payload) {
    if (!selectedPatient?.id) return;
    await api.addVitals(selectedPatient.id, payload);
    await refreshPatient(selectedPatient.id);
    setDashboard(await api.dashboard());
  }

  async function saveLabs(payload) {
    if (!selectedPatient?.id) return;
    await api.addLabs(selectedPatient.id, payload);
    await refreshPatient(selectedPatient.id);
    setDashboard(await api.dashboard());
  }

  async function saveEcg(payload) {
    if (!selectedPatient?.id) return;
    const result = await api.addEcg(selectedPatient.id, payload);
    setAiWarnings({ warnings: result.findings });
    await refreshPatient(selectedPatient.id);
    setDashboard(await api.dashboard());
  }

  async function saveImaging(payload) {
    if (!selectedPatient?.id) return;
    await api.addImaging(selectedPatient.id, payload);
    await refreshPatient(selectedPatient.id);
    setDashboard(await api.dashboard());
  }

  async function saveDiagnosis(payload) {
    if (!selectedPatient?.id) return;
    await api.addDiagnosis(selectedPatient.id, payload);
    await refreshPatient(selectedPatient.id);
    setDashboard(await api.dashboard());
  }

  async function autoFollowup() {
    if (!selectedPatient?.id) return;
    await api.autoFollowup(selectedPatient.id);
    await refreshPatient(selectedPatient.id);
    setDashboard(await api.dashboard());
  }

  function dictateToVisit(field) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Dictee vocale non disponible dans ce navigateur.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || "";
      setVisit((current) => ({ ...current, [field]: `${current[field] || ""} ${transcript}`.trim() }));
    };
    recognition.start();
  }

  if (!backendReady && !backendFailed) return <BackendSplash />;
  if (backendFailed) return <BackendSplash failed />;
  if (!user) return <LoginGate onLogin={handleLogin} />;

  // Show first-launch setup wizard
  if (backendReady && !setupDone) {
    return (
      <SetupWizardPanel
        onDone={(spec, dataMode) => {
          setSpecialityId(spec);
          setSetupDone(true);
          if (dataMode === "import") setTimeout(() => setPage("import-legacy"), 500);
        }}
      />
    );
  }

  const isRemote = uploadMode?.mode === "remote" && Boolean(uploadMode?.remote_url);

  return (
    <main className={`app-shell ${navCollapsed ? "app-shell--collapsed" : ""}`}>
      {/* ---- SIDEBAR ---- */}
      <aside className="nav-sidebar">
        <div className="brand">
          <div className="brand-logo">
            <img src="/medismart-logo.png" alt="MediSmart" />
          </div>
          <div className="brand-text">
            <strong>MediSmart</strong>
            <small>Medical Intelligence</small>
          </div>
        </div>
        
        <nav>
          {sidebarSections.map((section) => (
            <div key={section.label} className="nav-group">
              <div className="nav-group-title">{section.label}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = page === item.id;
                return (
                  <button 
                    key={item.id} 
                    className={`nav-item ${isActive ? "is-active" : ""}`}
                    onClick={() => handleNavClick(item.id)}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="nav-footer">
          <button className="nav-item nav-item--logout" onClick={() => { localStorage.removeItem("cardio-user"); setUser(null); }}>
            <LogOut size={20} /> <span>Dأ©connexion</span>
          </button>
        </div>
      </aside>

      {/* ---- TOPBAR ---- */}
      <header className="topbar">
        <button className="sidebar-toggle" onClick={() => setNavCollapsed(!navCollapsed)}>
          <ChevronRight size={20} style={{ transform: navCollapsed ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.3s" }} />
        </button>

        <div className="topbar-search">
          <Search size={18} className="search-icon" />
          <input
            ref={searchRef}
            value={search}
            placeholder="Nom complet, prenom nom, telephone, code... ( / )"
            onChange={(event) => setSearch(event.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
          />
          {search.trim() && (
            <button className="topbar-search-clear" type="button" onMouseDown={(event) => { event.preventDefault(); setSearch(""); }}>
              <X size={14} />
            </button>
          )}
          
          {searchFocused && search.trim() && (
            <div className="search-dropdown">
              <div className="search-dropdown-header">
                <span>Resultats de recherche</span>
                <small>{visibleSearchResults.length} trouve(s)</small>
              </div>
              {visibleSearchResults.map((patient) => (
                <div
                  key={patient.id}
                  className="search-dropdown-item"
                  onMouseDown={(e) => { e.preventDefault(); openPatient(patient.id); setSearch(""); setSearchFocused(false); }}
                >
                  <div className={`patient-avatar-mini ${patientGenderClass(patient)}`}>
                    <GenderIcon patient={patient} size={16} />
                  </div>
                  <div className="patient-meta-mini">
                    <strong>{patient.nom} {patient.prenom}</strong>
                    <span>{patient.code || `ID ${patient.id}`} آ· {patient.age || "?"} ans آ· {patient.telephone || "Sans telephone"}</span>
                  </div>
                  <ChevronRight size={15} />
                </div>
              ))}
              {visibleSearchResults.length === 0 && <div className="search-dropdown-empty">Aucun resultat trouve</div>}
            </div>
          )}
        </div>

        <div className="topbar-actions">
          <button className="btn btn--primary" onClick={startNewPatient}>
            <Plus size={18} />
            <span>Nouveau Patient</span>
          </button>
          <button className="btn btn--secondary" onClick={runBackup}>
            <DatabaseBackup size={18} />
            <span>Sauvegarde</span>
          </button>
          <span className={`topbar-mode-badge ${uploadMode?.mode === "remote" && uploadMode?.active_url?.startsWith("https://") ? "is-remote" : "is-local"}`}>
            {uploadMode?.mode === "remote" && uploadMode?.active_url?.startsWith("https://") ? <Globe size={14} /> : <Wifi size={14} />}
            {uploadMode?.mode === "remote" && uploadMode?.active_url?.startsWith("https://") ? "Internet" : "Local"}
          </span>
          
          <div className="user-profile">
            <div className="user-info">
              <span className="user-name">Dr. {user.username}</span>
              <span className="user-role">Cardiologue</span>
            </div>
            <div className="user-avatar">
              {user.username?.charAt(0).toUpperCase() || "D"}
            </div>
          </div>
        </div>
      </header>

      {/* ---- MAIN ---- */}
      <div className="main-content">
        {backupMessage && <div className="soft-ok topbar-feedback">{backupMessage}</div>}
        {error && <div className="soft-error topbar-feedback">{error}</div>}
        {page === "dashboard" && <DashboardPageV2 dashboard={dashboard} onNav={handleNavClick} />}
        {page === "appointments-page" && <AppointmentsPage patients={patients} onSaveAppointment={saveAppointment} />}
        {page === "finance-page" && <FinancePage />}

        {page === "medicines-nav" && (
          <div className="directory-page">
            <header className="directory-header">
              <div className="directory-title">
                <h1>Base des mأ©dicaments</h1>
                <p>Consultez le rأ©fأ©rentiel thأ©rapeutique du logiciel et maintenez les fiches أ  jour.</p>
              </div>
            </header>
            <MedicineDatabasePanel />
          </div>
        )}

        {page === "ai-credits" && <AICreditsPage />}

        {page === "import-legacy" && (
          <div className="directory-page">
            <ImportWizardPanel />
          </div>
        )}

        {page === "settings-nav" && (
          <div className="directory-page settings-workspace">
            <header className="directory-header">
              <div className="directory-title">
                <h1>Réglages du cabinet</h1>
                <p>Spécialité, Cloudflare, Drive, IA, upload et paramètres avancés du médecin.</p>
              </div>
            </header>
            <SpecialitySettingsSection
              currentId={specialityId}
              onChange={(spec) => setSpecialityId(spec)}
            />
            <SettingsPanel uploadMode={uploadMode} onRefreshMode={refreshUploadMode} />
            <DoctorSettingsPanelV2 />
          </div>
        )}
        
        {/* Patient Section: Toggle between Directory and Dossier */}
        {(page === "patients" || (page !== "dashboard" && page !== "appointments-page" && page !== "finance-page" && page !== "medicines-nav" && page !== "ai-credits" && page !== "import-legacy" && page !== "settings-nav")) && (
          <>
            {creatingPatient ? (
              <NewPatientWorkspace
                form={patientForm}
                setForm={setPatientForm}
                onSave={savePatient}
                onReset={startNewPatient}
                onCancel={openPatientDirectory}
                saving={saving}
                duplicateMatches={duplicateMatches}
                patientConflict={patientConflict}
                onOpenExisting={openPatient}
              />
            ) : !selectedId ? (
              <div className="directory-page">
                <header className="directory-header">
                  <div className="directory-title">
                    <h1>Annuaire des Patients</h1>
                    {patientTotal > patients.length && (
                      <small>{patientTotal} dossiers au total. Utilisez la recherche pour charger seulement les resultats utiles.</small>
                    )}
                    <p>Gerez et consultez les dossiers de vos patients ({patients.length})</p>
                  </div>
                  <button className="btn btn--primary" onClick={startNewPatient}>
                    <Plus size={18} /> Nouveau Patient
                  </button>
                </header>
                
                <div className="directory-search-panel">
                  <div className="directory-search-field">
                    <Search size={18} />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Chercher par nom complet, prenom nom, telephone, code, adresse..."
                    />
                    {search.trim() && (
                      <button type="button" onClick={() => setSearch("")}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <span className="directory-search-count">{patients.length} affiche(s){search.trim() ? ` pour "${search.trim()}"` : ""}</span>
                </div>

                <div className="directory-grid">
                  {patients.map(p => (
                    <div key={p.id} className="patient-card-modern" onClick={() => openPatient(p.id)}>
                      <div className={`patient-card-avatar ${patientGenderClass(p)}`}>
                        <GenderIcon patient={p} size={24} />
                      </div>
                      <div className="patient-card-info">
                        <h3>{p.nom} {p.prenom}</h3>
                        <div className="patient-card-tags">
                          <span>ID: {p.code || p.id}</span>
                          <span>{p.age || "?"} ans</span>
                          {p.telephone && <span>{p.telephone}</span>}
                        </div>
                      </div>
                      <ChevronRight size={18} className="card-arrow" />
                    </div>
                  ))}
                </div>
                {patientTotal > patients.length && (
                  <div className="directory-more-note">
                    {patients.length} dossiers affiches sur {patientTotal}. Tapez un nom, prenom, telephone ou code dans la recherche.
                  </div>
                )}
              </div>
            ) : (
              <section className="patient-dossier">
                <div className="dossier-back-bar">
                  <button className="btn btn--secondary" onClick={() => { openPatientDirectory(); setActiveTab("profile"); }}>
                    <ChevronLeft size={18} /> Retour أ  l'annuaire
                  </button>
                  <div className="dossier-patient-mini">
                    <span className={`dossier-avatar ${patientGenderClass(selectedPatient)}`}>
                      <GenderIcon patient={selectedPatient} size={18} />
                    </span>
                    <span className="dossier-name">{fullname(selectedPatient)}</span>
                  </div>
                </div>

                <div className="dossier-grid">
                  <div className="dossier-main">
                    <PatientHeaderCard patient={selectedPatient} onTab={setActiveTab} onRiskScan={runRiskScan} />
                    <MedicalWorkspace
                      activeTab={activeTab}
                      setActiveTab={setActiveTab}
                      specialityConfig={specialityConfig}
                      patient={selectedPatient}
                      detail={detail}
                      onUpload={uploadDocument}
                      onSaveDocumentNotes={saveDocumentNotes}
                      onSavePrescription={savePrescription}
                      medications={medications}
                      aiWarnings={aiWarnings}
                      onAiCheck={aiCheck}
                      appointments={appointments}
                      onSaveAppointment={saveAppointment}
                      onSaveCardioProfile={saveCardioProfile}
                      onSaveVitals={saveVitals}
                      onSaveLabs={saveLabs}
                      onSaveEcg={saveEcg}
                      onSaveImaging={saveImaging}
                      onSaveDiagnosis={saveDiagnosis}
                      onAutoFollowup={autoFollowup}
                      uploadMode={uploadMode}
                      onRefreshMode={refreshUploadMode}
                      visit={visit}
                      setVisit={setVisit}
                      onSaveVisit={saveVisit}
                      onDictate={dictateToVisit}
                      patientForm={patientForm}
                      setPatientForm={setPatientForm}
                      onNewPatient={startNewPatient}
                      onSavePatient={savePatient}
                      onDeletePatient={deletePatient}
                      saving={saving}
                    />
                  </div>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
