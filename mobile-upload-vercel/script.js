const ALLOWED_EXTENSIONS = [".pdf", ".jpg", ".jpeg", ".png", ".dcm", ".dicom"];
const BLOCKED_EXTENSIONS = [".exe", ".bat", ".cmd", ".com", ".msi", ".scr", ".pif", ".vbs", ".js", ".ws", ".wsf"];
const ALLOWED_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "application/dicom", "application/octet-stream", ""];
const MAX_FILE_BYTES = 50 * 1024 * 1024;

const statusEl = document.querySelector("#status");
const form = document.querySelector("#uploadForm");
const fileInput = form.querySelector("input[name='file']");
const progressBar = document.querySelector("#progressBar");
const progressFill = document.querySelector("#progressFill");
const progressText = document.querySelector("#progressText");

function parsePatientId() {
  const match = window.location.pathname.match(/^\/upload\/(\d+)/);
  return match ? match[1] : "";
}

function extensionOf(fileName) {
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function showStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.className = `status status--${type}`;
}

function showProgress(percent) {
  progressBar.hidden = false;
  progressFill.style.width = percent + "%";
  progressText.textContent = Math.round(percent) + "%";
}

function hideProgress() {
  progressBar.hidden = true;
  progressFill.style.width = "0%";
  progressText.textContent = "";
}

const params = new URLSearchParams(window.location.search);
const patientId = parsePatientId();
const token = params.get("token") || "";
const target = params.get("target") || "";

if (!patientId || !token) {
  showStatus("Lien invalide. Veuillez scanner un nouveau QR code depuis le logiciel du cabinet.", "error");
} else if (!target) {
  showStatus("Lien incomplet: l'adresse du PC du cabinet est manquante. Verifiez la configuration du tunnel Cloudflare.", "error");
} else {
  showStatus("Lien valide pendant 15 minutes. Selectionnez le fichier a envoyer.", "ok");
  form.hidden = false;
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  const extension = extensionOf(file.name);
  if (BLOCKED_EXTENSIONS.includes(extension)) {
    fileInput.value = "";
    showStatus("Fichier executable/script refuse pour raisons de securite.", "error");
    return;
  }
  if (!ALLOWED_EXTENSIONS.includes(extension) || !ALLOWED_MIME_TYPES.includes(file.type)) {
    fileInput.value = "";
    showStatus("Fichier refuse: seuls PDF, JPG, PNG et DICOM sont autorises.", "error");
    return;
  }
  if (file.size > MAX_FILE_BYTES) {
    fileInput.value = "";
    showStatus("Fichier trop volumineux. Maximum 50 Mo.", "error");
    return;
  }
  showStatus(`${file.name} (${(file.size / 1024 / 1024).toFixed(1)} Mo) pret pour envoi.`, "ok");
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const file = fileInput.files[0];
  if (!file) {
    showStatus("Veuillez choisir un fichier.", "error");
    return;
  }

  const formData = new FormData(form);
  formData.set("token", token);

  const uploadUrl = `${target.replace(/\/+$/, "")}/api/patients/${patientId}/documents/upload-mobile`;
  const button = form.querySelector("button");
  button.disabled = true;
  showStatus("Envoi direct vers le PC du cabinet...", "info");
  showProgress(0);

  try {
    const xhr = new XMLHttpRequest();
    const result = await new Promise((resolve, reject) => {
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) showProgress((e.loaded / e.total) * 100);
      });
      xhr.addEventListener("load", () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(xhr.responseText);
        } else {
          try {
            const err = JSON.parse(xhr.responseText);
            reject(new Error(err.detail || "Upload refuse"));
          } catch {
            reject(new Error("Upload refuse (code " + xhr.status + ")"));
          }
        }
      });
      xhr.addEventListener("error", () => reject(new Error("Erreur reseau. Verifiez que le tunnel Cloudflare du cabinet est actif.")));
      xhr.addEventListener("timeout", () => reject(new Error("Timeout. Le PC du cabinet ne repond pas.")));
      xhr.timeout = 120000;
      xhr.open("POST", uploadUrl);
      xhr.send(formData);
    });
    form.reset();
    showProgress(100);
    showStatus("Document envoye avec succes ! Le dossier patient se met a jour automatiquement sur le PC du cabinet.", "ok");
  } catch (error) {
    showStatus(error.message || "Erreur upload. Verifiez que le tunnel Cloudflare du cabinet est actif.", "error");
    hideProgress();
  } finally {
    button.disabled = false;
  }
});
