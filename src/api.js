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
  patients: (search = "", pageSize = 300, offset = 0) =>
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
  searchMedicines: (q) => request(`/api/medicines/search?q=${encodeURIComponent(q)}`),
  getMedicine: (id) => request(`/api/medicines/${id}`),
  medicinesStats: () => request("/api/medicines/stats"),
  importBdpm: (formData) => request("/api/medicines/import-bdpm", { method: "POST", body: formData }),
  // Prescription workflow
  createPrescriptionWorkflow: (body) => request("/api/prescriptions/workflow", { method: "POST", body: JSON.stringify(body) }),
  getPrescriptionItems: (id) => request(`/api/prescriptions/${id}/items`),
  prescriptionTemplates: () => request("/api/prescription-templates"),
  prescriptionPdf: (id) => `${API_BASE}/api/prescriptions/${id}/pdf`,
  prescriptionPreview: (id) => `${API_BASE}/api/prescriptions/${id}/preview`,
  // Safety check
  safetyCheck: (body) => request("/api/safety-check", { method: "POST", body: JSON.stringify(body) }),
  // Anthropometry
  addAnthropometry: (patientId, body) => request(`/api/patients/${patientId}/anthropometry`, { method: "POST", body: JSON.stringify(body) }),
  getAnthropometry: (patientId) => request(`/api/patients/${patientId}/anthropometry`),
  // Document templates
  documentTemplates: () => request("/api/document-templates"),
  getDocumentTemplate: (id) => request(`/api/document-templates/${id}`),
  createDocumentTemplate: (body) => request("/api/document-templates", { method: "POST", body: JSON.stringify(body) }),
  updateDocumentTemplate: (id, body) => request(`/api/document-templates/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  duplicateDocumentTemplate: (id) => request(`/api/document-templates/${id}/duplicate`, { method: "POST" }),
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
  // AI Credit system
  aiSubscription: () => request("/api/ai/subscription"),
  aiPlans: () => request("/api/ai/plans"),
  aiCreditLogs: (limit = 50) => request(`/api/ai/credit-logs?limit=${limit}`),
  aiChangePlan: (plan_name) => request("/api/ai/subscription/plan", { method: "POST", body: JSON.stringify({ plan_name }) }),
  aiToggle: () => request("/api/ai/subscription/toggle", { method: "POST" }),
  syncCloudAnalysis: (documentId, body) => request(`/api/documents/${documentId}/sync-cloud`, { method: "POST", body: JSON.stringify(body) }),
};
