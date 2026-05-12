// ═══════════════════════════════════════════════════════════════════════════
// Modern patient navigation pages for MediSmart Pro.
// - PatientsListPage       : Liste des patients (search, filters, modal)
// - TodayPatientsPage      : Patients vus aujourd'hui (visits + payments)
// - AppointmentsPageV2     : Rendez-vous (filters, modal)
// Style: white bg, soft blue accents, rounded cards, compact tables.
// ═══════════════════════════════════════════════════════════════════════════
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Search, Plus, X, Users, CalendarDays, Phone, FileText, Pill,
  Eye, FolderOpen, Stethoscope, AlertTriangle, CreditCard, Printer,
  Trash2, Edit3, CheckCircle, RefreshCw, ChevronLeft, ChevronRight,
  Clock, DollarSign, User as UserIcon, Filter, Loader2,
} from "lucide-react";
import { api } from "./api.js";

// ── Shared palette ──────────────────────────────────────────────────────────
const C = {
  ink: "#0f172a",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e5e7eb",
  lineSoft: "#f1f5f9",
  soft: "#f8fafc",
  bg: "#ffffff",
  blue: "#1e40af",
  blueBright: "#2563eb",
  blueSoft: "#eff6ff",
  blueBorder: "#bfdbfe",
  red: "#dc2626",
  redSoft: "#fef2f2",
  amber: "#d97706",
  amberSoft: "#fffbeb",
  green: "#059669",
  greenSoft: "#ecfdf5",
};

const fmtNum = (n) => Number(n || 0).toLocaleString("fr-DZ");
const fmtMoney = (n) => `${fmtNum(n)} DA`;
const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(String(iso).replace(" ", "T"));
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};
const fmtTime = (iso) => {
  if (!iso) return "—";
  const s = String(iso).replace(" ", "T");
  return s.slice(11, 16) || "—";
};

