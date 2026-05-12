PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'doctor',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE,
  nom TEXT NOT NULL,
  prenom TEXT NOT NULL,
  date_naissance TEXT,
  age INTEGER,
  sexe TEXT,
  groupe_sanguin TEXT,
  situation_familiale TEXT,
  adresse TEXT,
  telephone TEXT,
  profession TEXT,
  oriente_par TEXT,
  allergies TEXT,
  maladies TEXT,
  notes_importantes TEXT,
  qr_token TEXT NOT NULL UNIQUE,
  legacy_patient_id INTEGER UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS visits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  date_visite TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motif TEXT,
  histoire TEXT,
  examens TEXT,
  diagnostics TEXT,
  traitements TEXT,
  tension TEXT,
  frequence_cardiaque TEXT,
  glycemie TEXT,
  poids TEXT,
  taille TEXT,
  visit_fee REAL NOT NULL DEFAULT 0,
  fee_paid REAL NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  visit_type TEXT,
  legacy_consultation_id INTEGER UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS cardio_profiles (
  patient_id INTEGER PRIMARY KEY,
  hypertension INTEGER NOT NULL DEFAULT 0,
  diabetes INTEGER NOT NULL DEFAULT 0,
  smoking INTEGER NOT NULL DEFAULT 0,
  obesity INTEGER NOT NULL DEFAULT 0,
  dyslipidemia INTEGER NOT NULL DEFAULT 0,
  family_history_heart_disease INTEGER NOT NULL DEFAULT 0,
  previous_infarction INTEGER NOT NULL DEFAULT 0,
  previous_stroke INTEGER NOT NULL DEFAULT 0,
  previous_angioplasty INTEGER NOT NULL DEFAULT 0,
  previous_bypass INTEGER NOT NULL DEFAULT 0,
  heart_failure INTEGER NOT NULL DEFAULT 0,
  vascular_disease INTEGER NOT NULL DEFAULT 0,
  abnormal_renal_function INTEGER NOT NULL DEFAULT 0,
  abnormal_liver_function INTEGER NOT NULL DEFAULT 0,
  bleeding_history INTEGER NOT NULL DEFAULT 0,
  labile_inr INTEGER NOT NULL DEFAULT 0,
  alcohol_or_drugs INTEGER NOT NULL DEFAULT 0,
  current_medications TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS vital_signs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  measured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  systolic_bp INTEGER,
  diastolic_bp INTEGER,
  heart_rate INTEGER,
  oxygen_saturation REAL,
  weight REAL,
  height REAL,
  bmi REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS lab_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  measured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total_cholesterol REAL,
  ldl REAL,
  hdl REAL,
  glucose REAL,
  hba1c REAL,
  triglycerides REAL,
  troponin REAL,
  bnp REAL,
  nt_probnp REAL,
  creatinine REAL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ecg_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  document_id INTEGER,
  recorded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  rhythm TEXT,
  heart_rate INTEGER,
  pr_ms INTEGER,
  qrs_ms INTEGER,
  qt_ms INTEGER,
  qtc_ms INTEGER,
  annotations TEXT,
  ai_findings TEXT,
  severity TEXT NOT NULL DEFAULT 'normal',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS imaging_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  document_id INTEGER,
  imaging_type TEXT NOT NULL,
  performed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ejection_fraction REAL,
  valve_status TEXT,
  wall_motion TEXT,
  report TEXT,
  severity TEXT NOT NULL DEFAULT 'normal',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS cardio_diagnoses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  diagnosis TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  diagnosed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS followups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  type_document TEXT NOT NULL,
  original_name TEXT NOT NULL,
  stored_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'desktop',
  uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_document_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  document_type TEXT,
  analysis_mode TEXT,
  summary TEXT,
  validated_summary TEXT,
  extracted_json TEXT,
  validated_extracted_json TEXT,
  risk_level TEXT,
  confidence REAL,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  validated_by_doctor_at TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usage_type TEXT NOT NULL,
  patient_id INTEGER,
  document_id INTEGER,
  conversation_id INTEGER,
  analysis_id INTEGER,
  model TEXT NOT NULL,
  analysis_mode TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE SET NULL,
  FOREIGN KEY (analysis_id) REFERENCES ai_document_analyses(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS extracted_lab_values (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  document_id INTEGER NOT NULL,
  analyte TEXT NOT NULL,
  value TEXT,
  unit TEXT,
  reference_range TEXT,
  abnormal_flag TEXT,
  source_ai_analysis_id INTEGER,
  doctor_confirmed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (source_ai_analysis_id) REFERENCES ai_document_analyses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  provider TEXT NOT NULL DEFAULT 'disabled',
  model_name TEXT,
  openai_base_url TEXT,
  local_base_url TEXT,
  require_manual_consent INTEGER NOT NULL DEFAULT 1,
  auto_document_analysis INTEGER NOT NULL DEFAULT 0,
  max_file_mb REAL NOT NULL DEFAULT 10,
  chat_enabled INTEGER NOT NULL DEFAULT 1,
  document_ai_enabled INTEGER NOT NULL DEFAULT 1,
  analysis_mode TEXT NOT NULL DEFAULT 'normal',
  max_tokens INTEGER NOT NULL DEFAULT 384,
  monthly_token_limit INTEGER NOT NULL DEFAULT 20000,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_conversations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER,
  title TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ai_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  safety_note TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS mobile_upload_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_used_at TEXT,
  revoked_at TEXT,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  dci TEXT,
  class_name TEXT,
  indication TEXT,
  dosage TEXT,
  default_dose TEXT,
  contraindications TEXT,
  interactions TEXT,
  warnings TEXT
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER,
  title TEXT NOT NULL,
  scheduled_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'normal',
  reminder_channel TEXT NOT NULL DEFAULT 'none',
  reminder_note TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS prescriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  visit_id INTEGER,
  lines TEXT NOT NULL,
  ai_warnings TEXT,
  consultation_summary TEXT,
  doctor_validated INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id INTEGER,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_path TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  size_bytes INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- MEDICINE DATABASE (VIDAL-like / BDPM France)
-- ============================================================

CREATE TABLE IF NOT EXISTS medicines_db (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cis_code TEXT,
  cip_code TEXT,
  brand_name TEXT NOT NULL,
  dci TEXT,
  active_substance TEXT,
  form TEXT,
  dosage_strength TEXT,
  route TEXT,
  marketing_status TEXT,
  laboratory TEXT,
  indications TEXT,
  contraindications TEXT,
  interactions TEXT,
  pregnancy_warnings TEXT,
  breastfeeding_warnings TEXT,
  renal_precautions TEXT,
  hepatic_precautions TEXT,
  rcp_link TEXT,
  rcp_text TEXT,
  specialty TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  last_updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_medicines_brand ON medicines_db(brand_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_medicines_dci ON medicines_db(dci COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_medicines_cis ON medicines_db(cis_code);
CREATE INDEX IF NOT EXISTS idx_medicines_substance ON medicines_db(active_substance COLLATE NOCASE);

-- FTS5 full-text search virtual table for instant medication search (sub-100ms even with 20k+ rows)
CREATE VIRTUAL TABLE IF NOT EXISTS medicines_fts USING fts5(
  brand_name, dci, active_substance, indications,
  content='medicines_db', content_rowid='id'
);

-- Trigger: keep FTS index in sync on INSERT
CREATE TRIGGER IF NOT EXISTS medicines_fts_insert AFTER INSERT ON medicines_db BEGIN
  INSERT INTO medicines_fts(rowid, brand_name, dci, active_substance, indications)
  VALUES (new.id, new.brand_name, new.dci, new.active_substance, new.indications);
END;

-- Trigger: keep FTS index in sync on UPDATE
CREATE TRIGGER IF NOT EXISTS medicines_fts_update AFTER UPDATE ON medicines_db BEGIN
  INSERT INTO medicines_fts(medicines_fts, rowid, brand_name, dci, active_substance, indications)
  VALUES ('delete', old.id, old.brand_name, old.dci, old.active_substance, old.indications);
  INSERT INTO medicines_fts(rowid, brand_name, dci, active_substance, indications)
  VALUES (new.id, new.brand_name, new.dci, new.active_substance, new.indications);
END;

-- Trigger: keep FTS index in sync on DELETE
CREATE TRIGGER IF NOT EXISTS medicines_fts_delete AFTER DELETE ON medicines_db BEGIN
  INSERT INTO medicines_fts(medicines_fts, rowid, brand_name, dci, active_substance, indications)
  VALUES ('delete', old.id, old.brand_name, old.dci, old.active_substance, old.indications);
END;

CREATE TABLE IF NOT EXISTS medicine_substances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  substance_name TEXT NOT NULL,
  dosage TEXT,
  FOREIGN KEY (medicine_id) REFERENCES medicines_db(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS medicine_interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_a_id INTEGER NOT NULL,
  medicine_b_id INTEGER,
  substance_b TEXT,
  severity TEXT NOT NULL DEFAULT 'moderate',
  description TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  FOREIGN KEY (medicine_a_id) REFERENCES medicines_db(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_b_id) REFERENCES medicines_db(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS medicine_contraindications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  condition_name TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'absolute',
  description TEXT,
  FOREIGN KEY (medicine_id) REFERENCES medicines_db(id) ON DELETE CASCADE
);

-- Favorite medications per doctor
CREATE TABLE IF NOT EXISTS favorite_medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(medicine_id, doctor_id),
  FOREIGN KEY (medicine_id) REFERENCES medicines_db(id) ON DELETE CASCADE
);

-- Recently-used medications per doctor (auto-populated on prescription)
CREATE TABLE IF NOT EXISTS recent_medicines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  medicine_id INTEGER NOT NULL,
  doctor_id INTEGER NOT NULL DEFAULT 1,
  last_used TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  use_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(medicine_id, doctor_id),
  FOREIGN KEY (medicine_id) REFERENCES medicines_db(id) ON DELETE CASCADE
);

-- ============================================================
-- PRESCRIPTION ITEMS (structured prescription lines)
-- ============================================================

CREATE TABLE IF NOT EXISTS prescription_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prescription_id INTEGER NOT NULL,
  medicine_id INTEGER,
  medicine_name TEXT NOT NULL,
  dci TEXT,
  dosage TEXT,
  frequency TEXT,
  duration TEXT,
  instructions TEXT,
  quantity TEXT,
  renewable INTEGER NOT NULL DEFAULT 0,
  is_free_text INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (prescription_id) REFERENCES prescriptions(id) ON DELETE CASCADE,
  FOREIGN KEY (medicine_id) REFERENCES medicines_db(id) ON DELETE SET NULL
);

-- ============================================================
-- ANTHROPOMETRIC RECORDS (BMI / waist circumference tracking)
-- ============================================================

CREATE TABLE IF NOT EXISTS anthropometric_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  measured_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  weight_kg REAL,
  height_cm REAL,
  waist_circumference_cm REAL,
  bmi REAL,
  bmi_category TEXT,
  waist_risk TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_anthropo_patient ON anthropometric_records(patient_id, measured_at DESC);

-- ============================================================
-- DOCUMENT TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS document_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  body_html TEXT NOT NULL DEFAULT '',
  variables TEXT,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS generated_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  template_id INTEGER,
  title TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  rendered_text TEXT,
  pdf_path TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES document_templates(id) ON DELETE SET NULL
);

-- ============================================================
-- PRESCRIPTION TEMPLATES
-- ============================================================

CREATE TABLE IF NOT EXISTS prescription_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'cardiologie',
  items_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- VISIT TYPES / MOTIFS (with default prices)
-- ============================================================

CREATE TABLE IF NOT EXISTS visit_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  price REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- BILAN (medical exam / lab-order) MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS bilan_catalog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'Autre',  -- Biologie | Radiologie | Autre
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bilans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  visit_id INTEGER,
  requested_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  doctor_note TEXT,
  status TEXT NOT NULL DEFAULT 'requested',  -- requested | done | cancelled
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY (visit_id) REFERENCES visits(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS bilan_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bilan_id INTEGER NOT NULL,
  catalog_id INTEGER,
  custom_name TEXT,
  result TEXT,
  result_date TEXT,
  unit TEXT,
  reference_range TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | done | abnormal
  FOREIGN KEY (bilan_id) REFERENCES bilans(id) ON DELETE CASCADE,
  FOREIGN KEY (catalog_id) REFERENCES bilan_catalog(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_bilans_patient ON bilans(patient_id, requested_date DESC);
CREATE INDEX IF NOT EXISTS idx_bilan_items_bilan ON bilan_items(bilan_id);
CREATE INDEX IF NOT EXISTS idx_bilan_catalog_cat ON bilan_catalog(category, active);

-- ============================================================
-- PATIENT FTS5 — fast name/phone search on 10k+ patients
-- ============================================================
CREATE VIRTUAL TABLE IF NOT EXISTS patients_fts USING fts5(
  nom, prenom, telephone, code, adresse,
  content='patients', content_rowid='id'
);

CREATE TRIGGER IF NOT EXISTS patients_fts_insert AFTER INSERT ON patients BEGIN
  INSERT INTO patients_fts(rowid, nom, prenom, telephone, code, adresse)
  VALUES (new.id, new.nom, new.prenom, new.telephone, new.code, new.adresse);
END;

CREATE TRIGGER IF NOT EXISTS patients_fts_update AFTER UPDATE ON patients BEGIN
  INSERT INTO patients_fts(patients_fts, rowid, nom, prenom, telephone, code, adresse)
  VALUES ('delete', old.id, old.nom, old.prenom, old.telephone, old.code, old.adresse);
  INSERT INTO patients_fts(rowid, nom, prenom, telephone, code, adresse)
  VALUES (new.id, new.nom, new.prenom, new.telephone, new.code, new.adresse);
END;

CREATE TRIGGER IF NOT EXISTS patients_fts_delete AFTER DELETE ON patients BEGIN
  INSERT INTO patients_fts(patients_fts, rowid, nom, prenom, telephone, code, adresse)
  VALUES ('delete', old.id, old.nom, old.prenom, old.telephone, old.code, old.adresse);
END;
