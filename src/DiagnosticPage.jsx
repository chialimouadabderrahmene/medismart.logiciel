import { useEffect, useState } from "react";
import {
  Database, AlertTriangle, CheckCircle2, RefreshCw, Loader2, Server, FileSearch
} from "lucide-react";
import { api } from "./api.js";

// ════════════════════════════════════════════════════════════════════════
// DiagnosticPage — production diagnostic. Calls /api/diagnostic/full-data
// Shows real DB path, all tables, row counts, sample IDs, orphan FK rows.
// ════════════════════════════════════════════════════════════════════════
export default function DiagnosticPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api.diagnosticFullData();
      setData(result);
    } catch (e) {
      setError(`Diagnostic indisponible: ${e.message}`);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div style={{ padding: 40, textAlign: "center", color: "#94a3b8" }}>
      <Loader2 size={32} className="imp-spin" />
      <div style={{ marginTop: 10, fontSize: 13 }}>Analyse de la base de données…</div>
    </div>
  );

  if (error) return (
    <div style={{ padding: 30 }}>
      <div style={{ padding: "14px 18px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, color: "#991b1b", display: "flex", alignItems: "center", gap: 10 }}>
        <AlertTriangle size={18} /> {error}
      </div>
    </div>
  );

  if (!data) return null;

  const totalRows = Object.values(data.row_counts || {}).reduce((sum, t) => sum + (t.row_count > 0 ? t.row_count : 0), 0);
  const orphanCount = Object.values(data.orphans || {}).reduce((s, n) => s + (n > 0 ? n : 0), 0);
  const missing = data.missing_tables || [];

  return (
    <div style={{ padding: "20px 24px", height: "100%", overflow: "auto", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 10 }}>
            <FileSearch size={22} /> Diagnostic Base de Données
          </h1>
          <div style={{ fontSize: 13, color: "#64748b", marginTop: 3 }}>
            Vérification complète des tables, lignes et intégrité référentielle
          </div>
        </div>
        <button onClick={load}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 14px", background: "#fff", color: "#2563eb", border: "1px solid #2563eb", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
          <RefreshCw size={14} /> Actualiser
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
        <SummaryCard icon={Database} label="Lignes totales" value={totalRows.toLocaleString("fr-FR")} tone="blue" />
        <SummaryCard icon={Server} label="Tables" value={data.tables?.length || 0} tone="indigo" />
        <SummaryCard icon={AlertTriangle} label="Tables manquantes" value={missing.length} tone={missing.length ? "red" : "green"} />
        <SummaryCard icon={AlertTriangle} label="Orphelins" value={orphanCount} tone={orphanCount ? "amber" : "green"} />
      </div>

      {/* DB path */}
      <div style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 12.5 }}>
        <span style={{ color: "#64748b", marginRight: 6 }}>Base active :</span>
        <code style={{ background: "#f1f5f9", padding: "3px 8px", borderRadius: 5, color: "#0f172a", wordBreak: "break-all" }}>{data.active_db_path}</code>
        <span style={{ float: "right", color: "#94a3b8", fontSize: 11.5 }}>Vérifié : {(data.checked_at || "").slice(0, 19).replace("T", " ")}</span>
      </div>

      {/* Missing tables */}
      {missing.length > 0 && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#991b1b", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} /> Tables attendues mais absentes ({missing.length})
          </div>
          <div style={{ fontSize: 12, color: "#7f1d1d" }}>
            {missing.map(t => <code key={t} style={{ background: "#fff", padding: "2px 6px", borderRadius: 4, marginRight: 6 }}>{t}</code>)}
          </div>
        </div>
      )}

      {/* Orphans */}
      {orphanCount > 0 && (
        <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10, padding: "12px 16px", marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
            <AlertTriangle size={14} /> Lignes orphelines détectées
          </div>
          <div style={{ fontSize: 12, color: "#78350f", display: "flex", flexDirection: "column", gap: 3 }}>
            {Object.entries(data.orphans || {}).filter(([, v]) => v > 0).map(([k, v]) => (
              <div key={k}><code style={{ background: "#fff", padding: "1px 5px", borderRadius: 3 }}>{k}</code> : <strong>{v}</strong> ligne(s)</div>
            ))}
          </div>
        </div>
      )}

      {/* Tables list */}
      <div style={{ background: "#fff", border: "1px solid #eef2f7", borderRadius: 12, overflow: "hidden" }}>
        <header style={{ padding: "12px 18px", borderBottom: "1px solid #eef2f7", background: "#f8fafc", fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
          Toutes les tables ({data.tables?.length || 0})
        </header>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 110px 1fr", padding: "10px 18px", borderBottom: "1px solid #f1f5f9", fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".4px" }}>
          <div>Table</div>
          <div style={{ textAlign: "right" }}>Lignes</div>
          <div>Échantillon (IDs récents)</div>
        </div>
        {(data.tables || []).map((tbl) => {
          const info = (data.row_counts || {})[tbl] || {};
          const isError = info.error;
          const isEmpty = info.row_count === 0;
          return (
            <div key={tbl} style={{
              display: "grid", gridTemplateColumns: "1fr 110px 1fr",
              padding: "10px 18px", borderBottom: "1px solid #f8fafc", fontSize: 13,
              background: isError ? "#fef2f2" : "transparent"
            }}>
              <code style={{ color: "#0f172a", fontFamily: "ui-monospace,Menlo,monospace" }}>{tbl}</code>
              <div style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", color: isEmpty ? "#94a3b8" : "#0f172a", fontWeight: isEmpty ? 400 : 600 }}>
                {isError ? "—" : (info.row_count ?? 0).toLocaleString("fr-FR")}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", fontFamily: "ui-monospace,Menlo,monospace" }}>
                {isError ? <span style={{ color: "#991b1b" }}>{info.error}</span>
                 : (info.sample_ids || []).join(", ") || "—"}
              </div>
            </div>
          );
        })}
      </div>

      {missing.length === 0 && orphanCount === 0 && (
        <div style={{ marginTop: 14, padding: "12px 16px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10, color: "#065f46", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <CheckCircle2 size={16} /> Base de données saine — toutes les tables attendues sont présentes et aucune ligne orpheline détectée.
        </div>
      )}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, tone }) {
  const tones = {
    blue:   { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
    indigo: { bg: "#eef2ff", color: "#4338ca", border: "#c7d2fe" },
    green:  { bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
    amber:  { bg: "#fffbeb", color: "#92400e", border: "#fcd34d" },
    red:    { bg: "#fef2f2", color: "#991b1b", border: "#fecaca" },
  }[tone] || { bg: "#f8fafc", color: "#0f172a", border: "#eef2f7" };

  return (
    <div style={{ background: tones.bg, border: `1px solid ${tones.border}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", color: tones.color }}>
        <Icon size={17} />
      </div>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: tones.color, textTransform: "uppercase", letterSpacing: ".4px" }}>{label}</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#0f172a", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>{value}</div>
      </div>
    </div>
  );
}
