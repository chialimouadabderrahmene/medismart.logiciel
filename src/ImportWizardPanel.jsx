import React, { useState, useRef } from "react";
import {
  Upload, Database, ArrowRight, ArrowLeft, Eye,
  AlertTriangle, CheckCircle2, XCircle, Download,
  Loader2, FileText, Server, RotateCcw, ClipboardList,
  Table2, Info
} from "lucide-react";

const API = window.__TAURI__ ? "" : "http://127.0.0.1:8000";

async function apiCall(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: opts.body && !(opts.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {},
    ...opts,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || res.statusText);
  }
  return res.json();
}

// ── Field schemas ────────────────────────────────────────────────────────────
const PATIENT_FIELDS = [
  { key: "code",              label: "Code patient",            required: false },
  { key: "nom",               label: "Nom",                     required: true  },
  { key: "prenom",            label: "Prénom",                  required: true  },
  { key: "date_naissance",    label: "Date de naissance",       required: false },
  { key: "age",               label: "Âge",                     required: false },
  { key: "sexe",              label: "Sexe",                    required: false },
  { key: "telephone",         label: "Téléphone",               required: false },
  { key: "adresse",           label: "Adresse",                 required: false },
  { key: "profession",        label: "Profession",              required: false },
  { key: "allergies",         label: "Allergies",               required: false },
  { key: "maladies",          label: "Antécédents / Maladies",  required: false },
  { key: "notes_importantes", label: "Notes importantes",       required: false },
];

const VISIT_FIELDS = [
  { key: "patient_code", label: "Code patient (liaison)", required: true  },
  { key: "date_visite",  label: "Date de visite",         required: false },
  { key: "motif",        label: "Motif",                  required: false },
  { key: "diagnostics",  label: "Diagnostic",             required: false },
  { key: "traitements",  label: "Traitement",             required: false },
  { key: "histoire",     label: "Observation / Histoire", required: false },
];

const APPOINTMENT_FIELDS = [
  { key: "patient_code", label: "Code patient (liaison)", required: true  },
  { key: "scheduled_at", label: "Date & heure RDV",       required: false },
  { key: "title",        label: "Motif / Titre",          required: false },
  { key: "status",       label: "Statut",                 required: false },
  { key: "notes",        label: "Notes",                  required: false },
];

const MEDICATION_FIELDS = [
  { key: "brand_name",      label: "Nom commercial",          required: true  },
  { key: "dci",             label: "DCI / Générique",          required: false },
  { key: "dosage_strength", label: "Dosage",                  required: false },
  { key: "form",            label: "Forme (cp, ml…)",         required: false },
  { key: "category",        label: "Catégorie thérapeutique",  required: false },
  { key: "route",           label: "Voie d'administration",   required: false },
];

const PAYMENT_FIELDS = [
  { key: "patient_code",  label: "Code patient (liaison)", required: true  },
  { key: "date_paiement", label: "Date paiement",          required: false },
  { key: "montant",       label: "Montant total (DA)",     required: false },
  { key: "paye",          label: "Montant payé (DA)",      required: false },
  { key: "mode_paiement", label: "Mode de paiement",      required: false },
];

// ── Alias dictionary for smarter auto-mapping ─────────────────────────────────
const FIELD_ALIASES = {
  nom:              ["nom","name","patient_name","lastname","last_name","surname","family_name","patientnom"],
  prenom:           ["prenom","firstname","first_name","fname","prenoms","given_name"],
  telephone:        ["telephone","tel","phone","mobile","gsm","portable","cellphone","numtel"],
  date_naissance:   ["date_naissance","ddn","birthdate","birth_date","datedenaissance","naissance","dob","dateofbirth"],
  age:              ["age"],
  sexe:             ["sexe","sex","gender","genre"],
  adresse:          ["adresse","address","addr","domicile","localite"],
  profession:       ["profession","job","occupation","metier","emploi"],
  allergies:        ["allergies","allergie","allergy","allergies_connues"],
  maladies:         ["maladies","antecedents","maladie","antecedent","chroniques","pathologie","atcd"],
  notes_importantes:["notes","note","observations","remarques","commentaires","notes_importantes"],
  code:             ["code","patient_code","id","patient_id","numero","num","reference","ref","dossier"],
  patient_code:     ["patient_code","code_patient","patient_id","patientid","id_patient","code","num_patient"],
  date_visite:      ["date_visite","date","visit_date","consultation_date","date_consultation","datevisite"],
  motif:            ["motif","reason","chief_complaint","complaint","motif_consultation","reason_for_visit"],
  diagnostics:      ["diagnostics","diagnostic","diagnosis","diag","diagnose","icd"],
  traitements:      ["traitements","traitement","treatment","prescription","therapy","therapie"],
  histoire:         ["histoire","observation","history","anamnese","notes","clinical_notes","hma"],
  scheduled_at:     ["scheduled_at","date","date_rdv","appointment_date","rdv_date","heure","datetime","schedule"],
  title:            ["title","motif","titre","reason","objet","description","subject"],
  status:           ["status","statut","etat","state"],
  brand_name:       ["brand_name","nom","name","medicament","drug","medicine","commercial","specialite","libelle"],
  dci:              ["dci","generic","generique","inn","molecule","principe_actif"],
  dosage_strength:  ["dosage","dosage_strength","strength","concentration","dose","teneur"],
  form:             ["forme","form","galenique","galenic","formulation"],
  route:            ["route","voie","administration","voie_admin"],
  date_paiement:    ["date_paiement","date","payment_date","paid_at","date_facture","date_reglement"],
  montant:          ["montant","amount","total","honoraires","fee","prix","tarif","somme"],
  paye:             ["paye","paid","montant_paye","paid_amount","encaisse","reglement","verse"],
  mode_paiement:    ["mode_paiement","mode","payment_method","type_paiement","moyen_paiement"],
};

