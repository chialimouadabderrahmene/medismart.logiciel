import React, { useState, useRef } from "react";
import { CheckCircle2, ArrowRight, ArrowLeft, Upload, Database, RefreshCw } from "lucide-react";
import { SPECIALITY_LIST } from "./specialities/index.js";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
async function apiCall(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: opts.body && !(opts.body instanceof FormData) ? { "Content-Type": "application/json" } : {},
    ...opts,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => res.statusText);
    let detail = res.statusText;
    try { const j = JSON.parse(txt); detail = j.detail || j.message || txt; } catch (_) { detail = txt || res.statusText; }
    throw new Error(detail);
  }
  return res.json();
}

const STEPS = ["Spécialité", "Profil médecin", "Données"];

function StepDot({ n, current }) {
  return (
    <div className={`sw-dot ${n < current ? "sw-dot--done" : n === current ? "sw-dot--active" : ""}`}>
      {n < current ? <CheckCircle2 size={12}/> : n + 1}
    </div>
  );
}

export default function SetupWizardPanel({ onDone }) {
  const [step, setStep] = useState(0);
  const [speciality, setSpeciality] = useState("");
  const [profile, setProfile] = useState({
    nom: "", ordre: "", telephone: "", email: "", adresse: "", clinic: ""
  });
  const [dataMode, setDataMode] = useState("new");
  const [restoreFile, setRestoreFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const logoRef = useRef();
  const [logoPreview, setLogoPreview] = useState(null);

  const spec = SPECIALITY_LIST.find(s => s.id === speciality);

  const handleLogo = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => setLogoPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const finish = async () => {
    setSaving(true); setError("");
    try {
      if (dataMode === "restore") {
        if (!restoreFile) {
          setError("Veuillez sélectionner un fichier de sauvegarde .sqlite3.");
          setSaving(false);
          return;
        }
        const form = new FormData();
        form.append("file", restoreFile);
        await apiCall("/api/setup/restore", { method: "POST", body: form });
        // restore endpoint already marks setup complete; just notify parent
        onDone(speciality, dataMode);
        return;
      }
      await apiCall("/api/setup/complete", {
        method: "POST",
        body: JSON.stringify({
          speciality,
          doctor_name:    profile.nom,
          doctor_order:   profile.ordre,
          doctor_phone:   profile.telephone,
          doctor_email:   profile.email,
          doctor_address: profile.adresse,
          clinic_name:    profile.clinic || `Cabinet de ${spec?.label || "Médecine"}`,
          data_mode:      dataMode,
          logo_b64:       logoPreview || "",
        }),
      });
      onDone(speciality, dataMode);
    } catch(e) { setError(e.message); setSaving(false); }
  };

  return (
    <div className="sw-overlay">
      <div className="sw-modal">
        {/* Header */}
        <div className="sw-header">
          <div className="sw-header__logo">🏥</div>
          <div>
            <h1 className="sw-header__title">Bienvenue dans MediSmart</h1>
            <p className="sw-header__sub">Configuration initiale de votre cabinet médical</p>
          </div>
        </div>

        {/* Step bar */}
        <div className="sw-stepbar">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <div className="sw-step">
                <StepDot n={i} current={step}/>
                <span className={`sw-step__label ${i === step ? "sw-step__label--active" : i < step ? "sw-step__label--done" : ""}`}>{s}</span>
              </div>
              {i < STEPS.length - 1 && <div className="sw-step__line"/>}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step 0: Speciality ── */}
        {step === 0 && (
          <div className="sw-body">
            <h2 className="sw-section-title">Quelle est votre spécialité ?</h2>
            <p className="sw-section-sub">Cette sélection adapte l'interface, les formulaires, les modèles et l'assistant IA à votre pratique.</p>
            <div className="sw-spec-grid">
              {SPECIALITY_LIST.map(s => (
                <button key={s.id}
                  className={`sw-spec-btn ${speciality === s.id ? "sw-spec-btn--active" : ""}`}
                  style={speciality === s.id ? { borderColor: s.color, background: `${s.color}15` } : {}}
                  onClick={() => setSpeciality(s.id)}>
                  <span className="sw-spec-btn__icon">{s.icon}</span>
                  <span className="sw-spec-btn__label">{s.label}</span>
                  {speciality === s.id && <span className="sw-spec-btn__check" style={{ color: s.color }}><CheckCircle2 size={14}/></span>}
                </button>
              ))}
            </div>
            <div className="sw-actions">
              <button className="sw-btn sw-btn--primary" disabled={!speciality} onClick={() => setStep(1)}>
                Continuer <ArrowRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 1: Doctor Profile ── */}
        {step === 1 && (
          <div className="sw-body">
            <h2 className="sw-section-title">Profil du médecin</h2>
            <p className="sw-section-sub">Ces informations apparaîtront sur vos ordonnances et certificats.</p>
            <div className="sw-form-grid">
              {[
                ["nom",       "Nom & Prénom du médecin",   "Dr. "],
                ["ordre",     "N° d'ordre",                ""],
                ["telephone", "Téléphone du cabinet",      ""],
                ["email",     "Email",                     ""],
                ["adresse",   "Adresse du cabinet",        ""],
                ["clinic",    "Nom du cabinet (optionnel)",""],
              ].map(([k, l, ph]) => (
                <label key={k} className="sw-field">
                  <span>{l}</span>
                  <input type="text" placeholder={ph} value={profile[k]}
                    onChange={e => setProfile(p => ({...p, [k]: e.target.value}))}/>
                </label>
              ))}
            </div>

            <div className="sw-logo-row">
              <div className="sw-logo-upload" onClick={() => logoRef.current?.click()}>
                {logoPreview
                  ? <img src={logoPreview} alt="logo" className="sw-logo-preview"/>
                  : <><Upload size={20}/><span>Ajouter logo cabinet (optionnel)</span></>}
                <input ref={logoRef} type="file" accept="image/*" style={{ display:"none" }}
                  onChange={e => handleLogo(e.target.files[0])}/>
              </div>
            </div>

            <div className="sw-actions">
              <button className="sw-btn sw-btn--ghost" onClick={() => setStep(0)}><ArrowLeft size={14}/> Retour</button>
              <button className="sw-btn sw-btn--primary" disabled={!profile.nom.trim()} onClick={() => setStep(2)}>
                Continuer <ArrowRight size={14}/>
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Data Mode ── */}
        {step === 2 && (
          <div className="sw-body">
            <h2 className="sw-section-title">Gestion des données</h2>
            <p className="sw-section-sub">Comment souhaitez-vous démarrer avec vos données patients ?</p>
            <div className="sw-data-opts">
              {[
                { id: "new",     icon: <Database size={22}/>,   title: "Nouvelle base vide",      desc: "Démarrer avec MediSmart sans données antérieures." },
                { id: "import",  icon: <Upload size={22}/>,     title: "Importer ancienne base",  desc: "Importer les données d'un ancien logiciel médical (CSV, Excel, SQLite, SQL…). Import incrémental — les doublons seront ignorés." },
                { id: "restore", icon: <RefreshCw size={22}/>,  title: "Restaurer une sauvegarde",desc: "Restaurer depuis une sauvegarde MediSmart existante." },
              ].map(opt => (
                <button key={opt.id}
                  className={`sw-data-opt ${dataMode === opt.id ? "sw-data-opt--active" : ""}`}
                  onClick={() => setDataMode(opt.id)}>
                  <div className="sw-data-opt__icon">{opt.icon}</div>
                  <div className="sw-data-opt__text">
                    <strong>{opt.title}</strong>
                    <span>{opt.desc}</span>
                  </div>
                  {dataMode === opt.id && <CheckCircle2 size={16} className="sw-data-opt__check"/>}
                </button>
              ))}
            </div>

            {dataMode === "restore" && (
              <div className="sw-restore-file" style={{margin:"14px 0",padding:"12px 14px",background:"#0f172a",borderRadius:"8px",border:"1px solid #1e293b"}}>
                <label style={{display:"block",fontSize:"13px",color:"#94a3b8",marginBottom:"8px"}}>
                  Sélectionnez votre fichier de sauvegarde (.sqlite3)
                </label>
                <input
                  type="file"
                  accept=".sqlite3"
                  onChange={e => setRestoreFile(e.target.files?.[0] || null)}
                  style={{color:"#e2e8f0",fontSize:"13px"}}
                />
                {restoreFile && (
                  <div style={{marginTop:"8px",fontSize:"12px",color:"#22c55e"}}>
                    <CheckCircle2 size={12} style={{display:"inline",marginRight:"4px"}}/> {restoreFile.name}
                  </div>
                )}
              </div>
            )}

            {error && <div className="sw-error">{error}</div>}

            <div className="sw-actions">
              <button className="sw-btn sw-btn--ghost" onClick={() => setStep(1)}><ArrowLeft size={14}/> Retour</button>
              <button className="sw-btn sw-btn--primary" disabled={saving} onClick={finish}>
                {saving ? "Enregistrement…" : <><CheckCircle2 size={14}/> Terminer la configuration</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