// ── Tiny UI primitives ──────────────────────────────────────────────────────
function PageHeader({ title, subtitle, icon: Icon = Users, children }) {
  return (
    <header style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      gap: 18, padding: "18px 22px",
      background: "#fff", borderBottom: `1px solid ${C.line}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 11,
          background: C.blueSoft, color: C.blue,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={20} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 19, fontWeight: 700, color: C.ink, letterSpacing: "-.01em" }}>{title}</h1>
          {subtitle && <div style={{ marginTop: 2, fontSize: 13, color: C.muted }}>{subtitle}</div>}
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>{children}</div>
    </header>
  );
}

function SearchBox({ value, onChange, placeholder, autoFocusRef }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "9px 13px",
      background: "#fff",
      border: `1px solid ${C.line}`,
      borderRadius: 10,
      flex: 1, minWidth: 260,
      transition: "border-color .15s, box-shadow .15s",
    }}
      onFocus={(e) => { e.currentTarget.style.borderColor = C.blueBright; e.currentTarget.style.boxShadow = `0 0 0 3px ${C.blueSoft}`; }}
      onBlur={(e) => { e.currentTarget.style.borderColor = C.line; e.currentTarget.style.boxShadow = "none"; }}
    >
      <Search size={15} color={C.muted} />
      <input
        ref={autoFocusRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ flex: 1, border: "none", outline: "none", fontSize: 13.5, color: C.ink, background: "transparent", fontFamily: "inherit" }}
      />
      {value && (
        <button onClick={() => onChange("")} title="Effacer" style={{
          padding: 3, borderRadius: 6, border: "none", background: C.soft, color: C.muted, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <X size={13} />
        </button>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: "7px 14px",
      background: active ? C.blueBright : "#fff",
      color: active ? "#fff" : C.muted,
      border: `1px solid ${active ? C.blueBright : C.line}`,
      borderRadius: 999,
      fontSize: 12.5,
      fontWeight: active ? 700 : 500,
      cursor: "pointer",
      transition: "all .15s",
      whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function PrimaryButton({ onClick, icon: Icon, children, tone = "blue", size = "md" }) {
  const styles = {
    blue:  { bg: C.blueBright, fg: "#fff", shadow: "0 2px 6px rgba(37,99,235,.25)" },
    ghost: { bg: "#fff", fg: C.blue, shadow: "none", border: C.blueBorder },
    red:   { bg: C.red, fg: "#fff", shadow: "0 2px 6px rgba(220,38,38,.25)" },
    muted: { bg: C.soft, fg: C.ink, shadow: "none", border: C.line },
  }[tone];
  const sz = size === "sm" ? { pad: "6px 10px", font: 12 } : { pad: "9px 16px", font: 13 };
  return (
    <button onClick={onClick} style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: sz.pad,
      background: styles.bg, color: styles.fg,
      border: styles.border ? `1px solid ${styles.border}` : "none",
      borderRadius: 8,
      fontSize: sz.font, fontWeight: 600,
      cursor: "pointer",
      boxShadow: styles.shadow,
      whiteSpace: "nowrap",
    }}>
      {Icon && <Icon size={sz.font + 2} />} {children}
    </button>
  );
}

function IconAction({ icon: Icon, title, onClick, tone = "muted" }) {
  const color = { muted: C.muted, blue: C.blue, red: C.red, green: C.green }[tone];
  return (
    <button onClick={onClick} title={title} style={{
      width: 28, height: 28, borderRadius: 7, border: `1px solid ${C.line}`,
      background: "#fff", color,
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      cursor: "pointer",
      transition: "background .15s, border-color .15s",
    }}
      onMouseEnter={(e) => { e.currentTarget.style.background = C.soft; e.currentTarget.style.borderColor = color; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.borderColor = C.line; }}
    ><Icon size={14} /></button>
  );
}

function StatusBadge({ status }) {
  const map = {
    paid:       { label: "Payé",      bg: C.greenSoft, color: C.green },
    partial:    { label: "Partiel",   bg: C.amberSoft, color: C.amber },
    pending:    { label: "En attente", bg: C.redSoft,  color: C.red },
    urgent:     { label: "Urgent",    bg: C.redSoft,   color: C.red },
    done:       { label: "Terminé",   bg: C.greenSoft, color: C.green },
    normal:     { label: "Planifié",  bg: C.blueSoft,  color: C.blue },
    cancelled:  { label: "Annulé",    bg: C.lineSoft,  color: C.muted },
  };
  const s = map[status] || { label: status || "—", bg: C.lineSoft, color: C.muted };
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 999,
      fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.color,
    }}>{s.label}</span>
  );
}

// Standard modal shell
function Modal({ open, onClose, title, icon: Icon, children, footer, width = 560 }) {
  if (!open) return null;
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,.55)",
      zIndex: 9000, display: "flex", alignItems: "center", justifyContent: "center",
      backdropFilter: "blur(4px)", padding: 20,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 14,
        width: `min(${width}px, 100%)`, maxHeight: "88vh", overflow: "hidden",
        boxShadow: "0 25px 50px rgba(0,0,0,.25)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "13px 18px", borderBottom: `1px solid ${C.line}`,
          background: C.blueSoft, flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {Icon && <Icon size={16} color={C.blue} />}
            <strong style={{ color: C.blue, fontSize: 14.5 }}>{title}</strong>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: C.muted }}><X size={15} /></button>
        </div>
        <div style={{ padding: 18, overflow: "auto", flex: 1, minHeight: 0 }}>{children}</div>
        {footer && <div style={{
          display: "flex", gap: 8, flexWrap: "wrap",
          padding: "12px 18px", borderTop: `1px solid ${C.line}`,
          background: C.soft, justifyContent: "flex-end",
          flexShrink: 0,
        }}>{footer}</div>}
      </div>
    </div>
  );
}

const tableStyles = {
  wrap: {
    background: "#fff", border: `1px solid ${C.line}`, borderRadius: 12,
    overflow: "hidden", margin: "16px 22px",
    boxShadow: "0 1px 2px rgba(15,23,42,.04)",
  },
  scroll: { overflow: "auto", maxHeight: "calc(100vh - 320px)" },
  table:  { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  thead:  {
    position: "sticky", top: 0, zIndex: 2,
    background: C.soft,
    color: C.muted,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: ".5px",
    fontWeight: 700,
  },
  th:     { padding: "11px 14px", textAlign: "left", borderBottom: `1px solid ${C.line}` },
  td:     { padding: "11px 14px", color: C.ink, whiteSpace: "nowrap" },
  rowHover: (selected) => ({
    borderBottom: `1px solid ${C.lineSoft}`,
    background: selected ? C.blueSoft : "#fff",
    cursor: "pointer",
    transition: "background .12s",
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// 1) LISTE DES PATIENTS
// ═══════════════════════════════════════════════════════════════════════════
export function PatientsListPage({
  patients, total, search, setSearch,
  offset, pageSize, hasMore, onNext, onPrev,
  onOpen, onNewPatient, onBack, onOpenWithTab,
}) {
  const [detailsPatient, setDetailsPatient] = useState(null);
  const searchRef = useRef(null);

  // Keyboard: "/" focus search, Escape closes modal
  useEffect(() => {
    const handler = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing = tag === "input" || tag === "textarea";
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape" && detailsPatient) setDetailsPatient(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [detailsPatient]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: C.soft }}>
      <PageHeader title="Liste des Patients" subtitle={`${fmtNum(total)} patient(s) enregistré(s)`} icon={Users}>
        {onBack && <PrimaryButton onClick={onBack} tone="muted" icon={ChevronLeft}>Retour dossier</PrimaryButton>}
        <PrimaryButton onClick={onNewPatient} tone="blue" icon={Plus}>Nouveau patient</PrimaryButton>
      </PageHeader>

      {/* Toolbar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "14px 22px", background: "#fff", borderBottom: `1px solid ${C.line}` }}>
        <SearchBox
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par nom, prénom, téléphone, numéro dossier…"
          autoFocusRef={searchRef}
        />
        <span style={{ fontSize: 12, color: C.muted, whiteSpace: "nowrap", marginLeft: 6 }}>
          {patients.length} affiché(s) / {fmtNum(total)}
        </span>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
        <div style={tableStyles.wrap}>
          <div style={tableStyles.scroll}>
            <table style={tableStyles.table}>
              <thead style={tableStyles.thead}>
                <tr>
                  <th style={tableStyles.th}>Num. dossier</th>
                  <th style={tableStyles.th}>Nom</th>
                  <th style={tableStyles.th}>Prénom</th>
                  <th style={tableStyles.th}>Date naiss.</th>
                  <th style={tableStyles.th}>Âge</th>
                  <th style={tableStyles.th}>Profession</th>
                  <th style={tableStyles.th}>Téléphone</th>
                  <th style={tableStyles.th}>Adresse</th>
                  <th style={tableStyles.th}>Dernière visite</th>
                  <th style={{ ...tableStyles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {patients.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ padding: 40, textAlign: "center", color: C.faint, fontStyle: "italic" }}>
                      {search ? "Aucun patient ne correspond à la recherche." : "Aucun patient dans la base."}
                    </td>
                  </tr>
                )}
                {patients.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onOpen(p.id)}
                    onDoubleClick={() => onOpen(p.id)}
                    style={tableStyles.rowHover(false)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.blueSoft; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
                  >
                    <td style={{ ...tableStyles.td, fontWeight: 600, color: C.blue }}>{p.code || `#${p.id}`}</td>
                    <td style={{ ...tableStyles.td, fontWeight: 600 }}>{p.nom || "—"}</td>
                    <td style={tableStyles.td}>{p.prenom || "—"}</td>
                    <td style={tableStyles.td}>{p.date_naissance ? fmtDate(p.date_naissance) : "—"}</td>
                    <td style={tableStyles.td}>{p.age ? `${p.age} ans` : "—"}</td>
                    <td style={tableStyles.td}>{p.profession || "—"}</td>
                    <td style={tableStyles.td}>{p.telephone || "—"}</td>
                    <td style={{ ...tableStyles.td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{p.adresse || "—"}</td>
                    <td style={tableStyles.td}>{p.last_visit_date ? fmtDate(p.last_visit_date) : p.updated_at ? fmtDate(p.updated_at) : "—"}</td>
                    <td style={{ ...tableStyles.td, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <IconAction icon={FolderOpen} title="Ouvrir" tone="blue" onClick={() => onOpen(p.id)} />
                        <IconAction icon={Stethoscope} title="Nouvelle visite" tone="green" onClick={() => onOpenWithTab?.(p.id, "new-visit") || onOpen(p.id)} />
                        <IconAction icon={Pill} title="Ordonnance" tone="blue" onClick={() => onOpenWithTab?.(p.id, "templates") || onOpen(p.id)} />
                        <IconAction icon={Eye} title="Voir détails" onClick={() => setDetailsPatient(p)} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Pagination */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
        padding: "12px 22px", background: "#fff", borderTop: `1px solid ${C.line}`,
      }}>
        <span style={{ fontSize: 12.5, color: C.muted }}>
          Page {Math.floor(offset / pageSize) + 1} — {patients.length} / {fmtNum(total)} patients
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <PrimaryButton onClick={onPrev} tone="muted" icon={ChevronLeft} size="sm">Précédent</PrimaryButton>
          <PrimaryButton onClick={onNext} tone="muted" icon={ChevronRight} size="sm">Suivant</PrimaryButton>
        </div>
      </div>

      {/* Details modal */}
      <PatientDetailsModal
        patient={detailsPatient}
        onClose={() => setDetailsPatient(null)}
        onOpen={(id) => { setDetailsPatient(null); onOpen(id); }}
        onOpenWithTab={(id, tab) => { setDetailsPatient(null); (onOpenWithTab || onOpen)(id, tab); }}
      />
    </div>
  );
}

// ─── Patient details modal ─────────────────────────────────────────────────
function PatientDetailsModal({ patient, onClose, onOpen, onOpenWithTab }) {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!patient?.id) return;
    setLoading(true);
    setSummary(null);
    api.patientQuickSummary(patient.id)
      .then(setSummary)
      .catch(() => setSummary({ error: true }))
      .finally(() => setLoading(false));
  }, [patient?.id]);

  const p = summary?.patient || patient;
  if (!patient) return null;

  return (
    <Modal
      open={!!patient}
      onClose={onClose}
      title="Aperçu du patient"
      icon={UserIcon}
      width={640}
      footer={
        <>
          <PrimaryButton onClick={() => onOpenWithTab(patient.id, "templates")} tone="ghost" icon={Pill}>Ordonnance</PrimaryButton>
          <PrimaryButton onClick={() => onOpenWithTab(patient.id, "docs")} tone="ghost" icon={FileText}>Documents</PrimaryButton>
          <PrimaryButton onClick={() => onOpenWithTab(patient.id, "caisse")} tone="ghost" icon={CreditCard}>Caisse</PrimaryButton>
          <PrimaryButton onClick={() => onOpenWithTab(patient.id, "new-visit")} tone="ghost" icon={Stethoscope}>Nouvelle visite</PrimaryButton>
          <PrimaryButton onClick={() => onOpen(patient.id)} tone="blue" icon={FolderOpen}>Ouvrir dossier</PrimaryButton>
        </>
      }
    >
      {loading && <div style={{ color: C.muted, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> Chargement…</div>}
      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Identity */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{
              width: 50, height: 50, borderRadius: 12,
              background: C.blueSoft, color: C.blue,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, fontWeight: 700,
            }}>
              {(p.prenom || "?").charAt(0).toUpperCase()}{(p.nom || "").charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>{[p.prenom, p.nom].filter(Boolean).join(" ") || "Patient"}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                <strong style={{ color: C.blue }}>{p.code || `#${p.id}`}</strong>
                {p.age && ` · ${p.age} ans`}
                {p.sexe && ` · ${p.sexe}`}
                {p.telephone && ` · ${p.telephone}`}
              </div>
            </div>
          </div>

          {/* Notes importantes */}
          {(p.notes_importantes || p.allergies) && (
            <div style={{
              padding: "10px 12px", background: C.redSoft, border: "1px solid #fecaca",
              borderLeft: `3px solid ${C.red}`, borderRadius: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 4 }}>
                ⚠ Notes importantes
              </div>
              <div style={{ fontSize: 13, color: C.ink, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {p.notes_importantes || p.allergies}
              </div>
            </div>
          )}

          {/* Last visit */}
          {summary?.last_visit && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 5 }}>Dernière visite</div>
              <div style={{ padding: "10px 12px", background: C.soft, borderRadius: 8, border: `1px solid ${C.line}` }}>
                <div style={{ fontSize: 12.5, color: C.muted }}>
                  {fmtDate(summary.last_visit.date_visite)}
                  {summary.last_visit.motif && ` · ${summary.last_visit.motif}`}
                </div>
                {summary.last_visit.diagnostics && (
                  <div style={{ fontSize: 13, color: C.ink, marginTop: 4, whiteSpace: "pre-wrap" }}>{summary.last_visit.diagnostics}</div>
                )}
              </div>
            </div>
          )}

          {/* Last prescription */}
          {summary?.last_prescription && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".4px", marginBottom: 5 }}>Dernière ordonnance</div>
              <div style={{ padding: "10px 12px", background: C.greenSoft, borderRadius: 8, border: "1px solid #a7f3d0", fontSize: 12.5 }}>
                {fmtDate(summary.last_prescription.created_at)}
              </div>
            </div>
          )}

          {/* Summary stats */}
          {summary && !summary.error && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              <StatMini label="Visites" value={summary.visit_count} color={C.blue} bg={C.blueSoft} />
              <StatMini label="Documents" value={summary.documents_count} color="#7c3aed" bg="#f5f3ff" />
              <StatMini label="Payé" value={fmtMoney(summary.total_paid)} color={C.green} bg={C.greenSoft} small />
              <StatMini label="Reste" value={fmtMoney(summary.total_due)} color={summary.total_due > 0 ? C.red : C.muted} bg={summary.total_due > 0 ? C.redSoft : C.soft} small />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function StatMini({ label, value, color, bg, small }) {
  return (
    <div style={{
      padding: "10px 8px", borderRadius: 9, background: bg, textAlign: "center",
      border: `1px solid ${color}20`,
    }}>
      <div style={{ fontSize: small ? 13 : 19, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginTop: 3 }}>{label}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 2) PATIENTS VUS AUJOURD'HUI
// ═══════════════════════════════════════════════════════════════════════════
export function TodayPatientsPage({ onOpenPatient, onOpenWithTab }) {
  const [period, setPeriod] = useState("today"); // today | yesterday | week | custom
  const [customDate, setCustomDate] = useState("");
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({ count: 0, total_fees: 0, total_paid: 0, total_due: 0 });
  const [loading, setLoading] = useState(false);
  const [detailVisit, setDetailVisit] = useState(null);

  function computeDate() {
    if (period === "today") return "";
    if (period === "yesterday") {
      const d = new Date(); d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    }
    if (period === "custom") return customDate || "";
    return "";
  }

  async function load() {
    setLoading(true);
    try {
      if (period === "week") {
        // week: fetch last 7 days by asking each day — keep simple: just fetch today and filter
        // Simpler: call visits endpoint per day of the last 7 days
        const days = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          days.push(d.toISOString().slice(0, 10));
        }
        const results = await Promise.all(days.map((d) => api.visitsToday(d).catch(() => ({ rows: [] }))));
        const combined = results.flatMap((r) => r.rows || []);
        const fees = combined.reduce((s, r) => s + (Number(r.visit_fee) || 0), 0);
        const paid = combined.reduce((s, r) => s + (Number(r.fee_paid) || 0), 0);
        setRows(combined);
        setStats({ count: combined.length, total_fees: fees, total_paid: paid, total_due: Math.max(fees - paid, 0) });
      } else {
        const data = await api.visitsToday(computeDate());
        setRows(data.rows || []);
        setStats({
          count: data.count || 0,
          total_fees: data.total_fees || 0,
          total_paid: data.total_paid || 0,
          total_due: data.total_due || 0,
        });
      }
    } catch (e) {
      setRows([]);
      setStats({ count: 0, total_fees: 0, total_paid: 0, total_due: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [period, customDate]);

  const periodLabel = {
    today: "Aujourd'hui",
    yesterday: "Hier",
    week: "Cette semaine",
    custom: customDate ? fmtDate(customDate) : "Date personnalisée",
  }[period];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: C.soft }}>
      <PageHeader
        title="Patients vus aujourd'hui"
        subtitle={`${fmtNum(stats.count)} consultation(s) · ${periodLabel}`}
        icon={Stethoscope}
      >
        <PrimaryButton onClick={load} tone="ghost" icon={RefreshCw} size="sm">Actualiser</PrimaryButton>
      </PageHeader>

      {/* Stats cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12,
        padding: "16px 22px", background: "#fff", borderBottom: `1px solid ${C.line}`,
      }}>
        <StatCard icon={Users} label="Patients aujourd'hui" value={stats.count} color={C.blue} bg={C.blueSoft} />
        <StatCard icon={DollarSign} label="Total honoraires" value={fmtMoney(stats.total_fees)} color={C.blue} bg={C.blueSoft} />
        <StatCard icon={CheckCircle} label="Total payé" value={fmtMoney(stats.total_paid)} color={C.green} bg={C.greenSoft} />
        <StatCard icon={AlertTriangle} label="Reste / impayé" value={fmtMoney(stats.total_due)} color={stats.total_due > 0 ? C.red : C.muted} bg={stats.total_due > 0 ? C.redSoft : C.soft} />
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", gap: 8, alignItems: "center", padding: "12px 22px",
        background: "#fff", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap",
      }}>
        <Filter size={15} color={C.muted} />
        <FilterChip active={period === "today"} onClick={() => setPeriod("today")}>Aujourd'hui</FilterChip>
        <FilterChip active={period === "yesterday"} onClick={() => setPeriod("yesterday")}>Hier</FilterChip>
        <FilterChip active={period === "week"} onClick={() => setPeriod("week")}>Cette semaine</FilterChip>
        <FilterChip active={period === "custom"} onClick={() => setPeriod("custom")}>Date personnalisée</FilterChip>
        {period === "custom" && (
          <input
            type="date" value={customDate} onChange={(e) => setCustomDate(e.target.value)}
            style={{ padding: "6px 10px", border: `1px solid ${C.line}`, borderRadius: 7, fontSize: 12.5 }}
          />
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={tableStyles.wrap}>
          <div style={tableStyles.scroll}>
            <table style={tableStyles.table}>
              <thead style={tableStyles.thead}>
                <tr>
                  <th style={tableStyles.th}>N°</th>
                  <th style={tableStyles.th}>Heure</th>
                  <th style={tableStyles.th}>Dossier</th>
                  <th style={tableStyles.th}>Nom</th>
                  <th style={tableStyles.th}>Prénom</th>
                  <th style={tableStyles.th}>Type acte</th>
                  <th style={tableStyles.th}>Acte réalisé</th>
                  <th style={{ ...tableStyles.th, textAlign: "right" }}>Montant</th>
                  <th style={{ ...tableStyles.th, textAlign: "right" }}>Payé</th>
                  <th style={{ ...tableStyles.th, textAlign: "right" }}>Reste</th>
                  <th style={tableStyles.th}>Mode</th>
                  <th style={tableStyles.th}>Statut</th>
                  <th style={{ ...tableStyles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={13} style={{ padding: 30, textAlign: "center", color: C.muted }}>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite", verticalAlign: "middle" }} /> Chargement…
                  </td></tr>
                )}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={13} style={{ padding: 40, textAlign: "center", color: C.faint, fontStyle: "italic" }}>
                    Aucune consultation pour cette période.
                  </td></tr>
                )}
                {!loading && rows.map((v, i) => {
                  const reste = Math.max((Number(v.visit_fee) || 0) - (Number(v.fee_paid) || 0), 0);
                  return (
                    <tr key={v.visit_id} onClick={() => setDetailVisit(v)} style={tableStyles.rowHover(false)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = C.blueSoft; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
                    >
                      <td style={{ ...tableStyles.td, color: C.muted }}>{i + 1}</td>
                      <td style={tableStyles.td}>{fmtTime(v.date_visite)}</td>
                      <td style={{ ...tableStyles.td, fontWeight: 600, color: C.blue }}>{v.code || `#${v.patient_id}`}</td>
                      <td style={{ ...tableStyles.td, fontWeight: 600 }}>{v.prenom || "—"}</td>
                      <td style={tableStyles.td}>{v.nom || "—"}</td>
                      <td style={tableStyles.td}>{v.visit_type || "—"}</td>
                      <td style={{ ...tableStyles.td, maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}>{v.motif || v.diagnostics || "—"}</td>
                      <td style={{ ...tableStyles.td, textAlign: "right" }}>{fmtMoney(v.visit_fee)}</td>
                      <td style={{ ...tableStyles.td, textAlign: "right", color: C.green }}>{fmtMoney(v.fee_paid)}</td>
                      <td style={{ ...tableStyles.td, textAlign: "right", color: reste > 0 ? C.red : C.muted, fontWeight: reste > 0 ? 700 : 500 }}>{fmtMoney(reste)}</td>
                      <td style={tableStyles.td}>{v.payment_method || "—"}</td>
                      <td style={tableStyles.td}><StatusBadge status={v.payment_status || "pending"} /></td>
                      <td style={{ ...tableStyles.td, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "inline-flex", gap: 4 }}>
                          <IconAction icon={FolderOpen} title="Ouvrir dossier" tone="blue" onClick={() => onOpenPatient(v.patient_id)} />
                          <IconAction icon={CreditCard} title="Caisse" tone="green" onClick={() => onOpenWithTab?.(v.patient_id, "caisse")} />
                          <IconAction icon={Printer} title="Imprimer reçu" onClick={() => window.print()} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Visit modal */}
      <VisitDetailsModal visit={detailVisit} onClose={() => setDetailVisit(null)} onOpenPatient={(id) => { setDetailVisit(null); onOpenPatient(id); }} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }) {
  return (
    <div style={{
      padding: 14, borderRadius: 11, background: bg,
      border: `1px solid ${color}25`,
      display: "flex", alignItems: "center", gap: 12,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 9,
        background: `${color}18`, color,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0,
      }}><Icon size={18} /></div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 700, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</div>
        <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: .4, marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

function VisitDetailsModal({ visit, onClose, onOpenPatient }) {
  if (!visit) return null;
  const reste = Math.max((Number(visit.visit_fee) || 0) - (Number(visit.fee_paid) || 0), 0);
  return (
    <Modal
      open={!!visit}
      onClose={onClose}
      title="Détail consultation"
      icon={Stethoscope}
      width={600}
      footer={
        <>
          <PrimaryButton onClick={() => onOpenPatient(visit.patient_id)} tone="blue" icon={FolderOpen}>Ouvrir dossier</PrimaryButton>
          <PrimaryButton onClick={() => window.print()} tone="ghost" icon={Printer}>Imprimer reçu</PrimaryButton>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Patient</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{[visit.prenom, visit.nom].filter(Boolean).join(" ") || "—"}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {visit.code && <strong style={{ color: C.blue }}>{visit.code}</strong>}
            {visit.age && ` · ${visit.age} ans`}
            {visit.sexe && ` · ${visit.sexe}`}
            {visit.telephone && ` · ${visit.telephone}`}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <InfoRow label="Date" value={fmtDate(visit.date_visite) + " · " + fmtTime(visit.date_visite)} />
          <InfoRow label="Type acte" value={visit.visit_type || "—"} />
        </div>
        <InfoRow label="Motif / Acte" value={visit.motif || "—"} block />
        {visit.diagnostics && <InfoRow label="Diagnostic" value={visit.diagnostics} block />}
        {visit.traitements && <InfoRow label="Traitement" value={visit.traitements} block />}

        {/* Payment */}
        <div style={{ padding: 12, background: C.soft, borderRadius: 9, border: `1px solid ${C.line}` }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.blue, textTransform: "uppercase", marginBottom: 8 }}>Règlement</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <InfoRow label="Montant" value={fmtMoney(visit.visit_fee)} />
            <InfoRow label="Payé" value={fmtMoney(visit.fee_paid)} />
            <InfoRow label="Reste" value={fmtMoney(reste)} strong={reste > 0} color={reste > 0 ? C.red : C.green} />
          </div>
          <div style={{ marginTop: 10 }}><StatusBadge status={visit.payment_status || "pending"} /></div>
        </div>
      </div>
    </Modal>
  );
}

function InfoRow({ label, value, block, strong, color }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".3px", marginBottom: 3 }}>{label}</div>
      <div style={{
        fontSize: block ? 13 : 14,
        fontWeight: strong ? 700 : 500,
        color: color || C.ink,
        whiteSpace: block ? "pre-wrap" : "nowrap",
        overflow: block ? "visible" : "hidden", textOverflow: "ellipsis",
        lineHeight: 1.5,
      }}>{value}</div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// 3) RENDEZ-VOUS
// ═══════════════════════════════════════════════════════════════════════════
export function AppointmentsPageV2({ patients, onOpenPatient, onSaveAppointment }) {
  const [period, setPeriod] = useState("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [detailAppt, setDetailAppt] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    patient_id: "", title: "Consultation",
    scheduled_at: new Date().toISOString().slice(0, 16),
    status: "normal", reminder_channel: "whatsapp", reminder_note: "", notes: "",
  });

  // Map UI period → backend period
  function backendPeriod() {
    if (period === "tomorrow") return "custom";
    if (period === "next-month") return "custom";
    return period; // today | week | month | custom
  }

  function datesForPeriod() {
    if (period === "tomorrow") {
      const d = new Date(); d.setDate(d.getDate() + 1);
      const iso = d.toISOString().slice(0, 10);
      return { date_from: iso, date_to: iso };
    }
    if (period === "next-month") {
      const d = new Date();
      const y = d.getFullYear(); const m = d.getMonth() + 1;
      const start = new Date(y, m, 1).toISOString().slice(0, 10);
      const end = new Date(y, m + 1, 0).toISOString().slice(0, 10);
      return { date_from: start, date_to: end };
    }
    if (period === "custom") return { date_from: customFrom, date_to: customTo };
    return {};
  }

  async function load() {
    setLoading(true);
    try {
      const params = { period: backendPeriod(), ...datesForPeriod() };
      const data = await api.appointmentsFiltered(params);
      setRows(data.rows || []);
      setTotal(data.total || (data.rows || []).length);
    } catch (e) {
      setRows([]); setTotal(0);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [period, customFrom, customTo]);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => (
      (r.nom || "").toLowerCase().includes(q) ||
      (r.prenom || "").toLowerCase().includes(q) ||
      (r.code || "").toLowerCase().includes(q) ||
      (r.telephone || "").toLowerCase().includes(q) ||
      (r.title || "").toLowerCase().includes(q)
    ));
  }, [rows, search]);

  async function handleSave() {
    if (!form.patient_id) return;
    try {
      await onSaveAppointment({ ...form, patient_id: Number(form.patient_id) });
      setShowForm(false);
      setForm({ ...form, title: "Consultation", notes: "" });
      load();
    } catch (e) { /* silent */ }
  }

  async function markDone(appt) {
    try {
      await api.updateAppointment(appt.id, { ...appt, status: "done" });
      load();
    } catch (e) { /* silent */ }
  }
  async function cancel(appt) {
    if (!window.confirm("Annuler ce rendez-vous ?")) return;
    try {
      await api.updateAppointment(appt.id, { ...appt, status: "cancelled" });
      load();
    } catch (e) { /* silent */ }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", minHeight: 0, background: C.soft }}>
      <PageHeader title="Rendez-vous" subtitle={`${fmtNum(total)} rendez-vous programmé(s)`} icon={CalendarDays}>
        <PrimaryButton onClick={() => setShowForm(true)} tone="blue" icon={Plus}>Nouveau rendez-vous</PrimaryButton>
      </PageHeader>

      {/* Search + filters */}
      <div style={{
        display: "flex", gap: 10, alignItems: "center", padding: "14px 22px",
        background: "#fff", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap",
      }}>
        <SearchBox value={search} onChange={setSearch} placeholder="Rechercher un patient, code dossier, téléphone…" />
      </div>

      <div style={{
        display: "flex", gap: 8, alignItems: "center", padding: "10px 22px",
        background: "#fff", borderBottom: `1px solid ${C.line}`, flexWrap: "wrap",
      }}>
        <Filter size={15} color={C.muted} />
        <FilterChip active={period === "today"} onClick={() => setPeriod("today")}>Aujourd'hui</FilterChip>
        <FilterChip active={period === "tomorrow"} onClick={() => setPeriod("tomorrow")}>Demain</FilterChip>
        <FilterChip active={period === "week"} onClick={() => setPeriod("week")}>Cette semaine</FilterChip>
        <FilterChip active={period === "month"} onClick={() => setPeriod("month")}>Ce mois</FilterChip>
        <FilterChip active={period === "next-month"} onClick={() => setPeriod("next-month")}>Mois prochain</FilterChip>
        <FilterChip active={period === "custom"} onClick={() => setPeriod("custom")}>Personnalisé</FilterChip>
        {period === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
              style={{ padding: "6px 10px", border: `1px solid ${C.line}`, borderRadius: 7, fontSize: 12.5 }} />
            <span style={{ fontSize: 12, color: C.muted }}>au</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
              style={{ padding: "6px 10px", border: `1px solid ${C.line}`, borderRadius: 7, fontSize: 12.5 }} />
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: "auto" }}>
        <div style={tableStyles.wrap}>
          <div style={tableStyles.scroll}>
            <table style={tableStyles.table}>
              <thead style={tableStyles.thead}>
                <tr>
                  <th style={tableStyles.th}>Dossier</th>
                  <th style={tableStyles.th}>Nom</th>
                  <th style={tableStyles.th}>Prénom</th>
                  <th style={tableStyles.th}>Date</th>
                  <th style={tableStyles.th}>Heure</th>
                  <th style={tableStyles.th}>Type</th>
                  <th style={tableStyles.th}>Motif</th>
                  <th style={tableStyles.th}>Téléphone</th>
                  <th style={tableStyles.th}>Statut</th>
                  <th style={{ ...tableStyles.th, textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr><td colSpan={10} style={{ padding: 30, textAlign: "center", color: C.muted }}>
                    <Loader2 size={16} style={{ animation: "spin 1s linear infinite", verticalAlign: "middle" }} /> Chargement…
                  </td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={10} style={{ padding: 40, textAlign: "center", color: C.faint, fontStyle: "italic" }}>
                    Aucun rendez-vous.
                  </td></tr>
                )}
                {!loading && filtered.map((a) => (
                  <tr key={a.id} onClick={() => setDetailAppt(a)} style={tableStyles.rowHover(false)}
                    onMouseEnter={(e) => { e.currentTarget.style.background = C.blueSoft; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#fff"; }}
                  >
                    <td style={{ ...tableStyles.td, fontWeight: 600, color: C.blue }}>{a.code || `#${a.patient_id}`}</td>
                    <td style={{ ...tableStyles.td, fontWeight: 600 }}>{a.nom || "—"}</td>
                    <td style={tableStyles.td}>{a.prenom || "—"}</td>
                    <td style={tableStyles.td}>{fmtDate(a.scheduled_at)}</td>
                    <td style={tableStyles.td}>{fmtTime(a.scheduled_at)}</td>
                    <td style={tableStyles.td}>{a.title || "Consultation"}</td>
                    <td style={{ ...tableStyles.td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>{a.notes || a.reminder_note || "—"}</td>
                    <td style={tableStyles.td}>{a.telephone || "—"}</td>
                    <td style={tableStyles.td}><StatusBadge status={a.status || "normal"} /></td>
                    <td style={{ ...tableStyles.td, textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "inline-flex", gap: 4 }}>
                        <IconAction icon={FolderOpen} title="Ouvrir dossier" tone="blue" onClick={() => a.patient_id && onOpenPatient(a.patient_id)} />
                        <IconAction icon={CheckCircle} title="Marquer terminé" tone="green" onClick={() => markDone(a)} />
                        <IconAction icon={X} title="Annuler" tone="red" onClick={() => cancel(a)} />
                        {a.telephone && <IconAction icon={Phone} title="Appeler" onClick={() => window.open(`tel:${a.telephone}`)} />}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail modal */}
      <AppointmentDetailsModal
        appointment={detailAppt}
        onClose={() => setDetailAppt(null)}
        onOpenPatient={(id) => { setDetailAppt(null); onOpenPatient(id); }}
        onMarkDone={(a) => { setDetailAppt(null); markDone(a); }}
        onCancel={(a) => { setDetailAppt(null); cancel(a); }}
      />

      {/* New appointment form modal */}
      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Nouveau rendez-vous"
        icon={Plus}
        width={520}
        footer={
          <>
            <PrimaryButton onClick={() => setShowForm(false)} tone="muted">Annuler</PrimaryButton>
            <PrimaryButton onClick={handleSave} tone="blue" icon={CheckCircle}>Confirmer</PrimaryButton>
          </>
        }
      >
        <div style={{ display: "grid", gap: 10 }}>
          <FormField label="Patient">
            <select value={form.patient_id} onChange={(e) => setForm({ ...form, patient_id: e.target.value })}
              style={inputStyle}>
              <option value="">— Choisir un patient —</option>
              {(patients || []).map((p) => (
                <option key={p.id} value={p.id}>{[p.nom, p.prenom].filter(Boolean).join(" ")} {p.code ? `(${p.code})` : ""}</option>
              ))}
            </select>
          </FormField>
          <FormField label="Motif / Titre">
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={inputStyle} />
          </FormField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <FormField label="Date & heure">
              <input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} style={inputStyle} />
            </FormField>
            <FormField label="Priorité">
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
                <option value="normal">Normal</option>
                <option value="urgent">Urgent</option>
              </select>
            </FormField>
          </div>
          <FormField label="Notes">
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "8px 11px",
  border: `1px solid ${C.line}`, borderRadius: 8,
  fontSize: 13, outline: "none", background: "#fff",
};

function FormField({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: ".3px" }}>{label}</span>
      {children}
    </label>
  );
}

function AppointmentDetailsModal({ appointment: a, onClose, onOpenPatient, onMarkDone, onCancel }) {
  if (!a) return null;
  return (
    <Modal
      open={!!a}
      onClose={onClose}
      title="Détail du rendez-vous"
      icon={CalendarDays}
      width={520}
      footer={
        <>
          {a.status !== "cancelled" && <PrimaryButton onClick={() => onCancel(a)} tone="red" icon={X}>Annuler</PrimaryButton>}
          {a.status !== "done" && <PrimaryButton onClick={() => onMarkDone(a)} tone="ghost" icon={CheckCircle}>Marquer terminé</PrimaryButton>}
          {a.patient_id && <PrimaryButton onClick={() => onOpenPatient(a.patient_id)} tone="blue" icon={FolderOpen}>Ouvrir dossier</PrimaryButton>}
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", marginBottom: 4 }}>Patient</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>{[a.nom, a.prenom].filter(Boolean).join(" ") || "Sans nom"}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {a.code && <strong style={{ color: C.blue }}>{a.code}</strong>}
            {a.telephone && ` · ${a.telephone}`}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <InfoRow label="Date" value={fmtDate(a.scheduled_at)} />
          <InfoRow label="Heure" value={fmtTime(a.scheduled_at)} />
          <InfoRow label="Type" value={a.title || "Consultation"} />
          <InfoRow label="Statut" value={<StatusBadge status={a.status || "normal"} />} />
        </div>
        {a.notes && <InfoRow label="Notes" value={a.notes} block />}
        {a.reminder_note && <InfoRow label="Rappel" value={a.reminder_note} block />}
      </div>
    </Modal>
  );
}

// spinner keyframe (injected once)
if (typeof document !== "undefined" && !document.getElementById("medismart-spin")) {
  const s = document.createElement("style");
  s.id = "medismart-spin";
  s.innerHTML = "@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}
