import React, { useState, useEffect } from "react";
import { Save, CheckCircle2 } from "lucide-react";

const API = window.__TAURI__ ? "" : "http://127.0.0.1:8000";
async function apiCall(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) { const e = await res.json().catch(() => ({ detail: res.statusText })); throw new Error(e.detail || res.statusText); }
  return res.json();
}

function FieldInput({ field, value, onChange }) {
  const { type, options = [], unit, label } = field;
  const base = "spec-input";

  if (type === "select") {
    return (
      <select className={base} value={value || ""} onChange={e => onChange(e.target.value)}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  }
  if (type === "textarea") {
    return (
      <textarea className={`${base} spec-input--textarea`} value={value || ""}
        onChange={e => onChange(e.target.value)} rows={3}
        placeholder={`${label}…`}/>
    );
  }
  if (type === "boolean") {
    return (
      <label className="spec-bool">
        <input type="checkbox" checked={!!value} onChange={e => onChange(e.target.checked ? "Oui" : "Non")}/>
        <span>{value === "Oui" ? "Oui" : "Non"}</span>
      </label>
    );
  }
  return (
    <div className="spec-input-wrap">
      <input className={base} type={type === "number" ? "number" : type === "date" ? "date" : "text"}
        value={value || ""} onChange={e => onChange(e.target.value)}
        placeholder={unit ? `ex: 120` : `${label}…`}/>
      {unit && <span className="spec-unit">{unit}</span>}
    </div>
  );
}

export default function SpecialityFieldsPanel({ patient, specialityConfig }) {
  const [data, setData] = useState({});
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!patient?.id) return;
    apiCall(`/api/patients/${patient.id}/specialty-data`)
      .then(d => setData(d.data || {}))
      .catch(() => {});
  }, [patient?.id]);

  const setValue = (key, val) => {
    setData(prev => ({ ...prev, [key]: val }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiCall(`/api/patients/${patient.id}/specialty-data`, {
        method: "PUT",
        body: JSON.stringify({ speciality: specialityConfig.id, data }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch(e) {
      console.error(e);
    }
    setSaving(false);
  };

  if (!specialityConfig?.extra_fields?.length) {
    return (
      <div className="spec-empty">
        <span>Aucun champ spécifique pour cette spécialité.</span>
      </div>
    );
  }

  return (
    <div className="spec-panel">
      <div className="spec-panel__header">
        <h2>{specialityConfig.specialty_tab_label || "Données Spécialité"}</h2>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {saved && <span className="spec-saved"><CheckCircle2 size={13}/> Enregistré</span>}
          <button className="spec-save-btn" disabled={saving || !patient?.id} onClick={handleSave}>
            <Save size={14}/> {saving ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>

      <div className="spec-groups">
        {specialityConfig.extra_fields.map(group => (
          <div key={group.group} className="spec-group">
            <h3 className="spec-group__title">{group.group}</h3>
            <div className="spec-group__fields">
              {group.fields.map(field => (
                <div key={field.key} className="spec-field">
                  <label className="spec-field__label">{field.label}</label>
                  <FieldInput field={field} value={data[field.key]}
                    onChange={val => setValue(field.key, val)}/>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
