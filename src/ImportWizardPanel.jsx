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
  const [patientMapping, setPatientMapping] = useState({});
  const [visitMapping, setVisitMapping] = useState({});
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

  const setErr = (msg) => { setError(msg); setExecuting(false); };
  const go = (n) => { setError(""); setStep(n); };

  // ── Step 0: choose source ─────────────────────────────────────────────────
  const renderStep0 = () => (
    <div className="imp-card">
      <h2 className="imp-card__title"><Database size={18} /> Choisissez la source de données</h2>
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
            <div className="imp-table-item__actions">
              <button className={`imp-tag ${patientTable === t ? "imp-tag--blue" : ""}`} onClick={() => setPatientTable(t)}>
                {patientTable === t ? "✓ " : ""}Patients
              </button>
              <button className={`imp-tag ${visitTable === t ? "imp-tag--green" : ""}`}
                onClick={() => setVisitTable(visitTable === t ? "" : t)}>
                {visitTable === t ? "✓ " : ""}Visites
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
    const m = {};
    fields.forEach(f => {
      const key = f.key.replace(/_/g, "").toLowerCase();
      const match = cols.find(c => c.toLowerCase().replace(/[^a-z]/g, "") === key) ||
                    cols.find(c => c.toLowerCase().includes(f.key.split("_")[0].toLowerCase()));
      if (match) m[f.key] = match;
    });
    return m;
  };

  const renderStep3 = () => {
    const patCols = columns[patientTable] || [];
    const visCols = columns[visitTable] || [];
    return (
      <div className="imp-card">
        <h2 className="imp-card__title">Correspondance des champs</h2>
        <div className="imp-map-section">
          <div className="imp-map-section__head">
            <strong>Patients</strong> — <code>{patientTable}</code>
            <button className="imp-tag imp-tag--blue" onClick={() => setPatientMapping(autoMap(PATIENT_FIELDS, patCols))}>
              Auto-détecter
            </button>
          </div>
          {PATIENT_FIELDS.map(f => (
            <MappingRow key={f.key} field={f} columns={patCols}
              value={patientMapping[f.key]}
              onChange={v => setPatientMapping(m => ({...m, [f.key]: v}))} />
          ))}
        </div>
        {visitTable && (
          <div className="imp-map-section" style={{ marginTop: 16 }}>
            <div className="imp-map-section__head">
              <strong>Visites</strong> — <code>{visitTable}</code>
              <button className="imp-tag imp-tag--green" onClick={() => setVisitMapping(autoMap(VISIT_FIELDS, visCols))}>
                Auto-détecter
              </button>
            </div>
            {VISIT_FIELDS.map(f => (
              <MappingRow key={f.key} field={f} columns={visCols}
                value={visitMapping[f.key]}
                onChange={v => setVisitMapping(m => ({...m, [f.key]: v}))} />
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
                  patient_mapping: patientMapping,
                  visit_mapping: visitMapping,
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
          <button className="imp-btn imp-btn--ghost" onClick={() => { setStep(0); setReport(null); setFullReport(null); setSessionId(""); setPreview(null); setPatientMapping({}); setVisitMapping({}); }}>
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
