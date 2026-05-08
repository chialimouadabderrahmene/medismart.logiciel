/**
 * MediSmart speciality configuration system.
 * Each config defines tabs, extra fields, AI prompt and templates per speciality.
 */

// ── Master tab registry ──────────────────────────────────────────────────────
export const TAB_REGISTRY = {
  "new-visit":  { label: "Nouvelle Visite",  icon: "Stethoscope", group: "consultation" },
  "vitals":     { label: "Constantes",        icon: "Activity",    group: "clinique" },
  "bmi":        { label: "IMC / Tour taille", icon: "Scale",       group: "clinique" },
  "ecg":        { label: "ECG",              icon: "FileImage",   group: "clinique" },
  "profile":    { label: "Profil Cardio",    icon: "ShieldCheck", group: "clinique" },
  "scores":     { label: "Scores",           icon: "AlertTriangle",group: "clinique" },
  "specialty":  { label: "Données Spé.",     icon: "Sparkles",    group: "clinique" },
  "imaging":    { label: "Imagerie/Labs",    icon: "Stethoscope", group: "diagnostic" },
  "diagnosis":  { label: "Diagnostic",       icon: "Pill",        group: "diagnostic" },
  "fiche":      { label: "Fiche Patient",    icon: "UserRound",   group: "gestion" },
  "historique": { label: "Historique",       icon: "Clock",       group: "gestion" },
  "followup":   { label: "Suivi",            icon: "CalendarDays",group: "gestion" },
  "docs":       { label: "Documents",        icon: "FileImage",   group: "gestion" },
  "templates":  { label: "Modèles",          icon: "FileCheck",   group: "gestion" },
  "ai":         { label: "AI Médical",       icon: "Bot",         group: "outils" },
};

