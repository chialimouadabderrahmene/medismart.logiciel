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
  HelpCircle,
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
  SlidersHorizontal,
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
  Printer,
  MessageCircle,
  Send,
  Star,
  Info,
  TestTube,
  CheckSquare,
  Edit3,
  Loader2,
  PlusCircle,
  Hash,
  FolderOpen,
  Table2,
  Image,
  Type,
  Strikethrough,
  Minus,
  Columns,
  Database,
  Layers,
  ChevronDown,
} from "lucide-react";
import { api, apiBase } from "./api.js";
import ImportWizardPanel from "./ImportWizardPanel.jsx";
import SetupWizardPanel from "./SetupWizardPanel.jsx";
import SpecialityFieldsPanel from "./SpecialityFieldsPanel.jsx";
import PatientWorkstation from "./PatientWorkstation.jsx";
import DoctorsPage from "./DoctorsPage.jsx";
import DiagnosticPage from "./DiagnosticPage.jsx";
import { PatientsListPage, TodayPatientsPage, AppointmentsPageV2 } from "./PatientNavPages.jsx";
import { getSpecialityConfig, buildTabList, SPECIALITY_LIST } from "./specialities/index.js";
import { cloudAi, getCloudConfig, saveCloudConfig, isCloudConfigured } from "./cloudAi.js";

const DIRECTORY_PAGE_SIZE = 50;

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
  notes_importantes: "",
  antecedents: "",
  cin: "",
  tabagisme: "",
  antecedents_chirurgicaux: "",
  antecedents_familiaux: "",
  antecedents_gyneco: "",
  autres_antecedents: "",
  alcool: "",
  sport: ""
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
  visit_type: "",
  mode_paiement: ""
};

const blankAppointment = {
  title: "Consultation cardiologie",
  scheduled_at: new Date().toISOString().slice(0, 16),
  status: "normal",
  reminder_channel: "whatsapp",
  reminder_note: "",
  notes: ""
};

const aiSafetyWarning = "Analyse IA à vérifier par le médecin.";
const AI_DECISION_SUPPORT_WARNING = "Analyse IA à vérifier par le médecin";

const OR_DEFAULT_MODEL_NAME = "qwen/qwen-2.5-7b-instruct";

const medicalTabs = [
  { id: "profile", label: "Profil Cardio", icon: ShieldCheck },
  { id: "vitals", label: "Constantes", icon: Activity },
  { id: "bmi", label: "IMC / Tour taille", icon: Scale },
  { id: "ecg", label: "ECG", icon: FileImage },
  { id: "scores", label: "Scores", icon: AlertTriangle },
  { id: "imaging", label: "Imagerie / Labs", icon: Stethoscope },
  { id: "diagnosis", label: "Diagnostic / Traitement", icon: Pill },
  { id: "bilan", label: "Bilan / Examens", icon: FlaskConical },
  { id: "followup", label: "Suivi", icon: CalendarDays },
  { id: "docs", label: "Documents", icon: FileImage },
  { id: "templates", label: "Modèles", icon: FileCheck },
  { id: "medicines", label: "Base Médicaments", icon: BookOpen },
  { id: "ai", label: "AI Médical", icon: Bot },
  { id: "settings", label: "Paramètres", icon: Settings }
];

const sidebarSections = [
  {
    label: "Général",
    items: [
      { id: "dashboard", label: "Tableau de bord", icon: LayoutDashboard },
      { id: "patients-list", label: "Liste des Patients", icon: Users },
      { id: "patients-today", label: "Patients vus aujourd'hui", icon: Stethoscope },
      { id: "appointments-page", label: "Rendez-vous", icon: CalendarDays },
    ],
  },
  {
    label: "Outils",
    items: [
      { id: "medicines-nav", label: "Médicaments", icon: BookOpen },
      { id: "ai-credits", label: "AI & Crédits", icon: Bot },
    ],
  },
  {
    label: "Administration",
    items: [
      { id: "finance-page", label: "Gestion Finance", icon: DollarSign },
      { id: "import-legacy", label: "Import ancienne base", icon: Upload },
      { id: "settings-nav", label: "Paramètres", icon: Settings },
    ],
  },
];


function fieldValue(value) {
  return value ?? "";
}

// Auto-detect inverted nom/prenom from legacy import.
// Heuristic: if prenom is ALL-UPPERCASE (≥3 chars) and nom has lowercase letters,
// the columns are swapped — return the corrected pair for display.
function correctName(rawNom, rawPrenom) {
  const nom = (rawNom || "").trim();
  const prenom = (rawPrenom || "").trim();
  if (!nom || !prenom) return { nom: nom.toUpperCase(), prenom };
  const prenomLooksLikeFamily = prenom.length >= 3 && prenom === prenom.toUpperCase() && /[A-ZÀ-ÿ]/.test(prenom);
  const nomLooksLikeFirst = /[a-zà-ÿ]/.test(nom);
  if (prenomLooksLikeFamily && nomLooksLikeFirst) {
    return { nom: prenom.toUpperCase(), prenom: nom.charAt(0).toUpperCase() + nom.slice(1).toLowerCase() };
  }
  return { nom: nom.toUpperCase(), prenom };
}

function fullname(patient) {
  if (!patient) return "Nouveau patient";
  // DB has nom=first_name, prenom=last_name (swapped from legacy import)
  const nom = (patient.prenom || "").trim().toUpperCase();
  const prenom = (patient.nom || "").trim();
  return [nom, prenom].filter(Boolean).join(" ") || "Nouveau patient";
}

function displayValue(value, fallback = "Non renseigne") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function patientInitials(patient) {
  // DB swapped: prenom=family name, nom=first name
  const first = String(patient?.prenom || patient?.nom || "?").trim().slice(0, 1);
  const second = String(patient?.nom || "").trim().slice(0, 1);
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
  const male = isMalePatient(patient);
  const color = male ? "#2563eb" : "#ec4899";
  return male ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="Homme">
      <circle cx="12" cy="12" r="10" /><path d="M16 8l4-4M20 8l-4-4M20 8v4" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-label="Femme">
      <circle cx="12" cy="12" r="10" /><path d="M12 16v6M9 20h6" />
    </svg>
  );
}

// ── WhatsApp integration ──
// Normalizes an Algerian/international phone number and opens a WhatsApp
// chat (wa.me). Works with the installed WhatsApp Desktop app on Windows
// or WhatsApp Web in the default browser — no API key or setup needed.
function normalizePhoneForWhatsApp(raw) {
  if (!raw) return null;
  let digits = String(raw).replace(/[^\d+]/g, "");
  // Drop leading "+" then re-add
  if (digits.startsWith("+")) digits = digits.slice(1);
  // Handle local Algerian format starting with 0
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "213" + digits.slice(1); // default: Algeria
  // Strip anything non-numeric left
  digits = digits.replace(/\D/g, "");
  return digits || null;
}

function openWhatsApp(phone, message = "") {
  const normalized = normalizePhoneForWhatsApp(phone);
  if (!normalized) {
    alert("Numéro de téléphone invalide. Format attendu: 0555xxxxxx ou +213555xxxxxx");
    return;
  }
  const encoded = message ? `?text=${encodeURIComponent(message)}` : "";
  const url = `https://wa.me/${normalized}${encoded}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

function WhatsAppButton({ phone, patient, message, children, style, className, compact = false }) {
  if (!phone) return null;
  const defaultMsg = message ||
    (patient ? `Bonjour ${patient.prenom || ""}, ` : "");
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => { e.stopPropagation(); openWhatsApp(phone, defaultMsg); }}
      title={`Envoyer un message WhatsApp à ${phone}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: compact ? 4 : 6,
        padding: compact ? "3px 8px" : "6px 12px", borderRadius: 999,
        background: "#25D366", color: "#fff", border: "none",
        fontSize: compact ? 11 : 12, fontWeight: 600, cursor: "pointer",
        transition: "all .15s",
        ...style,
      }}
      onMouseOver={(e) => e.currentTarget.style.background = "#1da851"}
      onMouseOut={(e) => e.currentTarget.style.background = "#25D366"}
    >
      <MessageCircle size={compact ? 11 : 14} />
      {children || (compact ? "WA" : "WhatsApp")}
    </button>
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

const trackedClinicalOrder = ["ldl", "hdl", "hba1c", "glycemie", "tas", "tad", "fc"];
const trackedClinicalLabels = {
  ldl: "LDL",
  hdl: "HDL",
  hba1c: "HbA1c",
  glycemie: "Glycemie",
  tas: "TAS",
  tad: "TAD",
  fc: "FC"
};

