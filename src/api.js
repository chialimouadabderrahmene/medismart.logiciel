const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

async function request(path, options = {}) {
  const headers = options.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers || {}) }
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const detail = typeof data === "string" ? data : data.detail;
    const message =
      typeof detail === "string"
        ? detail
        : detail?.message || detail?.detail || "Erreur API";
    const error = new Error(message);
    if (detail && typeof detail === "object") {
      error.details = detail;
    }
    throw error;
  }
  return data;
}

export const apiBase = API_BASE;

export const api = {
  login: (body) => request("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  health: () => request("/api/health"),
  dashboard: () => request("/api/dashboard"),
  patients: (search = "", pageSize = 200, offset = 0) =>
    request(`/api/patients?page_size=${pageSize}&offset=${offset}&search=${encodeURIComponent(search)}`),
  patient: (id) => request(`/api/patients/${id}`),
  createPatient: (body) => request("/api/patients", { method: "POST", body: JSON.stringify(body) }),
  updatePatient: (id, body) => request(`/api/patients/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deletePatient: (id) => request(`/api/patients/${id}`, { method: "DELETE" }),
  createVisit: (id, body) => request(`/api/patients/${id}/visits`, { method: "POST", body: JSON.stringify(body) }),
  cardio: (id) => request(`/api/patients/${id}/cardio`),
  updateCardioProfile: (id, body) => request(`/api/patients/${id}/cardio-profile`, { method: "PUT", body: JSON.stringify(body) }),
  addVitals: (id, body) => request(`/api/patients/${id}/vitals`, { method: "POST", body: JSON.stringify(body) }),
  addLabs: (id, body) => request(`/api/patients/${id}/labs`, { method: "POST", body: JSON.stringify(body) }),
  addEcg: (id, body) => request(`/api/patients/${id}/ecg`, { method: "POST", body: JSON.stringify(body) }),
  addImaging: (id, body) => request(`/api/patients/${id}/imaging`, { method: "POST", body: JSON.stringify(body) }),
  addDiagnosis: (id, body) => request(`/api/patients/${id}/diagnoses`, { method: "POST", body: JSON.stringify(body) }),
  deleteDiagnosis: (patientId, diagnosisId) => request(`/api/patients/${patientId}/diagnoses/${diagnosisId}`, { method: "DELETE" }),
  addFollowup: (id, body) => request(`/api/patients/${id}/followups`, { method: "POST", body: JSON.stringify(body) }),
  autoFollowup: (id) => request(`/api/patients/${id}/followups/auto`, { method: "POST" }),
  medications: (search = "") => request(`/api/medications?search=${encodeURIComponent(search)}`),
  aiCheck: (body) => request("/api/ai/cardio-check", { method: "POST", body: JSON.stringify(body) }),
  savePrescription: (body) => request("/api/prescriptions", { method: "POST", body: JSON.stringify(body) }),
  uploadDocument: (patientId, formData) => request(`/api/patients/${patientId}/documents`, { method: "POST", body: formData }),
  mobileUploadToken: (patientId) => request(`/api/patients/${patientId}/mobile-upload-token`, { method: "POST" }),
  qrDebug: () => request("/api/qr/debug"),
  updateDocumentNotes: (documentId, body) => request(`/api/documents/${documentId}/notes`, { method: "PUT", body: JSON.stringify(body) }),
  analyzeDocument: (documentId, body = {}) => request(`/api/documents/${documentId}/ai-analyze`, { method: "POST", body: JSON.stringify(body) }),
  documentAiAnalysis: (documentId) => request(`/api/documents/${documentId}/ai-analysis`),
  acceptAiAnalysis: (analysisId, body = {}) => request(`/api/ai-analysis/${analysisId}/accept`, { method: "PUT", body: JSON.stringify(body) }),
  rejectAiAnalysis: (analysisId) => request(`/api/ai-analysis/${analysisId}/reject`, { method: "PUT" }),
  editAiAnalysis: (analysisId, body) => request(`/api/ai-analysis/${analysisId}/edit`, { method: "PUT", body: JSON.stringify(body) }),
  saveAiLabs: (analysisId, body) => request(`/api/ai-analysis/${analysisId}/save-labs`, { method: "POST", body: JSON.stringify(body) }),
  testAiProvider: (body = {}) => request("/api/ai/test-provider", { method: "POST", body: JSON.stringify(body) }),
  aiSettings: () => request("/api/ai/settings"),
  aiUsage: () => request("/api/ai/usage"),
  updateAiSettings: (settings) => request("/api/ai/settings", { method: "PUT", body: JSON.stringify({ settings }) }),
  aiChat: (body) => request("/api/ai/chat", { method: "POST", body: JSON.stringify(body) }),
  aiPatientChat: (patientId, body) => request(`/api/ai/patient-chat/${patientId}`, { method: "POST", body: JSON.stringify(body) }),
  aiConversations: (patientId = null) => request(`/api/ai/conversations${patientId ? `?patient_id=${patientId}` : ""}`),
  aiConversation: (conversationId) => request(`/api/ai/conversations/${conversationId}`),
  patientRiskScan: (patientId) => request(`/api/patients/${patientId}/risk-scan`),
  appointments: () => request("/api/appointments"),
  createAppointment: (body) => request("/api/appointments", { method: "POST", body: JSON.stringify(body) }),
  updateAppointment: (id, body) => request(`/api/appointments/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  backup: () => request("/api/backups", { method: "POST" }),
  audit: () => request("/api/audit"),
  getSettings: () => request("/api/settings"),
  updateSetting: (key, value) => request("/api/settings", { method: "PUT", body: JSON.stringify({ key, value }) }),
  uploadMode: () => request("/api/upload-mode"),
  testUploadMode: () => request("/api/upload-mode/test", { method: "POST" }),
  tunnelStart: () => request("/api/tunnel/start", { method: "POST" }),
  tunnelStop: () => request("/api/tunnel/stop", { method: "POST" }),
  tunnelStatus: () => request("/api/tunnel/status"),
  patientDocuments: (patientId) => request(`/api/patients/${patientId}/documents`),
  // Medicine database
  searchMedicines: (q, limit = 100) => request(`/api/medicines/search?q=${encodeURIComponent(q)}&limit=${limit}`),
  getMedicine: (id) => request(`/api/medicines/${id}`),
  medicinesStats: () => request("/api/medicines/stats"),
  addMedicine: (body) => request("/api/medicines", { method: "POST", body: JSON.stringify(body) }),
  addBilanCatalog: (body) => request("/api/bilan-catalog", { method: "POST", body: JSON.stringify(body) }),
  // Prescription workflow
  createPrescriptionWorkflow: (body) => request("/api/prescriptions/workflow", { method: "POST", body: JSON.stringify(body) }),
  getPrescriptionItems: (id) => request(`/api/prescriptions/${id}/items`),
  prescriptionTemplates: () => request("/api/prescription-templates"),
  prescriptionPdf: (id) => `${API_BASE}/api/prescriptions/${id}/pdf`,
  prescriptionPreview: (id) => `${API_BASE}/api/prescriptions/${id}/preview`,
  // Safety check
  safetyCheck: (body) => request("/api/safety-check", { method: "POST", body: JSON.stringify(body) }),
  // BDPM import (French public drug database — auto-downloads from gouv.fr)
  importBdpm: () => request("/api/medicines/import-bdpm", { method: "POST" }),
  bdpmStatus: () => request("/api/medicines/bdpm-status"),
  importMedicinesBulk: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("format_hint", "auto");
    return request("/api/medicines/import-bulk", { method: "POST", body: fd });
  },
  // Specialty smart-lists, favorites, recent
  medicineSpecialties: () => request("/api/medicines/specialties"),
  medicinesBySpecialty: (specialty) => request(`/api/medicines/by-specialty?specialty=${encodeURIComponent(specialty)}`),
  favoriteMedicines: () => request("/api/medicines/favorites"),
  addFavoriteMedicine: (medicineId) => request("/api/medicines/favorites", { method: "POST", body: JSON.stringify({ medicine_id: medicineId }) }),
  removeFavoriteMedicine: (medicineId) => request(`/api/medicines/favorites/${medicineId}`, { method: "DELETE" }),
  recentMedicines: () => request("/api/medicines/recent"),
  gestionDbMedicines: (q = "", limit = 500) => request(`/api/gestion-db/medicines?q=${encodeURIComponent(q)}&limit=${limit}`),
  // Doctor profile
  doctorProfile: () => request("/api/doctor-profile"),
  // Bilan (lab/exam orders)
  bilanCatalog: (params = {}) => { const q = new URLSearchParams(params).toString(); return request(`/api/bilan-catalog${q ? "?" + q : ""}`); },
  patientBilans: (patientId) => request(`/api/patients/${patientId}/bilans`),
  createBilan: (patientId, body) => request(`/api/patients/${patientId}/bilans`, { method: "POST", body: JSON.stringify(body) }),
  updateBilan: (bilanId, body) => request(`/api/bilans/${bilanId}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteBilan: (bilanId) => request(`/api/bilans/${bilanId}`, { method: "DELETE" }),
  updateBilanItemResult: (itemId, body) => request(`/api/bilan-items/${itemId}/result`, { method: "PUT", body: JSON.stringify(body) }),
  printBilan: (bilanId) => request(`/api/bilans/${bilanId}/print`),
  // Anthropometry
  addAnthropometry: (patientId, body) => request(`/api/patients/${patientId}/anthropometry`, { method: "POST", body: JSON.stringify(body) }),
  getAnthropometry: (patientId) => request(`/api/patients/${patientId}/anthropometry`),
  // Document templates
  documentTemplates: () => request("/api/document-templates"),
  getDocumentTemplate: (id) => request(`/api/document-templates/${id}`),
  createDocumentTemplate: (body) => request("/api/document-templates", { method: "POST", body: JSON.stringify(body) }),
  updateDocumentTemplate: (id, body) => request(`/api/document-templates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  duplicateDocumentTemplate: (id) => request(`/api/document-templates/${id}/duplicate`, { method: "POST" }),
  deleteDocumentTemplate: (id) => request(`/api/document-templates/${id}`, { method: "DELETE" }),
  // Generated documents
  generateDocument: (body) => request("/api/generated-documents", { method: "POST", body: JSON.stringify(body) }),
  getGeneratedDocument: (id) => request(`/api/generated-documents/${id}`),
  patientGeneratedDocuments: (patientId) => request(`/api/patients/${patientId}/generated-documents`),
  generatedDocumentPdf: (id) => `${API_BASE}/api/generated-documents/${id}/pdf`,
  generatedDocumentPrintable: (id) => `${API_BASE}/api/generated-documents/${id}/printable`,
  // Visit types (motifs with prices)
  visitTypes: () => request("/api/visit-types"),
  createVisitType: (body) => request("/api/visit-types", { method: "POST", body: JSON.stringify(body) }),
  updateVisitType: (id, body) => request(`/api/visit-types/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  // Finance
  financeSummary: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/finance/summary?${q}`);
  },
  patientFinance: (patientId) => request(`/api/finance/patient/${patientId}`),
  updateVisitPayment: (visitId, body) => request(`/api/visits/${visitId}/payment`, { method: "PUT", body: JSON.stringify(body) }),
  // Filtered appointments
  appointmentsFiltered: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/api/appointments/filtered?${q}`);
  },
  // Today's visits (Patients vus aujourd'hui)
  visitsToday: (date = "") => request(`/api/visits/today${date ? `?date=${date}` : ""}`),
  // Patient quick summary (details modal in Liste des patients)
  patientQuickSummary: (patientId) => request(`/api/patients/${patientId}/quick-summary`),
  // Finance today summary
  financeTodaySummary: () => request("/api/finance/today-summary"),
  // AI Credit system
  aiSubscription: () => request("/api/ai/subscription"),
  aiPlans: () => request("/api/ai/plans"),
  aiCreditLogs: (limit = 50) => request(`/api/ai/credit-logs?limit=${limit}`),
  aiChangePlan: (plan_name) => request("/api/ai/subscription/plan", { method: "POST", body: JSON.stringify({ plan_name }) }),
  aiToggle: () => request("/api/ai/subscription/toggle", { method: "POST" }),
  syncCloudAnalysis: (documentId, body) => request(`/api/documents/${documentId}/sync-cloud`, { method: "POST", body: JSON.stringify(body) }),

  // ── Production audit endpoints ─────────────────────────────────────────────
  diagnosticFullData: () => request("/api/diagnostic/full-data"),
  doctors: (activeOnly = 0) => request(`/api/doctors?active_only=${activeOnly}`),
  createDoctor: (body) => request("/api/doctors", { method: "POST", body: JSON.stringify(body) }),
  updateDoctor: (id, body) => request(`/api/doctors/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deactivateDoctor: (id) => request(`/api/doctors/${id}`, { method: "DELETE" }),
  typeActes: (activeOnly = 1) => request(`/api/type-actes?active_only=${activeOnly}`),
  allTemplates: () => request("/api/templates"),
  patientFull: (id) => request(`/api/patients/${id}/full`),
  patientAntecedents: (id) => request(`/api/patients/${id}/antecedents`),
  updatePatientAntecedents: (id, body) => request(`/api/patients/${id}/antecedents`, { method: "PUT", body: JSON.stringify(body) }),
  patientPayments: (id) => request(`/api/patients/${id}/payments`),
  patientHistorique: (id) => request(`/api/patients/${id}/historique`),
  // Référentiels — Diagnostics catalog
  diagnosticsCatalog: (activeOnly = 0) => request(`/api/diagnostics-catalog?active_only=${activeOnly}`),
  createDiagnostic: (body) => request("/api/diagnostics-catalog", { method: "POST", body: JSON.stringify(body) }),
  updateDiagnostic: (id, body) => request(`/api/diagnostics-catalog/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteDiagnostic: (id) => request(`/api/diagnostics-catalog/${id}`, { method: "DELETE" }),
  // Référentiels — Tarifs
  tarifs: (activeOnly = 0) => request(`/api/tarifs?active_only=${activeOnly}`),
  createTarif: (body) => request("/api/tarifs", { method: "POST", body: JSON.stringify(body) }),
  updateTarif: (id, body) => request(`/api/tarifs/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteTarif: (id) => request(`/api/tarifs/${id}`, { method: "DELETE" }),
  // Référentiels — Actes catalog
  actesCatalog: (activeOnly = 0) => request(`/api/actes-catalog?active_only=${activeOnly}`),
  createActe: (body) => request("/api/actes-catalog", { method: "POST", body: JSON.stringify(body) }),
  updateActe: (id, body) => request(`/api/actes-catalog/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteActe: (id) => request(`/api/actes-catalog/${id}`, { method: "DELETE" }),
  // Référentiels — Bilan catalog (update + delete)
  updateBilanCatalog: (id, body) => request(`/api/bilan-catalog/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteBilanCatalog: (id) => request(`/api/bilan-catalog/${id}`, { method: "DELETE" }),
  // Référentiels — Visit types (delete)
  deleteVisitType: (id) => request(`/api/visit-types/${id}`, { method: "DELETE" }),
  // Référentiels — Medicines (update + delete)
  updateMedicine: (id, body) => request(`/api/medicines/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteMedicine: (id) => request(`/api/medicines/${id}`, { method: "DELETE" }),
};
