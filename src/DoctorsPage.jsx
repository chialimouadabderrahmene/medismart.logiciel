import { useEffect, useState } from "react";
import {
  UserRound, Plus, Edit3, X, Save, Phone, Mail, MapPin, Award,
  CheckCircle2, XCircle, Star, Loader2, AlertTriangle
} from "lucide-react";
import { api } from "./api.js";

// ════════════════════════════════════════════════════════════════════════
// DoctorsPage — full CRUD for doctors (médecins) stored in DB
// Real data: GET /api/doctors, POST/PUT/DELETE /api/doctors/{id}
// ════════════════════════════════════════════════════════════════════════
export default function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null); // null | "new" | doctor object
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await api.doctors(0);
      setDoctors(data.rows || []);
    } catch (e) {
      setError(`Impossible de charger les médecins: ${e.message}`);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(form) {
    setSaving(true);
    try {
      if (form.id) {
        await api.updateDoctor(form.id, form);
      } else {
        await api.createDoctor(form);
      }
      setEditing(null);
      await load();
    } catch (e) {
      alert(`Erreur: ${e.message}`);
    }
    setSaving(false);
  }

  async function handleDeactivate(doctor) {
    if (!window.confirm(`Désactiver le Dr. ${doctor.name} ? L'historique reste préservé.`)) return;
    try {
      await api.deactivateDoctor(doctor.id);
      await load();
    } catch (e) {
      alert(`Erreur: ${e.message}`);
    }
  }

  async function handleSetDefault(doctor) {
    try {
      await api.updateDoctor(doctor.id, { ...doctor, is_default: 1 });
      await load();
    } catch (e) {
      alert(`Erreur: ${e.message}`);
    }
  }

  return (
    <div style={{ padding: "20px 24px", height: "100%", overflow: "auto", background: "#f8fafc" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
            <UserRound size={22} /> Médecins du cabinet
          </h1>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
            {doctors.length} médecin{doctors.length > 1 ? "s" : ""} enregistré{doctors.length > 1 ? "s" : ""} ·
            {" "}{doctors.filter(d => d.is_active).length} actif{doctors.filter(d => d.is_active).length > 1 ? "s" : ""}
          </div>
        </div>
        <button onClick={() => setEditing("new")}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 16px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          <Plus size={15} /> Ajouter un médecin
        </button>
      </div>

      {error && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#991b1b", marginBottom: 14, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94a3b8" }}>
          <Loader2 size={28} className="imp-spin" />
        </div>
      ) : doctors.length === 0 ? (
        <div style={{ background: "#fff", border: "1px dashed #cbd5e1", borderRadius: 12, padding: "50px 20px", textAlign: "center" }}>
          <UserRound size={40} color="#cbd5e1" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: "#475569", marginBottom: 4 }}>Aucun médecin enregistré</div>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>Cliquez sur « Ajouter un médecin » pour créer le premier profil.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(340px,1fr))", gap: 14 }}>
          {doctors.map((doc) => (
            <DoctorCard key={doc.id} doctor={doc}
              onEdit={() => setEditing(doc)}
              onDeactivate={() => handleDeactivate(doc)}
              onSetDefault={() => handleSetDefault(doc)} />
          ))}
        </div>
      )}

      {editing && (
        <DoctorEditor
          initial={editing === "new" ? {} : editing}
          saving={saving}
          onCancel={() => setEditing(null)}
          onSave={handleSave} />
      )}
    </div>
  );
}