// ── Speciality definitions ────────────────────────────────────────────────────
export const SPECIALITIES = {
  generaliste: {
    id: "generaliste",
    label: "Médecine Générale",
    short: "Généraliste",
    icon: "Stethoscope",
    color: "#10b981",
    dashboard_title: "Cabinet de Médecine Générale",
    patient_tabs: [
      "new-visit", "vitals", "bmi", "scores", "imaging",
      "specialty", "diagnosis", "followup", "fiche", "historique",
      "docs", "templates", "ai"
    ],
    specialty_tab_label: "Données Générales",
    extra_fields: [
      { group: "Signes vitaux", fields: [
        { key: "tension_sys",  label: "TA Systolique",  type: "number", unit: "mmHg" },
        { key: "tension_dia",  label: "TA Diastolique", type: "number", unit: "mmHg" },
        { key: "glycemie",     label: "Glycémie",       type: "number", unit: "g/L" },
      ]},
      { group: "Vaccinations", fields: [
        { key: "vaccins_date",    label: "Derniers vaccins",   type: "date" },
        { key: "vaccins_notes",   label: "Notes vaccination",  type: "textarea" },
      ]},
      { group: "Suivi chronique", fields: [
        { key: "diabete",        label: "Diabète",             type: "select", options: ["Non", "Type 1", "Type 2", "Gestationnel"] },
        { key: "hta",            label: "HTA",                 type: "select", options: ["Non", "Oui", "Contrôlée"] },
        { key: "imc_class",      label: "IMC Classification",  type: "select", options: ["Normal", "Surpoids", "Obésité G1", "Obésité G2", "Obésité G3"] },
      ]},
    ],
    consultation_templates: [
      { name: "Consultation standard",     category: "consultation" },
      { name: "Certificat médical",        category: "certificat"   },
      { name: "Arrêt de travail",          category: "certificat"   },
      { name: "Ordonnance simple",         category: "ordonnance"   },
      { name: "Lettre d'orientation",      category: "lettre"       },
    ],
    ai_system_prompt: `Tu es un assistant médical spécialisé en médecine générale. Tu assistes le médecin dans l'analyse des dossiers patients, la rédaction d'ordonnances, la rédaction de certificats médicaux, le suivi des maladies chroniques (diabète, HTA, cholestérol), les vaccinations et les dépistages. Toujours préciser: "Analyse IA à vérifier par le médecin."`,
    ai_focus: ["HTA", "Diabète", "Vaccinations", "Maladies chroniques", "Dépistage", "Certificats"],
  },

  cardiologie: {
    id: "cardiologie",
    label: "Cardiologie",
    short: "Cardiologue",
    icon: "Heart",
    color: "#ef4444",
    dashboard_title: "Cabinet de Cardiologie",
    patient_tabs: [
      "new-visit", "profile", "vitals", "bmi", "ecg", "scores",
      "imaging", "specialty", "diagnosis", "followup", "fiche",
      "historique", "docs", "templates", "ai"
    ],
    specialty_tab_label: "Données Cardio",
    extra_fields: [
      { group: "Facteurs de risque", fields: [
        { key: "hta",         label: "HTA",          type: "select", options: ["Non", "Oui", "Contrôlée", "Résistante"] },
        { key: "diabete",     label: "Diabète",      type: "select", options: ["Non", "Type 1", "Type 2"] },
        { key: "tabac",       label: "Tabagisme",    type: "select", options: ["Non-fumeur", "Fumeur", "Ex-fumeur"] },
        { key: "dyslip",      label: "Dyslipidémie", type: "select", options: ["Non", "Oui", "Traitée"] },
      ]},
      { group: "Biologie", fields: [
        { key: "ldl",         label: "LDL (g/L)",   type: "number", unit: "g/L" },
        { key: "hdl",         label: "HDL (g/L)",   type: "number", unit: "g/L" },
        { key: "troponine",   label: "Troponine",   type: "number", unit: "ng/L" },
        { key: "bnp",         label: "BNP/NT-proBNP", type: "number", unit: "pg/mL" },
      ]},
      { group: "Fonction cardiaque", fields: [
        { key: "fevg",        label: "FEVG (%)",     type: "number", unit: "%" },
        { key: "rythme",      label: "Rythme",       type: "select", options: ["Sinusal", "ACFA", "Flutter", "Autre"] },
        { key: "anticoag",    label: "Anticoagulation", type: "select", options: ["Non", "AVK", "NACO", "Aspirine"] },
      ]},
    ],
    consultation_templates: [
      { name: "Compte rendu cardiologique", category: "consultation" },
      { name: "Compte rendu ECG",           category: "ecg"         },
      { name: "Compte rendu échocardiographie", category: "echo"    },
      { name: "Certificat d'aptitude",      category: "certificat"  },
      { name: "Ordonnance cardiologique",   category: "ordonnance"  },
    ],
    ai_system_prompt: `Tu es un assistant médical spécialisé en cardiologie. Tu assistes le cardiologue dans l'interprétation des ECG, l'analyse des paramètres hémodynamiques (FEVG, BNP, troponine), les scores de risque cardiovasculaire (CHA2DS2-VASc, HAS-BLED, ASCVD), la gestion des anticoagulants et le suivi de l'insuffisance cardiaque, HTA, coronaropathie, arythmies. Toujours préciser: "Analyse IA à vérifier par le médecin."`,
    ai_focus: ["ECG", "HTA", "FEVG", "BNP", "Troponine", "Anticoagulants", "CHA2DS2-VASc", "HAS-BLED"],
  },

  ophtalmologie: {
    id: "ophtalmologie",
    label: "Ophtalmologie",
    short: "Ophtalmologiste",
    icon: "Eye",
    color: "#6366f1",
    dashboard_title: "Cabinet d'Ophtalmologie",
    patient_tabs: [
      "new-visit", "specialty", "imaging", "diagnosis",
      "followup", "fiche", "historique", "docs", "templates", "ai"
    ],
    specialty_tab_label: "Examen Ophtalmologique",
    extra_fields: [
      { group: "Acuité visuelle", fields: [
        { key: "av_od_sc",    label: "AV OD sans correction",  type: "text" },
        { key: "av_og_sc",    label: "AV OG sans correction",  type: "text" },
        { key: "av_od_ac",    label: "AV OD avec correction",  type: "text" },
        { key: "av_og_ac",    label: "AV OG avec correction",  type: "text" },
      ]},
      { group: "Tension oculaire", fields: [
        { key: "to_od",       label: "TO OD (mmHg)",  type: "number", unit: "mmHg" },
        { key: "to_og",       label: "TO OG (mmHg)",  type: "number", unit: "mmHg" },
      ]},
      { group: "Réfraction", fields: [
        { key: "ref_od_sph",  label: "OD Sphère",     type: "number", unit: "D" },
        { key: "ref_od_cyl",  label: "OD Cylindre",   type: "number", unit: "D" },
        { key: "ref_od_axe",  label: "OD Axe",        type: "number", unit: "°" },
        { key: "ref_og_sph",  label: "OG Sphère",     type: "number", unit: "D" },
        { key: "ref_og_cyl",  label: "OG Cylindre",   type: "number", unit: "D" },
        { key: "ref_og_axe",  label: "OG Axe",        type: "number", unit: "°" },
      ]},
      { group: "Examens", fields: [
        { key: "fond_oeil",   label: "Fond d'œil",         type: "textarea" },
        { key: "oct",         label: "OCT",                type: "textarea" },
        { key: "champ_vis",   label: "Champ visuel",       type: "textarea" },
        { key: "pathologie",  label: "Pathologie",         type: "select", options: ["Aucune", "Cataracte", "Glaucome", "DMLA", "Rétinopathie diabétique", "Myopie", "Hypermétropie", "Astigmatisme", "Autre"] },
      ]},
    ],
    consultation_templates: [
      { name: "Examen ophtalmologique", category: "consultation" },
      { name: "Ordonnance lunettes",    category: "ordonnance"   },
      { name: "Compte rendu OCT",       category: "imagerie"     },
      { name: "Certificat ophtalmologique", category: "certificat" },
    ],
    ai_system_prompt: `Tu es un assistant médical spécialisé en ophtalmologie. Tu aides l'ophtalmologiste dans l'interprétation des examens (AV, TO, OCT, champ visuel), l'analyse de la réfraction, la gestion du glaucome, de la cataracte, de la DMLA, de la rétinopathie diabétique. Toujours préciser: "Analyse IA à vérifier par le médecin."`,
    ai_focus: ["Acuité visuelle OD/OG", "Tension oculaire", "OCT", "Fond d'œil", "Glaucome", "Cataracte", "Réfraction"],
  },

  radiologie: {
    id: "radiologie",
    label: "Radiologie",
    short: "Radiologue",
    icon: "ScanLine",
    color: "#0ea5e9",
    dashboard_title: "Cabinet de Radiologie",
    patient_tabs: [
      "new-visit", "specialty", "imaging", "diagnosis",
      "fiche", "historique", "docs", "templates", "ai"
    ],
    specialty_tab_label: "Compte Rendu Radiologique",
    extra_fields: [
      { group: "Examen", fields: [
        { key: "type_exam",    label: "Type d'examen",       type: "select", options: ["Radiographie", "Scanner", "IRM", "Échographie", "Mammographie", "Ostéodensitométrie", "Autre"] },
        { key: "region",       label: "Région anatomique",   type: "text"  },
        { key: "indication",   label: "Indication clinique", type: "textarea" },
        { key: "contraste",    label: "Produit de contraste", type: "select", options: ["Sans", "Iodé", "Gadolinium"] },
      ]},
      { group: "Compte rendu", fields: [
        { key: "technique",    label: "Technique",           type: "textarea" },
        { key: "resultats",    label: "Résultats",           type: "textarea" },
        { key: "conclusion",   label: "Conclusion",          type: "textarea" },
        { key: "impression",   label: "Impression diagnostique", type: "textarea" },
      ]},
    ],
    consultation_templates: [
      { name: "Compte rendu radiologique",    category: "cr"       },
      { name: "Compte rendu scanner",         category: "cr"       },
      { name: "Compte rendu IRM",             category: "cr"       },
      { name: "Compte rendu échographie",     category: "cr"       },
      { name: "Demande d'examen",             category: "demande"  },
    ],
    ai_system_prompt: `Tu es un assistant médical spécialisé en radiologie diagnostique. Tu aides le radiologue dans la structuration des comptes rendus (radiographies, scanner, IRM, échographie, mammographie), l'impression diagnostique et les conclusions. Toujours préciser: "Analyse IA à vérifier par le médecin."`,
    ai_focus: ["Radiographie", "Scanner", "IRM", "Échographie", "Compte rendu structuré", "Impression diagnostique"],
  },

  orl: {
    id: "orl",
    label: "ORL",
    short: "ORL",
    icon: "Ear",
    color: "#f59e0b",
    dashboard_title: "Cabinet ORL",
    patient_tabs: [
      "new-visit", "specialty", "imaging", "diagnosis",
      "followup", "fiche", "historique", "docs", "templates", "ai"
    ],
    specialty_tab_label: "Examen ORL",
    extra_fields: [
      { group: "Otoscopie", fields: [
        { key: "otoscopie_d",   label: "Otoscopie droite",    type: "textarea" },
        { key: "otoscopie_g",   label: "Otoscopie gauche",    type: "textarea" },
      ]},
      { group: "Audiométrie", fields: [
        { key: "seuil_conv_d",  label: "Seuil conduction aér. D (dB)", type: "number", unit: "dB" },
        { key: "seuil_conv_g",  label: "Seuil conduction aér. G (dB)", type: "number", unit: "dB" },
        { key: "type_surdite",  label: "Type de surdité",    type: "select", options: ["Aucune", "Transmission", "Perception", "Mixte"] },
      ]},
      { group: "Rhinoscopie", fields: [
        { key: "rhino",         label: "Rhinoscopie",         type: "textarea" },
        { key: "sinus",         label: "Sinusite",            type: "select", options: ["Non", "Aiguë", "Chronique", "Frontale", "Maxillaire", "Ethmoïdale"] },
      ]},
      { group: "Laryngoscopie", fields: [
        { key: "laryngo",       label: "Laryngoscopie",       type: "textarea" },
        { key: "amygdales",     label: "Amygdales",           type: "select", options: ["Normales", "Hypertrophiées", "Cicatricielles", "Cryptiques"] },
        { key: "vertiges",      label: "Vertiges",            type: "select", options: ["Non", "Positionnels (VPPB)", "Vestibulaires", "Centraux"] },
        { key: "acouphenes",    label: "Acouphènes",          type: "select", options: ["Non", "Unilatéraux", "Bilatéraux", "Pulsatiles"] },
      ]},
    ],
    consultation_templates: [
      { name: "Examen ORL standard",          category: "consultation" },
      { name: "Audiogramme",                  category: "bilan"        },
      { name: "Certificat ORL",               category: "certificat"   },
    ],
    ai_system_prompt: `Tu es un assistant médical spécialisé en ORL (oto-rhino-laryngologie). Tu aides l'ORL dans l'interprétation des examens (otoscopie, audiogramme, rhinoscopie, laryngoscopie), la gestion des vertiges, acouphènes, sinusites, pathologies amygdaliennes. Toujours préciser: "Analyse IA à vérifier par le médecin."`,
    ai_focus: ["Otoscopie", "Audiogramme", "Vertiges", "Sinusite", "Acouphènes", "Amygdales"],
  },

  gynecologie: {
    id: "gynecologie",
    label: "Gynécologie-Obstétrique",
    short: "Gynécologue",
    icon: "Baby",
    color: "#ec4899",
    dashboard_title: "Cabinet de Gynécologie",
    patient_tabs: [
      "new-visit", "specialty", "imaging", "diagnosis",
      "followup", "fiche", "historique", "docs", "templates", "ai"
    ],
    specialty_tab_label: "Données Gynéco",
    extra_fields: [
      { group: "Cycle & Ménopause", fields: [
        { key: "ddr",           label: "Date dernières règles",   type: "date" },
        { key: "cycle_duree",   label: "Durée du cycle (j)",      type: "number", unit: "j" },
        { key: "menopause",     label: "Ménopause",               type: "select", options: ["Non", "Périménopause", "Oui"] },
        { key: "contraception", label: "Contraception",           type: "select", options: ["Aucune", "Pilule", "DIU", "Implant", "Préservatif", "Stérilisation", "Autre"] },
      ]},
      { group: "Grossesse", fields: [
        { key: "grossesse",     label: "Grossesse en cours",      type: "select", options: ["Non", "Oui"] },
        { key: "terme",         label: "Terme (SA)",              type: "number", unit: "SA" },
        { key: "gestite",       label: "Gestité",                 type: "number" },
        { key: "parite",        label: "Parité",                  type: "number" },
      ]},
      { group: "Dépistages", fields: [
        { key: "frottis_date",  label: "Dernier frottis",         type: "date" },
        { key: "frottis_result", label: "Résultat frottis",       type: "select", options: ["Normal", "ASC-US", "CIN1", "CIN2", "CIN3", "En attente"] },
        { key: "mammo_date",    label: "Dernière mammographie",   type: "date" },
      ]},
    ],
    consultation_templates: [
      { name: "Consultation gynécologique",    category: "consultation" },
      { name: "Suivi de grossesse",            category: "suivi"       },
      { name: "Ordonnance gynécologique",      category: "ordonnance"  },
      { name: "Compte rendu échographie",      category: "imagerie"    },
      { name: "Certificat gynécologique",      category: "certificat"  },
    ],
    ai_system_prompt: `Tu es un assistant médical spécialisé en gynécologie-obstétrique. Tu aides le gynécologue dans le suivi des grossesses, la gestion du cycle menstruel, la contraception, les dépistages (frottis, mammographie), l'échographie obstétricale. Toujours préciser: "Analyse IA à vérifier par le médecin."`,
    ai_focus: ["Grossesse", "Cycle", "Contraception", "Frottis", "Échographie obstétricale", "Ménopause"],
  },

  pediatrie: {
    id: "pediatrie",
    label: "Pédiatrie",
    short: "Pédiatre",
    icon: "Baby2",
    color: "#06b6d4",
    dashboard_title: "Cabinet de Pédiatrie",
    patient_tabs: [
      "new-visit", "vitals", "bmi", "specialty", "diagnosis",
      "followup", "fiche", "historique", "docs", "templates", "ai"
    ],
    specialty_tab_label: "Données Pédiatriques",
    extra_fields: [
      { group: "Anthropométrie", fields: [
        { key: "poids",         label: "Poids (kg)",               type: "number", unit: "kg" },
        { key: "taille",        label: "Taille (cm)",              type: "number", unit: "cm" },
        { key: "pc",            label: "Périmètre crânien (cm)",   type: "number", unit: "cm" },
        { key: "age_mois",      label: "Âge en mois",              type: "number", unit: "mois" },
        { key: "percentile",    label: "Percentile poids",         type: "text" },
      ]},
      { group: "Développement", fields: [
        { key: "developpement", label: "Développement psychomoteur", type: "select", options: ["Normal", "Retard léger", "Retard modéré", "Retard sévère", "En cours d'évaluation"] },
        { key: "allaitement",   label: "Allaitement",               type: "select", options: ["Maternel", "Artificiel", "Mixte", "Diversification"] },
        { key: "antec_neo",     label: "Antécédents néonataux",     type: "textarea" },
      ]},
      { group: "Vaccins", fields: [
        { key: "vaccin_bcg",    label: "BCG",        type: "select", options: ["Fait", "Non fait", "En retard"] },
        { key: "vaccin_dtcp",   label: "DTCoqP",     type: "select", options: ["Fait", "Non fait", "Partiel", "À jour"] },
        { key: "vaccin_rmr",    label: "ROR",        type: "select", options: ["Fait", "Non fait", "1 dose", "2 doses"] },
        { key: "vaccin_notes",  label: "Notes carnet vaccins", type: "textarea" },
      ]},
    ],
    consultation_templates: [
      { name: "Consultation pédiatrique",      category: "consultation" },
      { name: "Carnet de santé",               category: "suivi"       },
      { name: "Certificat de vaccination",     category: "certificat"  },
      { name: "Ordonnance pédiatrique",        category: "ordonnance"  },
    ],
    ai_system_prompt: `Tu es un assistant médical spécialisé en pédiatrie. Tu aides le pédiatre dans le suivi de la croissance (courbes poids/taille/PC), le carnet vaccinal, le développement psychomoteur, la posologie adaptée au poids, les maladies infantiles. Toujours préciser: "Analyse IA à vérifier par le médecin."`,
    ai_focus: ["Courbes de croissance", "Vaccinations", "Développement psychomoteur", "Posologie/poids", "Maladies infantiles"],
  },

  dermatologie: {
    id: "dermatologie",
    label: "Dermatologie",
    short: "Dermatologue",
    icon: "Scan",
    color: "#d97706",
    dashboard_title: "Cabinet de Dermatologie",
    patient_tabs: [
      "new-visit", "specialty", "imaging", "diagnosis",
      "followup", "fiche", "historique", "docs", "templates", "ai"
    ],
    specialty_tab_label: "Examen Dermatologique",
    extra_fields: [
      { group: "Lésion", fields: [
        { key: "type_lesion",   label: "Type de lésion",      type: "select", options: ["Macule", "Papule", "Vésicule", "Bulle", "Pustule", "Nodule", "Plaque", "Ulcère", "Cicatrice", "Érythème", "Autre"] },
        { key: "localisation",  label: "Localisation",        type: "text" },
        { key: "surface",       label: "Surface atteinte",    type: "select", options: ["Localisée", "Régionale", "Généralisée"] },
        { key: "evolution",     label: "Évolution",           type: "select", options: ["Aiguë", "Chronique", "Récidivante"] },
      ]},
      { group: "Diagnostic dermatologique", fields: [
        { key: "pathologie",    label: "Pathologie",          type: "select", options: ["Eczéma", "Psoriasis", "Acné", "Urticaire", "Dermatite", "Mycose", "Lichen", "Mélanome", "Épithélioma", "Autre"] },
        { key: "biopsie",       label: "Biopsie",             type: "select", options: ["Non", "Réalisée", "En attente de résultat"] },
        { key: "biopsie_res",   label: "Résultat biopsie",    type: "textarea" },
      ]},
      { group: "Traitement local", fields: [
        { key: "ttt_local",     label: "Traitement topique",  type: "textarea" },
        { key: "phototherapie", label: "Photothérapie",       type: "select", options: ["Non", "UVB", "PUVA", "Laser"] },
      ]},
    ],
    consultation_templates: [
      { name: "Examen dermatologique",        category: "consultation" },
      { name: "Fiche lésion dermatologique",  category: "fiche"       },
      { name: "Ordonnance dermatologique",    category: "ordonnance"  },
      { name: "Compte rendu biopsie",         category: "cr"          },
    ],
    ai_system_prompt: `Tu es un assistant médical spécialisé en dermatologie. Tu aides le dermatologue dans la description des lésions cutanées, l'analyse des diagnostics différentiels (psoriasis, eczéma, acné, mélanome), les traitements topiques, la photothérapie. Toujours préciser: "Analyse IA à vérifier par le médecin."`,
    ai_focus: ["Lésions cutanées", "Psoriasis", "Eczéma", "Acné", "Mélanome", "Biopsie", "Traitements topiques"],
  },
};

