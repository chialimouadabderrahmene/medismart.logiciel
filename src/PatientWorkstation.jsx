// PatientWorkstation — MediSmart Pro strict layout
// Top: [Important à signaler | {État Civil ↔ Antécédents toggle} ]
// Middle tabs: Visite Médicale | État du Patient | Règlement
// Bottom: Enregistrer | Actualiser | Date consultation
import React, { useState, useEffect, useRef } from "react";
import {
  AlertTriangle, Save, RefreshCw, Edit3, Calendar, Pencil,
  Users, Stethoscope, CreditCard, Heart, FileText, Eye,
  User as UserIcon, Activity,
} from "lucide-react";
import { api } from "./api.js";

function ageDetailed(value) {
  const text = String(value || "").slice(0, 10);
  if (!text) return { years: "", months: "" };
  const birth = new Date(text + "T00:00:00");
  if (Number.isNaN(birth.getTime())) return { years: "", months: "" };
  const today = new Date();
  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months -= 1;
  if (months < 0) { years -= 1; months += 12; }
  if (years < 0 || years > 130) return { years: "", months: "" };
  return { years: String(years), months: String(months) };
}

/* ── EcField: compact label+input row ── */
function EcField({ label, value, onChange, type, readOnly, options }) {
  const inp = { flex: 1, padding: "5px 8px", border: "1px solid #dde3ef", borderRadius: 4, fontSize: 12.5, outline: "none", background: readOnly ? "#f8fafc" : "#fff", color: "#0f172a", fontFamily: "inherit", minWidth: 0 };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
      <span style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", minWidth: 80, textAlign: "right", flexShrink: 0 }}>{label}</span>
      {options ? (
        <select value={value || ""} onChange={e => onChange?.(e.target.value)} disabled={readOnly} style={inp}>
          <option value="">—</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={type || "text"} value={value || ""} readOnly={readOnly}
          onChange={e => onChange?.(e.target.value)} style={inp}
          onFocus={e => { e.target.style.borderColor = "#2563eb"; }}
          onBlur={e => { e.target.style.borderColor = "#dde3ef"; }}
        />
      )}
    </div>
  );
}

/* ── AntField: labeled textarea for antecedents ── */
function AntField({ label, value, onChange, rows, accent }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 10.5, fontWeight: 700, color: accent || "#475569", textTransform: "uppercase", letterSpacing: ".3px" }}>{label}</label>
      <textarea value={value || ""} onChange={e => onChange?.(e.target.value)} rows={rows || 3}
        placeholder={"Saisir " + label.toLowerCase() + "…"}
        style={{ width: "100%", resize: "vertical", border: "1px solid #dde3ef", borderRadius: 5, padding: "7px 10px", fontSize: 12.5, fontFamily: "inherit", outline: "none", background: "#fff", color: "#0f172a", lineHeight: 1.55 }}
        onFocus={e => { e.target.style.borderColor = accent || "#2563eb"; }}
        onBlur={e => { e.target.style.borderColor = "#dde3ef"; }}
      />
    </div>
  );
}