function normalizeClinicalAnalyte(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/[^a-z0-9/% ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTrackedClinicalValues(values) {
  const found = new Map();
  (values || []).forEach((item) => {
    const analyte = normalizeClinicalAnalyte(item?.analyte);
    const rawValue = String(item?.value || "").trim();
    if (!rawValue) return;
    if (["ta", "tension", "tension arterielle", "blood pressure"].includes(analyte)) {
      const match = rawValue.match(/(\d{2,3})\s*[/\-]\s*(\d{2,3})/);
      if (match) {
        found.set("tas", { key: "tas", label: "TAS", value: match[1], unit: "mmHg", source: item.analyte || "TA" });
        found.set("tad", { key: "tad", label: "TAD", value: match[2], unit: "mmHg", source: item.analyte || "TA" });
      }
      return;
    }
    const aliases = {
      ldl: "ldl",
      hdl: "hdl",
      hba1c: "hba1c",
      "hb a1c": "hba1c",
      "hemoglobine glyquee": "hba1c",
      glucose: "glycemie",
      glycemie: "glycemie",
      "glycemie a jeun": "glycemie",
      tas: "tas",
      pas: "tas",
      sbp: "tas",
      tad: "tad",
      pad: "tad",
      dbp: "tad",
      fc: "fc",
      hr: "fc",
      "frequence cardiaque": "fc",
      pouls: "fc"
    };
    const key = aliases[analyte];
    if (!key) return;
    found.set(key, {
      key,
      label: trackedClinicalLabels[key],
      value: rawValue,
      unit: String(item?.unit || "").trim(),
      source: item?.analyte || trackedClinicalLabels[key]
    });
  });
  return trackedClinicalOrder.map((key) => found.get(key)).filter(Boolean);
}

function riskLevelClass(level) {
  const normalized = String(level || "").toLowerCase().replace("é", "e");
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
  // Simple windowing: render only the visible slice + a buffer so long lists
  // (10k+ patients) stay smooth. Each row is fixed-height (~52px).
  const ROW_HEIGHT = 52;
  const BUFFER = 8;
  const scrollerRef = useRef(null);
  const [viewport, setViewport] = useState({ top: 0, height: 600 });

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setViewport((v) => ({ ...v, top: el.scrollTop }));
    const onResize = () => setViewport({ top: el.scrollTop, height: el.clientHeight });
    onResize();
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  if (patients.length === 0) {
    return (
      <div className="empty-state">
        <Users size={32} />
        <strong>Aucun patient</strong>
        <span>Commencez par ajouter un patient.</span>
      </div>
    );
  }

  // Virtualize only when the list is big enough; small lists render directly
  const virtualize = patients.length > 80;
  const startIdx = virtualize
    ? Math.max(0, Math.floor(viewport.top / ROW_HEIGHT) - BUFFER)
    : 0;
  const visibleCount = virtualize
    ? Math.ceil(viewport.height / ROW_HEIGHT) + BUFFER * 2
    : patients.length;
  const endIdx = Math.min(patients.length, startIdx + visibleCount);
  const visiblePatients = patients.slice(startIdx, endIdx);
  const topPadding = startIdx * ROW_HEIGHT;
  const bottomPadding = (patients.length - endIdx) * ROW_HEIGHT;

  const row = (patient) => {
    const isActive = patient.id === selectedId;
    return (
      <button
        key={patient.id}
        className={`patient-row ${isActive ? "is-active" : ""}`}
        onClick={() => onSelect(patient.id)}
        style={{ height: ROW_HEIGHT }}
      >
        <div className={`patient-row-avatar ${patientGenderClass(patient)}`}>
          <GenderIcon patient={patient} size={18} />
        </div>
        <div className="patient-row-info">
          <strong>{patient.prenom} {patient.nom}</strong>
          <span>{patient.code || patient.id} • {patient.age || "?"} ans</span>
        </div>
        {patient.telephone && (
          <MessageCircle
            size={14}
            color="#25D366"
            style={{ marginRight: 6, flexShrink: 0 }}
            onClick={(e) => { e.stopPropagation(); openWhatsApp(patient.telephone, `Bonjour ${patient.prenom || ""}, `); }}
            aria-label="Envoyer WhatsApp"
          />
        )}
        {isActive && <ChevronRight size={14} className="patient-row-arrow" />}
      </button>
    );
  };

  return (
    <div className="patient-list" ref={scrollerRef} style={{ overflowY: "auto", position: "relative" }}>
      {virtualize ? (
        <>
          <div style={{ height: topPadding }} />
          {visiblePatients.map(row)}
          <div style={{ height: bottomPadding }} />
        </>
      ) : (
        patients.map(row)
      )}
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
  const greeting = now.getHours() < 12 ? "Bonjour" : now.getHours() < 18 ? "Bon après-midi" : "Bonsoir";
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const cardioStats = [
    { label: "HTA", value: stats.hta || 0 },
    { label: "Diabète", value: stats.diabete || 0 },
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
          <p>{dateStr} — Voici le résumé de votre activité.</p>
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
                <span className="dash-pro-alert__sep">—</span>
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

// ─── AnalyticsHub: parent with internal tabs (Vue d'ensemble / Finance) ───
function AnalyticsHub({ dashboard, onNav }) {
  const [tab, setTab] = useState("overview");
  const [fixMsg, setFixMsg] = useState("");
  const [fixing, setFixing] = useState(false);

  async function runFixNameSwap() {
    if (!window.confirm("Détecter et corriger les patients dont Nom/Prénom sont inversés ?")) return;
    setFixing(true);
    setFixMsg("");
    try {
      const r = await fetch("/api/admin/fix-name-swap", { method: "POST" });
      const data = await r.json();
      setFixMsg(`✓ ${data.total_fixed} patient(s) corrigé(s).`);
    } catch (e) {
      setFixMsg("Erreur : " + e.message);
    } finally {
      setFixing(false);
      setTimeout(() => setFixMsg(""), 6000);
    }
  }

  const tabs = [
    { id: "overview", label: "VUE D'ENSEMBLE", sub: "KPIs & activité du cabinet", icon: BarChart3 },
    { id: "finance",  label: "FINANCE DÉTAILLÉE", sub: "Recettes, impayés, encaissements", icon: DollarSign },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#f1f5f9" }}>
      {/* Inner tab bar */}
      <div style={{ display: "flex", alignItems: "stretch", background: "#fff", borderBottom: "1px solid #e2e8f0", flexShrink: 0, paddingLeft: 18 }}>
        {tabs.map(({ id, label, sub, icon: Icon }) => {
          const active = tab === id;
          return (
            <button key={id} onClick={() => setTab(id)}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 22px", border: "none", background: "transparent", borderBottom: `3px solid ${active ? "#2563eb" : "transparent"}`, color: active ? "#1e40af" : "#64748b", cursor: "pointer", fontFamily: "inherit" }}>
              <Icon size={16} />
              <div style={{ textAlign: "left" }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: ".4px" }}>{label}</div>
                <div style={{ fontSize: 9.5, opacity: .65, marginTop: 1 }}>{sub}</div>
              </div>
            </button>
          );
        })}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, padding: "0 18px" }}>
          {fixMsg && <span style={{ fontSize: 11.5, fontWeight: 600, color: fixMsg.startsWith("✓") ? "#059669" : "#dc2626" }}>{fixMsg}</span>}
          <button onClick={runFixNameSwap} disabled={fixing}
            title="Corriger les patients dont Nom et Prénom ont été inversés à l'import"
            style={{ padding: "6px 12px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: fixing ? 0.6 : 1 }}>
            {fixing ? "Correction…" : "⇄ Corriger Nom/Prénom inversés"}
          </button>
        </div>
      </div>
      {/* Tab content */}
      <div style={{ flex: 1, overflow: "hidden", minHeight: 0 }}>
        {tab === "overview" && <DashboardPageV2 dashboard={dashboard} onNav={onNav} />}
        {tab === "finance"  && <FinancePage />}
      </div>
    </div>
  );
}

function DashboardPageV2({ dashboard, onNav }) {
  const counts = dashboard?.counts || {};
  const stats = dashboard?.cardio_stats || {};
  const appointments = dashboard?.appointments_today || [];
  const alerts = dashboard?.alerts || [];
  const latest = dashboard?.latest || [];
  const finance = dashboard?.finance || {};
  const recentImports = dashboard?.recent_imports || [];
  const aiToday = dashboard?.ai_today || {};
  const n = (v) => Number(v || 0);
  const fmtMoney = (v) => `${(v || 0).toLocaleString("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} DA`;
  const fmtShort = (v) => {
    const x = Number(v || 0);
    if (x >= 1_000_000) return (x / 1_000_000).toFixed(1).replace(".0", "") + "M";
    if (x >= 1_000)     return (x / 1_000).toFixed(1).replace(".0", "") + "k";
    return String(x);
  };

  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const dateStr = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  // Main KPI cards (4 big)
  const heroKpis = [
    { icon: Users,        label: "Patients",       value: fmtShort(counts.patients),         detail: `${n(counts.visits)} consultations totales`, color: "#2563eb", bg: "#eff6ff", trend: n(finance.visits_today), trendLabel: "aujourd'hui" },
    { icon: DollarSign,   label: "Recette du jour",value: fmtMoney(finance.revenue_today),  detail: `Mois: ${fmtMoney(finance.revenue_month)}`, color: "#059669", bg: "#ecfdf5", trend: n(finance.visits_today), trendLabel: "encaissements" },
    { icon: Stethoscope,  label: "Consultations",  value: n(finance.visits_today),           detail: `${n(finance.appointments_today)} RDV planifiés`, color: "#7c3aed", bg: "#f5f3ff", trend: n(counts.prescriptions), trendLabel: "ordonnances" },
    { icon: WalletCards,  label: "Impayés",        value: fmtMoney(finance.unpaid_total),   detail: "Reste à percevoir", color: finance.unpaid_total > 0 ? "#dc2626" : "#64748b", bg: finance.unpaid_total > 0 ? "#fef2f2" : "#f8fafc", trend: null, trendLabel: "" },
  ];

  // Secondary stats strip
  const mini = [
    { icon: UserRound,   label: "Médecins actifs", value: n(counts.doctors),       color: "#0284c7" },
    { icon: Pill,        label: "Ordonnances",     value: n(counts.prescriptions), color: "#db2777" },
    { icon: FileText,    label: "Documents",       value: n(counts.documents),     color: "#ea580c" },
    { icon: FlaskConical,label: "Examens labo",    value: n(counts.labs),          color: "#ca8a04" },
    { icon: BookOpen,    label: "Médicaments",     value: fmtShort(counts.medications), color: "#9333ea" },
    { icon: Bot,         label: "Requêtes AI",     value: n(aiToday.requests),     color: "#0891b2" },
  ];

  const cardioBars = [
    { label: "HTA",          value: n(stats.hta),          color: "#dc2626" },
    { label: "Diabète",      value: n(stats.diabete),      color: "#d97706" },
    { label: "Coronarien",   value: n(stats.cad),          color: "#7c3aed" },
    { label: "Insuf. card.", value: n(stats.hf),           color: "#0891b2" },
    { label: "ACFA",         value: n(stats.acfa),         color: "#059669" },
    { label: "Haut risque",  value: n(stats.high_risk),    color: "#be123c" },
  ];
  const maxBar = Math.max(...cardioBars.map((b) => b.value), 1);

  const attentionItems = alerts.map((item) => {
    const message = item.notes_importantes || item.allergies || item.maladies || "Alerte dossier patient";
    const level = item.notes_importantes ? "danger" : "warning";
    return { ...item, level, title: fullname(item), message, meta: item.code || `ID ${item.id}` };
  });

  // ─── Modern dashboard styles (scoped, no external CSS) ─────────────
  const S = {
    wrap:    { padding: 20, height: "100%", overflow: "auto", background: "#f1f5f9", display: "flex", flexDirection: "column", gap: 16 },
    hero:    { background: "linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)", borderRadius: 16, padding: "22px 28px", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 8px 24px rgba(29,78,216,.25)", flexWrap: "wrap", gap: 14 },
    heroL:   { display: "flex", flexDirection: "column", gap: 4 },
    heroEye: { fontSize: 11, fontWeight: 700, letterSpacing: ".8px", textTransform: "uppercase", opacity: .75 },
    heroH:   { margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: "-.02em" },
    heroSub: { margin: 0, fontSize: 13.5, opacity: .9, textTransform: "capitalize" },
    heroR:   { display: "flex", gap: 8, alignItems: "center" },
    heroBtn: { display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.25)", borderRadius: 10, fontSize: 12.5, fontWeight: 700, cursor: "pointer", backdropFilter: "blur(6px)" },
    kpiGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 14 },
    kpi:     (c, bg) => ({ background: "#fff", borderRadius: 14, padding: 18, boxShadow: "0 1px 3px rgba(15,23,42,.06)", border: "1px solid #e2e8f0", borderLeft: `4px solid ${c}`, display: "flex", flexDirection: "column", gap: 10, transition: "transform .15s, box-shadow .15s", cursor: "default" }),
    kpiHd:   { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
    kpiLbl:  { fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".5px" },
    kpiIc:   (c, bg) => ({ width: 36, height: 36, borderRadius: 10, background: bg, color: c, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }),
    kpiVal:  (c) => ({ fontSize: 28, fontWeight: 800, color: c, letterSpacing: "-.02em", lineHeight: 1 }),
    kpiDet:  { fontSize: 11.5, color: "#94a3b8", marginTop: 2 },
    kpiTrend:(c) => ({ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, color: c, background: `${c}14`, padding: "2px 7px", borderRadius: 999, marginTop: 6 }),
    miniRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 },
    mini:    (c) => ({ background: "#fff", borderRadius: 10, padding: "12px 14px", border: "1px solid #e2e8f0", display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 2px rgba(15,23,42,.04)" }),
    miniIc:  (c) => ({ width: 32, height: 32, borderRadius: 8, background: `${c}15`, color: c, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }),
    miniL:   { fontSize: 10.5, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".3px" },
    miniV:   { fontSize: 17, fontWeight: 800, color: "#0f172a" },
    grid2:   { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 },
    card:    { background: "#fff", borderRadius: 14, border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(15,23,42,.05)", display: "flex", flexDirection: "column", overflow: "hidden" },
    cardHd:  { padding: "14px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", justifyContent: "space-between" },
    cardT:   { margin: 0, fontSize: 14.5, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 },
    cardSub: { fontSize: 11, color: "#94a3b8", fontWeight: 500 },
    link:    { fontSize: 12, fontWeight: 700, color: "#2563eb", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 },
    cardBd:  { padding: "12px 18px", flex: 1, overflow: "auto", maxHeight: 340 },
    apptRow: (urgent) => ({ display: "grid", gridTemplateColumns: "60px 1fr auto", gap: 12, alignItems: "center", padding: "11px 0", borderBottom: "1px solid #f1f5f9" }),
    apptTime:(urgent) => ({ fontSize: 13, fontWeight: 800, color: urgent ? "#dc2626" : "#1e40af", background: urgent ? "#fef2f2" : "#eff6ff", padding: "5px 9px", borderRadius: 7, textAlign: "center" }),
    apptN:   { fontSize: 13, fontWeight: 700, color: "#0f172a", marginBottom: 1 },
    apptM:   { fontSize: 11.5, color: "#64748b" },
    apptTag: (urgent) => ({ fontSize: 10, fontWeight: 700, color: urgent ? "#dc2626" : "#059669", textTransform: "uppercase", letterSpacing: ".4px" }),
    alertRow:(lvl) => ({ display: "flex", gap: 10, padding: "10px 0", borderBottom: "1px solid #f1f5f9" }),
    alertIc: (lvl) => ({ width: 30, height: 30, borderRadius: 8, background: lvl === "danger" ? "#fee2e2" : "#fef3c7", color: lvl === "danger" ? "#dc2626" : "#d97706", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }),
    empty:   { padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 12.5, fontStyle: "italic" },
    cardio:  { display: "flex", flexDirection: "column", gap: 10 },
    barRow:  { display: "grid", gridTemplateColumns: "110px 1fr 40px", gap: 10, alignItems: "center" },
    barLbl:  { fontSize: 12, color: "#0f172a", fontWeight: 600 },
    barTrack:{ height: 8, background: "#f1f5f9", borderRadius: 999, overflow: "hidden" },
    barFill: (c, w) => ({ height: "100%", width: `${w}%`, background: c, borderRadius: 999, transition: "width .4s ease" }),
    barVal:  { fontSize: 13, fontWeight: 800, color: "#0f172a", textAlign: "right" },
    qa:      { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 },
    qaBtn:   (c, bg) => ({ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: bg, border: `1px solid ${c}33`, borderRadius: 10, cursor: "pointer", textAlign: "left" }),
    qaIc:    (c) => ({ width: 34, height: 34, borderRadius: 9, background: "#fff", color: c, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 1px 4px ${c}33` }),
    qaL:     (c) => ({ fontSize: 12.5, fontWeight: 700, color: c, flex: 1 }),
  };

  return (
    <div style={S.wrap}>
      {/* ─── HERO HEADER ─── */}
      <header style={S.hero}>
        <div style={S.heroL}>
          <span style={S.heroEye}>Tableau de bord · {timeStr}</span>
          <h1 style={S.heroH}>{greeting}, Docteur</h1>
          <p style={S.heroSub}>{dateStr}</p>
        </div>
        <div style={S.heroR}>
          <button style={S.heroBtn} onClick={() => onNav("patients")}><Users size={15} /> Nouveau patient</button>
          <button style={S.heroBtn} onClick={() => onNav("appointments-page")}><CalendarDays size={15} /> Agenda</button>
          <button style={S.heroBtn} onClick={() => onNav("finance-page")}><DollarSign size={15} /> Finance</button>
        </div>
      </header>

      {/* ─── 4 HERO KPI CARDS ─── */}
      <section style={S.kpiGrid}>
        {heroKpis.map(({ icon: Icon, label, value, detail, color, bg, trend, trendLabel }) => (
          <div key={label} style={S.kpi(color, bg)}>
            <div style={S.kpiHd}>
              <div>
                <div style={S.kpiLbl}>{label}</div>
                <div style={S.kpiVal(color)}>{value}</div>
                <div style={S.kpiDet}>{detail}</div>
              </div>
              <div style={S.kpiIc(color, bg)}><Icon size={18} /></div>
            </div>
            {trend !== null && trend > 0 && (
              <span style={S.kpiTrend(color)}>▲ {trend} {trendLabel}</span>
            )}
          </div>
        ))}
      </section>

      {/* ─── MINI STATS STRIP ─── */}
      <section style={S.miniRow}>
        {mini.map(({ icon: Icon, label, value, color }) => (
          <div key={label} style={S.mini(color)}>
            <div style={S.miniIc(color)}><Icon size={16} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={S.miniL}>{label}</div>
              <div style={S.miniV}>{value}</div>
            </div>
          </div>
        ))}
      </section>

      {/* ─── GRID: AGENDA (2) + ALERTS (1) ─── */}
      <section style={S.grid2}>
        {/* Agenda */}
        <div style={S.card}>
          <div style={S.cardHd}>
            <h2 style={S.cardT}><CalendarDays size={15} color="#2563eb" /> Agenda d'aujourd'hui <span style={S.cardSub}>({appointments.length})</span></h2>
            <button style={S.link} onClick={() => onNav("appointments-page")}>Tout voir <ChevronRight size={12} /></button>
          </div>
          <div style={S.cardBd}>
            {appointments.length === 0 ? (
              <div style={S.empty}>Aucun rendez-vous aujourd'hui</div>
            ) : appointments.slice(0, 8).map((a) => {
              const urgent = a.status === "urgent";
              return (
                <div key={a.id} style={S.apptRow(urgent)}>
                  <div style={S.apptTime(urgent)}>{String(a.scheduled_at || "").slice(11, 16) || "--:--"}</div>
                  <div>
                    <div style={S.apptN}>{fullname(a)}</div>
                    <div style={S.apptM}>{a.motif || a.title || "Consultation"}</div>
                  </div>
                  <div style={S.apptTag(urgent)}>{urgent ? "Urgent" : "Planifié"}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Alerts */}
        <div style={S.card}>
          <div style={S.cardHd}>
            <h2 style={S.cardT}><AlertTriangle size={15} color="#dc2626" /> Patients à surveiller</h2>
            <span style={{ ...S.cardSub, fontWeight: 700, color: "#dc2626" }}>{attentionItems.length}</span>
          </div>
          <div style={S.cardBd}>
            {attentionItems.length === 0 ? (
              <div style={S.empty}>Aucune alerte active</div>
            ) : attentionItems.slice(0, 6).map((it) => (
              <div key={it.id} style={S.alertRow(it.level)}>
                <div style={S.alertIc(it.level)}><AlertTriangle size={14} /></div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{it.title}</div>
                  <div style={{ fontSize: 11.5, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.message}</div>
                  <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 1 }}>{it.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── GRID: CARDIO BARS + LATEST VISITS ─── */}
      <section style={S.grid2}>
        <div style={S.card}>
          <div style={S.cardHd}>
            <h2 style={S.cardT}><Activity size={15} color="#7c3aed" /> Charge clinique cardiologique</h2>
          </div>
          <div style={{ ...S.cardBd, maxHeight: "none" }}>
            <div style={S.cardio}>
              {cardioBars.map((b) => (
                <div key={b.label} style={S.barRow}>
                  <div style={S.barLbl}>{b.label}</div>
                  <div style={S.barTrack}><div style={S.barFill(b.color, (b.value / maxBar) * 100)} /></div>
                  <div style={S.barVal}>{b.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={S.card}>
          <div style={S.cardHd}>
            <h2 style={S.cardT}><Clock size={15} color="#059669" /> Consultations récentes</h2>
            <button style={S.link} onClick={() => onNav("patients")}>Patients <ChevronRight size={12} /></button>
          </div>
          <div style={S.cardBd}>
            {latest.length === 0 ? (
              <div style={S.empty}>Aucune consultation</div>
            ) : latest.slice(0, 6).map((v) => (
              <div key={v.id} style={{ padding: "10px 0", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{fullname(v)}</div>
                <div style={{ fontSize: 11, color: "#64748b", margin: "2px 0" }}>{String(v.date_visite || "").replace("T", " ").slice(0, 16) || "—"}</div>
                <div style={{ fontSize: 11.5, color: "#475569", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.motif || v.diagnostics || "Consultation"}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── QUICK ACTIONS ─── */}
      <section style={S.qa}>
        {[
          { icon: Plus,         label: "Nouveau patient", target: "patients",          color: "#2563eb", bg: "#eff6ff" },
          { icon: CalendarDays, label: "Planifier RDV",   target: "appointments-page", color: "#059669", bg: "#ecfdf5" },
          { icon: BookOpen,     label: "Base médicaments",target: "medicines-nav",     color: "#7c3aed", bg: "#f5f3ff" },
          { icon: DollarSign,   label: "Finance & caisse",target: "finance-page",      color: "#d97706", bg: "#fffbeb" },
          { icon: Settings,     label: "Modèles & config",target: "settings-nav",      color: "#0284c7", bg: "#f0f9ff" },
          { icon: Upload,       label: "Importer base",   target: "import-legacy",     color: "#db2777", bg: "#fdf2f8" },
        ].map(({ icon: Icon, label, target, color, bg }) => (
          <button key={label} style={S.qaBtn(color, bg)} onClick={() => onNav(target)}
            onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${color}25`; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
            <div style={S.qaIc(color)}><Icon size={16} /></div>
            <div style={S.qaL(color)}>{label}</div>
            <ChevronRight size={14} color={color} />
          </button>
        ))}
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
              {p === "today" ? "Aujourd'hui" : p === "week" ? "Cette Semaine" : p === "month" ? "Ce Mois" : "Personnalisé"}
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
            <SelectField label="Priorité" value={form.status} onChange={(v) => setForm({ ...form, status: v })}>
              <option value="normal">Normal</option>
              <option value="urgent">Urgent</option>
            </SelectField>
          </div>
          <TextArea label="Notes complémentaires" value={form.notes || ""} onChange={(v) => setForm({ ...form, notes: v })} />
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
                      {r.status === "urgent" ? "Urgent" : r.status === "done" ? "Terminé" : "Planifié"}
                    </span>
                  </td>
                  <td>
                    <button className="btn-icon" title="Détails"><Eye size={16} /></button>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading && (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px' }}>
                    <div className="empty-state">
                      <CalendarDays size={48} />
                      <p>Aucun rendez-vous trouvé pour cette période.</p>
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
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef(null);

  useEffect(() => {
    if (!moreOpen) return;
    const close = (e) => { if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [moreOpen]);

  if (!patient?.id) {
    return (
      <section style={{ padding: "28px 24px", textAlign: "center", background: "#fff", borderRadius: 12, border: "1px solid #eef2f7", color: "#64748b" }}>
        <strong style={{ fontSize: 14, color: "#0f172a" }}>Aucun patient sélectionné</strong>
      </section>
    );
  }

  const txt = `${patient.maladies || ""} ${patient.notes_importantes || ""} ${patient.traitement_en_cours || ""}`.toLowerCase();
  const hasAllergies     = !!patient.allergies;
  const hasHTA           = /hta|hypertension/i.test(txt);
  const hasDiabete       = /diab/i.test(txt);
  const isAnticoagulant  = /anticoagulant|sintrom|previscan|eliquis|xarelto/i.test(txt);
  let alertLevel = "ok";
  if (hasAllergies || isAnticoagulant) alertLevel = "danger";
  else if (hasHTA || hasDiabete) alertLevel = "warning";

  const STATUS = {
    ok:      { label: "Stable",       color: "#059669", bg: "#ecfdf5" },
    warning: { label: "À surveiller", color: "#d97706", bg: "#fffbeb" },
    danger:  { label: "Risque élevé", color: "#dc2626", bg: "#fef2f2" },
  }[alertLevel];

  const isFemale = patient.sexe === "Feminin" || patient.sexe === "Féminin" || patient.sexe === "F";
  const avatarColor = isFemale ? "#ec4899" : "#3b82f6";
  const sexLabel = isFemale ? "Femme" : (patient.sexe === "Masculin" || patient.sexe === "M") ? "Homme" : "—";

  const moreItems = [
    { label: "Analyse IA",       onClick: () => { setMoreOpen(false); onRiskScan?.(); } },
    { label: "QR Upload",        onClick: () => { setMoreOpen(false); onTab?.("docs"); } },
    { label: "Fiche patient",    onClick: () => { setMoreOpen(false); onTab?.("fiche"); } },
    { label: "Suivi & Rappels",  onClick: () => { setMoreOpen(false); onTab?.("followup"); } },
  ];

  return (
    <section style={{
      background: "#fff",
      border: "1px solid #eef2f7",
      borderRadius: 14,
      padding: "14px 18px",
      marginBottom: 10,
      display: "flex",
      alignItems: "center",
      gap: 14,
      minWidth: 0,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        background: avatarColor, color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 18, fontWeight: 600, flexShrink: 0,
      }}>
        {patientInitials(patient)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em" }}>
          {fullname(patient)}
        </h2>
        <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#64748b" }}>
          {patient.age != null && <span>{patient.age} ans</span>}
          {patient.age != null && <span style={{ color: "#cbd5e1" }}>·</span>}
          <span>{sexLabel}</span>
          <span style={{ color: "#cbd5e1" }}>·</span>
          <span style={{ padding: "2px 9px", borderRadius: 999, background: STATUS.bg, color: STATUS.color, fontSize: 12, fontWeight: 600 }}>
            {STATUS.label}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "center" }}>
        <button onClick={() => onTab?.("new-visit")}
          style={{
            padding: "9px 18px", background: "#3b82f6", color: "#fff",
            border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 600,
            cursor: "pointer",
          }}>
          Nouvelle visite
        </button>
        <div style={{ position: "relative" }} ref={moreRef}>
          <button onClick={() => setMoreOpen(o => !o)} aria-label="Plus d'actions"
            style={{
              padding: "9px 12px", background: "#f8fafc", color: "#475569",
              border: "1px solid #e5e7eb", borderRadius: 9, fontSize: 14, fontWeight: 700,
              cursor: "pointer", lineHeight: 1, minWidth: 38,
            }}>
            ⋯
          </button>
          {moreOpen && (
            <div style={{
              position: "absolute", right: 0, top: "calc(100% + 6px)",
              background: "#fff", border: "1px solid #eef2f7",
              borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,.08)",
              minWidth: 200, zIndex: 50, padding: 4,
            }}>
              {moreItems.map(it => (
                <button key={it.label} onClick={it.onClick}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "9px 12px", background: "transparent",
                    border: "none", borderRadius: 6,
                    fontSize: 13, color: "#0f172a", cursor: "pointer",
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  {it.label}
                </button>
              ))}
              {patient.telephone && (
                <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 4, paddingTop: 4 }}>
                  <div style={{ padding: "4px 8px" }}>
                    <WhatsAppButton phone={patient.telephone} patient={patient} compact />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
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

function CivilPanelCard({ form, setForm, onNew, onSave, onDelete, saving, selected, detail }) {
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
    try { await onDelete(); }
    finally { setDeleting(false); setConfirmDelete(false); }
  }

  const patientName = [form.nom, form.prenom].filter(Boolean).join(" ") || "ce patient";
  const visits = detail?.visits || [];
  const documents = detail?.documents || [];
  const prescriptions = detail?.prescriptions || [];

  // Calm shared styles (Apple-medical)
  const COL = { ink: "#0f172a", muted: "#64748b", line: "#eef2f7", soft: "#f8fafc", blue: "#3b82f6", red: "#dc2626", amber: "#d97706" };
  const sectionStyle = { background: "#fff", border: `1px solid ${COL.line}`, borderRadius: 14, padding: 22 };
  const sectionTitleStyle = { fontSize: 12, fontWeight: 600, color: COL.muted, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 14 };
  const fieldRowStyle = { display: "grid", gridTemplateColumns: "140px 1fr", gap: 12, padding: "9px 0", borderBottom: `1px solid ${COL.line}`, alignItems: "center", fontSize: 14 };
  const labelStyle = { color: COL.muted, fontWeight: 500 };
  const valueStyle = { color: COL.ink, fontWeight: 500 };
  const emptyStyle = { color: "#cbd5e1", fontStyle: "italic", fontWeight: 400 };

  // Read-only row
  const Row = ({ label, value }) => (
    <div style={fieldRowStyle}>
      <span style={labelStyle}>{label}</span>
      <span style={value ? valueStyle : emptyStyle}>{value || "—"}</span>
    </div>
  );

  // Edit input row
  const InputRow = ({ label, value, onChange, type = "text", as }) => (
    <div style={fieldRowStyle}>
      <span style={labelStyle}>{label}</span>
      {as === "select" ? (
        <select value={value || ""} onChange={e => onChange(e.target.value)}
          style={{ padding: "8px 10px", border: `1px solid ${COL.line}`, borderRadius: 8, fontSize: 14, background: "#fff", outline: "none" }}>
          <option value="">—</option>
          <option>Feminin</option>
          <option>Masculin</option>
        </select>
      ) : (
        <input type={type} value={value || ""} onChange={e => onChange(e.target.value)}
          style={{ padding: "8px 10px", border: `1px solid ${COL.line}`, borderRadius: 8, fontSize: 14, outline: "none", background: "#fff" }} />
      )}
    </div>
  );

  const TextRow = ({ label, value, onChange, accent }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: accent || COL.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <textarea value={value || ""} onChange={e => onChange(e.target.value)} rows={3}
        style={{ width: "100%", padding: "10px 12px", border: `1px solid ${COL.line}`, borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", outline: "none", resize: "vertical", background: "#fff" }} />
    </div>
  );

  const MedBlock = ({ label, value, accent, emptyText = "Aucune donnée" }) => (
    <div style={{ padding: "12px 14px", background: COL.soft, borderRadius: 10, borderLeft: `3px solid ${accent}`, marginBottom: 10 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: accent, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 13.5, color: value ? COL.ink : "#94a3b8", lineHeight: 1.55, whiteSpace: "pre-wrap" }}>
        {value || emptyText}
      </div>
    </div>
  );

  return (
    <>
      {confirmDelete && (
        <DeleteConfirmDialog name={patientName} onConfirm={handleDelete} onCancel={() => setConfirmDelete(false)} />
      )}

      {/* Top action bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: COL.ink, letterSpacing: "-0.01em" }}>Dossier patient</h2>
          <div style={{ marginTop: 3, fontSize: 13, color: COL.muted }}>État civil, antécédents et historique médical</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!selected ? (
            <>
              <button onClick={onNew} style={{ padding: "9px 14px", background: "#fff", color: COL.muted, border: `1px solid ${COL.line}`, borderRadius: 9, fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>Vider</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "9px 18px", background: COL.blue, color: "#fff", border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: saving ? .6 : 1 }}>Enregistrer</button>
            </>
          ) : !editing ? (
            <>
              <button onClick={() => setConfirmDelete(true)} disabled={deleting} style={{ padding: "9px 14px", background: "#fff", color: COL.red, border: `1px solid #fecaca`, borderRadius: 9, fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>Supprimer</button>
              <button onClick={() => setEditing(true)} style={{ padding: "9px 18px", background: COL.blue, color: "#fff", border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Modifier</button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(false)} style={{ padding: "9px 14px", background: "#fff", color: COL.muted, border: `1px solid ${COL.line}`, borderRadius: 9, fontSize: 13.5, fontWeight: 500, cursor: "pointer" }}>Annuler</button>
              <button onClick={handleSave} disabled={saving} style={{ padding: "9px 18px", background: COL.blue, color: "#fff", border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer", opacity: saving ? .6 : 1 }}>Enregistrer</button>
            </>
          )}
        </div>
      </div>

      {/* 2-column layout: left = identity, right = medical summary */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignItems: "start" }}>
        {/* ─── LEFT COLUMN: État civil + Coordonnées ─── */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>État civil</div>
          {editing ? (
            <>
              <InputRow label="Code" value={form.code} onChange={v => update("code", v)} />
              <InputRow label="Nom" value={form.prenom} onChange={v => update("prenom", v.toUpperCase())} />
              <InputRow label="Prénom" value={form.nom} onChange={v => update("nom", v)} />
              <InputRow label="Date naissance" type="date" value={String(form.date_naissance || "").slice(0, 10)} onChange={v => update("date_naissance", v)} />
              <InputRow label="Âge" value={form.age} onChange={v => update("age", v)} />
              <InputRow label="Sexe" as="select" value={form.sexe} onChange={v => update("sexe", v)} />
              <InputRow label="Groupe sanguin" value={form.groupe_sanguin} onChange={v => update("groupe_sanguin", v)} />
            </>
          ) : (
            <>
              <Row label="Code" value={form.code} />
              <Row label="Nom" value={form.prenom} />
              <Row label="Prénom" value={form.nom} />
              <Row label="Date naissance" value={form.date_naissance} />
              <Row label="Âge" value={form.age ? `${form.age} ans` : ""} />
              <Row label="Sexe" value={form.sexe} />
              <Row label="Groupe sanguin" value={form.groupe_sanguin} />
            </>
          )}

          <div style={{ ...sectionTitleStyle, marginTop: 22 }}>Coordonnées</div>
          {editing ? (
            <>
              <InputRow label="Téléphone" value={form.telephone} onChange={v => update("telephone", v)} />
              <InputRow label="Adresse" value={form.adresse} onChange={v => update("adresse", v)} />
              <InputRow label="Situation" value={form.situation_familiale} onChange={v => update("situation_familiale", v)} />
              <InputRow label="Profession" value={form.profession} onChange={v => update("profession", v)} />
              <InputRow label="Orienté par" value={form.oriente_par} onChange={v => update("oriente_par", v)} />
            </>
          ) : (
            <>
              <Row label="Téléphone" value={form.telephone} />
              <Row label="Adresse" value={form.adresse} />
              <Row label="Situation" value={form.situation_familiale} />
              <Row label="Profession" value={form.profession} />
              <Row label="Orienté par" value={form.oriente_par} />
            </>
          )}
        </div>

        {/* ─── RIGHT COLUMN: Médical + Historique ─── */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Antécédents & Médical</div>
          {editing ? (
            <>
              <TextRow label="Antécédents médicaux" value={form.antecedents} onChange={v => update("antecedents", v)} accent={COL.amber} />
              <TextRow label="Allergies" value={form.allergies} onChange={v => update("allergies", v)} accent={COL.red} />
              <TextRow label="Maladies actuelles / Traitement en cours" value={form.maladies} onChange={v => update("maladies", v)} accent={COL.amber} />
              <TextRow label="Notes importantes" value={form.notes_importantes} onChange={v => update("notes_importantes", v)} accent={COL.blue} />
            </>
          ) : (
            <>
              <MedBlock label="Antécédents" value={form.antecedents} accent={COL.amber} emptyText="Aucun antécédent renseigné" />
              <MedBlock label="Allergies" value={form.allergies} accent={COL.red} emptyText="Aucune allergie connue" />
              <MedBlock label="Maladies actuelles" value={form.maladies} accent={COL.amber} emptyText="Aucune" />
              <MedBlock label="Notes importantes" value={form.notes_importantes} accent={COL.blue} emptyText="Aucune note" />
            </>
          )}

          {/* Quick history overview (read-only summary) */}
          {selected && !editing && (
            <>
              <div style={{ ...sectionTitleStyle, marginTop: 22 }}>Activité récente</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 14 }}>
                {[
                  { label: "Visites", count: visits.length, color: COL.blue },
                  { label: "Ordonnances", count: prescriptions.length, color: "#10b981" },
                  { label: "Documents", count: documents.length, color: "#8b5cf6" },
                ].map(s => (
                  <div key={s.label} style={{ padding: "12px 10px", background: COL.soft, borderRadius: 10, textAlign: "center" }}>
                    <div style={{ fontSize: 22, fontWeight: 600, color: s.color, lineHeight: 1 }}>{s.count}</div>
                    <div style={{ fontSize: 11.5, color: COL.muted, marginTop: 4, fontWeight: 500 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {visits.length > 0 && (
                <div style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: COL.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".4px" }}>Dernière visite</div>
                  {visits.slice(0, 1).map(v => (
                    <div key={v.id} style={{ padding: "10px 12px", background: COL.soft, borderRadius: 10, fontSize: 13 }}>
                      <div style={{ fontWeight: 600, color: COL.ink, marginBottom: 3 }}>
                        {v.date_visite ? String(v.date_visite).slice(0, 10) : "—"}
                        {v.motif ? ` · ${v.motif}` : ""}
                      </div>
                      {v.diagnostics && <div style={{ color: COL.muted, lineHeight: 1.5 }}>{String(v.diagnostics).slice(0, 150)}{v.diagnostics.length > 150 ? "…" : ""}</div>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
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
        {remaining <= 0 && visit.visit_fee > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981", whiteSpace: "nowrap", paddingBottom: 8 }}>Soldé ✓</span>}
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

// Severity classifier for cardio diagnoses → why it's danger / warning / normal
const CARDIO_DIAG_SEVERITY = [
  { rx: /infarct|stemi|nstemi|sca|syndrome coronaire/i, level: "danger",  reason: "Urgence vitale \u2014 atteinte myocardique aigu\u00eb, prise en charge imm\u00e9diate." },
  { rx: /insuffisance card|heart failure|\bicc?\b|hf/i,  level: "danger",  reason: "Risque \u00e9lev\u00e9 de d\u00e9compensation, mortalit\u00e9 \u00e0 5 ans importante." },
  { rx: /av(c|c)|stroke|accident vasc/i,                  level: "danger",  reason: "Atteinte neurologique \u2014 risque de r\u00e9cidive et de s\u00e9quelles." },
  { rx: /embolie|thromb/i,                                 level: "danger",  reason: "Risque thromboembolique majeur \u2014 anticoagulation \u00e0 \u00e9valuer." },
  { rx: /aryth|fa\b|fibrill/i,                            level: "warning", reason: "Risque thromboembolique et h\u00e9modynamique \u2014 score CHA2DS2-VASc requis." },
  { rx: /angor|isch[ée]m|coronar/i,                       level: "warning", reason: "Maladie coronarienne \u2014 risque \u00e9v\u00e9nement aigu, optimiser FDR." },
  { rx: /valvulopath|st[ée]nose|insuf.*aort|mitral/i,     level: "warning", reason: "Valvulopathie \u2014 surveillance \u00e9chographique p\u00e9riodique." },
  { rx: /hypertension|\bhta\b/i,                          level: "warning", reason: "FDR cardiovasculaire majeur \u2014 contr\u00f4le tensionnel < 140/90 mmHg." },
  { rx: /diab[ée]t/i,                                      level: "warning", reason: "FDR cardiovasculaire \u2014 cible HbA1c < 7%, surveillance r\u00e9nale." },
  { rx: /dyslipid|cholest[ée]rol/i,                       level: "warning", reason: "FDR athromateux \u2014 statine selon SCORE2." },
  { rx: /bpco|asthme/i,                                    level: "warning", reason: "Comorbidit\u00e9 respiratoire \u2014 prudence b\u00eata-bloquants." },
];
function classifyDiagnosis(label) {
  const s = String(label || "");
  for (const r of CARDIO_DIAG_SEVERITY) {
    if (r.rx.test(s)) return r;
  }
  return { level: "normal", reason: "Pathologie courante \u2014 surveillance standard." };
}

function DiagnosisTreatmentPanel({ patient, cardio, medications, onDiagnosis, onDeleteDiagnosis, onSavePrescription }) {
  const QUICK_DIAGNOSES = [
    { label: "Hypertension artérielle", icon: "❤️", color: "#dc2626" },
    { label: "Insuffisance coronarienne", icon: "🫀", color: "#b91c1c" },
    { label: "Insuffisance cardiaque", icon: "💔", color: "#9333ea" },
    { label: "Arythmie / FA", icon: "📈", color: "#d97706" },
    { label: "Valvulopathie", icon: "🔬", color: "#2563eb" },
    { label: "Angor stable", icon: "⚡", color: "#0891b2" },
    { label: "Diabète type 2", icon: "🩸", color: "#059669" },
    { label: "Dyslipidémie", icon: "🧬", color: "#7c3aed" },
    { label: "BPCO", icon: "🫁", color: "#64748b" },
    { label: "Syndrome métabolique", icon: "⚖️", color: "#c2410c" },
  ];
  const cardioMeds = medications.filter((med) =>
    /IEC|Beta|Statine|Anticoag|Diuret|Calcium|ARA|Aspirine|Nitr|Antiarr/i.test(`${med.class_name} ${med.name}`)
  );
  const [rxSearch, setRxSearch] = useState("");
  const [rxResults, setRxResults] = useState([]);
  const [lines, setLines] = useState([]);
  const [diagSearch, setDiagSearch] = useState("");
  const [aiNote, setAiNote] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [checking, setChecking] = useState(false);
  const recentDiags = (cardio?.diagnoses || []).slice(0, 5);

  // Search medicines for treatment
  useEffect(() => {
    if (rxSearch.length < 2) { setRxResults([]); return; }
    const t = setTimeout(() => api.searchMedicines(rxSearch).then(d => setRxResults(d.rows || [])).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [rxSearch]);

  // AI safety check on prescription lines
  useEffect(() => {
    if (!patient?.id || !lines.length) { setSafetyAlerts([]); return; }
    setChecking(true);
    const t = setTimeout(() => {
      api.safetyCheck({ patient_id: patient.id, medications: lines.filter(Boolean) })
        .then(r => setSafetyAlerts(r.warnings || []))
        .catch(() => {})
        .finally(() => setChecking(false));
    }, 800);
    return () => clearTimeout(t);
  }, [lines.join("|"), patient?.id]);

  async function askAI() {
    if (!patient?.id) return;
    setAiBusy(true); setAiNote("");
    try {
      const diags = recentDiags.map(d => d.diagnosis).join(", ") || "non spécifié";
      const meds = lines.filter(Boolean).join(", ") || "aucun";
      const r = await api.aiPatientChat(patient.id, {
        message: `Résume en 3 lignes les recommandations thérapeutiques actuelles pour ce patient avec: ${diags}. Médicaments actuels: ${meds}. Sois concis et pratique.`
      });
      setAiNote(r.answer || r.message || "");
    } catch (e) { setAiNote("IA indisponible: " + e.message); }
    setAiBusy(false);
  }

  function addLine(name) {
    if (!lines.includes(name)) setLines([...lines, name]);
    setRxSearch(""); setRxResults([]);
  }

  const danger = safetyAlerts.filter(a => a.level === "danger");
  const warns  = safetyAlerts.filter(a => a.level === "warning");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, alignItems: "start" }}>

      {/* COL 1 — DIAGNOSES */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px #0001" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardList size={16} color="#fff" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Diagnostic</h3>
              <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Cliquez pour enregistrer</p>
            </div>
          </div>
          <input value={diagSearch} onChange={e => setDiagSearch(e.target.value)} placeholder="Filtrer…"
            style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12, marginBottom: 8, boxSizing: "border-box" }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {QUICK_DIAGNOSES.filter(d => !diagSearch || d.label.toLowerCase().includes(diagSearch.toLowerCase())).map(d => (
              <button key={d.label} disabled={!patient}
                onClick={() => onDiagnosis({ diagnosis: d.label })}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#1e293b", transition: "all .12s" }}
                onMouseEnter={e => { e.currentTarget.style.background = d.color + "12"; e.currentTarget.style.borderColor = d.color + "60"; }}
                onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
              >
                <span style={{ fontSize: 15 }}>{d.icon}</span>
                <span style={{ flex: 1 }}>{d.label}</span>
                <Plus size={13} style={{ color: d.color }} />
              </button>
            ))}
          </div>
        </div>

        {/* Recent diagnoses with AI severity + delete */}
        {recentDiags.length > 0 && (
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 14, boxShadow: "0 1px 4px #0001" }}>
            <h4 style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: .3 }}>Diagnostics récents</h4>
            {recentDiags.map(d => {
              const sev = classifyDiagnosis(d.diagnosis);
              const sevStyle = sev.level === "danger"
                ? { bg: "#fef2f2", border: "#fecaca", text: "#991b1b", badge: "#dc2626", label: "⛔ DANGER" }
                : sev.level === "warning"
                ? { bg: "#fffbeb", border: "#fde68a", text: "#92400e", badge: "#d97706", label: "⚠ ATTENTION" }
                : { bg: "#f0fdf4", border: "#bbf7d0", text: "#065f46", badge: "#059669", label: "✓ NORMAL" };
              return (
                <div key={d.id} style={{ padding: "8px 10px", marginBottom: 6, background: sevStyle.bg, border: `1px solid ${sevStyle.border}`, borderRadius: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", flex: 1 }}>{d.diagnosis}</span>
                    <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, fontWeight: 800, background: sevStyle.badge, color: "#fff" }}>{sevStyle.label}</span>
                    {onDeleteDiagnosis && (
                      <button onClick={() => onDeleteDiagnosis(d.id)} title="Supprimer ce diagnostic"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2, display: "flex", alignItems: "center" }}>
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 10.5, color: sevStyle.text, lineHeight: 1.4 }}>
                    <strong>Pourquoi&nbsp;:</strong> {sev.reason}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* COL 2 — TREATMENT BUILDER */}
      <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16, boxShadow: "0 1px 4px #0001" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Pill size={16} color="#fff" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Traitement</h3>
            <p style={{ margin: 0, fontSize: 11, color: "#64748b" }}>Recherche + raccourcis cardio</p>
          </div>
        </div>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: "1.5px solid #bfdbfe", borderRadius: 10, background: "#eff6ff" }}>
            <Search size={14} style={{ color: "#2563eb", flexShrink: 0 }} />
            <input value={rxSearch} onChange={e => setRxSearch(e.target.value)} placeholder="Rechercher un médicament…"
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, outline: "none", color: "#0f172a" }} />
          </div>
          {rxResults.length > 0 && (
            <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 6px 20px rgba(0,0,0,.12)", zIndex: 50, maxHeight: 220, overflowY: "auto" }}>
              {rxResults.map(med => (
                <button key={med.id} onClick={() => addLine(
                    med.brand_name
                    + (med.dosage_strength ? " " + med.dosage_strength : "")
                    + (med.default_posology ? " \u2014 " + med.default_posology : "")
                  )}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #f8fafc" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >
                  <Plus size={13} style={{ color: "#2563eb" }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{med.brand_name}</div>
                    <div style={{ fontSize: 10, color: "#64748b" }}>{med.dci} {med.dosage_strength}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Cardio quick-add */}
        <div style={{ marginBottom: 10 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", margin: "0 0 6px", textTransform: "uppercase", letterSpacing: .3 }}>Raccourcis cardio</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {cardioMeds.slice(0, 12).map(med => (
              <button key={med.id} onClick={() => addLine(med.name + (med.dosage || med.default_dose ? " " + (med.dosage || med.default_dose) : ""))}
                style={{ padding: "4px 10px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 12, fontSize: 11, fontWeight: 600, color: "#1e40af", cursor: "pointer" }}>
                + {med.name}
              </button>
            ))}
          </div>
        </div>

        {/* Lines list */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {lines.map((line, i) => {
            const alert = safetyAlerts.find(a => a.message?.toLowerCase().includes(line.toLowerCase().split(" ")[0]));
            return (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 10px", background: alert?.level === "danger" ? "#fef2f2" : alert?.level === "warning" ? "#fffbeb" : "#f8fafc", border: `1px solid ${alert?.level === "danger" ? "#fecaca" : alert?.level === "warning" ? "#fde68a" : "#e2e8f0"}`, borderRadius: 8 }}>
                <input value={line} onChange={e => setLines(lines.map((l, j) => j === i ? e.target.value : l))}
                  style={{ flex: 1, border: "none", background: "transparent", fontSize: 12, outline: "none" }} />
                {alert && (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 8, background: alert.level === "danger" ? "#fecaca" : "#fde68a", color: alert.level === "danger" ? "#991b1b" : "#92400e" }}>
                    {alert.level === "danger" ? "⛔" : "⚠️"}
                  </span>
                )}
                {!alert && line && <span style={{ fontSize: 10, color: "#059669" }}>✓</span>}
                <button onClick={() => setLines(lines.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}><X size={12} /></button>
              </div>
            );
          })}
          <button onClick={() => setLines([...lines, ""])}
            style={{ padding: "7px", border: "2px dashed #e2e8f0", borderRadius: 8, background: "none", cursor: "pointer", color: "#64748b", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Plus size={12} /> Ligne libre
          </button>
        </div>
      </div>

      {/* COL 3 — AI SUMMARY + SAVE */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {/* AI recommendation */}
        <div style={{ background: "linear-gradient(135deg,#faf5ff,#f0f9ff)", border: "1.5px solid #c4b5fd", borderRadius: 14, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: "#7c3aed", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={15} color="#fff" />
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#4c1d95" }}>Aide IA</span>
            </div>
            <button onClick={askAI} disabled={aiBusy || !patient}
              style={{ padding: "5px 12px", background: aiBusy ? "#a78bfa" : "#7c3aed", color: "#fff", border: "none", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
              {aiBusy ? <><Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} /> Analyse…</> : <><Sparkles size={10} /> Analyser</>}
            </button>
          </div>
          {aiNote
            ? <div style={{ fontSize: 12, lineHeight: 1.65, color: "#1e1b4b", background: "#fff", borderRadius: 8, padding: "10px 12px", border: "1px solid #e9d5ff", whiteSpace: "pre-wrap" }}>{aiNote}</div>
            : <p style={{ fontSize: 11.5, color: "#7c3aed", margin: 0, fontStyle: "italic" }}>Cliquez sur "Analyser" pour obtenir les recommandations IA basées sur les diagnostics et traitements du patient.</p>
          }
        </div>

        {/* Safety summary */}
        {(danger.length > 0 || warns.length > 0) && (
          <div style={{ background: danger.length > 0 ? "#fef2f2" : "#fffbeb", border: `1px solid ${danger.length > 0 ? "#fecaca" : "#fde68a"}`, borderRadius: 12, padding: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12, color: danger.length > 0 ? "#991b1b" : "#92400e", marginBottom: 6 }}>
              <AlertTriangle size={14} />
              {danger.length > 0 ? `${danger.length} alerte(s) critique(s)` : `${warns.length} avertissement(s)`}
              {checking && <Loader2 size={11} style={{ animation: "spin 1s linear infinite", marginLeft: 4 }} />}
            </div>
            {[...danger, ...warns].slice(0, 4).map((a, i) => (
              <div key={i} style={{ fontSize: 11, color: "#374151", marginTop: 3, paddingLeft: 8, borderLeft: `2px solid ${a.level === "danger" ? "#dc2626" : "#f59e0b"}` }}>
                {a.message}
              </div>
            ))}
          </div>
        )}

        {/* Save button */}
        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 14, padding: 16 }}>
          <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Sauvegarder la prescription</h4>
          <div style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>
            {lines.filter(Boolean).length > 0
              ? <><strong style={{ color: "#0f172a" }}>{lines.filter(Boolean).length}</strong> médicament(s) dans la prescription</>
              : "Aucun médicament ajouté"
            }
          </div>
          <button disabled={!patient || !lines.filter(Boolean).length}
            onClick={() => onSavePrescription(lines.filter(Boolean))}
            style={{ width: "100%", padding: "10px", background: (!patient || !lines.filter(Boolean).length) ? "#e2e8f0" : "#1d4ed8", color: (!patient || !lines.filter(Boolean).length) ? "#94a3b8" : "#fff", border: "none", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: !patient || !lines.filter(Boolean).length ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Save size={14} /> Enregistrer la prescription
          </button>
        </div>
      </div>
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

function DocumentsPanel({ patient, detail, onUpload, onSaveNotes, uploadMode, onFillVisit, onRefreshPatient }) {
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
  const [fullscreenDoc, setFullscreenDoc] = useState(null);
  const whatsappImportRef = useRef(null);
  const docs = detail?.documents || [];
  const selectedDoc = docs.find((doc) => doc.id === selectedDocId) || docs[0];
  const selectedAnalysis = aiAnalyses.find((item) => item.id === selectedAnalysisId) || aiAnalyses[0];
  const selectedPayload = getAnalysisPayload(selectedAnalysis);
  const uploadReady = Boolean(uploadMode?.upload_ready);
  const setupMessage = uploadMode?.setup_message || "Configurez le tunnel réseau pour activer le QR public.";
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
  const linkedPatientLabel = fullname(patient);
  const remoteActive = uploadMode?.mode === "remote" && String(uploadMode?.active_url || "").startsWith("https://");
  const tunnelStatus = uploadMode?.tunnel?.status || "idle";
  const cloudflareStatus = remoteActive ? "Actif" : (tunnelStatus === "starting" ? "Demarrage" : (uploadMode?.cloudflared_available ? "Disponible" : "Non configure"));
  const trackedClinicalValues = useMemo(() => extractTrackedClinicalValues(valuesDraft), [valuesDraft]);

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
        setAiMessage("Analyse Cloud (Qwen) terminée et synchronisée.");
        if (isCloudConfigured()) cloudAi.subscription().then(setCloudSub).catch(() => {});
      } else {
        upsertAnalysis(result.analysis);
        setAiMessage(reAnalyze ? "Ré-analyse enregistree en brouillon." : "Analyse IA enregistree en brouillon.");
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
      if (!consentRequired && documentAiEnabled && (keyConfigured || cloudReady)) {
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
    const isImage = (selectedDoc.mime_type || "").startsWith("image/");
    const isPdf = (selectedDoc.mime_type || "").includes("pdf");
    const expandBtn = (
      <button
        onClick={() => setFullscreenDoc(selectedDoc)}
        style={{
          position: "absolute", top: 8, right: 8, zIndex: 5,
          padding: "6px 12px", background: "#1e40af", color: "#fff",
          border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12,
          fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 5,
          boxShadow: "0 2px 8px rgba(0,0,0,.25)",
        }}
      >
        <Eye size={13} /> Agrandir
      </button>
    );
    if (isImage) {
      return (
        <div style={{ position: "relative" }}>
          {expandBtn}
          <img className="doc-preview" src={url} alt={selectedDoc.original_name} style={{ cursor: "zoom-in" }} onClick={() => setFullscreenDoc(selectedDoc)} />
        </div>
      );
    }
    if (isPdf) {
      return (
        <div style={{ position: "relative" }}>
          {expandBtn}
          <iframe className="doc-preview doc-preview--pdf" src={url} title={selectedDoc.original_name} />
        </div>
      );
    }
    return <a className="btn btn--primary" href={`${url}?download=1`} target="_blank" rel="noreferrer"><Eye size={16} /> Télécharger</a>;
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

  async function validateAndSaveClinicalValues() {
    if (!selectedAnalysis) return;
    setAiError("");
    const accepted = await api.acceptAiAnalysis(selectedAnalysis.id, {
      summary: summaryDraft,
      extracted_json: editedExtractedJson()
    });
    upsertAnalysis(accepted.analysis);
    const result = await api.saveAiLabs(selectedAnalysis.id, { values: valuesDraft });
    upsertAnalysis(result.analysis);
    await onRefreshPatient?.();
    const savedTargets = [];
    if (result.lab_result_id) savedTargets.push("biologie");
    if (result.vital_result_id) savedTargets.push("constantes");
    setAiMessage(savedTargets.length ? `Valeurs validees et enregistrees dans ${savedTargets.join(" et ")}.` : "Valeurs validees.");
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
            <div
              key={doc.id}
              className={`docs-pro-doc ${selectedDoc?.id === doc.id ? "is-active" : ""}`}
              style={{ display: "grid", gap: 8 }}
            >
              <button
                type="button"
                onClick={() => setSelectedDocId(doc.id)}
                style={{ all: "unset", cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}
              >
                <div className="docs-pro-doc__icon">
                  {doc.source === "QR Mobile" || doc.source === "mobile-qr" ? <Smartphone size={14} /> : <FileText size={14} />}
                </div>
                <div className="docs-pro-doc__info" style={{ minWidth: 0 }}>
                  <strong>{doc.original_name}</strong>
                  <span>{doc.type_document}</span>
                  <span style={{ fontSize: 11, color: "#64748b" }}>Patient lie: {linkedPatientLabel}</span>
                </div>
                <span className={`docs-pro-doc__badge ${doc.source === "QR Mobile" || doc.source === "mobile-qr" ? "is-qr" : ""}`}>
                  {doc.source === "QR Mobile" || doc.source === "mobile-qr" ? "QR" : doc.type_document?.slice(0, 3)?.toUpperCase()}
                </span>
              </button>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="docs-pro-pill-btn" type="button" onClick={() => setSelectedDocId(doc.id)}>
                  <Eye size={13} /> Apercu
                </button>
                <button
                  className="docs-pro-pill-btn"
                  type="button"
                  disabled={aiUnavailable || aiLoadingDocId === doc.id || (consentRequired && !consentConfirmed)}
                  onClick={() => {
                    setSelectedDocId(doc.id);
                    runAiAnalysis(doc, consentConfirmed, false);
                  }}
                >
                  <Bot size={13} /> Analyser IA
                </button>
              </div>
            </div>
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
        <section className="docs-pro-card">
          <div className="docs-pro-card__body" style={{ display: "grid", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {[
                { label: "QR Upload", value: uploadReady ? "Prêt" : "Indisponible", tone: uploadReady ? "#059669" : "#b45309", icon: QrCode },
                { label: "Documents", value: String(docs.length), tone: "#0f172a", icon: FileText },
                { label: "Analyse IA", value: aiUnavailable ? "Indisponible" : "Prête", tone: aiUnavailable ? "#b91c1c" : "#7c3aed", icon: Bot }
              ].map((item) => (
                <div key={item.label} style={{ border: "1px solid #e2e8f0", borderRadius: 12, padding: 14, background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: item.tone, marginBottom: 8 }}>
                    <item.icon size={15} />
                    <strong style={{ fontSize: 12 }}>{item.label}</strong>
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#0f172a" }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="docs-pro-upload-btn" disabled={!patient || !file} onClick={handleUploadClick}>
                <Upload size={14} /> Upload document
              </button>
              <button className="docs-pro-gen-btn" disabled={!canSendToAi || aiLoadingDocId === selectedDoc?.id} onClick={() => runAiAnalysis(selectedDoc, consentConfirmed, false)}>
                <Bot size={14} /> Analyser IA
              </button>
            </div>
          </div>
        </section>

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
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="docs-pro-upload-btn" disabled={!patient || !file} onClick={handleUploadClick}>
                <Upload size={14} /> Ajouter au dossier
              </button>
              <button
                type="button"
                disabled={!patient}
                onClick={() => whatsappImportRef.current?.click()}
                title="Importer une image/PDF reçu par WhatsApp (télécharger le fichier depuis WhatsApp d'abord)"
                style={{
                  padding: "10px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  border: "none", cursor: patient ? "pointer" : "not-allowed",
                  background: patient ? "#25D366" : "#cbd5e1", color: "#fff",
                  display: "inline-flex", alignItems: "center", gap: 6,
                  opacity: patient ? 1 : .6,
                }}
              >
                <MessageCircle size={14} /> Importer depuis WhatsApp
              </button>
              <input
                ref={whatsappImportRef}
                type="file"
                accept="image/*,.pdf"
                style={{ display: "none" }}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { setFile(f); setType(type || "IRM"); }
                }}
              />
            </div>
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
                  {trackedClinicalValues.length > 0 && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 12 }}>
                      {trackedClinicalValues.map((item) => (
                        <div key={item.key} style={{ border: "1px solid #dbeafe", background: "#f8fbff", borderRadius: 10, padding: "10px 12px" }}>
                          <div style={{ fontSize: 11, color: "#1d4ed8", fontWeight: 700 }}>{item.label}</div>
                          <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginTop: 4 }}>
                            {item.value}{item.unit ? ` ${item.unit}` : ""}
                          </div>
                          <div style={{ fontSize: 10.5, color: "#64748b", marginTop: 4 }}>{item.source}</div>
                        </div>
                      ))}
                    </div>
                  )}
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
                    <button className="docs-pro-gen-btn" disabled={!valuesDraft.length} onClick={validateAndSaveClinicalValues}>
                      <Save size={14} /> Valider et enregistrer
                    </button>
                    {onFillVisit && valuesDraft.length > 0 && (
                      <button className="docs-pro-gen-btn" style={{ background: "#059669" }} onClick={() => {
                        const data = {};
                        const labLines = [];
                        valuesDraft.forEach(v => {
                          const a = (v.analyte || "").toLowerCase();
                          const val = (v.value || "").trim();
                          if (!val) return;
                          if (a.includes("glyc") || a.includes("glucose")) { data.glycemie = val + (v.unit ? " " + v.unit : ""); }
                          else if (a.includes("fc") || a.includes("fréquence") || a.includes("cardiaque") || a.includes("pouls") || a === "hr") { data.frequence_cardiaque = val; }
                          else if (a.includes("tension") || a === "ta" || a === "pas" || a === "pad" || a.includes("systol") || a.includes("diastol")) { data.tension = val; }
                          else if (a.includes("poids")) { data.poids = val; }
                          else if (a.includes("taille")) { data.taille = val; }
                          else { labLines.push(`${v.analyte}: ${val}${v.unit ? " " + v.unit : ""}${v.abnormal_flag ? " [" + v.abnormal_flag + "]" : ""}`); }
                        });
                        if (labLines.length) data.examens = labLines.join("\n");
                        onFillVisit(data);
                        setAiMessage("✓ Valeurs appliquées au dossier. Vérifiez et sauvegardez.");
                        setTimeout(() => setAiMessage(""), 4000);
                      }}>
                        <CheckCircle size={14} /> Remplir le dossier
                      </button>
                    )}
                  </div>
                  {valuesDraft.length > 0 && (
                    <p style={{ fontSize: 10.5, color: "#64748b", fontStyle: "italic", margin: "4px 0 0" }}>
                      Aucun enregistrement automatique: le medecin doit valider avant sauvegarde dans le dossier patient.
                    </p>
                  )}
                  {onFillVisit && valuesDraft.length > 0 && (
                    <p style={{ fontSize: 10.5, color: "#64748b", fontStyle: "italic", margin: "4px 0 0" }}>
                      Analyse IA à vérifier par le médecin avant enregistrement.
                    </p>
                  )}
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

      {/* Fullscreen document viewer */}
      {fullscreenDoc && (
        <FullscreenDocumentViewer
          doc={fullscreenDoc}
          onClose={() => setFullscreenDoc(null)}
        />
      )}
    </div>
  );
}

function FullscreenDocumentViewer({ doc, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const url = `${apiBase}/api/documents/${doc.id}`;
  const isImage = (doc.mime_type || "").startsWith("image/");
  const isPdf = (doc.mime_type || "").includes("pdf");

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "+" || e.key === "=") setZoom(z => Math.min(z + 0.25, 6));
      else if (e.key === "-") setZoom(z => Math.max(z - 0.25, 0.25));
      else if (e.key === "0") { setZoom(1); setPos({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const onWheel = (e) => {
    if (!isImage) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    setZoom(z => Math.max(0.25, Math.min(6, z + delta)));
  };

  const onMouseDown = (e) => {
    if (!isImage || zoom <= 1) return;
    setDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY, posX: pos.x, posY: pos.y };
  };
  const onMouseMove = (e) => {
    if (!dragging) return;
    setPos({
      x: dragStart.current.posX + (e.clientX - dragStart.current.x),
      y: dragStart.current.posY + (e.clientY - dragStart.current.y),
    });
  };
  const onMouseUp = () => setDragging(false);

  const toolbar = (
    <div style={{
      position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)",
      display: "flex", gap: 8, padding: "8px 14px", background: "rgba(15,23,42,.92)",
      borderRadius: 999, zIndex: 10001, backdropFilter: "blur(8px)",
      boxShadow: "0 8px 24px rgba(0,0,0,.4)",
    }}>
      <span style={{ color: "#e2e8f0", fontSize: 12, fontWeight: 600, alignSelf: "center", paddingRight: 8, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {doc.original_name}
      </span>
      {isImage && (
        <>
          <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} style={iconBtnStyle}>−</button>
          <span style={{ color: "#e2e8f0", fontSize: 12, alignSelf: "center", minWidth: 48, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom(z => Math.min(6, z + 0.25))} style={iconBtnStyle}>+</button>
          <button onClick={() => { setZoom(1); setPos({ x: 0, y: 0 }); }} style={iconBtnStyle} title="Réinitialiser (0)">↻</button>
        </>
      )}
      <a href={url} download={doc.original_name} style={{ ...iconBtnStyle, textDecoration: "none" }} title="Télécharger">
        <Download size={14} />
      </a>
      <button onClick={onClose} style={{ ...iconBtnStyle, background: "#dc2626" }} title="Fermer (Esc)">
        <X size={14} />
      </button>
    </div>
  );

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.94)",
        zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", cursor: dragging ? "grabbing" : (isImage && zoom > 1 ? "grab" : "default"),
      }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {toolbar}
      {isImage && (
        <img
          src={url}
          alt={doc.original_name}
          style={{
            maxWidth: "92vw", maxHeight: "88vh",
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${zoom})`,
            transition: dragging ? "none" : "transform .15s ease-out",
            userSelect: "none", pointerEvents: "none",
          }}
          draggable={false}
        />
      )}
      {isPdf && (
        <iframe
          src={url}
          title={doc.original_name}
          style={{ width: "92vw", height: "90vh", border: "none", background: "#fff", borderRadius: 8 }}
        />
      )}
      {!isImage && !isPdf && (
        <div style={{ color: "#fff", textAlign: "center" }}>
          <p>Format non prévisualisable.</p>
          <a href={url} download style={{ color: "#60a5fa" }}>Télécharger le fichier</a>
        </div>
      )}
    </div>
  );
}

const iconBtnStyle = {
  padding: "5px 10px", borderRadius: 6, border: "none",
  background: "#334155", color: "#fff", cursor: "pointer",
  fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4,
};

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
                <span className="ai-pro-badge ai-pro-badge--mode">{settings.AI_ANALYSIS_MODE || "short"}</span>
                {cloudSub ? (
                   <span className={`ai-pro-badge ${cloudSub.remaining_credits < 5 ? "is-off" : "is-on"}`}>
                     Crédits: {cloudSub.unlimited ? "∞" : (cloudSub.remaining_credits || 0)}
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
            <strong>Tunnel distant permanent</strong>
            <p>N'importe quel téléphone, Wi-Fi ou localisation après configuration.</p>
            {!isRemote && !isStarting && uploadMode?.cloudflared_available && (
              <button className="btn btn--primary" disabled={busy} onClick={startTunnel}><Globe size={14} /> Activer upload distant</button>
            )}
            {!isRemote && !isStarting && !uploadMode?.cloudflared_available && (
              <span className="mode-badge mode-badge--warn">Service tunnel manquant</span>
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
            <tr><td>Service tunnel</td><td>{uploadMode?.cloudflared_available ? <><CheckCircle size={13} /> Installé</> : <><XCircle size={13} /> Non trouvé</>}</td></tr>
            {tunnel.binary_path && <tr><td>Executable</td><td><code>{tunnel.binary_path}</code></td></tr>}
            <tr><td>URL QR active</td><td><code>{uploadMode?.active_url || "..."}</code></td></tr>
          </tbody>
        </table>
        {!uploadMode?.cloudflared_available && (
          <p style={{ fontSize: 12, color: "#92400e", background: "var(--warning-light)", padding: 10, borderRadius: "var(--radius-sm)", border: "1px solid #fcd34d", marginTop: 8 }}>
            <AlertTriangle size={13} style={{ verticalAlign: "middle" }} /> Pour le mode internet, placez le service tunnel dans le dossier <code>bin/</code>.
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMed, setNewMed] = useState({ brand_name: "", dci: "", dosage_strength: "", form: "", specialty: "" });
  const [addMsg, setAddMsg] = useState("");

  const refreshStats = () => api.medicinesStats().then(setStats).catch(() => {});

  async function handleAddMedicine() {
    if (!newMed.brand_name.trim()) { setAddMsg("Le nom commercial est requis."); return; }
    try {
      const r = await api.addMedicine(newMed);
      setAddMsg(r.created ? `✓ Médicament "${newMed.brand_name}" ajouté (id: ${r.id})` : `Déjà en base (id: ${r.id})`);
      setNewMed({ brand_name: "", dci: "", dosage_strength: "", form: "", specialty: "" });
      refreshStats();
    } catch (e) { setAddMsg("Erreur: " + e.message); }
  }

  useEffect(() => { refreshStats(); }, []);

  useEffect(() => {
    if (query.length < 2) { setResults([]); return; }
    const t = setTimeout(() => { api.searchMedicines(query, 200).then((d) => setResults(d.rows || [])).catch(() => {}); }, 200);
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

      {/* ── Manual add form ── */}
      <section className="tool-card" style={{ padding: 14, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#1e40af", display: "flex", alignItems: "center", gap: 6 }}>
            <PlusCircle size={15} /> Ajouter un médicament manuellement
          </div>
          <button onClick={() => setShowAddForm(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", fontSize: 12 }}>
            {showAddForm ? "▲ Fermer" : "▼ Ouvrir"}
          </button>
        </div>
        {showAddForm && (
          <div style={{ marginTop: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8, marginBottom: 8 }}>
              {[["brand_name","Nom commercial *"],["dci","DCI / Principe actif"],["dosage_strength","Dosage"],["form","Forme (cp, ml…)"],["specialty","Spécialité médicale"]].map(([k, lbl]) => (
                <div key={k}>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 2 }}>{lbl}</label>
                  <input value={newMed[k]} onChange={e => setNewMed(p => ({ ...p, [k]: e.target.value }))}
                    style={{ width: "100%", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, boxSizing: "border-box" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={handleAddMedicine}
                style={{ padding: "7px 18px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
                <PlusCircle size={13} style={{ verticalAlign: "middle", marginRight: 4 }} />Ajouter
              </button>
              {addMsg && <span style={{ fontSize: 12, color: addMsg.startsWith("✓") ? "#059669" : "#ef4444", fontWeight: 600 }}>{addMsg}</span>}
            </div>
          </div>
        )}
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
// SMART MEDICINE PILL (reusable chip for favorites/recent/specialty)
// =====================================================================
function SmartMedPill({ med, isFav, onAdd, onToggleFav, onDetail }) {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "5px 10px", borderRadius: 8, border: "1px solid #e2e8f0",
      background: "#fff", fontSize: 12, cursor: "default",
    }}>
      <button onClick={onAdd} title="Ajouter" style={{ background: "none", border: "none", cursor: "pointer", color: "#2563eb", fontWeight: 700 }}>
        {med.brand_name}
      </button>
      <span style={{ color: "#94a3b8", fontSize: 10 }}>{med.dosage_strength}</span>
      <button onClick={onToggleFav} title="Favori" style={{ background: "none", border: "none", cursor: "pointer", color: isFav ? "#f59e0b" : "#cbd5e1", padding: 0 }}>
        <Star size={12} fill={isFav ? "#f59e0b" : "none"} />
      </button>
      <button onClick={onDetail} title="Details" style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 0 }}>
        <Info size={12} />
      </button>
    </div>
  );
}

// =====================================================================
// MEDICATION DETAILS MODAL
// =====================================================================
function MedicineDetailModal({ medicine, onClose }) {
  if (!medicine) return null;
  const fields = [
    { label: "Nom commercial", value: medicine.brand_name },
    { label: "DCI", value: medicine.dci },
    { label: "Principe actif", value: medicine.active_substance },
    { label: "Dosage / Forme", value: [medicine.dosage_strength, medicine.form].filter(Boolean).join(" / ") },
    { label: "Voie", value: medicine.route },
    { label: "Laboratoire", value: medicine.laboratory },
    { label: "Indications", value: medicine.indications },
    { label: "Contre-indications", value: medicine.contraindications },
    { label: "Interactions", value: medicine.interactions },
    { label: "Grossesse", value: medicine.pregnancy_warnings },
    { label: "Allaitement", value: medicine.breastfeeding_warnings },
    { label: "Precautions renales", value: medicine.renal_precautions },
    { label: "Precautions hepatiques", value: medicine.hepatic_precautions },
  ];
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center",
    }} onClick={onClose}>
      <div style={{
        background: "#fff", borderRadius: 14, width: "min(600px, 92vw)", maxHeight: "85vh",
        overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.25)",
      }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Pill size={18} color="#2563eb" />
            <h3 style={{ margin: 0, fontSize: 16, color: "#0f172a" }}>{medicine.brand_name || "Medicament"}</h3>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: "16px 20px" }}>
          {fields.map((f, i) => f.value ? (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.5 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: "#334155", lineHeight: 1.45, marginTop: 2, whiteSpace: "pre-wrap" }}>{f.value}</div>
            </div>
          ) : null)}
          {medicine.rcp_text && (
            <div style={{ marginTop: 12, padding: 10, background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, color: "#475569", marginBottom: 6 }}>
                <BookOpen size={13} />
                Resume des caracteristiques du produit (RCP)
              </div>
              <div style={{ fontSize: 12, color: "#334155", lineHeight: 1.5, maxHeight: 200, overflowY: "auto" }}>{medicine.rcp_text}</div>
            </div>
          )}
        </div>
        <div style={{ padding: "10px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #cbd5e1", background: "#fff", color: "#475569", fontSize: 13, cursor: "pointer" }}>
            Fermer
          </button>
        </div>
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
  const [safetyAlerts, setSafetyAlerts] = useState([]);
  const [safetyChecking, setSafetyChecking] = useState(false);
  const [previewId, setPreviewId] = useState(null);
  const [saveMessage, setSaveMessage] = useState("");
  // AI prescription assistant
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiResponse, setAiResponse] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  // Smart-lists: specialties, favorites, recent
  const [specialties, setSpecialties] = useState([]);
  const [activeSpecialty, setActiveSpecialty] = useState("");
  const [specialtyMeds, setSpecialtyMeds] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [recent, setRecent] = useState([]);
  const [smartTab, setSmartTab] = useState("mydb"); // mydb | recent | favorites | specialty
  const [detailMed, setDetailMed] = useState(null);   // medication details modal
  // Gestion DB — doctor's personal medicine history
  const [dbMeds, setDbMeds] = useState([]);
  const [dbMedsLoaded, setDbMedsLoaded] = useState(false);
  const [dbSearch, setDbSearch] = useState("");
  const [dbMedAiStatus, setDbMedAiStatus] = useState({}); // name→"checking"|"ok"|"warn"|"danger"

  async function askAIForPrescription() {
    if (!patient?.id || !aiPrompt.trim()) return;
    setAiBusy(true);
    setAiResponse("");
    try {
      const currentMeds = items.map(i => i.medicine_name).filter(Boolean).join(", ") || "aucun";
      const instruction =
        `En tant qu'assistant médical prudent, propose une ordonnance structurée pour ce patient.\n\n` +
        `CONTEXTE CLINIQUE: ${aiPrompt.trim()}\n` +
        `Médicaments déjà listés: ${currentMeds}\n\n` +
        `Réponds au format exact suivant (une ligne par médicament, séparées par des sauts de ligne):\n` +
        `NOM | DOSAGE | POSOLOGIE | DUREE | INSTRUCTIONS\n\n` +
        `Exemple:\n` +
        `AMLOR | 5 mg | 1 cp/j le matin | 3 mois | À prendre à heure fixe\n` +
        `BISOPROLOL | 2.5 mg | 1 cp/j le matin | 3 mois | Surveiller FC\n\n` +
        `Ne propose PAS de médicaments interdits chez ce patient (allergies/contre-indications). ` +
        `Précise les posologies conformes aux recommandations.`;
      const res = await api.aiPatientChat(patient.id, { message: instruction });
      const answer = res.answer || res.message || res.reply || "";
      setAiResponse(answer);
      // Parse the AI response into prescription items
      const parsed = parseAIPrescription(answer);
      if (parsed.length > 0) {
        setItems([...items, ...parsed]);
      }
    } catch (e) {
      setAiResponse("Erreur IA: " + (e.message || "indisponible"));
    } finally {
      setAiBusy(false);
    }
  }

  function parseAIPrescription(text) {
    if (!text) return [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const result = [];
    for (const line of lines) {
      // Match "NOM | DOSAGE | POSOLOGIE | DUREE | INSTRUCTIONS"
      const parts = line.split("|").map(s => s.trim());
      if (parts.length < 3) continue;
      const [name, dosage, frequency, duration, instructions] = parts;
      // Skip lines that look like headers or the example format itself
      if (/^(NOM|EXEMPLE|MEDICAMENT)/i.test(name)) continue;
      if (!name || name.length < 2) continue;
      result.push({
        medicine_id: null,
        medicine_name: name,
        dci: "",
        dosage: dosage || "",
        frequency: frequency || "",
        duration: duration || "",
        instructions: instructions || "",
        quantity: "",
        renewable: false,
        is_free_text: false,
      });
    }
    return result;
  }

  useEffect(() => { api.prescriptionTemplates().then((d) => setTemplates(d.rows || [])).catch(() => {}); }, []);

  // Load smart-lists on mount
  useEffect(() => {
    api.medicineSpecialties().then((d) => setSpecialties(d.specialties || [])).catch(() => {});
    api.favoriteMedicines().then((d) => setFavorites(d.rows || [])).catch(() => {});
    api.recentMedicines().then((d) => setRecent(d.rows || [])).catch(() => {});
    api.gestionDbMedicines("", 500).then(d => { setDbMeds(d.rows || []); setDbMedsLoaded(true); }).catch(() => { setDbMedsLoaded(true); });
  }, []);

  // Reload favorites when items change (after prescription creation)
  useEffect(() => {
    api.favoriteMedicines().then((d) => setFavorites(d.rows || [])).catch(() => {});
  }, [items.length]);

  useEffect(() => {
    if (search.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(() => api.searchMedicines(search).then((d) => setSearchResults(d.rows || [])).catch(() => {}), 200);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    if (!activeSpecialty) { setSpecialtyMeds([]); return; }
    api.medicinesBySpecialty(activeSpecialty).then((d) => setSpecialtyMeds(d.rows || [])).catch(() => {});
  }, [activeSpecialty]);

  // ── Live AI safety check ──
  // Runs a debounced drug-safety analysis every time medications change.
  // The backend /api/safety-check cross-checks against the patient's
  // allergies, chronic diseases, renal/hepatic status, age and detects
  // drug-drug interactions using the local medicines_db.
  useEffect(() => {
    if (!patient?.id) { setSafetyAlerts([]); return; }
    const names = items.map(it => (it.medicine_name || "").trim()).filter(Boolean);
    if (!names.length) { setSafetyAlerts([]); return; }
    setSafetyChecking(true);
    const timer = setTimeout(async () => {
      try {
        const res = await api.safetyCheck({ patient_id: patient.id, medications: names });
        setSafetyAlerts(res.warnings || []);
      } catch (_) {
        setSafetyAlerts([]);
      } finally {
        setSafetyChecking(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [items.map(i => i.medicine_name).join("|"), patient?.id]);

  // Per-medication alert lookup (case-insensitive name match)
  function alertsForMed(name) {
    const n = (name || "").toLowerCase().trim();
    if (!n) return [];
    return safetyAlerts.filter(a =>
      a.level !== "ok" && a.message && a.message.toLowerCase().includes(n)
    );
  }
  const danger = safetyAlerts.filter(a => a.level === "danger");
  const warningsCount = safetyAlerts.filter(a => a.level === "warning").length;

  function addMedicine(med) {
    setItems([...items, { medicine_id: med.id, medicine_name: med.brand_name, dci: med.dci, dosage: med.dosage_strength || "", frequency: "", duration: "", instructions: "", quantity: "", renewable: false, is_free_text: false }]);
    setSearch(""); setSearchResults([]);
  }

  async function addDbMedicine(med) {
    const name = med.name || "";
    const newItem = { medicine_id: null, medicine_name: name, dci: med.dci || "", dosage: "", frequency: med.posologie || "", duration: "", instructions: "", quantity: "", renewable: false, is_free_text: false };
    setItems(prev => [...prev, newItem]);
    setDbMedAiStatus(s => ({ ...s, [name]: "checking" }));
    try {
      const res = await api.safetyCheck({ patient_id: patient?.id || null, medications: [name] });
      const alerts = res.warnings || [];
      const level = alerts.some(a => a.level === "danger") ? "danger" : alerts.some(a => a.level === "warning") ? "warn" : "ok";
      setDbMedAiStatus(s => ({ ...s, [name]: level }));
    } catch (_) {
      setDbMedAiStatus(s => ({ ...s, [name]: "ok" }));
    }
  }

  async function toggleFavorite(med) {
    const isFav = favorites.some((f) => f.id === med.id);
    try {
      if (isFav) {
        await api.removeFavoriteMedicine(med.id);
        setFavorites(favorites.filter((f) => f.id !== med.id));
      } else {
        await api.addFavoriteMedicine(med.id);
        setFavorites([...favorites, med]);
      }
    } catch (_) {}
  }

  async function openDetail(med) {
    try {
      const d = await api.getMedicine(med.id);
      setDetailMed(d.medicine || med);
    } catch (_) {
      setDetailMed(med);
    }
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
    // Require explicit confirmation when dangerous alerts are present
    if (validated && danger.length > 0) {
      const msg = "⚠ DANGER DÉTECTÉ:\n\n" +
        danger.map(d => "• " + d.message).join("\n") +
        "\n\nÊtes-vous sûr de vouloir valider cette ordonnance malgré ces alertes critiques ?";
      if (!window.confirm(msg)) return;
    }
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
            {/* ═══ AI PRESCRIPTION ASSISTANT ═══ */}
            <div style={{
              marginBottom: 14,
              borderRadius: 10,
              border: `1px solid ${aiOpen ? "#8b5cf6" : "#e2e8f0"}`,
              background: aiOpen ? "#faf5ff" : "#f8fafc",
              overflow: "hidden",
              transition: "all .2s",
            }}>
              <button
                type="button"
                onClick={() => setAiOpen(v => !v)}
                style={{
                  width: "100%", padding: "10px 14px", background: "transparent",
                  border: "none", display: "flex", alignItems: "center", gap: 8,
                  cursor: "pointer", color: "#6d28d9", fontWeight: 700, fontSize: 13,
                }}
              >
                <Bot size={15} />
                <span>Assistant IA — Rédaction d'ordonnance</span>
                <span style={{ marginLeft: "auto", fontSize: 11, opacity: .7 }}>
                  {aiOpen ? "▲ Fermer" : "▼ Ouvrir"}
                </span>
              </button>
              {aiOpen && (
                <div style={{ padding: "4px 14px 14px" }}>
                  <textarea
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    placeholder="Décrivez le contexte clinique. Ex: HTA de grade 2 + diabète type 2 non équilibré, sans antécédents cardiaques. Proposer traitement de première intention."
                    style={{
                      width: "100%", minHeight: 70, padding: "8px 10px",
                      border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13,
                      fontFamily: "inherit", resize: "vertical", background: "#fff",
                    }}
                    disabled={aiBusy}
                  />
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={askAIForPrescription}
                      disabled={aiBusy || !patient?.id || !aiPrompt.trim()}
                      style={{
                        padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 12,
                        fontWeight: 700, cursor: aiBusy ? "wait" : "pointer",
                        background: aiBusy ? "#94a3b8" : "#7c3aed", color: "#fff",
                        display: "inline-flex", alignItems: "center", gap: 6,
                      }}
                    >
                      <Sparkles size={13} />
                      {aiBusy ? "IA analyse…" : "Proposer une ordonnance"}
                    </button>
                    {aiResponse && (
                      <button
                        type="button"
                        onClick={() => { setAiResponse(""); setAiPrompt(""); }}
                        style={{
                          padding: "8px 12px", borderRadius: 8, border: "1px solid #cbd5e1",
                          background: "#fff", color: "#475569", fontSize: 12, cursor: "pointer",
                        }}
                      >
                        Effacer
                      </button>
                    )}
                  </div>
                  {aiResponse && (
                    <div style={{
                      marginTop: 10, padding: "10px 12px", background: "#fff",
                      border: "1px solid #e9d5ff", borderRadius: 8, fontSize: 12,
                      color: "#334155", whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto",
                    }}>
                      <div style={{ fontWeight: 700, color: "#6d28d9", marginBottom: 4 }}>
                        Réponse IA (médicaments ajoutés automatiquement)
                      </div>
                      {aiResponse}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 10, color: "#7c3aed", fontStyle: "italic" }}>
                    ⚠ Suggestions IA à vérifier et adapter. Le médecin reste seul responsable de la prescription.
                  </div>
                </div>
              )}
            </div>

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

            {/* ═══ AI SAFETY BANNER ═══ */}
            {(danger.length > 0 || warningsCount > 0 || safetyChecking) && (
              <div
                className="rx-safety-banner"
                style={{
                  padding: "12px 14px",
                  borderRadius: 10,
                  marginBottom: 14,
                  border: `2px solid ${danger.length ? "#dc2626" : warningsCount ? "#f59e0b" : "#3b82f6"}`,
                  background: danger.length ? "#fef2f2" : warningsCount ? "#fffbeb" : "#eff6ff",
                  color: danger.length ? "#991b1b" : warningsCount ? "#92400e" : "#1e40af",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13, marginBottom: danger.length || warningsCount ? 8 : 0 }}>
                  <AlertTriangle size={16} />
                  {safetyChecking
                    ? "Analyse IA de sécurité…"
                    : danger.length > 0
                      ? `⚠ DANGER — ${danger.length} alerte(s) critique(s) pour ce patient`
                      : `Attention — ${warningsCount} avertissement(s)`}
                </div>
                {!safetyChecking && safetyAlerts.filter(a => a.level !== "ok" && a.level !== "info").map((w, i) => (
                  <div key={i} style={{ fontSize: 12, lineHeight: 1.5, paddingLeft: 24, marginTop: 3 }}>
                    • {w.message}
                  </div>
                ))}
                <div style={{ fontSize: 10, color: "inherit", opacity: .7, marginTop: 8, paddingLeft: 24, fontStyle: "italic" }}>
                  Aide à la décision automatique. Le médecin reste seul juge de la prescription.
                </div>
              </div>
            )}

            {/* ═══ HERO MEDICINE ADD ═══ */}
            <div style={{
              background: "linear-gradient(135deg,#eff6ff 0%,#f0f9ff 100%)",
              border: "2px solid #bfdbfe", borderRadius: 14, padding: "16px 18px",
              marginBottom: 14, boxShadow: "0 2px 8px rgba(37,99,235,.08)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                  <Pill size={18} />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Ajouter un médicament</h3>
                  <p style={{ margin: 0, fontSize: 11.5, color: "#64748b" }}>
                    Recherche intelligente sur 15 000+ médicaments BDPM — l'IA vérifie automatiquement les contre-indications
                  </p>
                </div>
                {safetyChecking && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#4338ca", background: "#e0e7ff", padding: "4px 10px", borderRadius: 12 }}>
                    <Loader2 size={11} style={{ animation: "spin 1s linear infinite" }} /> IA analyse…
                  </span>
                )}
              </div>

              <div className="rx-pro-search" style={{ position: "relative" }}>
                <Search size={18} style={{ color: "#2563eb" }} />
                <input
                  value={search}
                  placeholder="Tapez le nom d'un médicament, DCI, ou indication… (ex: paracétamol, amlodipine, hypertension)"
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ fontSize: 14, padding: "12px 14px", minHeight: 42 }}
                  autoFocus
                />
                {searchResults.length > 0 && (
                  <div className="rx-pro-search__dropdown" style={{ maxHeight: 340 }}>
                    {searchResults.map((med) => {
                      const isFav = favorites.some(f => f.id === med.id);
                      return (
                        <div key={med.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderBottom: "1px solid #f1f5f9" }}>
                          <button
                            onClick={() => addMedicine(med)}
                            style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0 }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{med.brand_name}</div>
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                              {med.dci && <span>{med.dci}</span>}
                              {med.dosage_strength && <span> · {med.dosage_strength}</span>}
                              {med.form && <span> · {med.form}</span>}
                            </div>
                          </button>
                          <button
                            onClick={() => addMedicine(med)}
                            style={{ padding: "6px 12px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                          ><Plus size={12} />Ajouter</button>
                          <button title="Favori" onClick={(e) => { e.stopPropagation(); toggleFavorite(med); }} style={{ background: "none", border: "none", cursor: "pointer", color: isFav ? "#f59e0b" : "#cbd5e1", padding: 4 }}>
                            <Star size={15} fill={isFav ? "#f59e0b" : "none"} />
                          </button>
                          <button title="Détails" onClick={(e) => { e.stopPropagation(); openDetail(med); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: 4 }}>
                            <Info size={15} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Quick-add chips: recent + favorites */}
              {(recent.length > 0 || favorites.length > 0) && (
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.3, marginRight: 4 }}>Rapide :</span>
                  {[...favorites.slice(0, 3), ...recent.filter(r => !favorites.find(f => f.id === r.id)).slice(0, 6)].slice(0, 8).map(med => (
                    <button key={med.id} onClick={() => addMedicine(med)}
                      style={{ padding: "4px 10px", background: "#fff", border: "1px solid #cbd5e1", borderRadius: 14, fontSize: 11, fontWeight: 600, color: "#1e40af", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                      title={`${med.dci || ""} ${med.dosage_strength || ""}`}>
                      {favorites.some(f => f.id === med.id) && <Star size={9} fill="#f59e0b" style={{ color: "#f59e0b" }} />}
                      + {med.brand_name}
                    </button>
                  ))}
                  <button onClick={addFreeText} style={{ padding: "4px 10px", background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 14, fontSize: 11, fontWeight: 600, color: "#92400e", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
                    <Plus size={10} /> Texte libre
                  </button>
                </div>
              )}

              {/* Live global AI alerts summary */}
              {safetyAlerts.length > 0 && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: danger.length > 0 ? "#fef2f2" : "#fffbeb", border: `1px solid ${danger.length > 0 ? "#fecaca" : "#fde68a"}`, borderRadius: 8, fontSize: 11.5, color: danger.length > 0 ? "#991b1b" : "#92400e", display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertTriangle size={13} />
                  <strong>{danger.length > 0 ? `${danger.length} alerte(s) critique(s)` : `${warningsCount} avertissement(s)`}</strong>
                  {" — vérifiez les médicaments ci-dessous"}
                </div>
              )}
            </div>

            {/* Medication Items */}
            <div className="rx-pro-items">
              {items.map((item, idx) => {
                const itemAlerts = alertsForMed(item.medicine_name);
                const hasDanger = itemAlerts.some(a => a.level === "danger");
                const hasWarn = itemAlerts.some(a => a.level === "warning");
                const isChecked = item.medicine_name && item.medicine_name.trim().length > 1;
                // IA status badge
                const aiStatus = safetyChecking
                  ? { icon: <Loader2 size={10} style={{ animation: "spin 1s linear infinite" }} />, label: "IA…", bg: "#e0e7ff", color: "#4338ca" }
                  : hasDanger
                    ? { icon: <AlertTriangle size={10} />, label: "DANGER", bg: "#fecaca", color: "#991b1b" }
                    : hasWarn
                      ? { icon: <AlertTriangle size={10} />, label: "Attention", bg: "#fde68a", color: "#92400e" }
                      : isChecked
                        ? { icon: <CheckCircle size={10} />, label: "IA ✓ OK", bg: "#d1fae5", color: "#065f46" }
                        : null;
                return (
                <div
                  key={idx}
                  className={`rx-pro-item ${item.is_free_text ? "is-free-text" : ""}`}
                  style={hasDanger
                    ? { borderLeft: "4px solid #dc2626", background: "#fef2f2" }
                    : hasWarn
                      ? { borderLeft: "4px solid #f59e0b", background: "#fffbeb" }
                      : isChecked
                        ? { borderLeft: "4px solid #10b981" }
                        : undefined}
                >
                  {aiStatus && (
                    <div style={{ position: "absolute", top: 4, right: 34, display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 10, fontSize: 10, fontWeight: 700, background: aiStatus.bg, color: aiStatus.color, zIndex: 2 }}>
                      {aiStatus.icon} {aiStatus.label}
                    </div>
                  )}
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
                  {itemAlerts.length > 0 && (
                    <div style={{ padding: "6px 12px 8px", fontSize: 11, color: hasDanger ? "#991b1b" : "#92400e" }}>
                      {itemAlerts.map((a, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 5, marginTop: 2 }}>
                          <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 2 }} />
                          <span>{a.message.replace(new RegExp(`^${item.medicine_name}:?\\s*`, "i"), "")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="rx-pro-item__remove" onClick={() => removeItem(idx)} title="Supprimer">
                    <X size={14} />
                  </button>
                </div>
                );
              })}
              {!items.length && (
                <div className="rx-pro-empty-items">
                  <Pill size={20} />
                  <span>Aucun medicament ajoute</span>
                </div>
              )}
            </div>

            {/* Smart-lists + Search */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[
                  { key: "mydb", label: "Ma Base", icon: DatabaseBackup },
                  { key: "recent", label: "Récents", icon: Clock },
                  { key: "favorites", label: "Favoris", icon: Star },
                  { key: "specialty", label: "Spécialités", icon: Stethoscope },
                ].map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setSmartTab(tab.key)}
                    style={{
                      padding: "6px 12px", borderRadius: 20, border: "none",
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 5,
                      background: smartTab === tab.key ? "#2563eb" : "#e2e8f0",
                      color: smartTab === tab.key ? "#fff" : "#475569",
                    }}
                  >
                    <tab.icon size={12} />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Smart-list content */}
              {smartTab === "mydb" && (() => {
                const filtered = dbMeds.filter(m => !dbSearch || m.name.toLowerCase().includes(dbSearch.toLowerCase()) || (m.dci || "").toLowerCase().includes(dbSearch.toLowerCase()));
                const maxUse = Math.max(...dbMeds.map(m => m.use_count), 1);
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "linear-gradient(135deg,#eff6ff,#f0f9ff)", border: "1px solid #bfdbfe", borderRadius: 10 }}>
                      <DatabaseBackup size={14} style={{ color: "#2563eb", flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#1e40af" }}>Base personnelle — GestionMedical</span>
                        <span style={{ fontSize: 10.5, color: "#64748b", marginLeft: 8 }}>{dbMeds.length} médicaments · triés par usage</span>
                      </div>
                      {!dbMedsLoaded && <Loader2 size={12} style={{ color: "#2563eb", animation: "spin 1s linear infinite" }} />}
                    </div>
                    {/* Search */}
                    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 8, background: "#f8fafc" }}>
                      <Search size={12} style={{ color: "#64748b", flexShrink: 0 }} />
                      <input value={dbSearch} onChange={e => setDbSearch(e.target.value)} placeholder="Filtrer ma base…"
                        style={{ flex: 1, border: "none", background: "transparent", fontSize: 12, outline: "none" }} />
                      {dbSearch && <button onClick={() => setDbSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}><X size={11} /></button>}
                    </div>
                    {/* Medicine list */}
                    <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
                      {filtered.length === 0 && <span style={{ fontSize: 11, color: "#94a3b8", padding: "8px 0" }}>{dbMedsLoaded ? "Aucun résultat" : "Chargement…"}</span>}
                      {filtered.slice(0, 80).map(med => {
                        const aiSt = dbMedAiStatus[med.name];
                        const usePct = Math.round((med.use_count / maxUse) * 100);
                        return (
                          <button key={med.id} onClick={() => addDbMedicine(med)}
                            style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", textAlign: "left" }}
                            onMouseEnter={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.borderColor = "#bfdbfe"; }}
                            onMouseLeave={e => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}>
                            <Plus size={12} style={{ color: "#2563eb", flexShrink: 0 }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{med.name}</span>
                                {med.use_count > 0 && (
                                  <span style={{ fontSize: 9.5, fontWeight: 700, background: "#dbeafe", color: "#1e40af", borderRadius: 8, padding: "1px 6px", flexShrink: 0 }}>
                                    ×{med.use_count}
                                  </span>
                                )}
                                {aiSt === "checking" && <Loader2 size={10} style={{ color: "#7c3aed", animation: "spin 1s linear infinite", flexShrink: 0 }} />}
                                {aiSt === "ok" && <CheckCircle size={10} style={{ color: "#10b981", flexShrink: 0 }} />}
                                {aiSt === "warn" && <AlertTriangle size={10} style={{ color: "#f59e0b", flexShrink: 0 }} />}
                                {aiSt === "danger" && <AlertTriangle size={10} style={{ color: "#dc2626", flexShrink: 0 }} />}
                              </div>
                              {(med.dci || med.posologie) && (
                                <div style={{ fontSize: 10, color: "#64748b", marginTop: 1 }}>
                                  {med.dci && <span>{med.dci}</span>}
                                  {med.posologie && <span> · {med.posologie}</span>}
                                </div>
                              )}
                              {med.use_count > 0 && (
                                <div style={{ marginTop: 3, height: 3, background: "#e2e8f0", borderRadius: 2, overflow: "hidden" }}>
                                  <div style={{ width: `${usePct}%`, height: "100%", background: "#3b82f6", borderRadius: 2 }} />
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {filtered.length > 80 && <span style={{ fontSize: 10.5, color: "#94a3b8", textAlign: "center", padding: "4px 0" }}>+{filtered.length - 80} autres — affinez la recherche</span>}
                    </div>
                  </div>
                );
              })()}
              {smartTab === "recent" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {recent.length === 0 && <span style={{ fontSize: 11, color: "#94a3b8" }}>Aucun medicament recent</span>}
                  {recent.map((med) => (
                    <SmartMedPill key={med.id} med={med} isFav={favorites.some(f => f.id === med.id)} onAdd={() => addMedicine(med)} onToggleFav={() => toggleFavorite(med)} onDetail={() => openDetail(med)} />
                  ))}
                </div>
              )}
              {smartTab === "favorites" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {favorites.length === 0 && <span style={{ fontSize: 11, color: "#94a3b8" }}>Aucun favori — cliquez sur l etoile dans la recherche</span>}
                  {favorites.map((med) => (
                    <SmartMedPill key={med.id} med={med} isFav onAdd={() => addMedicine(med)} onToggleFav={() => toggleFavorite(med)} onDetail={() => openDetail(med)} />
                  ))}
                </div>
              )}
              {smartTab === "specialty" && (
                <div>
                  <select
                    value={activeSpecialty}
                    onChange={(e) => setActiveSpecialty(e.target.value)}
                    style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12, marginBottom: 8, minWidth: 200 }}
                  >
                    <option value="">Choisir une specialite...</option>
                    {specialties.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {specialtyMeds.map((med) => (
                      <SmartMedPill key={med.id} med={med} isFav={favorites.some(f => f.id === med.id)} onAdd={() => addMedicine(med)} onToggleFav={() => toggleFavorite(med)} onDetail={() => openDetail(med)} />
                    ))}
                  </div>
                </div>
              )}

              {/* Free-text search */}
              <div className="rx-pro-add-row">
                <div className="rx-pro-search">
                  <Search size={14} />
                  <input
                    value={search}
                    placeholder="Rechercher medicament (nom, DCI, indication)..."
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  {searchResults.length > 0 && (
                    <div className="rx-pro-search__dropdown">
                      {searchResults.map((med) => (
                        <div key={med.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px" }}>
                          <button style={{ flex: 1, textAlign: "left", background: "none", border: "none", cursor: "pointer" }} onClick={() => addMedicine(med)}>
                            <strong>{med.brand_name}</strong>
                            <span style={{ fontSize: 11, color: "#64748b", marginLeft: 6 }}>{med.dci} | {med.dosage_strength}</span>
                          </button>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button title="Favori" onClick={(e) => { e.stopPropagation(); toggleFavorite(med); }} style={{ background: "none", border: "none", cursor: "pointer", color: favorites.some(f => f.id === med.id) ? "#f59e0b" : "#cbd5e1" }}>
                              <Star size={13} fill={favorites.some(f => f.id === med.id) ? "#f59e0b" : "none"} />
                            </button>
                            <button title="Details" onClick={(e) => { e.stopPropagation(); openDetail(med); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}>
                              <Info size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <button className="rx-pro-pill-btn" onClick={addFreeText}>
                  <Plus size={13} /> Texte libre
                </button>
              </div>
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
      {detailMed && <MedicineDetailModal medicine={detailMed} onClose={() => setDetailMed(null)} />}
    </div>
  );
}


// =====================================================================
// DOCUMENT TEMPLATES PANEL — Word-like Editor
// =====================================================================
function TemplateSelector({ templates, selected, onSelect, onNew, CAT_CFG }) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const grouped = ["ordonnance", "bilan", "certificat", "courrier", "rapport", "general"].reduce((a, c) => {
    a[c] = templates.filter(t => t.category === c && (!filter || (t.name || "").toLowerCase().includes(filter.toLowerCase())));
    return a;
  }, {});

  const cur = selected ? CAT_CFG[selected.category] || CAT_CFG.general : null;

  return (
    <div style={{ position: "relative", minWidth: 240 }} ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "9px 14px", background: "#fafbfc",
          border: "1px solid #eef2f7", borderRadius: 9,
          fontSize: 14, fontWeight: 500, color: "#0f172a",
          cursor: "pointer", minWidth: 240, justifyContent: "space-between",
        }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, minWidth: 0, overflow: "hidden" }}>
          <FileText size={14} style={{ color: cur?.color || "#64748b", flexShrink: 0 }} />
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {selected ? selected.name : "Choisir un modèle…"}
          </span>
        </span>
        <span style={{ fontSize: 10, opacity: .6 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0,
          background: "#fff", border: "1px solid #eef2f7",
          borderRadius: 12, boxShadow: "0 8px 28px rgba(15,23,42,.08)",
          minWidth: 360, maxWidth: 420, maxHeight: 500, overflowY: "auto",
          zIndex: 60, padding: 6,
        }}>
          <div style={{ padding: "4px 6px 8px", display: "flex", gap: 6 }}>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Rechercher…"
              autoFocus
              style={{ flex: 1, padding: "7px 10px", border: "1px solid #eef2f7", borderRadius: 8, fontSize: 13, outline: "none" }} />
            <button onClick={() => { onNew(); setOpen(false); }}
              title="Nouveau modèle"
              style={{ padding: "7px 12px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Plus size={13} /> Nouveau
            </button>
          </div>
          {Object.keys(grouped).map(cat => {
            const items = grouped[cat]; if (!items || !items.length) return null;
            const cfg = CAT_CFG[cat] || { color: "#64748b", label: cat };
            return (
              <div key={cat} style={{ marginTop: 4 }}>
                <div style={{ padding: "5px 10px", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>
                  {cfg.icon} {cfg.label}
                </div>
                {items.map(t => {
                  const isSel = selected?.id === t.id;
                  return (
                    <button key={t.id} onClick={() => { onSelect(t); setOpen(false); setFilter(""); }}
                      style={{
                        display: "block", width: "100%", textAlign: "left",
                        padding: "8px 12px", border: "none",
                        background: isSel ? "#eff6ff" : "transparent",
                        color: isSel ? "#1d4ed8" : "#0f172a",
                        fontSize: 13, fontWeight: isSel ? 600 : 500,
                        cursor: "pointer", borderRadius: 6,
                      }}
                      onMouseEnter={e => { if (!isSel) e.currentTarget.style.background = "#f8fafc"; }}
                      onMouseLeave={e => { if (!isSel) e.currentTarget.style.background = "transparent"; }}>
                      {t.name}
                    </button>
                  );
                })}
              </div>
            );
          })}
          {!templates.length && (
            <div style={{ padding: "20px 12px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
              Aucun modèle. Cliquez sur "Nouveau".
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function normalizeTemplateCategory(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return "general";
  if (raw === "compte_rendu" || raw === "compte-rendu" || raw === "compterendu" || raw === "report") return "rapport";
  return raw;
}

function TemplateMoreMenu({ onHeader, onDuplicate, onDelete, generatedDocs, category, setCategory, categoryOptions }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button onClick={() => setOpen(o => !o)} title="Plus"
        style={{
          padding: "9px 12px", borderRadius: 9, border: "1px solid #eef2f7",
          background: "#fff", color: "#475569", fontSize: 14, fontWeight: 700,
          cursor: "pointer", lineHeight: 1, minWidth: 38,
        }}>⋯</button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 4px)",
          background: "#fff", border: "1px solid #eef2f7",
          borderRadius: 10, boxShadow: "0 8px 24px rgba(15,23,42,.08)",
          minWidth: 220, padding: 6, zIndex: 60,
        }}>
          <div style={{ padding: "4px 10px 6px", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px" }}>Catégorie</div>
          <select value={category} onChange={e => setCategory(normalizeTemplateCategory(e.target.value))}
            style={{ display: "block", width: "calc(100% - 12px)", margin: "0 6px 6px", padding: "7px 10px", border: "1px solid #eef2f7", borderRadius: 7, fontSize: 13, background: "#fff", outline: "none" }}>
            <option value="ordonnance">Ordonnance</option>
            <option value="bilan">Bilan</option>
            <option value="certificat">Certificat</option>
            <option value="courrier">Courrier</option>
            <option value="rapport">Compte rendu</option>
            <option value="general">Général</option>
          </select>
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 4, paddingTop: 4 }}>
            <button onClick={() => { onDuplicate(); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", borderRadius: 6, fontSize: 13, color: "#0f172a", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Copy size={13} /> Dupliquer
            </button>
            <button onClick={() => { onHeader(); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", borderRadius: 6, fontSize: 13, color: "#0f172a", cursor: "pointer", textAlign: "left" }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Edit3 size={13} /> En-tête du cabinet
            </button>
            {onDelete && (
              <button onClick={() => { onDelete(); setOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", border: "none", background: "transparent", borderRadius: 6, fontSize: 13, color: "#dc2626", cursor: "pointer", textAlign: "left" }}
                onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <Trash2 size={13} /> Supprimer le modèle
              </button>
            )}
          </div>
          {generatedDocs && generatedDocs.length > 0 && (
            <div style={{ borderTop: "1px solid #f1f5f9", marginTop: 4, paddingTop: 4 }}>
              <div style={{ padding: "4px 10px 6px", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".4px" }}>Documents générés</div>
              {generatedDocs.slice(0, 6).map(doc => (
                <a key={doc.id} href={api.generatedDocumentPdf(doc.id)} target="_blank" rel="noreferrer"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 6, fontSize: 12.5, color: "#0f172a", textDecoration: "none" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <Download size={12} style={{ color: "#64748b" }} />
                  <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.title}</span>
                  <span style={{ fontSize: 10.5, color: "#94a3b8" }}>{String(doc.created_at || "").slice(0, 10)}</span>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DocumentTemplatesPanel({ patient, defaultCategory, allowedCategories }) {
  const [header, setHeader] = useState(() => { try { return JSON.parse(localStorage.getItem("ms_clinic_header") || "{}"); } catch { return {}; } });
  const [showHeaderEditor, setShowHeaderEditor] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState(null);
  const [editName, setEditName] = useState("");
  const normalizedDefaultCategory = normalizeTemplateCategory(defaultCategory || "ordonnance");
  const categoryScope = useMemo(() => {
    if (!allowedCategories?.length) return null;
    return [...new Set(allowedCategories.map((item) => normalizeTemplateCategory(item)))];
  }, [allowedCategories]);
  const [editCategory, setEditCategory] = useState(normalizedDefaultCategory);
  const [generatedDocs, setGeneratedDocs] = useState([]);
  const [saveMsg, setSaveMsg] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [editMode, setEditMode] = useState(false); // false=preview (auto-filled), true=edit raw template
  const editorRef = useRef(null);
  const [medSearch, setMedSearch] = useState("");
  const [medResults, setMedResults] = useState([]);
  const [isDirty, setIsDirty] = useState(false);
  const [prescriptionMeds, setPrescriptionMeds] = useState([]); // medicines added to aperçu ordonnance
  const [aiMedChecks, setAiMedChecks] = useState({}); // name→"checking"|"ok"|"warn"|"danger"

  // Auto-load doctor profile from backend settings on mount — prefer localStorage edits
  useEffect(() => {
    api.doctorProfile().then(prof => {
      if (!prof) return;
      setHeader(prev => {
        const merged = {
          doctor_name: prev.doctor_name || prof.name || "",
          specialty: prev.specialty || prof.specialty || "",
          phone: prev.phone || prof.phone || "",
          address: prev.address || prof.address || "",
          email: prev.email || prof.email || "",
          order_number: prev.order_number || prof.order_number || "",
          clinic: prev.clinic || prof.clinic_name || "",
          city: prev.city || prof.clinic_city || "",
          logo: prev.logo || prof.logo_b64 || "",
        };
        localStorage.setItem("ms_clinic_header", JSON.stringify(merged));
        return merged;
      });
    }).catch(() => {});
    loadTemplates();
  }, []);
  useEffect(() => { if (patient?.id) loadGeneratedDocs(); }, [patient?.id]);
  // Key for per-patient + per-template manual preview edits (localStorage persistence)
  const editsKey = (selected && patient) ? `ms_tmpl_edits_${patient.id}_${selected.id}` : null;

  useEffect(() => {
    if (categoryScope?.length) {
      setEditCategory((current) => (categoryScope.includes(current) ? current : categoryScope[0]));
      return;
    }
    setEditCategory(normalizedDefaultCategory);
  }, [categoryScope, normalizedDefaultCategory]);

  useEffect(() => {
    if (!selected) return;
    setEditName(selected.name || "");
    setEditCategory(normalizeTemplateCategory(selected.category));
  }, [selected?.id]);

  useEffect(() => {
    if (selected && editorRef.current) {
      const rawHtml = selected.body_html || "<p>Saisissez le contenu ici...</p>";
      if (editMode) {
        // EDIT mode: show raw template with {{variables}} visible for editing
        editorRef.current.innerHTML = rawHtml;
      } else {
        // PREVIEW mode: prefer saved manual edit (per patient+template), else substitute fresh
        let manual = null;
        if (editsKey) {
          try { manual = localStorage.getItem(editsKey); } catch {}
        }
        editorRef.current.innerHTML = manual || substituteVariables(rawHtml);
      }
    }
  }, [selected?.id, editMode, patient?.id, header.doctor_name, header.specialty, header.order_number, header.logo, header.phone, header.address, header.email, header.clinic]);

  // Reset prescription meds & AI checks when switching template or patient (no cached state)
  useEffect(() => {
    setPrescriptionMeds([]);
    setAiMedChecks({});
    setMedSearch("");
    setMedResults([]);
  }, [selected?.id, patient?.id]);

  // Re-substitute {{treatment}} in preview when prescriptionMeds changes
  useEffect(() => {
    if (!selected || editMode || !editorRef.current) return;
    editorRef.current.innerHTML = substituteVariables(selected.body_html || "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prescriptionMeds]);

  // Auto-save ONLY in edit mode (to avoid saving rendered patient data over template)
  useEffect(() => {
    if (!selected?.id || !editMode) return;
    const timer = setTimeout(async () => {
      try {
        const html = editorRef.current?.innerHTML || "";
        if (html === (selected.body_html || "")) return;
        await api.updateDocumentTemplate(selected.id, { name: editName, category: normalizeTemplateCategory(editCategory), body_html: html });
        setSaveMsg("✓ Auto-sauvegardé");
        setTimeout(() => setSaveMsg(""), 1500);
      } catch (_) {}
    }, 2000);
    return () => clearTimeout(timer);
  }, [editName, editCategory, selected?.id]);

  async function loadTemplates() {
    try {
      const d = await api.documentTemplates();
      const rows = (d.rows || []).map((row) => ({ ...row, category: normalizeTemplateCategory(row.category) }));
      const filtered = categoryScope?.length ? rows.filter((row) => categoryScope.includes(row.category)) : rows;
      setTemplates(filtered);
      setSelected((current) => {
        if (current) {
          const match = filtered.find((row) => row.id === current.id);
          if (match) return match;
        }
        return filtered[0] || null;
      });
    } catch {}
  }
  async function loadGeneratedDocs() { if (!patient?.id) return; try { const d = await api.patientGeneratedDocuments(patient.id); setGeneratedDocs(d.rows || []); } catch {} }

  function saveHeader(h) { setHeader(h); localStorage.setItem("ms_clinic_header", JSON.stringify(h)); }
  function handleLogo(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader(); r.onload = ev => saveHeader({ ...header, logo: ev.target.result }); r.readAsDataURL(file);
  }
  async function generateWithAI() {
    if (!aiPrompt.trim()) return;
    setAiBusy(true);
    try {
      const ctx = patient ? `Patient: ${patient.nom || ""} ${patient.prenom || ""}, ${patient.age ?? ""} ans, ${patient.sexe || ""}. ` : "";
      const instruction = `${ctx}Génère le CONTENU HTML d'un modèle médical de type "${editCategory}" pour: ${aiPrompt.trim()}.\n\nRÈGLES STRICTES:\n- Retourne UNIQUEMENT le HTML du corps du document (sans <html>, <head>, <body>)\n- Utilise des balises <p>, <strong>, <em>, <br/>, <ul><li>\n- Laisse des espaces avec {{patient_full_name_upper}}, {{date_time_short}}, {{doctor_template_name}} là où c'est logique\n- Police Times New Roman, style médical professionnel\n- NE RÉPONDS QU'AVEC LE HTML, rien d'autre`;
      const res = await api.aiChat({ message: instruction });
      const answer = res.answer || res.message || res.reply || "";
      const htmlMatch = answer.match(/<[a-z]/i);
      const htmlContent = htmlMatch ? answer.slice(answer.indexOf(htmlMatch[0])) : `<p>${answer}</p>`;
      if (editorRef.current) {
        editorRef.current.innerHTML = htmlContent;
      }
      setAiOpen(false); setAiPrompt("");
    } catch (e) { setSaveMsg("Erreur IA: " + (e.message || "indisponible")); }
    setAiBusy(false);
  }

  function exec(cmd, val = null) { editorRef.current?.focus(); document.execCommand(cmd, false, val); }

  function selectTmpl(tmpl) { setSelected(tmpl); setEditName(tmpl.name); setEditCategory(tmpl.category); }

  async function saveTemplate() {
    if (!selected || !editorRef.current) return;
    if (!editMode) {
      setSaveMsg("⚠ Activez le mode Édition pour modifier le modèle");
      setTimeout(() => setSaveMsg(""), 3000);
      return;
    }
    await api.updateDocumentTemplate(selected.id, { name: editName, category: normalizeTemplateCategory(editCategory), body_html: editorRef.current.innerHTML });
    setSaveMsg("Modèle enregistré ✓"); setTimeout(() => setSaveMsg(""), 2500); loadTemplates(); setIsDirty(false);
  }
  async function newTemplate() {
    const name = prompt("Nom du nouveau modèle ?"); if (!name) return;
    const nextCategory = normalizeTemplateCategory(editCategory);
    const tmpl = await api.createDocumentTemplate({ name, category: nextCategory, body_html: "<p></p>" });
    await loadTemplates(); if (tmpl?.id) selectTmpl({ ...tmpl, name, category: nextCategory, body_html: "<p></p>" });
  }
  async function dupTemplate() { if (!selected) return; await api.duplicateDocumentTemplate(selected.id); loadTemplates(); }
  async function delTemplate() {
    if (!selected) return;
    if (!confirm(`Supprimer le modèle "${selected.name}" ?`)) return;
    await api.deleteDocumentTemplate(selected.id);
    setSelected(null); setEditName(""); loadTemplates();
    setSaveMsg("Modèle supprimé"); setTimeout(() => setSaveMsg(""), 2000);
  }

  function substituteVariables(html) {
    const today = new Date();
    const fmtDate = today.toLocaleDateString("fr-DZ");
    const fmtDateLong = today.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
    const fmtTime = today.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const p = patient || {};
    const fullName = `${p.prenom || ""} ${(p.nom || "").toUpperCase()}`.trim();
    const ageStr = p.age != null ? `${p.age} ans` : (p.date_naissance ? `né(e) le ${String(p.date_naissance).slice(0,10)}` : "");
    const treatmentHtml = prescriptionMeds.length === 0
      ? "<p style=\"color:#94a3b8;font-style:italic\">Aucun m&eacute;dicament prescrit</p>"
      : prescriptionMeds.map((m, i) =>
          `<p style="margin:0 0 2pt;padding-left:10pt;font-family:'Times New Roman',serif;font-size:11pt;line-height:1.4;page-break-inside:avoid">` +
          `<strong>${i + 1}. ${m.name}${m.dosage ? " " + m.dosage : ""}</strong>` +
          (m.dci ? ` <em>(${m.dci})</em>` : "") +
          " \u2014 " + (m.posologie || "Posologie\u00a0: ________") +
          (m.days ? ` \u2014 pendant ${m.days} jour${String(m.days).trim() === "1" ? "" : "s"}` : "") +
          (m.instructions ? ` \u2014 ${m.instructions}` : "") +
          "</p>"
        ).join("");
    const map = {
      "{{patient.nom}}": (p.nom || "").toUpperCase(),
      "{{patient.prenom}}": p.prenom || "",
      "{{patient.fullname}}": fullName,
      "{{patient.age}}": p.age != null ? String(p.age) : "",
      "{{patient.age_complet}}": ageStr,
      "{{patient.date_naissance}}": p.date_naissance ? String(p.date_naissance).slice(0, 10) : "",
      "{{patient.sexe}}": p.sexe || "",
      "{{patient.telephone}}": p.telephone || "",
      "{{patient.adresse}}": p.adresse || "",
      "{{patient.code}}": p.code || "",
      "{{patient.profession}}": p.profession || "",
      "{{patient.groupe_sanguin}}": p.groupe_sanguin || "",
      "{{patient.allergies}}": p.allergies || "",
      "{{patient.maladies}}": p.maladies || "",
      "{{patient.mutuelle}}": p.mutuelle || "",
      "{{patient.numero_securite}}": p.numero_securite || "",
      "{{date}}": fmtDate,
      "{{date_long}}": fmtDateLong,
      "{{heure}}": fmtTime,
      "{{doctor.name}}": header.doctor_name || "",
      "{{doctor.specialty}}": header.specialty || "",
      "{{doctor.phone}}": header.phone || "",
      "{{doctor.address}}": header.address || "",
      "{{doctor.email}}": header.email || "",
      "{{doctor.order_number}}": header.order_number || "",
      "{{doctor.clinic}}": header.clinic || "",
      "{{doctor.city}}": header.city || "",
      // Flat aliases ({{doctor_name}}, {{patient_name}} etc.)
      "{{doctor_name}}": header.doctor_name || "",
      "{{doctor_specialty}}": header.specialty || "",
      "{{doctor_order_number}}": header.order_number || "",
      "{{doctor_address}}": header.address || "",
      "{{doctor_phone}}": header.phone || "",
      "{{doctor_email}}": header.email || "",
      "{{clinic_name}}": header.clinic || "",
      "{{doctor_city}}": header.city || "",
      "{{patient_name}}": (p.nom || "").toUpperCase(),
      "{{patient_first_name}}": p.prenom || "",
      "{{patient_birth_date}}": p.date_naissance ? String(p.date_naissance).slice(0, 10) : "",
      "{{patient_age}}": p.age != null ? String(p.age) : "",
      "{{patient_phone}}": p.telephone || "",
      "{{patient_address}}": p.adresse || "",
      "{{date_today}}": fmtDate,
      "{{time_now}}": fmtTime,
      // Full-page template variables (from default certificat/ordonnance templates)
      "{{doctor_template_name}}": header.doctor_name || "",
      "{{doctor_specialty_template}}": header.specialty || "",
      "{{doctor_specialty_label}}": header.specialty || "",
      "{{date_time_short}}": fmtDate,
      "{{date_time_long}}": fmtDateLong,
      "{{date_time_full}}": `${fmtDate} ${fmtTime}`,
      "{{patient_name_upper}}": (p.nom || "").toUpperCase(),
      "{{patient_first_name_upper}}": (p.prenom || "").toUpperCase(),
      "{{patient_full_name_upper}}": `${(p.prenom || "").toUpperCase()} ${(p.nom || "").toUpperCase()}`.trim(),
      "{{patient_full_name}}": fullName,
      "{{patient_subject}}": p.sexe === "F" ? "La patiente" : "Le patient",
      "{{patient_birth_label}}": p.sexe === "F" ? "Née le" : "Né le",
      "{{clinic_logo_data_url}}": header.logo ? `<img src="${header.logo}" alt="logo" style="max-height:70px;max-width:80px;object-fit:contain;"/>` : "",
      "{{school_year}}": (() => { const y = today.getFullYear(); return today.getMonth() >= 8 ? `${y}-${y+1}` : `${y-1}-${y}`; })(),
      // Certificat de dispense — extra template variables
      "{{doctor_phone_template}}": header.phone || "",
      "{{doctor_email_template}}": header.email || "",
      "{{doctor_address_template}}": header.address || "",
      "{{doctor_address_note_template}}": header.address_note || header.address || "",
      "{{clinic_city_template}}": header.city || header.clinic || "",
      "{{patient_request_label}}": p.sexe === "F" ? "l'int\u00e9ress\u00e9e" : "l'int\u00e9ress\u00e9",
      "{{treatment}}":   treatmentHtml,
      "{{medications}}": treatmentHtml,
      "{{ordonnance}}":  treatmentHtml,
      // Common placeholders that doctors fill in manually — show fillable underline
      "{{diagnosis}}":           "_______________________________________",
      "{{diagnostic}}":          "_______________________________________",
      "{{duration}}":            "_____________",
      "{{duree}}":               "_____________",
      "{{motif}}":               "_______________________________________",
      "{{motif_consultation}}":  "_______________________________________",
      "{{examen_clinique}}":     "_______________________________________",
      "{{conclusion}}":          "_______________________________________",
      "{{observations}}":        "_______________________________________",
      "{{antecedents}}":         p.antecedents || p.maladies || "_______________________________________",
      "{{allergies}}":           p.allergies || "Aucune connue",
    };
    let out = html;
    for (const [k, v] of Object.entries(map)) {
      out = out.split(k).join(v);
    }
    // Final sweep: replace any leftover {{...}} placeholders with a fillable underline
    out = out.replace(/\{\{[^}]+\}\}/g, "_______________");
    // If doctor uploaded a logo, swap the hardcoded heart SVG inside legacy templates
    // (e.g., "Certificat de dispense sportive") with their actual logo image.
    if (header.logo) {
      const logoImg = `<img src="${header.logo}" alt="logo" style="max-height:64px;max-width:80px;object-fit:contain;display:block;margin:0 auto;"/>`;
      // Match any <svg ...>...</svg> that contains the heart logo signature
      out = out.replace(/<svg\b[^>]*viewBox=["']0 0 96 96["'][\s\S]*?<\/svg>/gi, logoImg);
    }
    return out;
  }

  function insertVariable(token) {
    editorRef.current?.focus();
    document.execCommand("insertText", false, token);
  }

  // Medicine search for right panel
  useEffect(() => {
    if (medSearch.length < 2) { setMedResults([]); return; }
    const t = setTimeout(() => api.searchMedicines(medSearch).then(d => setMedResults(d.rows || [])).catch(() => {}), 220);
    return () => clearTimeout(t);
  }, [medSearch]);

  async function insertMedicine(med) {
    const name = med.brand_name || med.name || "";
    const dosage = med.dosage_strength || "";
    const dci = med.dci || "";
    // Prefer imported GestionMédicale defaults so the doctor doesn't retype
    const posologie = med.default_posology || med.posologie || "";
    const qty = med.default_quantity || "1";
    const days = med.default_duration || med.days || "";
    setPrescriptionMeds(prev => [...prev, { name, dosage, dci, posologie, instructions: "", qty, days }]);
    setMedSearch(""); setMedResults([]);
    // Immediate AI check — store level + reasons so UI can explain
    setAiMedChecks(s => ({ ...s, [name]: { level: "checking", reasons: [] } }));
    try {
      const res = await api.safetyCheck({ patient_id: patient?.id || null, medications: [name] });
      const alerts = res.warnings || [];
      const level = alerts.some(a => a.level === "danger") ? "danger"
                  : alerts.some(a => a.level === "warning") ? "warn"
                  : "ok";
      const reasons = alerts.filter(a => a.level !== "ok").map(a => a.message).filter(Boolean);
      setAiMedChecks(s => ({ ...s, [name]: { level, reasons } }));
    } catch (_) {
      setAiMedChecks(s => ({ ...s, [name]: { level: "ok", reasons: [] } }));
    }
  }

  function buildPrintHtml(withPatient = false) {
    const rawContent = editorRef.current?.innerHTML || "";
    let content = substituteVariables(rawContent);
    // Sanitize legacy template CSS that wastes vertical space on A5
    content = content.replace(/min-height\s*:\s*[^;"]+;?/gi, "");
    const today = new Date();
    const fmtDate = today.toLocaleDateString("fr-DZ");
    const fmtTime = today.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const p = patient || {};
    const pNom = (p.nom || "").toUpperCase();
    const pPrenom = p.prenom || "";
    const pAge = p.age != null ? `${p.age} ans` : "";
    const pDob = p.date_naissance ? String(p.date_naissance).slice(0, 10) : "";
    const pSex = p.sexe || "";
    const logoHtml = header.logo ? `<img src="${header.logo}" alt="logo" style="max-height:70px;max-width:80px;object-fit:contain;"/>` : "";
    const docAddr = [header.address || "", header.city || ""].filter(Boolean).join(", ");
    const footerParts = [
      header.phone ? `&#9990; ${header.phone}` : "",
      header.email ? `&#9993; ${header.email}` : "",
      docAddr ? `&#9492; ${docAddr}` : "",
    ].filter(Boolean).join(" &nbsp;|&nbsp; ");
    // Full-page templates (like "Certificat de dispense sportive") embed their own header
    // with {{variable}} placeholders — just wrap in minimal print HTML, no outer header
    const isFullPage = content.includes('data-template-layout');
    if (isFullPage) {
      return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${header.doctor_name || "Document"}</title><style>
@page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;padding:0;font-family:'Times New Roman',serif}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>${content}</body></html>`;
    }
    // Append medicines at bottom only if template has no {{treatment}} placeholder
    const hasRxSlot = (selected?.body_html || "").includes("{{treatment}}");
    const rxHtml = (!hasRxSlot && prescriptionMeds.length > 0)
      ? `<div class="rx-block">` +
        prescriptionMeds.map((m, i) =>
          `<p style="padding-left:10pt">` +
          `<strong>${i + 1}. ${m.name}${m.dosage ? " " + m.dosage : ""}</strong>` +
          (m.dci ? ` <em>(${m.dci})</em>` : "") +
          (m.posologie ? ` &mdash; <span>${m.posologie}</span>` : " &mdash; Posologie&nbsp;: ________") +
          (m.days ? ` &mdash; pendant ${m.days} jour${String(m.days).trim() === "1" ? "" : "s"}` : "") +
          (m.instructions ? ` &mdash; ${m.instructions}` : "") +
          `</p>`
        ).join("") +
        `</div>`
      : "";
    // Standard ordonnance / body-only templates — wrap with 3-col header (A5)
    return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>${header.doctor_name || "Document"}</title><style>
@page{size:A5;margin:8mm 10mm}
*{box-sizing:border-box;margin:0;padding:0}
html,body{font-family:'Times New Roman',serif;font-size:11pt;color:#111;line-height:1.45}
.hdr-tbl{width:100%;border-collapse:collapse;border-bottom:2px solid #000;padding-bottom:4px;margin-bottom:4px}
.hdr-tbl td{vertical-align:top;padding:0 3px}
.hdr-left{width:38%}.hdr-center{width:24%;text-align:center;vertical-align:middle}.hdr-right{width:38%;text-align:right}
.doc-name{font-size:12pt;font-weight:bold;margin-bottom:1px}
.doc-spec{font-size:10pt;font-weight:bold}
.doc-ordre{font-size:8.5pt;margin-top:2px;font-weight:normal}
.hdr-right .rl{font-size:10pt;margin:1px 0}
.sep{border:none;border-top:2px solid #000;margin:4px 0 8px}
.body{font-size:11pt;line-height:1.5}
.body p{margin:0 0 4pt}
.body h1,.body h2,.body h3{margin:6pt 0 4pt}
.body ul,.body ol{padding-left:18px;margin:4pt 0}
.body table{width:100%;border-collapse:collapse;margin:4pt 0}
.body table td,.body table th{border:1px solid #ccc;padding:3px 5px;font-size:10pt}
.rx-block{margin-top:6pt;padding-top:4pt;border-top:1px dashed #888}
.rx-block p{page-break-inside:avoid;break-inside:avoid;margin:0 0 2pt;line-height:1.35}
.ftr{border-top:1px solid #000;padding-top:3px;font-size:8.5pt;text-align:center;margin-top:6pt;page-break-inside:avoid;break-inside:avoid}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none}}
</style></head><body>
<table class="hdr-tbl"><tr>
  <td class="hdr-left">
    <div class="doc-name">${header.doctor_name || "Dr. Nom Prénom"}</div>
    <div class="doc-spec">${header.specialty || ""}</div>
    ${header.order_number ? `<div class="doc-ordre">N&deg; d'ordre des m&eacute;decins : ${header.order_number}</div>` : ""}
  </td>
  <td class="hdr-center">${logoHtml}</td>
  <td class="hdr-right">
    <div class="rl">Date&nbsp;: <strong>${fmtDate}</strong></div>
    ${withPatient && pNom ? `<div class="rl">Nom&nbsp;: <strong>${pNom}</strong></div>` : ""}
    ${withPatient && pPrenom ? `<div class="rl">Pr&eacute;nom&nbsp;: <strong>${pPrenom}</strong></div>` : ""}
    ${withPatient && pAge ? `<div class="rl">Age&nbsp;: <strong>${pAge}</strong></div>` : ""}
    ${withPatient && pDob && !pAge ? `<div class="rl">N&eacute;(e) le&nbsp;: <strong>${pDob}</strong></div>` : ""}
  </td>
</tr></table>
<hr class="sep"/>
<div class="body">${content}${rxHtml}</div>
<div class="ftr">${footerParts}</div>
</body></html>`;
  }

  function printDoc() {
    // Tauri-safe: use a hidden iframe instead of window.open
    const html = buildPrintHtml(true);
    const old = document.getElementById("__msmart_print_frame");
    if (old) old.remove();
    const iframe = document.createElement("iframe");
    iframe.id = "__msmart_print_frame";
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (e) {
        // Fallback to window.open if available
        const w = window.open("", "_blank");
        if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.focus(); w.print(); }, 300); }
      }
    };
    iframe.srcdoc = html;
  }
  async function generateDoc() {
    if (!patient?.id || !selected || !editorRef.current) return;
    const body_html = buildPrintHtml(true);
    await api.generateDocument({ patient_id: patient.id, template_id: selected.id, title: selected.name, variables: {}, body_html });
    loadGeneratedDocs(); setSaveMsg("Document généré ✓"); setTimeout(() => setSaveMsg(""), 2500);
  }

  const CAT_CFG = {
    ordonnance:   { color: "#3b82f6", bg: "#eff6ff", icon: "💊", label: "Ordonnances" },
    bilan:        { color: "#8b5cf6", bg: "#f5f3ff", icon: "🔬", label: "Bilans" },
    certificat:   { color: "#22c55e", bg: "#f0fdf4", icon: "📋", label: "Certificats" },
    courrier:     { color: "#f59e0b", bg: "#fffbeb", icon: "✉",  label: "Courriers" },
    rapport:      { color: "#ec4899", bg: "#fdf2f8", icon: "📊", label: "Comptes rendus" },
    general:      { color: "#64748b", bg: "#f8fafc", icon: "📄", label: "Généraux" },
  };
  const ALL_CATS = categoryScope?.length ? categoryScope.filter((cat) => CAT_CFG[cat]) : Object.keys(CAT_CFG);
  const categoryOptions = ALL_CATS.map((cat) => ({ value: cat, label: CAT_CFG[cat]?.label || cat }));
  const [filterCategory, setFilterCategory] = React.useState(normalizedDefaultCategory || "");
  React.useEffect(() => { if (defaultCategory) setFilterCategory(normalizeTemplateCategory(defaultCategory)); }, [defaultCategory]);
  const grouped = (templates || []).reduce((a, t) => { const c = t.category || "general"; (a[c] = a[c] || []).push(t); return a; }, {});
  const visibleTemplates = filterCategory ? templates.filter(t => t.category === filterCategory) : templates;

  return (
    <div style={{ display: "flex", height: "100%", background: "#fafbfc", overflow: "hidden" }}>

      {/* ══════════ LEFT CATEGORY SIDEBAR ══════════ */}
      <aside style={{ width: 168, flexShrink: 0, background: "#fff", borderRight: "1px solid #eef2f7", display: "flex", flexDirection: "column", overflowY: "auto" }}>
        <div style={{ padding: "11px 12px", borderBottom: "1px solid #eef2f7", fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>Catégories</div>
        <button onClick={() => setFilterCategory("")} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: "none", background: filterCategory === "" ? "#eff6ff" : "transparent", color: filterCategory === "" ? "#1d4ed8" : "#475569", fontWeight: filterCategory === "" ? 700 : 500, fontSize: 12.5, cursor: "pointer", borderLeft: `3px solid ${filterCategory === "" ? "#3b82f6" : "transparent"}`, textAlign: "left" }}>
          <span>📁</span> Tous les modèles
        </button>
        {ALL_CATS.map(cat => {
          const cfg = CAT_CFG[cat];
          const count = (grouped[cat] || []).length;
          return (
            <button key={cat} onClick={() => { setFilterCategory(cat); setEditCategory(cat); }} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 12px", border: "none", background: filterCategory === cat ? cfg.bg : "transparent", color: filterCategory === cat ? cfg.color : "#475569", fontWeight: filterCategory === cat ? 700 : 500, fontSize: 12.5, cursor: "pointer", borderLeft: `3px solid ${filterCategory === cat ? cfg.color : "transparent"}`, textAlign: "left", width: "100%" }}>
              <span>{cfg.icon}</span>
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cfg.label}</span>
              {count > 0 && <span style={{ fontSize: 10, background: filterCategory === cat ? cfg.color + "22" : "#f1f5f9", color: filterCategory === cat ? cfg.color : "#94a3b8", borderRadius: 999, padding: "1px 6px", fontWeight: 700 }}>{count}</span>}
            </button>
          );
        })}
        <div style={{ marginTop: "auto", padding: "10px 12px", borderTop: "1px solid #eef2f7" }}>
          <button onClick={newTemplate} style={{ width: "100%", padding: "7px 10px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
            <Plus size={13} /> Nouveau
          </button>
        </div>
      </aside>

      {/* ══════════ MAIN AREA ══════════ */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>

        {/* ─── Top bar : template dropdown + key actions ─── */}
        <div style={{
          flexShrink: 0, display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", background: "#fff",
          borderBottom: "1px solid #eef2f7",
        }}>
          <TemplateSelector
            templates={visibleTemplates}
            selected={selected}
            onSelect={(t) => { selectTmpl(t); setIsDirty(false); }}
            onNew={newTemplate}
            CAT_CFG={CAT_CFG}
          />
          {selected && (
            <input value={editName} onChange={e => setEditName(e.target.value)}
              placeholder="Nom du modèle"
              style={{ flex: 1, minWidth: 200, padding: "9px 12px", border: "1px solid #eef2f7", borderRadius: 9, fontSize: 14, outline: "none" }} />
          )}

          {selected && (
            <>
              <button onClick={() => setEditMode(v => !v)}
                title={editMode ? "Passer en aperçu" : "Modifier le modèle"}
                style={{
                  padding: "9px 14px", borderRadius: 9, border: "1px solid #eef2f7",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  background: editMode ? "#eff6ff" : "#fff",
                  color: editMode ? "#1d4ed8" : "#475569",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                {editMode ? <><Pencil size={13} /> Édition</> : <><Eye size={13} /> Aperçu</>}
              </button>

              <button onClick={saveTemplate}
                style={{
                  padding: "9px 16px", borderRadius: 9,
                  border: "1px solid #eef2f7",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: "#fff", color: "#0f172a",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                <Save size={13} /> {saveMsg || "Sauvegarder"}
              </button>

              <button onClick={printDoc}
                style={{
                  padding: "9px 16px", borderRadius: 9, border: "1px solid #eef2f7",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  background: "#fff", color: "#475569",
                  display: "inline-flex", alignItems: "center", gap: 6,
                }}>
                <Printer size={13} /> Imprimer
              </button>

              {patient && (
                <button onClick={generateDoc}
                  style={{
                    padding: "9px 18px", borderRadius: 9, border: "none",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    background: "#3b82f6", color: "#fff",
                    display: "inline-flex", alignItems: "center", gap: 6,
                  }}>
                  <FileText size={13} /> Générer PDF
                </button>
              )}

              <TemplateMoreMenu
                onHeader={() => setShowHeaderEditor(true)}
                onDuplicate={dupTemplate}
                onDelete={delTemplate}
                generatedDocs={generatedDocs}
                category={editCategory}
                setCategory={setEditCategory}
                categoryOptions={categoryOptions}
              />
            </>
          )}
        </div>

        {/* ─── Word-like formatting toolbar (only in edit mode) ─── */}
        {selected && editMode && (
          <div style={{
            flexShrink: 0, display: "flex", alignItems: "center", gap: 3,
            padding: "6px 18px", background: "#fafbfc",
            borderBottom: "1px solid #eef2f7", flexWrap: "wrap",
          }}>
            {/* Font family */}
            <select title="Police" defaultValue="Times New Roman" onChange={e => exec("fontName", e.target.value)}
              style={{ padding: "4px 6px", border: "1px solid #eef2f7", borderRadius: 5, fontSize: 11, background: "#fff", color: "#475569", cursor: "pointer", maxWidth: 115 }}>
              {["Times New Roman","Arial","Helvetica","Georgia","Courier New","Verdana","Tahoma","Calibri"].map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
            </select>
            {/* Font size */}
            <select title="Taille" onChange={e => exec("fontSize", e.target.value)} defaultValue=""
              style={{ padding: "4px 6px", border: "1px solid #eef2f7", borderRadius: 5, fontSize: 11, background: "#fff", color: "#475569", cursor: "pointer", width: 58 }}>
              <option value="" disabled>Taille</option>
              {[["1","8"],["2","10"],["3","12"],["4","14"],["5","18"],["6","24"],["7","36"]].map(([v,l]) => <option key={v} value={v}>{l}pt</option>)}
            </select>
            <span style={{ width: 1, height: 18, background: "#e5e7eb", margin: "0 3px" }} />
            {/* Bold, Italic, Underline, Strikethrough */}
            {[
              { ic: <Bold size={13} />, cmd: "bold", title: "Gras (Ctrl+B)" },
              { ic: <Italic size={13} />, cmd: "italic", title: "Italique (Ctrl+I)" },
              { ic: <Underline size={13} />, cmd: "underline", title: "Souligné (Ctrl+U)" },
              { ic: <Strikethrough size={13} />, cmd: "strikeThrough", title: "Barré" },
            ].map(b => (
              <button key={b.cmd} title={b.title} onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
                style={{ padding: "5px 7px", border: "none", background: "transparent", borderRadius: 5, cursor: "pointer", color: "#475569" }}
                onMouseEnter={e => e.currentTarget.style.background = "#eef2f7"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {b.ic}
              </button>
            ))}
            <input type="color" title="Couleur du texte" onChange={e => exec("foreColor", e.target.value)} defaultValue="#000000"
              style={{ width: 24, height: 22, padding: 0, border: "1px solid #eef2f7", borderRadius: 5, cursor: "pointer" }} />
            <input type="color" title="Surbrillance" onChange={e => exec("hiliteColor", e.target.value)} defaultValue="#ffffff"
              style={{ width: 24, height: 22, padding: 0, border: "1px solid #eef2f7", borderRadius: 5, cursor: "pointer" }} />
            <span style={{ width: 1, height: 18, background: "#e5e7eb", margin: "0 3px" }} />
            {/* Alignment */}
            {[
              { ic: <AlignLeft size={13} />, cmd: "justifyLeft", title: "Aligner à gauche" },
              { ic: <AlignCenter size={13} />, cmd: "justifyCenter", title: "Centrer" },
              { ic: <AlignRight size={13} />, cmd: "justifyRight", title: "Aligner à droite" },
              { ic: <AlignJustify size={13} />, cmd: "justifyFull", title: "Justifier" },
            ].map(b => (
              <button key={b.cmd} title={b.title} onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
                style={{ padding: "5px 7px", border: "none", background: "transparent", borderRadius: 5, cursor: "pointer", color: "#475569" }}
                onMouseEnter={e => e.currentTarget.style.background = "#eef2f7"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {b.ic}
              </button>
            ))}
            <span style={{ width: 1, height: 18, background: "#e5e7eb", margin: "0 3px" }} />
            {/* Lists */}
            {[
              { ic: <List size={13} />, cmd: "insertUnorderedList", title: "Liste à puces" },
              { ic: <ListOrdered size={13} />, cmd: "insertOrderedList", title: "Liste numérotée" },
            ].map(b => (
              <button key={b.cmd} title={b.title} onMouseDown={e => { e.preventDefault(); exec(b.cmd); }}
                style={{ padding: "5px 7px", border: "none", background: "transparent", borderRadius: 5, cursor: "pointer", color: "#475569" }}
                onMouseEnter={e => e.currentTarget.style.background = "#eef2f7"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {b.ic}
              </button>
            ))}
            <span style={{ width: 1, height: 18, background: "#e5e7eb", margin: "0 3px" }} />
            {/* Paragraph style */}
            <select title="Style de paragraphe" defaultValue="" onChange={(e) => { if (e.target.value) { exec("formatBlock", e.target.value); e.target.value = ""; } }}
              style={{ padding: "4px 6px", border: "1px solid #eef2f7", borderRadius: 5, fontSize: 11, background: "#fff", color: "#475569", cursor: "pointer" }}>
              <option value="" disabled>Style</option>
              <option value="H1">Titre 1</option>
              <option value="H2">Titre 2</option>
              <option value="H3">Titre 3</option>
              <option value="P">Paragraphe</option>
              <option value="BLOCKQUOTE">Citation</option>
              <option value="PRE">Code</option>
            </select>
            <span style={{ width: 1, height: 18, background: "#e5e7eb", margin: "0 3px" }} />
            {/* Table insertion */}
            <button title="Insérer un tableau" onMouseDown={e => {
              e.preventDefault();
              const rows = prompt("Nombre de lignes :", "3"); if (!rows) return;
              const cols = prompt("Nombre de colonnes :", "3"); if (!cols) return;
              const r = parseInt(rows, 10) || 3; const c = parseInt(cols, 10) || 3;
              let html = '<table style="width:100%;border-collapse:collapse;margin:8px 0"><tbody>';
              for (let i = 0; i < r; i++) {
                html += "<tr>";
                for (let j = 0; j < c; j++) html += `<td style="border:1px solid #ccc;padding:6px 8px;min-width:40px">${i === 0 ? "<strong>&nbsp;</strong>" : "&nbsp;"}</td>`;
                html += "</tr>";
              }
              html += "</tbody></table><p></p>";
              exec("insertHTML", html);
            }}
              style={{ padding: "5px 7px", border: "none", background: "transparent", borderRadius: 5, cursor: "pointer", color: "#475569" }}
              onMouseEnter={e => e.currentTarget.style.background = "#eef2f7"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Table2 size={13} />
            </button>
            {/* Horizontal rule */}
            <button title="Ligne horizontale" onMouseDown={e => { e.preventDefault(); exec("insertHTML", "<hr style='border:none;border-top:1px solid #999;margin:10px 0'/>"); }}
              style={{ padding: "5px 7px", border: "none", background: "transparent", borderRadius: 5, cursor: "pointer", color: "#475569" }}
              onMouseEnter={e => e.currentTarget.style.background = "#eef2f7"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Minus size={13} />
            </button>
            {/* Image / Logo insertion */}
            <button title="Insérer une image / logo" onMouseDown={e => {
              e.preventDefault();
              const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
              inp.onchange = () => {
                const file = inp.files?.[0]; if (!file) return;
                const reader = new FileReader();
                reader.onload = ev => { exec("insertHTML", `<img src="${ev.target.result}" alt="image" style="max-width:100%;max-height:200px;display:block;margin:8px auto;"/>`); };
                reader.readAsDataURL(file);
              };
              inp.click();
            }}
              style={{ padding: "5px 7px", border: "none", background: "transparent", borderRadius: 5, cursor: "pointer", color: "#475569" }}
              onMouseEnter={e => e.currentTarget.style.background = "#eef2f7"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Image size={13} />
            </button>
            <span style={{ width: 1, height: 18, background: "#e5e7eb", margin: "0 3px" }} />
            {/* Variables */}
            <select title="Insérer une variable" defaultValue="" onChange={(e) => { if (e.target.value) { insertVariable(e.target.value); e.target.value = ""; } }}
              style={{ padding: "4px 6px", border: "1px solid #93c5fd", borderRadius: 5, fontSize: 11, background: "#eff6ff", color: "#1d4ed8", cursor: "pointer", fontWeight: 600 }}>
              <option value="" disabled>＋ Variable</option>
              <optgroup label="Patient">
                <option value="{{patient_full_name_upper}}">Nom complet (MAJ)</option>
                <option value="{{patient.nom}}">Nom</option>
                <option value="{{patient.prenom}}">Prénom</option>
                <option value="{{patient.age}}">Âge</option>
                <option value="{{patient.date_naissance}}">Date naissance</option>
                <option value="{{patient.sexe}}">Sexe</option>
                <option value="{{patient.telephone}}">Téléphone</option>
                <option value="{{patient.adresse}}">Adresse</option>
                <option value="{{patient.code}}">N° dossier</option>
                <option value="{{patient.groupe_sanguin}}">Gr. sanguin</option>
                <option value="{{patient.allergies}}">Allergies</option>
                <option value="{{patient.profession}}">Profession</option>
                <option value="{{patient_subject}}">Le/La patient(e)</option>
                <option value="{{patient_birth_label}}">Né(e) le</option>
              </optgroup>
              <optgroup label="Médecin">
                <option value="{{doctor.name}}">Nom médecin</option>
                <option value="{{doctor.specialty}}">Spécialité</option>
                <option value="{{doctor.order_number}}">N° Ordre</option>
                <option value="{{doctor.clinic}}">Cabinet</option>
                <option value="{{doctor.city}}">Ville</option>
                <option value="{{doctor.phone}}">Téléphone</option>
                <option value="{{doctor.address}}">Adresse</option>
                <option value="{{doctor.email}}">Email</option>
              </optgroup>
              <optgroup label="Date / Document">
                <option value="{{date}}">Date du jour</option>
                <option value="{{date_long}}">Date longue</option>
                <option value="{{heure}}">Heure</option>
                <option value="{{date_time_full}}">Date + Heure</option>
                <option value="{{school_year}}">Année scolaire</option>
              </optgroup>
              <optgroup label="Contenu médical">
                <option value="{{diagnostic}}">Diagnostic</option>
                <option value="{{treatment}}">Traitement / Ordonnance</option>
                <option value="{{motif}}">Motif consultation</option>
                <option value="{{examen_clinique}}">Examen clinique</option>
                <option value="{{conclusion}}">Conclusion</option>
                <option value="{{observations}}">Observations</option>
                <option value="{{antecedents}}">Antécédents</option>
                <option value="{{allergies}}">Allergies</option>
                <option value="{{duration}}">Durée</option>
              </optgroup>
              <optgroup label="Logo">
                <option value="{{clinic_logo_data_url}}">Logo du cabinet</option>
              </optgroup>
            </select>
            <span style={{ width: 1, height: 18, background: "#e5e7eb", margin: "0 3px" }} />
            <button title="Annuler (Ctrl+Z)" onMouseDown={(e) => { e.preventDefault(); exec("undo"); }}
              style={{ padding: "5px 7px", border: "none", background: "transparent", borderRadius: 5, cursor: "pointer", color: "#475569", fontSize: 13 }}>↶</button>
            <button title="Rétablir (Ctrl+Y)" onMouseDown={(e) => { e.preventDefault(); exec("redo"); }}
              style={{ padding: "5px 7px", border: "none", background: "transparent", borderRadius: 5, cursor: "pointer", color: "#475569", fontSize: 13 }}>↷</button>
          </div>
        )}

        {/* ─── Editor body (big A4) + side meds panel ─── */}
        {selected ? (
          <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

            {/* A4 canvas */}
            <div className="word-editor-a4-wrap">
              <div className="tmpl-a4-page">
                {!(selected?.body_html || "").includes('data-template-layout') && (
                  <>
                    <div className="tmpl-a4-hdr">
                      <div className="tmpl-a4-hdr__left">
                        <div className="tmpl-a4-name">Dr. {header.doctor_name || "Nom Prénom"}</div>
                        <div className="tmpl-a4-spec">{header.specialty || "Spécialité"}</div>
                        {header.order_number && <div className="tmpl-a4-ordre">N° d'ordre des médecins : {header.order_number}</div>}
                      </div>
                      <div className="tmpl-a4-hdr__center">
                        {header.logo
                          ? <img src={header.logo} alt="logo" style={{ maxHeight: 60, maxWidth: 72, objectFit: "contain" }} />
                          : <button type="button" onClick={() => setShowHeaderEditor(true)} className="tmpl-a4-logo-placeholder" title="Ajouter un logo"><Heart size={26} style={{ color: "#ef4444", opacity: 0.45 }} /></button>}
                      </div>
                      <div className="tmpl-a4-hdr__right">
                        <div>Date : <strong>{new Date().toLocaleDateString("fr-DZ")}</strong></div>
                        {patient?.nom && <div>Nom : <strong>{(patient.nom || "").toUpperCase()}</strong></div>}
                        {patient?.prenom && <div>Prénom : <strong>{patient.prenom}</strong></div>}
                        {patient?.age != null && <div>Age : <strong>{patient.age} ans</strong></div>}
                      </div>
                    </div>
                    <div className="tmpl-a4-sep" />
                  </>
                )}
                <div ref={editorRef} className="word-editor-a4" contentEditable suppressContentEditableWarning spellCheck={false}
                  onInput={() => {
                    if (editMode) {
                      setIsDirty(true);
                    } else if (editsKey && editorRef.current) {
                      // Persist manual preview-mode edits per patient + template
                      try { localStorage.setItem(editsKey, editorRef.current.innerHTML); } catch {}
                    }
                  }} />

                {/* ── PRESCRIPTION MEDICINES (live, always visible) ── */}
                {prescriptionMeds.length > 0 && (
                  <div style={{ marginTop: 14, paddingTop: 10, borderTop: "1px dashed #94a3b8" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Médicaments prescrits
                      </span>
                      <button onClick={() => setPrescriptionMeds([])}
                        style={{ fontSize: 10, color: "#94a3b8", background: "none", border: "none", cursor: "pointer" }}>
                        Effacer tout
                      </button>
                    </div>
                    {prescriptionMeds.map((m, i) => {
                      const _raw = aiMedChecks[m.name];
                      const aiObj = typeof _raw === "string" ? { level: _raw, reasons: [] } : (_raw || { level: "", reasons: [] });
                      const aiSt = aiObj.level;
                      const aiReasons = aiObj.reasons || [];
                      return (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 6, marginBottom: 8, padding: "7px 10px", background: aiSt === "danger" ? "#fef2f2" : aiSt === "warn" ? "#fffbeb" : "#f8fafc", border: `1px solid ${aiSt === "danger" ? "#fecaca" : aiSt === "warn" ? "#fde68a" : "#e2e8f0"}`, borderRadius: 8, fontFamily: "'Times New Roman', serif" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, minWidth: 16, color: "#475569" }}>{i + 1}.</span>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{m.name}{m.dosage ? " " + m.dosage : ""}</span>
                              {m.dci && <span style={{ fontSize: 11, color: "#64748b", fontStyle: "italic" }}>({m.dci})</span>}
                              {aiSt === "checking" && <Loader2 size={11} style={{ color: "#7c3aed", animation: "spin 1s linear infinite" }} />}
                              {aiSt === "ok" && <span style={{ fontSize: 10, background: "#d1fae5", color: "#065f46", borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>IA ✓ Normal</span>}
                              {aiSt === "warn" && <span style={{ fontSize: 10, background: "#fde68a", color: "#92400e", borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>⚠ Attention</span>}
                              {aiSt === "danger" && <span style={{ fontSize: 10, background: "#fecaca", color: "#991b1b", borderRadius: 6, padding: "1px 6px", fontWeight: 700 }}>⛔ DANGER</span>}
                            </div>
                            {aiReasons.length > 0 && (
                              <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 10.5, color: aiSt === "danger" ? "#991b1b" : "#92400e", lineHeight: 1.45 }}>
                                {aiReasons.slice(0, 3).map((r, k) => <li key={k}>{r}</li>)}
                              </ul>
                            )}
                            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr", gap: 6, marginTop: 5 }}>
                              <input value={m.posologie} onChange={e => setPrescriptionMeds(prev => prev.map((x, j) => j === i ? { ...x, posologie: e.target.value } : x))}
                                placeholder="Posologie (ex: 1 cp matin)" style={{ fontSize: 11.5, padding: "4px 7px", border: "1px solid #e2e8f0", borderRadius: 5, fontFamily: "inherit", outline: "none" }} />
                              <input value={m.days || ""} onChange={e => setPrescriptionMeds(prev => prev.map((x, j) => j === i ? { ...x, days: e.target.value } : x))}
                                placeholder="Durée (j)" title="Durée en jours" style={{ fontSize: 11.5, padding: "4px 7px", border: "1px solid #e2e8f0", borderRadius: 5, fontFamily: "inherit", outline: "none", textAlign: "center" }} />
                              <input value={m.instructions} onChange={e => setPrescriptionMeds(prev => prev.map((x, j) => j === i ? { ...x, instructions: e.target.value } : x))}
                                placeholder="Instructions (ex: avant repas)" style={{ fontSize: 11.5, padding: "4px 7px", border: "1px solid #e2e8f0", borderRadius: 5, fontFamily: "inherit", outline: "none" }} />
                            </div>
                          </div>
                          <button onClick={() => setPrescriptionMeds(prev => prev.filter((_, j) => j !== i))}
                            style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: "2px 4px", flexShrink: 0 }}>
                            <X size={13} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ══════════ RIGHT PANEL — MEDICAMENTS (only with patient context) ══════════ */}
            {patient && (
            <aside style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", background: "#fff", borderLeft: "1px solid #eef2f7", overflow: "hidden" }}>
              <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #eef2f7" }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#0f172a", display: "flex", alignItems: "center", gap: 7 }}>
                  <Pill size={15} style={{ color: "#3b82f6" }} /> Médicaments
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>
                  Cliquez pour ajouter à l'ordonnance — l'IA vérifie automatiquement
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
                {/* Search */}
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "9px 11px", border: "1px solid #eef2f7", borderRadius: 9, background: "#fafbfc" }}>
                    <Search size={14} style={{ color: "#94a3b8", flexShrink: 0 }} />
                    <input value={medSearch} onChange={e => setMedSearch(e.target.value)} placeholder="Rechercher un médicament…"
                      style={{ flex: 1, border: "none", background: "transparent", fontSize: 13, outline: "none" }} />
                    {medSearch && <button onClick={() => { setMedSearch(""); setMedResults([]); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}><X size={12} /></button>}
                  </div>
                  {medResults.length > 0 && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: "1px solid #eef2f7", borderRadius: 9, boxShadow: "0 8px 24px rgba(15,23,42,.08)", zIndex: 50, maxHeight: 280, overflowY: "auto" }}>
                      {medResults.map(med => (
                        <button key={med.id} onClick={() => insertMedicine(med)}
                          style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "9px 11px", background: "none", border: "none", cursor: "pointer", textAlign: "left", borderBottom: "1px solid #f8fafc" }}
                          onMouseEnter={e => { e.currentTarget.style.background = "#f8fafc"; }}
                          onMouseLeave={e => e.currentTarget.style.background = "none"}>
                          <Plus size={13} style={{ color: "#3b82f6", flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>{med.brand_name}{med.dosage_strength ? " " + med.dosage_strength : ""}</div>
                            <div style={{ fontSize: 11, color: "#64748b" }}>{med.dci}{med.form ? " · " + med.form : ""}</div>
                            {med.default_posology && (
                              <div style={{ fontSize: 10.5, color: "#059669", fontWeight: 500, marginTop: 2 }}>
                                ⓘ {med.default_posology}{med.default_quantity ? " · " + med.default_quantity : ""}
                              </div>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Frequent meds — calm chips */}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".4px" }}>Fréquents</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {["ASPEGIC 100","CARDENSIEL","COVERSYL","TRIATEC","AMLOR","TAHOR","XARELTO","PREVISCAN","LASILIX","ALDACTONE","DOLIPRANE 1g","AUGMENTIN 1g","AMOXICILLINE","METFORMINE","ATORVASTATINE"].map(name => (
                      <button key={name}
                        onClick={() => insertMedicine({ brand_name: name, dci: "", dosage_strength: "" })}
                        style={{ padding: "5px 10px", background: "#fafbfc", border: "1px solid #eef2f7", borderRadius: 999, fontSize: 11.5, fontWeight: 500, color: "#475569", cursor: "pointer" }}
                        onMouseEnter={e => { e.currentTarget.style.background = "#eff6ff"; e.currentTarget.style.color = "#1d4ed8"; e.currentTarget.style.borderColor = "#bfdbfe"; }}
                        onMouseLeave={e => { e.currentTarget.style.background = "#fafbfc"; e.currentTarget.style.color = "#475569"; e.currentTarget.style.borderColor = "#eef2f7"; }}>
                        + {name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Patient context hint */}
                {patient && (patient.allergies || patient.maladies) && (
                  <div style={{ marginTop: 14, padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 9, fontSize: 11.5, color: "#92400e", lineHeight: 1.5 }}>
                    <strong style={{ display: "block", marginBottom: 3 }}>⚠ Contexte patient</strong>
                    {patient.allergies && <div>Allergies : {patient.allergies}</div>}
                    {patient.maladies && <div>Antécédents : {patient.maladies}</div>}
                  </div>
                )}

                {generatedDocs.length > 0 && (
                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #eef2f7" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".4px" }}>
                      Historique du patient
                    </div>
                    <div style={{ display: "grid", gap: 8 }}>
                      {generatedDocs.slice(0, 8).map((doc) => (
                        <a
                          key={doc.id}
                          href={api.generatedDocumentPdf(doc.id)}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 3,
                            padding: "9px 10px",
                            border: "1px solid #eef2f7",
                            borderRadius: 9,
                            background: "#fafbfc",
                            color: "#0f172a",
                            textDecoration: "none",
                          }}
                        >
                          <strong style={{ fontSize: 12.5, fontWeight: 600 }}>{doc.title || "Document"}</strong>
                          <span style={{ fontSize: 11, color: "#64748b" }}>{String(doc.created_at || "").slice(0, 16).replace("T", " ")}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </aside>
            )}

          </div>
        ) : (
          <div className="word-editor-empty">
            <FileCheck size={44} />
            <strong>Sélectionnez un modèle</strong>
            <span>Choisissez un modèle dans la liste déroulante ou créez-en un nouveau</span>
            <button className="word-tbtn--new-lg" onClick={newTemplate}><Plus size={15} /> Nouveau modèle</button>
          </div>
        )}
      </div>

      {/* ══════════ HEADER EDITOR MODAL ══════════ */}
      {showHeaderEditor && (
        <div onClick={() => setShowHeaderEditor(false)} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: "22px 26px", width: 520, maxHeight: "86vh", overflowY: "auto", boxShadow: "0 14px 40px rgba(0,0,0,.25)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #e2e8f0" }}>
              <h3 style={{ margin: 0, fontSize: 16, color: "#1e293b", display: "flex", alignItems: "center", gap: 8 }}>
                <Edit3 size={16} /> En-tête du cabinet
              </h3>
              <button onClick={() => setShowHeaderEditor(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "block", marginBottom: 6 }}>Logo du cabinet</label>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 90, height: 90, border: "2px dashed #cbd5e1", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", overflow: "hidden" }}>
                  {header.logo ? <img src={header.logo} alt="logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <Heart size={32} style={{ color: "#cbd5e1" }} />}
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  <label className="btn btn--secondary" style={{ cursor: "pointer", fontSize: 12, justifyContent: "center" }}>
                    <Upload size={13} /> Choisir un logo
                    <input type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
                  </label>
                  {header.logo && (
                    <button onClick={() => saveHeader({ ...header, logo: "" })} style={{ padding: "6px 10px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                      <Trash2 size={11} style={{ verticalAlign: "middle", marginRight: 4 }} /> Retirer
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {[["doctor_name","Nom du médecin","Dr. Jean Dupont"],["specialty","Spécialité","Cardiologue"],["order_number","N° Ordre","22/620/13"],["clinic","Nom du cabinet","Cabinet..."],["phone","Téléphone","0555 12 34 56"],["email","Email","contact@cabinet.dz"],["city","Ville","Sidi Bel Abbès"],["address","Adresse",""]].map(([k, lbl, ph]) => (
                <div key={k} style={k === "address" ? { gridColumn: "1 / -1" } : {}}>
                  <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 3 }}>{lbl}</label>
                  <input value={header[k] || ""} onChange={e => saveHeader({ ...header, [k]: e.target.value })} placeholder={ph}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, boxSizing: "border-box", fontFamily: "inherit" }} />
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
              <button onClick={() => setShowHeaderEditor(false)} style={{ padding: "8px 20px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                <CheckCircle size={13} /> Terminé
              </button>
            </div>
            <p style={{ fontSize: 11, color: "#64748b", marginTop: 10, fontStyle: "italic" }}>Ces informations sont utilisées dans tous les modèles et documents imprimés.</p>
          </div>
        </div>
      )}
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
 

// ═══════════════════════════════════════════════════════════════════════
// RÉFÉRENTIELS PANEL — Generic CRUD for all 8 reference entities
// ═══════════════════════════════════════════════════════════════════════

const REF_ENTITIES = [
  {
    key: "medicines", label: "Médicaments", icon: Pill, color: "#2563eb",
    columns: [
      { key: "brand_name", label: "Nom commercial", required: true },
      { key: "dci", label: "DCI" },
      { key: "dosage_strength", label: "Dosage" },
      { key: "form", label: "Forme" },
      { key: "route", label: "Voie" },
      { key: "laboratory", label: "Laboratoire" },
      { key: "indications", label: "Indications" },
    ],
    list: () => api.gestionDbMedicines("", 2000),
    listKey: "rows",
    create: (b) => api.addMedicine(b),
    update: (id, b) => api.updateMedicine(id, b),
    remove: (id) => api.deleteMedicine(id),
    searchFields: ["brand_name", "dci", "laboratory"],
  },
  {
    key: "diagnostics", label: "Diagnostics", icon: Stethoscope, color: "#7c3aed",
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Nom", required: true },
      { key: "category", label: "Catégorie" },
    ],
    list: () => api.diagnosticsCatalog(),
    listKey: "rows",
    create: (b) => api.createDiagnostic(b),
    update: (id, b) => api.updateDiagnostic(id, b),
    remove: (id) => api.deleteDiagnostic(id),
    searchFields: ["name", "code", "category"],
  },
  {
    key: "visit_types", label: "Types de visite", icon: ClipboardList, color: "#0891b2",
    columns: [
      { key: "name", label: "Nom", required: true },
      { key: "price", label: "Prix (DA)", type: "number" },
    ],
    list: () => api.visitTypes(),
    listKey: "rows",
    create: (b) => api.createVisitType(b),
    update: (id, b) => api.updateVisitType(id, b),
    remove: (id) => api.deleteVisitType(id),
    searchFields: ["name"],
  },
  {
    key: "tarifs", label: "Tarifs", icon: DollarSign, color: "#059669",
    columns: [
      { key: "label", label: "Libellé", required: true },
      { key: "amount", label: "Montant (DA)", type: "number" },
      { key: "category", label: "Catégorie" },
    ],
    list: () => api.tarifs(),
    listKey: "rows",
    create: (b) => api.createTarif(b),
    update: (id, b) => api.updateTarif(id, b),
    remove: (id) => api.deleteTarif(id),
    searchFields: ["label", "category"],
  },
  {
    key: "bilan_catalog", label: "Types bilan", icon: FlaskConical, color: "#d97706",
    columns: [
      { key: "name", label: "Nom", required: true },
      { key: "category", label: "Catégorie" },
    ],
    list: () => api.bilanCatalog(),
    listKey: "rows",
    create: (b) => api.addBilanCatalog(b),
    update: (id, b) => api.updateBilanCatalog(id, b),
    remove: (id) => api.deleteBilanCatalog(id),
    searchFields: ["name", "category"],
  },
  {
    key: "examens", label: "Examens", icon: TestTube, color: "#be123c",
    columns: [
      { key: "name", label: "Nom", required: true },
      { key: "category", label: "Catégorie" },
    ],
    list: () => api.bilanCatalog({ category: "Biologie" }),
    listKey: "rows",
    create: (b) => api.addBilanCatalog({ ...b, category: b.category || "Biologie" }),
    update: (id, b) => api.updateBilanCatalog(id, b),
    remove: (id) => api.deleteBilanCatalog(id),
    searchFields: ["name", "category"],
  },
  {
    key: "actes", label: "Actes", icon: FileCheck, color: "#4f46e5",
    columns: [
      { key: "code", label: "Code" },
      { key: "name", label: "Nom", required: true },
      { key: "price", label: "Prix (DA)", type: "number" },
      { key: "category", label: "Catégorie" },
    ],
    list: () => api.actesCatalog(),
    listKey: "rows",
    create: (b) => api.createActe(b),
    update: (id, b) => api.updateActe(id, b),
    remove: (id) => api.deleteActe(id),
    searchFields: ["name", "code", "category"],
  },
  {
    key: "doctors", label: "Médecins", icon: UserRound, color: "#0f766e",
    columns: [
      { key: "name", label: "Nom", required: true },
      { key: "speciality", label: "Spécialité" },
      { key: "phone", label: "Téléphone" },
      { key: "email", label: "Email" },
      { key: "address", label: "Adresse" },
      { key: "order_number", label: "N° Ordre" },
    ],
    list: () => api.doctors(0),
    listKey: "rows",
    create: (b) => api.createDoctor(b),
    update: (id, b) => api.updateDoctor(id, b),
    remove: (id) => api.deactivateDoctor(id),
    searchFields: ["name", "speciality", "phone"],
  },
];

function ReferentielsPanel() {
  const [activeEntity, setActiveEntity] = useState(REF_ENTITIES[0].key);
  const entity = REF_ENTITIES.find(e => e.key === activeEntity) || REF_ENTITIES[0];
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({});
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");

  async function loadRows() {
    setLoading(true);
    try {
      const res = await entity.list();
      setRows(res[entity.listKey] || res.rows || []);
    } catch { setRows([]); }
    setLoading(false);
  }

  useEffect(() => { loadRows(); setSearch(""); setEditingId(null); setCreating(false); }, [activeEntity]);

  const filtered = rows.filter(r => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return entity.searchFields.some(f => String(r[f] || "").toLowerCase().includes(q));
  });

  function startEdit(row) {
    setEditingId(row.id);
    const f = {};
    entity.columns.forEach(c => { f[c.key] = row[c.key] ?? ""; });
    setForm(f);
    setCreating(false);
  }

  function startCreate() {
    setCreating(true);
    setEditingId(null);
    const f = {};
    entity.columns.forEach(c => { f[c.key] = ""; });
    setForm(f);
  }

  async function saveEdit() {
    const required = entity.columns.filter(c => c.required);
    for (const c of required) {
      if (!String(form[c.key] || "").trim()) { setMsg(`${c.label} est requis`); setTimeout(() => setMsg(""), 2000); return; }
    }
    try {
      if (creating) { await entity.create(form); setMsg("Ajouté"); }
      else { await entity.update(editingId, form); setMsg("Mis à jour"); }
      setEditingId(null); setCreating(false); loadRows();
      setTimeout(() => setMsg(""), 2000);
    } catch (e) { setMsg(e.message || "Erreur"); setTimeout(() => setMsg(""), 3000); }
  }

  async function handleDelete(id) {
    if (!confirm("Supprimer cet élément ?")) return;
    try {
      await entity.remove(id);
      setMsg("Supprimé"); loadRows();
      if (editingId === id) { setEditingId(null); setCreating(false); }
      setTimeout(() => setMsg(""), 2000);
    } catch (e) { setMsg(e.message || "Erreur"); setTimeout(() => setMsg(""), 3000); }
  }

  const Icon = entity.icon;

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden", background: "#f8fafc" }}>

      {/* ─── Left sidebar: entity tabs ─── */}
      <div style={{ width: 220, flexShrink: 0, background: "#fff", borderRight: "1px solid #eef2f7", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ padding: "18px 16px 12px", borderBottom: "1px solid #eef2f7" }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={17} style={{ color: "#3b82f6" }} /> Référentiels
          </div>
          <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 4 }}>Gérez vos données de base</div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
          {REF_ENTITIES.map(ent => {
            const EIcon = ent.icon;
            const isActive = activeEntity === ent.key;
            return (
              <button key={ent.key} onClick={() => setActiveEntity(ent.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 12px",
                  border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left", marginBottom: 2,
                  background: isActive ? `${ent.color}10` : "transparent",
                  color: isActive ? ent.color : "#475569", fontWeight: isActive ? 600 : 500, fontSize: 13,
                  transition: "all .15s",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f1f5f9"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                <EIcon size={15} />
                {ent.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Main content ─── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header bar */}
        <div style={{
          padding: "14px 24px", borderBottom: "1px solid #eef2f7", background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: `${entity.color}15`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={17} style={{ color: entity.color }} />
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>{entity.label}</div>
              <div style={{ fontSize: 12, color: "#64748b" }}>{filtered.length} élément{filtered.length !== 1 ? "s" : ""}{search ? " (filtrés)" : ""}</div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {msg && (
              <span style={{ fontSize: 12, fontWeight: 600, color: msg.includes("Erreur") || msg.includes("requis") ? "#dc2626" : "#059669", background: msg.includes("Erreur") || msg.includes("requis") ? "#fef2f2" : "#f0fdf4", padding: "5px 12px", borderRadius: 6 }}>
                {msg}
              </span>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 11px", border: "1px solid #eef2f7", borderRadius: 8, background: "#fafbfc" }}>
              <Search size={14} style={{ color: "#94a3b8" }} />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                style={{ border: "none", background: "transparent", fontSize: 13, outline: "none", width: 160 }} />
              {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0 }}><X size={12} /></button>}
            </div>
            <button onClick={startCreate}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", border: "none", borderRadius: 8, background: entity.color, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              <Plus size={14} /> Ajouter
            </button>
          </div>
        </div>

        {/* Inline form (create/edit) */}
        {(creating || editingId) && (
          <div style={{ padding: "14px 24px", background: "#fffbeb", borderBottom: "1px solid #fde68a", display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap", flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#92400e", marginRight: 6 }}>
              {creating ? "Nouveau" : "Modifier"} :
            </div>
            {entity.columns.map(col => (
              <div key={col.key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <label style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b" }}>{col.label}{col.required ? " *" : ""}</label>
                <input
                  value={form[col.key] || ""}
                  onChange={e => setForm({ ...form, [col.key]: col.type === "number" ? e.target.value : e.target.value })}
                  type={col.type === "number" ? "number" : "text"}
                  style={{ padding: "6px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12.5, width: col.type === "number" ? 100 : 160, outline: "none" }}
                />
              </div>
            ))}
            <button onClick={saveEdit}
              style={{ padding: "7px 16px", border: "none", borderRadius: 7, background: "#059669", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <Save size={13} /> Enregistrer
            </button>
            <button onClick={() => { setEditingId(null); setCreating(false); }}
              style={{ padding: "7px 12px", border: "1px solid #e2e8f0", borderRadius: 7, background: "#fff", color: "#64748b", fontSize: 12, cursor: "pointer" }}>
              Annuler
            </button>
          </div>
        )}

        {/* Table */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
              <Loader2 size={28} style={{ animation: "spin 1s linear infinite", opacity: 0.4 }} />
              <div style={{ marginTop: 10, fontSize: 13 }}>Chargement…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8" }}>
              <Database size={36} style={{ opacity: 0.2, marginBottom: 10 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Aucun élément</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{search ? "Essayez une autre recherche" : "Cliquez sur Ajouter pour créer"}</div>
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "2px solid #eef2f7" }}>
                  {entity.columns.map(col => (
                    <th key={col.key} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 600, color: "#475569", fontSize: 11.5, textTransform: "uppercase", letterSpacing: ".3px" }}>
                      {col.label}
                    </th>
                  ))}
                  <th style={{ padding: "10px 14px", textAlign: "right", fontWeight: 600, color: "#475569", fontSize: 11.5, width: 100 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(row => (
                  <tr key={row.id}
                    style={{ borderBottom: "1px solid #f1f5f9", background: editingId === row.id ? "#fffbeb" : "#fff", transition: "background .1s" }}
                    onMouseEnter={e => { if (editingId !== row.id) e.currentTarget.style.background = "#fafbfc"; }}
                    onMouseLeave={e => { if (editingId !== row.id) e.currentTarget.style.background = editingId === row.id ? "#fffbeb" : "#fff"; }}>
                    {entity.columns.map(col => (
                      <td key={col.key} style={{ padding: "10px 14px", color: "#1e293b", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {col.type === "number" ? (Number(row[col.key]) || 0).toLocaleString("fr-DZ") : (row[col.key] || "—")}
                      </td>
                    ))}
                    <td style={{ padding: "8px 14px", textAlign: "right" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                        <button onClick={() => startEdit(row)} title="Modifier"
                          style={{ padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#3b82f6", display: "flex", alignItems: "center" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                          onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                          <Pencil size={13} />
                        </button>
                        <button onClick={() => handleDelete(row.id)} title="Supprimer"
                          style={{ padding: "5px 8px", border: "1px solid #fecaca", borderRadius: 6, background: "#fff", cursor: "pointer", color: "#dc2626", display: "flex", alignItems: "center" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                          onMouseLeave={e => e.currentTarget.style.background = "#fff"}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Configuration Page: tabbed (Modèles + Référentiels + Paramètres) ────
function ConfigurationPage({ specialityId, setSpecialityId, uploadMode, refreshUploadMode }) {
  const [configTab, setConfigTab] = useState("templates");
  const tabs = [
    { key: "templates", label: "Modèles de documents", icon: FileText, color: "#3b82f6" },
    { key: "referentiels", label: "Référentiels", icon: Database, color: "#7c3aed" },
    { key: "parametres", label: "Paramètres", icon: Settings, color: "#0f766e" },
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#f1f5f9" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, background: "#fff", borderBottom: "1px solid #eef2f7", flexShrink: 0, paddingLeft: 20 }}>
        {tabs.map(t => {
          const TIcon = t.icon;
          const active = configTab === t.key;
          return (
            <button key={t.key} onClick={() => setConfigTab(t.key)}
              style={{
                display: "flex", alignItems: "center", gap: 7, padding: "13px 20px",
                border: "none", background: "transparent", cursor: "pointer",
                fontSize: 14, fontWeight: active ? 650 : 500,
                color: active ? t.color : "#64748b",
                borderBottom: active ? `2.5px solid ${t.color}` : "2.5px solid transparent",
                marginBottom: -1, transition: "all .15s",
              }}>
              <TIcon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>
      {/* Content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {configTab === "templates" && <DocumentTemplatesPanel patient={null} />}
        {configTab === "referentiels" && <ReferentielsPanel />}
        {configTab === "parametres" && <ParametresConfigPanel specialityId={specialityId} uploadMode={uploadMode} refreshUploadMode={refreshUploadMode} />}
      </div>
    </div>
  );
}

function ParametresConfigPanel({ specialityId, uploadMode, refreshUploadMode }) {
  const [header, setHeader] = useState(() => { try { return JSON.parse(localStorage.getItem("ms_clinic_header") || "{}"); } catch { return {}; } });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.doctorProfile().then((profile) => {
      if (!profile) return;
      setHeader((current) => {
        const merged = {
          doctor_name: current.doctor_name || profile.name || "",
          specialty: current.specialty || profile.specialty || "",
          order_number: current.order_number || profile.order_number || "",
          clinic: current.clinic || profile.clinic_name || "",
          city: current.city || profile.clinic_city || "",
          phone: current.phone || profile.phone || "",
          email: current.email || profile.email || "",
          address: current.address || profile.address || "",
          address_note: current.address_note || profile.address_note || "",
          logo: current.logo || profile.logo_b64 || "",
        };
        localStorage.setItem("ms_clinic_header", JSON.stringify(merged));
        return merged;
      });
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        await Promise.all([
          api.updateSetting("DOCTOR_NAME", header.doctor_name || ""),
          api.updateSetting("DOCTOR_SPECIALTY", header.specialty || ""),
          api.updateSetting("DOCTOR_ORDER_NUMBER", header.order_number || ""),
          api.updateSetting("CLINIC_NAME", header.clinic || ""),
          api.updateSetting("CLINIC_CITY", header.city || ""),
          api.updateSetting("DOCTOR_PHONE", header.phone || ""),
          api.updateSetting("DOCTOR_EMAIL", header.email || ""),
          api.updateSetting("DOCTOR_ADDRESS", header.address || ""),
          api.updateSetting("DOCTOR_ADDRESS_NOTE", header.address_note || ""),
          api.updateSetting("DOCTOR_LOGO_B64", header.logo || ""),
        ]);
        setMsg("Configuration synchronisée avec les documents.");
      } catch {
        setMsg("Configuration enregistrée localement. Synchronisation serveur en attente.");
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [header]);

  function saveH(key, val) {
    const updated = { ...header, [key]: val };
    setHeader(updated);
    localStorage.setItem("ms_clinic_header", JSON.stringify(updated));
  }
  function handleLogo(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const r = new FileReader(); r.onload = ev => { saveH("logo", ev.target.result); }; r.readAsDataURL(file);
  }

  return (
    <div style={{ overflow: "auto", padding: "24px 32px", height: "100%" }}>
      <section style={{ marginBottom: 20 }}>
        <SettingsPanel uploadMode={uploadMode} onRefreshMode={refreshUploadMode} />
      </section>

      {/* Header / Footer Configuration */}
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
          <Edit3 size={16} style={{ color: "#2563eb" }} /> En-tête et pied de page (Header / Footer)
        </h3>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 14 }}>Ces informations apparaissent sur toutes les ordonnances, bilans, courriers et documents imprimés.</p>

        <div style={{ display: "flex", gap: 16, marginBottom: 16, alignItems: "center" }}>
          <div style={{ width: 80, height: 80, border: "2px dashed #cbd5e1", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", overflow: "hidden", flexShrink: 0 }}>
            {header.logo ? <img src={header.logo} alt="logo" style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} /> : <Heart size={28} style={{ color: "#cbd5e1" }} />}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 11.5, fontWeight: 600, color: "#1d4ed8", cursor: "pointer" }}>
              <Upload size={12} /> Choisir un logo
              <input type="file" accept="image/*" onChange={handleLogo} style={{ display: "none" }} />
            </label>
            {header.logo && <button onClick={() => saveH("logo", "")} style={{ padding: "5px 10px", background: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca", borderRadius: 5, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Retirer</button>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
          {[["doctor_name","Nom du médecin","Dr. Jean Dupont"],["specialty","Spécialité","Cardiologue"],["order_number","N° Ordre","22/620/13"],["clinic","Nom du cabinet","Cabinet..."],["phone","Téléphone","0555 12 34 56"],["email","Email","contact@cabinet.dz"],["city","Ville","Sidi Bel Abbès"],["address","Adresse complète","123 Rue..."]].map(([k, lbl, ph]) => (
            <div key={k} style={k === "address" ? { gridColumn: "1 / -1" } : {}}>
              <label style={{ fontSize: 11, color: "#64748b", display: "block", marginBottom: 3, fontWeight: 600 }}>{lbl}</label>
              <input value={header[k] || ""} onChange={e => saveH(k, e.target.value)} placeholder={ph}
                style={{ width: "100%", padding: "8px 11px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12.5, boxSizing: "border-box", fontFamily: "inherit", outline: "none" }}
                onFocus={e => { e.target.style.borderColor = "#2563eb"; }}
                onBlur={e => { e.target.style.borderColor = "#e2e8f0"; }} />
            </div>
          ))}
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 12, color: "#059669", fontWeight: 600 }}>{msg}</div>}
      </section>

      {/* Footer info */}
      <section style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 12, padding: "20px 24px", marginBottom: 20 }}>
        <h3 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Pied de page (Footer)</h3>
        <p style={{ fontSize: 12, color: "#64748b", marginBottom: 10 }}>Le footer est généré automatiquement à partir des champs ci-dessus : Téléphone, Email, Adresse, Ville.</p>
        <div style={{ padding: "12px 16px", background: "#f8fafc", border: "1px solid #eef2f7", borderRadius: 8, fontSize: 12, color: "#475569", lineHeight: 1.6 }}>
          {[header.phone && `☎ ${header.phone}`, header.email && `✉ ${header.email}`, (header.address || header.city) && `📍 ${[header.address, header.city].filter(Boolean).join(", ")}`].filter(Boolean).join("  |  ") || "Remplissez les champs ci-dessus pour générer le footer."}
        </div>
      </section>

      {/* Speciality (read-only) */}
      <SpecialitySettingsSection currentId={specialityId} />
    </div>
  );
}

function SpecialitySettingsSection({ currentId, onChange }) {
  // Speciality is locked after initial setup. Doctors choose during the
  // first-launch wizard; changing it later would corrupt speciality-specific
  // data. Display read-only info instead.
  const current = SPECIALITY_LIST.find(s => s.id === currentId) || SPECIALITY_LIST[0];

  return (
    <section className="settings-section">
      <h3>Spécialité médicale</h3>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12 }}>
        Votre spécialité a été définie lors de la configuration initiale.
        <strong> Elle ne peut pas être modifiée</strong> afin de garantir l'intégrité des dossiers et des modèles.
      </p>
      <div className="sw-spec-locked" style={{
        display: "flex", alignItems: "center", gap: 14, padding: "16px 18px",
        borderRadius: 10, background: `${current.color}12`, border: `1px solid ${current.color}55`,
      }}>
        <span style={{ fontSize: 30 }}>{current.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--text-primary, #0f172a)" }}>{current.label}</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Configuration verrouillée</div>
        </div>
        <span style={{
          fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 999,
          background: current.color, color: "#fff",
        }}>VERROUILLÉE</span>
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
    const ok = window.confirm("Attention: ces paramètres peuvent désactiver certaines fonctions.");
    if (ok) setAdvancedOpen(true);
  }

  return (
    <div className="settings-safe-stack settings-safe-stack--modern">
      <section className="tool-card settings-card settings-card--identity">
        <header className="settings-card__header">
          <div>
            <span className="patient-card__eyebrow">Paramètres simples</span>
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
            <span>Vérification</span>
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
            <div className="settings-privacy-note">Attention: ces paramètres peuvent désactiver certaines fonctions.</div>
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

// =====================================================================
// BILAN PANEL — Word-like editor with real-time exam adding
// =====================================================================
function BilanPanel({ patient }) {
  const [catalog, setCatalog] = useState([]);
  const [categories, setCategories] = useState([]);
  const [bilans, setBilans] = useState([]);
  const [selectedCat, setSelectedCat] = useState("Biologie");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [expanded, setExpanded] = useState(null);
  const [tab, setTab] = useState("editor");
  const [docHeader, setDocHeader] = useState(() => {
    // Read template editor's saved header (logo, doctor info) from localStorage
    try { return JSON.parse(localStorage.getItem("ms_clinic_header") || "{}"); } catch { return {}; }
  });
  const [newExamName, setNewExamName] = useState("");
  const [newExamCat, setNewExamCat] = useState("Autre");
  const [addExamMsg, setAddExamMsg] = useState("");
  const editorRef = useRef(null);
  const catalogMap = useRef({});

  useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = "<p><strong>Demande d'examens complémentaires</strong></p><br/>";
    }
  }, []);

  useEffect(() => {
    if (!patient?.id) return;
    api.bilanCatalog().then(d => {
      const rows = d.rows || [];
      setCatalog(rows);
      setCategories(d.categories || []);
      const m = {}; rows.forEach(r => { m[r.id] = r; }); catalogMap.current = m;
    }).catch(() => {});
    api.patientBilans(patient.id).then(d => setBilans(d.rows || [])).catch(() => {});
    api.doctorProfile().then(prof => {
      if (!prof) return;
      // Merge with existing localStorage header: prefer localStorage (user edits) over backend
      setDocHeader(prev => {
        const merged = {
          doctor_name: prev.doctor_name || prof.name || "",
          specialty: prev.specialty || prof.specialty || "",
          phone: prev.phone || prof.phone || "",
          address: prev.address || prof.address || "",
          email: prev.email || prof.email || "",
          order_number: prev.order_number || prof.order_number || "",
          clinic: prev.clinic || prof.clinic_name || "",
          city: prev.city || prof.clinic_city || "",
          logo: prev.logo || prof.logo_b64 || "",
        };
        localStorage.setItem("ms_clinic_header", JSON.stringify(merged));
        return merged;
      });
    }).catch(() => {});
  }, [patient?.id]);

  // Live sync: when header is edited elsewhere (template editor), reflect it here
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === "ms_clinic_header" && e.newValue) {
        try { setDocHeader(JSON.parse(e.newValue)); } catch {}
      }
    };
    window.addEventListener("storage", onStorage);
    // Also poll on focus (same-tab changes don't fire storage event)
    const onFocus = () => {
      try {
        const v = JSON.parse(localStorage.getItem("ms_clinic_header") || "{}");
        setDocHeader(prev => JSON.stringify(prev) === JSON.stringify(v) ? prev : v);
      } catch {}
    };
    window.addEventListener("focus", onFocus);
    return () => { window.removeEventListener("storage", onStorage); window.removeEventListener("focus", onFocus); };
  }, []);

  const filtered = catalog.filter(c =>
    (!selectedCat || c.category === selectedCat) &&
    (!q || c.name.toLowerCase().includes(q.toLowerCase()))
  );

  const catColors = { Biologie: "#1d4ed8", Radiologie: "#7c3aed", Autre: "#059669" };

  function toggleExam(item) {
    // PURE state update (no side effects — React StrictMode runs updaters twice)
    const wasSelected = selected.has(item.id);
    const next = new Set(selected);
    if (wasSelected) next.delete(item.id); else next.add(item.id);
    setSelected(next);
    // DOM side-effects done exactly once here, guarded by existence check
    if (!editorRef.current) return;
    if (wasSelected) {
      editorRef.current.querySelector(`[data-exam-id="${item.id}"]`)?.remove();
    } else {
      // Guard: if node already exists (rare race), do NOT add again
      if (editorRef.current.querySelector(`[data-exam-id="${item.id}"]`)) return;
      const p = document.createElement("p");
      p.setAttribute("data-exam-id", String(item.id));
      p.style.cssText = "margin:3px 0;font-size:11.5pt;";
      const col = catColors[item.category] || "#374151";
      p.innerHTML = `<span style="color:${col};">&#9744;</span> <strong>${item.name}</strong>${item.category ? ` <span style="font-size:9pt;color:#9ca3af;">(${item.category})</span>` : ""}`;
      editorRef.current.appendChild(p);
      editorRef.current.scrollTop = editorRef.current.scrollHeight;
    }
  }

  async function handleAddExam() {
    if (!newExamName.trim()) return;
    try {
      const r = await api.addBilanCatalog({ name: newExamName.trim(), category: newExamCat });
      if (r.created) {
        const newItem = { id: r.id, name: r.name, category: r.category };
        setCatalog(prev => [...prev, newItem]);
        if (!categories.includes(r.category)) setCategories(prev => [...prev, r.category]);
        catalogMap.current[r.id] = newItem;
        setAddExamMsg(`✓ "${r.name}" ajouté`);
      } else {
        setAddExamMsg("Déjà en catalogue.");
      }
      setNewExamName(""); setTimeout(() => setAddExamMsg(""), 3000);
    } catch (e) { setAddExamMsg("Erreur: " + e.message); }
  }

  async function submit() {
    if (selected.size === 0) { setMsg("Choisissez au moins un examen."); return; }
    setSaving(true); setMsg("");
    try {
      const items = [...selected].map(id => ({ catalog_id: id, catalog_name: catalogMap.current[id]?.name || "", category: catalogMap.current[id]?.category || "Autre" }));
      await api.createBilan(patient.id, { items, doctor_note: note });
      const d = await api.patientBilans(patient.id);
      setBilans(d.rows || []);
      setSelected(new Set());
      setNote("");
      if (editorRef.current) editorRef.current.innerHTML = "<p><strong>Demande d'examens complémentaires</strong></p><br/>";
      setMsg("Bilan créé ✓");
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg("Erreur: " + e.message); }
    setSaving(false);
  }

  async function handleDelete(bilanId) {
    if (!window.confirm("Supprimer ce bilan ?")) return;
    await api.deleteBilan(bilanId);
    setBilans(prev => prev.filter(b => b.id !== bilanId));
  }

  function printBilanId(bilanId) {
    window.open(`http://127.0.0.1:8000/api/bilans/${bilanId}/preview`, "_blank", "noopener,noreferrer");
  }

  function printCurrentEditor() {
    const content = editorRef.current?.innerHTML || "";
    if (!content.replace(/<[^>]*>/g, "").trim()) return;
    const fmtDate = new Date().toLocaleDateString("fr-DZ");
    const p = patient || {};
    const logoHtml = docHeader.logo ? `<img src="${docHeader.logo}" style="max-height:70px;max-width:80px;object-fit:contain;" alt="logo"/>` : "";
    const docAddr = [docHeader.address || "", docHeader.city || ""].filter(Boolean).join(", ");
    const footerParts = [docHeader.phone ? `&#9990; ${docHeader.phone}` : "", docHeader.email ? `&#9993; ${docHeader.email}` : "", docAddr ? `&#9492; ${docAddr}` : ""].filter(Boolean).join(" &nbsp;|&nbsp; ");
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><style>
@page{size:A5;margin:8mm 10mm}*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Times New Roman',serif;font-size:10.5pt;color:#111}
.hdr-tbl{width:100%;border-collapse:collapse;border-bottom:2px solid #000;padding-bottom:5px;margin-bottom:3px}
.hdr-tbl td{vertical-align:top;padding:0 3px}
.hdr-left{width:38%}.hdr-center{width:24%;text-align:center;vertical-align:middle}.hdr-right{width:38%;text-align:right}
.doc-name{font-size:11.5pt;font-weight:bold}.doc-spec{font-size:9pt;font-weight:bold}.doc-ordre{font-size:8pt;margin-top:2px}
.rl{font-size:9pt;margin:1px 0}.sep{border:none;border-top:2px solid #000;margin:5px 0 8px}
.body{line-height:1.5;font-size:10.5pt}.body p{margin:0 0 3pt}.body ul,.body ol{padding-left:18px;margin:3pt 0}
.ftr{border-top:1px solid #000;padding-top:5px;font-size:8pt;text-align:center;margin-top:8pt}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
<table class="hdr-tbl"><tr>
  <td class="hdr-left"><div class="doc-name">${docHeader.doctor_name || "Dr."}</div><div class="doc-spec">${docHeader.specialty || ""}</div>${docHeader.order_number ? `<div class="doc-ordre">N&deg; d'ordre : ${docHeader.order_number}</div>` : ""}</td>
  <td class="hdr-center">${logoHtml}</td>
  <td class="hdr-right">
    <div class="rl">Date : <strong>${fmtDate}</strong></div>
    ${p.nom ? `<div class="rl">Nom : <strong>${(p.nom || "").toUpperCase()}</strong></div>` : ""}
    ${p.prenom ? `<div class="rl">Pr&eacute;nom : <strong>${p.prenom}</strong></div>` : ""}
    ${p.age != null ? `<div class="rl">Age : <strong>${p.age} ans</strong></div>` : ""}
  </td>
</tr></table>
<hr class="sep"/>
<div class="body">${content}</div>
<div class="ftr">${footerParts}</div>
</body></html>`;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(html); win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  }

  function exec(cmd, val = null) { editorRef.current?.focus(); document.execCommand(cmd, false, val); }

  return (
    <div className="bilan-word-layout">
      {/* LEFT — catalog sidebar */}
      <aside className="bilan-sidebar">
        <div className="bilan-sidebar__title"><FlaskConical size={15} /> Examens {selected.size > 0 && <span className="bilan-count-badge">{selected.size}</span>}</div>
        <div className="bilan-cats">
          {categories.map(cat => (
            <button key={cat} className={`bilan-cat-btn${selectedCat === cat ? " is-active" : ""}`}
              style={selectedCat === cat ? { background: catColors[cat] || "#64748b", borderColor: catColors[cat] || "#64748b" } : {}}
              onClick={() => setSelectedCat(cat)}>{cat}</button>
          ))}
          <button className={`bilan-cat-btn${!selectedCat ? " is-active" : ""}`}
            style={!selectedCat ? { background: "#64748b", borderColor: "#64748b" } : {}}
            onClick={() => setSelectedCat("")}>Tous</button>
        </div>
        <div className="bilan-search">
          <Search size={13} style={{ color: "#94a3b8", flexShrink: 0 }} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un examen…" />
        </div>
        <div className="bilan-exam-list">
          {filtered.map(item => (
            <label key={item.id} className={`bilan-exam-item${selected.has(item.id) ? " is-checked" : ""}`}
              style={selected.has(item.id) ? { borderColor: (catColors[item.category] || "#3b82f6") + "80", background: (catColors[item.category] || "#3b82f6") + "0d" } : {}}>
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleExam(item)} style={{ accentColor: catColors[item.category] || "#3b82f6", flexShrink: 0 }} />
              <span>{item.name}</span>
            </label>
          ))}
          {filtered.length === 0 && <p className="bilan-empty">Aucun examen trouvé.</p>}
        </div>
        {/* ── Add new exam to catalog ── */}
        <div style={{ borderTop: "1px solid #e2e8f0", marginTop: 6, paddingTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", marginBottom: 5, display: "flex", alignItems: "center", gap: 5 }}>
            <PlusCircle size={12} /> Nouvel examen
          </div>
          <input value={newExamName} onChange={e => setNewExamName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAddExam()}
            placeholder="Nom de l'examen…"
            style={{ width: "100%", padding: "5px 7px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, marginBottom: 4, boxSizing: "border-box" }} />
          <div style={{ display: "flex", gap: 5 }}>
            <select value={newExamCat} onChange={e => setNewExamCat(e.target.value)}
              style={{ flex: 1, padding: "4px 6px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 11 }}>
              {[...new Set([...categories, "Biologie","Imagerie","Cardiologie","Autre"])].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={handleAddExam} disabled={!newExamName.trim()}
              style={{ padding: "4px 10px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+</button>
          </div>
          {addExamMsg && <div style={{ fontSize: 11, color: addExamMsg.startsWith("✓") ? "#059669" : "#ef4444", marginTop: 3 }}>{addExamMsg}</div>}
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={2} placeholder="Note pour le labo…" className="bilan-note-input" />
        <button onClick={submit} disabled={saving || selected.size === 0} className="bilan-submit-btn">
          {saving ? "Enregistrement…" : `Enregistrer (${selected.size} examen${selected.size > 1 ? "s" : ""})`}
        </button>
        {msg && <div className={`bilan-msg${msg.startsWith("Erreur") ? " is-error" : ""}`}>{msg}</div>}
      </aside>

      {/* MAIN — Word editor */}
      <div className="bilan-editor-main">
        <div className="bilan-tabs">
          <button className={`bilan-tab-btn${tab === "editor" ? " is-active" : ""}`} onClick={() => setTab("editor")}><Edit3 size={13} /> Rédiger</button>
          <button className={`bilan-tab-btn${tab === "history" ? " is-active" : ""}`} onClick={() => setTab("history")}><ClipboardList size={13} /> Historique ({bilans.length})</button>
        </div>

        {tab === "editor" ? (
          <>
            <div className="bilan-toolbar">
              <div className="bilan-toolbar__grp">
                <button title="Gras" onMouseDown={e => { e.preventDefault(); exec("bold"); }}><Bold size={13} /></button>
                <button title="Italique" onMouseDown={e => { e.preventDefault(); exec("italic"); }}><Italic size={13} /></button>
                <button title="Souligné" onMouseDown={e => { e.preventDefault(); exec("underline"); }}><Underline size={13} /></button>
              </div>
              <div className="bilan-toolbar__div" />
              <div className="bilan-toolbar__grp">
                <button title="Gauche" onMouseDown={e => { e.preventDefault(); exec("justifyLeft"); }}><AlignLeft size={13} /></button>
                <button title="Centrer" onMouseDown={e => { e.preventDefault(); exec("justifyCenter"); }}><AlignCenter size={13} /></button>
                <button title="Droite" onMouseDown={e => { e.preventDefault(); exec("justifyRight"); }}><AlignRight size={13} /></button>
              </div>
              <div className="bilan-toolbar__div" />
              <div className="bilan-toolbar__grp">
                <button title="Liste" onMouseDown={e => { e.preventDefault(); exec("insertUnorderedList"); }}><List size={13} /></button>
                <button title="Effacer tout" onMouseDown={e => { e.preventDefault(); if (window.confirm("Effacer tout le contenu ?")) { editorRef.current.innerHTML = "<p><strong>Demande d'examens complémentaires</strong></p><br/>"; setSelected(new Set()); }}} style={{ color: "#ef4444" }}><Trash2 size={13} /></button>
              </div>
              <div style={{ flex: 1 }} />
              <button className="bilan-print-btn" onClick={printCurrentEditor} disabled={selected.size === 0}><Printer size={13} /> Imprimer</button>
            </div>

            <div className="bilan-a4-wrap">
             <div className="bilan-a5-page">
              {/* Live A5 header preview */}
              <div className="bilan-a4-hdr">
                <div className="bilan-a4-hdr__left">
                  <div className="bilan-a4-name">{docHeader.doctor_name || "Dr. Médecin"}</div>
                  <div className="bilan-a4-spec">{docHeader.specialty || ""}</div>
                  {docHeader.order_number && <div className="bilan-a4-ordre">N° d'ordre : {docHeader.order_number}</div>}
                </div>
                <div className="bilan-a4-hdr__center">
                  {docHeader.logo ? <img src={docHeader.logo} alt="logo" style={{ maxHeight: 55, maxWidth: 65, objectFit: "contain" }} /> : <Heart size={36} style={{ color: "#ef4444", opacity: 0.6 }} />}
                </div>
                <div className="bilan-a4-hdr__right">
                  <div>Date : <strong>{new Date().toLocaleDateString("fr-DZ")}</strong></div>
                  {patient?.nom && <div>Nom : <strong>{(patient.nom || "").toUpperCase()}</strong></div>}
                  {patient?.prenom && <div>Prénom : <strong>{patient.prenom}</strong></div>}
                  {patient?.age != null && <div>Age : <strong>{patient.age} ans</strong></div>}
                </div>
              </div>
              <div className="bilan-a4-sep" />
              <div ref={editorRef} className="bilan-a4-body" contentEditable suppressContentEditableWarning spellCheck={false} />
             </div>
            </div>
          </>
        ) : (
          <div className="bilan-history">
            {bilans.length === 0 && <p style={{ color: "#94a3b8", fontSize: 13, textAlign: "center", padding: 24 }}>Aucun bilan enregistré.</p>}
            {bilans.map(b => (
              <div key={b.id} className="bilan-history-item">
                <div className="bilan-history-item__hdr" onClick={() => setExpanded(expanded === b.id ? null : b.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{new Date(b.requested_date).toLocaleDateString("fr-FR")}</span>
                    <span style={{ fontSize: 11, color: "#64748b" }}>{(b.items || []).length} examen(s)</span>
                    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 12, fontWeight: 600, background: b.status === "done" ? "#d1fae5" : "#eff6ff", color: b.status === "done" ? "#059669" : "#2563eb" }}>
                      {b.status === "done" ? "Terminé" : "Demandé"}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={e => { e.stopPropagation(); printBilanId(b.id); }} title="Imprimer" style={{ border: "none", background: "none", cursor: "pointer", color: "#3b82f6" }}><Printer size={15} /></button>
                    <button onClick={e => { e.stopPropagation(); handleDelete(b.id); }} title="Supprimer" style={{ border: "none", background: "none", cursor: "pointer", color: "#ef4444" }}><Trash2 size={15} /></button>
                  </div>
                </div>
                {expanded === b.id && (
                  <div style={{ padding: "8px 12px 10px" }}>
                    {b.doctor_note && <p style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>Note: {b.doctor_note}</p>}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {(b.items || []).map(it => (
                        <span key={it.id} style={{ fontSize: 12, padding: "2px 10px", borderRadius: 12, background: (catColors[it.category] || "#64748b") + "18", border: `1px solid ${(catColors[it.category] || "#64748b") + "40"}`, color: catColors[it.category] || "#475569" }}>
                          {it.catalog_name || it.custom_name}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


function PlusMenu({ activeTab, setActiveTab, groups, labelOf }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const isInPlus = groups.some(g => g.items.includes(activeTab));
  return (
    <div style={{ position: "relative", marginLeft: "auto" }} ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        style={{
          padding: "14px 16px", border: "none", background: "transparent",
          fontSize: 14, fontWeight: isInPlus ? 600 : 500,
          color: isInPlus ? "#0f172a" : "#64748b",
          borderBottom: isInPlus ? "2px solid #3b82f6" : "2px solid transparent",
          marginBottom: -1, cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>
        Plus <span style={{ fontSize: 10, opacity: .7 }}>▾</span>
      </button>
      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 4px)",
          background: "#fff", border: "1px solid #eef2f7",
          borderRadius: 12, boxShadow: "0 8px 28px rgba(15,23,42,.08)",
          minWidth: 240, padding: 6, zIndex: 50,
        }}>
          {groups.map((g, gi) => (
            <div key={g.title} style={gi > 0 ? { marginTop: 6, paddingTop: 6, borderTop: "1px solid #f1f5f9" } : {}}>
              <div style={{ padding: "4px 10px", fontSize: 10.5, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: ".5px" }}>
                {g.title}
              </div>
              {g.items.map(id => {
                const isActive = activeTab === id;
                return (
                  <button key={id} onClick={() => { setActiveTab(id); setOpen(false); }}
                    style={{
                      display: "block", width: "100%", textAlign: "left",
                      padding: "8px 12px", border: "none", borderRadius: 6,
                      background: isActive ? "#eff6ff" : "transparent",
                      color: isActive ? "#1d4ed8" : "#0f172a",
                      fontSize: 13, fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}>
                    {labelOf(id)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// ReglementPanel — patient payments / caisse view. Fetches real visits with
// fee/paid/mode_paiement from /api/patients/{id}/payments.
// ───────────────────────────────────────────────────────────────────────────
function CaisseHistoryPanel({ patient }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!patient?.id) return;
    setLoading(true); setError("");
    api.patientPayments(patient.id)
      .then((d) => setData(d))
      .catch((e) => setError(`Impossible de charger les reglements: ${e.message}`))
      .finally(() => setLoading(false));
  }, [patient?.id]);

  if (!patient?.id) return (
    <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontStyle: "italic", background: "#fff", borderRadius: 12, border: "1px solid #eef2f7" }}>
      Aucun patient selectionne.
    </div>
  );
  if (loading) return <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}><Loader2 size={22} className="imp-spin" /></div>;
  if (error) return <div style={{ padding: "14px 18px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 10 }}>{error}</div>;

  const rows = data?.rows || [];
  const totalFee = data?.total_fee || 0;
  const totalPaid = data?.total_paid || 0;
  const totalUnpaid = data?.total_unpaid || 0;

  const fmt = (n) => `${(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;
  const statusBadge = (s) => {
    const map = {
      paid:    { label: "Paye",   color: "#065f46", bg: "#ecfdf5" },
      partial: { label: "Partiel", color: "#92400e", bg: "#fffbeb" },
      pending: { label: "Impaye", color: "#991b1b", bg: "#fef2f2" },
    }[s] || { label: s || "-", color: "#475569", bg: "#f1f5f9" };
    return <span style={{ fontSize: 10.5, fontWeight: 700, padding: "2px 8px", borderRadius: 20, color: map.color, background: map.bg }}>{map.label}</span>;
  };

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#0f172a" }}>Caisse — Historique des paiements</h2>
        <div style={{ marginTop: 3, fontSize: 13, color: "#64748b" }}>
          {patient.nom} {patient.prenom} · {rows.length} consultation{rows.length > 1 ? "s" : ""}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
        <TotalCard label="Total honoraires" value={fmt(totalFee)} tone="blue" />
        <TotalCard label="Total paye" value={fmt(totalPaid)} tone="green" />
        <TotalCard label="Reste a payer" value={fmt(totalUnpaid)} tone={totalUnpaid > 0 ? "red" : "green"} />
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: "40px 20px", textAlign: "center" }}>
          <CreditCard size={32} color="#cbd5e1" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#475569" }}>Aucun reglement enregistre</div>
        </div>
      ) : (
        <div style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px 100px 100px 100px 110px 100px", padding: "10px 16px", borderBottom: "1px solid #eef2f7", background: "#f8fafc", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".4px" }}>
            <div>Date</div>
            <div>Motif / Acte</div>
            <div>Type</div>
            <div style={{ textAlign: "right" }}>Honoraires</div>
            <div style={{ textAlign: "right" }}>Paye</div>
            <div style={{ textAlign: "right" }}>Reste</div>
            <div>Mode</div>
            <div style={{ textAlign: "center" }}>Statut</div>
          </div>
          {rows.map((r) => {
            const fee = r.montant || r.visit_fee || 0;
            const paid = r.paye || r.fee_paid || 0;
            const remaining = Math.max(fee - paid, 0);
            return (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px 100px 100px 100px 110px 100px", padding: "11px 16px", borderBottom: "1px solid #f8fafc", fontSize: 13, alignItems: "center" }}>
                <div style={{ color: "#475569" }}>{(r.date_visite || "").slice(0, 10)}</div>
                <div style={{ color: "#0f172a", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.motif || r.acte || "Consultation"}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>{r.type_acte || r.visit_type || "-"}</div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>{fmt(fee)}</div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: "#059669" }}>{fmt(paid)}</div>
                <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: remaining > 0 ? "#dc2626" : "#94a3b8", fontWeight: remaining > 0 ? 600 : 400 }}>{fmt(remaining)}</div>
                <div style={{ color: "#475569", fontSize: 12 }}>{r.mode_paiement || "-"}</div>
                <div style={{ textAlign: "center" }}>{statusBadge(r.statut || r.payment_status)}</div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11.5, color: "#64748b", display: "flex", alignItems: "center", gap: 6 }}>
        <Info size={12} /> Historique complet de tous les paiements du patient.
      </div>
    </div>
  );
}

function ReglementPanelV2({ patient }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visitTypes, setVisitTypes] = useState([]);
  const [editForm, setEditForm] = useState({ visit_type: "", visit_fee: "", fee_paid: "", mode_paiement: "" });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  function loadData() {
    if (!patient?.id) return;
    setLoading(true);
    setError("");
    api.patientPayments(patient.id)
      .then((d) => {
        setData(d);
        const cv = d?.current_visit;
        if (cv) setEditForm({
          visit_type: cv.type_consultation || cv.visit_type || "",
          visit_fee: String(cv.montant || cv.visit_fee || "0"),
          fee_paid: String(cv.paye || cv.fee_paid || "0"),
          mode_paiement: cv.mode_paiement || "",
        });
      })
      .catch((e) => setError(`Impossible de charger: ${e.message}`))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData(); }, [patient?.id]);
  useEffect(() => { api.visitTypes().then(d => setVisitTypes(d.rows || [])).catch(() => {}); }, []);

  if (!patient?.id) {
    return (
      <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontStyle: "italic", background: "#fff", borderRadius: 12, border: "1px solid #eef2f7" }}>
        Aucun patient selectionne.
      </div>
    );
  }
  if (loading) return <div style={{ padding: 30, textAlign: "center", color: "#94a3b8" }}><Loader2 size={22} className="imp-spin" /></div>;
  if (error) return <div style={{ padding: "14px 18px", background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 10 }}>{error}</div>;

  const currentVisit = data?.current_visit || null;
  const fmt = (n) => `${(n || 0).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DA`;
  const statusBadge = (s) => {
    const map = {
      paid: { label: "Paye", color: "#065f46", bg: "#ecfdf5" },
      partial: { label: "Partiel", color: "#92400e", bg: "#fffbeb" },
      pending: { label: "Impaye", color: "#991b1b", bg: "#fef2f2" },
    }[s] || { label: s || "-", color: "#475569", bg: "#f1f5f9" };
    return <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20, color: map.color, background: map.bg }}>{map.label}</span>;
  };

  const feeParsed = parseFloat(editForm.visit_fee) || 0;
  const paidParsed = parseFloat(editForm.fee_paid) || 0;
  const reste = Math.max(feeParsed - paidParsed, 0);

  async function savePayment() {
    if (!currentVisit?.id) return;
    setSaving(true);
    setMsg("");
    try {
      await api.updateVisitPayment(currentVisit.id, {
        visit_fee: feeParsed,
        fee_paid: paidParsed,
        mode_paiement: editForm.mode_paiement,
        visit_type: editForm.visit_type,
      });
      setMsg("Enregistre");
      loadData();
      setTimeout(() => setMsg(""), 3000);
    } catch (e) { setMsg(`Erreur: ${e.message}`); }
    setSaving(false);
  }

  function onVisitTypeChange(val) {
    setEditForm(f => {
      const vt = visitTypes.find(t => t.name === val);
      return { ...f, visit_type: val, visit_fee: vt?.price != null ? String(vt.price) : f.visit_fee };
    });
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      {!currentVisit ? (
        <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 10, padding: "30px 20px", textAlign: "center" }}>
          <CreditCard size={28} color="#cbd5e1" style={{ marginBottom: 6 }} />
          <div style={{ fontSize: 13, fontWeight: 600, color: "#475569" }}>Aucune visite trouvee</div>
        </div>
      ) : (
        <section style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 10, padding: "16px 20px" }}>
          {/* All fields in a single row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Type de visite</label>
              <select value={editForm.visit_type} onChange={(e) => onVisitTypeChange(e.target.value)}
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, background: "#fafbfc", outline: "none" }}>
                <option value="">—</option>
                {visitTypes.map(vt => <option key={vt.id} value={vt.name}>{vt.name} {vt.price ? `(${vt.price})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Tarif (DA)</label>
              <input type="number" value={editForm.visit_fee} onChange={(e) => setEditForm(f => ({ ...f, visit_fee: e.target.value }))}
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, background: "#fafbfc", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Paye (DA)</label>
              <input type="number" value={editForm.fee_paid} onChange={(e) => setEditForm(f => ({ ...f, fee_paid: e.target.value }))}
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, background: "#fafbfc", outline: "none" }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Reste</label>
              <div style={{ padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, background: "#f8fafc", fontWeight: 700, color: reste > 0 ? "#dc2626" : "#059669" }}>
                {fmt(reste)}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: 4 }}>Mode paiement</label>
              <select value={editForm.mode_paiement} onChange={(e) => setEditForm(f => ({ ...f, mode_paiement: e.target.value }))}
                style={{ width: "100%", padding: "7px 10px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 12, background: "#fafbfc", outline: "none" }}>
                <option value="">—</option>
                {["Especes", "Cheque", "Virement", "Carte", "Gratuit"].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>
          {/* Actions in a single row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={savePayment} disabled={saving}
              style={{ padding: "7px 16px", border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700, background: saving ? "#94a3b8" : "#2563eb", color: "#fff", cursor: saving ? "wait" : "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <Save size={12} /> {saving ? "..." : "Enregistrer"}
            </button>
            <button onClick={() => setEditForm(f => ({ ...f, fee_paid: f.visit_fee }))}
              style={{ padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 7, fontSize: 12, fontWeight: 600, background: "#fff", color: "#059669", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
              <CheckCircle size={12} /> Marquer paye
            </button>
            {statusBadge(currentVisit.statut)}
            {msg && <span style={{ fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 5, color: msg.startsWith("Erreur") ? "#dc2626" : "#059669", background: msg.startsWith("Erreur") ? "#fef2f2" : "#f0fdf4" }}>{msg}</span>}
          </div>
        </section>
      )}
    </div>
  );
}

function TotalCard({ label, value, tone }) {
  const tones = {
    blue:  { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    green: { bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
    red:   { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  }[tone] || { bg: "#f8fafc", color: "#0f172a", border: "#eef2f7" };
  return (
    <div style={{ background: tones.bg, border: `1px solid ${tones.border}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: tones.color, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>{value}</div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// OrdonnancePreviewPanel — READ-ONLY view of all prescriptions for a patient.
// Editing happens in Configuration → Modèles de documents.
// ───────────────────────────────────────────────────────────────────────────
function OrdonnancePreviewPanel({ patient, detail, onNav }) {
  const [openId, setOpenId] = useState(null);
  const [itemsCache, setItemsCache] = useState({});
  const [loadingItems, setLoadingItems] = useState(false);

  if (!patient?.id) {
    return (
      <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontStyle: "italic", background: "#fff", borderRadius: 12, border: "1px solid #eef2f7" }}>
        Aucun patient sélectionné.
      </div>
    );
  }

  const prescriptions = detail?.prescriptions || [];

  async function toggleOpen(id) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!itemsCache[id]) {
      setLoadingItems(true);
      try {
        const res = await fetch(`${apiBase}/api/prescriptions/${id}/items`);
        if (res.ok) {
          const data = await res.json();
          setItemsCache((cur) => ({ ...cur, [id]: data.items || [] }));
        }
      } catch { /* fall back to raw lines */ }
      setLoadingItems(false);
    }
  }

  function handlePrint(rxId) {
    const rx = prescriptions.find((p) => p.id === rxId);
    if (!rx) return;
    const items = itemsCache[rxId] || [];
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) return;
    const dateStr = (rx.created_at || "").slice(0, 10);
    const itemsHtml = items.length
      ? `<ol>${items.map((it) => `<li><strong>${it.medicine_name || ""}</strong>${it.dosage ? " " + it.dosage : ""}${it.frequency ? " — " + it.frequency : ""}${it.duration ? " (" + it.duration + ")" : ""}${it.instructions ? "<br/><em>" + it.instructions + "</em>" : ""}</li>`).join("")}</ol>`
      : `<pre style="white-space:pre-wrap;font-family:inherit">${(rx.lines || "").replace(/[<>]/g, "")}</pre>`;
    win.document.write(`<!doctype html><html><head><title>Ordonnance ${dateStr}</title><style>body{font-family:Arial,sans-serif;padding:32px;color:#0f172a;max-width:680px;margin:auto}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;color:#64748b;font-weight:500;margin:0 0 18px}ol{padding-left:20px;line-height:1.7}li{margin-bottom:10px}.footer{margin-top:40px;padding-top:14px;border-top:1px solid #e5e7eb;font-size:12px;color:#64748b;display:flex;justify-content:space-between}</style></head><body><h1>Ordonnance médicale</h1><h2>${patient.nom || ""} ${patient.prenom || ""} · ${patient.age || "?"} ans · ${dateStr}</h2>${itemsHtml}<div class="footer"><span>Signature</span><span>${dateStr}</span></div><script>window.print();</script></body></html>`);
    win.document.close();
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em" }}>
            Ordonnances · Aperçu
          </h2>
          <div style={{ marginTop: 3, fontSize: 13, color: "#64748b" }}>
            Historique des prescriptions · {patient.nom} {patient.prenom} · {prescriptions.length} ordonnance{prescriptions.length > 1 ? "s" : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ fontSize: 11.5, color: "#0c4a6e", background: "#e0f2fe", padding: "6px 11px", borderRadius: 6, display: "inline-flex", alignItems: "center", gap: 6, border: "1px solid #bae6fd" }}>
            <Eye size={12} /> Aperçu lecture seule
          </div>
          <div style={{ fontSize: 11, color: "#64748b" }} title="Modifier les modèles dans Configuration">
            Édition → <strong>Quitter dossier</strong> → <strong>Configuration</strong>
          </div>
        </div>
      </div>

      {prescriptions.length === 0 ? (
        <div style={{ padding: "40px 20px", textAlign: "center", background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12 }}>
          <Pill size={32} color="#cbd5e1" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Aucune ordonnance enregistrée</div>
          <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Les ordonnances créées pendant les visites apparaîtront ici.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {prescriptions.map((rx) => {
            const isOpen = openId === rx.id;
            const date = (rx.created_at || "").slice(0, 10);
            const time = (rx.created_at || "").slice(11, 16);
            const items = itemsCache[rx.id] || [];
            const rawLines = (rx.lines || "").split("\n").filter(Boolean);
            const previewCount = items.length || rawLines.length;
            return (
              <article key={rx.id} style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden" }}>
                <header onClick={() => toggleOpen(rx.id)}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 18px", cursor: "pointer", background: isOpen ? "#f8fafc" : "#fff", borderBottom: isOpen ? "1px solid #eef2f7" : "none" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 8, background: "#fef3c7", color: "#b45309", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Pill size={17} />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#0f172a" }}>Ordonnance #{rx.id}</div>
                      <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                        {date} {time && `· ${time}`} · {previewCount} ligne{previewCount > 1 ? "s" : ""}
                        {rx.doctor_validated ? <span style={{ marginLeft: 8, color: "#059669", fontWeight: 600 }}>✓ Validée</span> : null}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <button onClick={(e) => { e.stopPropagation(); handlePrint(rx.id); }}
                      style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 11px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 11.5, cursor: "pointer" }}>
                      <FileText size={12} /> Imprimer
                    </button>
                    <ChevronRight size={16} style={{ color: "#94a3b8", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
                  </div>
                </header>
                {isOpen && (
                  <div style={{ padding: "14px 18px" }}>
                    {loadingItems && !itemsCache[rx.id] ? (
                      <div style={{ fontSize: 12.5, color: "#94a3b8" }}>Chargement des médicaments…</div>
                    ) : items.length > 0 ? (
                      <ol style={{ paddingLeft: 22, margin: 0, lineHeight: 1.7 }}>
                        {items.map((it) => (
                          <li key={it.id} style={{ marginBottom: 8 }}>
                            <strong style={{ color: "#0f172a" }}>{it.medicine_name}</strong>
                            {it.dosage ? <span style={{ color: "#475569" }}> · {it.dosage}</span> : null}
                            {it.frequency ? <span style={{ color: "#475569" }}> · {it.frequency}</span> : null}
                            {it.duration ? <span style={{ color: "#64748b" }}> · ({it.duration})</span> : null}
                            {it.dci ? <span style={{ color: "#94a3b8", fontSize: 11.5 }}> — {it.dci}</span> : null}
                            {it.instructions ? <div style={{ fontSize: 12, color: "#64748b", fontStyle: "italic", marginTop: 2 }}>{it.instructions}</div> : null}
                          </li>
                        ))}
                      </ol>
                    ) : rawLines.length > 0 ? (
                      <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: 13.5, color: "#0f172a", margin: 0, lineHeight: 1.6 }}>
                        {rx.lines}
                      </pre>
                    ) : (
                      <div style={{ fontSize: 12.5, color: "#94a3b8", fontStyle: "italic" }}>Ordonnance vide.</div>
                    )}
                    {rx.consultation_summary && (
                      <div style={{ marginTop: 12, padding: "10px 12px", background: "#f8fafc", borderLeft: "3px solid #3b82f6", borderRadius: 6, fontSize: 12.5, color: "#475569", lineHeight: 1.55 }}>
                        <strong style={{ color: "#0f172a", display: "block", marginBottom: 3 }}>Résumé de consultation</strong>
                        {rx.consultation_summary}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// OrdonnanceWriterPanel — Prescription builder with DB med search, auto-fill,
// manual entry, live A4 preview, AI safety check, and print/PDF.
// ───────────────────────────────────────────────────────────────────────────
function OrdonnanceWriterPanel({ patient, detail, onRefreshPatient }) {
  const [items, setItems] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "", quantity: "" });
  const [aiWarnings, setAiWarnings] = useState([]);
  const [aiChecking, setAiChecking] = useState(false);
  const searchRef = useRef(null);
  const debounceRef = useRef(null);
  const aiRef = useRef(null);

  useEffect(() => {
    if (searchTerm.length < 2) { setSearchResults([]); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await api.searchMedicines(searchTerm, 20);
        setSearchResults(res.rows || []);
      } catch { setSearchResults([]); }
      setSearching(false);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchTerm]);

  useEffect(() => {
    clearTimeout(aiRef.current);
    if (items.length === 0 || !patient?.id) { setAiWarnings([]); return; }
    aiRef.current = setTimeout(async () => {
      setAiChecking(true);
      try {
        const meds = items.map(i => i.medicine_name).filter(Boolean);
        const res = await api.safetyCheck({ patient_id: patient.id, medications: meds });
        setAiWarnings(res.warnings || []);
      } catch { setAiWarnings([]); }
      setAiChecking(false);
    }, 600);
    return () => clearTimeout(aiRef.current);
  }, [items, patient?.id]);

  function addMedicine(med) {
    setItems(prev => [...prev, {
      id: Date.now() + Math.random(),
      medicine_id: med.id,
      medicine_name: med.brand_name || med.dci || "",
      dci: med.dci || med.active_substance || "",
      dosage: med.dosage_strength || "",
      frequency: med.default_posology || "",
      duration: "",
      instructions: "",
      quantity: med.default_quantity || "1",
      is_free_text: false,
    }]);
    setSearchTerm("");
    setSearchResults([]);
    searchRef.current?.focus();
  }

  function addManualMed() {
    if (!manual.medicine_name.trim()) return;
    setItems(prev => [...prev, {
      id: Date.now() + Math.random(),
      medicine_id: null,
      medicine_name: manual.medicine_name.trim(),
      dci: "",
      dosage: manual.dosage,
      frequency: manual.frequency,
      duration: manual.duration,
      instructions: manual.instructions,
      quantity: manual.quantity || "1",
      is_free_text: false,
    }]);
    setManual({ medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "", quantity: "" });
    setShowManual(false);
  }

  function removeItem(id) { setItems(prev => prev.filter(i => i.id !== id)); }
  function updateItem(id, key, val) { setItems(prev => prev.map(i => i.id === id ? { ...i, [key]: val } : i)); }

  async function saveOrdonnance() {
    if (!patient?.id || items.length === 0) return;
    setSaving(true); setMsg("");
    try {
      const payload = {
        patient_id: patient.id,
        items: items.map(({ medicine_id, medicine_name, dci, dosage, frequency, duration, instructions, quantity, is_free_text }) => ({
          medicine_id, medicine_name, dci, dosage, frequency, duration, instructions, quantity, is_free_text,
        })),
        doctor_validated: true,
      };
      const result = await api.createPrescriptionWorkflow(payload);
      setMsg("Ordonnance enregistree");
      setItems([]);
      onRefreshPatient?.();
      if (result.id) window.open(`${apiBase}/api/prescriptions/${result.id}/pdf`, "_blank");
      setTimeout(() => setMsg(""), 4000);
    } catch (e) { setMsg(`Erreur: ${e.message}`); }
    setSaving(false);
  }

  function printPreview() {
    const win = window.open("", "_blank", "width=820,height=900");
    if (!win) return;
    const dateStr = new Date().toLocaleDateString("fr-FR");
    const linesHtml = items.map((it) => {
      const parts = [`<strong>${it.medicine_name}</strong>`];
      if (it.dosage) parts.push(it.dosage);
      if (it.frequency) parts.push(it.frequency);
      if (it.duration) parts.push(`pendant ${it.duration}`);
      if (it.quantity) parts.push(`Qte: ${it.quantity}`);
      let html = `<li style="margin-bottom:10px">${parts.join(" &mdash; ")}`;
      if (it.instructions) html += `<br/><em style="color:#555">${it.instructions}</em>`;
      html += `</li>`;
      return html;
    }).join("");
    win.document.write(`<!doctype html><html><head><title>Ordonnance ${dateStr}</title><style>body{font-family:'Times New Roman',serif;padding:40px 50px;color:#000;max-width:700px;margin:auto}h1{font-size:20px;margin:0 0 4px;text-align:center}h2{font-size:13px;color:#333;font-weight:400;margin:0 0 20px;text-align:center}ol{padding-left:24px;line-height:2;font-size:14px}li{margin-bottom:8px}.footer{margin-top:50px;padding-top:14px;border-top:1px solid #999;font-size:11px;color:#666;display:flex;justify-content:space-between}</style></head><body><h1>ORDONNANCE MEDICALE</h1><h2>${patient.nom || ""} ${patient.prenom || ""} &middot; ${patient.age || "?"} ans &middot; ${dateStr}</h2><ol>${linesHtml}</ol><div class="footer"><span>Signature du medecin</span><span>${dateStr}</span></div><script>window.print();<\/script></body></html>`);
    win.document.close();
  }

  if (!patient?.id) {
    return (
      <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontStyle: "italic", background: "#fff", borderRadius: 12, border: "1px solid #eef2f7" }}>
        Aucun patient selectionne.
      </div>
    );
  }

  const dateStr = new Date().toLocaleDateString("fr-FR");
  const dangerWarns = aiWarnings.filter(w => w.level === "danger");
  const otherWarns = aiWarnings.filter(w => w.level !== "danger");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, maxWidth: 1400, margin: "0 auto", alignItems: "start" }}>
      {/* ═══ LEFT: Editor ═══ */}
      <div>
        {/* Search bar */}
        <section style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 12, padding: 14, marginBottom: 14, position: "relative" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input ref={searchRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher medicament (nom, DCI)..."
                style={{ width: "100%", padding: "9px 10px 9px 32px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12.5, outline: "none" }} />
              {searching && <Loader2 size={13} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} className="imp-spin" />}
            </div>
            <button type="button" onClick={() => setShowManual(!showManual)}
              style={{ padding: "8px 12px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 11.5, fontWeight: 600, background: showManual ? "#eff6ff" : "#fff", color: "#2563eb", cursor: "pointer", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 4 }}>
              <Plus size={12} /> Manuel
            </button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ position: "absolute", left: 14, right: 14, top: "100%", zIndex: 100, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,.12)", maxHeight: 280, overflow: "auto", marginTop: 4 }}>
              {searchResults.map((med) => (
                <button key={med.id} type="button" onClick={() => addMedicine(med)}
                  style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "9px 12px", border: "none", borderBottom: "1px solid #f8fafc", background: "transparent", cursor: "pointer", textAlign: "left" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#f0f7ff"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}>
                  <Pill size={13} style={{ color: "#2563eb", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: "#0f172a" }}>{med.brand_name || med.dci}</div>
                    <div style={{ fontSize: 10.5, color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {med.dci && med.dci !== med.brand_name ? `DCI: ${med.dci}` : ""}{med.dosage_strength ? ` · ${med.dosage_strength}` : ""}{med.form ? ` · ${med.form}` : ""}
                    </div>
                  </div>
                  <Plus size={13} style={{ color: "#2563eb", flexShrink: 0 }} />
                </button>
              ))}
            </div>
          )}
        </section>

        {showManual && (
          <section style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: "#92400e", marginBottom: 8 }}>Ajout manuel</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input placeholder="Nom du medicament *" value={manual.medicine_name} onChange={(e) => setManual(f => ({ ...f, medicine_name: e.target.value }))} style={{ padding: "7px 9px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11.5, outline: "none" }} />
              <input placeholder="Dosage" value={manual.dosage} onChange={(e) => setManual(f => ({ ...f, dosage: e.target.value }))} style={{ padding: "7px 9px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11.5, outline: "none" }} />
              <input placeholder="Posologie" value={manual.frequency} onChange={(e) => setManual(f => ({ ...f, frequency: e.target.value }))} style={{ padding: "7px 9px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11.5, outline: "none" }} />
              <input placeholder="Duree" value={manual.duration} onChange={(e) => setManual(f => ({ ...f, duration: e.target.value }))} style={{ padding: "7px 9px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11.5, outline: "none" }} />
              <input placeholder="Qte / Boite" value={manual.quantity} onChange={(e) => setManual(f => ({ ...f, quantity: e.target.value }))} style={{ padding: "7px 9px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11.5, outline: "none" }} />
              <input placeholder="Instructions" value={manual.instructions} onChange={(e) => setManual(f => ({ ...f, instructions: e.target.value }))} style={{ padding: "7px 9px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 11.5, outline: "none" }} />
            </div>
            <button onClick={addManualMed} disabled={!manual.medicine_name.trim()} style={{ padding: "6px 12px", border: "none", borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: "#2563eb", color: "#fff", cursor: "pointer" }}>
              Ajouter
            </button>
          </section>
        )}

        {/* Items list */}
        <section style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden", marginBottom: 14 }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid #eef2f7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>Medicaments ({items.length})</div>
            {items.length > 0 && <button onClick={() => setItems([])} style={{ fontSize: 10.5, color: "#dc2626", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}>Tout supprimer</button>}
          </div>
          {items.length === 0 ? (
            <div style={{ padding: "30px 16px", textAlign: "center", color: "#94a3b8" }}>
              <Pill size={24} style={{ marginBottom: 6, color: "#cbd5e1" }} />
              <div style={{ fontSize: 12, fontWeight: 500 }}>Aucun medicament ajoute</div>
              <div style={{ fontSize: 11, marginTop: 3 }}>Recherchez et cliquez pour ajouter</div>
            </div>
          ) : (
            <div>
              {items.map((item, idx) => (
                <div key={item.id} style={{ padding: "10px 14px", borderBottom: "1px solid #f8fafc", display: "grid", gridTemplateColumns: "26px 1fr auto", gap: 10, alignItems: "start" }}>
                  <div style={{ width: 24, height: 24, borderRadius: 6, background: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700 }}>{idx + 1}</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#0f172a" }}>{item.medicine_name}</div>
                    {item.dci && <div style={{ fontSize: 10, color: "#64748b" }}>DCI: {item.dci}</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
                      <input placeholder="Dosage" value={item.dosage} onChange={(e) => updateItem(item.id, "dosage", e.target.value)} style={{ padding: "5px 7px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, outline: "none" }} />
                      <input placeholder="Posologie" value={item.frequency} onChange={(e) => updateItem(item.id, "frequency", e.target.value)} style={{ padding: "5px 7px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, outline: "none" }} />
                      <input placeholder="Duree" value={item.duration} onChange={(e) => updateItem(item.id, "duration", e.target.value)} style={{ padding: "5px 7px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, outline: "none" }} />
                      <input placeholder="Qte" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", e.target.value)} style={{ padding: "5px 7px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, outline: "none" }} />
                      <input placeholder="Instructions" value={item.instructions} onChange={(e) => updateItem(item.id, "instructions", e.target.value)} style={{ padding: "5px 7px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, outline: "none", gridColumn: "span 2" }} />
                    </div>
                  </div>
                  <button onClick={() => removeItem(item.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#dc2626", padding: 2 }}><XCircle size={15} /></button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* AI Safety Warnings */}
        {(aiWarnings.length > 0 || aiChecking) && (
          <section style={{ background: dangerWarns.length > 0 ? "#fef2f2" : "#fffbeb", border: `1px solid ${dangerWarns.length > 0 ? "#fecaca" : "#fde68a"}`, borderRadius: 10, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <AlertTriangle size={14} style={{ color: dangerWarns.length > 0 ? "#dc2626" : "#d97706" }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: dangerWarns.length > 0 ? "#991b1b" : "#92400e" }}>
                {aiChecking ? "Verification en cours..." : `AI Securite — ${aiWarnings.length} alerte${aiWarnings.length > 1 ? "s" : ""}`}
              </span>
            </div>
            {dangerWarns.map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "start", gap: 6, padding: "5px 0", borderBottom: "1px solid #fecaca" }}>
                <XCircle size={13} style={{ color: "#dc2626", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11.5, color: "#991b1b", fontWeight: 600 }}>{w.message}</span>
              </div>
            ))}
            {otherWarns.map((w, i) => (
              <div key={i} style={{ display: "flex", alignItems: "start", gap: 6, padding: "5px 0" }}>
                <AlertTriangle size={12} style={{ color: "#d97706", flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 11, color: "#92400e" }}>{w.message}</span>
              </div>
            ))}
          </section>
        )}

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button onClick={saveOrdonnance} disabled={saving || items.length === 0}
            style={{ padding: "9px 18px", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: saving || items.length === 0 ? "#94a3b8" : "#2563eb", color: "#fff", cursor: saving || items.length === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Save size={13} /> {saving ? "Enregistrement..." : "Enregistrer & PDF"}
          </button>
          <button onClick={printPreview} disabled={items.length === 0}
            style={{ padding: "9px 14px", border: "1px solid #e2e8f0", borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: "#fff", color: "#0f172a", cursor: items.length === 0 ? "not-allowed" : "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Printer size={13} /> Imprimer
          </button>
          {msg && <span style={{ fontSize: 11.5, fontWeight: 600, padding: "4px 10px", borderRadius: 5, color: msg.startsWith("Erreur") ? "#dc2626" : "#059669", background: msg.startsWith("Erreur") ? "#fef2f2" : "#f0fdf4" }}>{msg}</span>}
        </div>
      </div>

      {/* ═══ RIGHT: Live A4 Preview ═══ */}
      <div style={{ background: "#e5e7eb", borderRadius: 12, padding: 20, minHeight: 500 }}>
        <div style={{ background: "#fff", borderRadius: 4, boxShadow: "0 2px 12px rgba(0,0,0,.08)", padding: "40px 36px", minHeight: 460, fontFamily: "'Times New Roman', 'Georgia', serif", color: "#000", position: "relative" }}>
          {/* A4 Header */}
          <div style={{ textAlign: "center", marginBottom: 24, borderBottom: "2px solid #000", paddingBottom: 14 }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>ORDONNANCE MEDICALE</div>
            <div style={{ fontSize: 12, marginTop: 6, color: "#333" }}>
              Patient : <strong>{patient.nom || ""} {patient.prenom || ""}</strong> · {patient.age || "?"} ans · {dateStr}
            </div>
          </div>

          {/* Prescription lines */}
          {items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#aaa", fontStyle: "italic", fontSize: 14, fontFamily: "Arial, sans-serif" }}>
              Les medicaments ajoutes apparaitront ici en temps reel...
            </div>
          ) : (
            <ol style={{ paddingLeft: 22, margin: 0, lineHeight: 2, fontSize: 13.5 }}>
              {items.map((it, idx) => (
                <li key={it.id} style={{ marginBottom: 8 }}>
                  <strong>{it.medicine_name}</strong>
                  {it.dosage ? ` ${it.dosage}` : ""}
                  {it.frequency ? ` — ${it.frequency}` : ""}
                  {it.duration ? ` (${it.duration})` : ""}
                  {it.quantity ? ` · Qte: ${it.quantity}` : ""}
                  {it.instructions ? <div style={{ fontSize: 11.5, color: "#555", fontStyle: "italic", marginTop: 1 }}>{it.instructions}</div> : null}
                </li>
              ))}
            </ol>
          )}

          {/* A4 Footer */}
          <div style={{ position: "absolute", bottom: 36, left: 36, right: 36, borderTop: "1px solid #999", paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: 11, color: "#666" }}>
            <span>Signature du medecin</span>
            <span>{dateStr}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// AntecedentsContentPanel — full antécédents view (medical history, allergies,
// chronic conditions, surgical/familial/gyneco, lifestyle). Inline editable.
// ───────────────────────────────────────────────────────────────────────────
function AntecedentsContentPanel({ patient, form, setForm, saving, onSave }) {
  const [editing, setEditing] = useState(false);

  if (!patient?.id) {
    return (
      <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontStyle: "italic", background: "#fff", borderRadius: 12, border: "1px solid #eef2f7" }}>
        Aucun patient sélectionné.
      </div>
    );
  }

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const v = (key) => (editing ? (form[key] ?? "") : (patient[key] ?? form[key] ?? ""));
  const display = (val) => {
    const s = String(val || "").trim();
    return s || <span style={{ color: "#cbd5e1", fontStyle: "italic", fontSize: 13 }}>Non renseigné</span>;
  };

  const sections = [
    {
      title: "Antecedents medicaux",
      color: "#3b82f6",
      cols: 2,
      fields: [
        { key: "maladies", label: "Maladies chroniques", placeholder: "HTA, diabete, dyslipidemie...", rows: 3 },
        { key: "antecedents", label: "Antecedents medicaux generaux", placeholder: "Pathologies passees, hospitalisations...", rows: 3 },
        { key: "antecedents_chirurgicaux", label: "Antecedents chirurgicaux", placeholder: "Interventions, dates, indications...", rows: 2 },
        { key: "antecedents_familiaux", label: "Antecedents familiaux", placeholder: "Maladies cardio, cancers, diabete familial...", rows: 2 },
        { key: "antecedents_gyneco", label: "Antecedents gyneco-obstetricaux", placeholder: "Grossesses, menopause, gestes...", rows: 2 },
        { key: "autres_antecedents", label: "Autres antecedents", placeholder: "Tout autre element pertinent", rows: 2 },
        { key: "notes_importantes", label: "Notes importantes / alertes", placeholder: "A signaler systematiquement avant prescription", rows: 2 },
      ],
    },
  ];

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 12, flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#0f172a", letterSpacing: "-0.01em" }}>
            Antécédents du patient
          </h2>
          <div style={{ marginTop: 3, fontSize: 13, color: "#64748b" }}>
            Historique médical complet · {patient.prenom} {patient.nom}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
              <Edit3 size={14} /> Modifier
            </button>
          ) : (
            <>
              <button onClick={() => setEditing(false)} disabled={saving}
                style={{ padding: "9px 16px", background: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                Annuler
              </button>
              <button onClick={async () => { await onSave?.(); setEditing(false); }} disabled={saving}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                <Save size={14} /> {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </>
          )}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        {sections.map((sec) => (
          <section key={sec.title} style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden" }}>
            <header style={{ padding: "12px 18px", borderBottom: "1px solid #f1f5f9", display: "flex", alignItems: "center", gap: 10, background: `${sec.color}08` }}>
              <span style={{ width: 6, height: 18, background: sec.color, borderRadius: 3 }} />
              <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>{sec.title}</h3>
            </header>
            <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: `repeat(${sec.cols || 1}, 1fr)`, gap: 14 }}>
              {sec.fields.map((f) => (
                <div key={f.key}>
                  <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 6 }}>
                    {f.label}
                  </label>
                  {editing ? (
                    f.rows > 1 ? (
                      <textarea value={v(f.key)} placeholder={f.placeholder}
                        onChange={(e) => update(f.key, e.target.value)}
                        rows={f.rows}
                        style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13.5, fontFamily: "inherit", resize: "vertical", lineHeight: 1.5 }} />
                    ) : (
                      <input value={v(f.key)} placeholder={f.placeholder}
                        onChange={(e) => update(f.key, e.target.value)}
                        style={{ width: "100%", padding: "9px 11px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13.5 }} />
                    )
                  ) : (
                    <div style={{ fontSize: 13.5, color: "#0f172a", whiteSpace: "pre-wrap", lineHeight: 1.55, minHeight: 20 }}>
                      {display(v(f.key))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// PrintableFichePanel — clean printable patient sheet (état civil + résumé).
// ───────────────────────────────────────────────────────────────────────────
function PrintableFichePanel({ patient, detail }) {
  if (!patient) {
    return <div style={{ padding: 24, color: "#94a3b8", fontStyle: "italic" }}>Aucun patient sélectionné.</div>;
  }
  const visits = detail?.visits || [];
  const prescriptions = detail?.prescriptions || [];
  const lastVisit = visits[0];

  const handlePrint = () => window.print();

  const COL = { ink: "#0f172a", muted: "#64748b", line: "#e5e7eb" };
  const labelStyle = { color: COL.muted, fontWeight: 500, fontSize: 12.5 };
  const valueStyle = { color: COL.ink, fontWeight: 600, fontSize: 13.5 };
  const fieldRow = (label, value) => (
    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr", gap: 12, padding: "7px 0", borderBottom: `1px solid ${COL.line}` }}>
      <span style={labelStyle}>{label}</span>
      <span style={value ? valueStyle : { ...valueStyle, color: "#cbd5e1", fontStyle: "italic" }}>{value || "—"}</span>
    </div>
  );

  return (
    <div className="printable-fiche">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .printable-fiche, .printable-fiche * { visibility: visible !important; }
          .printable-fiche { position: absolute; left: 0; top: 0; width: 100%; padding: 24px !important; }
          .fiche-no-print { display: none !important; }
        }
      `}</style>

      <div className="fiche-no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: COL.ink }}>Fiche Patient</h2>
          <div style={{ marginTop: 3, fontSize: 13, color: COL.muted }}>Résumé imprimable du dossier</div>
        </div>
        <button onClick={handlePrint} style={{ padding: "9px 18px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          🖨 Imprimer
        </button>
      </div>

      <div style={{ background: "#fff", border: `1px solid ${COL.line}`, borderRadius: 14, padding: 24 }}>
        <div style={{ borderBottom: `2px solid ${COL.ink}`, paddingBottom: 12, marginBottom: 18 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: COL.ink }}>
            {[patient.nom, patient.prenom].filter(Boolean).join(" ") || "Patient"}
          </div>
          <div style={{ fontSize: 12, color: COL.muted, marginTop: 4 }}>
            Code: {patient.code || "—"} · {patient.sexe || "—"} · {patient.age ? `${patient.age} ans` : "—"}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: COL.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>État civil</div>
            {fieldRow("Date naissance", patient.date_naissance)}
            {fieldRow("Sexe", patient.sexe)}
            {fieldRow("Groupe sanguin", patient.groupe_sanguin)}
            {fieldRow("Situation", patient.situation_familiale)}
            {fieldRow("Profession", patient.profession)}
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: COL.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Coordonnées</div>
            {fieldRow("Téléphone", patient.telephone)}
            {fieldRow("Adresse", patient.adresse)}
            {fieldRow("Orienté par", patient.oriente_par)}
          </div>
        </div>

        <div style={{ marginTop: 20 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, color: COL.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Antécédents médicaux</div>
          <div style={{ padding: "10px 12px", background: "#f8fafc", borderRadius: 8, fontSize: 13.5, color: COL.ink, whiteSpace: "pre-wrap", minHeight: 40 }}>
            {patient.antecedents || patient.maladies || "Aucun antécédent renseigné"}
          </div>
        </div>

        {patient.notes_importantes && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: COL.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Notes importantes</div>
            <div style={{ padding: "10px 12px", background: "#fffbeb", borderRadius: 8, fontSize: 13.5, color: COL.ink, whiteSpace: "pre-wrap", border: "1px solid #fde68a" }}>
              {patient.notes_importantes}
            </div>
          </div>
        )}

        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          <div style={{ padding: "12px 14px", background: "#eff6ff", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6" }}>{visits.length}</div>
            <div style={{ fontSize: 11.5, color: COL.muted, fontWeight: 500 }}>Visites</div>
          </div>
          <div style={{ padding: "12px 14px", background: "#ecfdf5", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#10b981" }}>{prescriptions.length}</div>
            <div style={{ fontSize: 11.5, color: COL.muted, fontWeight: 500 }}>Ordonnances</div>
          </div>
          <div style={{ padding: "12px 14px", background: "#f5f3ff", borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#8b5cf6" }}>{(detail?.documents || []).length}</div>
            <div style={{ fontSize: 11.5, color: COL.muted, fontWeight: 500 }}>Documents</div>
          </div>
        </div>

        {lastVisit && (
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: COL.muted, textTransform: "uppercase", letterSpacing: ".5px", marginBottom: 8 }}>Dernière visite</div>
            <div style={{ padding: "12px 14px", background: "#f8fafc", borderRadius: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 600, color: COL.ink, marginBottom: 4 }}>
                {lastVisit.date_visite ? String(lastVisit.date_visite).slice(0, 10) : "—"}
                {lastVisit.motif ? ` · ${lastVisit.motif}` : ""}
              </div>
              {lastVisit.diagnostics && <div style={{ color: COL.muted, lineHeight: 1.5 }}>{lastVisit.diagnostics}</div>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Small helper panels used by PatientWorkstation embeddedPanels
function VisitFeesSummary({ visits }) {
  const total = visits.reduce((s, v) => s + (Number(v.visit_fee) || 0), 0);
  const paid = visits.reduce((s, v) => s + (Number(v.fee_paid) || 0), 0);
  const due = Math.max(total - paid, 0);
  const fmt = (n) => Number(n || 0).toLocaleString();
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Caisse — Historique des règlements</h3>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        <div style={{ padding: 14, background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#1e40af" }}>{fmt(total)} DA</div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>Total facturé</div>
        </div>
        <div style={{ padding: 14, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#059669" }}>{fmt(paid)} DA</div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>Total payé</div>
        </div>
        <div style={{ padding: 14, background: due > 0 ? "#fef2f2" : "#f8fafc", border: `1px solid ${due > 0 ? "#fecaca" : "#e5e7eb"}`, borderRadius: 10, textAlign: "center" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: due > 0 ? "#dc2626" : "#64748b" }}>{fmt(due)} DA</div>
          <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: .4 }}>Solde dû</div>
        </div>
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden" }}>
        <thead>
          <tr style={{ background: "#f1f5f9", color: "#64748b" }}>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600 }}>Date</th>
            <th style={{ textAlign: "left", padding: "8px 12px", fontWeight: 600 }}>Type</th>
            <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600 }}>Honoraire</th>
            <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600 }}>Payé</th>
            <th style={{ textAlign: "right", padding: "8px 12px", fontWeight: 600 }}>Reste</th>
            <th style={{ textAlign: "center", padding: "8px 12px", fontWeight: 600 }}>Statut</th>
          </tr>
        </thead>
        <tbody>
          {visits.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>Aucune visite</td></tr>}
          {visits.map((v) => {
            const reste = Math.max((Number(v.visit_fee) || 0) - (Number(v.fee_paid) || 0), 0);
            const status = v.payment_status || "pending";
            return (
              <tr key={v.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                <td style={{ padding: "8px 12px" }}>{String(v.date_visite || "").slice(0, 10)}</td>
                <td style={{ padding: "8px 12px" }}>{v.visit_type || v.motif || "—"}</td>
                <td style={{ padding: "8px 12px", textAlign: "right" }}>{fmt(v.visit_fee)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", color: "#059669" }}>{fmt(v.fee_paid)}</td>
                <td style={{ padding: "8px 12px", textAlign: "right", fontWeight: reste > 0 ? 700 : 500, color: reste > 0 ? "#dc2626" : "#64748b" }}>{fmt(reste)}</td>
                <td style={{ padding: "8px 12px", textAlign: "center" }}>
                  <span style={{
                    display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: status === "paid" ? "#ecfdf5" : status === "partial" ? "#fffbeb" : "#fef2f2",
                    color: status === "paid" ? "#059669" : status === "partial" ? "#d97706" : "#dc2626",
                  }}>{status === "paid" ? "Payé" : status === "partial" ? "Partiel" : "En attente"}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PatientQuickStats({ patient, detail }) {
  const visits = detail?.visits || [];
  const prescriptions = detail?.prescriptions || [];
  const documents = detail?.documents || [];
  const appointments = detail?.appointments || [];
  const firstVisit = visits[visits.length - 1]?.date_visite;
  const lastVisit = visits[0]?.date_visite;
  const totalFee = visits.reduce((s, v) => s + (Number(v.visit_fee) || 0), 0);
  const totalPaid = visits.reduce((s, v) => s + (Number(v.fee_paid) || 0), 0);
  const cards = [
    { label: "Visites", value: visits.length, color: "#2563eb", bg: "#eff6ff" },
    { label: "Ordonnances", value: prescriptions.length, color: "#059669", bg: "#ecfdf5" },
    { label: "Documents", value: documents.length, color: "#7c3aed", bg: "#f5f3ff" },
    { label: "Rendez-vous", value: appointments.length, color: "#d97706", bg: "#fffbeb" },
    { label: "Total facturé", value: `${totalFee.toLocaleString()} DA`, color: "#1e40af", bg: "#eff6ff" },
    { label: "Total payé", value: `${totalPaid.toLocaleString()} DA`, color: "#059669", bg: "#ecfdf5" },
  ];
  return (
    <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#0f172a" }}>Statistiques du patient</h3>
      <div style={{ fontSize: 12.5, color: "#64748b" }}>
        Première visite : <strong style={{ color: "#0f172a" }}>{firstVisit ? String(firstVisit).slice(0, 10) : "—"}</strong> ·
        &nbsp;Dernière visite : <strong style={{ color: "#0f172a" }}>{lastVisit ? String(lastVisit).slice(0, 10) : "—"}</strong>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {cards.map((c) => (
          <div key={c.label} style={{ padding: 16, background: c.bg, border: `1px solid ${c.color}20`, borderRadius: 10, textAlign: "center" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: c.color }}>{c.value}</div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginTop: 4 }}>{c.label}</div>
          </div>
        ))}
      </div>
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
  onDeleteDiagnosis,
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
    FileCheck, Bot, Settings, BookOpen, Upload, FlaskConical, ClipboardList
  };

  const rawTabs = buildTabList(specialityConfig);
  const allTabs = rawTabs.map(t => ({
    ...t,
    icon: TAB_ICONS[t.icon] || FileImage,
  }));

  // ═══ Simple 5-tab nav for doctors ═══
  // Always visible: Ordonnance · État civil · Antécédents · Fiche · Visite
  const visiblePrimary = [
    { id: "templates",   label: "Ordonnance" },
    { id: "civil",       label: "État civil" },
    { id: "antecedents", label: "Antécédents" },
    { id: "fiche",       label: "Fiche Patient" },
    { id: "new-visit",   label: "Visite" },
  ];
  const plusItems = [];

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, flex: 1 }}>
      {/* Calm sticky tab bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "#fff",
        borderBottom: "1px solid #eef2f7",
        padding: "0 16px",
        display: "flex", gap: 4, alignItems: "center",
      }}>
        {visiblePrimary.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                position: "relative",
                padding: "14px 16px",
                fontSize: 14, fontWeight: isActive ? 600 : 500,
                border: "none", background: "transparent",
                color: isActive ? "#0f172a" : "#64748b",
                cursor: "pointer",
                borderBottom: isActive ? "2px solid #3b82f6" : "2px solid transparent",
                marginBottom: -1,
              }}>
              {tab.label}
            </button>
          );
        })}
        {plusItems.length > 0 && (
          <PlusMenu activeTab={activeTab} setActiveTab={setActiveTab} groups={plusItems} labelOf={labelOf} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", background: "#fafbfc" }}>
          {activeTab === "new-visit" && <VisitPanelV2 visit={visit} setVisit={setVisit} onSave={onSaveVisit} onDictate={onDictate} />}
          {activeTab === "profile" && <CardioProfilePanel patient={patient} cardio={cardio} onSave={onSaveCardioProfile} />}
          {activeTab === "vitals" && <VitalsPanelV2 patient={patient} cardio={cardio} onSave={onSaveVitals} />}
          {activeTab === "bmi" && <BMIPanelV2 patient={patient} />}
          {activeTab === "ecg" && <ECGPanel patient={patient} detail={detail} cardio={cardio} onSave={onSaveEcg} />}
          {activeTab === "scores" && <ScoresPanelV2 cardio={cardio} />}
          {activeTab === "imaging" && <ImagingLabsPanelV2 patient={patient} cardio={cardio} onSaveImaging={onSaveImaging} onSaveLabs={onSaveLabs} />}
          {activeTab === "diagnosis" && <DiagnosisTreatmentPanel patient={patient} cardio={cardio} medications={medications} onDiagnosis={onSaveDiagnosis} onDeleteDiagnosis={onDeleteDiagnosis} onSavePrescription={onSavePrescription} />}
          {activeTab === "followup" && <FollowupPanel patient={patient} cardio={cardio} appointments={appointments} onAutoFollowup={onAutoFollowup} onSaveAppointment={onSaveAppointment} />}
          {activeTab === "civil" && (
            <CivilPanelCard
              form={patientForm}
              setForm={setPatientForm}
              selected={patient}
              detail={detail}
              saving={saving}
              onNew={onNewPatient}
              onSave={onSavePatient}
              onDelete={onDeletePatient}
            />
          )}
          {activeTab === "antecedents" && (
            <AntecedentsContentPanel
              patient={patient}
              form={patientForm}
              setForm={setPatientForm}
              saving={saving}
              onSave={onSavePatient}
            />
          )}
          {activeTab === "fiche" && (
            <PrintableFichePanel patient={patient} detail={detail} />
          )}
          {activeTab === "historique" && <Timeline detail={detail} />}
          {activeTab === "docs" && <DocumentsPanel patient={patient} detail={detail} onUpload={onUpload} onSaveNotes={onSaveDocumentNotes} uploadMode={uploadMode} />}
          {activeTab === "templates" && <OrdonnancePreviewPanel patient={patient} detail={detail} onNav={() => setActiveTab("settings")} />}
          {activeTab === "specialty" && <SpecialityFieldsPanel patient={patient} specialityConfig={specialityConfig} />}
          {activeTab === "medicines" && <MedicineDatabasePanel />}
          {activeTab === "bilan" && <BilanPanel patient={patient} />}
          {activeTab === "ai" && <AIPanel patient={patient} aiWarnings={aiWarnings} onCheck={onAiCheck} specialityConfig={specialityConfig} />}
          {activeTab === "reglement" && <ReglementPanelV2 patient={patient} />}
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
  );
}

function Timeline({ detail }) {
  const [expandedId, setExpandedId] = useState(null);
  const [expandAll, setExpandAll] = useState(false);
  // Build a metric chip when the value exists — avoids noisy empty fields
  const chip = (label, value, unit, color) => {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    return (
      <span key={label} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 600,
        background: `${color}18`, color: color, border: `1px solid ${color}40`,
      }}>
        <span style={{ opacity: .75, fontWeight: 500 }}>{label}:</span>
        {value}{unit ? <span style={{ opacity: .75, fontWeight: 500 }}>{unit}</span> : null}
      </span>
    );
  };
  // Detail row for expanded visit view
  const detailRow = (label, value) => {
    if (!value || String(value).trim() === "") return null;
    return (
      <div key={label} style={{ display: "flex", gap: 10, padding: "4px 0", borderBottom: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", minWidth: 120, textTransform: "uppercase", letterSpacing: ".3px" }}>
          {label}
        </span>
        <span style={{ fontSize: 13, color: "#0f172a", flex: 1, whiteSpace: "pre-wrap" }}>
          {String(value)}
        </span>
      </div>
    );
  };

  const entries = useMemo(() => {
    const visits = (detail?.visits || []).map((item) => {
      const taille = item.taille ? Number(item.taille) : null;
      const poids = item.poids ? Number(item.poids) : null;
      const imc = (taille && poids && taille > 0)
        ? (poids / Math.pow(taille / 100, 2)).toFixed(1)
        : null;
      return {
        id: `v-${item.id}`, date: item.date_visite, type: "Visite",
        color: "#2563eb", bg: "#eff6ff", raw: item, imc,
        title: item.motif || item.diagnostics || "Consultation",
        body: [item.diagnostics, item.traitements, item.examens, item.histoire]
          .filter(Boolean).join(" — "),
      };
    });
    const docs = (detail?.documents || []).map((item) => ({
      id: `d-${item.id}`, date: item.uploaded_at, type: "Document",
      color: "#10b981", bg: "#ecfdf5",
      title: `${item.type_document || "Document"} — ${item.original_name || ""}`,
      body: item.notes || "",
    }));
    const rx = (detail?.prescriptions || []).map((item) => ({
      id: `p-${item.id}`, date: item.created_at, type: "Ordonnance",
      color: "#f59e0b", bg: "#fffbeb",
      title: "Ordonnance",
      body: item.consultation_summary || item.lines || "",
    }));
    return [...visits, ...docs, ...rx].sort((a, b) =>
      String(b.date || "").localeCompare(String(a.date || ""))
    );
  }, [detail]);

  const typeIcon = { Visite: Stethoscope, Document: FileImage, Ordonnance: ClipboardPlus };

  return (
    <aside style={{
      background: "linear-gradient(180deg,#fff 0%,#f8fafc 100%)",
      border: "1px solid #e5e7eb", borderRadius: 14, padding: 18,
      boxShadow: "0 1px 3px rgba(0,0,0,.04)",
      display: "block",
    }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>🕒</span>
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#0f172a" }}>Historique clinique complet</h2>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            type="button"
            onClick={() => { setExpandAll(v => !v); setExpandedId(null); }}
            style={{
              padding: "4px 10px", fontSize: 11, fontWeight: 600,
              borderRadius: 999, border: "1px solid #cbd5e1",
              background: expandAll ? "#2563eb" : "#fff",
              color: expandAll ? "#fff" : "#475569",
              cursor: "pointer",
            }}
            title="Afficher ou masquer tous les détails"
          >
            {expandAll ? "Tout réduire" : "Tout développer"}
          </button>
          <span className="timeline-count">{entries.length} événements</span>
        </div>
      </header>
      {entries.length === 0 && (
        <div style={{ textAlign: "center", padding: "36px 12px", color: "#64748b" }}>
          <div style={{ fontSize: 32, marginBottom: 6 }}>📭</div>
          <strong style={{ fontSize: 13, color: "#0f172a" }}>Aucun événement</strong>
          <p style={{ fontSize: 12, margin: "4px 0 0" }}>Visites, documents et ordonnances apparaîtront ici.</p>
        </div>
      )}
      <div className="timeline-container">
        {entries.slice(0, 60).map((item) => {
          const TypeIcon = typeIcon[item.type] || Clock;
          const v = item.raw || {};
          const chips = item.type === "Visite" ? [
            chip("TA", v.tension, " mmHg", "#dc2626"),
            chip("FC", v.frequence_cardiaque, " bpm", "#db2777"),
            chip("Poids", v.poids, " kg", "#059669"),
            chip("Taille", v.taille, " cm", "#0891b2"),
            chip("IMC", item.imc, "", "#7c3aed"),
            chip("Glycémie", v.glycemie, " g/L", "#ea580c"),
            chip("SpO₂", v.saturation, " %", "#0284c7"),
            chip("Temp", v.temperature, " °C", "#e11d48"),
          ].filter(Boolean) : [];
          const expandable = item.type === "Visite";
          const isExpanded = expandable && (expandAll || expandedId === item.id);
          return (
            <div key={item.id} className="timeline-event">
              <div className="timeline-event__dot" style={{ borderColor: item.color }} />
              <time>{String(item.date || "").slice(0, 16).replace("T", " ")}</time>
              <div
                className="event-card"
                style={{
                  borderLeft: `3px solid ${item.color}`,
                  cursor: expandable ? "pointer" : "default",
                  transition: "box-shadow .15s",
                  boxShadow: isExpanded ? "0 4px 16px rgba(15,23,42,.12)" : "none",
                }}
                onClick={() => expandable && setExpandedId(isExpanded ? null : item.id)}
              >
                <div className="event-card__header">
                  <span className="event-card__badge" style={{ color: item.color, background: item.bg }}>
                    <TypeIcon size={11} /> {item.type}
                  </span>
                  <strong>{item.title}</strong>
                  {expandable && (
                    <span style={{ marginLeft: "auto", fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                      {isExpanded ? "▲ Réduire" : "▼ Voir tout"}
                    </span>
                  )}
                </div>
                {chips.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {chips}
                  </div>
                )}
                {!isExpanded && item.body && (
                  <p style={{ marginTop: chips.length ? 8 : 4 }}>
                    {String(item.body).slice(0, 200)}{String(item.body).length > 200 ? "…" : ""}
                  </p>
                )}
                {!isExpanded && item.type === "Visite" && v.notes && (
                  <p style={{ marginTop: 4, fontStyle: "italic", color: "#64748b", fontSize: 12 }}>
                    {String(v.notes).slice(0, 150)}{String(v.notes).length > 150 ? "…" : ""}
                  </p>
                )}
                {/* ═══ EXPANDED VISIT DETAIL ═══ */}
                {isExpanded && item.type === "Visite" && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      marginTop: 12, padding: "12px 14px", background: "#f8fafc",
                      borderRadius: 8, border: "1px solid #e2e8f0",
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, color: "#1e40af", marginBottom: 8, textTransform: "uppercase", letterSpacing: ".5px" }}>
                      Détails complets de la visite
                    </div>
                    {detailRow("Date", String(v.date_visite || "").slice(0, 16).replace("T", " "))}
                    {detailRow("Type de visite", v.visit_type)}
                    {detailRow("Motif", v.motif)}
                    {detailRow("Histoire de la maladie", v.histoire)}
                    {detailRow("Examens", v.examens)}
                    {detailRow("Diagnostic", v.diagnostics)}
                    {detailRow("Traitements prescrits", v.traitements)}
                    {detailRow("Tension artérielle", v.tension ? `${v.tension} mmHg` : null)}
                    {detailRow("Fréq. cardiaque", v.frequence_cardiaque ? `${v.frequence_cardiaque} bpm` : null)}
                    {detailRow("Glycémie", v.glycemie ? `${v.glycemie} g/L` : null)}
                    {detailRow("Poids", v.poids ? `${v.poids} kg` : null)}
                    {detailRow("Taille", v.taille ? `${v.taille} cm` : null)}
                    {detailRow("IMC calculé", item.imc)}
                    {detailRow("Honoraires", v.visit_fee ? `${v.visit_fee} DA` : null)}
                    {detailRow("Payé", v.fee_paid ? `${v.fee_paid} DA` : null)}
                    {detailRow("Statut paiement", v.payment_status)}
                  </div>
                )}
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
// AI & CRÉDITS PAGE (uses cloud API for subscription/credits/HF chat)
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
      setMsg(`Connecté: ${sub.plan_label} - ${sub.remaining_credits} crédits restants`);
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
        L'IA Médicale (Qwen 2.5 7B) est gérée à distance par votre administrateur. Saisissez les identifiants
        qu'il vous a communiqués pour activer l'analyse cloud (via OpenRouter).
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
    if (!confirm("Déconnecter l'IA cloud ? Les paramètres seront effacés.")) return;
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
    alert("Le changement de plan est géré par votre administrateur. Contactez-le.");
  }
  async function toggleAI() {
    alert("L'activation/désactivation de l'IA est gérée par votre administrateur. Contactez-le.");
  }

  // Not yet configured: show only the cloud config card
  if (!configured) {
    return (
      <div className="ai-credits-page">
        <header className="directory-header">
          <div className="directory-title">
            <h1>AI & Crédits</h1>
            <p>L'IA Bio-Medical (OpenRouter / Qwen) est gérée par votre administrateur via le cloud.</p>
          </div>
        </header>
        <CloudConfigCard onConfigured={() => setConfigured(true)} />
      </div>
    );
  }

  if (loading) return <div className="ai-credits-page"><div className="ai-credits-loading">Chargement…</div></div>;
  if (!sub) return (
    <div className="ai-credits-page">
      <div className="soft-error">{error || "Impossible de charger l'abonnement IA"}</div>
      <div style={{ marginTop: 12 }}>
        <button className="btn btn--secondary" onClick={refresh}>Réessayer</button>
        <button className="btn btn--ghost" onClick={disconnectCloud} style={{ marginLeft: 8 }}>Reconfigurer</button>
      </div>
    </div>
  );

  const monthly = sub.monthly_credits || 0;
  const used = sub.used_credits || 0;
  const remaining = sub.unlimited ? "∞" : (sub.remaining_credits || 0);
  const ratio = sub.unlimited ? 0 : (monthly > 0 ? used / monthly : 0);
  let healthClass = "is-ok";
  let healthLabel = "Crédits OK";
  if (!sub.unlimited) {
    if (ratio >= 1) { healthClass = "is-danger"; healthLabel = "Épuisé"; }
    else if (ratio >= 0.8) { healthClass = "is-warning"; healthLabel = "Crédits faibles"; }
  } else { healthLabel = "Illimité"; }

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
          <h1>AI & Crédits</h1>
          <p>Suivez votre abonnement IA, vos crédits restants et l'historique d'utilisation.</p>
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
          <div className="ai-credit-card__sub">{sub.unlimited ? "Crédits illimités" : `${monthly} crédits / mois`}</div>
        </div>
        <div className={`ai-credit-card ${healthClass}`}>
          <div className="ai-credit-card__label">Crédits restants</div>
          <div className="ai-credit-card__value">{remaining}</div>
          <div className="ai-credit-card__sub">{healthLabel}</div>
        </div>
        <div className="ai-credit-card is-neutral">
          <div className="ai-credit-card__label">Utilisés ce mois</div>
          <div className="ai-credit-card__value">{used}</div>
          <div className="ai-credit-card__sub">Renouvellement: {sub.renewal_date}</div>
        </div>
        <div className="ai-credit-card is-neutral">
          <div className="ai-credit-card__label">Économie cache</div>
          <div className="ai-credit-card__value">{stats.cache_hits}</div>
          <div className="ai-credit-card__sub">Analyses réutilisées</div>
        </div>
      </div>

      {!sub.unlimited && (
        <div className="ai-credit-progress">
          <div className="ai-credit-progress__bar">
            <div className={`ai-credit-progress__fill ${healthClass}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
          </div>
          <div className="ai-credit-progress__label">{used} / {monthly} crédits utilisés</div>
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
                {p.unlimited ? "∞" : p.monthly_credits}
                <span>{p.unlimited ? "illimités" : "crédits/mois"}</span>
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
        <h2>Coût par action</h2>
        <table className="ai-credits-table">
          <thead><tr><th>Action</th><th>Crédits</th></tr></thead>
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
              <div key={d.day} className="ai-credits-chart__bar" title={`${d.day}: ${d.credits} crédits`}>
                <div className="ai-credits-chart__fill" style={{ height: `${(d.credits / maxDaily) * 100}%` }} />
                <div className="ai-credits-chart__day">{d.day.slice(8)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* === Recent actions === */}
      <section className="ai-credits-section">
        <h2>Dernières actions ({logs.length})</h2>
        {logs.length === 0 ? (
          <div className="empty-state empty-state--subtle"><Bot size={20} /><p>Aucune action IA enregistrée pour le moment.</p></div>
        ) : (
          <table className="ai-credits-table">
            <thead><tr><th>Date</th><th>Action</th><th>Crédits</th><th>Statut</th></tr></thead>
            <tbody>
              {logs.slice(0, 20).map((log) => (
                <tr key={log.id}>
                  <td>{String(log.created_at || "").slice(0, 16).replace("T", " ")}</td>
                  <td>{log.action_type}</td>
                  <td><strong>{log.credits_used}</strong></td>
                  <td>
                    {log.cached ? <span className="badge badge--info">Cache</span>
                    : log.success ? <span className="badge badge--ok">OK</span>
                    : <span className="badge badge--err">Échec</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <div className="ai-safety-note">
        <AlertTriangle size={14} /> Analyse IA à vérifier par le médecin. Aucun diagnostic ou prescription automatique.
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
              Impossible de démarrer le serveur. Relancez l'application.
            </div>
            <button className="backend-splash__retry" onClick={() => window.location.reload()}>
              Réessayer
            </button>
          </>
        ) : (
          <div className="backend-splash__loader">
            <div className="backend-splash__bar" />
          </div>
        )}
        <p className="backend-splash__hint">
          {failed ? "Erreur de démarrage" : "Démarrage du serveur médical…"}
        </p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════
// Patient Directory — compact 2-column layout, fast & doctor-friendly
// ════════════════════════════════════════════════════════════════════════
function PatientDirectory({
  patients, total, displayedTotal, search, setSearch,
  offset, pageSize, hasMore, onNext, onPrev,
  onOpen, onOpenWithTab, onNewPatient, fullname,
}) {
  const [filter, setFilter] = useState("all");
  const [previewId, setPreviewId] = useState(null);
  const searchRef = useRef(null);

  // Keyboard shortcuts: "/" focus search, Escape clears, Enter opens first
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea" || e.target?.isContentEditable;
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setSearch(""); searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setSearch]);

  // Risk classification (client-side, no API change)
  function computeRisk(p) {
    if (!p) return null;
    const age = Number(p.age) || 0;
    const hasDisease = !!(p.maladies && String(p.maladies).trim());
    const hasAllergy = !!(p.allergies && String(p.allergies).trim());
    if (age >= 75 || (age >= 65 && hasDisease)) return { level: "high",   label: "🔴 À risque",  color: "#dc2626", bg: "#fef2f2" };
    if (age >= 60 || hasDisease)                  return { level: "medium", label: "🟠 Surveillance", color: "#d97706", bg: "#fffbeb" };
    if (hasAllergy)                                return { level: "low",    label: "🟡 Allergie",   color: "#ca8a04", bg: "#fefce8" };
    return null;
  }

  function isToday(iso) {
    if (!iso) return false;
    const d = new Date(iso);
    if (isNaN(d)) return false;
    const t = new Date();
    return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
  }
  function isOld(iso) {
    if (!iso) return true;
    const d = new Date(iso);
    if (isNaN(d)) return true;
    return (Date.now() - d.getTime()) > 365 * 24 * 3600 * 1000;
  }
  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d)) return String(iso).slice(0, 10);
    return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  }
  function initials(p) {
    return ((p.prenom?.[0] || "") + (p.nom?.[0] || "")).toUpperCase() || "?";
  }
  const AVATAR_PALETTE = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16", "#ef4444", "#6366f1", "#14b8a6"];
  function avatarColor(p) {
    const k = (p.id || 0) + ((p.nom || "").charCodeAt(0) || 0);
    return AVATAR_PALETTE[k % AVATAR_PALETTE.length];
  }

  const FILTERS = [
    { id: "all",      label: "Tous",                emoji: "👥" },
    { id: "today",    label: "Aujourd'hui",         emoji: "📅" },
    { id: "risk",     label: "À risque",            emoji: "⚠️" },
    { id: "no_phone", label: "Sans téléphone",      emoji: "📵" },
    { id: "old",      label: "Visite ancienne",     emoji: "⏰" },
  ];

  const filtered = patients.filter(p => {
    if (filter === "today")    return isToday(p.last_visit);
    if (filter === "risk")     return !!computeRisk(p) && computeRisk(p).level !== "low";
    if (filter === "no_phone") return !p.telephone;
    if (filter === "old")      return isOld(p.last_visit);
    return true;
  });

  const preview = patients.find(p => p.id === previewId) || null;
  const currentPage = Math.floor(offset / pageSize) + 1;
  const totalPages = Math.max(1, Math.ceil((displayedTotal || 0) / pageSize));

  function handleSearchKey(e) {
    if (e.key === "Enter" && filtered[0]) onOpen(filtered[0].id);
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#fafbfc" }}>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ padding: "14px 20px 10px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
              <span>👥</span> Annuaire des Patients
            </h1>
            <p style={{ margin: "2px 0 0", fontSize: 11.5, color: "#64748b" }}>
              {total} dossiers · {filtered.length} affichés{search ? ` · "${search}"` : ""}
            </p>
          </div>
          <button onClick={onNewPatient}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: "0 1px 2px rgba(59,130,246,.2)" }}>
            <Plus size={15} /> Nouveau Patient
          </button>
        </div>

        {/* Search bar */}
        <div style={{ position: "relative", marginBottom: 10 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleSearchKey}
            placeholder='Rechercher par nom, prénom, téléphone, code…  (appuyez sur "/" pour focus)'
            style={{ width: "100%", padding: "9px 36px 9px 36px", fontSize: 13, border: "1px solid #d1d5db", borderRadius: 8, outline: "none", background: "#fff", color: "#0f172a", boxSizing: "border-box" }}
            onFocus={e => e.target.style.borderColor = "#3b82f6"}
            onBlur={e => e.target.style.borderColor = "#d1d5db"}
          />
          {search && (
            <button onClick={() => setSearch("")} title="Effacer (Échap)"
              style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", background: "#f1f5f9", border: "none", borderRadius: 6, padding: "3px 5px", cursor: "pointer", display: "flex", alignItems: "center", color: "#64748b" }}>
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filter pills */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                padding: "5px 11px", fontSize: 11.5, fontWeight: 600,
                border: filter === f.id ? "1px solid #3b82f6" : "1px solid #e5e7eb",
                background: filter === f.id ? "#eff6ff" : "#fff",
                color: filter === f.id ? "#1d4ed8" : "#475569",
                borderRadius: 999, cursor: "pointer", transition: "all .12s",
              }}>
              <span>{f.emoji}</span>{f.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── 2-column body ────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "grid", gridTemplateColumns: preview ? "1fr 320px" : "1fr", gap: 0, overflow: "hidden", minHeight: 0 }}>
        {/* List */}
        <div style={{ overflowY: "auto", padding: "8px 16px 16px" }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Aucun patient trouvé</div>
              <div style={{ fontSize: 12, marginBottom: 14 }}>{search ? `Aucun résultat pour "${search}"` : "La liste est vide"}</div>
              <button onClick={onNewPatient}
                style={{ padding: "8px 16px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Plus size={14} /> Nouveau patient
              </button>
            </div>
          ) : (
            <>
              {filtered.map(p => {
                const risk = computeRisk(p);
                const isSelected = previewId === p.id;
                const color = avatarColor(p);
                return (
                  <div key={p.id}
                    onClick={() => setPreviewId(p.id)}
                    onDoubleClick={() => onOpen(p.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10,
                      padding: "9px 12px", marginBottom: 4,
                      background: isSelected ? "#eff6ff" : "#fff",
                      border: `1px solid ${isSelected ? "#bfdbfe" : "#e5e7eb"}`,
                      borderRadius: 8, cursor: "pointer", transition: "all .1s",
                    }}
                    onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "#f8fafc"; }}
                    onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = "#fff"; }}
                  >
                    {/* Avatar */}
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                      {initials(p)}
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {p.sexe === "F" ? "👩" : p.sexe === "M" ? "👨" : "👤"} {correctName(p.nom, p.prenom).nom} {correctName(p.nom, p.prenom).prenom}
                        </span>
                        {risk && (
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: risk.bg, color: risk.color, whiteSpace: "nowrap" }}>
                            {risk.label}
                          </span>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 10, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
                        <span>🆔 {p.code || `#${p.id}`}</span>
                        <span>🎂 {p.age || "?"} ans</span>
                        {p.telephone ? <span>📞 {p.telephone}</span> : <span style={{ color: "#cbd5e1" }}>📵 Sans tél.</span>}
                        <span>📅 {fmtDate(p.last_visit)}</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button onClick={() => onOpen(p.id)} title="Voir le dossier"
                        style={{ padding: "5px 10px", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        👁 Voir
                      </button>
                      <button onClick={() => onOpenWithTab(p.id, "new-visit")} title="Nouvelle visite"
                        style={{ padding: "5px 10px", background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        ➕ Visite
                      </button>
                      <button onClick={() => onOpenWithTab(p.id, "templates")} title="Ordonnance"
                        style={{ padding: "5px 10px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}>
                        💊 Ordo.
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Pagination */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px", borderTop: "1px solid #e5e7eb", marginTop: 6 }}>
                <span style={{ fontSize: 11.5, color: "#64748b" }}>
                  Page {currentPage} / {totalPages} · {pageSize} par page
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={onPrev} disabled={offset === 0}
                    style={{ padding: "6px 12px", background: offset === 0 ? "#f1f5f9" : "#fff", color: offset === 0 ? "#cbd5e1" : "#475569", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: offset === 0 ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <ChevronLeft size={13} /> Précédent
                  </button>
                  <button onClick={onNext} disabled={!hasMore}
                    style={{ padding: "6px 12px", background: !hasMore ? "#f1f5f9" : "#fff", color: !hasMore ? "#cbd5e1" : "#475569", border: "1px solid #e5e7eb", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: !hasMore ? "not-allowed" : "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    Suivant <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Preview panel */}
        {preview && (
          <aside style={{ background: "#fff", borderLeft: "1px solid #e5e7eb", padding: "14px 16px", overflowY: "auto" }}>
            <button onClick={() => setPreviewId(null)} title="Fermer"
              style={{ float: "right", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 2 }}>
              <X size={14} />
            </button>
            <div style={{ width: 56, height: 56, borderRadius: "50%", background: avatarColor(preview), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, marginBottom: 10 }}>
              {initials(preview)}
            </div>
            <h3 style={{ margin: "0 0 2px", fontSize: 15, fontWeight: 700, color: "#0f172a" }}>
              {preview.sexe === "F" ? "👩" : preview.sexe === "M" ? "👨" : "👤"} {fullname(preview)}
            </h3>
            <p style={{ margin: "0 0 10px", fontSize: 11.5, color: "#64748b" }}>
              🆔 {preview.code || `#${preview.id}`}
            </p>

            {(() => { const r = computeRisk(preview); return r && (
              <div style={{ background: r.bg, color: r.color, padding: "5px 9px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, marginBottom: 10, display: "inline-block" }}>
                {r.label}
              </div>
            ); })()}

            <div style={{ display: "grid", gap: 6, marginBottom: 14, fontSize: 12 }}>
              <div><span style={{ color: "#64748b" }}>🎂 Âge :</span> <strong>{preview.age || "?"} ans</strong></div>
              <div><span style={{ color: "#64748b" }}>📞 Tél. :</span> <strong>{preview.telephone || "—"}</strong></div>
              <div><span style={{ color: "#64748b" }}>📅 Dern. visite :</span> <strong>{fmtDate(preview.last_visit)}</strong></div>
              <div><span style={{ color: "#64748b" }}>🩺 Visites :</span> <strong>{preview.visit_count || 0}</strong></div>
              {preview.adresse && <div><span style={{ color: "#64748b" }}>🏠 Adresse :</span> <strong>{preview.adresse}</strong></div>}
            </div>

            {preview.allergies && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "7px 10px", marginBottom: 8, fontSize: 11.5 }}>
                <strong style={{ color: "#991b1b" }}>⚠️ Allergies :</strong> <span style={{ color: "#7f1d1d" }}>{preview.allergies}</span>
              </div>
            )}
            {preview.maladies && (
              <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 6, padding: "7px 10px", marginBottom: 8, fontSize: 11.5 }}>
                <strong style={{ color: "#92400e" }}>🩹 Antécédents :</strong> <span style={{ color: "#78350f" }}>{preview.maladies}</span>
              </div>
            )}
            {preview.notes && (
              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, padding: "7px 10px", marginBottom: 12, fontSize: 11.5 }}>
                <strong style={{ color: "#075985" }}>📝 Notes :</strong> <span style={{ color: "#0c4a6e" }}>{preview.notes}</span>
              </div>
            )}

            <div style={{ display: "grid", gap: 6 }}>
              <button onClick={() => onOpen(preview.id)}
                style={{ padding: "9px 12px", background: "#3b82f6", color: "#fff", border: "none", borderRadius: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                📂 Ouvrir le dossier
              </button>
              <button onClick={() => onOpenWithTab(preview.id, "new-visit")}
                style={{ padding: "8px 12px", background: "#f0fdf4", color: "#15803d", border: "1px solid #bbf7d0", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                ➕ Nouvelle visite
              </button>
              <button onClick={() => onOpenWithTab(preview.id, "templates")}
                style={{ padding: "8px 12px", background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                💊 Ordonnance
              </button>
              <button onClick={() => onOpenWithTab(preview.id, "documents")}
                style={{ padding: "8px 12px", background: "#f5f3ff", color: "#6d28d9", border: "1px solid #ddd6fe", borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                📱 QR Upload
              </button>
            </div>
          </aside>
        )}
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
  const [patientHasMore, setPatientHasMore] = useState(false);
  const [patientOffset, setPatientOffset] = useState(0);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [creatingPatient, setCreatingPatient] = useState(false);
  const [detail, setDetail] = useState(null);
  const [patientForm, setPatientForm] = useState(blankPatient);
  const [visit, setVisit] = useState(blankVisit);
  const [search, setSearch] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [page, setPage] = useState("patients");
  const [patientSection, setPatientSection] = useState("dossier");
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

  // ── Auto-save for EXISTING patients ──
  // Silently persists changes 1.5s after the doctor stops typing, so switching
  // patients never loses data. Skipped for new (unsaved) patients to avoid
  // creating empty rows.
  const autoSaveSnapshotRef = useRef(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState(""); // "saving" | "saved" | ""
  useEffect(() => {
    if (!selectedPatient?.id) return;
    if (creatingPatient) return;
    if (!patientForm?.nom || !patientForm?.prenom) return;
    if (autoSaveSnapshotRef.current?.id !== selectedPatient.id) {
      autoSaveSnapshotRef.current = { id: selectedPatient.id, snapshot: JSON.stringify(patientForm) };
      return;
    }
    if (JSON.stringify(patientForm) === autoSaveSnapshotRef.current.snapshot) return;
    setAutoSaveStatus("saving");
    const timer = setTimeout(async () => {
      try {
        const calculatedAge = calculateAgeFromBirthDate(patientForm.date_naissance);
        const payload = { ...patientForm, age: calculatedAge ? Number(calculatedAge) : (patientForm.age ? Number(patientForm.age) : null) };
        await api.updatePatient(selectedPatient.id, payload);
        autoSaveSnapshotRef.current = { id: selectedPatient.id, snapshot: JSON.stringify(patientForm) };
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus(""), 1500);
      } catch (_) {
        setAutoSaveStatus("");
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [patientForm, selectedPatient?.id, creatingPatient]);

  // ── Visit draft persistence per patient ──
  // Restore on patient switch; save to localStorage on every keystroke so
  // a half-typed visit is never lost when the doctor navigates away.
  const visitDraftPatientRef = useRef(null);
  useEffect(() => {
    if (!selectedPatient?.id) {
      visitDraftPatientRef.current = null;
      return;
    }
    if (visitDraftPatientRef.current === selectedPatient.id) return;
    visitDraftPatientRef.current = selectedPatient.id;
    try {
      const raw = localStorage.getItem(`ms_visit_draft_${selectedPatient.id}`);
      if (raw) setVisit({ ...blankVisit, ...JSON.parse(raw) });
      else setVisit(blankVisit);
    } catch (_) { setVisit(blankVisit); }
  }, [selectedPatient?.id]);
  useEffect(() => {
    if (!selectedPatient?.id) return;
    const isEmpty = !visit.motif?.trim() && !visit.diagnostics?.trim() && !visit.tension && !visit.poids;
    try {
      if (isEmpty) localStorage.removeItem(`ms_visit_draft_${selectedPatient.id}`);
      else localStorage.setItem(`ms_visit_draft_${selectedPatient.id}`, JSON.stringify(visit));
    } catch (_) {}
  }, [visit, selectedPatient?.id]);

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
        : `Backup local cree: ${result.file_path}. Configurez le dossier Google Drive dans Paramètres.`;
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
    if (user && backendReady) {
      load();
      api.doctorProfile().then(setDoctorProfile).catch(() => {});
    }
  }, [user, backendReady]);

  useEffect(() => {
    if (!user) return;
    setPatientOffset(0);
    const timer = setTimeout(() => api.patients(search, DIRECTORY_PAGE_SIZE, 0).then((data) => {
      const rows = data.rows || [];
      setPatients(rows);
      setPatientTotal(data.filtered_total ?? data.total ?? rows.length);
      setPatientHasMore(data.has_more ?? false);
      setPatientOffset(0);
    }).catch((err) => setError(err.message)), 200);
    return () => clearTimeout(timer);
  }, [search, user]);

  async function loadMorePatients() {
    try {
      const data = await api.patients(search, DIRECTORY_PAGE_SIZE, patientOffset);
      const newRows = data.rows || [];
      setPatients(prev => {
        const ids = new Set(prev.map(p => p.id));
        return [...prev, ...newRows.filter(p => !ids.has(p.id))];
      });
      setPatientTotal(data.filtered_total ?? data.total ?? 0);
      setPatientHasMore(data.has_more ?? false);
      setPatientOffset(prev => prev + newRows.length);
    } catch (e) { setError(e.message); }
  }

  // Page-based navigation for the new directory (replaces the page entirely)
  async function loadPatientPage(newOffset) {
    try {
      const safe = Math.max(0, newOffset);
      const data = await api.patients(search, DIRECTORY_PAGE_SIZE, safe);
      const rows = data.rows || [];
      setPatients(rows);
      setPatientTotal(data.filtered_total ?? data.total ?? rows.length);
      setPatientHasMore(data.has_more ?? false);
      setPatientOffset(safe);
    } catch (e) { setError(e.message); }
  }
  function nextPatientPage() {
    if (patientHasMore) loadPatientPage(patientOffset + DIRECTORY_PAGE_SIZE);
  }
  function prevPatientPage() {
    if (patientOffset > 0) loadPatientPage(Math.max(0, patientOffset - DIRECTORY_PAGE_SIZE));
  }
  function openPatientWithTab(patientId, tabId) {
    openPatient(patientId);
    if (!tabId) return;
    const sectionMap = {
      templates: "ordonnance",
      template: "ordonnance",
      docs: "internet",
      settings: "dossier",
      profile: "dossier",
      reglement: "caisse",
    };
    setActiveTab(tabId);
    if (sectionMap[tabId]) setPatientSection(sectionMap[tabId]);
  }

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
    setVisit(blankVisit);
    setAiWarnings(null);
    setPatientSection("dossier");
    setActiveTab("profile");
    setPage("patients");
  }

  function openPatient(patientId) {
    setCreatingPatient(false);
    setPatientConflict(null);
    setSelectedId(patientId);
    setPatientSection("dossier");
    setPage("patients");
    setActiveTab("profile");
  }

  function openPatientDirectory() {
    setCreatingPatient(false);
    setPatientConflict(null);
    setSelectedId(null);
    setDetail(null);
    setPatientForm(blankPatient);
    setVisit(blankVisit);
    setPatientSection("dossier");
    setPage("patients-list");
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
      try { localStorage.removeItem(`ms_visit_draft_${selectedPatient.id}`); } catch (_) {}
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

  async function removeDiagnosis(diagnosisId) {
    if (!selectedPatient?.id) return;
    if (!window.confirm("Supprimer ce diagnostic ?")) return;
    try {
      await api.deleteDiagnosis(selectedPatient.id, diagnosisId);
      await refreshPatient(selectedPatient.id);
      setDashboard(await api.dashboard());
    } catch (e) {
      alert("Suppression \u00e9chou\u00e9e : " + e.message);
    }
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
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", fontFamily: "inherit" }}>

      {/* ═══ TOP BAR ═══ */}
      <header style={{ display: "flex", alignItems: "stretch", height: 58, flexShrink: 0, background: "#ffffff", borderBottom: "1px solid #dde3ef", boxShadow: "0 1px 4px rgba(0,0,0,.06)", zIndex: 200, position: "relative" }}>
        {/* Brand — MediSmart Pro + The Doctor Edition (matches screenshot) */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 18px", minWidth: 192, borderRight: "1px solid #dde3ef", flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #1d4ed8, #2563eb)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Heart size={15} color="#fff" fill="#fff" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", letterSpacing: "-.01em", lineHeight: 1.2 }}>MediSmart Pro</div>
            <div style={{ fontSize: 9.5, color: "#64748b", fontWeight: 500 }}>The Doctor Edition</div>
          </div>
        </div>
        {/* Page tabs */}
        <nav style={{ display: "flex", alignItems: "stretch", flex: 1, overflow: "hidden" }}>
          {[
            { id: "patients-list",     label: "LISTE DES PATIENTS",       sub: "Recherche & Gestion",   icon: Users },
            { id: "patients-today",    label: "PATIENTS VUS AUJOURD'HUI", sub: "Liste & Encaissements", icon: Stethoscope },
            { id: "appointments-page", label: "RENDEZ-VOUS",              sub: "Agenda & planning",     icon: CalendarDays },
            { id: "settings-nav",      label: "CONFIGURATION",            sub: "Paramètres du système", icon: Settings },
          ].map(({ id, label, sub, icon: Icon }) => {
            const otherPages = ["patients-today","appointments-page","settings-nav","dashboard","analytics","finance-page","medicines-nav","ai-credits","import-legacy","patients-list"];
            const isActive = page === id || (id === "patients-list" && page === "patients-list");
            return (
              <button key={id} onClick={() => handleNavClick(id)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", border: "none", background: "transparent", borderBottom: `3px solid ${isActive ? "#2563eb" : "transparent"}`, borderRight: "1px solid #f1f5f9", color: isActive ? "#1e40af" : "#64748b", cursor: "pointer", textAlign: "left", transition: "color .15s", flexShrink: 0 }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f8fafc"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <Icon size={14} />
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".35px", whiteSpace: "nowrap" }}>{label}</div>
                  <div style={{ fontSize: 9, opacity: .65 }}>{sub}</div>
                </div>
              </button>
            );
          })}
        </nav>
        {/* Right: backup + logout */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", borderLeft: "1px solid #dde3ef", flexShrink: 0, position: "relative" }}>
          <button onClick={runBackup} title="Sauvegarde" style={{ display: "inline-flex", alignItems: "center", padding: "5px 9px", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, color: "#64748b", cursor: "pointer", flexShrink: 0 }}>
            <DatabaseBackup size={13} />
          </button>
          <button onClick={() => { localStorage.removeItem("cardio-user"); setUser(null); }} title="Deconnexion" style={{ padding: "5px 7px", background: "none", border: "1px solid #e2e8f0", borderRadius: 6, color: "#94a3b8", cursor: "pointer", lineHeight: 0 }}>
            <LogOut size={13} />
          </button>
        </div>
      </header>

      {/* ═══ BODY ═══ */}
      <div style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
        {/* Dark sidebar */}
        <aside style={{ width: 162, flexShrink: 0, background: "#152347", display: "flex", flexDirection: "column", overflowY: "auto", overflowX: "hidden" }}>

          {/* ── Compact Quitter dossier button (only in patient mode) ── */}
          {selectedPatient && (
            <div style={{ padding: "8px 10px", flexShrink: 0 }}>
              <button onClick={() => { openPatientDirectory(); }}
                style={{ width: "100%", padding: "6px 0", background: "rgba(239,68,68,.18)", border: "1px solid rgba(239,68,68,.35)", borderRadius: 6, color: "#fca5a5", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <LogOut size={11} /> Quitter dossier
              </button>
            </div>
          )}

          {/* ── Nav items ── two distinct sidebars depending on context */}
          {(() => {
            const inPatientMode = Boolean(selectedId || creatingPatient);

            // GENERAL SIDEBAR — Finance removed (all data on Analytics); Dashboard removed too
            const generalNav = [
              { label: "ANALYTICS",       sub: "Statistiques du cabinet", icon: BarChart3,       route: "analytics"     },
              { label: "BASE MÉDICAMENTS",sub: "Référentiel produits",   icon: BookOpen,        route: "medicines-nav" },
              { label: "AI & CRÉDITS",    sub: "IA et abonnement",       icon: Bot,             route: "ai-credits"    },
              { label: "IMPORT DATABASE", sub: "Ancienne base SQL",      icon: Upload,          route: "import-legacy" },
              { label: "CONFIGURATION",   sub: "Modèles & ordonnances",  icon: Settings,        route: "settings-nav"  },
            ];

            // PATIENT SIDEBAR — matches screenshot exactly (9 items, INTERNET included)
            const patientNav = [
              { label: "DOSSIER",      sub: "Fiche patient",            icon: FolderOpen,   psec: "dossier"     },
              { label: "ORDONNANCE",   sub: "Gestion ordonnances",      icon: Pill,         psec: "ordonnance"  },
              { label: "EXPLORATIONS", sub: "Examens & analyses",       icon: FlaskConical, psec: "explorations"},
              { label: "COURRIERS",    sub: "Courriers médicaux",       icon: Send,         psec: "courriers"   },
              { label: "HISTORIQUE",   sub: "Antécédents & historique", icon: Clock,        psec: "historique"  },
              { label: "RENDEZ-VOUS",  sub: "Rendez-vous patient",      icon: CalendarDays, psec: "rendezvous"  },
              { label: "CAISSE",       sub: "Gestion financière",       icon: CreditCard,   psec: "caisse"      },
              { label: "INTERNET",     sub: "Ressources médicales",     icon: Globe,        psec: "internet"    },
              { label: "STATISTIQUES", sub: "Rapports & statistiques",  icon: BarChart3,    psec: "stats"       },
            ];

            const items = inPatientMode ? patientNav : generalNav;

            return items.map((item, idx) => {
              if (item.section) {
                return (
                  <div key={`s-${idx}`} style={{ padding: "12px 12px 4px", fontSize: 8.5, fontWeight: 800, letterSpacing: ".7px", color: "rgba(255,255,255,.4)" }}>
                    {item.section}
                  </div>
                );
              }
              const { label, sub, icon: Icon, route, psec } = item;
              const isAct = inPatientMode ? patientSection === psec : page === route;
              return (
                <button key={`${idx}-${label}`}
                  onClick={() => {
                    if (inPatientMode) {
                      setPatientSection(psec);
                      setPage("patients");
                    } else {
                      handleNavClick(route);
                    }
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 11px", width: "100%", border: "none", background: isAct ? "#2563eb" : "transparent", borderLeft: `3px solid ${isAct ? "#60a5fa" : "transparent"}`, color: isAct ? "#ffffff" : "#a5b4d0", cursor: "pointer", textAlign: "left", transition: "background .15s, color .15s" }}
                  onMouseEnter={e => { if (!isAct) { e.currentTarget.style.background = "rgba(255,255,255,.08)"; e.currentTarget.style.color = "#fff"; } }}
                  onMouseLeave={e => { if (!isAct) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#a5b4d0"; } }}
                >
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".35px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
                    <div style={{ fontSize: 9, opacity: .65, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}>{sub}</div>
                  </div>
                </button>
              );
            });
          })()}

          <div style={{ marginTop: "auto", padding: "8px", borderTop: "1px solid rgba(255,255,255,.1)" }}>
            <button onClick={() => { localStorage.removeItem("cardio-user"); setUser(null); }}
              style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "7px 8px", background: "none", border: "1px solid rgba(255,255,255,.15)", borderRadius: 6, color: "#a5b4d0", fontSize: 10.5, cursor: "pointer", fontWeight: 600 }}>
              <LogOut size={12} /> Déconnexion
            </button>
          </div>
        </aside>

        {/* ── MAIN ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f0f4f8", minWidth: 0 }}>
          {backupMessage && <div className="soft-ok topbar-feedback">{backupMessage}</div>}
          {error && <div className="soft-error topbar-feedback">{error}</div>}
          {autoSaveStatus && (
            <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 9000, background: autoSaveStatus === "saving" ? "#1d4ed8" : "#16a34a", color: "#fff", padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 600, boxShadow: "0 4px 12px rgba(0,0,0,.2)", display: "flex", alignItems: "center", gap: 6 }}>
              {autoSaveStatus === "saving" ? "Enregistrement…" : "✓ Enregistré"}
            </div>
          )}
        {(page === "dashboard" || page === "analytics") && <AnalyticsHub dashboard={dashboard} onNav={handleNavClick} />}
        {page === "appointments-page" && (
          <AppointmentsPageV2
            patients={patients}
            onSaveAppointment={saveAppointment}
            onOpenPatient={(id) => openPatient(id)}
          />
        )}
        {page === "patients-today" && (
          <TodayPatientsPage
            onOpenPatient={(id) => openPatient(id)}
            onOpenWithTab={openPatientWithTab}
          />
        )}
        {page === "finance-page" && <FinancePage />}

        {page === "medicines-nav" && (
          <div className="directory-page">
            <header className="directory-header">
              <div className="directory-title">
                <h1>Base des médicaments</h1>
                <p>Consultez le référentiel thérapeutique du logiciel et maintenez les fiches à jour.</p>
              </div>
            </header>
            <MedicineDatabasePanel />
          </div>
        )}

        {page === "ai-credits" && <AICreditsPage />}

        {page === "doctors-page" && <DoctorsPage />}
        {page === "diagnostic-page" && <DiagnosticPage />}

        {page === "import-legacy" && (
          <div className="directory-page" style={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
            <ImportWizardPanel />
          </div>
        )}

        {page === "settings-nav" && (
          <ConfigurationPage
            specialityId={specialityId}
            setSpecialityId={setSpecialityId}
            uploadMode={uploadMode}
            refreshUploadMode={refreshUploadMode}
          />
        )}
        
        {/* Patient Section: Toggle between Directory and Dossier */}
        {/* Patient List Page (separate page via top nav) */}
        {page === "patients-list" && (
          <PatientsListPage
            patients={patients}
            total={patientTotal}
            search={search}
            setSearch={setSearch}
            offset={patientOffset}
            pageSize={DIRECTORY_PAGE_SIZE}
            hasMore={patientHasMore}
            onNext={nextPatientPage}
            onPrev={prevPatientPage}
            onOpen={openPatient}
            onOpenWithTab={openPatientWithTab}
            onNewPatient={startNewPatient}
          />
        )}

        {/* Dossier / PatientWorkstation (default screen) */}
        {(page === "patients" || (page !== "dashboard" && page !== "patients-list" && page !== "appointments-page" && page !== "patients-today" && page !== "finance-page" && page !== "medicines-nav" && page !== "ai-credits" && page !== "import-legacy" && page !== "settings-nav" && page !== "analytics" && page !== "doctors-page" && page !== "diagnostic-page")) && (
          <PatientWorkstation
            patient={selectedPatient}
            detail={detail}
            patientForm={patientForm}
            setPatientForm={setPatientForm}
            saving={saving}
            onSavePatient={savePatient}
            onDeletePatient={deletePatient}
            onBackToDirectory={() => { openPatientDirectory(); }}
            visit={visit}
            setVisit={setVisit}
            onSaveVisit={saveVisit}
            onDictate={dictateToVisit}
            onRefreshPatient={() => selectedPatient?.id ? refreshPatient(selectedPatient.id) : null}
            onNewPatient={startNewPatient}
            uploadMode={uploadMode}
            specialityConfig={specialityConfig}
            medications={medications}
            appointments={appointments}
            onSaveAppointment={saveAppointment}
            onSavePrescription={savePrescription}
            onUpload={uploadDocument}
            onSaveDocumentNotes={saveDocumentNotes}
            onSaveCardioProfile={saveCardioProfile}
            onSaveVitals={saveVitals}
            onSaveLabs={saveLabs}
            onSaveEcg={saveEcg}
            onSaveImaging={saveImaging}
            onSaveDiagnosis={saveDiagnosis}
            onDeleteDiagnosis={removeDiagnosis}
            onAutoFollowup={autoFollowup}
            section={patientSection}
            embeddedPanels={{
              ordonnance:   <DocumentTemplatesPanel patient={selectedPatient} defaultCategory="ordonnance" allowedCategories={["ordonnance"]} />,
              explorations: <ImagingLabsPanelV2 patient={selectedPatient} cardio={detail?.cardio} onSaveImaging={saveImaging} onSaveLabs={saveLabs} />,
              courriers:    <DocumentTemplatesPanel patient={selectedPatient} defaultCategory="certificat" allowedCategories={["certificat", "rapport"]} />,
              comptes:      <DocumentTemplatesPanel patient={selectedPatient} defaultCategory="rapport" allowedCategories={["rapport"]} />,
              historique:   <Timeline detail={detail} />,
              rendezvous:   <FollowupPanel patient={selectedPatient} cardio={detail?.cardio} appointments={appointments} onAutoFollowup={autoFollowup} onSaveAppointment={saveAppointment} />,
              reglement:    <ReglementPanelV2 patient={selectedPatient} />,
              caisse:       <CaisseHistoryPanel patient={selectedPatient} />,
              internet:     <DocumentsPanel patient={selectedPatient} detail={detail} onUpload={uploadDocument} onSaveNotes={saveDocumentNotes} uploadMode={uploadMode} onFillVisit={(data) => setVisit(v => ({...v, ...data}))} onRefreshPatient={() => refreshPatient(selectedPatient.id)} />,
              qr:           <DocumentsPanel patient={selectedPatient} detail={detail} onUpload={uploadDocument} onSaveNotes={saveDocumentNotes} uploadMode={uploadMode} onFillVisit={(data) => setVisit(v => ({...v, ...data}))} onRefreshPatient={() => refreshPatient(selectedPatient.id)} />,
              photos:       <DocumentsPanel patient={selectedPatient} detail={detail} onUpload={uploadDocument} onSaveNotes={saveDocumentNotes} uploadMode={uploadMode} onFillVisit={(data) => setVisit(v => ({...v, ...data}))} onRefreshPatient={() => refreshPatient(selectedPatient.id)} mediaOnly />,
              antecedents:  <AntecedentsContentPanel patient={selectedPatient} form={patientForm} setForm={setPatientForm} saving={saving} onSave={savePatient} />,
              ai:           <AIPanel patient={selectedPatient} aiWarnings={aiWarnings} onCheck={aiCheck} specialityConfig={specialityConfig} />,
              stats:        <PatientQuickStats patient={selectedPatient} detail={detail} />,
            }}
          />
        )}
        </main>
      </div>
    </div>
  );
}