// ── Source catalogue ──────────────────────────────────────────────────────────
const FILE_SOURCES = [
  { id: "csv",    label: "CSV",               ext: ".csv",              desc: "Fichier texte séparé par virgules ou point-virgule" },
  { id: "excel",  label: "Excel XLSX / XLS",  ext: ".xlsx,.xls",        desc: "Classeur Microsoft Excel" },
  { id: "sqlite", label: "SQLite",            ext: ".sqlite3,.sqlite,.db", desc: "Base SQLite — copie de sécurité ou export" },
  { id: "json",   label: "JSON / MongoDB",    ext: ".json",             desc: "Export JSON ou dump MongoDB" },
  { id: "access", label: "Access MDB/ACCDB",  ext: ".csv",              desc: "Exportez d'abord en CSV depuis Access (Fichier > Exporter)", note: true },
];

const DB_SOURCES = [
  { id: "mysql",     label: "MySQL / MariaDB",   defaultPort: 3306,  desc: "Serveur MySQL local ou réseau" },
  { id: "postgres",  label: "PostgreSQL",         defaultPort: 5432,  desc: "Serveur PostgreSQL" },
  { id: "sqlserver", label: "SQL Server (ODBC)",  defaultPort: 1433,  desc: "Microsoft SQL Server via pilote ODBC 17" },
];

// ── 7-step wizard ────────────────────────────────────────────────────────────
const STEPS = ["Source", "Connexion", "Tables", "Mapping", "Aperçu/Doublons", "Import", "Rapport"];

// ── Step indicator ────────────────────────────────────────────────────────────
function StepBar({ current }) {
  return (
    <div className="imp-stepbar">
      {STEPS.map((s, i) => (
        <div key={s} className={`imp-step ${i === current ? "imp-step--active" : ""} ${i < current ? "imp-step--done" : ""}`}>
          <div className="imp-step__dot">{i < current ? <CheckCircle2 size={11} /> : i + 1}</div>
          <span className="imp-step__label">{s}</span>
          {i < STEPS.length - 1 && <div className="imp-step__line" />}
        </div>
      ))}
    </div>
  );
}