export const SPECIALITY_LIST = [
  { id: "generaliste",  label: "Médecine Générale",       icon: "🩺", color: "#10b981" },
  { id: "cardiologie",  label: "Cardiologie",             icon: "❤️", color: "#ef4444" },
  { id: "ophtalmologie",label: "Ophtalmologie",           icon: "👁️", color: "#6366f1" },
  { id: "radiologie",   label: "Radiologie",              icon: "🔬", color: "#0ea5e9" },
  { id: "orl",          label: "ORL",                     icon: "👂", color: "#f59e0b" },
  { id: "gynecologie",  label: "Gynécologie-Obstétrique", icon: "🌸", color: "#ec4899" },
  { id: "pediatrie",    label: "Pédiatrie",               icon: "👶", color: "#06b6d4" },
  { id: "dermatologie", label: "Dermatologie",            icon: "🔍", color: "#d97706" },
];

/**
 * Returns the config for a given speciality ID.
 * Falls back to cardiologie for backward compatibility.
 */
export function getSpecialityConfig(id) {
  return SPECIALITIES[id] || SPECIALITIES["cardiologie"];
}

/**
 * Returns the allTabs array for MedicalWorkspace based on speciality config.
 * Overrides labels where config specifies (e.g. specialty_tab_label).
 */
export function buildTabList(config) {
  if (!config) return Object.entries(TAB_REGISTRY).map(([id, t]) => ({ id, ...t }));
  return (config.patient_tabs || []).map(id => {
    const base = TAB_REGISTRY[id] || { label: id, icon: "FileText", group: "outils" };
    const label = id === "specialty" ? (config.specialty_tab_label || "Spécialité")
                : id === "profile"  ? (config.profile_label       || "Profil")
                : base.label;
    return { id, ...base, label };
  });
}