export default function PatientWorkstation({
  patient, detail, patientForm, setPatientForm, saving,
  onSavePatient, onDeletePatient, onBackToDirectory,
  visit, setVisit, onSaveVisit, onDictate, onRefreshPatient, onNewPatient,
  uploadMode, specialityConfig, medications, appointments,
  onSaveAppointment, onSavePrescription, onUpload, onSaveDocumentNotes,
  onSaveCardioProfile, onSaveVitals, onSaveLabs, onSaveEcg,
  onSaveImaging, onSaveDiagnosis, onDeleteDiagnosis, onAutoFollowup,
  section, embeddedPanels
}) {
  const [bottomTab, setBottomTab] = useState("visite");
  const [topTab, setTopTab] = useState("civil");       // "civil" | "antecedents"
  const [editingImportant, setEditingImportant] = useState(false);

  const p = patient || {};
  const f = patientForm || {};
  const visits = (detail && detail.visits) || [];

  const update = (key, val) => setPatientForm?.(prev => {
    if (key === "date_naissance") {
      const text = String(val || "").slice(0, 10);
      if (!text) return { ...prev, date_naissance: val };
      const birth = new Date(text + "T00:00:00");
      if (Number.isNaN(birth.getTime())) return { ...prev, date_naissance: val };
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const before = today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate());
      if (before) age -= 1;
      return { ...prev, date_naissance: val, age: age >= 0 && age <= 130 ? String(age) : "" };
    }
    return { ...prev, [key]: val };
  });

  const updateVisit = (key, val) => setVisit?.(prev => ({ ...prev, [key]: val }));

  // Check if we should show an embedded panel from sidebar
  const embeddedSection = section && section !== "dossier" && embeddedPanels?.[section];
  if (embeddedSection) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#eef2f8" }}>
        <div style={{ flex: 1, overflow: "auto", padding: "16px 20px", background: "#f0f4f8" }}>
          {embeddedPanels[section]}
        </div>
      </div>
    );
  }

  const aged = ageDetailed(f.date_naissance);
  const isFemale = /fem|fém|^f$/i.test(f.sexe || "");
  const sexIcon = isFemale ? "♀" : "♂";
  const sexColor = isFemale ? "#ec4899" : "#3b82f6";
  const importantText = f.notes_importantes || f.allergies || p.notes_importantes || p.allergies || "";

  // IMC calculation for État du Patient tab
  const calcIMC = (poids, taille) => {
    const w = parseFloat(poids);
    const h = parseFloat(taille);
    if (w > 0 && h > 0) return (w / Math.pow(h / 100, 2)).toFixed(1);
    return "";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#eef2f8", fontFamily: "inherit" }}>

      {/* ═══════════ TOP ROW: Important | {État Civil ↔ Antécédents} ═══════════ */}
      <div style={{ display: "flex", flexShrink: 0, minHeight: 0, maxHeight: 260 }}>

        {/* ── LEFT: Important à signaler ── */}
        <div style={{ width: 200, flexShrink: 0, background: "#fff", borderRight: "1px solid #dde3ef", display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", borderBottom: "1px solid #eef2f7", flexShrink: 0 }}>
            <AlertTriangle size={13} style={{ color: "#dc2626" }} />
            <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: ".4px" }}>Important à signaler</span>
          </div>
          <div style={{ flex: 1, padding: "10px 12px", overflow: "auto", fontSize: 13, color: "#dc2626", fontWeight: 700, position: "relative" }}>
            {editingImportant ? (
              <textarea value={f.notes_importantes || ""} onChange={e => update("notes_importantes", e.target.value)}
                style={{ width: "100%", height: "100%", border: "none", resize: "none", outline: "none", fontSize: 13, color: "#dc2626", fontWeight: 700, fontFamily: "inherit", background: "transparent" }}
                placeholder="Notes importantes, allergies..." autoFocus />
            ) : (
              <div style={{ whiteSpace: "pre-wrap" }}>{importantText || <span style={{ color: "#cbd5e1", fontStyle: "italic", fontWeight: 400 }}>Aucune alerte</span>}</div>
            )}
            <button onClick={() => setEditingImportant(!editingImportant)} style={{ position: "absolute", top: 4, right: 4, background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 2 }}>
              <Pencil size={12} />
            </button>
          </div>
        </div>

        {/* ── CENTER: Toggle area {État Civil | Antécédents} ── */}
        <div style={{ flex: 1, background: "#fff", display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* TWO TOGGLE BUTTONS — side by side, active = blue */}
          <div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #dde3ef", flexShrink: 0 }}>
            <button onClick={() => setTopTab("civil")}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", border: "none", cursor: "pointer", fontFamily: "inherit",
                background: topTab === "civil" ? "#eff6ff" : "#fff",
                borderBottom: topTab === "civil" ? "3px solid #1d4ed8" : "3px solid transparent",
                color: topTab === "civil" ? "#1d4ed8" : "#64748b",
                fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px" }}>
              <UserIcon size={14} /> État Civil
            </button>
            <button onClick={() => setTopTab("antecedents")}
              style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, padding: "10px 0", border: "none", cursor: "pointer", fontFamily: "inherit",
                background: topTab === "antecedents" ? "#eff6ff" : "#fff",
                borderBottom: topTab === "antecedents" ? "3px solid #1d4ed8" : "3px solid transparent",
                color: topTab === "antecedents" ? "#1d4ed8" : "#64748b",
                fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".4px" }}>
              <Stethoscope size={14} /> Antécédents
            </button>
          </div>

          {/* CONTENT: État Civil */}
          {topTab === "civil" && (
            <div style={{ flex: 1, padding: "8px 14px", overflow: "auto" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "2px 16px" }}>
                {/* Col 1 */}
                <EcField label="ID :" value={f.code} onChange={v => update("code", v)} />
                <EcField label="D.D.N :" value={String(f.date_naissance || "").slice(0, 10)} type="date" onChange={v => update("date_naissance", v)} />
                <EcField label="Sit. familiale :" value={f.situation_familiale} options={["Célibataire", "Marié(e)", "Divorcé(e)", "Veuf(ve)"]} onChange={v => update("situation_familiale", v)} />

                <EcField label="Nom :" value={f.nom} onChange={v => update("nom", v.toUpperCase())} />
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", minWidth: 80, textAlign: "right", flexShrink: 0 }}>Âge :</span>
                  <input value={aged.years || f.age || ""} readOnly style={{ width: 36, padding: "5px 6px", border: "1px solid #dde3ef", borderRadius: 4, fontSize: 12, background: "#f8fafc", textAlign: "center" }} />
                  <span style={{ fontSize: 10, color: "#64748b" }}>ans</span>
                  <input value={aged.months || ""} readOnly style={{ width: 28, padding: "5px 4px", border: "1px solid #dde3ef", borderRadius: 4, fontSize: 12, background: "#f8fafc", textAlign: "center" }} />
                  <span style={{ fontSize: 10, color: "#64748b" }}>mois</span>
                </div>
                <EcField label="Adresse :" value={f.adresse} onChange={v => update("adresse", v)} />

                <EcField label="Prénom :" value={f.prenom} onChange={v => update("prenom", v)} />
                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 2 }}>
                  <span style={{ fontSize: 10.5, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", minWidth: 80, textAlign: "right", flexShrink: 0 }}>Sexe :</span>
                  <span style={{ color: sexColor, fontSize: 15, fontWeight: 700 }}>{sexIcon}</span>
                  <select value={f.sexe || ""} onChange={e => update("sexe", e.target.value)}
                    style={{ flex: 1, padding: "5px 6px", border: "1px solid #dde3ef", borderRadius: 4, fontSize: 12, background: "#fff", outline: "none" }}>
                    <option value="">—</option>
                    <option value="Feminin">Féminin</option>
                    <option value="Masculin">Masculin</option>
                  </select>
                </div>
                <div />

                <EcField label="Téléphone :" value={f.telephone} onChange={v => update("telephone", v)} />
                <EcField label="Groupage :" value={f.groupe_sanguin} options={["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]} onChange={v => update("groupe_sanguin", v)} />
                <EcField label="Orienté par :" value={f.oriente_par} onChange={v => update("oriente_par", v)} />

                <EcField label="Profession :" value={f.profession} onChange={v => update("profession", v)} />
              </div>
              {!patient?.id && (
                <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 6, background: "#eff6ff", color: "#1d4ed8", fontSize: 11.5, fontWeight: 600 }}>
                  Complأ©tez l'أ©tat civil puis utilisez le bouton d'enregistrement en bas pour crأ©er le patient.
                </div>
              )}
            </div>
          )}

          {/* CONTENT: Antécédents — column layout like visite médicale */}
          {topTab === "antecedents" && (
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, overflow: "hidden", minHeight: 0, background: "#f0f2f5" }}>
              {[
                { key: "antecedents", label: "Antécédents médicaux" },
                { key: "antecedents_chirurgicaux", label: "Antécédents chirurgicaux" },
                { key: "antecedents_familiaux", label: "Antécédents familiaux" },
                { key: "antecedents_gyneco", label: "Antécédents gynéco-obstétricaux" },
                { key: "maladies", label: "Maladies chroniques" },
                { key: "autres_antecedents", label: "Autres antécédents" },
              ].map((col, idx) => (
                <div key={col.key} style={{ display: "flex", flexDirection: "column", overflow: "hidden", background: "#fff" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderBottom: "1px solid #eef2f7", flexShrink: 0, background: "#fafbfc" }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: ".3px" }}>{col.label}</span>
                    <Pencil size={10} style={{ color: "#94a3b8" }} />
                  </div>
                  <div style={{ flex: 1, overflow: "auto" }}>
                    <textarea
                      value={f[col.key] || ""}
                      onChange={e => update(col.key, e.target.value)}
                      placeholder={"Saisir " + col.label.toLowerCase() + "…"}
                      style={{ width: "100%", height: "100%", padding: "8px 10px", border: "none", resize: "none", outline: "none", background: "#fff", color: "#0f172a", fontSize: 12, fontFamily: "inherit", lineHeight: 1.5, minHeight: 80 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════ TAB BAR: Visite Médicale | État du Patient | Règlement ═══════════ */}
      <div style={{ display: "flex", alignItems: "stretch", background: "#fff", borderBottom: "1px solid #dde3ef", borderTop: "1px solid #dde3ef", flexShrink: 0 }}>
        {[
          { id: "visite", label: "VISITE MÉDICALE", icon: Stethoscope },
          { id: "etat", label: "ÉTAT DU PATIENT", icon: Heart },
          { id: "reglement", label: "RÈGLEMENT", icon: CreditCard },
        ].map(t => (
          <button key={t.id} onClick={() => setBottomTab(t.id)}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", border: "none",
              background: bottomTab === t.id ? "#fff" : "transparent",
              borderBottom: bottomTab === t.id ? "3px solid #1d4ed8" : "3px solid transparent",
              color: bottomTab === t.id ? "#1d4ed8" : "#64748b",
              fontSize: 11.5, fontWeight: 700, cursor: "pointer", textTransform: "uppercase", letterSpacing: ".3px" }}>
            <t.icon size={13} /> {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════ CONTENT AREA ═══════════ */}

      {/* ── VISITE MÉDICALE: 4 columns ── */}
      {bottomTab === "visite" && (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, overflow: "hidden", minHeight: 0, background: "#f0f2f5" }}>
          {[
            { key: "motif", label: "Motif de visite" },
            { key: "examens", label: "Examens" },
            { key: "diagnostics", label: "Diagnostic" },
            { key: "traitements", label: "Traitement" },
          ].map((col, idx) => (
            <div key={col.key} style={{ display: "flex", flexDirection: "column", borderRight: idx < 3 ? "1px solid #dde3ef" : "none", overflow: "hidden", background: "#fff" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid #eef2f7", flexShrink: 0, background: "#fafbfc" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#0f172a", textTransform: "uppercase", letterSpacing: ".4px" }}>{col.label}</span>
                <Pencil size={11} style={{ color: "#94a3b8" }} />
              </div>
              <div style={{ flex: 1, overflow: "auto" }}>
                <textarea
                  value={visit?.[col.key] || ""}
                  onChange={e => updateVisit(col.key, e.target.value)}
                  placeholder={"Saisir " + col.label.toLowerCase() + "…"}
                  style={{ width: "100%", height: "100%", padding: "10px 12px", border: "none", resize: "none", outline: "none", background: "#fff", color: "#0f172a", fontSize: 13, fontFamily: "inherit", lineHeight: 1.6, minHeight: 120 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── ÉTAT DU PATIENT: Vitals + Visit History ── */}
      {bottomTab === "etat" && (
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", background: "#f8fafc" }}>
          {/* Current vitals */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: 18, marginBottom: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 10 }}>Constantes actuelles</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 8 }}>
              {(() => {
                const vp = parseFloat(visit?.poids); const vt = parseFloat(visit?.taille);
                const imc = (vp > 0 && vt > 0) ? (vp / Math.pow(vt / 100, 2)).toFixed(1) : "";
                const fields = [
                  { key: "taille",              label: "Taille (cm)",  ph: "cm",  isV: true },
                  { key: "poids",               label: "Poids (kg)",  ph: "kg",  isV: true },
                  { key: "_imc",                label: "IMC",         computed: imc },
                  { key: "tension",             label: "TAS / TAD",   ph: "ex: 120/80", isV: true },
                  { key: "glycemie",            label: "Glycémie",    ph: "g/L", isV: true },
                  { key: "frequence_cardiaque", label: "FC (bpm)",    ph: "bpm", isV: true },
                  { key: "maladies",            label: "Maladies",    ph: "",   isPf: true },
                ];
                return fields.map(fl => (
                  <label key={fl.key} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 9.5, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: ".3px" }}>{fl.label}</span>
                    {fl.computed !== undefined ? (
                      <div style={{ padding: "6px 8px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 13, fontWeight: 700, color: parseFloat(fl.computed) >= 30 ? "#dc2626" : parseFloat(fl.computed) >= 25 ? "#d97706" : "#059669" }}>
                        {fl.computed || "—"}
                      </div>
                    ) : (
                      <input type="text"
                        value={fl.isPf ? (f[fl.key] || "") : (visit?.[fl.key] || "")}
                        placeholder={fl.ph}
                        onChange={e => fl.isV ? updateVisit(fl.key, e.target.value) : update(fl.key, e.target.value)}
                        style={{ padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 12.5, fontFamily: "inherit", outline: "none", background: "#fff" }}
                        onFocus={e => { e.target.style.borderColor = "#2563eb"; }}
                        onBlur={e => { e.target.style.borderColor = "#e2e8f0"; }}
                      />
                    )}
                  </label>
                ));
              })()}
            </div>
          </div>

          {/* Visit history table */}
          <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ padding: "8px 14px", fontSize: 10.5, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: ".4px", borderBottom: "1px solid #e2e8f0", background: "#fafbfc" }}>
              Historique des visites ({visits.length})
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {["Date", "Poids", "Taille", "IMC", "TAS/TAD", "Glycémie", "FC", "Diagnostic"].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontWeight: 600, color: "#64748b", whiteSpace: "nowrap", borderBottom: "1px solid #e2e8f0", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".3px" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visits.length === 0 && (
                    <tr><td colSpan={8} style={{ padding: "20px 12px", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>Aucune visite enregistrée</td></tr>
                  )}
                  {visits.map(v => {
                    const vimc = calcIMC(v.poids, v.taille);
                    return (
                      <tr key={v.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "7px 10px", whiteSpace: "nowrap", fontWeight: 600 }}>{String(v.date_visite || "").slice(0, 10)}</td>
                        <td style={{ padding: "7px 10px" }}>{v.poids || "—"}</td>
                        <td style={{ padding: "7px 10px" }}>{v.taille || "—"}</td>
                        <td style={{ padding: "7px 10px", fontWeight: 600, color: parseFloat(vimc) >= 30 ? "#dc2626" : parseFloat(vimc) >= 25 ? "#d97706" : "#0f172a" }}>{vimc || "—"}</td>
                        <td style={{ padding: "7px 10px" }}>{v.tension || "—"}</td>
                        <td style={{ padding: "7px 10px" }}>{v.glycemie || "—"}</td>
                        <td style={{ padding: "7px 10px" }}>{v.frequence_cardiaque || "—"}</td>
                        <td style={{ padding: "7px 10px", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.diagnostics || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── RÈGLEMENT: Today's visit payment ── */}
      {bottomTab === "reglement" && (
        <div style={{ flex: 1, overflow: "auto", padding: "20px 24px", background: "#f8fafc" }}>
          {embeddedPanels?.reglement ? embeddedPanels.reglement : (
            <>
              {/* Current consultation */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 10 }}>Consultation du jour</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Type consultation</span>
                    <input value={visit?.visit_type || visit?.motif || ""} readOnly
                      style={{ padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 12, background: "#f8fafc" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Tarif (DA)</span>
                    <input type="number" value={visit?.visit_fee || ""} onChange={e => updateVisit("visit_fee", e.target.value)}
                      style={{ padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 12, background: "#fff", outline: "none" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Payé (DA)</span>
                    <input type="number" value={visit?.fee_paid || ""} onChange={e => updateVisit("fee_paid", e.target.value)}
                      style={{ padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 12, background: "#fff", outline: "none" }} />
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Reste</span>
                    <div style={{ padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 12, background: "#f8fafc", fontWeight: 700, color: (parseFloat(visit?.visit_fee || 0) - parseFloat(visit?.fee_paid || 0)) > 0 ? "#dc2626" : "#059669" }}>
                      {Math.max(0, (parseFloat(visit?.visit_fee || 0) - parseFloat(visit?.fee_paid || 0))).toLocaleString("fr-FR")} DA
                    </div>
                  </label>
                  <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#64748b", textTransform: "uppercase" }}>Mode paiement</span>
                    <select value={visit?.mode_paiement || ""} onChange={e => updateVisit("mode_paiement", e.target.value)}
                      style={{ padding: "6px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 12, background: "#fff", outline: "none" }}>
                      <option value="">—</option>
                      {["Espèces", "Chèque", "Carte", "Virement", "Gratuit"].map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                </div>
              </div>

              {/* Payment history table */}
              <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", fontSize: 10.5, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: ".4px", borderBottom: "1px solid #e2e8f0", background: "#fafbfc" }}>
                  Historique des règlements
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ background: "#f8fafc" }}>
                        {["Date", "Acte / Motif", "Montant", "Payé", "Reste", "Statut"].map(h => (
                          <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontWeight: 600, color: "#64748b", borderBottom: "1px solid #e2e8f0", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".3px" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {visits.length === 0 && (
                        <tr><td colSpan={6} style={{ padding: "20px 12px", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>Aucun règlement</td></tr>
                      )}
                      {visits.map(v => {
                        const honoraire = parseFloat(v.visit_fee || 0);
                        const paye = parseFloat(v.fee_paid || 0);
                        const reste = Math.max(0, honoraire - paye);
                        const isPaid = reste === 0 && honoraire > 0;
                        return (
                          <tr key={v.id} style={{ borderTop: "1px solid #f1f5f9" }}>
                            <td style={{ padding: "7px 10px", whiteSpace: "nowrap" }}>{String(v.date_visite || "").slice(0, 10)}</td>
                            <td style={{ padding: "7px 10px" }}>{v.motif || v.visit_type || "Consultation"}</td>
                            <td style={{ padding: "7px 10px", fontWeight: 600 }}>{honoraire > 0 ? honoraire.toLocaleString("fr-FR") + " DA" : "—"}</td>
                            <td style={{ padding: "7px 10px", color: "#059669", fontWeight: 600 }}>{paye > 0 ? paye.toLocaleString("fr-FR") + " DA" : "—"}</td>
                            <td style={{ padding: "7px 10px", color: reste > 0 ? "#dc2626" : "#64748b", fontWeight: reste > 0 ? 700 : 400 }}>{reste > 0 ? reste.toLocaleString("fr-FR") + " DA" : "0"}</td>
                            <td style={{ padding: "7px 10px" }}>
                              <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10.5, fontWeight: 700,
                                background: isPaid ? "#ecfdf5" : reste > 0 ? "#fef2f2" : "#f8fafc",
                                color: isPaid ? "#059669" : reste > 0 ? "#dc2626" : "#94a3b8" }}>
                                {isPaid ? "Payé" : reste > 0 ? "Impayé" : "—"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {/* Totals */}
                {visits.length > 0 && (() => {
                  const totalHon = visits.reduce((s, v) => s + parseFloat(v.visit_fee || 0), 0);
                  const totalPaye = visits.reduce((s, v) => s + parseFloat(v.fee_paid || 0), 0);
                  const totalReste = Math.max(0, totalHon - totalPaye);
                  return (
                    <div style={{ display: "flex", gap: 20, padding: "10px 14px", borderTop: "2px solid #e2e8f0", background: "#fafbfc", fontSize: 12.5, fontWeight: 700 }}>
                      <span>Total honoraires : <span style={{ color: "#0f172a" }}>{totalHon.toLocaleString("fr-FR")} DA</span></span>
                      <span>Total payé : <span style={{ color: "#059669" }}>{totalPaye.toLocaleString("fr-FR")} DA</span></span>
                      <span>Total impayé : <span style={{ color: totalReste > 0 ? "#dc2626" : "#64748b" }}>{totalReste.toLocaleString("fr-FR")} DA</span></span>
                    </div>
                  );
                })()}
              </div>
            </>
          )}
        </div>
      )}

      {/* ═══════════ BOTTOM ACTION BAR ═══════════ */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", background: "#fff", borderTop: "1px solid #dde3ef", flexShrink: 0 }}>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 24px", background: "linear-gradient(135deg, #1d4ed8, #2563eb)", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(29,78,216,.25)" }} onClick={patient?.id ? onSaveVisit : onSavePatient}>
          <Save size={14} /> {patient?.id ? "ENREGISTRER VISITE" : "CREER LE PATIENT"}
        </button>
        <button style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", background: "#fff", color: "#334155", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }} onClick={onRefreshPatient}>
          <RefreshCw size={14} /> ACTUALISER
        </button>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Date de consultation :</span>
          <input type="datetime-local"
            value={String(visit?.date_visite || "").replace(" ", "T").slice(0, 16)}
            onChange={e => updateVisit("date_visite", e.target.value)}
            style={{ padding: "7px 10px", border: "1px solid #cbd5e1", borderRadius: 6, fontSize: 12, outline: "none", background: "#fff", fontFamily: "inherit" }}
          />
          <button style={{ background: "none", border: "1px solid #cbd5e1", borderRadius: 4, padding: "5px 7px", cursor: "pointer", color: "#64748b" }}>
            <Calendar size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