// ── Mapping row ────────────────────────────────────────────────────────────────
function MappingRow({ field, columns, value, onChange }) {
  return (
    <div className="imp-map-row">
      <div className={`imp-map-field ${field.required ? "imp-map-field--req" : ""}`}>
        {field.label}{field.required && <span className="imp-req">*</span>}
      </div>
      <select className="imp-map-select" value={value || ""} onChange={e => onChange(e.target.value)}>
        <option value="">(ignorer)</option>
        {columns.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
      {value && <span className="imp-map-ok"><CheckCircle2 size={13} /></span>}
    </div>
  );
}

// ── CSV report download helper ────────────────────────────────────────────────
function downloadReportCsv(report) {
  const s = report.summary || {};
  const rows = [
    ["Champ", "Valeur"],
    ["Source", s.source || ""],
    ["Type", s.type || ""],
    ["Simulation", s.dry_run ? "Oui" : "Non"],
    ["Statut", s.status || ""],
    ["Patients importés", s.patients_imported ?? 0],
    ["Patients fusionnés", s.patients_merged ?? 0],
    ["Patients ignorés", s.patients_skipped ?? 0],
    ["Visites importées", s.visits_imported ?? 0],
    ["Erreurs", s.total_errors ?? 0],
    ["Début", s.started || ""],
    ["Fin", s.finished || ""],
  ];
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `import_rapport_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

// ── Main component ────────────────────────────────────────────────────────────
export default function ImportWizardPanel() {
  const [step, setStep] = useState(0);
  const [sourceCategory, setSourceCategory] = useState("file"); // "file" | "db"
  const [sourceType, setSourceType] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [tables, setTables] = useState([]);
  const [columns, setColumns] = useState({});
  const [totals, setTotals] = useState({});
  const [sample, setSample] = useState({});
  const [patientTable, setPatientTable] = useState("");
  const [visitTable, setVisitTable] = useState("");
  const [appointmentTable, setAppointmentTable] = useState("");
  const [medicationTable, setMedicationTable] = useState("");
  const [paymentTable, setPaymentTable] = useState("");
  const [patientMapping, setPatientMapping] = useState({});
  const [patientConf, setPatientConf] = useState({});
  const [visitMapping, setVisitMapping] = useState({});
  const [visitConf, setVisitConf] = useState({});
  const [appointmentMapping, setAppointmentMapping] = useState({});
  const [appointmentConf, setAppointmentConf] = useState({});
  const [medicationMapping, setMedicationMapping] = useState({});
  const [medicationConf, setMedicationConf] = useState({});
  const [paymentMapping, setPaymentMapping] = useState({});
  const [paymentConf, setPaymentConf] = useState({});
  const [mapTab, setMapTab] = useState("patients");
  const [preview, setPreview] = useState(null);
  const [dbForm, setDbForm] = useState({ host: "localhost", port: "3306", user: "", password: "", database: "" });
  const [onDuplicate, setOnDuplicate] = useState("skip");
  const [dryRun, setDryRun] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [report, setReport] = useState(null);
  const [fullReport, setFullReport] = useState(null);
  const [error, setError] = useState("");
  const [jobHistory, setJobHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const fileRef = useRef();
  const gmFileRef = useRef();
  const [gmBusy, setGmBusy] = useState(false);
  const [gmResult, setGmResult] = useState(null);
  const [gmFullBusy, setGmFullBusy] = useState(false);
  const [gmFullResult, setGmFullResult] = useState(null);

  const setErr = (msg) => { setError(msg); setExecuting(false); };
  const go = (n) => { setError(""); setStep(n); };

  // ── Full one-click import from disk ─────────────────────────────────────
  const handleGmFullImport = async () => {
    setGmFullBusy(true); setGmFullResult(null); setError("");
    try {
      const res = await fetch(`${API}/api/import/gestion-medicale-full`, { method: "POST" });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(e.detail || "Erreur");
      }
      setGmFullResult(await res.json());
    } catch (e) { setError(`Import complet échoué: ${e.message}`); }
    setGmFullBusy(false);
  };

  // ── One-click GestionMedicale .sql import (file upload) ──────────────────
  const handleGmSqlUpload = async (file) => {
    if (!file) return;
    setGmBusy(true); setGmResult(null); setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`${API}/api/import/gestion-medicale-sql`, { method: "POST", body: fd });
      if (!res.ok) {
        const e = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(e.detail || "Erreur");
      }
      setGmResult(await res.json());
    } catch (e) { setError(`Import GestionMédicale échoué: ${e.message}`); }
    setGmBusy(false);
  };

  // ── Step 0: choose source ─────────────────────────────────────────────────
  const renderStep0 = () => (
    <div className="imp-card">
      {/* ▼ FULL Import complet depuis disque ─────────────────────────────── */}
      <div style={{ background: "linear-gradient(135deg,#1d4ed8,#1e40af)", color: "#fff", padding: "18px 20px", borderRadius: 12, marginBottom: 14, boxShadow: "0 4px 16px rgba(29,78,216,.35)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 5, display: "flex", alignItems: "center", gap: 8 }}>
              <Database size={18} /> Import COMPLET — GestionMédicale
              <span style={{ fontSize: 10, background: "rgba(255,255,255,.2)", borderRadius: 20, padding: "2px 8px", fontWeight: 700 }}>RECOMMANDÉ</span>
            </div>
            <div style={{ fontSize: 12.5, opacity: 0.92, lineHeight: 1.6 }}>
              Importe <strong>tout</strong> depuis <code style={{ background: "rgba(255,255,255,.15)", padding: "1px 5px", borderRadius: 4 }}>GestionMedicaleDBbackup_09-05-2026.sql</code> déjà présent dans le dossier :
              patients · consultations → visites · RDV · médicaments · antécédents · examens · ordonnances · courriers.
            </div>
          </div>
          <button onClick={handleGmFullImport} disabled={gmFullBusy}
            style={{ background: "#fff", color: "#1d4ed8", border: "none", padding: "11px 20px", borderRadius: 8, fontWeight: 800, fontSize: 13.5, cursor: gmFullBusy ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 2px 8px rgba(0,0,0,.15)", whiteSpace: "nowrap" }}>
            {gmFullBusy ? <><Loader2 size={15} className="imp-spin" /> Import en cours…</> : <><Database size={15} /> Lancer l'import complet</>}
          </button>
        </div>
        {gmFullResult && (
          <div style={{ marginTop: 12, background: "rgba(255,255,255,.15)", padding: "12px 16px", borderRadius: 8, fontSize: 12.5, lineHeight: 1.8 }}>
            <div style={{ fontWeight: 800, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle2 size={14} /> Import terminé — <code style={{ fontWeight: 400 }}>{gmFullResult.sql_file}</code>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 18px" }}>
              <span>👤 <strong>{gmFullResult.patients?.imported}</strong> patients ({gmFullResult.patients?.skipped} déjà présents)</span>
              <span>📋 <strong>{gmFullResult.visits?.imported}</strong> consultations → visites</span>
              <span>📅 <strong>{gmFullResult.appointments?.imported}</strong> RDV</span>
              <span>💊 <strong>{gmFullResult.medicines?.imported}</strong> médicaments (+{gmFullResult.medicines?.updated} enrichis)</span>
              <span>🧪 <strong>{gmFullResult.exams?.attached}</strong> examens rattachés</span>
              <span>📝 <strong>{gmFullResult.ordonnances?.attached}</strong> ordonnances rattachées</span>
              <span>✉ <strong>{gmFullResult.courriers?.imported}</strong> courriers</span>
              {gmFullResult.antecedents?.updated > 0 && <span>📌 {gmFullResult.antecedents.updated} antécédents</span>}
            </div>
          </div>
        )}
      </div>

      {/* ▼ One-click GestionMédicale SQL upload (fichier .sql manuel) ────── */}
      <div style={{ background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", padding: "13px 18px", borderRadius: 10, marginBottom: 18, boxShadow: "0 3px 10px rgba(16,185,129,.2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 3, display: "flex", alignItems: "center", gap: 7 }}>
              <Upload size={15} /> Import express — choisir un autre fichier .sql
            </div>
            <div style={{ fontSize: 11.5, opacity: 0.9 }}>Patients + médicaments seulement depuis un fichier .sql uploadé.</div>
          </div>
          <button onClick={() => gmFileRef.current?.click()} disabled={gmBusy}
            style={{ background: "#fff", color: "#059669", border: "none", padding: "8px 14px", borderRadius: 7, fontWeight: 700, fontSize: 12, cursor: gmBusy ? "wait" : "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            {gmBusy ? <><Loader2 size={13} className="imp-spin" /> En cours…</> : <><Upload size={13} /> Choisir .sql</>}
          </button>
          <input ref={gmFileRef} type="file" accept=".sql" style={{ display: "none" }}
            onChange={e => handleGmSqlUpload(e.target.files[0])} />
        </div>
        {gmResult && (
          <div style={{ marginTop: 10, background: "rgba(255,255,255,.18)", padding: "8px 12px", borderRadius: 7, fontSize: 12 }}>
            <CheckCircle2 size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />
            <strong>{gmResult.patients_imported}</strong> patients · {gmResult.medicines_imported} médicaments sur {gmResult.total_parsed} analysés
            {gmResult.errors?.length > 0 && <span style={{ color: "#fef3c7" }}> · {gmResult.errors.length} erreurs</span>}
          </div>
        )}
      </div>
      <h2 className="imp-card__title"><Database size={18} /> Ou choisissez une autre source</h2>
      <div className="imp-source-grid">
        <div>
          <div className="imp-source-cat"><Upload size={13} /> Fichier local</div>
          {FILE_SOURCES.map(t => (
            <button key={t.id}
              className={`imp-source-btn ${sourceType === t.id && sourceCategory === "file" ? "imp-source-btn--active" : ""}`}
              onClick={() => { setSourceType(t.id); setSourceCategory("file"); setError(""); }}>
              <strong>{t.label}</strong>
              <span>{t.desc}</span>
              {t.ext && <code>{t.ext}</code>}
              {t.note && <span className="imp-source-note"><Info size={10} /> Exporter en CSV depuis Access d'abord</span>}
            </button>
          ))}
        </div>
        <div>
          <div className="imp-source-cat"><Server size={13} /> Base de données distante</div>
          {DB_SOURCES.map(t => (
            <button key={t.id}
              className={`imp-source-btn ${sourceType === t.id && sourceCategory === "db" ? "imp-source-btn--active" : ""}`}
              onClick={() => { setSourceType(t.id); setSourceCategory("db"); setDbForm(f=>({...f, port: String(t.defaultPort)})); setError(""); }}>
              <strong>{t.label}</strong>
              <span>{t.desc}</span>
              <code>:{t.defaultPort}</code>
            </button>
          ))}
        </div>
      </div>
      {sourceType && (
        <div className="imp-actions">
          <button className="imp-btn imp-btn--primary" onClick={() => go(1)}>
            Continuer <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );

  // ── Step 1: upload / connect ──────────────────────────────────────────────
  const handleFileUpload = async (file) => {
    if (!file) return;
    setError(""); setExecuting(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const data = await apiCall("/api/import/upload", { method: "POST", body: form });
      setSessionId(data.session_id); setTables(data.tables);
      setColumns(data.columns); setTotals(data.total); setSample(data.sample);
      setPatientTable(data.tables[0] || "");
      go(2);
    } catch(e) { setErr(e.message); }
    setExecuting(false);
  };

  const handleDbConnect = async () => {
    setError(""); setExecuting(true);
    try {
      const data = await apiCall("/api/import/connect-db", {
        method: "POST",
        body: JSON.stringify({ source_type: sourceType, ...dbForm, port: parseInt(dbForm.port) || 3306 }),
      });
      setSessionId(data.session_id); setTables(data.tables);
      setColumns(data.columns); setTotals(data.total); setSample(data.sample);
      setPatientTable(data.tables[0] || "");
      go(2);
    } catch(e) { setErr(e.message); }
    setExecuting(false);
  };

  const renderStep1 = () => {
    const srcInfo = [...FILE_SOURCES, ...DB_SOURCES].find(s => s.id === sourceType);
    return (
      <div className="imp-card">
        <h2 className="imp-card__title">
          {sourceCategory === "file" ? <><Upload size={18}/> Chargez votre fichier</> : <><Server size={18}/> Connexion à la base</>}
        </h2>
        {sourceCategory === "file" ? (
          <div>
            {sourceType === "access" && (
              <div className="imp-info-box">
                <Info size={14}/> <strong>Microsoft Access :</strong> Ouvrez votre base dans Access → Données externes → Exporter vers CSV → importez le CSV ici.
              </div>
            )}
            <div className="imp-dropzone"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileUpload(e.dataTransfer.files[0]); }}>
              {executing ? <Loader2 size={28} className="imp-spin" /> : <Upload size={28} />}
              <strong>Glissez votre fichier ici ou cliquez</strong>
              <span>{srcInfo?.ext || "Fichier source"}</span>
              <input ref={fileRef} type="file" style={{ display: "none" }}
                accept={srcInfo?.ext || "*"}
                onChange={e => handleFileUpload(e.target.files[0])} />
            </div>
          </div>
        ) : (
          <div className="imp-db-form">
            {[["host","Hôte","localhost"],["port","Port",srcInfo?.defaultPort||3306],["user","Utilisateur","root"],["password","Mot de passe",""],["database","Base de données",""]].map(([k,l,ph]) => (
              <label key={k} className="imp-field">
                <span>{l}</span>
                <input type={k === "password" ? "password" : "text"}
                  value={dbForm[k]} placeholder={String(ph)}
                  onChange={e => setDbForm(f => ({...f, [k]: e.target.value}))} />
              </label>
            ))}
            <button className="imp-btn imp-btn--primary" disabled={executing} onClick={handleDbConnect}>
              {executing ? <Loader2 size={14} className="imp-spin"/> : <Server size={14}/>} Connecter
            </button>
          </div>
        )}
        {error && <div className="imp-error"><AlertTriangle size={14}/> {error}</div>}
        <div className="imp-actions">
          <button className="imp-btn imp-btn--ghost" onClick={() => go(0)}><ArrowLeft size={14}/> Retour</button>
        </div>
      </div>
    );
  };

  // ── Step 2: select tables ─────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="imp-card">
      <h2 className="imp-card__title"><Table2 size={18}/> Tables / Feuilles détectées</h2>
      <div className="imp-table-list">
        {tables.map(t => (
          <div key={t} className="imp-table-item">
            <div className="imp-table-item__info">
              <strong>{t}</strong>
              <span>{totals[t] || 0} lignes · {(columns[t] || []).length} colonnes</span>
            </div>
            <div className="imp-table-item__actions" style={{ flexWrap: "wrap", gap: 4 }}>
              <button className={`imp-tag ${patientTable === t ? "imp-tag--blue" : ""}`} onClick={() => setPatientTable(t)}>
                {patientTable === t ? "✓ " : ""}Patients
              </button>
              <button className={`imp-tag ${visitTable === t ? "imp-tag--green" : ""}`}
                onClick={() => setVisitTable(visitTable === t ? "" : t)}>
                {visitTable === t ? "✓ " : ""}Visites
              </button>
              <button className={`imp-tag ${appointmentTable === t ? "imp-tag--orange" : ""}`}
                onClick={() => setAppointmentTable(appointmentTable === t ? "" : t)}>
                {appointmentTable === t ? "✓ " : ""}RDV
              </button>
              <button className={`imp-tag ${medicationTable === t ? "imp-tag--teal" : ""}`}
                onClick={() => setMedicationTable(medicationTable === t ? "" : t)}>
                {medicationTable === t ? "✓ " : ""}Médicaments
              </button>
              <button className={`imp-tag ${paymentTable === t ? "imp-tag--gray" : ""}`}
                onClick={() => setPaymentTable(paymentTable === t ? "" : t)}>
                {paymentTable === t ? "✓ " : ""}Paiements
              </button>
            </div>
          </div>
        ))}
      </div>
      {patientTable && (
        <div className="imp-sample-wrap">
          <h3>Aperçu — {patientTable}</h3>
          <div className="imp-sample-table-wrap">
            <table className="imp-sample-table">
              <thead><tr>{(columns[patientTable] || []).slice(0,8).map(c=><th key={c}>{c}</th>)}</tr></thead>
              <tbody>{(sample[patientTable] || []).slice(0,4).map((r,i)=>(
                <tr key={i}>{(columns[patientTable] || []).slice(0,8).map(c=><td key={c}>{r[c]}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
      <div className="imp-actions">
        <button className="imp-btn imp-btn--ghost" onClick={() => go(1)}><ArrowLeft size={14}/> Retour</button>
        <button className="imp-btn imp-btn--primary" disabled={!patientTable} onClick={() => go(3)}>
          Mapper les champs <ArrowRight size={14}/>
        </button>
      </div>
    </div>
  );

  // ── Step 3: mapping ───────────────────────────────────────────────────────
  const autoMap = (fields, cols) => {
    const m = {}, conf = {};
    const colsNorm = cols.map(c => c.toLowerCase().replace(/[^a-z0-9]/g, ""));
    fields.forEach(f => {
      const aliases = FIELD_ALIASES[f.key] || [f.key.replace(/_/g, "")];
      let match = null, confidence = "";
      // 1. Exact normalized match
      for (const alias of aliases) {
        const norm = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
        const idx = colsNorm.indexOf(norm);
        if (idx >= 0) { match = cols[idx]; confidence = "high"; break; }
      }
      // 2. Starts-with or contains match
      if (!match) {
        for (const alias of aliases) {
          const norm = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
          const idx = colsNorm.findIndex(c => c.startsWith(norm) || norm.startsWith(c));
          if (idx >= 0) { match = cols[idx]; confidence = "medium"; break; }
        }
      }
      // 3. Partial contains
      if (!match) {
        for (const alias of aliases) {
          const norm = alias.toLowerCase().replace(/[^a-z0-9]/g, "");
          const idx = colsNorm.findIndex(c => c.includes(norm) && norm.length >= 3);
          if (idx >= 0) { match = cols[idx]; confidence = "low"; break; }
        }
      }
      if (match) { m[f.key] = match; conf[f.key] = confidence; }
    });
    return { mapping: m, confidence: conf };
  };

  const CONF_COLOR = { high: "#22c55e", medium: "#f59e0b", low: "#ef4444", "": "#94a3b8" };
  const CONF_LABEL = { high: "✓ Sûr", medium: "~ Probable", low: "? Incertain", "": "" };

  const renderStep3 = () => {
    const patCols = columns[patientTable] || [];
    const visCols = columns[visitTable] || [];
    const apptCols = columns[appointmentTable] || [];
    const medCols  = columns[medicationTable] || [];
    const payCols  = columns[paymentTable] || [];
    const activeTabs = [
      { id: "patients", label: "Patients", cols: patCols, fields: PATIENT_FIELDS, mapping: patientMapping, setMapping: setPatientMapping, conf: patientConf, setConf: setPatientConf, color: "blue", required: true },
      visitTable && { id: "visits", label: "Visites", cols: visCols, fields: VISIT_FIELDS, mapping: visitMapping, setMapping: setVisitMapping, conf: visitConf, setConf: setVisitConf, color: "green" },
      appointmentTable && { id: "appointments", label: "RDV", cols: apptCols, fields: APPOINTMENT_FIELDS, mapping: appointmentMapping, setMapping: setAppointmentMapping, conf: appointmentConf, setConf: setAppointmentConf, color: "orange" },
      medicationTable && { id: "medications", label: "Médicaments", cols: medCols, fields: MEDICATION_FIELDS, mapping: medicationMapping, setMapping: setMedicationMapping, conf: medicationConf, setConf: setMedicationConf, color: "teal" },
      paymentTable && { id: "payments", label: "Paiements", cols: payCols, fields: PAYMENT_FIELDS, mapping: paymentMapping, setMapping: setPaymentMapping, conf: paymentConf, setConf: setPaymentConf, color: "gray" },
    ].filter(Boolean);
    const cur = activeTabs.find(t => t.id === mapTab) || activeTabs[0];
    return (
      <div className="imp-card">
        <h2 className="imp-card__title">Correspondance des champs</h2>
        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
          {activeTabs.map(t => (
            <button key={t.id} onClick={() => setMapTab(t.id)}
              className={`imp-tag imp-tag--${t.color || "blue"}${mapTab === t.id ? " imp-tag--active" : ""}`}
              style={{ fontWeight: mapTab === t.id ? 700 : 500 }}>
              {t.label}
              {Object.keys(t.mapping).length > 0 && <span style={{ marginLeft: 4, fontSize: 10, opacity: .8 }}>({Object.keys(t.mapping).length} champs)</span>}
            </button>
          ))}
        </div>
        {cur && (
          <div className="imp-map-section">
            <div className="imp-map-section__head">
              <strong>{cur.label}</strong> — <code>{cur.id === "patients" ? patientTable : cur.id === "visits" ? visitTable : cur.id === "appointments" ? appointmentTable : cur.id === "medications" ? medicationTable : paymentTable}</code>
              <button className={`imp-tag imp-tag--${cur.color}`} onClick={() => {
                const { mapping: m, confidence: c } = autoMap(cur.fields, cur.cols);
                cur.setMapping(m); cur.setConf(c);
              }}>Auto-détecter</button>
            </div>
            {cur.fields.map(f => (
              <div key={f.key} className="imp-map-row" style={{ alignItems: "center" }}>
                <div className={`imp-map-field ${f.required ? "imp-map-field--req" : ""}`}>
                  {f.label}{f.required && <span className="imp-req">*</span>}
                </div>
                <select className="imp-map-select" value={cur.mapping[f.key] || ""}
                  onChange={e => cur.setMapping(m => ({...m, [f.key]: e.target.value}))}>
                  <option value="">(ignorer)</option>
                  {cur.cols.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {cur.mapping[f.key] ? (
                  <span style={{ fontSize: 10, fontWeight: 700, color: CONF_COLOR[cur.conf[f.key] || ""], minWidth: 68, textAlign: "right" }}>
                    {CONF_LABEL[cur.conf[f.key] || ""] || <CheckCircle2 size={12} />}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
        {error && <div className="imp-error"><AlertTriangle size={14}/> {error}</div>}
        <div className="imp-actions">
          <button className="imp-btn imp-btn--ghost" onClick={() => go(2)}><ArrowLeft size={14}/> Retour</button>
          <button className="imp-btn imp-btn--primary"
            disabled={executing || (!patientMapping.nom && !patientMapping.prenom)}
            onClick={async () => {
              setError(""); setExecuting(true);
              try {
                const data = await apiCall("/api/import/preview", {
                  method: "POST",
                  body: JSON.stringify({ session_id: sessionId, table: patientTable, patient_mapping: patientMapping }),
                });
                setPreview(data); go(4);
              } catch(e) { setErr(e.message); }
              setExecuting(false);
            }}>
            {executing ? <Loader2 size={14} className="imp-spin"/> : <Eye size={14}/>} Aperçu et doublons
          </button>
        </div>
      </div>
    );
  };

  // ── Step 4: preview + duplicates ──────────────────────────────────────────
  const renderStep4 = () => {
    if (!preview) return null;
    const { rows = [], stats = {}, total_source = 0 } = preview;
    return (
      <div className="imp-card">
        <h2 className="imp-card__title"><Eye size={18}/> Aperçu & Détection des doublons</h2>
        <div className="imp-stats-row">
          <div className="imp-stat imp-stat--blue"><span>{total_source}</span><small>Total source</small></div>
          <div className="imp-stat imp-stat--green"><span>{stats.new || 0}</span><small>Nouveaux</small></div>
          <div className="imp-stat imp-stat--orange"><span>{stats.duplicate || 0}</span><small>Doublons</small></div>
        </div>
        <div className="imp-preview-table-wrap">
          <table className="imp-preview-table">
            <thead>
              <tr>
                <th>Statut</th><th>Nom</th><th>Prénom</th><th>Date nais.</th>
                <th>Téléphone</th><th>Code</th><th>Raison doublon</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={r.duplicate_status === "duplicate" ? "imp-row--dup" : ""}>
                  <td>{r.duplicate_status === "duplicate"
                    ? <span className="imp-badge imp-badge--orange">Doublon</span>
                    : <span className="imp-badge imp-badge--green">Nouveau</span>}
                  </td>
                  <td>{r.nom}</td><td>{r.prenom}</td><td>{r.date_naissance}</td>
                  <td>{r.telephone}</td><td>{r.code}</td>
                  <td style={{ fontSize: 11, color: "#94a3b8" }}>{r.match_reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="imp-dup-options">
          <strong>Si doublon détecté :</strong>
          {[["skip","Ignorer — garder l'existant inchangé"],["merge","Fusionner — compléter les champs vides"],["new","Importer comme nouveau patient distinct"]].map(([v,l]) => (
            <label key={v} className="imp-radio">
              <input type="radio" name="dup" value={v} checked={onDuplicate === v} onChange={() => setOnDuplicate(v)}/> {l}
            </label>
          ))}
        </div>
        <div className="imp-actions">
          <button className="imp-btn imp-btn--ghost" onClick={() => go(3)}><ArrowLeft size={14}/> Retour</button>
          <button className="imp-btn imp-btn--primary" onClick={() => go(5)}>
            Préparer l'import <ArrowRight size={14}/>
          </button>
        </div>
      </div>
    );
  };

  // ── Step 5: execute ───────────────────────────────────────────────────────
  const renderStep5 = () => (
    <div className="imp-card">
      <h2 className="imp-card__title">Lancer l'import</h2>
      <div className="imp-launch-summary">
        <div><strong>Source :</strong> {sourceType.toUpperCase()}</div>
        <div><strong>Table patients :</strong> {patientTable} ({totals[patientTable] || 0} lignes)</div>
        {visitTable && <div><strong>Table visites :</strong> {visitTable} ({totals[visitTable] || 0} lignes)</div>}
        <div><strong>Champs mappés :</strong> {Object.values(patientMapping).filter(Boolean).length} / {PATIENT_FIELDS.length}</div>
        <div><strong>Doublons :</strong> {onDuplicate === "skip" ? "Ignorer" : onDuplicate === "merge" ? "Fusionner" : "Importer comme nouveau"}</div>
      </div>
      <div className="imp-safety-box">
        <CheckCircle2 size={15} color="#22c55e"/>
        <div>
          <strong>Sauvegarde automatique</strong> — une copie complète de la base sera créée avant tout import réel.
          <br/><span style={{ fontSize: 11, opacity: 0.8 }}>Les données existantes de MediSmart ne seront jamais supprimées.</span>
        </div>
      </div>
      <div className="imp-dryrun-row">
        <label className="imp-checkbox">
          <input type="checkbox" checked={dryRun} onChange={e => setDryRun(e.target.checked)}/>
          <div>
            <strong>Mode simulation (dry-run)</strong>
            <span style={{ fontSize: 11, color: "#64748b", display: "block" }}>Testez sans modifier aucune donnée. Décochez pour importer réellement.</span>
          </div>
        </label>
      </div>
      {error && <div className="imp-error"><AlertTriangle size={14}/> {error}</div>}
      <div className="imp-actions">
        <button className="imp-btn imp-btn--ghost" onClick={() => go(4)}><ArrowLeft size={14}/> Retour</button>
        <button className={`imp-btn ${dryRun ? "imp-btn--ghost" : "imp-btn--danger"}`}
          disabled={executing}
          onClick={async () => {
            setError(""); setExecuting(true);
            try {
              const data = await apiCall("/api/import/execute", {
                method: "POST",
                body: JSON.stringify({
                  session_id: sessionId,
                  patient_table: patientTable,
                  visit_table: visitTable || undefined,
                  appointment_table: appointmentTable || undefined,
                  medication_table: medicationTable || undefined,
                  payment_table: paymentTable || undefined,
                  patient_mapping: patientMapping,
                  visit_mapping: visitMapping,
                  appointment_mapping: appointmentMapping,
                  medication_mapping: medicationMapping,
                  payment_mapping: paymentMapping,
                  on_duplicate: onDuplicate,
                  dry_run: dryRun,
                }),
              });
              setReport(data);
              if (data.job_id && !dryRun) {
                apiCall(`/api/import/report/${data.job_id}`).then(setFullReport).catch(() => {});
              }
              go(6);
            } catch(e) { setErr(e.message); }
            setExecuting(false);
          }}>
          {executing
            ? <><Loader2 size={14} className="imp-spin"/> En cours…</>
            : dryRun
              ? <><Eye size={14}/> Simuler</>
              : <><CheckCircle2 size={14}/> Importer</>}
        </button>
      </div>
    </div>
  );

  // ── Step 6: report ────────────────────────────────────────────────────────
  const renderStep6 = () => {
    if (!report) return null;
    const { patients = {}, visits = {}, dry_run, job_id, backup_path } = report;
    const errCount = (patients.errors || []).length + (visits.errors || []).length;
    return (
      <div className="imp-card">
        <h2 className="imp-card__title">
          {dry_run
            ? <><Eye size={18}/> Rapport de simulation</>
            : <><CheckCircle2 size={18} color="#22c55e"/> Rapport d'import</>}
        </h2>
        {dry_run && (
          <div className="imp-info-box">
            <Eye size={14}/> Mode simulation — aucune donnée modifiée. Décochez «&nbsp;dry-run&nbsp;» pour importer réellement.
          </div>
        )}
        <div className="imp-stats-row">
          <div className="imp-stat imp-stat--green"><span>{patients.imported || 0}</span><small>Patients importés</small></div>
          <div className="imp-stat imp-stat--blue"><span>{patients.merged || 0}</span><small>Fusionnés</small></div>
          <div className="imp-stat imp-stat--orange"><span>{patients.updated || 0}</span><small>Mis à jour</small></div>
          <div className="imp-stat imp-stat--gray"><span>{patients.skipped || 0}</span><small>Déjà existants</small></div>
          <div className="imp-stat imp-stat--teal"><span>{visits.imported || 0}</span><small>Visites importées</small></div>
          {(report.appointments?.imported || 0) > 0 && <div className="imp-stat imp-stat--orange"><span>{report.appointments.imported}</span><small>RDV importés</small></div>}
          {(report.medications?.imported || 0) > 0 && <div className="imp-stat imp-stat--teal"><span>{report.medications.imported}</span><small>Médicaments</small></div>}
          {(report.payments?.imported || 0) > 0 && <div className="imp-stat imp-stat--blue"><span>{report.payments.imported}</span><small>Paiements</small></div>}
          {errCount > 0 && <div className="imp-stat imp-stat--red"><span>{errCount}</span><small>Erreurs</small></div>}
        </div>
        {backup_path && (
          <div className="imp-backup-info">
            <Database size={13}/> Sauvegarde créée : <code>{backup_path.split(/[/\\]/).pop()}</code>
          </div>
        )}
        {(patients.errors || []).length > 0 && (
          <details className="imp-error-details">
            <summary>Erreurs patients ({patients.errors.length})</summary>
            {patients.errors.slice(0, 20).map((e, i) => (
              <div key={i} className="imp-error-item"><XCircle size={11}/> Ligne {e.row}: {e.error}</div>
            ))}
          </details>
        )}
        <div className="imp-actions">
          {dry_run && (
            <button className="imp-btn imp-btn--danger" onClick={() => { setDryRun(false); go(5); }}>
              <ArrowRight size={14}/> Importer pour de vrai
            </button>
          )}
          {!dry_run && job_id && (
            <button className="imp-btn imp-btn--ghost" onClick={async () => {
              if (!window.confirm("Annuler cet import et restaurer la sauvegarde ?")) return;
              try { await apiCall(`/api/import/rollback/${job_id}`, { method: "POST" }); alert("Base restaurée avec succès."); }
              catch(e) { alert(e.message); }
            }}>
              <RotateCcw size={13}/> Annuler (rollback)
            </button>
          )}
          <button className="imp-btn imp-btn--ghost" onClick={() => downloadReportCsv(fullReport || { summary: { ...report, patients_imported: patients.imported, visits_imported: visits.imported, total_errors: errCount, dry_run, status: "done" }})}>
            <Download size={13}/> Rapport CSV
          </button>
          <button className="imp-btn imp-btn--ghost" onClick={() => { setStep(0); setReport(null); setFullReport(null); setSessionId(""); setPreview(null); setPatientMapping({}); setVisitMapping({}); setAppointmentMapping({}); setMedicationMapping({}); setPaymentMapping({}); setAppointmentTable(""); setMedicationTable(""); setPaymentTable(""); }}>
            Nouvel import
          </button>
        </div>
      </div>
    );
  };

  // ── History loader ────────────────────────────────────────────────────────
  const loadHistory = async () => {
    try { const d = await apiCall("/api/import/jobs"); setJobHistory(d.rows || []); setShowHistory(true); }
    catch(e) { setError(e.message); }
  };

  const RENDERERS = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4, renderStep5, renderStep6];

  return (
    <div className="imp-layout">
      <div className="imp-header">
        <div className="imp-header__left">
          <ClipboardList size={22}/>
          <div>
            <h1>Import ancienne base</h1>
            <p>Migrez vos données depuis un ancien logiciel médical — sûrement, avec sauvegarde et vérification</p>
          </div>
        </div>
        <button className="imp-btn imp-btn--ghost imp-btn--sm" onClick={loadHistory}>
          <ClipboardList size={12}/> Historique des imports
        </button>
      </div>

      <StepBar current={step} />

      <div className="imp-content">
        {RENDERERS[step]?.()}
      </div>

      {showHistory && (
        <div className="imp-history-overlay" onClick={() => setShowHistory(false)}>
          <div className="imp-history-modal" onClick={e => e.stopPropagation()}>
            <h3><ClipboardList size={15}/> Historique des imports</h3>
            <table className="imp-preview-table">
              <thead>
                <tr><th>#</th><th>Source</th><th>Patients</th><th>Visites</th><th>Erreurs</th><th>Statut</th><th>Date</th></tr>
              </thead>
              <tbody>
                {jobHistory.map(j => (
                  <tr key={j.id}>
                    <td>{j.id}</td>
                    <td>{j.source_name} <small>({j.source_type})</small></td>
                    <td>{j.patients_imported}</td>
                    <td>{j.visits_imported}</td>
                    <td style={{ color: j.errors && j.errors !== "[]" ? "#f87171" : "#64748b" }}>
                      {j.errors ? JSON.parse(j.errors || "[]").length : 0}
                    </td>
                    <td><span className={`imp-badge imp-badge--${j.status === "done" ? "green" : j.status === "error" ? "red" : "orange"}`}>{j.status}</span></td>
                    <td style={{ fontSize: 11 }}>{(j.created_at || "").slice(0, 16)}</td>
                  </tr>
                ))}
                {!jobHistory.length && (
                  <tr><td colSpan={7} style={{ textAlign: "center", color: "#64748b", padding: "20px" }}>Aucun import enregistré</td></tr>
                )}
              </tbody>
            </table>
            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button className="imp-btn imp-btn--ghost" onClick={() => setShowHistory(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
