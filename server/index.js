import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express from "express";
import { dbConfig, query, tableCount } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const asyncRoute = (handler) => async (req, res) => {
  try {
    await handler(req, res);
  } catch (error) {
    const isDbError = ["ECONNREFUSED", "ER_ACCESS_DENIED_ERROR", "ER_BAD_DB_ERROR"].includes(error.code);
    res.status(isDbError ? 503 : 500).json({
      error: isDbError ? "Database unavailable" : "Server error",
      detail: error.message
    });
  }
};

const clamp = (value, min, max, fallback) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

app.get("/api/health", asyncRoute(async (_req, res) => {
  const [version] = await query("SELECT VERSION() AS version");
  const counts = {};

  for (const table of ["patient", "consultation", "ordonnance", "appointments"]) {
    counts[table] = await tableCount(table);
  }

  res.json({
    ok: true,
    database: dbConfig.database,
    mysql: version?.version,
    counts
  });
}));

app.get("/api/dashboard", asyncRoute(async (_req, res) => {
  const [counts, latest, monthly, sexe] = await Promise.all([
    Promise.all(["patient", "consultation", "ordonnance", "appointments"].map(async (table) => [table, await tableCount(table)])),
    query(`
      SELECT c.ConsultationID, c.ConsultationDate, c.ConsultationName, c.ConsultationMotifvisite,
             p.PatientID, p.PatientFirstName, p.PatientLastName
      FROM consultation c
      JOIN patient p ON p.PatientID = c.PatientID
      ORDER BY c.ConsultationDate DESC
      LIMIT 8
    `),
    query(`
      SELECT DATE_FORMAT(ConsultationDate, '%Y-%m') AS month, COUNT(*) AS total
      FROM consultation
      GROUP BY month
      ORDER BY month DESC
      LIMIT 12
    `),
    query(`
      SELECT COALESCE(NULLIF(PatientSexe, ''), 'Non renseigne') AS label, COUNT(*) AS total
      FROM patient
      GROUP BY label
      ORDER BY total DESC
    `)
  ]);

  res.json({
    counts: Object.fromEntries(counts),
    latest,
    monthly: monthly.reverse(),
    sexe
  });
}));

app.get("/api/patients", asyncRoute(async (req, res) => {
  const page = clamp(req.query.page, 1, 100000, 1);
  const pageSize = clamp(req.query.pageSize, 10, 100, 30);
  const offset = (page - 1) * pageSize;
  const search = String(req.query.search || "").trim();
  const where = search
    ? `WHERE CONCAT_WS(' ', p.PatientFirstName, p.PatientLastName, p.PatUniqueCode, p.PatientPhone, p.PatientMobile1, p.PatientVillage) LIKE ?`
    : "";
  const params = search ? [`%${search}%`] : [];

  const rows = await query(`
    SELECT p.PatientID, p.PatUniqueCode, p.PatientFirstName, p.PatientLastName, p.PatientSexe,
           p.PatientBirthDay, p.PatientAge, p.PatientPhone, p.PatientMobile1, p.PatientVillage,
           p.PatProfession, p.PatBloodGroupe, p.PatEtat, p.PatChroniqueDeceise,
           MAX(c.ConsultationDate) AS LastConsultationDate,
           COUNT(c.ConsultationID) AS ConsultationCount
    FROM patient p
    LEFT JOIN consultation c ON c.PatientID = p.PatientID
    ${where}
    GROUP BY p.PatientID
    ORDER BY p.PatientID DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `, params);

  const totalRows = await query(`SELECT COUNT(*) AS total FROM patient p ${where}`, params);
  res.json({ rows, page, pageSize, total: Number(totalRows[0]?.total || 0) });
}));