function DoctorCard({ doctor, onEdit, onDeactivate, onSetDefault }) {
  const inactive = !doctor.is_active;
  return (
    <article style={{
      background: "#fff", border: `1px solid ${doctor.is_default ? "#fbbf24" : "#eef2f7"}`,
      borderRadius: 12, padding: 16, opacity: inactive ? 0.6 : 1,
      boxShadow: doctor.is_default ? "0 0 0 3px rgba(251,191,36,.15)" : "0 1px 3px rgba(0,0,0,.04)"
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            <strong style={{ fontSize: 15, color: "#0f172a" }}>Dr. {doctor.name}</strong>
            {doctor.is_default ? (
              <span style={{ fontSize: 10, background: "#fef3c7", color: "#b45309", padding: "2px 7px", borderRadius: 20, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 3 }}>
                <Star size={10} fill="#b45309" /> Par défaut
              </span>
            ) : null}
            {inactive ? (
              <span style={{ fontSize: 10, background: "#f3f4f6", color: "#6b7280", padding: "2px 7px", borderRadius: 20, fontWeight: 700 }}>Inactif</span>
            ) : null}
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 3 }}>{doctor.speciality || "Spécialité non précisée"}</div>
        </div>
        <button onClick={onEdit}
          style={{ padding: 7, background: "#f1f5f9", color: "#475569", border: "none", borderRadius: 6, cursor: "pointer", display: "flex" }}>
          <Edit3 size={13} />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, color: "#475569" }}>
        {doctor.phone && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone size={12} /> {doctor.phone}</div>}
        {doctor.email && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Mail size={12} /> {doctor.email}</div>}
        {doctor.address && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={12} /> {doctor.address}</div>}
        {doctor.order_number && <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Award size={12} /> N° Ordre: {doctor.order_number}</div>}
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 12, paddingTop: 10, borderTop: "1px solid #f1f5f9" }}>
        {!doctor.is_default && doctor.is_active && (
          <button onClick={onSetDefault}
            style={{ flex: 1, padding: "6px 10px", background: "#fff", color: "#b45309", border: "1px solid #fcd34d", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <Star size={11} /> Par défaut
          </button>
        )}
        {doctor.is_active && (
          <button onClick={onDeactivate}
            style={{ flex: 1, padding: "6px 10px", background: "#fff", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
            <XCircle size={11} /> Désactiver
          </button>
        )}
      </div>
    </article>
  );
}

function DoctorEditor({ initial, saving, onCancel, onSave }) {
  const [form, setForm] = useState({
    id: initial.id,
    name: initial.name || "",
    speciality: initial.speciality || "",
    phone: initial.phone || "",
    email: initial.email || "",
    address: initial.address || "",
    order_number: initial.order_number || "",
    is_active: initial.is_active ?? 1,
    is_default: initial.is_default ?? 0,
  });
  const update = (k, v) => setForm((c) => ({ ...c, [k]: v }));

  function submit() {
    if (!form.name.trim()) { alert("Le nom est requis."); return; }
    onSave(form);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 1000 }}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 540, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid #eef2f7" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
            {form.id ? "Modifier le médecin" : "Nouveau médecin"}
          </h3>
          <button onClick={onCancel} style={{ background: "none", border: "none", padding: 4, cursor: "pointer", color: "#64748b" }}>
            <X size={18} />
          </button>
        </header>

        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <Field label="Nom complet *" wide value={form.name} onChange={(v) => update("name", v)} />
          <Field label="Spécialité" value={form.speciality} onChange={(v) => update("speciality", v)} />
          <Field label="N° Ordre" value={form.order_number} onChange={(v) => update("order_number", v)} />
          <Field label="Téléphone" value={form.phone} onChange={(v) => update("phone", v)} />
          <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} />
          <Field label="Adresse" wide value={form.address} onChange={(v) => update("address", v)} />

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569", gridColumn: "1 / -1", padding: "8px 10px", background: "#f8fafc", borderRadius: 7 }}>
            <input type="checkbox" checked={!!form.is_active} onChange={(e) => update("is_active", e.target.checked ? 1 : 0)} />
            Médecin actif
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569", gridColumn: "1 / -1", padding: "8px 10px", background: "#fffbeb", borderRadius: 7 }}>
            <input type="checkbox" checked={!!form.is_default} onChange={(e) => update("is_default", e.target.checked ? 1 : 0)} />
            <Star size={13} fill="#b45309" color="#b45309" /> Médecin par défaut (utilisé sur les ordonnances et documents)
          </label>
        </div>

        <footer style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid #eef2f7", background: "#f8fafc" }}>
          <button onClick={onCancel} disabled={saving}
            style={{ padding: "9px 16px", background: "#fff", color: "#475569", border: "1px solid #cbd5e1", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            Annuler
          </button>
          <button onClick={submit} disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 16px", background: "#059669", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
            {saving ? <><Loader2 size={14} className="imp-spin" /> Enregistrement…</> : <><Save size={14} /> Enregistrer</>}
          </button>
        </footer>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", wide = false }) {
  return (
    <div style={{ gridColumn: wide ? "1 / -1" : undefined }}>
      <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 5 }}>
        {label}
      </label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        style={{ width: "100%", padding: "8px 11px", border: "1px solid #cbd5e1", borderRadius: 7, fontSize: 13.5 }} />
    </div>
  );
}