app.get("/api/patients/:id", asyncRoute(async (req, res) => {
  const id = clamp(req.params.id, 1, 100000000, 0);
  const patientRows = await query("SELECT * FROM patient WHERE PatientID = ?", [id]);

  if (!patientRows.length) {
    res.status(404).json({ error: "Patient not found" });
    return;
  }

  const [consultations, ordonnances, exams] = await Promise.all([
    query(`
      SELECT ConsultationID, ConsultationDate, ConsultationName, ConsultationMotifvisite,
             HistoireMaladie, ConsultationExamen, diagExamen, DocumentDesc,
             ConsultationTraitement, ConsultationWeight, ConsultationTall, ConsultationIMC,
             TensionMin, TensionMax, Glycimie, ConsultationFee, ConsultationRemainFee
      FROM consultation
      WHERE PatientID = ?
      ORDER BY ConsultationDate DESC
      LIMIT 40
    `, [id]),
    query(`
      SELECT OrdonnanceID, ConsultationID, OrdonnanceDate, OrdonnanceDescription, Pathologie
      FROM ordonnance
      WHERE PatientID = ?
      ORDER BY OrdonnanceDate DESC
      LIMIT 25
    `, [id]),
    query(`
      SELECT ExamenPatientID, ExamenPatientDate, ExamenType, Pathologie
      FROM examenpatient
      WHERE PatientID = ?
      ORDER BY ExamenPatientDate DESC
      LIMIT 20
    `, [id])
  ]);

  res.json({ patient: patientRows[0], consultations, ordonnances, exams });
}));

app.post("/api/patients", asyncRoute(async (req, res) => {
  const body = req.body || {};
  const result = await query(`
    INSERT INTO patient (
      OldPatientID, PatientFirstName, PatientLastName, PatientSexe, PatientBirthDay,
      PatientAge, PatientPhone, PatientMobile1, PatientVillage, PatProfession,
      PatBloodGroupe, PatUniqueCode, PatEtat, PatChroniqueDeceise
    )
    VALUES (0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    body.PatientFirstName || null,
    body.PatientLastName || null,
    body.PatientSexe || null,
    body.PatientBirthDay || null,
    body.PatientAge || null,
    body.PatientPhone || null,
    body.PatientMobile1 || null,
    body.PatientVillage || null,
    body.PatProfession || null,
    body.PatBloodGroupe || null,
    body.PatUniqueCode || null,
    body.PatEtat || null,
    body.PatChroniqueDeceise || null
  ]);

  res.status(201).json({ PatientID: result.insertId });
}));

app.post("/api/patients/:id/consultations", asyncRoute(async (req, res) => {
  const id = clamp(req.params.id, 1, 100000000, 0);
  const body = req.body || {};
  const result = await query(`
    INSERT INTO consultation (
      PatientID, ConsultationName, ConsultationFee, ConsultationRemainFee, ConsultationDate,
      DocumentDesc, diagExamen, ConsultationMotifvisite, ConsultationWeight,
      ConsultationTall, ConsultationIMC, ConsultationExamen, ConsultationTraitement,
      HistoireMaladie, TensionMin, TensionMax, Glycimie, ID_tache, ID
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)
  `, [
    id,
    body.ConsultationName || "",
    body.ConsultationFee || 0,
    body.ConsultationRemainFee || 0,
    body.ConsultationDate || new Date().toISOString().slice(0, 19).replace("T", " "),
    body.DocumentDesc || "",
    body.diagExamen || "",
    body.ConsultationMotifvisite || "",
    body.ConsultationWeight || 0,
    body.ConsultationTall || 0,
    body.ConsultationIMC || 0,
    body.ConsultationExamen || "",
    body.ConsultationTraitement || "",
    body.HistoireMaladie || "",
    body.TensionMin || "",
    body.TensionMax || "",
    body.Glycimie || ""
  ]);

  res.status(201).json({ ConsultationID: result.insertId });
}));

app.use(express.static(path.join(rootDir, "dist")));

app.get("*", (_req, res) => {
  res.sendFile(path.join(rootDir, "dist", "index.html"));
});

app.listen(port, () => {
  console.log(`Gestion Medicale API listening on http://127.0.0.1:${port}`);
});
