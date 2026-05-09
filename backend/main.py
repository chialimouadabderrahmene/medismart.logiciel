from __future__ import annotations

import csv
import base64
import html
import mimetypes
import hashlib
import json
import math
import os
import re
import secrets
import shutil
import signal
import socket
import sqlite3
import subprocess
import sys
import threading
import uuid
from dataclasses import asdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import quote
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from fastapi import Body, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, Response
from pydantic import BaseModel, Field as PydanticField
from backend.ai_providers import (
    AIProviderError,
    ChatMessage,
    OpenRouterProvider,
)

try:
    import qrcode
except Exception:
    qrcode = None

try:
    from reportlab.lib.pagesizes import A4, A5
    from reportlab.lib.utils import ImageReader, simpleSplit
    from reportlab.pdfgen import canvas
except Exception:
    A4 = None
    A5 = None
    canvas = None
    ImageReader = None
    simpleSplit = None

def _default_root() -> Path:
    configured_root = (os.environ.get("CARDIO_APP_ROOT") or "").strip()
    if configured_root:
        return Path(configured_root).resolve()
    if getattr(sys, "frozen", False):
        return Path(getattr(sys, "_MEIPASS", Path(sys.executable).resolve().parent)).resolve()
    return Path(__file__).resolve().parent.parent


ROOT = _default_root()
BACKEND = Path(os.environ.get("CARDIO_BACKEND_DIR") or (ROOT / "backend")).resolve()
if not (BACKEND / "schema.sql").is_file() and getattr(sys, "_MEIPASS", None):
    bundled_backend = Path(sys._MEIPASS) / "backend"
    if (bundled_backend / "schema.sql").is_file():
        BACKEND = bundled_backend
DATA = Path(os.environ.get("CARDIO_DATA_DIR") or (ROOT / "data")).resolve()
DB_PATH = DATA / "cardiologie.sqlite3"
UPLOADS = DATA / "uploads"
BACKUPS = DATA / "backups"
BOOTSTRAP_DB_NAME = "cardiologie.sqlite3"
BOOTSTRAP_MIN_PATIENTS = 1000
LOCKED_AI_MODEL = "qwen/qwen-2.5-7b-instruct"
AI_DEFAULT_MAX_TOKENS = 256
AI_DEFAULT_MONTHLY_TOKEN_LIMIT = 20000
AI_DEFAULT_ANALYSIS_MODE = "short"
AI_CONTEXT_CHAR_LIMIT = 1800
AI_DOCUMENT_CONTEXT_LIMIT = 5000
MOBILE_TOKEN_TTL_MINUTES = 15
MAX_MOBILE_FILE_BYTES = 50 * 1024 * 1024
ALLOWED_MOBILE_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".dcm", ".dicom"}
ALLOWED_MOBILE_MIME_TYPES = {
    "application/pdf",
    "image/jpeg",
    "image/png",
    "application/dicom",
    "application/octet-stream",
}
BLOCKED_EXTENSIONS = {".exe", ".msi", ".bat", ".cmd", ".ps1", ".vbs", ".js", ".jar", ".scr", ".com"}
SECRET_SETTING_KEYS = {"AI_OPENROUTER_API_KEY", "AI_OPENAI_API_KEY", "AI_GEMINI_API_KEY", "CLOUD_AI_SECRET"}
DEFAULT_SETTINGS = {
    "AI_PROVIDER": "openrouter",
    "AI_MODEL_NAME": LOCKED_AI_MODEL,
    "AI_OPENAI_MODEL": "gpt-4o-mini",
    "AI_GEMINI_MODEL": "gemini-2.0-flash",
    "AI_OPENROUTER_OCR_MODEL": LOCKED_AI_MODEL,
    "AI_OPENAI_BASE_URL": "",
    "AI_LOCAL_BASE_URL": "http://127.0.0.1:1234/v1",
    "AI_CHAT_ENABLED": "true",
    "AI_DOCUMENT_AI_ENABLED": "true",
    "AI_ANALYSIS_MODE": AI_DEFAULT_ANALYSIS_MODE,
    "AI_AUTO_ANALYZE_AFTER_UPLOAD": "false",
    "AI_MAX_FILE_MB": "10",
    "AI_MAX_TOKENS": str(AI_DEFAULT_MAX_TOKENS),
    "AI_MONTHLY_TOKEN_LIMIT": str(AI_DEFAULT_MONTHLY_TOKEN_LIMIT),
    "AI_REQUIRE_MANUAL_CONSENT": "false",
    "UPLOAD_MODE": "local",
    "PUBLIC_PC_UPLOAD_URL": "",
    "VERCEL_UPLOAD_URL": "",
    "DOCTOR_NAME": "Dr. Chiali Mohammed Kamel",
    "DOCTOR_SPECIALTY": "Medecin cardiologue",
    "DOCTOR_ORDER_NUMBER": "",
    "DOCTOR_EMAIL": "",
    "DOCTOR_PHONE": "",
    "DOCTOR_ADDRESS": "",
    "DOCTOR_ADDRESS_NOTE": "(ex :rue Gambetta)",
    "CLINIC_NAME": "Cabinet de Cardiologie",
    "CLINIC_CITY": "SIDI BEL ABBES",
    "CABINET_NAME": "Cabinet de Cardiologie",
    "GOOGLE_DRIVE_BACKUP_EMAIL": "",
    "GOOGLE_DRIVE_BACKUP_DIR": "",
    "CABINET_ADDRESS": "",
    "CABINET_PHONE": "",
    "CLOUD_AI_URL": "",
    "CLOUD_AI_DOCTOR_ID": "",
    "CLOUD_AI_SECRET": "",
    "SETUP_COMPLETE": "",
    "DOCTOR_SPECIALITY_ID": "cardiologie",
    "DOCTOR_LOGO_B64": "",
}
AI_DECISION_SUPPORT_WARNING = "⚠️ Analyse IA à vérifier par le médecin. Ne jamais utiliser comme diagnostic ou prescription automatique."


AI_DECISION_SUPPORT_WARNING = "Analyse IA a verifier par le medecin. Ne jamais utiliser comme diagnostic ou prescription automatique."
AI_SAFETY_WARNING = "Analyse IA à vérifier par le médecin"
AI_DECISION_SUPPORT_WARNING = AI_SAFETY_WARNING
AI_SAFETY_WARNING = "Analyse IA \u00e0 v\u00e9rifier par le m\u00e9decin"
AI_DECISION_SUPPORT_WARNING = AI_SAFETY_WARNING
SETTING_MIRRORS = {
    "CLINIC_NAME": "CABINET_NAME",
    "CABINET_NAME": "CLINIC_NAME",
    "DOCTOR_ADDRESS": "CABINET_ADDRESS",
    "CABINET_ADDRESS": "DOCTOR_ADDRESS",
    "DOCTOR_PHONE": "CABINET_PHONE",
    "CABINET_PHONE": "DOCTOR_PHONE",
}


def parse_int_setting(value: Any, fallback: int) -> int:
    try:
        return max(1, int(float(value)))
    except Exception:
        return fallback


def normalize_ai_provider(value: str | None) -> str:
    provider = (value or "").strip().lower().replace("-", "_")
    if provider in {"", "disabled", "off", "desactive", "désactivé"}:
        return "disabled"
    return "openrouter"


def normalize_analysis_mode(value: str | None) -> str:
    mode = (value or AI_DEFAULT_ANALYSIS_MODE).strip().lower()
    return mode if mode in {"short", "normal", "detailed"} else AI_DEFAULT_ANALYSIS_MODE


def ai_model_for_provider(provider: str) -> str:
    if provider == "disabled":
        return ""
    return LOCKED_AI_MODEL


def ai_document_model_for_provider(provider: str) -> str:
    return ai_model_for_provider(provider)


def ai_api_key_for_provider(provider: str) -> str:
    if provider == "openrouter":
        return get_setting("AI_OPENROUTER_API_KEY").strip()
    return ""


def ai_chat_enabled() -> bool:
    return setting_enabled("AI_CHAT_ENABLED")


def ai_document_ai_enabled() -> bool:
    return setting_enabled("AI_DOCUMENT_AI_ENABLED")


def ai_analysis_mode() -> str:
    return normalize_analysis_mode(get_setting("AI_ANALYSIS_MODE") or DEFAULT_SETTINGS["AI_ANALYSIS_MODE"])


def ai_max_tokens() -> int:
    return parse_int_setting(get_setting("AI_MAX_TOKENS") or DEFAULT_SETTINGS["AI_MAX_TOKENS"], AI_DEFAULT_MAX_TOKENS)


def ai_monthly_token_limit() -> int:
    return parse_int_setting(get_setting("AI_MONTHLY_TOKEN_LIMIT") or DEFAULT_SETTINGS["AI_MONTHLY_TOKEN_LIMIT"], AI_DEFAULT_MONTHLY_TOKEN_LIMIT)


def analysis_mode_token_limit(mode: str | None = None) -> int:
    normalized = normalize_analysis_mode(mode)
    preset = {"short": 256, "normal": 384, "detailed": 512}[normalized]
    return min(preset, ai_max_tokens())


def enforce_locked_ai_settings(conn: sqlite3.Connection | None = None) -> None:
    updates = {
        "AI_PROVIDER": "openrouter",
        "AI_MODEL_NAME": LOCKED_AI_MODEL,
        "AI_ANALYSIS_MODE": AI_DEFAULT_ANALYSIS_MODE,
        "AI_MAX_TOKENS": str(AI_DEFAULT_MAX_TOKENS),
        "AI_AUTO_ANALYZE_AFTER_UPLOAD": "false",
        "AI_REQUIRE_MANUAL_CONSENT": "false",
    }
    if conn is None:
        with connect() as inner_conn:
            for key, value in updates.items():
                set_setting(key, value)
            sync_ai_settings_snapshot(inner_conn)
        return
    for key, value in updates.items():
        conn.execute(
            """
            INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
            """,
            (key, value, now_iso()),
        )


def max_ai_file_bytes() -> int:
    try:
        mb = float(get_setting("AI_MAX_FILE_MB") or DEFAULT_SETTINGS["AI_MAX_FILE_MB"])
    except ValueError:
        mb = 10
    return max(1, int(mb)) * 1024 * 1024


def ai_settings_payload() -> dict[str, Any]:
    settings = get_all_settings()
    keys = [
        "AI_PROVIDER",
        "AI_MODEL_NAME",
        "AI_CHAT_ENABLED",
        "AI_DOCUMENT_AI_ENABLED",
        "AI_ANALYSIS_MODE",
        "AI_AUTO_ANALYZE_AFTER_UPLOAD",
        "AI_MAX_FILE_MB",
        "AI_MAX_TOKENS",
        "AI_MONTHLY_TOKEN_LIMIT",
        "AI_REQUIRE_MANUAL_CONSENT",
        "AI_OPENROUTER_API_KEY_CONFIGURED",
    ]
    payload = {key: settings.get(key, DEFAULT_SETTINGS.get(key, "")) for key in keys}
    payload["AI_MODEL_NAME"] = LOCKED_AI_MODEL
    payload["AI_PROVIDER"] = "openrouter" if payload.get("AI_PROVIDER") != "disabled" else "disabled"
    payload["AI_LOCKED_MODEL"] = LOCKED_AI_MODEL
    payload["CLOUD_AI_CONFIGURED"] = "true" if cloud_ai_configured() else "false"
    return payload


def make_chat_provider(provider: str, model: str, max_new_tokens: int | None = None):
    if provider != "openrouter":
        raise AIProviderError("AI disabled")
    return OpenRouterProvider(model=model, api_key=ai_api_key_for_provider(provider), max_new_tokens=max_new_tokens or ai_max_tokens())


def accepted_document_summaries(conn: sqlite3.Connection, patient_id: int) -> list[dict[str, Any]]:
    return rows_to_dicts(conn.execute(
        """
        SELECT document_type, COALESCE(validated_summary, summary, '') AS summary,
               risk_level, provider, model, created_at, analysis_mode
        FROM ai_document_analyses
        WHERE patient_id = ? AND status = 'accepted'
        ORDER BY created_at DESC, id DESC
        LIMIT 8
        """,
        (patient_id,),
    ).fetchall())


def compact_document_summary(analysis: dict[str, Any] | None) -> dict[str, Any]:
    if not analysis:
        return {}
    return {
        "document_type": analysis.get("document_type"),
        "summary": analysis.get("validated_summary") or analysis.get("summary") or "",
        "risk_level": analysis.get("risk_level"),
        "status": analysis.get("status"),
        "created_at": analysis.get("created_at"),
    }


def compact_patient_context(conn: sqlite3.Connection, patient_id: int) -> dict[str, Any]:
    patient = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    cardio = cardio_summary_for_patient(conn, patient_id)
    latest_vital = latest_or_empty(cardio.get("vitals") or [])
    latest_lab = latest_or_empty(cardio.get("labs") or [])
    latest_ecg = latest_or_empty(cardio.get("ecgs") or [])
    latest_imaging = latest_or_empty(cardio.get("imaging") or [])
    followups = cardio.get("followups") or []
    open_followups = [item for item in followups if str(item.get("status") or "").lower() in {"open", "pending"}]
    profile = cardio.get("profile") or {}
    recent_docs = accepted_document_summaries(conn, patient_id)
    context = {
        "age": patient["age"],
        "sex": patient["sexe"],
        "allergies": limited_text(patient["allergies"] or "", 400),
        "chronic_diseases": limited_text(patient["maladies"] or "", 600),
        "current_medications": limited_text(profile.get("current_medications") or "", 500),
        "latest_vitals": {
            "date": latest_vital.get("measured_at") or latest_vital.get("date_visite") or "",
            "blood_pressure": f"{latest_vital.get('systolic_bp') or ''}/{latest_vital.get('diastolic_bp') or ''}".strip("/"),
            "heart_rate": latest_vital.get("heart_rate") or "",
            "oxygen_saturation": latest_vital.get("oxygen_saturation") or "",
            "weight": latest_vital.get("weight") or "",
        },
        "latest_labs": {
            "date": latest_lab.get("measured_at") or "",
            "ldl": latest_lab.get("ldl") or "",
            "hdl": latest_lab.get("hdl") or "",
            "troponin": latest_lab.get("troponin") or "",
            "bnp": latest_lab.get("bnp") or "",
            "nt_probnp": latest_lab.get("nt_probnp") or "",
            "creatinine": latest_lab.get("creatinine") or "",
        },
        "latest_ecg": {
            "date": latest_ecg.get("recorded_at") or "",
            "rhythm": latest_ecg.get("rhythm") or "",
            "qrs_ms": latest_ecg.get("qrs_ms") or "",
            "qtc_ms": latest_ecg.get("qtc_ms") or "",
            "severity": latest_ecg.get("severity") or "",
        },
        "latest_imaging": {
            "date": latest_imaging.get("performed_at") or "",
            "ejection_fraction": latest_imaging.get("ejection_fraction") or "",
            "valve_status": latest_imaging.get("valve_status") or "",
            "wall_motion": latest_imaging.get("wall_motion") or "",
            "severity": latest_imaging.get("severity") or "",
        },
        "open_followups": [
            {"due_at": item.get("due_at"), "reason": item.get("reason"), "priority": item.get("priority"), "status": item.get("status")}
            for item in open_followups[:5]
        ],
        "recent_document_summaries": [
            {
                "document_type": item.get("document_type"),
                "summary": limited_text(item.get("summary") or "", 350),
                "risk_level": item.get("risk_level"),
                "analysis_mode": item.get("analysis_mode") or ai_analysis_mode(),
            }
            for item in recent_docs[:4]
        ],
        "alerts": cardio.get("alerts") or [],
        "scores": cardio.get("scores") or {},
    }
    return context


def build_chat_messages(user_message: str, patient_context: dict[str, Any] | None = None,
                        system_prompt_prefix: str | None = None) -> list[ChatMessage]:
    context_text = ""
    if patient_context:
        context_text = "\n\nCONTEXTE PATIENT COMPACT:\n" + limited_text(json.dumps(patient_context, ensure_ascii=False, default=str), AI_CONTEXT_CHAR_LIMIT)
    prefix_text = f"\n{system_prompt_prefix.strip()}\n" if system_prompt_prefix else ""
    system_prompt = f"""
Assistant d'aide à la décision (Qwen 2.5). Style concis, clinique, structuré.
Pas de diagnostic ou prescription automatique. Signaler incertitudes.
Pour prescriptions: noter interactions/précautions.{prefix_text}
{context_text}
IMPORTANT: {AI_DECISION_SUPPORT_WARNING}
""".strip()
    return [
        ChatMessage(role="system", content=system_prompt),
        ChatMessage(role="user", content=user_message.strip()),
    ]


def conversation_title(message: str) -> str:
    title = re.sub(r"\s+", " ", message.strip())
    return title[:70] or "Conversation IA"


def save_chat_message(conn: sqlite3.Connection, conversation_id: int, role: str, content: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
    cur = conn.execute(
        """
        INSERT INTO ai_messages (conversation_id, role, content, safety_note, metadata_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            conversation_id,
            role,
            content,
            AI_DECISION_SUPPORT_WARNING if role == "assistant" else "",
            json.dumps(metadata or {}, ensure_ascii=False),
            now_iso(),
        ),
    )
    return dict(conn.execute("SELECT * FROM ai_messages WHERE id = ?", (cur.lastrowid,)).fetchone())


def estimate_text_tokens(text: str) -> int:
    return max(1, math.ceil(len(text or "") / 4))


def estimate_messages_tokens(messages: list[ChatMessage]) -> int:
    return max(1, sum(estimate_text_tokens(item.content) + 8 for item in messages))


def current_usage_month() -> str:
    return datetime.now().strftime("%Y-%m")


def ai_usage_summary(conn: sqlite3.Connection) -> dict[str, Any]:
    month = current_usage_month()
    row = conn.execute(
        """
        SELECT
            COUNT(*) AS request_count,
            COALESCE(SUM(input_tokens), 0) AS input_tokens,
            COALESCE(SUM(output_tokens), 0) AS output_tokens,
            COALESCE(SUM(total_tokens), 0) AS total_tokens
        FROM ai_usage_logs
        WHERE substr(created_at, 1, 7) = ?
        """,
        (month,),
    ).fetchone()
    total_tokens = int(row["total_tokens"] or 0)
    limit_tokens = ai_monthly_token_limit()
    return {
        "month": month,
        "request_count": int(row["request_count"] or 0),
        "input_tokens": int(row["input_tokens"] or 0),
        "output_tokens": int(row["output_tokens"] or 0),
        "total_tokens": total_tokens,
        "limit_tokens": limit_tokens,
        "remaining_tokens": max(0, limit_tokens - total_tokens) if limit_tokens > 0 else None,
        "chat_enabled": ai_chat_enabled(),
        "document_ai_enabled": ai_document_ai_enabled(),
        "analysis_mode": ai_analysis_mode(),
        "model": LOCKED_AI_MODEL,
        "provider": "openrouter",
    }


def log_ai_usage(
    conn: sqlite3.Connection,
    usage_type: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    total_tokens: int,
    patient_id: int | None = None,
    document_id: int | None = None,
    conversation_id: int | None = None,
    analysis_id: int | None = None,
    analysis_mode: str | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO ai_usage_logs
        (usage_type, patient_id, document_id, conversation_id, analysis_id, model, analysis_mode,
         input_tokens, output_tokens, total_tokens, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            usage_type,
            patient_id,
            document_id,
            conversation_id,
            analysis_id,
            model,
            analysis_mode,
            input_tokens,
            output_tokens,
            total_tokens,
            now_iso(),
        ),
    )


def ensure_ai_usage_budget(conn: sqlite3.Connection, estimated_tokens: int) -> None:
    summary = ai_usage_summary(conn)
    limit_tokens = summary["limit_tokens"]
    if limit_tokens > 0 and summary["total_tokens"] + estimated_tokens > limit_tokens:
        raise HTTPException(status_code=429, detail="Limite mensuelle IA atteinte")


# ====================================================================
# AI CREDIT SYSTEM
# ====================================================================
AI_PLANS = {
    "starter": {"label": "Starter AI", "monthly_credits": 50, "unlimited": False},
    "pro": {"label": "Pro AI", "monthly_credits": 150, "unlimited": False},
    "premium": {"label": "Premium AI", "monthly_credits": 500, "unlimited": False},
    "enterprise": {"label": "Enterprise", "monthly_credits": 999999, "unlimited": True},
}

DEFAULT_CREDIT_COSTS = {
    "chat": 1,
    "lab_analysis": 3,
    "pdf_analysis": 3,
    "ecg_analysis": 5,
    "image_analysis": 5,
    "multimodal_analysis": 10,
    "irm_analysis": 10,
}


def credit_costs() -> dict[str, int]:
    """Return current credit costs (configurable via app_settings)."""
    raw = get_setting("AI_CREDIT_COSTS_JSON")
    if raw:
        try:
            stored = json.loads(raw)
            if isinstance(stored, dict):
                merged = dict(DEFAULT_CREDIT_COSTS)
                for key, value in stored.items():
                    try:
                        merged[str(key)] = max(0, int(value))
                    except (TypeError, ValueError):
                        continue
                return merged
        except Exception:
            pass
    return dict(DEFAULT_CREDIT_COSTS)


def credit_cost_for(action_type: str) -> int:
    return credit_costs().get(action_type or "chat", 1)


def _next_renewal_date(from_iso: str | None = None) -> str:
    base = datetime.now()
    if from_iso:
        try:
            base = datetime.fromisoformat(from_iso)
        except Exception:
            base = datetime.now()
    # Next month, same day or last day of month
    year = base.year + (1 if base.month == 12 else 0)
    month = 1 if base.month == 12 else base.month + 1
    day = min(base.day, 28)
    return datetime(year, month, day).date().isoformat()


def get_or_create_subscription(conn: sqlite3.Connection, doctor_id: int) -> dict[str, Any]:
    row = conn.execute("SELECT * FROM ai_subscriptions WHERE doctor_id = ?", (doctor_id,)).fetchone()
    if row:
        return dict(row)
    plan = AI_PLANS["starter"]
    conn.execute(
        """INSERT INTO ai_subscriptions
           (doctor_id, plan_name, monthly_credits, used_credits, renewal_date, active, ai_enabled, unlimited)
           VALUES (?, ?, ?, 0, ?, 1, 1, ?)""",
        (doctor_id, "starter", plan["monthly_credits"], _next_renewal_date(), 1 if plan["unlimited"] else 0),
    )
    row = conn.execute("SELECT * FROM ai_subscriptions WHERE doctor_id = ?", (doctor_id,)).fetchone()
    return dict(row)


def maybe_reset_monthly_credits(conn: sqlite3.Connection, sub: dict[str, Any]) -> dict[str, Any]:
    """Reset used_credits to 0 if today >= renewal_date."""
    try:
        renewal = datetime.fromisoformat(sub["renewal_date"]).date()
    except Exception:
        return sub
    today = datetime.now().date()
    if today >= renewal:
        new_renewal = _next_renewal_date()
        conn.execute(
            "UPDATE ai_subscriptions SET used_credits = 0, renewal_date = ?, updated_at = ? WHERE doctor_id = ?",
            (new_renewal, now_iso(), sub["doctor_id"]),
        )
        sub["used_credits"] = 0
        sub["renewal_date"] = new_renewal
    return sub


def subscription_state(doctor_id: int) -> dict[str, Any]:
    """Public-facing subscription status (with remaining credits computed)."""
    with connect() as conn:
        sub = get_or_create_subscription(conn, doctor_id)
        sub = maybe_reset_monthly_credits(conn, sub)
    plan_meta = AI_PLANS.get(sub["plan_name"], AI_PLANS["starter"])
    monthly = int(sub["monthly_credits"] or 0)
    used = int(sub["used_credits"] or 0)
    unlimited = bool(sub.get("unlimited"))
    remaining = 999999 if unlimited else max(0, monthly - used)
    return {
        "doctor_id": sub["doctor_id"],
        "plan_name": sub["plan_name"],
        "plan_label": plan_meta["label"],
        "monthly_credits": monthly,
        "used_credits": used,
        "remaining_credits": remaining,
        "renewal_date": sub["renewal_date"],
        "active": bool(sub["active"]),
        "ai_enabled": bool(sub["ai_enabled"]),
        "unlimited": unlimited,
    }


def check_credits_or_raise(doctor_id: int, action_type: str) -> int:
    """Verify the doctor has enough credits, otherwise raise 402. Returns the cost."""
    cost = credit_cost_for(action_type)
    state = subscription_state(doctor_id)
    if not state["active"] or not state["ai_enabled"]:
        raise HTTPException(status_code=403, detail="IA désactivée pour ce compte")
    if state["unlimited"]:
        return cost
    if state["remaining_credits"] < cost:
        raise HTTPException(status_code=402, detail="Crédits IA insuffisants")
    return cost


def deduct_credits(doctor_id: int, action_type: str, cost: int, *, document_id: int | None = None,
                   patient_id: int | None = None, cached: bool = False, success: bool = True,
                   details: str = "") -> None:
    """Deduct credits and log the action. Skip deduction on failure or cache hit."""
    actual_cost = 0 if (cached or not success) else cost
    with connect() as conn:
        if actual_cost > 0:
            conn.execute(
                "UPDATE ai_subscriptions SET used_credits = used_credits + ?, updated_at = ? WHERE doctor_id = ?",
                (actual_cost, now_iso(), doctor_id),
            )
        conn.execute(
            """INSERT INTO ai_credit_logs
               (doctor_id, action_type, credits_used, document_id, patient_id, cached, success, details)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (doctor_id, action_type, actual_cost, document_id, patient_id,
             1 if cached else 0, 1 if success else 0, details[:500]),
        )


def _doctor_id_from_request() -> int:
    """Resolve the active doctor's id. Single-user local app: defaults to user 1."""
    with connect() as conn:
        row = conn.execute("SELECT id FROM users WHERE role = 'doctor' ORDER BY id ASC LIMIT 1").fetchone()
    return int(row["id"]) if row else 1


# --- AI cache (avoid re-running same analysis on same input) ---
def _cache_key_for(action_type: str, payload: str) -> str:
    digest = hashlib.sha256(f"{action_type}::{payload}".encode("utf-8")).hexdigest()
    return digest


def cache_lookup(action_type: str, payload: str) -> dict[str, Any] | None:
    key = _cache_key_for(action_type, payload)
    with connect() as conn:
        row = conn.execute("SELECT * FROM ai_analysis_cache WHERE cache_key = ?", (key,)).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE ai_analysis_cache SET hit_count = hit_count + 1, last_used_at = ? WHERE id = ?",
            (now_iso(), row["id"]),
        )
    try:
        return json.loads(row["result_json"])
    except Exception:
        return None


def cache_store(action_type: str, payload: str, result: dict[str, Any], *,
                document_id: int | None = None, patient_id: int | None = None) -> None:
    key = _cache_key_for(action_type, payload)
    try:
        result_json = json.dumps(result, ensure_ascii=False, default=str)
    except Exception:
        return
    with connect() as conn:
        conn.execute(
            """INSERT INTO ai_analysis_cache (cache_key, action_type, result_json, document_id, patient_id)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(cache_key) DO UPDATE SET
                   result_json = excluded.result_json,
                   last_used_at = CURRENT_TIMESTAMP""",
            (key, action_type, result_json, document_id, patient_id),
        )


def _cloud_error_detail(exc: HTTPError) -> str:
    try:
        raw = exc.read().decode("utf-8", errors="ignore")
        parsed = json.loads(raw) if raw else {}
        if isinstance(parsed, dict):
            return str(parsed.get("error") or parsed.get("detail") or parsed.get("message") or raw or exc.reason)
        return raw or str(exc.reason)
    except Exception:
        return str(exc.reason or exc)


def _cloud_ai_request(path: str, payload: dict[str, Any], timeout: int = 90) -> dict[str, Any]:
    base_url = get_setting("CLOUD_AI_URL").strip().rstrip("/")
    doctor_id = get_setting("CLOUD_AI_DOCTOR_ID").strip()
    secret = get_setting("CLOUD_AI_SECRET").strip()
    if not base_url or not doctor_id or not secret:
        raise HTTPException(status_code=409, detail="Configuration cloud IA incomplete")

    auth_request = UrlRequest(
        f"{base_url}/api/auth/doctor",
        data=json.dumps({"doctor_id": doctor_id, "secret": secret}).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(auth_request, timeout=30) as response:
            auth_data = json.loads(response.read().decode("utf-8") or "{}")
    except HTTPError as exc:
        status = exc.code if exc.code in {400, 401, 402, 403, 404, 409, 429} else 502
        raise HTTPException(status_code=status, detail=f"Cloud IA auth: {_cloud_error_detail(exc)}") from exc
    except (URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail=f"Cloud IA indisponible: {exc}") from exc

    token = str(auth_data.get("token") or "").strip()
    if not token:
        raise HTTPException(status_code=502, detail="Cloud IA auth: token manquant")

    cloud_request = UrlRequest(
        f"{base_url}{path}",
        data=json.dumps(payload, ensure_ascii=False, default=str).encode("utf-8"),
        headers={"Content-Type": "application/json", "X-Doctor-Token": token},
        method="POST",
    )
    try:
        with urlopen(cloud_request, timeout=timeout) as response:
            return json.loads(response.read().decode("utf-8") or "{}")
    except HTTPError as exc:
        status = exc.code if exc.code in {400, 401, 402, 403, 404, 409, 429} else 502
        raise HTTPException(status_code=status, detail=f"Cloud IA: {_cloud_error_detail(exc)}") from exc
    except (URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail=f"Cloud IA indisponible: {exc}") from exc


def _extract_cloud_text(payload: Any) -> str:
    if isinstance(payload, dict):
        for key in ("content", "answer", "message", "text", "generated_text", "summary"):
            value = payload.get(key)
            if value:
                return str(value)
        if payload.get("choices") and isinstance(payload["choices"], list):
            first = payload["choices"][0] if payload["choices"] else {}
            if isinstance(first, dict):
                message = first.get("message")
                if isinstance(message, dict) and message.get("content"):
                    return str(message["content"])
                if first.get("text"):
                    return str(first["text"])
        analysis = payload.get("analysis")
        if isinstance(analysis, (dict, list)):
            return _extract_cloud_text(analysis)
        if isinstance(analysis, str):
            return analysis
        return json.dumps(payload, ensure_ascii=False, default=str)
    if isinstance(payload, list):
        return "\n".join(_extract_cloud_text(item) for item in payload)
    return str(payload or "")


def run_ai_chat(payload: AIChatIn, patient_id: int | None = None) -> dict[str, Any]:
    message = payload.message.strip()
    if not message:
        raise HTTPException(status_code=400, detail="Message vide")
    if not ai_chat_enabled():
        raise HTTPException(status_code=409, detail="Chat IA desactive")
    chat_mode = normalize_analysis_mode(payload.analysis_mode or ai_analysis_mode())
    max_new_tokens = analysis_mode_token_limit(chat_mode)
    # Use cloud credits directly when the doctor activated cloud IA in Settings.
    if cloud_ai_configured():
        provider = "cloud"
        model = LOCKED_AI_MODEL
        with connect() as conn:
            patient_context = compact_patient_context(conn, patient_id) if patient_id and payload.include_patient_context else None
            conversation_id = payload.conversation_id
            if conversation_id:
                conversation = conn.execute("SELECT * FROM ai_conversations WHERE id = ?", (conversation_id,)).fetchone()
                if not conversation:
                    raise HTTPException(status_code=404, detail="Conversation IA introuvable")
            else:
                cur = conn.execute(
                    """
                    INSERT INTO ai_conversations (patient_id, title, provider, model, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (patient_id, conversation_title(message), provider, model, now_iso(), now_iso()),
                )
                conversation_id = cur.lastrowid
            user_row = save_chat_message(conn, conversation_id, "user", message, {"patient_id": patient_id})
            messages = build_chat_messages(message, patient_context, payload.system_prompt_prefix)
            ensure_ai_usage_budget(conn, estimate_messages_tokens(messages) + max_new_tokens)

        cloud_response = _cloud_ai_request(
            "/api/me/ai/chat",
            {"messages": [asdict(item) for item in messages], "action_type": "chat", "max_tokens": max_new_tokens},
            timeout=90,
        )
        answer = _extract_cloud_text(cloud_response).strip()
        if not answer:
            raise HTTPException(status_code=502, detail="Cloud IA: reponse vide")
        if AI_DECISION_SUPPORT_WARNING not in answer:
            answer = f"{answer}\n\n{AI_DECISION_SUPPORT_WARNING}"
        output_tokens = estimate_text_tokens(answer)
        with connect() as conn:
            assistant_row = save_chat_message(
                conn,
                conversation_id,
                "assistant",
                answer,
                {"provider": provider, "model": model, "patient_id": patient_id},
            )
            conn.execute(
                "UPDATE ai_conversations SET provider = ?, model = ?, updated_at = ? WHERE id = ?",
                (provider, model, now_iso(), conversation_id),
            )
            log_ai_usage(
                conn,
                "chat",
                model,
                estimate_messages_tokens(messages),
                output_tokens,
                estimate_messages_tokens(messages) + output_tokens,
                patient_id=patient_id,
                conversation_id=conversation_id,
                analysis_mode=chat_mode,
            )
            conversation = dict(conn.execute("SELECT * FROM ai_conversations WHERE id = ?", (conversation_id,)).fetchone())
            rows = rows_to_dicts(conn.execute(
                "SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC",
                (conversation_id,),
            ).fetchall())
        audit("create", "ai_conversations", conversation_id, "Chat IA cloud")
        return {
            "conversation": conversation,
            "messages": rows,
            "user_message": user_row,
            "assistant_message": assistant_row,
            "safety_note": AI_DECISION_SUPPORT_WARNING,
            "provider": provider,
            "model": model,
            "credits_used": cloud_response.get("credits_used") or cloud_response.get("cost"),
            "credits_remaining": cloud_response.get("credits_remaining"),
        }

    provider = normalize_ai_provider(payload.provider or get_setting("AI_PROVIDER"))
    if provider == "disabled":
        raise HTTPException(status_code=409, detail="AI medical chat unavailable")
    api_key = ai_api_key_for_provider(provider)
    if not api_key:
        raise HTTPException(status_code=409, detail="Clé API manquante (Contactez l'administrateur)")
    model = LOCKED_AI_MODEL

    # === CREDIT CHECK (before any HF call) ===
    doctor_id = _doctor_id_from_request()
    cost = check_credits_or_raise(doctor_id, "chat")

    with connect() as conn:
        patient_context = compact_patient_context(conn, patient_id) if patient_id and payload.include_patient_context else None
        conversation_id = payload.conversation_id
        if conversation_id:
            conversation = conn.execute("SELECT * FROM ai_conversations WHERE id = ?", (conversation_id,)).fetchone()
            if not conversation:
                raise HTTPException(status_code=404, detail="Conversation IA introuvable")
        else:
            cur = conn.execute(
                """
                INSERT INTO ai_conversations (patient_id, title, provider, model, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (patient_id, conversation_title(message), provider, model, now_iso(), now_iso()),
            )
            conversation_id = cur.lastrowid
        user_row = save_chat_message(conn, conversation_id, "user", message, {"patient_id": patient_id})
        messages = build_chat_messages(message, patient_context, payload.system_prompt_prefix)
        estimated_input_tokens = estimate_messages_tokens(messages)
        estimated_output_tokens = max_new_tokens
        ensure_ai_usage_budget(conn, estimated_input_tokens + estimated_output_tokens)
    try:
        response = make_chat_provider(provider, model, max_new_tokens=max_new_tokens).chat(messages)
    except AIProviderError as exc:
        detail = str(exc)[:500]
        # Log failure WITHOUT deducting credits
        deduct_credits(doctor_id, "chat", cost, patient_id=patient_id, success=False, details=detail)
        raise HTTPException(status_code=502, detail=detail) from exc
    answer = response.content.strip()
    if AI_DECISION_SUPPORT_WARNING not in answer:
        answer = f"{answer}\n\n{AI_DECISION_SUPPORT_WARNING}"
    output_tokens = estimate_text_tokens(answer)
    with connect() as conn:
        assistant_row = save_chat_message(
            conn,
            conversation_id,
            "assistant",
            answer,
            {"provider": provider, "model": model, "patient_id": patient_id},
        )
        conn.execute(
            "UPDATE ai_conversations SET provider = ?, model = ?, updated_at = ? WHERE id = ?",
            (provider, model, now_iso(), conversation_id),
        )
        log_ai_usage(
            conn,
            "chat",
            model,
            estimate_messages_tokens(messages),
            output_tokens,
            estimate_messages_tokens(messages) + output_tokens,
            patient_id=patient_id,
            conversation_id=conversation_id,
            analysis_mode=chat_mode,
        )
        conversation = dict(conn.execute("SELECT * FROM ai_conversations WHERE id = ?", (conversation_id,)).fetchone())
        rows = rows_to_dicts(conn.execute(
            "SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC",
            (conversation_id,),
        ).fetchall())
    audit("create", "ai_conversations", conversation_id, f"Chat IA {provider}")
    # === DEDUCT CREDITS on success ===
    deduct_credits(doctor_id, "chat", cost, patient_id=patient_id, success=True,
                   details=f"conversation={conversation_id}")
    sub_state = subscription_state(doctor_id)
    return {
        "conversation": conversation,
        "messages": rows,
        "user_message": user_row,
        "assistant_message": assistant_row,
        "safety_note": AI_DECISION_SUPPORT_WARNING,
        "provider": provider,
        "model": model,
        "credits_used": cost,
        "credits_remaining": sub_state["remaining_credits"],
    }


def get_lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


class TunnelManager:
    def __init__(self):
        self.process = None
        self.public_url = ""
        self.status = "stopped"
        self.error = ""
        self._lock = threading.Lock()
        self._should_run = False
        self._restart_count = 0
        self._max_restarts = 3
        self._reader_thread = None
        self._watchdog_thread = None

    def find_binary(self):
        candidates = []
        configured = (os.environ.get("CLOUDFLARED_PATH") or "").strip()
        if configured:
            candidates.append(Path(configured))
        if sys.platform == "win32":
            candidates.append(ROOT / "bin" / "cloudflared.exe")
            candidates.append(ROOT / "binaries" / "cloudflared-x86_64-pc-windows-msvc.exe")
            candidates.append(ROOT / "binaries" / "cloudflared.exe")
            candidates.append(ROOT / "src-tauri" / "binaries" / "cloudflared-x86_64-pc-windows-msvc.exe")
            candidates.append(ROOT / "src-tauri" / "binaries" / "cloudflared.exe")
            candidates.append(Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / "cloudflared" / "cloudflared.exe")
            candidates.append(Path(os.environ.get("ProgramFiles(x86)", "C:\\Program Files (x86)")) / "cloudflared" / "cloudflared.exe")
            candidates.append(Path.home() / "cloudflared" / "cloudflared.exe")
        else:
            candidates.append(ROOT / "bin" / "cloudflared")
            candidates.append(ROOT / "binaries" / "cloudflared")
            candidates.append(Path("/usr/local/bin/cloudflared"))
            candidates.append(Path("/usr/bin/cloudflared"))
            candidates.append(Path.home() / ".cloudflared" / "cloudflared")
        for candidate in candidates:
            if candidate.is_file():
                return str(candidate)
        import shutil
        found = shutil.which("cloudflared")
        return found

    def _spawn_process(self) -> bool:
        binary = self.find_binary()
        if not binary:
            self.status = "error"
            self.error = "cloudflared non trouve"
            return False
        self.status = "starting"
        self.error = ""
        self.public_url = ""
        try:
            creation_flags = 0
            if sys.platform == "win32":
                creation_flags = subprocess.CREATE_NO_WINDOW
            self.process = subprocess.Popen(
                [binary, "tunnel", "--url", "http://127.0.0.1:8000"],
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True,
                creationflags=creation_flags,
            )
        except Exception as exc:
            self.status = "error"
            self.error = str(exc)
            return False
        self._reader_thread = threading.Thread(target=self._read_output, daemon=True)
        self._reader_thread.start()
        return True

    def start(self) -> dict[str, str]:
        with self._lock:
            self._should_run = True
            self._restart_count = 0
            if self.process and self.process.poll() is None:
                if self.public_url:
                    self.status = "running"
                elif self.status not in {"starting", "running"}:
                    self.status = "starting"
                return {"ok": True, "status": self.status, "url": self.public_url}
            ok = self._spawn_process()
            if not ok:
                self._should_run = False
                return {"ok": False, "status": self.status, "error": self.error}

        # Start watchdog for auto-restart
        if self._watchdog_thread is None or not self._watchdog_thread.is_alive():
            self._watchdog_thread = threading.Thread(target=self._watchdog, daemon=True)
            self._watchdog_thread.start()
        return {"ok": True, "status": "starting", "url": ""}

    def _read_output(self) -> None:
        """Background thread: read cloudflared stdout looking for the public URL."""
        url_pattern = re.compile(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com")
        proc = self.process
        if not proc or not proc.stdout:
            return
        for line in iter(proc.stdout.readline, ""):
            try:
                match = url_pattern.search(line or "")
            except Exception:
                continue
            if not match:
                continue
            url = match.group(0)
            with self._lock:
                self.public_url = url
                self.status = "running"
                self._restart_count = 0
            # Persist OUTSIDE the lock; isolate exceptions so loop continues
            try:
                set_setting("PUBLIC_PC_UPLOAD_URL", url)
            except Exception:
                pass
            try:
                set_setting("UPLOAD_MODE", "remote")
            except Exception:
                pass
        with self._lock:
            if self.status == "starting":
                self.status = "error"
                self.error = "cloudflared s'est arrete sans produire une URL"
            elif self.status == "running":
                self.status = "stopped"
                self.public_url = ""

    def _watchdog(self) -> None:
        """Auto-restart cloudflared if it dies while _should_run is True."""
        import time
        while self._should_run:
            time.sleep(5)
            with self._lock:
                if not self._should_run:
                    break
                alive = self.process is not None and self.process.poll() is None
                if alive or self.status == "starting":
                    continue
                # Process died — attempt restart
                if self._restart_count >= self._max_restarts:
                    self.status = "error"
                    self.error = f"Tunnel echoue {self._max_restarts} fois. Retour au mode local."
                    self._should_run = False
                    set_setting("UPLOAD_MODE", "local")
                    set_setting("PUBLIC_PC_UPLOAD_URL", "")
                    break
                self._restart_count += 1
                self._spawn_process()

    def stop(self) -> dict[str, str]:
        with self._lock:
            self._should_run = False  # tell watchdog to stop
            if self.process and self.process.poll() is None:
                try:
                    self.process.terminate()
                    self.process.wait(timeout=5)
                except Exception:
                    try:
                        self.process.kill()
                    except Exception:
                        pass
            self.process = None
            self.public_url = ""
            self.status = "stopped"
            self.error = ""
            self._restart_count = 0
            set_setting("PUBLIC_PC_UPLOAD_URL", "")
            set_setting("UPLOAD_MODE", "local")
        return {"ok": True, "status": "stopped"}

    def get_status(self) -> dict[str, Any]:
        with self._lock:
            alive = self.process is not None and self.process.poll() is None
            if not alive and self.status == "running":
                self.status = "stopped"
                self.public_url = ""
            binary_path = self.find_binary()
            return {
                "status": self.status,
                "url": self.public_url,
                "error": self.error,
                "binary_found": binary_path is not None,
                "binary_path": binary_path or "",
                "should_run": self._should_run,
                "restart_count": self._restart_count,
            }


tunnel_manager = TunnelManager()


def _dpapi_protect(data: bytes) -> bytes:
    if sys.platform != "win32":
        raise OSError("DPAPI unavailable")
    import ctypes
    import ctypes.wintypes

    class DataBlob(ctypes.Structure):
        _fields_ = [("cbData", ctypes.wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    in_buffer = ctypes.create_string_buffer(data)
    in_blob = DataBlob(len(data), ctypes.cast(in_buffer, ctypes.POINTER(ctypes.c_char)))
    out_blob = DataBlob()
    description = ctypes.create_unicode_buffer("CardioCabinetAI")
    ok = ctypes.windll.crypt32.CryptProtectData(
        ctypes.byref(in_blob),
        description,
        None,
        None,
        None,
        0,
        ctypes.byref(out_blob),
    )
    if not ok:
        raise OSError("CryptProtectData failed")
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out_blob.pbData)


def _dpapi_unprotect(data: bytes) -> bytes:
    if sys.platform != "win32":
        raise OSError("DPAPI unavailable")
    import ctypes
    import ctypes.wintypes

    class DataBlob(ctypes.Structure):
        _fields_ = [("cbData", ctypes.wintypes.DWORD), ("pbData", ctypes.POINTER(ctypes.c_char))]

    in_buffer = ctypes.create_string_buffer(data)
    in_blob = DataBlob(len(data), ctypes.cast(in_buffer, ctypes.POINTER(ctypes.c_char)))
    out_blob = DataBlob()
    ok = ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(in_blob),
        None,
        None,
        None,
        None,
        0,
        ctypes.byref(out_blob),
    )
    if not ok:
        raise OSError("CryptUnprotectData failed")
    try:
        return ctypes.string_at(out_blob.pbData, out_blob.cbData)
    finally:
        ctypes.windll.kernel32.LocalFree(out_blob.pbData)


def _local_secret_key() -> bytes:
    DATA.mkdir(parents=True, exist_ok=True)
    key_path = DATA / ".ai_secret_key"
    if not key_path.exists():
        key_path.write_bytes(secrets.token_bytes(32))
        try:
            os.chmod(key_path, 0o600)
        except Exception:
            pass
    return key_path.read_bytes()


def _xor_stream(data: bytes, key: bytes) -> bytes:
    output = bytearray()
    counter = 0
    while len(output) < len(data):
        block = hashlib.sha256(key + counter.to_bytes(8, "big")).digest()
        output.extend(block)
        counter += 1
    return bytes(value ^ output[index] for index, value in enumerate(data))


def encrypt_secret(value: str) -> str:
    if not value:
        return ""
    if value.startswith("enc:dpapi:") or value.startswith("enc:local:"):
        return value
    raw = value.encode("utf-8")
    encrypted = _xor_stream(raw, _local_secret_key())
    return "enc:local:" + base64.b64encode(encrypted).decode("ascii")


def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    try:
        if value.startswith("enc:dpapi:"):
            payload = base64.b64decode(value.split(":", 2)[2])
            return _dpapi_unprotect(payload).decode("utf-8")
        if value.startswith("enc:local:"):
            payload = base64.b64decode(value.split(":", 2)[2])
            return _xor_stream(payload, _local_secret_key()).decode("utf-8")
    except Exception:
        return ""
    return value


def get_setting(key: str) -> str:
    key = str(key or "").upper()
    with connect() as conn:
        row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
    if row:
        if key in SECRET_SETTING_KEYS:
            return decrypt_secret(row["value"])
        return row["value"]
    mirror = SETTING_MIRRORS.get(key)
    if mirror:
        with connect() as conn:
            mirror_row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (mirror,)).fetchone()
        if mirror_row:
            return mirror_row["value"]
    return DEFAULT_SETTINGS.get(key, DEFAULT_SETTINGS.get(mirror or "", ""))


def set_setting(key: str, value: str) -> None:
    key = str(key or "").upper()
    mirror = SETTING_MIRRORS.get(key)
    keys_to_write = [key]
    if mirror and mirror not in keys_to_write:
        keys_to_write.append(mirror)
    with connect() as conn:
        for current_key in keys_to_write:
            stored_value = encrypt_secret(value) if current_key in SECRET_SETTING_KEYS else value
            conn.execute(
                "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) "
                "ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
                (current_key, stored_value, now_iso()),
            )
        if key.startswith("AI_"):
            sync_ai_settings_snapshot(conn)


def get_all_settings(include_secret_values: bool = False) -> dict[str, str]:
    result = dict(DEFAULT_SETTINGS)
    with connect() as conn:
        for row in conn.execute("SELECT key, value FROM app_settings").fetchall():
            key = row["key"]
            value = row["value"]
            if key in SECRET_SETTING_KEYS:
                decrypted = decrypt_secret(value)
                result[key] = decrypted if include_secret_values else ""
                result[f"{key}_CONFIGURED"] = "true" if decrypted else "false"
            else:
                result[key] = value
    for key in SECRET_SETTING_KEYS:
        result.setdefault(f"{key}_CONFIGURED", "false")
    for key, mirror in SETTING_MIRRORS.items():
        primary = result.get(key, "")
        secondary = result.get(mirror, "")
        chosen = primary or secondary or DEFAULT_SETTINGS.get(key, "") or DEFAULT_SETTINGS.get(mirror, "")
        result[key] = chosen
        result[mirror] = chosen
    result["AI_LOCKED_MODEL"] = LOCKED_AI_MODEL
    return result

app = FastAPI(title="Cardio Cabinet Local", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all handler ensuring CORS headers are present on every error response."""
    status = 500
    detail = "Erreur serveur interne"
    if isinstance(exc, HTTPException):
        status = exc.status_code
        detail = exc.detail
    return JSONResponse(
        status_code=status,
        content={"detail": detail},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        },
    )


def now_iso() -> str:
    return datetime.now().isoformat(timespec="seconds")


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def rows_to_dicts(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [dict(row) for row in rows]


def parse_iso_datetime(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00").replace(" ", "T"))


def format_doctor_template_name(value: str) -> str:
    cleaned = re.sub(r"^dr\.?\s*", "", str(value or "").strip(), flags=re.I)
    parts = [re.sub(r"[.,;:]+$", "", part) for part in re.split(r"\s+", cleaned) if part]
    if not parts:
        return "CHIALI. M.KAMEL"
    if len(parts) == 1:
        return parts[0].upper()
    if len(parts) == 2:
        return f"{parts[0].upper()}. {parts[1].upper()}"
    middle_initial = parts[1][:1].upper()
    tail = " ".join(parts[2:]).upper()
    return f"{parts[0].upper()}. {middle_initial}.{tail}".strip()


def parse_optional_datetime(value: Any) -> datetime:
    text = str(value or "").strip()
    if not text:
        return datetime.now()
    try:
        return parse_iso_datetime(text)
    except Exception:
        return datetime.now()


def format_display_date(value: Any) -> str:
    text = str(value or "").strip()
    if not text:
        return ""
    try:
        return parse_iso_datetime(text).strftime("%d/%m/%Y")
    except Exception:
        return text


def normalized_template_phone(value: Any) -> str:
    text = str(value or "").strip()
    text = re.sub(r"\s*/+\s*$", "", text)
    text = re.sub(r"[.\s]+$", "", text)
    return text or "07 76 12 63 34"


def normalized_template_email(value: Any) -> str:
    text = str(value or "").strip().strip("/")
    return text or "kchiali@gmail.com"


def normalized_template_address(value: Any, city: Any) -> str:
    text = str(value or "").strip().strip("/")
    city_text = str(city or "").strip()
    compact_text = re.sub(r"\s+", "", text).lower()
    compact_city = re.sub(r"\s+", "", city_text).lower()
    if not text or compact_text == compact_city:
        return "38 ,rue Maitre ould aoudia"
    return text


def html_to_text(value: str) -> str:
    text = re.sub(r"(?i)<br\s*/?>", "\n", value or "")
    text = re.sub(r"(?i)</(p|div|h[1-6]|li|tr)>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    text = html.unescape(text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def extract_school_year(value: str) -> str:
    text = html_to_text(value)
    match = re.search(r"annee scolaire\s*([0-9]{4}\s*-\s*[0-9]{4})", text, re.I)
    if match:
        return re.sub(r"\s+", "", match.group(1))
    fallback = re.search(r"\b([0-9]{4}\s*-\s*[0-9]{4})\b", text)
    if fallback:
        return re.sub(r"\s+", "", fallback.group(1))
    return current_school_year()


def is_full_page_document(rendered_html: str) -> bool:
    lower_body = (rendered_html or "").lower()
    return "data-template-layout=\"full-page\"" in lower_body or "data-template-layout='full-page'" in lower_body


def is_sport_dispense_document(row: sqlite3.Row | dict[str, Any]) -> bool:
    title = str(row["title"] or "").lower()
    content = f"{row['rendered_text'] or ''}\n{row['body_html'] or ''}".lower()
    return "dispense sportive" in title or "de dispense de l' activite sportive" in content


def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode("utf-8")).hexdigest()


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def get_remote_upload_base_url() -> str:
    """Return the public HTTPS URL when remote upload is configured."""
    pc_url = get_setting("PUBLIC_PC_UPLOAD_URL").strip().rstrip("/")
    if pc_url.startswith("https://") and "localhost" not in pc_url and "127.0.0.1" not in pc_url:
        return pc_url
    # Fallback: live tunnel URL (covers DB-write race or persistence failures)
    try:
        live = (tunnel_manager.public_url or "").strip().rstrip("/")
        if live.startswith("https://") and "trycloudflare.com" in live:
            return live
    except Exception:
        pass
    return ""


def get_local_upload_base_url() -> str:
    return f"http://{get_lan_ip()}:8000"


def get_upload_base_url() -> str:
    """Return the active URL the phone should use to reach this server."""
    mode = (get_setting("UPLOAD_MODE") or "local").strip().lower()
    remote_url = get_remote_upload_base_url()
    if mode == "remote" and remote_url:
        return remote_url
    return get_local_upload_base_url()


def mobile_upload_url(patient_id: int, token: str) -> str:
    return f"{get_upload_base_url()}/m/{patient_id}?token={quote(token, safe='')}"


def mobile_upload_endpoint(patient_id: int) -> str:
    base_url = get_upload_base_url()
    return f"{base_url}/api/patients/{patient_id}/documents/upload-mobile"


def audit(action: str, entity: str = "", entity_id: int | None = None, detail: str = "", user_id: int | None = 1) -> None:
    with connect() as conn:
        conn.execute(
            "INSERT INTO audit_log (user_id, action, entity, entity_id, detail) VALUES (?, ?, ?, ?, ?)",
            (user_id, action, entity, entity_id, detail),
        )


def ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = {row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()}
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def apply_light_migrations(conn: sqlite3.Connection) -> None:
    ensure_column(conn, "documents", "notes", "TEXT")
    ensure_column(conn, "medications", "indication", "TEXT")
    ensure_column(conn, "medications", "dosage", "TEXT")
    ensure_column(conn, "prescriptions", "consultation_summary", "TEXT")
    ensure_column(conn, "visits", "visit_fee", "REAL NOT NULL DEFAULT 0")
    ensure_column(conn, "visits", "fee_paid", "REAL NOT NULL DEFAULT 0")
    ensure_column(conn, "visits", "payment_status", "TEXT NOT NULL DEFAULT 'pending'")
    ensure_column(conn, "visits", "visit_type", "TEXT")
    ensure_column(conn, "medicines_db", "specialty", "TEXT")
    conn.execute("""CREATE TABLE IF NOT EXISTS favorite_medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(medicine_id, doctor_id),
        FOREIGN KEY (medicine_id) REFERENCES medicines_db(id) ON DELETE CASCADE
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS recent_medicines (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        medicine_id INTEGER NOT NULL,
        doctor_id INTEGER NOT NULL DEFAULT 1,
        last_used TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        use_count INTEGER NOT NULL DEFAULT 1,
        UNIQUE(medicine_id, doctor_id),
        FOREIGN KEY (medicine_id) REFERENCES medicines_db(id) ON DELETE CASCADE
    )""")
    conn.execute("""CREATE INDEX IF NOT EXISTS idx_medicines_specialty ON medicines_db(specialty COLLATE NOCASE)""")
    conn.execute("""CREATE TABLE IF NOT EXISTS visit_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        price REAL NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS ai_document_analyses (
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
    )""")
    ensure_column(conn, "ai_document_analyses", "analysis_mode", "TEXT")
    conn.execute("""CREATE TABLE IF NOT EXISTS ai_usage_logs (
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
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS extracted_lab_values (
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
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS ai_settings (
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
    )""")
    ensure_column(conn, "ai_settings", "chat_enabled", "INTEGER NOT NULL DEFAULT 1")
    ensure_column(conn, "ai_settings", "document_ai_enabled", "INTEGER NOT NULL DEFAULT 1")
    ensure_column(conn, "ai_settings", "analysis_mode", "TEXT NOT NULL DEFAULT 'normal'")
    ensure_column(conn, "ai_settings", "max_tokens", "INTEGER NOT NULL DEFAULT 384")
    ensure_column(conn, "ai_settings", "monthly_token_limit", "INTEGER NOT NULL DEFAULT 20000")
    conn.execute("""CREATE TABLE IF NOT EXISTS ai_conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER,
        title TEXT NOT NULL,
        provider TEXT NOT NULL,
        model TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS ai_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        safety_note TEXT,
        metadata_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
    )""")
    ensure_column(conn, "ai_document_analyses", "validated_summary", "TEXT")
    ensure_column(conn, "ai_document_analyses", "validated_extracted_json", "TEXT")
    ensure_column(conn, "ai_document_analyses", "updated_at", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")
    ensure_column(conn, "ai_document_analyses", "analysis_mode", "TEXT")
    ensure_column(conn, "ai_settings", "openai_base_url", "TEXT")
    ensure_column(conn, "ai_settings", "local_base_url", "TEXT")
    ensure_column(conn, "ai_settings", "chat_enabled", "INTEGER NOT NULL DEFAULT 1")
    ensure_column(conn, "ai_settings", "document_ai_enabled", "INTEGER NOT NULL DEFAULT 1")
    ensure_column(conn, "ai_settings", "analysis_mode", "TEXT NOT NULL DEFAULT 'short'")
    ensure_column(conn, "ai_settings", "max_tokens", "INTEGER NOT NULL DEFAULT 512")
    ensure_column(conn, "ai_settings", "monthly_token_limit", "INTEGER NOT NULL DEFAULT 100000")
    ensure_column(conn, "ai_messages", "safety_note", "TEXT")
    ensure_column(conn, "ai_messages", "metadata_json", "TEXT")

    # ========== AI CREDIT SYSTEM TABLES ==========
    conn.execute("""CREATE TABLE IF NOT EXISTS ai_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_id INTEGER NOT NULL UNIQUE,
        plan_name TEXT NOT NULL DEFAULT 'starter',
        monthly_credits INTEGER NOT NULL DEFAULT 50,
        used_credits INTEGER NOT NULL DEFAULT 0,
        renewal_date TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1,
        ai_enabled INTEGER NOT NULL DEFAULT 1,
        unlimited INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (doctor_id) REFERENCES users(id) ON DELETE CASCADE
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS ai_credit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        doctor_id INTEGER NOT NULL,
        action_type TEXT NOT NULL,
        credits_used INTEGER NOT NULL DEFAULT 0,
        document_id INTEGER,
        patient_id INTEGER,
        cached INTEGER NOT NULL DEFAULT 0,
        success INTEGER NOT NULL DEFAULT 1,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS ai_analysis_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cache_key TEXT NOT NULL UNIQUE,
        action_type TEXT NOT NULL,
        result_json TEXT NOT NULL,
        document_id INTEGER,
        patient_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        hit_count INTEGER NOT NULL DEFAULT 0
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ai_credit_logs_doctor ON ai_credit_logs(doctor_id, created_at DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ai_cache_key ON ai_analysis_cache(cache_key)")

    conn.execute("CREATE INDEX IF NOT EXISTS idx_patients_updated ON patients(updated_at DESC, id DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(nom, prenom)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_visits_patient_date ON visits(patient_id, date_visite DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_appointments_scheduled ON appointments(scheduled_at)")

    # ── Data migration / import tables ────────────────────────────────────────
    conn.execute("""CREATE TABLE IF NOT EXISTS import_jobs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_type TEXT NOT NULL,
        source_name TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        dry_run INTEGER NOT NULL DEFAULT 0,
        on_duplicate TEXT NOT NULL DEFAULT 'skip',
        patients_total INTEGER NOT NULL DEFAULT 0,
        patients_imported INTEGER NOT NULL DEFAULT 0,
        patients_skipped INTEGER NOT NULL DEFAULT 0,
        patients_merged INTEGER NOT NULL DEFAULT 0,
        visits_imported INTEGER NOT NULL DEFAULT 0,
        errors TEXT,
        backup_path TEXT,
        mapping_json TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        finished_at TEXT
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS import_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        job_id INTEGER NOT NULL,
        entity TEXT,
        action TEXT,
        details TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (job_id) REFERENCES import_jobs(id) ON DELETE CASCADE
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS old_patient_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        old_code TEXT,
        import_job_id INTEGER,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_import_logs_job ON import_logs(job_id)")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_old_links ON old_patient_links(patient_id, old_code)")

    # ── Bilan (lab/exam order) module ─────────────────────────────────────
    conn.execute("""CREATE TABLE IF NOT EXISTS bilan_catalog (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL DEFAULT 'Autre',
        description TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS bilans (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        visit_id INTEGER,
        requested_date TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        doctor_note TEXT,
        status TEXT NOT NULL DEFAULT 'requested',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS bilan_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        bilan_id INTEGER NOT NULL,
        catalog_id INTEGER,
        custom_name TEXT,
        result TEXT,
        result_date TEXT,
        unit TEXT,
        reference_range TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (bilan_id) REFERENCES bilans(id) ON DELETE CASCADE
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bilans_patient ON bilans(patient_id, requested_date DESC)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bilan_items_bilan ON bilan_items(bilan_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_bilan_catalog_cat ON bilan_catalog(category, active)")

    # ── Patient FTS5 table ────────────────────────────────────────────────────
    conn.execute("""CREATE VIRTUAL TABLE IF NOT EXISTS patients_fts USING fts5(
        nom, prenom, telephone, code, adresse,
        content='patients', content_rowid='id'
    )""")

    # ── Incremental import tracking ───────────────────────────────────────────
    conn.execute("""CREATE TABLE IF NOT EXISTS old_record_links (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_name TEXT NOT NULL,
        source_type TEXT NOT NULL DEFAULT 'file',
        old_table TEXT NOT NULL DEFAULT '',
        old_id TEXT NOT NULL,
        medismart_table TEXT NOT NULL,
        medismart_id INTEGER NOT NULL,
        checksum TEXT NOT NULL DEFAULT '',
        imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )""")
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_orl_source_id ON old_record_links(source_name, old_table, old_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_orl_medismart ON old_record_links(medismart_table, medismart_id)")

    # ── Speciality-specific patient data ─────────────────────────────────────
    conn.execute("""CREATE TABLE IF NOT EXISTS patient_specialty_data (
        patient_id INTEGER NOT NULL,
        speciality TEXT NOT NULL,
        data_json TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (patient_id, speciality),
        FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE
    )""")

    # ── Safely add extra columns to patients/visits ───────────────────────────
    for _alter in [
        "ALTER TABLE patients ADD COLUMN extra_data TEXT DEFAULT '{}'",
        "ALTER TABLE import_jobs ADD COLUMN patients_updated INTEGER NOT NULL DEFAULT 0",
    ]:
        try:
            conn.execute(_alter)
        except Exception:
            pass


def protect_secret_settings(conn: sqlite3.Connection) -> None:
    for key in SECRET_SETTING_KEYS:
        row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
        if not row:
            continue
        value = row["value"] or ""
        if value.startswith("enc:dpapi:"):
            plain = decrypt_secret(value)
            if plain:
                conn.execute(
                    "UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?",
                    (encrypt_secret(plain), now_iso(), key),
                )
        elif value and not value.startswith("enc:local:"):
            conn.execute(
                "UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?",
                (encrypt_secret(value), now_iso(), key),
            )


def sync_ai_settings_snapshot(conn: sqlite3.Connection) -> None:
    """Keep a simple AI settings row for migrations/reporting while app_settings remains the source of truth."""
    settings = {
        row["key"]: row["value"]
        for row in conn.execute("SELECT key, value FROM app_settings WHERE key LIKE 'AI_%'").fetchall()
    }
    conn.execute(
        """
        INSERT INTO ai_settings
                (id, provider, model_name, openai_base_url, local_base_url, require_manual_consent,
                 auto_document_analysis, max_file_mb, chat_enabled, document_ai_enabled, analysis_mode,
                 max_tokens, monthly_token_limit, updated_at)
                VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          provider=excluded.provider,
          model_name=excluded.model_name,
          openai_base_url=excluded.openai_base_url,
          local_base_url=excluded.local_base_url,
          require_manual_consent=excluded.require_manual_consent,
          auto_document_analysis=excluded.auto_document_analysis,
          max_file_mb=excluded.max_file_mb,
                    chat_enabled=excluded.chat_enabled,
                    document_ai_enabled=excluded.document_ai_enabled,
                    analysis_mode=excluded.analysis_mode,
                    max_tokens=excluded.max_tokens,
                    monthly_token_limit=excluded.monthly_token_limit,
          updated_at=excluded.updated_at
        """,
        (
            normalize_ai_provider(settings.get("AI_PROVIDER", DEFAULT_SETTINGS["AI_PROVIDER"])),
                        LOCKED_AI_MODEL,
            settings.get("AI_OPENAI_BASE_URL", DEFAULT_SETTINGS["AI_OPENAI_BASE_URL"]),
            settings.get("AI_LOCAL_BASE_URL", DEFAULT_SETTINGS["AI_LOCAL_BASE_URL"]),
                        1 if str(settings.get("AI_REQUIRE_MANUAL_CONSENT", "false")).lower() in {"1", "true", "yes", "oui", "on"} else 0,
            1 if str(settings.get("AI_AUTO_ANALYZE_AFTER_UPLOAD", "false")).lower() in {"1", "true", "yes", "oui", "on"} else 0,
            settings.get("AI_MAX_FILE_MB", DEFAULT_SETTINGS["AI_MAX_FILE_MB"]),
                        1 if str(settings.get("AI_CHAT_ENABLED", DEFAULT_SETTINGS["AI_CHAT_ENABLED"])).lower() in {"1", "true", "yes", "oui", "on"} else 0,
                        1 if str(settings.get("AI_DOCUMENT_AI_ENABLED", DEFAULT_SETTINGS["AI_DOCUMENT_AI_ENABLED"])).lower() in {"1", "true", "yes", "oui", "on"} else 0,
                        normalize_analysis_mode(settings.get("AI_ANALYSIS_MODE", DEFAULT_SETTINGS["AI_ANALYSIS_MODE"])),
                        parse_int_setting(settings.get("AI_MAX_TOKENS", DEFAULT_SETTINGS["AI_MAX_TOKENS"]), AI_DEFAULT_MAX_TOKENS),
                        parse_int_setting(settings.get("AI_MONTHLY_TOKEN_LIMIT", DEFAULT_SETTINGS["AI_MONTHLY_TOKEN_LIMIT"]), AI_DEFAULT_MONTHLY_TOKEN_LIMIT),
            now_iso(),
        ),
    )


def seed_visit_types(conn: sqlite3.Connection) -> None:
    """Seed visit types from old system motifs."""
    count = conn.execute("SELECT COUNT(*) AS total FROM visit_types").fetchone()["total"]
    if count > 0:
        return
    types = [
        ("CS+ECG+ECHO", 4000),
        ("CS+ECG", 3000),
        ("ECG + AVIS CARDIO", 2000),
        ("ECG", 1000),
        ("ECHOCOEURDOPPLER", 2500),
        ("ECHODOPPLER VASCULAIRE", 3000),
        ("MAPA", 3000),
        ("ORDONNANCE", 500),
        ("CERTIFICAT", 500),
        ("CS+ECG+ECHO / UNPEF", 2000),
        ("CS+ECG+ECHO / IMPOT", 2000),
        ("CONSULTATION", 1000),
        ("DOSSIER DAS", 1000),
        ("HOLTER ECG", 3000),
        ("EPREUVE D'EFFORT", 4000),
        ("CONTROLE", 500),
    ]
    for name, price in types:
        conn.execute("INSERT OR IGNORE INTO visit_types (name, price) VALUES (?, ?)", (name, price))


def insert_medicine_if_missing(conn: sqlite3.Connection, brand_name: str, values: tuple[Any, ...]) -> None:
    exists = conn.execute(
        "SELECT id FROM medicines_db WHERE lower(brand_name) = lower(?) LIMIT 1",
        (brand_name,),
    ).fetchone()
    if exists:
        return
    conn.execute(
        """INSERT INTO medicines_db
        (brand_name, dci, active_substance, form, dosage_strength, route,
         indications, contraindications, interactions, source, specialty)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        values,
    )


def seed_medicines_db(conn: sqlite3.Connection) -> None:
    """Seed or enrich medicines_db from local references and cardiology extras."""
    meds = json.loads((BACKEND / "medications_seed.json").read_text(encoding="utf-8"))
    for med in meds:
        insert_medicine_if_missing(
            conn,
            med["name"],
            (
                med["name"],
                med.get("dci", ""),
                med.get("dci", ""),
                "comprime",
                med.get("dosage", ""),
                "orale",
                med.get("indication", ""),
                json.dumps(med.get("contraindications", []), ensure_ascii=False),
                json.dumps(med.get("interactions", []), ensure_ascii=False),
                "local",
                med.get("class_name", ""),
            ),
        )
    # Extra cardiology medicines for better autocomplete coverage
    extras = [
        ("BISOPROLOL EG 5mg", "Bisoprolol", "comprime", "5 mg", "orale", "Beta-bloquant", "HTA, coronaropathie, IC"),
        ("BISOPROLOL ARROW 2.5mg", "Bisoprolol", "comprime", "2.5 mg", "orale", "Beta-bloquant", "HTA, coronaropathie, IC"),
        ("BISOPROLOL SANDOZ 10mg", "Bisoprolol", "comprime", "10 mg", "orale", "Beta-bloquant", "HTA, coronaropathie, IC"),
        ("ATORVASTATINE EG 20mg", "Atorvastatine", "comprime", "20 mg", "orale", "Statine", "Dyslipidemie"),
        ("ATORVASTATINE EG 40mg", "Atorvastatine", "comprime", "40 mg", "orale", "Statine", "Dyslipidemie"),
        ("ATORVASTATINE ARROW 10mg", "Atorvastatine", "comprime", "10 mg", "orale", "Statine", "Dyslipidemie"),
        ("RAMIPRIL 5mg", "Ramipril", "comprime", "5 mg", "orale", "IEC", "HTA, IC, post-infarctus"),
        ("RAMIPRIL 10mg", "Ramipril", "comprime", "10 mg", "orale", "IEC", "HTA, IC, post-infarctus"),
        ("AMLODIPINE 5mg", "Amlodipine", "comprime", "5 mg", "orale", "Inhibiteur calcique", "HTA, angor"),
        ("AMLODIPINE 10mg", "Amlodipine", "comprime", "10 mg", "orale", "Inhibiteur calcique", "HTA, angor"),
        ("CLOPIDOGREL 75mg", "Clopidogrel", "comprime", "75 mg", "orale", "Antiagregant", "Prevention atherothrombose"),
        ("PRASUGREL 10mg", "Prasugrel", "comprime", "10 mg", "orale", "Antiagregant", "SCA avec angioplastie"),
        ("TICAGRELOR 90mg", "Ticagrelor", "comprime", "90 mg", "orale", "Antiagregant", "SCA"),
        ("DIGOXINE 0.25mg", "Digoxine", "comprime", "0.25 mg", "orale", "Digitalique", "IC, ACFA"),
        ("SACUBITRIL/VALSARTAN 97/103mg", "Sacubitril/Valsartan", "comprime", "97/103 mg", "orale", "ARNI", "IC a FEVG reduite"),
        ("DAPAGLIFLOZINE 10mg", "Dapagliflozine", "comprime", "10 mg", "orale", "iSGLT2", "IC, diabete type 2"),
        ("EMPAGLIFLOZINE 10mg", "Empagliflozine", "comprime", "10 mg", "orale", "iSGLT2", "IC, diabete type 2"),
        ("IVABRADINE 5mg", "Ivabradine", "comprime", "5 mg", "orale", "Inhibiteur If", "IC, angor stable"),
        ("LOSARTAN 50mg", "Losartan", "comprime", "50 mg", "orale", "ARA2", "HTA, nephropathie diabetique"),
        ("VALSARTAN 80mg", "Valsartan", "comprime", "80 mg", "orale", "ARA2", "HTA, IC, post-infarctus"),
        ("CANDESARTAN 8mg", "Candesartan", "comprime", "8 mg", "orale", "ARA2", "HTA, IC"),
        ("EPLERENONE 25mg", "Eplerenone", "comprime", "25 mg", "orale", "ARM", "IC post-infarctus"),
        ("HYDROCHLOROTHIAZIDE 25mg", "Hydrochlorothiazide", "comprime", "25 mg", "orale", "Diuretique thiazidique", "HTA"),
        ("INDAPAMIDE 1.5mg LP", "Indapamide", "comprime LP", "1.5 mg", "orale", "Diuretique thiazidique-like", "HTA"),
        ("WARFARINE 5mg", "Warfarine", "comprime", "5 mg", "orale", "AVK", "Prevention thrombo-embolique"),
        ("HEPARINE SODIQUE 5000 UI/ml", "Heparine sodique", "injectable", "5000 UI/ml", "IV/SC", "Anticoagulant", "Thrombose, embolie"),
        ("ENOXAPARINE 4000 UI", "Enoxaparine", "injectable", "4000 UI", "SC", "HBPM", "Prevention TVP, SCA"),
        ("NITROGLICERINE 0.15mg", "Trinitrine", "sublingual", "0.15 mg", "sublinguale", "Derive nitre", "Crise angineuse"),
        ("ISOSORBIDE DINITRATE 20mg", "Isosorbide dinitrate", "comprime", "20 mg", "orale", "Derive nitre", "Angor, IC"),
        ("TRIMETAZIDINE 35mg", "Trimetazidine", "comprime MR", "35 mg", "orale", "Anti-ischemique", "Angor stable"),
    ]
    for brand, dci, form, strength, route, cls, indic in extras:
        exists = conn.execute("SELECT id FROM medicines_db WHERE brand_name = ?", (brand,)).fetchone()
        if not exists:
            conn.execute(
                """INSERT INTO medicines_db
                (brand_name, dci, active_substance, form, dosage_strength, route, indications, source, specialty)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'local', ?)""",
                (brand, dci, dci, form, strength, route, f"{cls}: {indic}", cls),
            )

    # ================================================================
    # COMPREHENSIVE ALGERIAN MEDICINE DATABASE
    # ================================================================
    algeria_meds = [
        # --- Antalgiques / Antipyretiques ---
        ("DOLIPRANE 500mg", "Paracetamol", "comprime", "500 mg", "orale", "Antalgique, antipyretique", ""),
        ("DOLIPRANE 1000mg", "Paracetamol", "comprime", "1000 mg", "orale", "Antalgique, antipyretique", ""),
        ("DOLIPRANE sirop enfant", "Paracetamol", "sirop", "120 mg/5ml", "orale", "Antalgique, antipyretique pediatrique", ""),
        ("EFFERALGAN 500mg", "Paracetamol", "comprime effervescent", "500 mg", "orale", "Antalgique, antipyretique", ""),
        ("EFFERALGAN 1g", "Paracetamol", "comprime effervescent", "1 g", "orale", "Antalgique, antipyretique", ""),
        ("PERFALGAN 1g", "Paracetamol", "injectable", "1 g/100ml", "IV", "Antalgique, antipyretique injectable", ""),
        ("DAFALGAN 500mg", "Paracetamol", "gelule", "500 mg", "orale", "Antalgique, antipyretique", ""),
        ("ASPEGIC 100mg", "Acide acetylsalicylique", "sachet", "100 mg", "orale", "Antiagregant plaquettaire faible dose", ""),
        ("ASPEGIC 250mg", "Acide acetylsalicylique", "sachet", "250 mg", "orale", "Antalgique, antipyretique", ""),
        ("ASPEGIC 1000mg", "Acide acetylsalicylique", "sachet", "1000 mg", "orale", "Antalgique, anti-inflammatoire", ""),
        ("ASPIRINE UPSA 500mg", "Acide acetylsalicylique", "comprime effervescent", "500 mg", "orale", "Antalgique, antipyretique", ""),
        # --- AINS ---
        ("VOLTARENE 25mg", "Diclofenac", "comprime", "25 mg", "orale", "Anti-inflammatoire, antalgique", "Ulcere, insuffisance renale"),
        ("VOLTARENE 50mg", "Diclofenac", "comprime", "50 mg", "orale", "Anti-inflammatoire, antalgique", "Ulcere, insuffisance renale"),
        ("VOLTARENE 75mg IM", "Diclofenac", "injectable", "75 mg/3ml", "IM", "Anti-inflammatoire injectable", "Ulcere, insuffisance renale"),
        ("VOLTARENE gel 1%", "Diclofenac", "gel", "1%", "cutanee", "Anti-inflammatoire local", ""),
        ("IBUPROFENE 200mg", "Ibuprofene", "comprime", "200 mg", "orale", "Anti-inflammatoire, antalgique", "Ulcere, asthme"),
        ("IBUPROFENE 400mg", "Ibuprofene", "comprime", "400 mg", "orale", "Anti-inflammatoire, antalgique", "Ulcere, asthme"),
        ("BRUFEN 400mg", "Ibuprofene", "comprime", "400 mg", "orale", "Anti-inflammatoire, antalgique", ""),
        ("KETOPROFENE 100mg", "Ketoprofene", "gelule", "100 mg", "orale", "Anti-inflammatoire, antalgique", ""),
        ("PROFENID 100mg", "Ketoprofene", "suppositoire", "100 mg", "rectale", "Anti-inflammatoire, antalgique", ""),
        ("PROFENID 100mg IM", "Ketoprofene", "injectable", "100 mg", "IM", "Anti-inflammatoire injectable", ""),
        ("FELDENE 20mg", "Piroxicam", "gelule", "20 mg", "orale", "Anti-inflammatoire", ""),
        ("CELEBREX 200mg", "Celecoxib", "gelule", "200 mg", "orale", "Anti-inflammatoire COX-2 selectif", ""),
        ("ARCOXIA 60mg", "Etoricoxib", "comprime", "60 mg", "orale", "Anti-inflammatoire COX-2 selectif", ""),
        # --- Antalgiques opiacees ---
        ("TRAMADOL 50mg", "Tramadol", "gelule", "50 mg", "orale", "Antalgique central palier 2", ""),
        ("TRAMADOL 100mg LP", "Tramadol", "comprime LP", "100 mg", "orale", "Antalgique central palier 2", ""),
        ("CODOLIPRANE", "Paracetamol/Codeine", "comprime", "400/20 mg", "orale", "Antalgique palier 2", ""),
        ("IXPRIM", "Tramadol/Paracetamol", "comprime", "37.5/325 mg", "orale", "Antalgique palier 2", ""),
        # --- Antibiotiques ---
        ("AMOXICILLINE 500mg", "Amoxicilline", "gelule", "500 mg", "orale", "Antibiotique penicilline", "Allergie penicilline"),
        ("AMOXICILLINE 1g", "Amoxicilline", "comprime dispersible", "1 g", "orale", "Antibiotique penicilline", "Allergie penicilline"),
        ("AMOXICILLINE sirop", "Amoxicilline", "sirop", "250 mg/5ml", "orale", "Antibiotique penicilline pediatrique", ""),
        ("AUGMENTIN 1g/125mg", "Amoxicilline/Ac. clavulanique", "comprime", "1g/125mg", "orale", "Antibiotique penicilline + inhibiteur", "Allergie penicilline"),
        ("AUGMENTIN sirop enfant", "Amoxicilline/Ac. clavulanique", "sirop", "100mg/12.5mg/ml", "orale", "Antibiotique pediatrique", ""),
        ("CLAMOXYL 500mg", "Amoxicilline", "gelule", "500 mg", "orale", "Antibiotique penicilline", ""),
        ("AMPICILLINE 500mg", "Ampicilline", "gelule", "500 mg", "orale", "Antibiotique penicilline", ""),
        ("CEFTRIAXONE 1g IM/IV", "Ceftriaxone", "injectable", "1 g", "IM/IV", "Cephalosporine 3e generation", ""),
        ("CEFTRIAXONE 2g IV", "Ceftriaxone", "injectable", "2 g", "IV", "Cephalosporine 3e generation", ""),
        ("CEFIXIME 200mg", "Cefixime", "comprime", "200 mg", "orale", "Cephalosporine 3e generation orale", ""),
        ("OROKEN 200mg", "Cefixime", "comprime", "200 mg", "orale", "Cephalosporine 3e generation orale", ""),
        ("ZINNAT 500mg", "Cefuroxime", "comprime", "500 mg", "orale", "Cephalosporine 2e generation", ""),
        ("CIPROFLOXACINE 500mg", "Ciprofloxacine", "comprime", "500 mg", "orale", "Fluoroquinolone", "Grossesse, enfant"),
        ("CIPROFLOXACINE 200mg IV", "Ciprofloxacine", "injectable", "200 mg/100ml", "IV", "Fluoroquinolone injectable", ""),
        ("OFLOXACINE 200mg", "Ofloxacine", "comprime", "200 mg", "orale", "Fluoroquinolone", ""),
        ("LEVOFLOXACINE 500mg", "Levofloxacine", "comprime", "500 mg", "orale", "Fluoroquinolone", ""),
        ("AZITHROMYCINE 250mg", "Azithromycine", "gelule", "250 mg", "orale", "Macrolide", ""),
        ("AZITHROMYCINE 500mg", "Azithromycine", "comprime", "500 mg", "orale", "Macrolide", ""),
        ("ZITHROMAX 250mg", "Azithromycine", "gelule", "250 mg", "orale", "Macrolide", ""),
        ("ERYTHROMYCINE 500mg", "Erythromycine", "comprime", "500 mg", "orale", "Macrolide", ""),
        ("ROVAMYCINE 3MUI", "Spiramycine", "comprime", "3 MUI", "orale", "Macrolide", ""),
        ("METRONIDAZOLE 250mg", "Metronidazole", "comprime", "250 mg", "orale", "Antiparasitaire, antibacterien", "Alcool"),
        ("METRONIDAZOLE 500mg", "Metronidazole", "comprime", "500 mg", "orale", "Antiparasitaire, antibacterien", ""),
        ("FLAGYL 250mg", "Metronidazole", "comprime", "250 mg", "orale", "Antiparasitaire, antibacterien", ""),
        ("FLAGYL 500mg", "Metronidazole", "comprime", "500 mg", "orale", "Antiparasitaire, antibacterien", ""),
        ("FLAGYL 500mg IV", "Metronidazole", "injectable", "500 mg/100ml", "IV", "Antiparasitaire, antibacterien injectable", ""),
        ("FLAZOL 500mg", "Metronidazole", "comprime", "500 mg", "orale", "Antiparasitaire, antibacterien", ""),
        ("DOXYCYCLINE 100mg", "Doxycycline", "gelule", "100 mg", "orale", "Tetracycline", "Grossesse, enfant<8ans"),
        ("COTRIMOXAZOLE 480mg", "Sulfamethoxazole/Trimethoprime", "comprime", "400/80 mg", "orale", "Antibacterien", ""),
        ("BACTRIM forte", "Sulfamethoxazole/Trimethoprime", "comprime", "800/160 mg", "orale", "Antibacterien", ""),
        ("GENTAMICINE 80mg", "Gentamicine", "injectable", "80 mg/2ml", "IM/IV", "Aminoside", "Nephrotoxicite, ototoxicite"),
        ("AMIKACINE 500mg", "Amikacine", "injectable", "500 mg", "IM/IV", "Aminoside", ""),
        ("PRISTINAMYCINE 500mg", "Pristinamycine", "comprime", "500 mg", "orale", "Streptogramine", ""),
        ("LINCOMYCINE 500mg", "Lincomycine", "gelule", "500 mg", "orale", "Lincosamide", ""),
        ("CLINDAMYCINE 300mg", "Clindamycine", "gelule", "300 mg", "orale", "Lincosamide", ""),
        # --- Anti-infectieux / Antifongiques ---
        ("FLUCONAZOLE 150mg", "Fluconazole", "gelule", "150 mg", "orale", "Antifongique", ""),
        ("FLUCONAZOLE 200mg", "Fluconazole", "gelule", "200 mg", "orale", "Antifongique systemique", ""),
        # --- Antiparasitaires ---
        ("ALBENDAZOLE 400mg", "Albendazole", "comprime", "400 mg", "orale", "Antiparasitaire", ""),
        # --- Anti-ulcereux / Gastro ---
        ("OMEPRAZOLE 20mg", "Omeprazole", "gelule", "20 mg", "orale", "IPP, anti-ulcereux", ""),
        ("MOPRAL 20mg", "Omeprazole", "gelule", "20 mg", "orale", "IPP, anti-ulcereux", ""),
        ("ESOMEPRAZOLE 20mg", "Esomeprazole", "comprime", "20 mg", "orale", "IPP, anti-ulcereux", ""),
        ("ESOMEPRAZOLE 40mg", "Esomeprazole", "comprime", "40 mg", "orale", "IPP, anti-ulcereux", ""),
        ("INEXIUM 40mg", "Esomeprazole", "comprime", "40 mg", "orale", "IPP, anti-ulcereux", ""),
        ("PANTOPRAZOLE 20mg", "Pantoprazole", "comprime", "20 mg", "orale", "IPP, anti-ulcereux", ""),
        ("PANTOPRAZOLE 40mg", "Pantoprazole", "comprime", "40 mg", "orale", "IPP, anti-ulcereux", ""),
        ("LANSOPRAZOLE 30mg", "Lansoprazole", "gelule", "30 mg", "orale", "IPP, anti-ulcereux", ""),
        ("RANITIDINE 150mg", "Ranitidine", "comprime", "150 mg", "orale", "Anti-H2, anti-ulcereux", ""),
        ("GAVISCON", "Alginate de sodium", "suspension", "10 ml", "orale", "Antireflux", ""),
        ("MAALOX", "Hydroxyde Al/Mg", "comprime a croquer", "", "orale", "Antiacide", ""),
        ("SMECTA", "Diosmectite", "sachet", "3 g", "orale", "Anti-diarrheique, pansement digestif", ""),
        ("IMODIUM 2mg", "Loperamide", "gelule", "2 mg", "orale", "Anti-diarrheique", ""),
        ("DEBRIDAT", "Trimebutine", "comprime", "100 mg", "orale", "Regulateur du transit, antispasmodique", ""),
        ("SPASFON", "Phloroglucinol", "comprime", "80 mg", "orale", "Antispasmodique", ""),
        ("SPASFON injectable", "Phloroglucinol", "injectable", "40 mg", "IV/IM", "Antispasmodique injectable", ""),
        ("MOTILIUM 10mg", "Domperidone", "comprime", "10 mg", "orale", "Antiemetique, gastroprokinetique", ""),
        ("METOCLOPRAMIDE 10mg", "Metoclopramide", "comprime", "10 mg", "orale", "Antiemetique", ""),
        ("PRIMPERAN 10mg", "Metoclopramide", "comprime", "10 mg", "orale", "Antiemetique", ""),
        ("VOGALENE 15mg", "Metopimazine", "gelule", "15 mg", "orale", "Antiemetique", ""),
        ("DUPHALAC", "Lactulose", "sirop", "10 g/15ml", "orale", "Laxatif osmotique", ""),
        # --- Antihypertenseurs ---
        ("AMLOR 5mg", "Amlodipine", "gelule", "5 mg", "orale", "Inhibiteur calcique, HTA", ""),
        ("AMLOR 10mg", "Amlodipine", "gelule", "10 mg", "orale", "Inhibiteur calcique, HTA", ""),
        ("LOXEN 20mg", "Nicardipine", "comprime", "20 mg", "orale", "Inhibiteur calcique, HTA, angor", ""),
        ("LOXEN LP 50mg", "Nicardipine", "gelule LP", "50 mg", "orale", "Inhibiteur calcique LP, HTA", ""),
        ("ADALATE LP 30mg", "Nifedipine", "comprime LP", "30 mg", "orale", "Inhibiteur calcique, HTA", ""),
        ("ISOPTINE 120mg", "Verapamil", "comprime", "120 mg", "orale", "Inhibiteur calcique, HTA, arythmie", ""),
        ("ISOPTINE LP 240mg", "Verapamil", "comprime LP", "240 mg", "orale", "Inhibiteur calcique LP, HTA", ""),
        ("TRIATEC 5mg", "Ramipril", "comprime", "5 mg", "orale", "IEC, HTA, IC, post-infarctus", "Grossesse, hyperkaliemie"),
        ("TRIATEC 10mg", "Ramipril", "comprime", "10 mg", "orale", "IEC, HTA, IC, post-infarctus", ""),
        ("RENITEC 20mg", "Enalapril", "comprime", "20 mg", "orale", "IEC, HTA, IC", ""),
        ("RENITEC 5mg", "Enalapril", "comprime", "5 mg", "orale", "IEC, HTA, IC", ""),
        ("LOPRIL 25mg", "Captopril", "comprime", "25 mg", "orale", "IEC, HTA, IC", ""),
        ("LOPRIL 50mg", "Captopril", "comprime", "50 mg", "orale", "IEC, HTA, IC", ""),
        ("COVERSYL 5mg", "Perindopril", "comprime", "5 mg", "orale", "IEC, HTA, coronaropathie", ""),
        ("COVERSYL 10mg", "Perindopril", "comprime", "10 mg", "orale", "IEC, HTA, coronaropathie", ""),
        ("COZAAR 50mg", "Losartan", "comprime", "50 mg", "orale", "ARA2, HTA", ""),
        ("COZAAR 100mg", "Losartan", "comprime", "100 mg", "orale", "ARA2, HTA", ""),
        ("TAREG 80mg", "Valsartan", "comprime", "80 mg", "orale", "ARA2, HTA, IC", ""),
        ("TAREG 160mg", "Valsartan", "comprime", "160 mg", "orale", "ARA2, HTA, IC", ""),
        ("ATACAND 8mg", "Candesartan", "comprime", "8 mg", "orale", "ARA2, HTA, IC", ""),
        ("ATACAND 16mg", "Candesartan", "comprime", "16 mg", "orale", "ARA2, HTA, IC", ""),
        ("MICARDIS 40mg", "Telmisartan", "comprime", "40 mg", "orale", "ARA2, HTA", ""),
        ("MICARDIS 80mg", "Telmisartan", "comprime", "80 mg", "orale", "ARA2, HTA", ""),
        ("APROVEL 150mg", "Irbesartan", "comprime", "150 mg", "orale", "ARA2, HTA, nephropathie diabetique", ""),
        ("APROVEL 300mg", "Irbesartan", "comprime", "300 mg", "orale", "ARA2, HTA, nephropathie diabetique", ""),
        ("CATAPRESSAN 150ug", "Clonidine", "comprime", "0.15 mg", "orale", "Antihypertenseur central", ""),
        # --- Beta-bloquants ---
        ("SECTRAL 200mg", "Acebutolol", "comprime", "200 mg", "orale", "Beta-bloquant, HTA, angor", "Asthme, BAV"),
        ("TENORMINE 100mg", "Atenolol", "comprime", "100 mg", "orale", "Beta-bloquant, HTA, angor, arythmie", "Asthme, BAV"),
        ("TENORMINE 50mg", "Atenolol", "comprime", "50 mg", "orale", "Beta-bloquant, HTA, angor", ""),
        ("SELOKEN 100mg", "Metoprolol", "comprime", "100 mg", "orale", "Beta-bloquant, HTA, angor, IC", ""),
        ("SELOKEN LP 95mg", "Metoprolol", "comprime LP", "95 mg", "orale", "Beta-bloquant LP, HTA, IC", ""),
        ("KREDEX 25mg", "Carvedilol", "comprime", "25 mg", "orale", "Beta-bloquant, IC, HTA", ""),
        ("KREDEX 6.25mg", "Carvedilol", "comprime", "6.25 mg", "orale", "Beta-bloquant, IC, HTA", ""),
        ("CONCOR 5mg", "Bisoprolol", "comprime", "5 mg", "orale", "Beta-bloquant, HTA, IC, coronaropathie", ""),
        ("CONCOR 10mg", "Bisoprolol", "comprime", "10 mg", "orale", "Beta-bloquant, HTA, IC, coronaropathie", ""),
        ("NEBILET 5mg", "Nebivolol", "comprime", "5 mg", "orale", "Beta-bloquant, HTA, IC", ""),
        ("AVLOCARDYL 40mg", "Propranolol", "comprime", "40 mg", "orale", "Beta-bloquant, HTA, tremblements, migraine", ""),
        # --- Diuretiques ---
        ("LASILIX 40mg", "Furosemide", "comprime", "40 mg", "orale", "Diuretique de l'anse, IC, oedemes", ""),
        ("LASILIX 20mg IV", "Furosemide", "injectable", "20 mg/2ml", "IV", "Diuretique de l'anse injectable", ""),
        ("LASILIX 500mg", "Furosemide", "comprime", "500 mg", "orale", "Diuretique de l'anse forte dose", ""),
        ("ALDACTONE 25mg", "Spironolactone", "comprime", "25 mg", "orale", "Epargneur de potassium, IC, HTA", "Hyperkaliemie"),
        ("ALDACTONE 50mg", "Spironolactone", "comprime", "50 mg", "orale", "Epargneur de potassium, IC", ""),
        ("ESIDREX 25mg", "Hydrochlorothiazide", "comprime", "25 mg", "orale", "Diuretique thiazidique, HTA", ""),
        ("FLUDEX LP 1.5mg", "Indapamide", "comprime LP", "1.5 mg", "orale", "Diuretique thiazidique-like, HTA", ""),
        # --- Anticoagulants ---
        ("SINTROM 4mg", "Acenocoumarol", "comprime", "4 mg", "orale", "AVK, anticoagulant oral", "Grossesse, hemorragie"),
        ("PREVISCAN 20mg", "Fluindione", "comprime", "20 mg", "orale", "AVK, anticoagulant oral", ""),
        ("COUMADINE 5mg", "Warfarine", "comprime", "5 mg", "orale", "AVK, anticoagulant oral", ""),
        ("XARELTO 20mg", "Rivaroxaban", "comprime", "20 mg", "orale", "AOD, anticoagulant direct", ""),
        ("XARELTO 15mg", "Rivaroxaban", "comprime", "15 mg", "orale", "AOD, anticoagulant direct", ""),
        ("XARELTO 10mg", "Rivaroxaban", "comprime", "10 mg", "orale", "AOD, prevention TVP", ""),
        ("ELIQUIS 5mg", "Apixaban", "comprime", "5 mg", "orale", "AOD, anticoagulant direct", ""),
        ("ELIQUIS 2.5mg", "Apixaban", "comprime", "2.5 mg", "orale", "AOD, anticoagulant direct", ""),
        ("PRADAXA 150mg", "Dabigatran", "gelule", "150 mg", "orale", "AOD, anticoagulant direct", ""),
        ("PRADAXA 110mg", "Dabigatran", "gelule", "110 mg", "orale", "AOD, anticoagulant direct", ""),
        ("LOVENOX 4000 UI", "Enoxaparine", "injectable", "4000 UI/0.4ml", "SC", "HBPM, prevention/traitement TVP", ""),
        ("LOVENOX 6000 UI", "Enoxaparine", "injectable", "6000 UI/0.6ml", "SC", "HBPM, traitement TVP/EP", ""),
        ("LOVENOX 8000 UI", "Enoxaparine", "injectable", "8000 UI/0.8ml", "SC", "HBPM, traitement TVP/EP", ""),
        ("FRAXIPARINE 0.3ml", "Nadroparine", "injectable", "2850 UI/0.3ml", "SC", "HBPM, prevention TVP", ""),
        ("INNOHEP 4500 UI", "Tinzaparine", "injectable", "4500 UI", "SC", "HBPM, traitement TVP", ""),
        ("HEPARINE 25000 UI", "Heparine sodique", "injectable", "25000 UI/5ml", "IV", "Anticoagulant", ""),
        # --- Antiagregants plaquettaires ---
        ("PLAVIX 75mg", "Clopidogrel", "comprime", "75 mg", "orale", "Antiagregant, prevention atherothrombose", ""),
        ("KARDEGIC 75mg", "Acide acetylsalicylique", "sachet", "75 mg", "orale", "Antiagregant plaquettaire", ""),
        ("KARDEGIC 160mg", "Acide acetylsalicylique", "sachet", "160 mg", "orale", "Antiagregant plaquettaire", ""),
        ("BRILIQUE 90mg", "Ticagrelor", "comprime", "90 mg", "orale", "Antiagregant, SCA", ""),
        ("EFIENT 10mg", "Prasugrel", "comprime", "10 mg", "orale", "Antiagregant, SCA avec ICP", ""),
        # --- Statines / Hypolipemiants ---
        ("TAHOR 10mg", "Atorvastatine", "comprime", "10 mg", "orale", "Statine, dyslipidemie", "Insuffisance hepatique"),
        ("TAHOR 20mg", "Atorvastatine", "comprime", "20 mg", "orale", "Statine, dyslipidemie", ""),
        ("TAHOR 40mg", "Atorvastatine", "comprime", "40 mg", "orale", "Statine, dyslipidemie", ""),
        ("TAHOR 80mg", "Atorvastatine", "comprime", "80 mg", "orale", "Statine haute intensite", ""),
        ("CRESTOR 5mg", "Rosuvastatine", "comprime", "5 mg", "orale", "Statine, dyslipidemie", ""),
        ("CRESTOR 10mg", "Rosuvastatine", "comprime", "10 mg", "orale", "Statine, dyslipidemie", ""),
        ("CRESTOR 20mg", "Rosuvastatine", "comprime", "20 mg", "orale", "Statine, dyslipidemie", ""),
        ("ZOCOR 20mg", "Simvastatine", "comprime", "20 mg", "orale", "Statine, dyslipidemie", ""),
        ("ZOCOR 40mg", "Simvastatine", "comprime", "40 mg", "orale", "Statine, dyslipidemie", ""),
        ("ELISOR 20mg", "Pravastatine", "comprime", "20 mg", "orale", "Statine, dyslipidemie", ""),
        ("LIPANTHYL 200mg", "Fenofibrate", "gelule", "200 mg", "orale", "Fibrate, hypertriglyceridemie", ""),
        ("LIPANTHYL 145mg", "Fenofibrate", "comprime", "145 mg", "orale", "Fibrate, hypertriglyceridemie", ""),
        ("EZETROL 10mg", "Ezetimibe", "comprime", "10 mg", "orale", "Inhibiteur absorption cholesterol", ""),
        # --- Antidiabetiques ---
        ("GLUCOPHAGE 500mg", "Metformine", "comprime", "500 mg", "orale", "Antidiabetique, diabete type 2", "Insuffisance renale"),
        ("GLUCOPHAGE 850mg", "Metformine", "comprime", "850 mg", "orale", "Antidiabetique, diabete type 2", ""),
        ("GLUCOPHAGE 1000mg", "Metformine", "comprime", "1000 mg", "orale", "Antidiabetique, diabete type 2", ""),
        ("DIAMICRON 30mg MR", "Gliclazide", "comprime MR", "30 mg", "orale", "Sulfamide hypoglycemiant", ""),
        ("DIAMICRON 60mg MR", "Gliclazide", "comprime MR", "60 mg", "orale", "Sulfamide hypoglycemiant", ""),
        ("DAONIL 5mg", "Glibenclamide", "comprime", "5 mg", "orale", "Sulfamide hypoglycemiant", ""),
        ("AMARYL 2mg", "Glimepiride", "comprime", "2 mg", "orale", "Sulfamide hypoglycemiant", ""),
        ("AMARYL 4mg", "Glimepiride", "comprime", "4 mg", "orale", "Sulfamide hypoglycemiant", ""),
        ("JANUVIA 100mg", "Sitagliptine", "comprime", "100 mg", "orale", "Inhibiteur DPP-4, diabete type 2", ""),
        ("GALVUS 50mg", "Vildagliptine", "comprime", "50 mg", "orale", "Inhibiteur DPP-4, diabete type 2", ""),
        ("JARDIANCE 10mg", "Empagliflozine", "comprime", "10 mg", "orale", "iSGLT2, diabete type 2, IC", ""),
        ("FORXIGA 10mg", "Dapagliflozine", "comprime", "10 mg", "orale", "iSGLT2, diabete type 2, IC", ""),
        ("VICTOZA", "Liraglutide", "injectable", "6 mg/ml", "SC", "Agoniste GLP-1, diabete type 2", ""),
        ("OZEMPIC 0.5mg", "Semaglutide", "injectable", "0.5 mg/dose", "SC", "Agoniste GLP-1, diabete type 2", ""),
        ("OZEMPIC 1mg", "Semaglutide", "injectable", "1 mg/dose", "SC", "Agoniste GLP-1, diabete type 2", ""),
        ("INSULINE LANTUS", "Insuline glargine", "injectable", "100 UI/ml", "SC", "Insuline basale", ""),
        ("INSULINE NOVORAPID", "Insuline asparte", "injectable", "100 UI/ml", "SC", "Insuline rapide", ""),
        ("INSULINE MIXTARD 30/70", "Insuline mixte", "injectable", "100 UI/ml", "SC", "Insuline premixee", ""),
        # --- Anti-arythmiques ---
        ("CORDARONE 200mg", "Amiodarone", "comprime", "200 mg", "orale", "Anti-arythmique classe III", "Thyroide, foie, poumon"),
        ("CORDARONE IV", "Amiodarone", "injectable", "150 mg/3ml", "IV", "Anti-arythmique injectable", ""),
        ("FLECAINE 100mg", "Flecainide", "comprime", "100 mg", "orale", "Anti-arythmique classe Ic", "IC, post-infarctus"),
        ("RYTHMODAN 100mg", "Disopyramide", "gelule", "100 mg", "orale", "Anti-arythmique classe Ia", ""),
        # --- Derives nitres ---
        ("TRINITRINE spray", "Trinitrine", "spray sublingual", "0.4 mg/dose", "sublinguale", "Crise angineuse", ""),
        ("RISORDAN 20mg", "Isosorbide dinitrate", "comprime", "20 mg", "orale", "Angor, IC", ""),
        ("MONICOR LP 20mg", "Isosorbide mononitrate", "gelule LP", "20 mg", "orale", "Angor stable", ""),
        # --- Autres cardio ---
        ("PROCORALAN 5mg", "Ivabradine", "comprime", "5 mg", "orale", "Inhibiteur If, IC, angor stable", ""),
        ("PROCORALAN 7.5mg", "Ivabradine", "comprime", "7.5 mg", "orale", "Inhibiteur If, IC, angor stable", ""),
        ("VASTAREL 35mg MR", "Trimetazidine", "comprime MR", "35 mg", "orale", "Anti-ischemique, angor stable", ""),
        ("ENTRESTO 97/103mg", "Sacubitril/Valsartan", "comprime", "97/103 mg", "orale", "ARNI, IC a FEVG reduite", ""),
        ("ENTRESTO 49/51mg", "Sacubitril/Valsartan", "comprime", "49/51 mg", "orale", "ARNI, IC a FEVG reduite", ""),
        ("DIGOXINE 0.25mg", "Digoxine", "comprime", "0.25 mg", "orale", "IC, ACFA", "Hypokaliemie, insuffisance renale"),
        # --- Corticoides ---
        ("CORTANCYL 5mg", "Prednisone", "comprime", "5 mg", "orale", "Corticoide", "Diabete, infection"),
        ("CORTANCYL 20mg", "Prednisone", "comprime", "20 mg", "orale", "Corticoide", ""),
        ("SOLUPRED 20mg", "Prednisolone", "comprime orodispersible", "20 mg", "orale", "Corticoide", ""),
        ("SOLUMEDROL 40mg", "Methylprednisolone", "injectable", "40 mg", "IV/IM", "Corticoide injectable", ""),
        ("SOLUMEDROL 120mg", "Methylprednisolone", "injectable", "120 mg", "IV", "Corticoide injectable forte dose", ""),
        ("CELESTENE 2mg", "Betamethasone", "injectable", "8 mg/2ml", "IM", "Corticoide retard", ""),
        # --- Antiallergiques / Antihistaminiques ---
        ("ZYRTEC 10mg", "Cetirizine", "comprime", "10 mg", "orale", "Antihistaminique H1", ""),
        ("AERIUS 5mg", "Desloratadine", "comprime", "5 mg", "orale", "Antihistaminique H1", ""),
        ("CLARITYNE 10mg", "Loratadine", "comprime", "10 mg", "orale", "Antihistaminique H1", ""),
        ("POLARAMINE 6mg", "Dexchlorpheniramine", "comprime", "6 mg", "orale", "Antihistaminique H1 sedatif", ""),
        # --- Anxiolytiques / Psychotropes ---
        ("LEXOMIL 6mg", "Bromazepam", "comprime quadrisecable", "6 mg", "orale", "Anxiolytique benzodiazepine", ""),
        ("XANAX 0.25mg", "Alprazolam", "comprime", "0.25 mg", "orale", "Anxiolytique benzodiazepine", ""),
        ("XANAX 0.5mg", "Alprazolam", "comprime", "0.5 mg", "orale", "Anxiolytique benzodiazepine", ""),
        ("VALIUM 10mg", "Diazepam", "comprime", "10 mg", "orale", "Anxiolytique benzodiazepine", ""),
        ("TEMESTA 2.5mg", "Lorazepam", "comprime", "2.5 mg", "orale", "Anxiolytique benzodiazepine", ""),
        ("STILNOX 10mg", "Zolpidem", "comprime", "10 mg", "orale", "Hypnotique", ""),
        ("IMOVANE 7.5mg", "Zopiclone", "comprime", "7.5 mg", "orale", "Hypnotique", ""),
        ("DEROXAT 20mg", "Paroxetine", "comprime", "20 mg", "orale", "ISRS, antidepresseur", ""),
        ("SEROPLEX 10mg", "Escitalopram", "comprime", "10 mg", "orale", "ISRS, antidepresseur", ""),
        ("PROZAC 20mg", "Fluoxetine", "gelule", "20 mg", "orale", "ISRS, antidepresseur", ""),
        ("ANAFRANIL 25mg", "Clomipramine", "comprime", "25 mg", "orale", "Antidepresseur tricyclique", ""),
        ("LAROXYL 25mg", "Amitriptyline", "comprime", "25 mg", "orale", "Antidepresseur tricyclique", ""),
        # --- Thyroide ---
        ("LEVOTHYROX 25ug", "Levothyroxine", "comprime", "25 ug", "orale", "Hypothyroidie", ""),
        ("LEVOTHYROX 50ug", "Levothyroxine", "comprime", "50 ug", "orale", "Hypothyroidie", ""),
        ("LEVOTHYROX 75ug", "Levothyroxine", "comprime", "75 ug", "orale", "Hypothyroidie", ""),
        ("LEVOTHYROX 100ug", "Levothyroxine", "comprime", "100 ug", "orale", "Hypothyroidie", ""),
        ("NEOMERCAZOLE 5mg", "Carbimazole", "comprime", "5 mg", "orale", "Antithyroidien, hyperthyroidie", ""),
        ("NEOMERCAZOLE 20mg", "Carbimazole", "comprime", "20 mg", "orale", "Antithyroidien, hyperthyroidie", ""),
        # --- Respiratoire ---
        ("VENTOLINE spray", "Salbutamol", "aerosol", "100 ug/dose", "inhalee", "Bronchodilatateur B2, asthme, BPCO", ""),
        ("VENTOLINE nebuliseur", "Salbutamol", "solution nebulisation", "5 mg/2.5ml", "inhalee", "Bronchodilatateur B2 nebulisation", ""),
        ("BRICANYL 5mg", "Terbutaline", "comprime", "5 mg", "orale", "Bronchodilatateur B2", ""),
        ("ATROVENT spray", "Ipratropium", "aerosol", "20 ug/dose", "inhalee", "Anticholinergique, BPCO", ""),
        ("SERETIDE 250/25", "Fluticasone/Salmeterol", "aerosol", "250/25 ug", "inhalee", "Corticoide + B2LA, asthme", ""),
        ("SYMBICORT 200/6", "Budesonide/Formoterol", "aerosol", "200/6 ug", "inhalee", "Corticoide + B2LA, asthme", ""),
        ("SINGULAIR 10mg", "Montelukast", "comprime", "10 mg", "orale", "Antileucotrienes, asthme", ""),
        ("THEOPHYLLINE 200mg LP", "Theophylline", "comprime LP", "200 mg", "orale", "Bronchodilatateur, asthme", ""),
        ("SOLUPRED sirop", "Prednisolone", "sirop", "1 mg/ml", "orale", "Corticoide oral, asthme aigu", ""),
        # --- Vitamines / Supplements ---
        ("CALCIUM VITAMINE D3", "Calcium/Cholecalciferol", "comprime", "500mg/400UI", "orale", "Supplement calcium et vitamine D", ""),
        ("UVEDOSE 100000 UI", "Cholecalciferol", "ampoule buvable", "100000 UI", "orale", "Vitamine D", ""),
        ("TARDYFERON 80mg", "Fer sulfate", "comprime", "80 mg fer", "orale", "Supplement fer, anemie ferriprive", ""),
        ("FERCIV 100mg IV", "Fer saccharose", "injectable", "100 mg/5ml", "IV", "Supplement fer injectable", ""),
        ("SPECIAFOLDINE 5mg", "Acide folique", "comprime", "5 mg", "orale", "Supplement folates", ""),
        ("VITAMINE B12 1000ug", "Cyanocobalamine", "injectable", "1000 ug", "IM", "Supplement B12", ""),
        ("VITAMINE K1 10mg", "Phytomenadione", "injectable", "10 mg", "IV/IM", "Antidote AVK, coagulation", ""),
        ("POTASSIUM CHLORURE 600mg", "Potassium chlorure", "comprime", "600 mg", "orale", "Supplement potassium", ""),
        ("DIFFU-K", "Potassium chlorure", "gelule", "600 mg", "orale", "Supplement potassium, hypokaliemie", ""),
        ("MAGNESIUM B6", "Magnesium/Pyridoxine", "comprime", "48/5 mg", "orale", "Supplement magnesium", ""),
        # --- Urologiques ---
        ("TAMSULOSINE 0.4mg", "Tamsulosine", "gelule LP", "0.4 mg", "orale", "Alpha-bloquant, HBP", ""),
        ("AVODART 0.5mg", "Dutasteride", "capsule", "0.5 mg", "orale", "Inhibiteur 5-alpha reductase, HBP", ""),
        # --- Anti-goutteux ---
        ("COLCHICINE 1mg", "Colchicine", "comprime", "1 mg", "orale", "Crise de goutte", "Diarrhee, insuffisance renale"),
        ("ALLOPURINOL 100mg", "Allopurinol", "comprime", "100 mg", "orale", "Hypo-uricemiant, goutte", ""),
        ("ALLOPURINOL 300mg", "Allopurinol", "comprime", "300 mg", "orale", "Hypo-uricemiant, goutte", ""),
        # --- Dermatologie ---
        ("FUCIDINE creme 2%", "Acide fusidique", "creme", "2%", "cutanee", "Antibiotique local", ""),
        ("DIPROSONE creme", "Betamethasone", "creme", "0.05%", "cutanee", "Dermocorticoide fort", ""),
        # --- Ophtalmologie ---
        ("TOBREX collyre", "Tobramycine", "collyre", "0.3%", "oculaire", "Antibiotique oculaire", ""),
        ("INDOCOLLYRE", "Indometacine", "collyre", "0.1%", "oculaire", "AINS oculaire", ""),
    ]
    for brand, dci, form, strength, route, indic, contra in algeria_meds:
        exists = conn.execute("SELECT id FROM medicines_db WHERE brand_name = ?", (brand,)).fetchone()
        if not exists:
            conn.execute(
                """INSERT INTO medicines_db
                (brand_name, dci, active_substance, form, dosage_strength, route,
                 indications, contraindications, source, specialty)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'algerie', ?)""",
                (brand, dci, dci, form, strength, route, indic, contra, indic),
            )


def seed_document_templates(conn: sqlite3.Connection) -> None:
    """Seed default document templates for cardiology practice."""
    templates = [
        ("Ordonnance", "ordonnance", """<div style="text-align:center;margin-bottom:20px">
<h2>{{clinic_name}}</h2>
<p><strong>{{doctor_name}}</strong> - {{doctor_specialty}}</p>
<p>N° Ordre: {{doctor_order_number}}</p>
<p>{{doctor_address}}</p>
<p>Tel: {{doctor_phone}} | Email: {{doctor_email}}</p>
</div>
<hr/>
<p style="text-align:right">Le {{date_today}}</p>
<h3 style="text-align:center">ORDONNANCE</h3>
<p><strong>Patient:</strong> {{patient_name}} {{patient_first_name}}</p>
<p><strong>Ne(e) le:</strong> {{patient_birth_date}} | <strong>Age:</strong> {{patient_age}} ans</p>
<hr/>
<div style="min-height:300px;padding:20px">
{{treatment}}
</div>
<hr/>
<p style="text-align:right"><em>Dr {{doctor_name}}</em></p>"""),
        ("Certificat medical simple", "certificat", """<div style="text-align:center;margin-bottom:20px">
<h2>{{clinic_name}}</h2>
<p><strong>Dr {{doctor_name}}</strong> - {{doctor_specialty}}</p>
<p>N° Ordre: {{doctor_order_number}}</p>
<p>{{doctor_address}}</p>
<p>Tel: {{doctor_phone}} | Email: {{doctor_email}}</p>
</div>
<hr/>
<p style="text-align:right">Le {{date_today}}</p>
<h3 style="text-align:center">CERTIFICAT MEDICAL</h3>
<p>Je soussigne, Dr {{doctor_name}}, {{doctor_specialty}}, certifie avoir examine ce jour:</p>
<p><strong>{{patient_name}} {{patient_first_name}}</strong>, ne(e) le {{patient_birth_date}}, age(e) de {{patient_age}} ans.</p>
<br/>
<p>{{diagnosis}}</p>
<br/>
<p>Certificat delivre a l'interesse(e) pour servir et valoir ce que de droit.</p>
<br/>
<p style="text-align:right"><em>Dr {{doctor_name}}</em></p>"""),
        ("Certificat de non contre-indication au sport", "certificat", """<div style="text-align:center;margin-bottom:20px">
<h2>{{clinic_name}}</h2>
<p><strong>Dr {{doctor_name}}</strong> - {{doctor_specialty}}</p>
<p>N° Ordre: {{doctor_order_number}}</p>
<p>{{doctor_address}}</p>
</div>
<hr/>
<p style="text-align:right">Le {{date_today}}</p>
<h3 style="text-align:center">CERTIFICAT MEDICAL DE NON CONTRE-INDICATION<br/>A LA PRATIQUE SPORTIVE</h3>
<p>Je soussigne, Dr {{doctor_name}}, {{doctor_specialty}}, certifie avoir examine ce jour:</p>
<p><strong>{{patient_name}} {{patient_first_name}}</strong>, ne(e) le {{patient_birth_date}}.</p>
<br/>
<p>Et ne pas avoir constate, ce jour, de signe clinique apparent contre-indiquant la pratique de l'activite physique et sportive.</p>
<br/>
<p>Ce certificat est valable pour une duree de {{duration}}.</p>
<br/>
<p style="text-align:right"><em>Dr {{doctor_name}}</em></p>
<p style="text-align:center;font-size:0.8em">Tel: {{doctor_phone}} | {{doctor_email}}</p>"""),
                ("Certificat de dispense sportive", "certificat", """<div data-template-layout="full-page" style="font-family:'Times New Roman', Times, serif;max-width:760px;margin:0 auto;padding:12px 18px 14px;color:#000;background:#fff;min-height:1020px;display:flex;flex-direction:column;box-sizing:border-box;">
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:18px;">
    <div style="font-size:14px;line-height:1.75;font-weight:700;flex:1;min-width:0;">
        <p style="margin:0;font-size:15px;">Dr.{{doctor_template_name}}.</p>
        <p style="margin:0;font-size:14px;">{{doctor_specialty_template}}</p>
        <p style="margin:0;font-size:12px;font-weight:400;">N&deg; d'ordre des medecins : {{doctor_order_number}}</p>
    </div>
    <div style="width:82px;display:flex;justify-content:center;align-items:flex-start;padding-top:2px;flex-shrink:0;">
        <svg viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" style="width:56px;height:56px;display:block;" aria-label="Logo coeur">
            <defs>
                <linearGradient id="heartBody" x1="18%" y1="8%" x2="82%" y2="92%">
                    <stop offset="0%" stop-color="#5b0f18"/>
                    <stop offset="38%" stop-color="#9f1d28"/>
                    <stop offset="72%" stop-color="#c62a23"/>
                    <stop offset="100%" stop-color="#7a1b1a"/>
                </linearGradient>
                <radialGradient id="heartGlow" cx="32%" cy="24%" r="62%">
                    <stop offset="0%" stop-color="#ffb4a8" stop-opacity=".9"/>
                    <stop offset="55%" stop-color="#ff6b5f" stop-opacity=".32"/>
                    <stop offset="100%" stop-color="#ff6b5f" stop-opacity="0"/>
                </radialGradient>
            </defs>
            <path d="M48 82c-1.8 0-3.4-.9-4.3-2.4L13.5 31.8c-4.9-8.1-2.8-18.7 4.8-24.1 6.2-4.4 14.4-4 20.4 1l9.3 7.7 9.3-7.7c6-5 14.2-5.4 20.4-1 7.6 5.4 9.7 16 4.8 24.1L52.3 79.6C51.4 81.1 49.8 82 48 82z" fill="url(#heartBody)" stroke="#4c0519" stroke-width="1.8" />
            <path d="M33 21c6 1.8 9.6 6.2 10.8 11.6" stroke="#ffd1cc" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".62"/>
            <path d="M62 21.5c4.5 3.4 7.3 7.9 8.5 13.6" stroke="#ffd1cc" stroke-width="2.5" fill="none" stroke-linecap="round" opacity=".48"/>
            <path d="M37 34c5.5-4.3 12.8-3.2 16.6 1.8" stroke="url(#heartGlow)" stroke-width="4" fill="none" stroke-linecap="round" opacity=".7"/>
            <path d="M46 46c-6 7.6-9.6 14.9-11 22" stroke="#65111b" stroke-width="2.8" fill="none" stroke-linecap="round" opacity=".35"/>
            <path d="M57 42c5.7 6.4 8.9 12.7 10 19.5" stroke="#65111b" stroke-width="2.8" fill="none" stroke-linecap="round" opacity=".35"/>
        </svg>
    </div>
    <div style="font-size:13px;line-height:1.65;text-align:left;min-width:210px;">
        <p style="margin:0;">Date: <strong>{{date_time_short}}</strong></p>
        <p style="margin:0;">Nom: <strong>{{patient_name_upper}}</strong></p>
        <p style="margin:0;">Prenom : <strong>{{patient_first_name_upper}}</strong></p>
        <p style="margin:0;">Age : <strong>{{patient_age}} ans</strong></p>
    </div>
</div>
<div style="border:3px solid #111;padding:10px 14px 9px;margin:18px 28px 18px;text-align:center;">
    <h2 style="font-size:21px;font-weight:700;margin:0 0 6px;letter-spacing:2px;line-height:1.05;font-family:'Times New Roman', Times, serif;">CERTIFICAT MEDICAL</h2>
    <h2 style="font-size:19px;font-weight:700;margin:0;letter-spacing:1.8px;line-height:1.1;font-family:'Times New Roman', Times, serif;">DE DISPENSE DE L' ACTIVITE SPORTIVE</h2>
</div>
<div style="padding:10px 36px 0;font-size:14px;line-height:1.84;text-align:left;flex:1;">
    <p style="margin:0 0 24px;">Je soussigne, Dr {{doctor_template_name}}, {{doctor_specialty_label}}, certifie que :</p>
    <p style="margin:0;">{{patient_subject}} : ....<strong>{{patient_full_name_upper}}</strong>....</p>
    <p style="margin:0;">{{patient_birth_label}} : ...............<strong>{{patient_birth_date}}</strong>........</p>
    <br/>
    <p style="margin:0;">est suivie en cardiologie, dont son etat de sante lui dispense</p>
    <p style="margin:0;">de la pratique d'une activite sportive</p>
    <p style="margin:0;">durant l'annee scolaire <strong>{{school_year}}</strong></p>
    <br/><br/>
    <p style="margin:0;">certificat delivree a la demande de {{patient_request_label}} pour lui servir et faire valoir</p>
    <p style="margin:0;">ce que de droit</p>
</div>
<div style="margin-top:58px;border-top:1px dashed #000;padding-top:10px;text-align:center;font-size:11px;line-height:1.55;font-family:'Times New Roman', Times, serif;font-weight:700;">
    <p style="margin:0;">
        <span style="display:inline-block;width:7px;height:12px;background:#244b22;border-radius:1px;vertical-align:middle;margin-right:6px;"></span>
        {{doctor_phone_template}} /E.mail :{{doctor_email_template}}/ <span style="font-size:12px;vertical-align:middle;">&#9993;</span> : {{doctor_address_template}}
    </p>
    <p style="margin:0;">{{doctor_address_note_template}}</p>
    <p style="margin:0;">***{{clinic_city_template}}***.</p>
</div>
</div>"""),
        ("Compte rendu cardiologique", "rapport", """<div style="text-align:center;margin-bottom:20px">
<h2>{{clinic_name}}</h2>
<p><strong>Dr {{doctor_name}}</strong> - {{doctor_specialty}}</p>
<p>N° Ordre: {{doctor_order_number}}</p>
</div>
<hr/>
<p style="text-align:right">Le {{date_today}}</p>
<h3 style="text-align:center">COMPTE RENDU DE CONSULTATION CARDIOLOGIQUE</h3>
<p><strong>Patient:</strong> {{patient_name}} {{patient_first_name}} | Age: {{patient_age}} ans</p>
<hr/>
<h4>Motif de consultation</h4>
<p>{{diagnosis}}</p>
<h4>Examen clinique</h4>
<p>{{treatment}}</p>
<h4>Conclusion et conduite a tenir</h4>
<p></p>
<br/>
<p style="text-align:right"><em>Dr {{doctor_name}}</em></p>"""),
        ("Lettre d'hospitalisation", "rapport", """<div style="text-align:center;margin-bottom:20px">
<h2>{{clinic_name}}</h2>
<p><strong>Dr {{doctor_name}}</strong> - {{doctor_specialty}}</p>
</div>
<hr/>
<p style="text-align:right">Le {{date_today}}</p>
<h3 style="text-align:center">LETTRE D'HOSPITALISATION</h3>
<p>Cher Confrere,</p>
<p>Je vous adresse <strong>{{patient_name}} {{patient_first_name}}</strong>, age(e) de {{patient_age}} ans, pour prise en charge de:</p>
<br/>
<p>{{diagnosis}}</p>
<br/>
<p>{{treatment}}</p>
<br/>
<p>Merci de bien vouloir prendre en charge ce patient.</p>
<p>Confraternellement,</p>
<p style="text-align:right"><em>Dr {{doctor_name}}</em></p>"""),
        ("Rapport ECG", "rapport", """<div style="text-align:center;margin-bottom:20px">
<h2>{{clinic_name}}</h2>
<p><strong>Dr {{doctor_name}}</strong> - {{doctor_specialty}}</p>
</div>
<hr/>
<p style="text-align:right">Le {{date_today}}</p>
<h3 style="text-align:center">RAPPORT D'ELECTROCARDIOGRAMME</h3>
<p><strong>Patient:</strong> {{patient_name}} {{patient_first_name}} | Age: {{patient_age}} ans</p>
<hr/>
<h4>Interpretation</h4>
<p>{{diagnosis}}</p>
<h4>Conclusion</h4>
<p>{{treatment}}</p>
<br/>
<p style="text-align:right"><em>Dr {{doctor_name}}</em></p>"""),
        ("Rapport echocardiographie", "rapport", """<div style="text-align:center;margin-bottom:20px">
<h2>{{clinic_name}}</h2>
<p><strong>Dr {{doctor_name}}</strong> - {{doctor_specialty}}</p>
</div>
<hr/>
<p style="text-align:right">Le {{date_today}}</p>
<h3 style="text-align:center">RAPPORT D'ECHOCARDIOGRAPHIE</h3>
<p><strong>Patient:</strong> {{patient_name}} {{patient_first_name}} | Age: {{patient_age}} ans</p>
<hr/>
<h4>Resultats</h4>
<p>{{diagnosis}}</p>
<h4>Conclusion</h4>
<p>{{treatment}}</p>
<br/>
<p style="text-align:right"><em>Dr {{doctor_name}}</em></p>"""),
    ]
    variables = json.dumps([
        "doctor_name", "doctor_specialty", "doctor_specialty_lower", "doctor_order_number", "doctor_phone",
        "doctor_email", "doctor_address", "clinic_name", "clinic_logo_data_url", "patient_name",
        "patient_first_name", "patient_age", "patient_birth_date", "date_today", "date_time_short",
        "doctor_template_name", "doctor_specialty_template", "doctor_specialty_label", "patient_name_upper",
        "patient_first_name_upper", "patient_full_name_upper", "patient_subject", "patient_birth_label",
        "patient_request_label", "doctor_phone_template", "doctor_email_template", "doctor_address_template",
        "doctor_address_note_template", "clinic_city_template", "diagnosis", "treatment", "duration",
        "school_year",
    ], ensure_ascii=False)
    for name, category, body in templates:
        existing = conn.execute(
            "SELECT id FROM document_templates WHERE name = ? AND category = ?",
            (name, category),
        ).fetchone()
        if existing:
            conn.execute(
                "UPDATE document_templates SET body_html = ?, variables = ?, updated_at = ? WHERE id = ?",
                (body, variables, now_iso(), existing["id"]),
            )
        else:
            conn.execute(
                "INSERT INTO document_templates (name, category, body_html, variables) VALUES (?, ?, ?, ?)",
                (name, category, body, variables),
            )


def seed_prescription_templates(conn: sqlite3.Connection) -> None:
    """Seed default prescription templates for common cardiology protocols."""
    count = conn.execute("SELECT COUNT(*) AS total FROM prescription_templates").fetchone()["total"]
    if count > 0:
        return
    templates = [
        ("HTA", "cardiologie", [
            {"medicine_name": "BISOPROLOL", "dosage": "5 mg", "frequency": "1 fois/jour le matin", "duration": "3 mois", "instructions": ""},
            {"medicine_name": "AMLODIPINE 5mg", "dosage": "5 mg", "frequency": "1 fois/jour", "duration": "3 mois", "instructions": ""},
            {"medicine_name": "HYDROCHLOROTHIAZIDE 25mg", "dosage": "25 mg", "frequency": "1 fois/jour le matin", "duration": "3 mois", "instructions": "Surveiller kaliemie"},
        ]),
        ("Insuffisance cardiaque", "cardiologie", [
            {"medicine_name": "BISOPROLOL", "dosage": "2.5 mg", "frequency": "1 fois/jour", "duration": "3 mois", "instructions": "Titration progressive"},
            {"medicine_name": "RAMIPRIL 5mg", "dosage": "5 mg", "frequency": "1 fois/jour", "duration": "3 mois", "instructions": "Surveiller creatinine et kaliemie"},
            {"medicine_name": "ALDACTONE", "dosage": "25 mg", "frequency": "1 fois/jour", "duration": "3 mois", "instructions": "Surveiller kaliemie"},
            {"medicine_name": "LASILIX", "dosage": "40 mg", "frequency": "1 fois/jour le matin", "duration": "3 mois", "instructions": "Adapter selon congestion"},
        ]),
        ("Dyslipidemie", "cardiologie", [
            {"medicine_name": "TAHOR 40", "dosage": "40 mg", "frequency": "1 fois/jour le soir", "duration": "3 mois", "instructions": "Surveiller transaminases et CPK"},
        ]),
        ("Anticoagulation ACFA", "cardiologie", [
            {"medicine_name": "XARELTO", "dosage": "20 mg", "frequency": "1 fois/jour au repas", "duration": "Continu", "instructions": "Adapter selon clairance renale"},
        ]),
        ("Post-infarctus", "cardiologie", [
            {"medicine_name": "ASPEGIC 100", "dosage": "100 mg", "frequency": "1 fois/jour", "duration": "Continu", "instructions": ""},
            {"medicine_name": "CLOPIDOGREL 75mg", "dosage": "75 mg", "frequency": "1 fois/jour", "duration": "12 mois", "instructions": "Double antiplaquettaire"},
            {"medicine_name": "BISOPROLOL", "dosage": "5 mg", "frequency": "1 fois/jour", "duration": "Continu", "instructions": "Titration selon FC"},
            {"medicine_name": "RAMIPRIL 5mg", "dosage": "5 mg", "frequency": "1 fois/jour", "duration": "Continu", "instructions": ""},
            {"medicine_name": "TAHOR 40", "dosage": "80 mg", "frequency": "1 fois/jour", "duration": "Continu", "instructions": "Forte intensite"},
        ]),
        ("Arythmie / ACFA", "cardiologie", [
            {"medicine_name": "CORDARONE", "dosage": "200 mg", "frequency": "1 fois/jour", "duration": "Selon protocole", "instructions": "Verifier TSH, foie, ECG"},
            {"medicine_name": "ELIQUIS", "dosage": "5 mg", "frequency": "2 fois/jour", "duration": "Continu", "instructions": "Adapter si age>80, poids<60, creatinine>1.5"},
        ]),
    ]
    for name, category, items in templates:
        conn.execute(
            "INSERT INTO prescription_templates (name, category, items_json) VALUES (?, ?, ?)",
            (name, category, json.dumps(items, ensure_ascii=False)),
        )


def seed_or_refresh_medications(conn: sqlite3.Connection) -> None:
    meds = json.loads((BACKEND / "medications_seed.json").read_text(encoding="utf-8"))
    for med in meds:
        existing = conn.execute("SELECT id FROM medications WHERE name = ?", (med["name"],)).fetchone()
        values = (
            med.get("dci"),
            med.get("class_name"),
            med.get("indication"),
            med.get("dosage") or med.get("default_dose"),
            med.get("default_dose") or med.get("dosage"),
            json.dumps(med.get("contraindications", []), ensure_ascii=False),
            json.dumps(med.get("interactions", []), ensure_ascii=False),
            json.dumps(med.get("warnings", []), ensure_ascii=False),
        )
        if existing:
            conn.execute(
                """
                UPDATE medications
                SET dci=?, class_name=?, indication=?, dosage=?, default_dose=?,
                    contraindications=?, interactions=?, warnings=?
                WHERE name=?
                """,
                (*values, med["name"]),
            )
        else:
            conn.execute(
                """
                INSERT INTO medications
                (name, dci, class_name, indication, dosage, default_dose, contraindications, interactions, warnings)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (med["name"], *values),
            )


def auto_backup_db() -> None:
    """Create a safety backup before any schema migration."""
    if DB_PATH.exists():
        BACKUPS.mkdir(parents=True, exist_ok=True)
        backup_path = BACKUPS / f"pre_migration_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sqlite3"
        shutil.copy2(DB_PATH, backup_path)


def _same_file(left: Path, right: Path) -> bool:
    try:
        return left.resolve() == right.resolve()
    except Exception:
        return False


def _sqlite_count(path: Path, table: str) -> int | None:
    if not path.is_file():
        return None
    try:
        with sqlite3.connect(path) as conn:
            return int(conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0])
    except Exception:
        return None


def _is_demo_patient_database(path: Path) -> bool:
    try:
        with sqlite3.connect(path) as conn:
            rows = conn.execute("SELECT code, nom, prenom FROM patients LIMIT 2").fetchall()
    except Exception:
        return False
    if len(rows) != 1:
        return False
    code, nom, prenom = [(value or "").strip().upper() for value in rows[0]]
    return code == "CARD-0001" or (nom == "BENSALAH" and prenom == "KARIM")


def _seed_database_candidates() -> list[Path]:
    candidates = [
        ROOT / "data" / BOOTSTRAP_DB_NAME,
        Path(sys.executable).resolve().parent / "data" / BOOTSTRAP_DB_NAME,
    ]
    if getattr(sys, "_MEIPASS", None):
        candidates.append(Path(sys._MEIPASS) / "data" / BOOTSTRAP_DB_NAME)

    unique: list[Path] = []
    for candidate in candidates:
        if candidate.is_file() and not _same_file(candidate, DB_PATH) and candidate not in unique:
            unique.append(candidate)
    return unique


def _pick_seed_database() -> Path | None:
    for candidate in _seed_database_candidates():
        patient_count = _sqlite_count(candidate, "patients") or 0
        if patient_count >= BOOTSTRAP_MIN_PATIENTS:
            return candidate
    return None


def _replace_empty_database_from_seed() -> None:
    seed = _pick_seed_database()
    if not seed:
        return

    existing_count = _sqlite_count(DB_PATH, "patients")
    should_replace = False
    if not DB_PATH.exists():
        should_replace = True
    elif existing_count is None:
        should_replace = DB_PATH.stat().st_size < seed.stat().st_size
    elif existing_count == 0:
        should_replace = True
    elif existing_count == 1 and _is_demo_patient_database(DB_PATH):
        should_replace = True

    if not should_replace:
        return

    DATA.mkdir(parents=True, exist_ok=True)
    BACKUPS.mkdir(parents=True, exist_ok=True)
    if DB_PATH.exists():
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = BACKUPS / f"empty_or_demo_db_replaced_{stamp}.sqlite3"
        shutil.copy2(DB_PATH, backup_path)
        for suffix in ("-wal", "-shm"):
            sidecar = DB_PATH.with_name(DB_PATH.name + suffix)
            if sidecar.exists():
                try:
                    sidecar.unlink()
                except OSError:
                    pass
    shutil.copy2(seed, DB_PATH)


def clinic_logo_data_url() -> str:
    logo_path = ROOT / "app-icon.png"
    if not logo_path.exists():
        return ""
    mime_type = mimetypes.guess_type(logo_path.name)[0] or "image/png"
    encoded = base64.b64encode(logo_path.read_bytes()).decode("ascii")
    return f"data:{mime_type};base64,{encoded}"


def current_school_year(reference: datetime | None = None) -> str:
    reference = reference or datetime.now()
    start_year = reference.year if reference.month >= 9 else reference.year - 1
    return f"{start_year}-{start_year + 1}"


def rebuild_medicines_fts(conn: sqlite3.Connection) -> None:
    """Rebuild the FTS5 index for medicines. Safe to run repeatedly."""
    try:
        fts_exists = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='medicines_fts'"
        ).fetchone()
        if not fts_exists:
            return
        conn.execute("INSERT INTO medicines_fts(medicines_fts) VALUES('rebuild')")
    except Exception:
        pass


def rebuild_patients_fts(conn: sqlite3.Connection) -> None:
    """Rebuild the FTS5 index for patients. Safe to run on existing DBs."""
    try:
        fts_exists = conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='patients_fts'"
        ).fetchone()
        if not fts_exists:
            return
        conn.execute("INSERT INTO patients_fts(patients_fts) VALUES('rebuild')")
    except Exception:
        pass


def ensure_patients_fts_triggers(conn: sqlite3.Connection) -> None:
    """Create FTS5 triggers if missing (for existing DBs upgraded from older versions)."""
    for trigger, sql in [
        ("patients_fts_insert", """CREATE TRIGGER IF NOT EXISTS patients_fts_insert
            AFTER INSERT ON patients BEGIN
              INSERT INTO patients_fts(rowid, nom, prenom, telephone, code, adresse)
              VALUES (new.id, new.nom, new.prenom, new.telephone, new.code, new.adresse);
            END"""),
        ("patients_fts_update", """CREATE TRIGGER IF NOT EXISTS patients_fts_update
            AFTER UPDATE ON patients BEGIN
              INSERT INTO patients_fts(patients_fts, rowid, nom, prenom, telephone, code, adresse)
              VALUES ('delete', old.id, old.nom, old.prenom, old.telephone, old.code, old.adresse);
              INSERT INTO patients_fts(rowid, nom, prenom, telephone, code, adresse)
              VALUES (new.id, new.nom, new.prenom, new.telephone, new.code, new.adresse);
            END"""),
        ("patients_fts_delete", """CREATE TRIGGER IF NOT EXISTS patients_fts_delete
            AFTER DELETE ON patients BEGIN
              INSERT INTO patients_fts(patients_fts, rowid, nom, prenom, telephone, code, adresse)
              VALUES ('delete', old.id, old.nom, old.prenom, old.telephone, old.code, old.adresse);
            END"""),
    ]:
        try:
            conn.execute(sql)
        except Exception:
            pass


def seed_bilan_catalog(conn: sqlite3.Connection) -> None:
    """Seed bilan_catalog. Runs only when table is empty (idempotent)."""
    if conn.execute("SELECT COUNT(*) AS c FROM bilan_catalog").fetchone()["c"] > 0:
        return
    catalog = [
        # Biologie
        ("TSH us", "Biologie"),
        ("HbA1c", "Biologie"),
        ("Glycémie à jeun", "Biologie"),
        ("Glycémie post-prandiale", "Biologie"),
        ("Créatininémie", "Biologie"),
        ("Clairance créatinine (MDRD)", "Biologie"),
        ("DFG CKD-EPI / MDRD", "Biologie"),
        ("Uree - Créatininémie", "Biologie"),
        ("FNS (NFS complète)", "Biologie"),
        ("FNS avec taux de plaquettes", "Biologie"),
        ("Taux de réticulocytes", "Biologie"),
        ("Frottis sanguin", "Biologie"),
        ("VS - CRP", "Biologie"),
        ("CRP", "Biologie"),
        ("Facteur rhumatoïde", "Biologie"),
        ("ASLO", "Biologie"),
        ("Ferritinémie", "Biologie"),
        ("Fer sérique", "Biologie"),
        ("Taux de saturation de la transferrine", "Biologie"),
        ("Cholestérol total - HDL - LDL - Triglycérides", "Biologie"),
        ("HDL-Cholestérol", "Biologie"),
        ("LDL-Cholestérol", "Biologie"),
        ("Triglycérides", "Biologie"),
        ("Lipoproteines Lp(a)", "Biologie"),
        ("Troponine", "Biologie"),
        ("Troponine hs-Tc", "Biologie"),
        ("CPK", "Biologie"),
        ("NT-proBNP", "Biologie"),
        ("TP / INR", "Biologie"),
        ("TP / INR URGENT", "Biologie"),
        ("TCK", "Biologie"),
        ("Fibrinogène", "Biologie"),
        ("D-Dimères", "Biologie"),
        ("Microalbuminurie 24h", "Biologie"),
        ("Protéinurie 24h", "Biologie"),
        ("Microalbuminurie sur spot urinaire", "Biologie"),
        ("RAC (Albuminurie/Créatininurie)", "Biologie"),
        ("ECBU + Antibiogramme", "Biologie"),
        ("Ionogramme sanguin", "Biologie"),
        ("Magnésémie", "Biologie"),
        ("Calcémie", "Biologie"),
        ("Phosphorémie", "Biologie"),
        ("Vitamine D (25-OH-D3)", "Biologie"),
        ("Vitamine B12 - Folate B9", "Biologie"),
        ("Acide urique", "Biologie"),
        ("Albuminémie / Protidémie", "Biologie"),
        ("ALAT / ASAT (bilan hépatique)", "Biologie"),
        ("Bilirubine totale/directe/indirecte", "Biologie"),
        ("Phosphatase alcaline", "Biologie"),
        ("PSA totale", "Biologie"),
        ("Cortisolémie 08h matin", "Biologie"),
        ("Cortisol libre urinaire 24h", "Biologie"),
        ("Insulinémie à jeun", "Biologie"),
        ("Indice HOMA-IR", "Biologie"),
        ("IGF-1 sérique", "Biologie"),
        ("Testostérone totale/biodisponible", "Biologie"),
        ("AC anti-TPO", "Biologie"),
        ("Sérologie HBs - HCV - HIV - TPHA", "Biologie"),
        ("Sérologie hépatite A - HBs - HCV", "Biologie"),
        ("Sérologie de Wright", "Biologie"),
        ("Sérologie hydatique", "Biologie"),
        ("IDR à la tuberculine", "Biologie"),
        ("PCR SARS-CoV-2", "Biologie"),
        ("Hémocult des selles", "Biologie"),
        ("Parasitologie des selles", "Biologie"),
        ("Électrophorèse des protéines sériques", "Biologie"),
        ("Électrophorèse protéines urinaires (Bence-Jones)", "Biologie"),
        ("Evaluation lymphocytes T et B", "Biologie"),
        ("Amylasémie", "Biologie"),
        ("Cétoneémie", "Biologie"),
        ("Anti-CCP", "Biologie"),
        ("ACE - alpha-foetoprotéine - CA125", "Biologie"),
        # Radiologie / Imagerie
        ("Échocardiographie Doppler (échocoeur)", "Radiologie"),
        ("ÉchoDoppler vasculaire", "Radiologie"),
        ("ÉchoDoppler artères rénales", "Radiologie"),
        ("ÉchoDoppler troncs supra-aortiques", "Radiologie"),
        ("ÉchoDoppler artériel membres inférieurs", "Radiologie"),
        ("Radiographie thoracique face", "Radiologie"),
        ("Téléthorax de face", "Radiologie"),
        ("TDM thoracique", "Radiologie"),
        ("TDM abdominal", "Radiologie"),
        ("TDM rachis cervical", "Radiologie"),
        ("TDM rachis lombo-sacré", "Radiologie"),
        ("TDM panaortique", "Radiologie"),
        ("TDM cérébral", "Radiologie"),
        ("Angio-TDM pulmonaire", "Radiologie"),
        ("Scanner thoracique", "Radiologie"),
        ("IRM thoracique", "Radiologie"),
        ("Échographie thyroïdienne", "Radiologie"),
        ("Échographie cervicale", "Radiologie"),
        ("Échographie rénale + Doppler artères rénales", "Radiologie"),
        ("Échographie abdominale", "Radiologie"),
        ("Échographie mammaire", "Radiologie"),
        ("Échographie ostéomusculaire épaule", "Radiologie"),
        ("Échographie ostéomusculaire genou gauche", "Radiologie"),
        ("Échographie ostéomusculaire chevilles", "Radiologie"),
        ("Radio rachis cervical", "Radiologie"),
        ("Radio rachis lombo-sacré", "Radiologie"),
        ("Radio des genoux F+P", "Radiologie"),
        ("Radio genou gauche", "Radiologie"),
        ("Radio genou droit", "Radiologie"),
        ("Radio des deux genoux", "Radiologie"),
        ("Radio bassin", "Radiologie"),
        ("Radio bassin + hanche gauche", "Radiologie"),
        ("Radio pied gauche", "Radiologie"),
        ("Radio des pieds droit et gauche", "Radiologie"),
        ("Radio des sinus", "Radiologie"),
        ("Coloscanner", "Radiologie"),
        ("Pelvienne", "Radiologie"),
        # Autre
        ("ECG 12 dérivations", "Autre"),
        ("ECG + Avis cardio", "Autre"),
        ("Holter ECG", "Autre"),
        ("MAPA (mesure ambulatoire PA)", "Autre"),
        ("Épreuve d'effort (ECG effort)", "Autre"),
        ("EFR / Exploration fonctionnelle respiratoire", "Autre"),
        ("ENMG membre supérieur gauche", "Autre"),
        ("ENMG membre supérieur droit", "Autre"),
        ("Fond d'œil", "Autre"),
        ("Examen ophtalmologique + fond d'œil", "Autre"),
        ("EEG", "Autre"),
        ("Consultation spécialisée", "Autre"),
    ]
    for i, (name, cat) in enumerate(catalog):
        conn.execute(
            """INSERT OR IGNORE INTO bilan_catalog (name, category, sort_order) VALUES (?, ?, ?)""",
            (name, cat, i),
        )


def init_db() -> None:
    DATA.mkdir(parents=True, exist_ok=True)
    UPLOADS.mkdir(parents=True, exist_ok=True)
    BACKUPS.mkdir(parents=True, exist_ok=True)
    _replace_empty_database_from_seed()
    auto_backup_db()
    with connect() as conn:
        conn.executescript((BACKEND / "schema.sql").read_text(encoding="utf-8"))
        apply_light_migrations(conn)
        ensure_patients_fts_triggers(conn)
        rebuild_medicines_fts(conn)
        rebuild_patients_fts(conn)
        user_count = conn.execute("SELECT COUNT(*) AS total FROM users").fetchone()["total"]
        if user_count == 0:
            conn.execute(
                "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
                ("admin", hash_password("admin123"), "doctor"),
            )
        seed_or_refresh_medications(conn)
        seed_medicines_db(conn)
        seed_document_templates(conn)
        seed_prescription_templates(conn)
        seed_visit_types(conn)
        seed_bilan_catalog(conn)
        for key, default_val in DEFAULT_SETTINGS.items():
            existing = conn.execute("SELECT key FROM app_settings WHERE key = ?", (key,)).fetchone()
            if not existing:
                conn.execute(
                    "INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)",
                    (key, encrypt_secret(default_val) if key in SECRET_SETTING_KEYS else default_val, now_iso()),
                )
            elif key == "AI_MODEL_NAME":
                current = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
                if current and (current["value"] or "").strip() in {"", "gemini-1.5-flash", "gemini-1.5-pro"}:
                    conn.execute("UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?", (default_val, now_iso(), key))
            elif key in {"DOCTOR_NAME", "GOOGLE_DRIVE_BACKUP_EMAIL"}:
                current = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
                old_doctor_default = key == "DOCTOR_NAME" and (current["value"] or "").strip().lower() == "dr chiali mohammed kamel"
                if current and (not current["value"] or old_doctor_default):
                    conn.execute("UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?", (default_val, now_iso(), key))
            enforce_locked_ai_settings(conn)
        protect_secret_settings(conn)
        sync_ai_settings_snapshot(conn)
        patient_count = conn.execute("SELECT COUNT(*) AS total FROM patients").fetchone()["total"]
        if patient_count == 0:
            token = uuid.uuid4().hex
            conn.execute(
                """
                INSERT INTO patients
                (code, nom, prenom, date_naissance, age, sexe, groupe_sanguin, situation_familiale,
                 adresse, telephone, profession, oriente_par, allergies, maladies, notes_importantes, qr_token)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "CARD-0001",
                    "BENSALAH",
                    "Karim",
                    "1958-03-12",
                    68,
                    "Masculin",
                    "O+",
                    "Marie",
                    "Sidi Bel Abbes",
                    "0550 00 00 00",
                    "Retraite",
                    "Dr Attar",
                    "Aspirine",
                    "HTA, Diabete type 2, ACFA",
                    "Risque hemorragique, verifier INR/creatinine.",
                    token,
                ),
            )


@app.on_event("startup")
def on_startup() -> None:
    init_db()


class LoginIn(BaseModel):
    username: str
    password: str


class PatientIn(BaseModel):
    code: str | None = None
    nom: str
    prenom: str
    date_naissance: str | None = None
    age: int | None = None
    sexe: str | None = None
    groupe_sanguin: str | None = None
    situation_familiale: str | None = None
    adresse: str | None = None
    telephone: str | None = None
    profession: str | None = None
    oriente_par: str | None = None
    allergies: str | None = None
    maladies: str | None = None
    notes_importantes: str | None = None


class VisitIn(BaseModel):
    date_visite: str | None = None
    motif: str | None = None
    histoire: str | None = None
    examens: str | None = None
    diagnostics: str | None = None
    traitements: str | None = None
    tension: str | None = None
    frequence_cardiaque: str | None = None
    glycemie: str | None = None
    poids: str | None = None
    taille: str | None = None
    visit_fee: float = 0
    fee_paid: float = 0
    payment_status: str = "pending"
    visit_type: str | None = None


class PrescriptionIn(BaseModel):
    patient_id: int
    visit_id: int | None = None
    lines: list[str] = PydanticField(default_factory=list)
    doctor_validated: bool = False


class AICheckIn(BaseModel):
    patient_id: int
    medications: list[str] = PydanticField(default_factory=list)
    analyses: str | None = ""


class AppointmentIn(BaseModel):
    patient_id: int | None = None
    title: str
    scheduled_at: str
    status: str = "normal"
    reminder_channel: str = "none"
    reminder_note: str | None = None
    notes: str | None = None


class DocumentNoteIn(BaseModel):
    notes: str | None = ""


class AIAnalyzeIn(BaseModel):
    consent_confirmed: bool = False
    provider: str | None = None
    force_local: bool = False
    re_analyze: bool = False
    analysis_mode: str | None = None


class AIAnalysisEditIn(BaseModel):
    summary: str | None = None
    extracted_json: dict[str, Any] | None = None
    risk_level: str | None = None
    confidence: float | None = None


class ExtractedLabValueIn(BaseModel):
    id: int | None = None
    analyte: str
    value: str | None = ""
    unit: str | None = ""
    reference_range: str | None = ""
    abnormal_flag: str | None = ""


class AISaveLabsIn(BaseModel):
    values: list[ExtractedLabValueIn] = PydanticField(default_factory=list)


class AITestProviderIn(BaseModel):
    provider: str | None = None
    model: str | None = None


class AIChatIn(BaseModel):
    message: str
    conversation_id: int | None = None
    provider: str | None = None
    model: str | None = None
    include_patient_context: bool = True
    analysis_mode: str | None = None
    system_prompt_prefix: str | None = None


class AISettingsUpdateIn(BaseModel):
    settings: dict[str, Any] = PydanticField(default_factory=dict)


class MobileUploadTokenOut(BaseModel):
    url: str
    upload_endpoint: str
    expires_at: str


class CardioProfileIn(BaseModel):
    hypertension: bool = False
    diabetes: bool = False
    smoking: bool = False
    obesity: bool = False
    dyslipidemia: bool = False
    family_history_heart_disease: bool = False
    previous_infarction: bool = False
    previous_stroke: bool = False
    previous_angioplasty: bool = False
    previous_bypass: bool = False
    heart_failure: bool = False
    vascular_disease: bool = False
    abnormal_renal_function: bool = False
    abnormal_liver_function: bool = False
    bleeding_history: bool = False
    labile_inr: bool = False
    alcohol_or_drugs: bool = False
    current_medications: str | None = ""


class VitalSignIn(BaseModel):
    measured_at: str | None = None
    systolic_bp: int | None = None
    diastolic_bp: int | None = None
    heart_rate: int | None = None
    oxygen_saturation: float | None = None
    weight: float | None = None
    height: float | None = None
    notes: str | None = ""


class LabResultIn(BaseModel):
    measured_at: str | None = None
    total_cholesterol: float | None = None
    ldl: float | None = None
    hdl: float | None = None
    triglycerides: float | None = None
    troponin: float | None = None
    bnp: float | None = None
    nt_probnp: float | None = None
    creatinine: float | None = None
    notes: str | None = ""


class ECGRecordIn(BaseModel):
    document_id: int | None = None
    recorded_at: str | None = None
    rhythm: str | None = ""
    heart_rate: int | None = None
    pr_ms: int | None = None
    qrs_ms: int | None = None
    qt_ms: int | None = None
    qtc_ms: int | None = None
    annotations: str | None = ""


class ImagingReportIn(BaseModel):
    document_id: int | None = None
    imaging_type: str
    performed_at: str | None = None
    ejection_fraction: float | None = None
    valve_status: str | None = ""
    wall_motion: str | None = ""
    report: str | None = ""


class CardioDiagnosisIn(BaseModel):
    diagnosis: str
    status: str = "active"
    diagnosed_at: str | None = None
    notes: str | None = ""


class FollowupIn(BaseModel):
    due_at: str
    reason: str
    priority: str = "normal"
    status: str = "open"


@app.get("/api/health")
def health() -> dict[str, Any]:
    with connect() as conn:
        counts = {}
        for table in [
            "patients", "visits", "documents", "medications", "prescriptions", "appointments",
            "cardio_profiles", "vital_signs", "lab_results", "ecg_records", "imaging_reports",
            "cardio_diagnoses", "followups", "mobile_upload_tokens", "audit_log"
        ]:
            counts[table] = conn.execute(f"SELECT COUNT(*) AS total FROM {table}").fetchone()["total"]
    return {"ok": True, "database": str(DB_PATH), "counts": counts}


@app.post("/api/auth/login")
def login(payload: LoginIn) -> dict[str, Any]:
    with connect() as conn:
        user = conn.execute("SELECT * FROM users WHERE username = ?", (payload.username,)).fetchone()
    if not user or user["password_hash"] != hash_password(payload.password):
        raise HTTPException(status_code=401, detail="Identifiants incorrects")
    audit("login", "users", user["id"], "Connexion locale")
    return {"token": f"local-{user['id']}-{uuid.uuid4().hex}", "user": {"id": user["id"], "username": user["username"], "role": user["role"]}}


@app.get("/api/dashboard")
def dashboard() -> dict[str, Any]:
    with connect() as conn:
        counts = {
            "patients": conn.execute("SELECT COUNT(*) AS total FROM patients").fetchone()["total"],
            "visits": conn.execute("SELECT COUNT(*) AS total FROM visits").fetchone()["total"],
            "documents": conn.execute("SELECT COUNT(*) AS total FROM documents").fetchone()["total"],
            "prescriptions": conn.execute("SELECT COUNT(*) AS total FROM prescriptions").fetchone()["total"],
            "appointments": conn.execute("SELECT COUNT(*) AS total FROM appointments").fetchone()["total"],
            "ecg": conn.execute("SELECT COUNT(*) AS total FROM ecg_records").fetchone()["total"],
            "labs": conn.execute("SELECT COUNT(*) AS total FROM lab_results").fetchone()["total"],
            "medications": conn.execute("SELECT COUNT(*) AS total FROM medicines_db").fetchone()["total"],
        }
        latest = rows_to_dicts(conn.execute(
            """
            SELECT v.*, p.nom, p.prenom
            FROM visits v JOIN patients p ON p.id = v.patient_id
            ORDER BY v.date_visite DESC LIMIT 8
            """
        ).fetchall())
        appointments_today = rows_to_dicts(conn.execute(
            """
            SELECT a.*, p.nom, p.prenom
            FROM appointments a
            LEFT JOIN patients p ON p.id = a.patient_id
            WHERE date(a.scheduled_at) = date('now', 'localtime')
            ORDER BY a.status = 'urgent' DESC, a.scheduled_at ASC
            LIMIT 12
            """
        ).fetchall())
        alerts = rows_to_dicts(conn.execute(
            """
            SELECT id, code, nom, prenom, age, allergies, maladies, notes_importantes
            FROM patients
            WHERE COALESCE(notes_importantes, '') <> '' OR COALESCE(allergies, '') <> ''
            ORDER BY updated_at DESC
            LIMIT 8
            """
        ).fetchall())
        cardio_stats = {
            "hta": conn.execute("SELECT COUNT(*) AS total FROM patients p LEFT JOIN cardio_profiles c ON c.patient_id=p.id WHERE c.hypertension=1 OR lower(COALESCE(p.maladies, '')) LIKE '%hta%'").fetchone()["total"],
            "diabete": conn.execute("SELECT COUNT(*) AS total FROM patients p LEFT JOIN cardio_profiles c ON c.patient_id=p.id WHERE c.diabetes=1 OR lower(COALESCE(p.maladies, '')) LIKE '%diab%'").fetchone()["total"],
            "cad": conn.execute("SELECT COUNT(*) AS total FROM cardio_diagnoses WHERE lower(diagnosis) LIKE '%coron%' OR lower(diagnosis) LIKE '%cad%'").fetchone()["total"],
            "hf": conn.execute("SELECT COUNT(*) AS total FROM cardio_diagnoses WHERE lower(diagnosis) LIKE '%heart failure%' OR lower(diagnosis) LIKE '%insuffisance%'").fetchone()["total"],
            "acfa": conn.execute("SELECT COUNT(*) AS total FROM patients p LEFT JOIN cardio_diagnoses d ON d.patient_id=p.id WHERE lower(COALESCE(p.maladies, '')) LIKE '%acfa%' OR lower(COALESCE(p.maladies, '')) LIKE '%aryth%' OR lower(COALESCE(d.diagnosis, '')) LIKE '%arry%' OR lower(COALESCE(d.diagnosis, '')) LIKE '%rythm%'").fetchone()["total"],
            "abnormal_ecg": conn.execute("SELECT COUNT(*) AS total FROM ecg_records WHERE severity IN ('abnormal','critical')").fetchone()["total"],
            "high_risk": conn.execute("SELECT COUNT(*) AS total FROM cardio_profiles WHERE previous_infarction=1 OR previous_stroke=1 OR heart_failure=1 OR vascular_disease=1").fetchone()["total"],
            "urgent_today": conn.execute("SELECT COUNT(*) AS total FROM appointments WHERE status = 'urgent' AND date(scheduled_at) = date('now', 'localtime')").fetchone()["total"],
        }
    return {"counts": counts, "latest": latest, "appointments_today": appointments_today, "alerts": alerts, "cardio_stats": cardio_stats}


def cardio_summary_for_patient(conn: sqlite3.Connection, patient_id: int) -> dict[str, Any]:
    patient = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient introuvable")
    profile = conn.execute("SELECT * FROM cardio_profiles WHERE patient_id = ?", (patient_id,)).fetchone()
    profile_dict = dict(profile) if profile else {"patient_id": patient_id}
    vitals = rows_to_dicts(conn.execute("SELECT * FROM vital_signs WHERE patient_id = ? ORDER BY measured_at DESC, id DESC LIMIT 40", (patient_id,)).fetchall())
    labs = rows_to_dicts(conn.execute("SELECT * FROM lab_results WHERE patient_id = ? ORDER BY measured_at DESC, id DESC LIMIT 40", (patient_id,)).fetchall())
    ecgs = rows_to_dicts(conn.execute("SELECT * FROM ecg_records WHERE patient_id = ? ORDER BY recorded_at DESC, id DESC LIMIT 20", (patient_id,)).fetchall())
    imaging = rows_to_dicts(conn.execute("SELECT * FROM imaging_reports WHERE patient_id = ? ORDER BY performed_at DESC, id DESC LIMIT 20", (patient_id,)).fetchall())
    diagnoses = rows_to_dicts(conn.execute("SELECT * FROM cardio_diagnoses WHERE patient_id = ? ORDER BY diagnosed_at DESC, id DESC LIMIT 40", (patient_id,)).fetchall())
    followups = rows_to_dicts(conn.execute("SELECT * FROM followups WHERE patient_id = ? ORDER BY due_at ASC, id DESC LIMIT 20", (patient_id,)).fetchall())
    scores = calculate_cardio_scores(dict(patient), profile_dict, latest_or_empty(vitals), latest_or_empty(labs))
    alerts: list[dict[str, str]] = []
    latest_vital = latest_or_empty(vitals)
    latest_lab = latest_or_empty(labs)
    if latest_vital.get("systolic_bp") and latest_vital["systolic_bp"] >= 160:
        alerts.append({"level": "danger", "message": "HTA non controlee: PAS >= 160 mmHg."})
    elif latest_vital.get("systolic_bp") and latest_vital["systolic_bp"] >= 140:
        alerts.append({"level": "warning", "message": "Pression arterielle elevee: verifier traitement et observance."})
    if latest_lab.get("troponin") and latest_lab["troponin"] > 0.04:
        alerts.append({"level": "danger", "message": "Troponine elevee: contexte ischemique a evaluer en urgence."})
    if latest_lab.get("bnp") and latest_lab["bnp"] > 400:
        alerts.append({"level": "warning", "message": "BNP eleve: decompensation cardiaque possible."})
    if latest_lab.get("creatinine") and latest_lab["creatinine"] > 1.5:
        alerts.append({"level": "warning", "message": "Creatinine elevee: ajuster traitements renaux sensibles."})
    if ecgs and ecgs[0].get("severity") in {"abnormal", "critical"}:
        alerts.append({"level": "danger" if ecgs[0].get("severity") == "critical" else "warning", "message": "ECG recent anormal: revoir interpretation et conduite."})
    if scores["has_bled"]["value"] >= 3:
        alerts.append({"level": "warning", "message": "HAS-BLED eleve: renforcer surveillance du risque hemorragique."})
    
    # Suggest Cloud AI analysis if available and issues found
    suggestions = []
    if (alerts) and get_setting("CLOUD_AI_URL"):
        suggestions.append("Une analyse approfondie par IA Médicale Cloud est recommandée pour ce profil complexe.")

    return {
        "profile": profile_dict,
        "vitals": vitals,
        "labs": labs,
        "ecgs": ecgs,
        "imaging": imaging,
        "diagnoses": diagnoses,
        "followups": followups,
        "scores": scores,
        "alerts": alerts,
        "suggestions": suggestions,
        "recommendation": "Utiliser l'assistant IA pour une analyse de risque personnalisée." if (alerts) else ""
    }


def calculate_age_from_birthdate(value: str | None) -> int | None:
    text = str(value or "").strip()
    if not text:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            born = datetime.strptime(text[:10], fmt).date()
            today = datetime.now().date()
            age = today.year - born.year - ((today.month, today.day) < (born.month, born.day))
            return age if 0 <= age <= 130 else None
        except ValueError:
            continue
    return None


def normalized_patient_search_terms(search: str) -> list[str]:
    normalized = re.sub(r"\s+", " ", str(search or "").strip().lower())
    return [term for term in normalized.split(" ") if term]


@app.get("/api/patients")
def list_patients(search: str = "", page_size: int = 200, offset: int = 0) -> dict[str, Any]:
    """List patients with FTS5-accelerated search. Default 200 rows for fast initial load."""
    safe_page_size = min(max(int(page_size or 200), 1), 10000)
    safe_offset = max(int(offset or 0), 0)
    term = re.sub(r"\s+", " ", str(search or "").strip())

    with connect() as conn:
        total = conn.execute("SELECT COUNT(*) AS c FROM patients").fetchone()["c"]

        # ── FTS5 fast path ────────────────────────────────────────────────────
        if term:
            try:
                fts_exists = conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table' AND name='patients_fts'"
                ).fetchone()
                if fts_exists:
                    fts_query = " OR ".join(f'"{w}"*' for w in term.split())
                    id_rows = conn.execute(
                        f"""SELECT rowid AS id FROM patients_fts
                            WHERE patients_fts MATCH ?
                            ORDER BY rank LIMIT ? OFFSET ?""",
                        (fts_query, safe_page_size, safe_offset),
                    ).fetchall()
                    ids = [r["id"] for r in id_rows]
                    filtered_total = conn.execute(
                        f"SELECT COUNT(*) AS c FROM patients_fts WHERE patients_fts MATCH ?",
                        (fts_query,),
                    ).fetchone()["c"]
                    if ids:
                        placeholders = ",".join("?" * len(ids))
                        rows = rows_to_dicts(conn.execute(
                            f"""SELECT p.*, COUNT(v.id) AS visit_count, MAX(v.date_visite) AS last_visit
                                FROM patients p LEFT JOIN visits v ON v.patient_id = p.id
                                WHERE p.id IN ({placeholders})
                                GROUP BY p.id ORDER BY p.updated_at DESC, p.id DESC""",
                            ids,
                        ).fetchall())
                        return {"rows": rows, "total": total, "filtered_total": filtered_total,
                                "page_size": safe_page_size, "offset": safe_offset,
                                "has_more": safe_offset + len(rows) < filtered_total, "engine": "fts5"}
            except Exception:
                pass  # fall through to LIKE

        # ── LIKE fallback ─────────────────────────────────────────────────────
        terms = normalized_patient_search_terms(term)
        where_sql = "1 = 1"
        where_params: list[Any] = []
        if terms:
            clauses: list[str] = []
            for t in terms:
                like = f"%{t}%"
                digit_t = re.sub(r"\D+", "", t)
                clauses.append(
                    "(lower(coalesce(p.nom,'')) LIKE ? OR lower(coalesce(p.prenom,'')) LIKE ?"
                    " OR lower(coalesce(p.code,'')) LIKE ? OR lower(coalesce(p.telephone,'')) LIKE ?"
                    " OR lower(coalesce(p.adresse,'')) LIKE ?"
                    " OR lower(trim(coalesce(p.nom,'')||' '||coalesce(p.prenom,''))) LIKE ?"
                    " OR lower(trim(coalesce(p.prenom,'')||' '||coalesce(p.nom,''))) LIKE ?)"
                )
                where_params.extend([like, like, like, like, like, like, like])
            where_sql = " AND ".join(clauses)
        phrase_like = f"%{term.lower()}%" if term else "%"
        rows = rows_to_dicts(conn.execute(
            f"""SELECT p.*, COUNT(v.id) AS visit_count, MAX(v.date_visite) AS last_visit
                FROM patients p LEFT JOIN visits v ON v.patient_id = p.id
                WHERE {where_sql}
                GROUP BY p.id
                ORDER BY
                  CASE WHEN lower(trim(coalesce(p.nom,'')||' '||coalesce(p.prenom,''))) LIKE ? THEN 0
                       WHEN lower(coalesce(p.nom,'')) LIKE ? OR lower(coalesce(p.prenom,'')) LIKE ? THEN 1
                       ELSE 2 END,
                  p.updated_at DESC, p.id DESC
                LIMIT ? OFFSET ?""",
            (*where_params, phrase_like, phrase_like, phrase_like, safe_page_size, safe_offset),
        ).fetchall())
        filtered_total = conn.execute(
            f"SELECT COUNT(*) AS c FROM patients p WHERE {where_sql}", where_params
        ).fetchone()["c"]

    return {
        "rows": rows,
        "total": total,
        "filtered_total": filtered_total,
        "page_size": safe_page_size,
        "offset": safe_offset,
        "has_more": safe_offset + len(rows) < filtered_total,
        "engine": "like",
    }


@app.get("/api/doctor-profile")
def get_doctor_profile() -> dict[str, Any]:
    """Return the current doctor/clinic info from settings — used to auto-fill all document headers."""
    with connect() as conn:
        rows = conn.execute("SELECT key, value FROM app_settings").fetchall()
    s = {r["key"]: r["value"] for r in rows}
    return {
        "name": s.get("DOCTOR_NAME", ""),
        "specialty": s.get("DOCTOR_SPECIALTY", ""),
        "order_number": s.get("DOCTOR_ORDER_NUMBER", ""),
        "phone": s.get("DOCTOR_PHONE", "") or s.get("CABINET_PHONE", ""),
        "email": s.get("DOCTOR_EMAIL", ""),
        "address": s.get("DOCTOR_ADDRESS", "") or s.get("CABINET_ADDRESS", ""),
        "clinic_name": s.get("CLINIC_NAME", "") or s.get("CABINET_NAME", ""),
        "clinic_city": s.get("CLINIC_CITY", ""),
        "logo_b64": s.get("DOCTOR_LOGO_B64", ""),
    }


@app.post("/api/patients", status_code=201)
def create_patient(payload: PatientIn) -> dict[str, Any]:
    token = uuid.uuid4().hex
    code = payload.code or f"CARD-{datetime.now().strftime('%y%m%d')}-{token[:4].upper()}"
    calculated_age = calculate_age_from_birthdate(payload.date_naissance)
    age = calculated_age if calculated_age is not None else payload.age
    with connect() as conn:
        # Guard: manual code must not already exist
        if payload.code:
            existing_code = conn.execute("SELECT id FROM patients WHERE code = ? LIMIT 1", (payload.code,)).fetchone()
            if existing_code:
                raise HTTPException(
                    status_code=409,
                    detail={
                        "message": f"Le code patient '{payload.code}' est déjà utilisé.",
                        "existing_patient_id": existing_code["id"],
                    },
                )
        duplicates = conn.execute(
            """
            SELECT id, code, nom, prenom, date_naissance
            FROM patients
            WHERE lower(trim(nom)) = lower(trim(?))
              AND lower(trim(prenom)) = lower(trim(?))
            ORDER BY updated_at DESC, id DESC
            LIMIT 5
            """,
            (payload.nom, payload.prenom),
        ).fetchall()
        if duplicates:
            match = duplicates[0]
            display = f"{match['nom']} {match['prenom']}"
            if match["date_naissance"]:
                display = f"{display} ({match['date_naissance'][:10]})"
            raise HTTPException(
                status_code=409,
                detail={
                    "message": f"Ce patient existe deja dans la base: {display}. Ouvrez le dossier existant pour eviter un doublon.",
                    "existing_patient_id": match["id"],
                    "existing_patient_code": match["code"],
                    "existing_patient_label": display,
                },
            )
        cur = conn.execute(
            """
            INSERT INTO patients
            (code, nom, prenom, date_naissance, age, sexe, groupe_sanguin, situation_familiale,
             adresse, telephone, profession, oriente_par, allergies, maladies, notes_importantes, qr_token)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                code,
                payload.nom,
                payload.prenom,
                payload.date_naissance,
                age,
                payload.sexe,
                payload.groupe_sanguin,
                payload.situation_familiale,
                payload.adresse,
                payload.telephone,
                payload.profession,
                payload.oriente_par,
                payload.allergies,
                payload.maladies,
                payload.notes_importantes,
                token,
            ),
        )
        patient_id = cur.lastrowid
    audit("create", "patients", patient_id, f"Creation patient {code}")
    return {"id": patient_id, "qr_token": token}


@app.get("/api/patients/{patient_id}")
def get_patient(patient_id: int) -> dict[str, Any]:
    with connect() as conn:
        patient = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        visits = rows_to_dicts(conn.execute("SELECT * FROM visits WHERE patient_id = ? ORDER BY date_visite DESC", (patient_id,)).fetchall())
        documents = rows_to_dicts(conn.execute("SELECT * FROM documents WHERE patient_id = ? ORDER BY uploaded_at DESC", (patient_id,)).fetchall())
        prescriptions = rows_to_dicts(conn.execute("SELECT * FROM prescriptions WHERE patient_id = ? ORDER BY created_at DESC", (patient_id,)).fetchall())
        appointments = rows_to_dicts(conn.execute("SELECT * FROM appointments WHERE patient_id = ? ORDER BY scheduled_at DESC", (patient_id,)).fetchall())
        cardio = cardio_summary_for_patient(conn, patient_id)
    return {"patient": dict(patient), "visits": visits, "documents": documents, "prescriptions": prescriptions, "appointments": appointments, "cardio": cardio}


@app.get("/api/patients/{patient_id}/risk-scan")
def patient_risk_scan(patient_id: int) -> dict[str, Any]:
    with connect() as conn:
        patient = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        cardio = cardio_summary_for_patient(conn, patient_id)
        recent_documents = rows_to_dicts(
            conn.execute(
                """
                SELECT d.id, d.type_document, d.uploaded_at, a.status, a.summary, a.risk_level 
                FROM documents d
                LEFT JOIN ai_document_analyses a ON a.document_id = d.id
                WHERE d.patient_id = ? 
                ORDER BY d.uploaded_at DESC, d.id DESC LIMIT 8
                """,
                (patient_id,),
            ).fetchall()
        )
    scores = cardio["scores"]
    alerts = list(cardio["alerts"])
    has_danger = any(alert.get("level") == "danger" for alert in alerts)
    has_warning = any(alert.get("level") == "warning" for alert in alerts)
    overall_risk = "high"
    if not has_danger and (has_warning or scores["has_bled"]["value"] >= 2 or scores["cha2ds2_vasc"]["value"] >= 2):
        overall_risk = "moderate"
    if not has_danger and not has_warning and scores["has_bled"]["value"] <= 1 and scores["cha2ds2_vasc"]["value"] <= 1:
        overall_risk = "low"
    recommendations: list[str] = []
    if scores["cha2ds2_vasc"]["value"] >= 2:
        recommendations.append("Evaluer le risque thromboembolique et la prevention adaptee.")
    if scores["has_bled"]["value"] >= 3:
        recommendations.append("Revoir le risque hemorragique, la TA et les traitements a risque.")
    if has_danger:
        recommendations.append("Priorite clinique elevee: revue medicale rapide recommandee.")
    if not recommendations:
        recommendations.append("Poursuivre la surveillance locale et actualiser les donnees manquantes.")
    summary = (
        f"Risque {overall_risk} pour {patient['nom']} {patient['prenom']}. "
        f"CHA2DS2-VASc={scores['cha2ds2_vasc']['value']}, HAS-BLED={scores['has_bled']['value']}, ASCVD={scores['ascvd_10y']['value']}. "
        f"Alertes actives: {len(alerts)}."
    )
    return {
        "patient": {"id": patient["id"], "nom": patient["nom"], "prenom": patient["prenom"], "age": patient["age"], "sexe": patient["sexe"], "allergies": patient["allergies"], "maladies": patient["maladies"]},
        "cardio": cardio,
        "recent_documents": recent_documents,
        "overall_risk": overall_risk,
        "summary": summary,
        "alerts": alerts,
        "recommendations": recommendations,
        "disclaimer": cardio["scores"].get("disclaimer") or "Calcul local d'aide a la decision. Verifier les criteres, les unites et le contexte avant toute decision clinique.",
    }


@app.put("/api/patients/{patient_id}")
def update_patient(patient_id: int, payload: PatientIn) -> dict[str, Any]:
    calculated_age = calculate_age_from_birthdate(payload.date_naissance)
    age = calculated_age if calculated_age is not None else payload.age
    with connect() as conn:
        exists = conn.execute("SELECT id FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        if payload.code:
            dup = conn.execute("SELECT id FROM patients WHERE code = ? AND id != ? LIMIT 1", (payload.code, patient_id)).fetchone()
            if dup:
                raise HTTPException(
                    status_code=409,
                    detail={"message": f"Le code patient '{payload.code}' est déjà utilisé par un autre dossier.", "existing_patient_id": dup["id"]},
                )
        conn.execute(
            """
            UPDATE patients SET
            code=?, nom=?, prenom=?, date_naissance=?, age=?, sexe=?, groupe_sanguin=?,
            situation_familiale=?, adresse=?, telephone=?, profession=?, oriente_par=?,
            allergies=?, maladies=?, notes_importantes=?, updated_at=?
            WHERE id=?
            """,
            (
                payload.code,
                payload.nom,
                payload.prenom,
                payload.date_naissance,
                age,
                payload.sexe,
                payload.groupe_sanguin,
                payload.situation_familiale,
                payload.adresse,
                payload.telephone,
                payload.profession,
                payload.oriente_par,
                payload.allergies,
                payload.maladies,
                payload.notes_importantes,
                now_iso(),
                patient_id,
            ),
        )
    audit("update", "patients", patient_id, "Modification dossier patient")
    return {"ok": True}


@app.delete("/api/patients/{patient_id}")
def delete_patient(patient_id: int) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT id, nom, prenom FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        patient_name = f"{row['nom'] or ''} {row['prenom'] or ''}".strip()
        # Explicitly clean up related data (belt+suspenders beyond CASCADE)
        conn.execute("DELETE FROM old_patient_links WHERE patient_id = ?", (patient_id,))
        conn.execute("DELETE FROM old_record_links WHERE medismart_table='patients' AND medismart_id = ?", (patient_id,))
        conn.execute("DELETE FROM patient_specialty_data WHERE patient_id = ?", (patient_id,))
        conn.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
        conn.commit()
    audit("delete", "patients", patient_id, f"Suppression dossier: {patient_name}")
    return {"ok": True, "deleted_id": patient_id, "name": patient_name}


@app.post("/api/patients/{patient_id}/visits", status_code=201)
def create_visit(patient_id: int, payload: VisitIn) -> dict[str, Any]:
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO visits
            (patient_id, date_visite, motif, histoire, examens, diagnostics, traitements,
             tension, frequence_cardiaque, glycemie, poids, taille,
             visit_fee, fee_paid, payment_status, visit_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_id,
                payload.date_visite or now_iso(),
                payload.motif,
                payload.histoire,
                payload.examens,
                payload.diagnostics,
                payload.traitements,
                payload.tension,
                payload.frequence_cardiaque,
                payload.glycemie,
                payload.poids,
                payload.taille,
                payload.visit_fee,
                payload.fee_paid,
                payload.payment_status if payload.fee_paid >= payload.visit_fee and payload.visit_fee > 0 else ("partial" if payload.fee_paid > 0 else "pending"),
                payload.visit_type,
            ),
        )
        visit_id = cur.lastrowid
    audit("create", "visits", visit_id, f"Visite patient {patient_id}")
    return {"id": visit_id}


@app.get("/api/patients/{patient_id}/cardio")
def get_cardio(patient_id: int) -> dict[str, Any]:
    with connect() as conn:
        return cardio_summary_for_patient(conn, patient_id)


@app.put("/api/patients/{patient_id}/cardio-profile")
def upsert_cardio_profile(patient_id: int, payload: CardioProfileIn) -> dict[str, Any]:
    with connect() as conn:
        exists = conn.execute("SELECT id FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        conn.execute(
            """
            INSERT INTO cardio_profiles
            (patient_id, hypertension, diabetes, smoking, obesity, dyslipidemia, family_history_heart_disease,
             previous_infarction, previous_stroke, previous_angioplasty, previous_bypass, heart_failure,
             vascular_disease, abnormal_renal_function, abnormal_liver_function, bleeding_history, labile_inr,
             alcohol_or_drugs, current_medications, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(patient_id) DO UPDATE SET
              hypertension=excluded.hypertension, diabetes=excluded.diabetes, smoking=excluded.smoking,
              obesity=excluded.obesity, dyslipidemia=excluded.dyslipidemia,
              family_history_heart_disease=excluded.family_history_heart_disease,
              previous_infarction=excluded.previous_infarction, previous_stroke=excluded.previous_stroke,
              previous_angioplasty=excluded.previous_angioplasty, previous_bypass=excluded.previous_bypass,
              heart_failure=excluded.heart_failure, vascular_disease=excluded.vascular_disease,
              abnormal_renal_function=excluded.abnormal_renal_function, abnormal_liver_function=excluded.abnormal_liver_function,
              bleeding_history=excluded.bleeding_history, labile_inr=excluded.labile_inr,
              alcohol_or_drugs=excluded.alcohol_or_drugs, current_medications=excluded.current_medications,
              updated_at=excluded.updated_at
            """,
            (
                patient_id, int_bool(payload.hypertension), int_bool(payload.diabetes), int_bool(payload.smoking),
                int_bool(payload.obesity), int_bool(payload.dyslipidemia), int_bool(payload.family_history_heart_disease),
                int_bool(payload.previous_infarction), int_bool(payload.previous_stroke), int_bool(payload.previous_angioplasty),
                int_bool(payload.previous_bypass), int_bool(payload.heart_failure), int_bool(payload.vascular_disease),
                int_bool(payload.abnormal_renal_function), int_bool(payload.abnormal_liver_function), int_bool(payload.bleeding_history),
                int_bool(payload.labile_inr), int_bool(payload.alcohol_or_drugs), payload.current_medications, now_iso(),
            ),
        )
    audit("update", "cardio_profiles", patient_id, "Profil cardio")
    return {"ok": True}


@app.post("/api/patients/{patient_id}/vitals", status_code=201)
def add_vitals(patient_id: int, payload: VitalSignIn) -> dict[str, Any]:
    bmi = calculate_bmi(payload.weight, payload.height)
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO vital_signs
            (patient_id, measured_at, systolic_bp, diastolic_bp, heart_rate, oxygen_saturation, weight, height, bmi, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_id, payload.measured_at or now_iso(), payload.systolic_bp, payload.diastolic_bp,
                payload.heart_rate, payload.oxygen_saturation, payload.weight, payload.height, bmi, payload.notes,
            ),
        )
        vital_id = cur.lastrowid
    audit("create", "vital_signs", vital_id, f"Constantes cardio patient {patient_id}")
    return {"id": vital_id, "bmi": bmi}


@app.post("/api/patients/{patient_id}/labs", status_code=201)
def add_labs(patient_id: int, payload: LabResultIn) -> dict[str, Any]:
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO lab_results
            (patient_id, measured_at, total_cholesterol, ldl, hdl, triglycerides, troponin, bnp, nt_probnp, creatinine, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_id, payload.measured_at or now_iso(), payload.total_cholesterol, payload.ldl, payload.hdl,
                payload.triglycerides, payload.troponin, payload.bnp, payload.nt_probnp, payload.creatinine, payload.notes,
            ),
        )
        lab_id = cur.lastrowid
    audit("create", "lab_results", lab_id, f"Biologie cardio patient {patient_id}")
    return {"id": lab_id}


@app.post("/api/patients/{patient_id}/ecg", status_code=201)
def add_ecg(patient_id: int, payload: ECGRecordIn) -> dict[str, Any]:
    findings, severity = estimate_ecg(payload)
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO ecg_records
            (patient_id, document_id, recorded_at, rhythm, heart_rate, pr_ms, qrs_ms, qt_ms, qtc_ms, annotations, ai_findings, severity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_id, payload.document_id, payload.recorded_at or now_iso(), payload.rhythm, payload.heart_rate,
                payload.pr_ms, payload.qrs_ms, payload.qt_ms, payload.qtc_ms, payload.annotations,
                json.dumps(findings, ensure_ascii=False), severity,
            ),
        )
        ecg_id = cur.lastrowid
    audit("create", "ecg_records", ecg_id, f"ECG patient {patient_id}")
    return {"id": ecg_id, "findings": findings, "severity": severity}


@app.post("/api/patients/{patient_id}/imaging", status_code=201)
def add_imaging(patient_id: int, payload: ImagingReportIn) -> dict[str, Any]:
    severity = "critical" if payload.ejection_fraction is not None and payload.ejection_fraction < 35 else "abnormal" if payload.ejection_fraction is not None and payload.ejection_fraction < 50 else "normal"
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO imaging_reports
            (patient_id, document_id, imaging_type, performed_at, ejection_fraction, valve_status, wall_motion, report, severity)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_id, payload.document_id, payload.imaging_type, payload.performed_at or now_iso(),
                payload.ejection_fraction, payload.valve_status, payload.wall_motion, payload.report, severity,
            ),
        )
        imaging_id = cur.lastrowid
    audit("create", "imaging_reports", imaging_id, f"Imagerie {payload.imaging_type}")
    return {"id": imaging_id, "severity": severity}


@app.post("/api/patients/{patient_id}/diagnoses", status_code=201)
def add_diagnosis(patient_id: int, payload: CardioDiagnosisIn) -> dict[str, Any]:
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO cardio_diagnoses (patient_id, diagnosis, status, diagnosed_at, notes)
            VALUES (?, ?, ?, ?, ?)
            """,
            (patient_id, payload.diagnosis, payload.status, payload.diagnosed_at or now_iso(), payload.notes),
        )
        diagnosis_id = cur.lastrowid
    audit("create", "cardio_diagnoses", diagnosis_id, payload.diagnosis)
    return {"id": diagnosis_id}


@app.post("/api/patients/{patient_id}/followups", status_code=201)
def add_followup(patient_id: int, payload: FollowupIn) -> dict[str, Any]:
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO followups (patient_id, due_at, reason, priority, status)
            VALUES (?, ?, ?, ?, ?)
            """,
            (patient_id, payload.due_at, payload.reason, payload.priority, payload.status),
        )
        followup_id = cur.lastrowid
    audit("create", "followups", followup_id, payload.reason)
    return {"id": followup_id}


@app.post("/api/patients/{patient_id}/followups/auto", status_code=201)
def auto_followup(patient_id: int) -> dict[str, Any]:
    with connect() as conn:
        summary = cardio_summary_for_patient(conn, patient_id)
        days = 30
        priority = "normal"
        reason = "Controle cardiologie programme"
        if any(alert["level"] == "danger" for alert in summary["alerts"]):
            days = 7
            priority = "urgent"
            reason = "Controle rapproche: alerte cardio"
        elif summary["alerts"]:
            days = 14
            priority = "high"
            reason = "Controle cardio: surveillance alerte"
        due_at = (datetime.now() + timedelta(days=days)).strftime("%Y-%m-%d %H:%M")
        cur = conn.execute(
            "INSERT INTO followups (patient_id, due_at, reason, priority, status) VALUES (?, ?, ?, ?, 'open')",
            (patient_id, due_at, reason, priority),
        )
        followup_id = cur.lastrowid
    audit("create", "followups", followup_id, "Suivi automatique cardio")
    return {"id": followup_id, "due_at": due_at, "priority": priority, "reason": reason}


@app.get("/api/medications")
def medications(search: str = "") -> dict[str, Any]:
    like = f"%{search.strip()}%"
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            """
            SELECT * FROM medications
            WHERE ? = '%%' OR name LIKE ? OR dci LIKE ? OR class_name LIKE ?
            ORDER BY name LIMIT 80
            """,
            (like, like, like, like),
        ).fetchall())
    return {"rows": rows}


def split_terms(value: str | None) -> set[str]:
    if not value:
        return set()
    normalized = value.lower().replace(";", ",").replace("\n", ",")
    return {part.strip() for part in normalized.split(",") if part.strip()}


def int_bool(value: Any) -> int:
    return 1 if bool(value) else 0


def parse_bp(value: str | None) -> tuple[int | None, int | None]:
    if not value:
        return None, None
    cleaned = value.replace("\\", "/").replace("-", "/")
    parts = [part.strip() for part in cleaned.split("/") if part.strip()]
    numbers: list[int] = []
    for part in parts[:2]:
        digits = "".join(ch for ch in part if ch.isdigit())
        if digits:
            numbers.append(int(digits))
    if len(numbers) == 2:
        low, high = min(numbers), max(numbers)
        if high < 30:
            high *= 10
        if low < 30:
            low *= 10
        return high, low
    return None, None


def calculate_bmi(weight: float | None, height: float | None) -> float | None:
    if not weight or not height:
        return None
    height_m = height / 100 if height > 3 else height
    if height_m <= 0:
        return None
    return round(weight / (height_m * height_m), 1)


def latest_or_empty(rows: list[dict[str, Any]]) -> dict[str, Any]:
    return rows[0] if rows else {}


def estimate_ecg(payload: ECGRecordIn) -> tuple[list[dict[str, str]], str]:
    findings: list[dict[str, str]] = []
    severity = "normal"
    rhythm = (payload.rhythm or "").lower()
    if "af" in rhythm or "acfa" in rhythm or "fibrillation" in rhythm or "aryth" in rhythm:
        findings.append({"level": "danger", "message": "Rythme compatible avec arythmie/ACFA a confirmer par le cardiologue."})
        severity = "abnormal"
    if payload.heart_rate:
        if payload.heart_rate >= 120:
            findings.append({"level": "warning", "message": "Tachycardie detectee par frequence cardiaque."})
            severity = "abnormal"
        elif payload.heart_rate <= 50:
            findings.append({"level": "warning", "message": "Bradycardie detectee par frequence cardiaque."})
            severity = "abnormal"
    if payload.qtc_ms and payload.qtc_ms >= 500:
        findings.append({"level": "danger", "message": "QTc >= 500 ms: risque de QT long, verifier medicaments et electrolytes."})
        severity = "critical"
    elif payload.qtc_ms and payload.qtc_ms >= 470:
        findings.append({"level": "warning", "message": "QTc prolonge possible: controle ECG et contexte clinique."})
        severity = "abnormal"
    if not findings:
        findings.append({"level": "ok", "message": "Aucune alerte ECG simple detectee dans les champs saisis."})
    return findings, severity


def calculate_cardio_scores(patient: dict[str, Any], profile: dict[str, Any], latest_vital: dict[str, Any], latest_lab: dict[str, Any]) -> dict[str, Any]:
    age = int(patient.get("age") or 0)
    sex = (patient.get("sexe") or "").lower()
    female = "fem" in sex
    sbp = int(latest_vital.get("systolic_bp") or 0)
    total_chol = float(latest_lab.get("total_cholesterol") or 0)
    hdl = float(latest_lab.get("hdl") or 0)
    diabetes = bool(profile.get("diabetes"))
    smoking = bool(profile.get("smoking"))
    hypertension = bool(profile.get("hypertension")) or sbp >= 140

    cha = 0
    cha += 1 if profile.get("heart_failure") else 0
    cha += 1 if hypertension else 0
    cha += 2 if age >= 75 else 1 if age >= 65 else 0
    cha += 1 if diabetes else 0
    cha += 2 if profile.get("previous_stroke") else 0
    vascular = bool(profile.get("vascular_disease") or profile.get("previous_infarction") or profile.get("previous_angioplasty") or profile.get("previous_bypass"))
    cha += 1 if vascular else 0
    cha += 1 if female else 0

    has_bled = 0
    has_bled += 1 if sbp >= 160 or hypertension else 0
    has_bled += 1 if profile.get("abnormal_renal_function") else 0
    has_bled += 1 if profile.get("abnormal_liver_function") else 0
    has_bled += 1 if profile.get("previous_stroke") else 0
    has_bled += 1 if profile.get("bleeding_history") else 0
    has_bled += 1 if profile.get("labile_inr") else 0
    has_bled += 1 if age > 65 else 0
    has_bled += 1 if profile.get("alcohol_or_drugs") else 0

    framingham = None
    if 30 <= age <= 74 and sbp and total_chol and hdl:
        ln_age = math.log(age)
        ln_tc = math.log(total_chol)
        ln_hdl = math.log(hdl)
        ln_sbp = math.log(sbp)
        if female:
            beta_sum = 2.32888 * ln_age + 1.20904 * ln_tc - 0.70833 * ln_hdl + (2.82263 if hypertension else 2.76157) * ln_sbp + 0.52873 * int_bool(smoking) + 0.69154 * int_bool(diabetes)
            framingham = round((1 - math.pow(0.95012, math.exp(beta_sum - 26.1931))) * 100, 1)
        else:
            beta_sum = 3.06117 * ln_age + 1.12370 * ln_tc - 0.93263 * ln_hdl + (1.99881 if hypertension else 1.93303) * ln_sbp + 0.65451 * int_bool(smoking) + 0.57367 * int_bool(diabetes)
            framingham = round((1 - math.pow(0.88936, math.exp(beta_sum - 23.9802))) * 100, 1)

    ascvd = None
    if 40 <= age <= 79 and sbp and total_chol and hdl:
        ln_age = math.log(age)
        ln_tc = math.log(total_chol)
        ln_hdl = math.log(hdl)
        ln_sbp = math.log(sbp)
        if female:
            beta_sum = (
                -29.799 * ln_age + 4.884 * ln_age * ln_age + 13.54 * ln_tc - 3.114 * ln_age * ln_tc
                - 13.578 * ln_hdl + 3.149 * ln_age * ln_hdl + (2.019 if hypertension else 1.957) * ln_sbp
                + 7.574 * int_bool(smoking) - 1.665 * ln_age * int_bool(smoking) + 0.661 * int_bool(diabetes)
            )
            ascvd = round((1 - math.pow(0.9665, math.exp(beta_sum - (-29.18)))) * 100, 1)
        else:
            beta_sum = (
                12.344 * ln_age + 11.853 * ln_tc - 2.664 * ln_age * ln_tc - 7.99 * ln_hdl
                + 1.769 * ln_age * ln_hdl + (1.797 if hypertension else 1.764) * ln_sbp
                + 7.837 * int_bool(smoking) - 1.795 * ln_age * int_bool(smoking) + 0.658 * int_bool(diabetes)
            )
            ascvd = round((1 - math.pow(0.9144, math.exp(beta_sum - 61.18))) * 100, 1)

    return {
        "cha2ds2_vasc": {"value": cha, "level": "high" if cha >= 2 else "moderate" if cha == 1 else "low"},
        "has_bled": {"value": has_bled, "level": "high" if has_bled >= 3 else "moderate" if has_bled == 2 else "low"},
        "framingham_10y": {"value": framingham, "level": "high" if framingham and framingham >= 20 else "moderate" if framingham and framingham >= 10 else "low" if framingham is not None else "missing"},
        "ascvd_10y": {"value": ascvd, "level": "high" if ascvd and ascvd >= 20 else "intermediate" if ascvd and ascvd >= 7.5 else "borderline" if ascvd and ascvd >= 5 else "low" if ascvd is not None else "missing"},
        "inputs": {"age": age, "sex": patient.get("sexe"), "sbp": sbp or None, "total_cholesterol": total_chol or None, "hdl": hdl or None, "diabetes": diabetes, "smoking": smoking, "treated_hypertension": hypertension},
        "disclaimer": "Calcul local d'aide a la decision. Verifier les criteres, les unites et le contexte avant toute decision clinique.",
    }


def find_medication(meds: list[dict[str, Any]], raw_name: str) -> dict[str, Any] | None:
    target = raw_name.lower().strip()
    return next(
        (
            item for item in meds
            if item["name"].lower() in target
            or target in item["name"].lower()
            or ((item.get("dci") or "").lower() and (item.get("dci") or "").lower() in target)
            or ((item.get("dci") or "").lower() and target in (item.get("dci") or "").lower())
        ),
        None,
    )


@app.post("/api/ai/cardio-check")
def cardio_check(payload: AICheckIn) -> dict[str, Any]:
    with connect() as conn:
        patient = conn.execute("SELECT * FROM patients WHERE id = ?", (payload.patient_id,)).fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        meds = rows_to_dicts(conn.execute("SELECT * FROM medications").fetchall())
        cardio = cardio_summary_for_patient(conn, payload.patient_id)

    allergies = split_terms(patient["allergies"])
    diseases = split_terms(patient["maladies"])
    profile = cardio["profile"]
    latest_lab = latest_or_empty(cardio["labs"])
    requested = [item.lower().strip() for item in payload.medications if item.strip()]
    warnings: list[dict[str, str]] = []
    suggestions: list[str] = []

    for med_name in requested:
        med = find_medication(meds, med_name)
        if not med:
            warnings.append({"level": "info", "message": f"{med_name}: medicament absent du dataset local."})
            continue
        contraindications = json.loads(med["contraindications"] or "[]")
        interactions = json.loads(med["interactions"] or "[]")
        med_label = med["name"]
        for allergy in allergies:
            contra_text = " ".join(contraindications).lower()
            if allergy and (allergy in med_label.lower() or allergy in (med["dci"] or "").lower() or allergy in contra_text):
                warnings.append({"level": "danger", "message": f"{med_label}: allergie potentielle signalee ({allergy})."})
        for disease in diseases:
            if any(disease in item.lower() or item.lower() in disease for item in contraindications):
                warnings.append({"level": "danger", "message": f"{med_label}: contre-indication possible avec {disease}."})
        for other in requested:
            if other != med_name and any(other in item.lower() or item.lower() in other for item in interactions):
                warnings.append({"level": "warning", "message": f"{med_label}: interaction possible avec {other}."})
        for warning in json.loads(med["warnings"] or "[]"):
            warnings.append({"level": "info", "message": f"{med_label}: {warning}"})

    if patient["age"] and patient["age"] >= 75:
        warnings.append({"level": "warning", "message": "Age >= 75 ans: verifier fonction renale, dose et risque hemorragique."})
    if patient["sexe"] and "fem" in patient["sexe"].lower() and (patient["age"] or 0) < 50:
        warnings.append({"level": "info", "message": "Patiente en age potentiel de grossesse: confirmer statut avant statine/AVK/ARA2."})
    if payload.analyses and "creatinine" in payload.analyses.lower():
        warnings.append({"level": "info", "message": "Analyse creatinine detectee: interpreter clairance avant anticoagulants/IEC/ARA2."})
    if latest_lab.get("creatinine") and latest_lab["creatinine"] > 1.5:
        warnings.append({"level": "warning", "message": "Creatinine elevee dans le dossier: verifier adaptation renale des anticoagulants/IEC/ARA2/diuretiques."})
    if cardio["scores"]["has_bled"]["value"] >= 3:
        warnings.append({"level": "warning", "message": f"HAS-BLED {cardio['scores']['has_bled']['value']}: risque hemorragique augmente, surveillance renforcee."})
    if any("hta" in disease or "hypertension" in disease for disease in diseases):
        suggestions.append("HTA: controler TA, creatinine/kaliemie, observance et episodes d'hypotension.")
    if any("diab" in disease for disease in diseases):
        suggestions.append("Diabete: integrer HbA1c, fonction renale et risque coronarien global.")
    if any("acfa" in disease or "aryth" in disease for disease in diseases):
        suggestions.append("ACFA/arythmie: verifier ECG, anticoagulation, INR/clairance et risque hemorragique.")
    if profile.get("hypertension"):
        suggestions.append("Protocole HTA typique: IEC/ARA2, inhibiteur calcique ou diuretique selon profil, avec controle TA et ionogramme.")
    if profile.get("previous_infarction") or profile.get("vascular_disease"):
        suggestions.append("Prevention secondaire CAD: antiagregant/statine forte intensite/beta-bloquant selon indication et tolerance.")
    if profile.get("heart_failure"):
        suggestions.append("Insuffisance cardiaque: verifier FEVG, IEC/ARNI, beta-bloquant, ARM, iSGLT2, diuretique selon congestion.")
    if not warnings:
        warnings.append({"level": "ok", "message": "Aucune alerte locale detectee dans le dataset exemple."})

    summary_parts = [
        f"Patient: {patient['nom']} {patient['prenom']}, age {patient['age'] or 'NA'}, sexe {patient['sexe'] or 'NA'}.",
        f"Contexte: maladies={patient['maladies'] or 'non renseigne'}, allergies={patient['allergies'] or 'non renseigne'}.",
        f"Scores: CHA2DS2-VASc={cardio['scores']['cha2ds2_vasc']['value']}, HAS-BLED={cardio['scores']['has_bled']['value']}, ASCVD={cardio['scores']['ascvd_10y']['value']}.",
        f"Medicaments controles: {', '.join(payload.medications) if payload.medications else 'aucun'}.",
        f"Analyses/contexte: {payload.analyses or 'non renseigne'}.",
        "Conclusion: aide locale de securite, decision finale par le cardiologue.",
    ]
    return {
        "warnings": warnings,
        "suggestions": suggestions,
        "summary": " ".join(summary_parts),
        "disclaimer": "Assistant d'aide uniquement. Il ne remplace pas le jugement du cardiologue. Le medecin valide toujours la prescription.",
    }


@app.post("/api/prescriptions", status_code=201)
def create_prescription(payload: PrescriptionIn) -> dict[str, Any]:
    check = cardio_check(AICheckIn(patient_id=payload.patient_id, medications=payload.lines))
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO prescriptions (patient_id, visit_id, lines, ai_warnings, consultation_summary, doctor_validated)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                payload.patient_id,
                payload.visit_id,
                json.dumps(payload.lines, ensure_ascii=False),
                json.dumps(check["warnings"], ensure_ascii=False),
                check.get("summary", ""),
                1 if payload.doctor_validated else 0,
            ),
        )
        prescription_id = cur.lastrowid
    audit("create", "prescriptions", prescription_id, "Ordonnance sauvegardee")
    return {"id": prescription_id, "warnings": check["warnings"]}


def _draw_red_heart(c, cx: float, cy: float, size: float = 22) -> None:
    """Draw a filled red heart shape centered at (cx, cy)."""
    c.setFillColorRGB(0.78, 0.05, 0.08)
    c.setStrokeColorRGB(0.55, 0.02, 0.04)
    c.setLineWidth(0.6)
    p = c.beginPath()
    p.moveTo(cx, cy - size * 0.55)
    p.curveTo(cx - size * 1.1, cy + size * 0.15,
             cx - size * 0.55, cy + size * 0.95,
             cx, cy + size * 0.45)
    p.curveTo(cx + size * 0.55, cy + size * 0.95,
             cx + size * 1.1, cy + size * 0.15,
             cx, cy - size * 0.55)
    c.drawPath(p, stroke=1, fill=1)


def _draw_clinic_letterhead(c, width: float, height: float, settings: dict, patient: dict, title_lines: list[str]) -> float:
    """Draw the standard letterhead matching the clinic certificate template.
    Returns the y position where the body content should start.
    """
    doctor_name_raw = settings.get("DOCTOR_NAME") or "CHIALI M.KAMEL"
    doctor_name = doctor_name_raw.strip()
    if doctor_name.lower().startswith("dr "):
        doctor_name = doctor_name[3:].strip()
    if doctor_name.lower().startswith("dr."):
        doctor_name = doctor_name[3:].strip()
    specialty = (settings.get("DOCTOR_SPECIALTY") or "MEDECIN CARDIOLOGUE").upper()
    order_number = settings.get("DOCTOR_ORDER_NUMBER") or "22/620/13"
    phone = settings.get("DOCTOR_PHONE") or ""
    email = settings.get("DOCTOR_EMAIL") or ""
    address = settings.get("DOCTOR_ADDRESS") or ""
    city = settings.get("CLINIC_CITY") or "SIDI BEL ABBES"

    margin_x = 50
    top = height - 50

    # --- Top-left: doctor info ---
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(margin_x, top, f"Dr.{doctor_name.upper()}.")
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin_x, top - 16, specialty)
    c.setFont("Helvetica", 9.5)
    c.drawString(margin_x, top - 32, f"N° d'ordre des médecins : {order_number}")

    # --- Top-center: red heart ---
    _draw_red_heart(c, width / 2, top - 12, size=20)

    # --- Top-right: patient info ---
    right_x = width - margin_x
    label_x = width - 200
    c.setFont("Helvetica", 10)
    now = datetime.now()
    rows = [
        ("Date :", now.strftime("%H:%M")),
        ("Nom :", str(patient.get("nom") or "").upper()),
        ("Prénom :", str(patient.get("prenom") or "").upper()),
        ("Age :", f"{patient.get('age') or ''} ans" if patient.get("age") else ""),
    ]
    line_y = top
    for label, value in rows:
        c.setFont("Helvetica-Bold", 10)
        c.drawString(label_x, line_y, label)
        c.setFont("Helvetica", 10)
        c.drawString(label_x + 50, line_y, str(value))
        line_y -= 14

    # --- Title box ---
    box_top = top - 70
    box_h = 18 * len(title_lines) + 14
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(2.5)
    c.rect(margin_x + 30, box_top - box_h, width - 2 * (margin_x + 30), box_h, stroke=1, fill=0)
    c.setFont("Helvetica-Bold", 14)
    text_y = box_top - 18
    for line in title_lines:
        c.drawCentredString(width / 2, text_y, line.upper())
        text_y -= 18

    # Footer info stored on canvas for later use
    c._letterhead_phone = phone
    c._letterhead_email = email
    c._letterhead_address = address
    c._letterhead_city = city

    return box_top - box_h - 30  # body starts here


def _draw_clinic_footer(c, width: float) -> None:
    """Draw the dashed footer with phone/email/address/city."""
    margin_x = 50
    phone = getattr(c, "_letterhead_phone", "") or ""
    email = getattr(c, "_letterhead_email", "") or ""
    address = getattr(c, "_letterhead_address", "") or ""
    city = getattr(c, "_letterhead_city", "") or "SIDI BEL ABBES"

    # Dashed line
    c.setStrokeColorRGB(0, 0, 0)
    c.setLineWidth(0.6)
    c.setDash(2, 2)
    c.line(margin_x, 110, width - margin_x, 110)
    c.setDash()

    # Contact line
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica-Bold", 10)
    parts = []
    if phone:
        parts.append(f"\u260E {phone}")
    if email:
        parts.append(f"E.mail : {email}")
    if address:
        parts.append(f"\u2709 : {address}")
    if parts:
        c.drawCentredString(width / 2, 92, "  /  ".join(parts))

    # City
    c.setFont("Helvetica-Bold", 11)
    c.drawCentredString(width / 2, 72, f"***{city.upper()}***")


def build_a5_prescription_pdf(row: sqlite3.Row, prescription_id: int) -> FileResponse:
    """Build A4 prescription PDF matching the clinic letterhead template (kept name for API compat)."""
    settings = get_all_settings()
    pdf_path = DATA / f"ordonnance_{prescription_id}.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    margin_x = 50

    patient = {
        "nom": row["nom"],
        "prenom": row["prenom"],
        "age": row["age"],
        "date_naissance": row["date_naissance"],
        "telephone": row["telephone"],
    }

    body_y = _draw_clinic_letterhead(c, width, height, settings, patient, ["Ordonnance Médicale"])

    # --- Body: prescription lines ---
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 11)
    y = body_y
    line_height = 18

    def draw_wrapped(text: str, x: float, y: float, max_chars: int = 80) -> float:
        for raw_line in str(text or "").splitlines() or [""]:
            words = raw_line.split()
            current = ""
            for word in words:
                candidate = f"{current} {word}".strip()
                if len(candidate) > max_chars and current:
                    c.drawString(x, y, current)
                    y -= line_height
                    current = word
                else:
                    current = candidate
            if current:
                c.drawString(x, y, current)
                y -= line_height
            else:
                y -= line_height
        return y

    try:
        lines = json.loads(row["lines"] or "[]")
    except Exception:
        lines = []

    for index, line in enumerate(lines, start=1):
        if y < 180:
            _draw_clinic_footer(c, width)
            c.showPage()
            body_y = _draw_clinic_letterhead(c, width, height, settings, patient, ["Ordonnance Médicale"])
            y = body_y
        c.setFont("Helvetica-Bold", 11)
        c.drawString(margin_x, y, f"{index}.")
        c.setFont("Helvetica", 11)
        y = draw_wrapped(str(line), margin_x + 24, y) - 4

    # --- Signature area ---
    if y > 200:
        c.setFont("Helvetica", 10)
        c.drawRightString(width - margin_x, 170, "Signature et cachet du médecin")

    _draw_clinic_footer(c, width)
    c.save()
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_path.name)


def build_sport_dispense_certificate_pdf(row: sqlite3.Row, doc_id: int) -> Path:
    settings = get_all_settings()
    pdf_path = DATA / f"document_{doc_id}.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4

    doctor_name = format_doctor_template_name(settings.get("DOCTOR_NAME") or "Dr. Chiali Mohammed Kamel")
    doctor_name_sentence = re.sub(r"^dr\.?\s*", "", str(settings.get("DOCTOR_NAME") or "Chiali Mohammed Kamel").strip(), flags=re.I)
    specialty_raw = str(settings.get("DOCTOR_SPECIALTY") or "Medecin cardiologue").strip()
    specialty_header = specialty_raw.upper() if specialty_raw else "MEDECIN CARDIOLOGUE"
    specialty_sentence = specialty_raw.lower().replace("medecin ", "").strip() or specialty_raw.lower() or "cardiologue"
    order_number = settings.get("DOCTOR_ORDER_NUMBER") or "22/620/13"
    city = settings.get("CLINIC_CITY") or "SIDI BEL ABBES"
    phone = normalized_template_phone(settings.get("DOCTOR_PHONE"))
    email = normalized_template_email(settings.get("DOCTOR_EMAIL"))
    address = normalized_template_address(settings.get("DOCTOR_ADDRESS"), city)
    address_note = settings.get("DOCTOR_ADDRESS_NOTE") or "(ex :rue Gambetta)"

    patient_last = str(row["nom"] or "").upper()
    patient_first = str(row["prenom"] or "").upper()
    patient_age = str(row["age"] or "")
    patient_birth_date = format_display_date(row["date_naissance"] or "")
    patient_full_name = " ".join([part for part in [patient_last, patient_first] if part]).strip()
    patient_sex = str(row["sexe"] or "").strip().lower()
    is_female = patient_sex.startswith("f")
    patient_subject = "la patiente" if is_female else "le patient"
    patient_birth_label = "nee en" if is_female else "ne le"
    request_label = "l'interessee" if is_female else "l'interesse"
    school_year = extract_school_year((row["rendered_text"] or "") + "\n" + (row["body_html"] or ""))
    created_at = parse_optional_datetime(row["created_at"])

    def fit_size(text: str, font_name: str, size: float, max_width: float, min_size: float = 7.5) -> float:
        current = size
        while current > min_size and c.stringWidth(text, font_name, current) > max_width:
            current -= 0.2
        return current

    def draw_fit_left(text: str, x: float, y: float, font_name: str, size: float, max_width: float, min_size: float = 7.5) -> None:
        current = fit_size(text, font_name, size, max_width, min_size)
        c.setFont(font_name, current)
        c.drawString(x, y, text)

    def draw_fit_center(text: str, x: float, y: float, font_name: str, size: float, max_width: float, min_size: float = 8.0) -> None:
        current = fit_size(text, font_name, size, max_width, min_size)
        c.setFont(font_name, current)
        c.drawCentredString(x, y, text)

    def draw_wrapped(text: str, x: float, y: float, font_name: str, size: float, max_width: float, leading: float) -> float:
        lines = simpleSplit(text, font_name, size, max_width) if simpleSplit is not None else [text]
        c.setFont(font_name, size)
        for line in lines:
            c.drawString(x, y, line)
            y -= leading
        return y

    top_y = height - 42
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Times-Bold", 10.5)
    c.drawString(52, top_y, f"Dr.{doctor_name}.")
    c.setFont("Times-Bold", 10)
    c.drawString(52, top_y - 18, specialty_header)
    c.setFont("Times-Roman", 9)
    c.drawString(52, top_y - 36, f"N d'ordre des medecins : {order_number}")

    _draw_red_heart(c, width / 2, top_y - 12, size=13)

    label_x = width - 188
    value_x = width - 128
    right_rows = [
        ("Date:", created_at.strftime("%H:%M")),
        ("Nom:", patient_last),
        ("Prenom:", patient_first),
        ("Age:", f"{patient_age} ans" if patient_age else ""),
    ]
    line_y = top_y
    for label, value in right_rows:
        c.setFont("Times-Bold", 9.5)
        c.drawString(label_x, line_y, label)
        draw_fit_left(value, value_x, line_y, "Times-Roman", 9.5, 110)
        line_y -= 16

    box_left = 42
    box_top = height - 95
    box_width = width - 84
    box_height = 62
    c.setLineWidth(2.2)
    c.rect(box_left, box_top - box_height, box_width, box_height, stroke=1, fill=0)
    draw_fit_center("CERTIFICAT MEDICAL", width / 2, box_top - 22, "Times-Bold", 17, box_width - 20)
    draw_fit_center("DE DISPENSE DE L' ACTIVITE SPORTIVE", width / 2, box_top - 44, "Times-Bold", 15.5, box_width - 20)

    body_x = 76
    y = box_top - 96
    body_width = width - 152
    y = draw_wrapped(f"Je soussigne, Dr {doctor_name_sentence}, {specialty_sentence}, certifie que :", body_x, y, "Times-Bold", 10.5, body_width, 15) - 18
    y = draw_wrapped(f"{patient_subject} : ....{patient_full_name}....", body_x, y, "Times-Bold", 10.5, body_width, 15)
    y = draw_wrapped(f"{patient_birth_label} : ...............{patient_birth_date}........", body_x, y, "Times-Bold", 10.5, body_width, 15) - 18
    y = draw_wrapped("est suivie en cardiologie, dont son etat de sante lui dispense", body_x, y, "Times-Bold", 10.5, body_width, 15)
    y = draw_wrapped("de la pratique d'une activite sportive", body_x, y, "Times-Bold", 10.5, body_width, 15)
    y = draw_wrapped(f"durant l'annee scolaire {school_year}", body_x, y, "Times-Bold", 10.5, body_width, 15) - 48
    y = draw_wrapped(f"certificat delivree a la demande de {request_label} pour lui servir et faire valoir", body_x, y, "Times-Bold", 10.5, body_width, 15)
    draw_wrapped("ce que de droit", body_x, y, "Times-Bold", 10.5, body_width, 15)

    footer_y = 112
    c.setLineWidth(0.8)
    c.setDash(2, 2)
    c.line(56, footer_y, width - 56, footer_y)
    c.setDash()

    c.setFillColorRGB(0.14, 0.30, 0.13)
    c.rect(56, 92, 6, 10, stroke=0, fill=1)
    c.setFillColorRGB(0, 0, 0)
    draw_fit_center(f"{phone} /E.mail :{email}/   : {address}", width / 2, 95, "Times-Bold", 8.5, width - 130, 7.2)
    draw_fit_center(address_note, width / 2, 83, "Times-Bold", 8.2, width - 130, 7.0)
    draw_fit_center(f"***{city.upper()}***.", width / 2, 69, "Times-Bold", 10, width - 130, 8.0)

    c.save()
    return pdf_path


@app.get("/api/prescriptions/{prescription_id}/pdf")
def prescription_pdf(prescription_id: int) -> FileResponse:
    if canvas is None or A5 is None:
        raise HTTPException(status_code=503, detail="reportlab n'est pas installe")
    with connect() as conn:
        row = conn.execute(
            """
            SELECT pr.*, p.nom, p.prenom, p.age, p.code, p.date_naissance, p.telephone
            FROM prescriptions pr JOIN patients p ON p.id = pr.patient_id
            WHERE pr.id = ?
            """,
            (prescription_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ordonnance introuvable")
    return build_a5_prescription_pdf(row, prescription_id)
    settings = get_all_settings()
    clinic = settings.get("CLINIC_NAME") or "Cabinet de Cardiologie"
    doctor_name = settings.get("DOCTOR_NAME") or "CHIALI Mohammed Kamel"
    doctor_display = doctor_name if doctor_name.lower().strip().startswith("dr") else f"Dr {doctor_name}"
    specialty = settings.get("DOCTOR_SPECIALTY") or "Cardiologie"
    order_number = settings.get("DOCTOR_ORDER_NUMBER") or ""
    phone = settings.get("DOCTOR_PHONE") or ""
    email = settings.get("DOCTOR_EMAIL") or ""
    address = settings.get("DOCTOR_ADDRESS") or ""
    logo_path = ROOT / "app-icon.png"
    logo = None
    if ImageReader is not None and logo_path.exists():
        try:
            logo = ImageReader(str(logo_path))
        except Exception:
            logo = None

    pdf_path = DATA / f"ordonnance_{prescription_id}.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4

    def draw_wrapped(text: str, x: float, y: float, max_chars: int = 92, line_height: int = 15) -> float:
        for raw_line in str(text or "").splitlines() or [""]:
            words = raw_line.split()
            current = ""
            for word in words:
                candidate = f"{current} {word}".strip()
                if len(candidate) > max_chars and current:
                    c.drawString(x, y, current)
                    y -= line_height
                    current = word
                else:
                    current = candidate
            if current:
                c.drawString(x, y, current)
                y -= line_height
            else:
                y -= line_height
        return y

    c.setStrokeColorRGB(0.07, 0.16, 0.30)
    c.setLineWidth(1.2)
    c.roundRect(34, 34, width - 68, height - 68, 10, stroke=1, fill=0)
    c.setFillColorRGB(1, 1, 1)
    c.setStrokeColorRGB(0.07, 0.16, 0.30)
    c.line(34, height - 118, width - 34, height - 118)

    if logo is not None:
        c.drawImage(logo, 46, height - 96, width=50, height=50, mask="auto", preserveAspectRatio=True)
        left_x = 106
    else:
        left_x = 52

    c.setFont("Helvetica-Bold", 15)
    c.setFillColorRGB(0.08, 0.25, 0.42)
    c.drawString(left_x, height - 58, doctor_display)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(left_x, height - 74, specialty)
    c.setFont("Helvetica", 8.8)
    if order_number:
        c.drawString(left_x, height - 90, f"N° d'ordre: {order_number}")

    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(width - 52, height - 56, clinic)
    c.setFont("Helvetica", 8.5)
    if address:
        c.drawRightString(width - 52, height - 72, address[:80])
    contact = " | ".join([value for value in [phone, email] if value])
    if contact:
        c.drawRightString(width - 52, height - 88, contact[:92])

    c.setFillColorRGB(0.08, 0.25, 0.42)
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(width / 2, height - 150, "ORDONNANCE")
    c.setFont("Helvetica", 10)
    c.drawRightString(width - 52, height - 126, f"Le {datetime.now().strftime('%d/%m/%Y')}")

    c.setStrokeColorRGB(0.70, 0.82, 0.93)
    c.roundRect(52, height - 220, width - 104, 50, 7, stroke=1, fill=0)
    c.setFillColorRGB(0.02, 0.08, 0.14)
    c.setFont("Helvetica-Bold", 10.5)
    c.drawString(66, height - 192, f"Patient: {row['nom']} {row['prenom']}")
    c.setFont("Helvetica", 9)
    patient_meta = [
        f"Age: {row['age'] or ''} ans" if row["age"] else "",
        f"Ne(e) le: {row['date_naissance']}" if row["date_naissance"] else "",
        f"Code: {row['code']}" if row["code"] else "",
        f"Tel: {row['telephone']}" if row["telephone"] else "",
    ]
    c.drawString(66, height - 209, " | ".join([item for item in patient_meta if item]))

    y = height - 255
    c.setFont("Helvetica-Bold", 11)
    c.drawString(58, y, "Traitement")
    y -= 24
    c.setFont("Helvetica", 11)
    for index, line in enumerate(json.loads(row["lines"] or "[]"), start=1):
        if y < 95:
            c.showPage()
            y = height - 70
            c.setFont("Helvetica", 11)
        c.setFont("Helvetica-Bold", 10)
        c.drawString(64, y, f"{index}.")
        c.setFont("Helvetica", 11)
        y = draw_wrapped(line, 88, y, max_chars=80, line_height=16) - 6

    c.setStrokeColorRGB(0.70, 0.82, 0.93)
    c.line(52, 104, width - 52, 104)
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColorRGB(0.30, 0.38, 0.48)
    c.drawString(52, 82, "Aide logicielle locale. La validation medicale, la signature et le cachet restent sous responsabilite du medecin.")
    c.setFont("Helvetica", 10)
    c.setFillColorRGB(0.02, 0.08, 0.14)
    c.drawRightString(width - 70, 64, doctor_display)
    c.line(width - 205, 88, width - 58, 88)
    c.setFont("Helvetica-Oblique", 8)
    c.drawRightString(width - 70, 48, "Signature et cachet")
    c.save()
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_path.name)


@app.get("/api/patients/{patient_id}/cardiology-report/pdf")
def cardiology_report_pdf(patient_id: int) -> FileResponse:
    if canvas is None or A4 is None:
        raise HTTPException(status_code=503, detail="reportlab n'est pas installe")
    with connect() as conn:
        patient = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        cardio = cardio_summary_for_patient(conn, patient_id)
    pdf_path = DATA / f"compte_rendu_cardio_{patient_id}.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    y = height - 50
    c.setFont("Helvetica-Bold", 16)
    c.drawString(45, y, "Compte rendu de cardiologie")
    y -= 28
    c.setFont("Helvetica", 10)
    c.drawString(45, y, f"Patient: {patient['nom']} {patient['prenom']} | Age: {patient['age'] or ''} | Sexe: {patient['sexe'] or ''}")
    y -= 18
    c.drawString(45, y, f"Date: {now_iso()}")
    y -= 24
    for label, score in cardio["scores"].items():
        if label == "inputs":
            continue
        c.drawString(45, y, f"{label}: {score.get('value')} ({score.get('level')})")
        y -= 16
    y -= 8
    for alert in cardio["alerts"][:8]:
        c.drawString(45, y, f"Alerte: {alert['message'][:95]}")
        y -= 15
    y -= 8
    for imaging in cardio["imaging"][:4]:
        c.drawString(45, y, f"Imagerie {imaging['imaging_type']}: FEVG {imaging.get('ejection_fraction') or ''}% - {imaging.get('valve_status') or ''}")
        y -= 15
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(45, 45, "Document local. Validation, interpretation et signature par le cardiologue.")
    c.save()
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_path.name)


@app.get("/api/patients/{patient_id}/hospitalization-letter/pdf")
def hospitalization_letter_pdf(patient_id: int) -> FileResponse:
    if canvas is None or A4 is None:
        raise HTTPException(status_code=503, detail="reportlab n'est pas installe")
    with connect() as conn:
        patient = conn.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        cardio = cardio_summary_for_patient(conn, patient_id)
    pdf_path = DATA / f"lettre_hospitalisation_{patient_id}.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    y = height - 55
    c.setFont("Helvetica-Bold", 16)
    c.drawString(45, y, "Lettre d'orientation / hospitalisation cardiologie")
    y -= 30
    c.setFont("Helvetica", 10)
    c.drawString(45, y, f"Patient: {patient['nom']} {patient['prenom']} | Age: {patient['age'] or ''}")
    y -= 22
    c.drawString(45, y, "Motif: prise en charge cardiologique specialisee selon evaluation clinique.")
    y -= 22
    c.drawString(45, y, f"Antecedents / risques: {patient['maladies'] or 'Non renseignes'}")
    y -= 22
    for alert in cardio["alerts"][:6]:
        c.drawString(45, y, f"- {alert['message'][:100]}")
        y -= 16
    y -= 10
    c.drawString(45, y, "Merci de poursuivre l'evaluation et la prise en charge adaptee.")
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(45, 45, "Document genere localement. Le medecin valide et signe avant transmission.")
    c.save()
    return FileResponse(pdf_path, media_type="application/pdf", filename=pdf_path.name)


def create_mobile_upload_token(patient_id: int) -> dict[str, str]:
    token = secrets.token_urlsafe(32)
    expires_at = (datetime.now() + timedelta(minutes=MOBILE_TOKEN_TTL_MINUTES)).isoformat(timespec="seconds")
    with connect() as conn:
        patient = conn.execute("SELECT id FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        conn.execute(
            "DELETE FROM mobile_upload_tokens WHERE patient_id = ? AND expires_at < ?",
            (patient_id, now_iso()),
        )
        conn.execute(
            "INSERT INTO mobile_upload_tokens (patient_id, token_hash, expires_at) VALUES (?, ?, ?)",
            (patient_id, hash_token(token), expires_at),
        )
    return {
        "url": mobile_upload_url(patient_id, token),
        "upload_endpoint": mobile_upload_endpoint(patient_id),
        "expires_at": expires_at,
    }


def validate_mobile_upload_token(conn: sqlite3.Connection, patient_id: int, token: str) -> None:
    if not token:
        raise HTTPException(status_code=401, detail="Token manquant")
    row = conn.execute(
        """
        SELECT * FROM mobile_upload_tokens
        WHERE patient_id = ? AND token_hash = ? AND revoked_at IS NULL
        ORDER BY created_at DESC LIMIT 1
        """,
        (patient_id, hash_token(token)),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Token invalide")
    if parse_iso_datetime(row["expires_at"]) < datetime.now():
        raise HTTPException(status_code=401, detail="Token expire")
    conn.execute("UPDATE mobile_upload_tokens SET last_used_at = ? WHERE id = ?", (now_iso(), row["id"]))


def mobile_token_error(patient_id: int, token: str) -> str:
    with connect() as conn:
        patient = conn.execute("SELECT id FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not patient:
            return "Patient introuvable. Veuillez scanner un nouveau QR depuis le logiciel."
        if not token:
            return "Token manquant. Veuillez scanner un nouveau QR depuis le logiciel."
        row = conn.execute(
            """
            SELECT * FROM mobile_upload_tokens
            WHERE patient_id = ? AND token_hash = ? AND revoked_at IS NULL
            ORDER BY created_at DESC LIMIT 1
            """,
            (patient_id, hash_token(token)),
        ).fetchone()
        if not row:
            return "Lien invalide. Veuillez scanner un nouveau QR depuis le logiciel."
        if parse_iso_datetime(row["expires_at"]) < datetime.now():
            return "Lien expire. Generez un nouveau QR depuis le logiciel."
    return ""


def validate_mobile_file(file: UploadFile) -> None:
    filename = Path(file.filename or "").name
    extension = Path(filename).suffix.lower()
    mime_type = (file.content_type or "").lower()
    if extension in BLOCKED_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Fichier executable/script refuse pour raisons de securite.")
    if extension not in ALLOWED_MOBILE_EXTENSIONS:
        raise HTTPException(status_code=415, detail="Type fichier non autorise. PDF, JPG, PNG ou DICOM uniquement.")
    if mime_type and mime_type not in ALLOWED_MOBILE_MIME_TYPES and extension not in {".dcm", ".dicom"}:
        raise HTTPException(status_code=415, detail="MIME fichier non autorise.")
    file.file.seek(0, 2)
    size = file.file.tell()
    file.file.seek(0)
    if size > MAX_MOBILE_FILE_BYTES:
        raise HTTPException(status_code=413, detail=f"Fichier trop volumineux. Maximum {MAX_MOBILE_FILE_BYTES // (1024*1024)} Mo.")


def save_uploaded_document(
    patient_id: int,
    type_document: str,
    file: UploadFile,
    notes: str = "",
    source: str = "desktop",
) -> dict[str, Any]:
    patient_dir = UPLOADS / str(patient_id)
    patient_dir.mkdir(parents=True, exist_ok=True)
    safe_original = Path(file.filename or "document").name
    safe_name = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}_{safe_original}"
    stored = patient_dir / safe_name
    with stored.open("wb") as handle:
        shutil.copyfileobj(file.file, handle)
    with connect() as conn:
        patient = conn.execute("SELECT id FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not patient:
            stored.unlink(missing_ok=True)
            raise HTTPException(status_code=404, detail="Patient introuvable")
        cur = conn.execute(
            """
            INSERT INTO documents (patient_id, type_document, original_name, stored_path, mime_type, size_bytes, notes, source)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (patient_id, type_document, file.filename, str(stored), file.content_type, stored.stat().st_size, notes, source),
        )
        doc_id = cur.lastrowid
    audit("upload", "documents", doc_id, f"Upload {type_document} depuis {source}")
    return {"id": doc_id, "file": safe_name, "source": source, "uploaded_at": now_iso()}


def setting_enabled(key: str) -> bool:
    return (get_setting(key) or "").strip().lower() in {"1", "true", "yes", "oui", "on"}


def normalize_ai_provider(value: str | None) -> str:
    provider = (value or "").strip().lower().replace("-", "_")
    aliases = {
        "openai": "openai",
        "openai_compatible": "openai",
        "openai-compatible": "openai",
        "compatible": "openai",
        "gemini": "gemini",
        "google": "gemini",
        "google_gemini": "gemini",
        "openrouter": "openrouter",
        "open_router": "openrouter",
        "local": "local",
        "ollama": "local",
        "local_ollama": "local",
        "ocr": "local",
        "disabled": "disabled",
        "desactive": "disabled",
        "désactivé": "disabled",
        "off": "disabled",
    }
    return aliases.get(provider, "disabled")


def ai_model_for_provider(provider: str) -> str:
    configured = (get_setting("AI_MODEL_NAME") or "").strip()
    if provider == "openai":
        return (get_setting("AI_OPENAI_MODEL") or "").strip() or configured or DEFAULT_SETTINGS["AI_OPENAI_MODEL"]
    if provider == "gemini":
        return (get_setting("AI_GEMINI_MODEL") or "").strip() or configured or DEFAULT_SETTINGS["AI_GEMINI_MODEL"]
    if provider == "openrouter":
        or_model = (get_setting("AI_OPENROUTER_SUMMARY_MODEL") or "").strip()
        if or_model:
            return or_model
        if not configured or configured.lower().startswith("gemini"):
            return DEFAULT_SETTINGS["AI_OPENROUTER_OCR_MODEL"]
    if provider == "local":
        return (get_setting("AI_LOCAL_MODEL") or "").strip() or "local-ocr-rules"
    return configured or DEFAULT_SETTINGS["AI_MODEL_NAME"]


def ai_document_model_for_provider(provider: str) -> str:
    if provider == "openrouter":
        return (get_setting("AI_OPENROUTER_OCR_MODEL") or "").strip() or DEFAULT_SETTINGS["AI_OPENROUTER_OCR_MODEL"]
    if provider == "local":
        return "local-ocr-rules"
    return ai_model_for_provider(provider)


def ai_api_key_for_provider(provider: str) -> str:
    if provider == "gemini":
        return get_setting("AI_GEMINI_API_KEY").strip()
    if provider == "openrouter":
        return get_setting("AI_OPENROUTER_API_KEY").strip()
    if provider == "openai":
        return get_setting("AI_OPENAI_API_KEY").strip()
    return ""


def normalize_ai_provider(value: str | None) -> str:
    provider = (value or "").strip().lower().replace("-", "_")
    if provider in {"", "disabled", "desactive", "off"}:
        return "disabled"
    return "openrouter"


def ai_model_for_provider(provider: str) -> str:
    if provider == "local":
        return "local-ocr-rules"
    if provider == "disabled":
        return ""
    return LOCKED_AI_MODEL


def ai_document_model_for_provider(provider: str) -> str:
    if provider == "local":
        return "local-ocr-rules"
    if provider == "disabled":
        return ""
    return LOCKED_AI_MODEL


def ai_api_key_for_provider(provider: str) -> str:
    if provider == "openrouter":
        return get_setting("AI_OPENROUTER_API_KEY").strip()
    return ""


def cloud_ai_configured() -> bool:
    return bool(
        get_setting("CLOUD_AI_URL").strip()
        and get_setting("CLOUD_AI_DOCTOR_ID").strip()
        and get_setting("CLOUD_AI_SECRET").strip()
    )


def detect_document_type(document: dict[str, Any]) -> str:
    haystack = " ".join(
        str(document.get(key) or "")
        for key in ("type_document", "original_name", "mime_type", "notes")
    ).lower()
    if "ecg" in haystack or "electrocard" in haystack:
        return "ECG"
    if any(term in haystack for term in ("analyse biologique", "biologie", "bilan", "laboratoire", "lab", "sang", "glycem", "hba1c", "creatin", "troponin", "crp")):
        return "Analyse biologique"
    if "irm" in haystack or "mri" in haystack:
        return "IRM"
    if "scanner" in haystack or "ct" in haystack or "tomodensit" in haystack:
        return "Scanner"
    if "echo" in haystack or "échographie" in haystack or "echographie" in haystack or "ultrasound" in haystack:
        return "Echographie"
    if "pdf" in haystack:
        return "PDF report"
    return "Other"


def guess_document_mime(document: dict[str, Any], path: Path) -> str:
    mime = (document.get("mime_type") or "").strip()
    if mime:
        return mime
    guessed, _ = mimetypes.guess_type(str(path))
    return guessed or "application/octet-stream"


def is_cloud_supported_file(mime_type: str, path: Path) -> bool:
    suffix = path.suffix.lower()
    return mime_type.startswith("image/") or mime_type == "application/pdf" or suffix == ".pdf"


def normalize_risk_level(value: Any) -> str:
    raw = str(value or "").strip().lower()
    normalized = raw.replace("é", "e").replace("è", "e").replace("ê", "e")
    if any(term in normalized for term in ("haut", "high", "eleve", "urgent", "critique", "severe")):
        return "élevé"
    if any(term in normalized for term in ("moyen", "medium", "modere", "intermediaire")):
        return "moyen"
    return "faible"


def parse_float(value: Any) -> float | None:
    if value is None:
        return None
    match = re.search(r"[-+]?\d+(?:[\.,]\d+)?", str(value))
    if not match:
        return None
    try:
        return float(match.group(0).replace(",", "."))
    except ValueError:
        return None


def limited_text(value: str, limit: int = 12000) -> str:
    text = (value or "").replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    if len(text) <= limit:
        return text
    return text[:limit] + "..."


def parse_ai_json_text(text: str) -> dict[str, Any]:
    cleaned = (text or "").strip()
    cleaned = re.sub(r"^```(?:json)?", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"```$", "", cleaned).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(cleaned[start:end + 1])
            except Exception:
                pass
    return {"summary": cleaned}


def normalize_text_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, dict):
        return [str(item).strip() for item in value.values() if str(item).strip()]
    text = str(value).strip()
    if not text:
        return []
    return [part.strip("-• \t") for part in re.split(r"[\n;]+", text) if part.strip("-• \t")]


def normalize_extracted_values(values: Any) -> list[dict[str, str]]:
    if not isinstance(values, list):
        return []
    normalized: list[dict[str, str]] = []
    for item in values:
        if not isinstance(item, dict):
            continue
        analyte = str(item.get("analyte") or item.get("name") or item.get("nom") or item.get("label") or "").strip()
        if not analyte:
            continue
        normalized.append({
            "id": item.get("id"),
            "analyte": analyte,
            "value": str(item.get("value") or item.get("valeur") or "").strip(),
            "unit": str(item.get("unit") or item.get("unite") or "").strip(),
            "reference_range": str(item.get("reference_range") or item.get("reference") or item.get("norme") or "").strip(),
            "abnormal_flag": str(item.get("abnormal_flag") or item.get("abnormal") or item.get("flag") or "").strip(),
        })
    return normalized


def normalize_ai_payload(payload: dict[str, Any], document_type: str, raw_ocr: str = "") -> dict[str, Any]:
    values = normalize_extracted_values(
        payload.get("extracted_values")
        or payload.get("detected_values")
        or payload.get("valeurs_detectees")
        or payload.get("valeurs")
        or payload.get("labs")
    )
    summary = str(
        payload.get("summary")
        or payload.get("resume_medical")
        or payload.get("résumé médical")
        or payload.get("resume")
        or ""
    ).strip()
    if not summary:
        summary = "Synthèse IA non disponible pour ce document."
    if AI_SAFETY_WARNING not in summary:
        summary = f"{summary}\n\n{AI_SAFETY_WARNING}"
    analysis_mode = normalize_analysis_mode(payload.get("analysis_mode") or payload.get("mode") or AI_DEFAULT_ANALYSIS_MODE)
    result = {
        "document_type": str(payload.get("document_type") or payload.get("type_de_document") or document_type),
        "summary": summary,
        "extracted_values": values,
        "possible_abnormalities": normalize_text_list(payload.get("possible_abnormalities") or payload.get("possible_risks") or payload.get("anomalies_possibles") or payload.get("risques_possibles")),
        "important_points": normalize_text_list(payload.get("important_points") or payload.get("points_importants") or payload.get("points_cles") or payload.get("points")),
        "risk_level": normalize_risk_level(payload.get("risk_level") or payload.get("niveau_urgence")),
        "recommendation": AI_SAFETY_WARNING,
        "raw_ocr": limited_text(str(payload.get("raw_ocr") or payload.get("texte_brut_ocr") or raw_ocr or "")),
        "confidence": parse_float(payload.get("confidence")) if payload.get("confidence") is not None else None,
        "uncertainty_level": str(payload.get("uncertainty_level") or payload.get("niveau_incertitude") or "").strip(),
        "analysis_mode": analysis_mode,
    }
    if result["confidence"] is None:
        result["confidence"] = 0.35 if result["raw_ocr"] else 0.15
    result["confidence"] = max(0.0, min(1.0, float(result["confidence"])))
    return result


def build_document_ai_prompt(
    document_type: str,
    document: dict[str, Any],
    extracted_text: str,
    local_summary: dict[str, Any],
    analysis_mode: str,
) -> str:
    mode_guidance = {
        "short": "Réponds brièvement, avec des listes courtes et une synthèse clinique concise.",
        "normal": "Réponds de façon structurée avec un résumé, les points importants et les risques potentiels.",
        "detailed": "Réponds de façon plus développée, mais reste clinique et sans digression.",
    }[normalize_analysis_mode(analysis_mode)]
    extracted_text = limited_text(extracted_text, AI_DOCUMENT_CONTEXT_LIMIT)
    local_values = json.dumps(local_summary.get("extracted_values") or [], ensure_ascii=False, default=str)
    local_points = json.dumps(local_summary.get("important_points") or [], ensure_ascii=False, default=str)
    local_risks = json.dumps(local_summary.get("possible_abnormalities") or [], ensure_ascii=False, default=str)
    return f"""
Tu es un assistant d'aide à l'analyse de documents médicaux pour un cardiologue.
Le modèle unique est OpenRouter {LOCKED_AI_MODEL}.
Tu ne poses jamais de diagnostic final automatique et tu ne prescris jamais automatiquement.
Le médecin valide, modifie ou rejette toute sortie.
Réponds uniquement en JSON valide avec les champs:
document_type, summary, important_points, extracted_values, possible_abnormalities,
risk_level, recommendation, raw_ocr, confidence, uncertainty_level, analysis_mode.
Utilise risk_level uniquement parmi: faible, moyen, élevé.
recommendation doit être exactement: "{AI_SAFETY_WARNING}"
{mode_guidance}

Document:
- Nom fichier: {document.get("original_name") or ""}
- Type déclaré: {document.get("type_document") or ""}
- Notes médecin: {document.get("notes") or ""}
- Type médical détecté: {document_type}
- Mode demandé: {normalize_analysis_mode(analysis_mode)}

Extraction locale déjà effectuée:
- Résumé local: {local_summary.get("summary") or ""}
- Valeurs structurées locales: {local_values}
- Points importants locaux: {local_points}
- Risques locaux: {local_risks}

Texte extrait localement à résumer sans le recopier en entier:
{extracted_text}

Règles de sortie:
- Résume le texte extrait en français, de façon compacte.
- Dans extracted_values, ne conserve que les données utiles et lisibles.
- Dans possible_abnormalities, liste les risques ou anomalies potentielles à vérifier.
- Dans important_points, donne les faits cliniques les plus utiles.
- Si le texte est pauvre ou bruité, indique clairement l'incertitude.
""".strip()


LAB_ANALYTE_ALIASES: dict[str, list[str]] = {
    "Hb": ["hb", "hemoglobine", "hémoglobine", "hemoglobin"],
    "WBC": ["wbc", "leucocytes", "globules blancs"],
    "Platelets": ["plaquettes", "platelets", "plt"],
    "Glucose": ["glucose", "glycemie", "glycémie"],
    "HbA1c": ["hba1c", "hb a1c", "hemoglobine glyquee", "hémoglobine glyquée"],
    "Creatinine": ["creatinine", "créatinine"],
    "eGFR": ["egfr", "dfg", "clairance"],
    "LDL": ["ldl"],
    "HDL": ["hdl"],
    "Total cholesterol": ["cholesterol total", "cholestérol total", "total cholesterol"],
    "Triglycerides": ["triglycerides", "triglycérides", "tg"],
    "Troponin": ["troponine", "troponin"],
    "BNP": ["bnp"],
    "NT-proBNP": ["nt-probnp", "nt probnp", "ntprobnp"],
    "CRP": ["crp"],
    "AST": ["ast", "asat", "tgo"],
    "ALT": ["alt", "alat", "tgp"],
    "TSH": ["tsh"],
}


def extract_lab_values_from_text(text: str) -> list[dict[str, str]]:
    if not text:
        return []
    values: list[dict[str, str]] = []
    seen: set[str] = set()
    lines = [line.strip() for line in re.split(r"[\r\n]+", text) if line.strip()]
    if len(lines) <= 1:
        lines = re.split(r"\s{2,}|;", text)
    for line in lines:
        lower = line.lower()
        canonical = ""
        for analyte, aliases in LAB_ANALYTE_ALIASES.items():
            if any(alias in lower for alias in aliases):
                canonical = analyte
                break
        if not canonical or canonical in seen:
            continue
        match = re.search(r"([-+]?\d+(?:[\.,]\d+)?)\s*([a-zA-Zµ/%]+(?:/[a-zA-Zµ]+)?)?", line)
        if not match:
            continue
        reference = ""
        ref_match = re.search(r"(?:ref|réf|reference|norme|normal|valeurs usuelles)[^\d<>=-]*([<>]?\s*\d+(?:[\.,]\d+)?(?:\s*[-–]\s*\d+(?:[\.,]\d+)?)?)", line, re.IGNORECASE)
        if ref_match:
            reference = ref_match.group(1).strip()
        abnormal = ""
        if re.search(r"\b(H|L|haut|bas|élev|elev|high|low|anormal|\*)\b", line, re.IGNORECASE):
            abnormal = "anormal"
        values.append({
            "analyte": canonical,
            "value": match.group(1).replace(",", "."),
            "unit": (match.group(2) or "").strip(),
            "reference_range": reference,
            "abnormal_flag": abnormal,
        })
        seen.add(canonical)
    return values


def local_extract_text(path: Path, mime_type: str) -> str:
    suffix = path.suffix.lower()
    if mime_type == "application/pdf" or suffix == ".pdf":
        try:
            from pypdf import PdfReader  # type: ignore
            reader = PdfReader(str(path))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        except Exception:
            try:
                raw = path.read_bytes()
                decoded = raw.decode("utf-8", errors="ignore")
                if len(re.findall(r"[A-Za-zÀ-ÿ]{4,}", decoded)) < 10:
                    decoded = raw.decode("latin-1", errors="ignore")
                return decoded
            except Exception:
                return ""
    if mime_type.startswith("image/"):
        try:
            from PIL import Image  # type: ignore
            import pytesseract  # type: ignore
            return pytesseract.image_to_string(Image.open(path), lang="fra+eng")
        except Exception:
            return ""
    return ""


def estimate_local_risk(document_type: str, values: list[dict[str, str]], text: str) -> str:
    lower = (text or "").lower()
    if any(term in lower for term in ("sus-décalage st", "sus decalage st", "stemi", "infarctus aigu", "embolie pulmonaire massive")):
        return "élevé"
    for item in values:
        analyte = item["analyte"].lower()
        value = parse_float(item.get("value"))
        abnormal = (item.get("abnormal_flag") or "").lower()
        if analyte == "troponin" and (abnormal or (value is not None and value > 0.04)):
            return "élevé"
        if analyte in {"bnp", "nt-probnp"} and value is not None and value > 400:
            return "moyen"
        if analyte == "creatinine" and value is not None and value > 1.5:
            return "moyen"
    if any((item.get("abnormal_flag") or "").strip() for item in values):
        return "moyen"
    if document_type == "ECG" and any(term in lower for term in ("tachycard", "bradycard", "aryth", "qt long", "qtc")):
        return "moyen"
    return "faible"


def local_rule_analysis(document: dict[str, Any], path: Path, document_type: str, raw_ocr: str | None = None) -> dict[str, Any]:
    mime_type = guess_document_mime(document, path)
    text = raw_ocr if raw_ocr is not None else local_extract_text(path, mime_type)
    text = limited_text(text)
    values = extract_lab_values_from_text(text)
    possible_abnormalities: list[str] = []
    important_points: list[str] = []
    if not text:
        important_points.append("OCR local indisponible ou texte non lisible.")
    if path.suffix.lower() in {".dcm", ".dicom"}:
        important_points.append("Fichier DICOM brut: l'IA ne remplace pas l'interprétation d'un radiologue.")
    if document_type in {"IRM", "Scanner", "Echographie"} and mime_type.startswith("image/"):
        important_points.append("Image médicale brute: à interpréter avec le compte rendu spécialisé.")
    if values:
        abnormal_values = [item for item in values if item.get("abnormal_flag")]
        if abnormal_values:
            possible_abnormalities.extend(f"{item['analyte']} signalé anormal" for item in abnormal_values)
    risk_level = estimate_local_risk(document_type, values, text)
    if text:
        summary = f"Analyse locale OCR/règles pour {document_type}. Texte extrait partiellement et valeurs structurées lorsque visibles."
    else:
        summary = f"Analyse locale limitée pour {document_type}. Aucun texte exploitable n'a été extrait automatiquement."
    return normalize_ai_payload({
        "document_type": document_type,
        "summary": summary,
        "extracted_values": values,
        "possible_abnormalities": possible_abnormalities,
        "important_points": important_points,
        "risk_level": risk_level,
        "raw_ocr": text,
        "confidence": 0.45 if text else 0.15,
        "uncertainty_level": "élevé" if not text else "moyen",
    }, document_type, text)


def call_gemini_analysis(document: dict[str, Any], path: Path, document_type: str, model: str, api_key: str) -> dict[str, Any]:
    mime_type = guess_document_mime(document, path)
    if not is_cloud_supported_file(mime_type, path):
        return local_rule_analysis(document, path, document_type)
    prompt = build_ai_prompt(document_type, document)
    payload = {
        "contents": [{
            "role": "user",
            "parts": [
                {"text": prompt},
                {"inline_data": {"mime_type": mime_type, "data": base64.b64encode(path.read_bytes()).decode("ascii")}},
            ],
        }],
        "generationConfig": {
            "temperature": 0.1,
            "response_mime_type": "application/json",
        },
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model, safe='')}:generateContent?key={quote(api_key, safe='')}"
    request = UrlRequest(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=90) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=502, detail=f"Erreur Gemini: {detail or exc.reason}")
    except (URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail=f"Gemini indisponible: {exc}")
    parts = response_data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    text = "\n".join(part.get("text", "") for part in parts if isinstance(part, dict))
    return normalize_ai_payload(parse_ai_json_text(text), document_type)


def call_gemini_text_probe(model: str, api_key: str) -> str:
    payload = {
        "contents": [{
            "role": "user",
            "parts": [{"text": "Réponds exactement OK. Test technique sans donnée médicale."}],
        }],
        "generationConfig": {"temperature": 0},
    }
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model, safe='')}:generateContent?key={quote(api_key, safe='')}"
    request = UrlRequest(url, data=json.dumps(payload).encode("utf-8"), headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urlopen(request, timeout=45) as response:
            response_data = json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=502, detail=f"Erreur Gemini: {detail or exc.reason}")
    except (URLError, TimeoutError) as exc:
        raise HTTPException(status_code=502, detail=f"Gemini indisponible: {exc}")
    parts = response_data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "\n".join(part.get("text", "") for part in parts if isinstance(part, dict)).strip()


def extract_openrouter_text(payload: Any) -> str:
    if isinstance(payload, dict):
        for key in ("generated_text", "text", "answer"):
            if payload.get(key):
                return str(payload[key])
        if payload.get("label"):
            return str(payload["label"])
        return json.dumps(payload, ensure_ascii=False)
    if isinstance(payload, list):
        fragments: list[str] = []
        for item in payload:
            if isinstance(item, dict):
                fragments.append(str(item.get("generated_text") or item.get("text") or item.get("label") or item))
            else:
                fragments.append(str(item))
        return "\n".join(fragments)
    return str(payload or "")


def call_openrouter_analysis(document: dict[str, Any], path: Path, document_type: str, model: str, api_key: str) -> dict[str, Any]:
    mime_type = guess_document_mime(document, path)
    raw_text = limited_text(local_extract_text(path, mime_type), AI_DOCUMENT_CONTEXT_LIMIT)
    local_preview = local_rule_analysis(document, path, document_type, raw_ocr=raw_text)
    if not raw_text:
        return local_preview
    analysis_mode = normalize_analysis_mode(document.get("analysis_mode") or ai_analysis_mode())
    prompt = build_document_ai_prompt(document_type, document, raw_text, local_preview, analysis_mode)
    messages = [ChatMessage(role="system", content=prompt), ChatMessage(role="user", content="Retourne uniquement le JSON demandé." )]
    try:
        response = OpenRouterProvider(model=model, api_key=api_key, max_new_tokens=analysis_mode_token_limit(analysis_mode)).chat(messages)
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)[:500]) from exc
    parsed = parse_ai_json_text(response.content)
    parsed.setdefault("analysis_mode", analysis_mode)
    parsed.setdefault("raw_ocr", raw_text)
    parsed.setdefault("summary", local_preview.get("summary"))
    parsed.setdefault("important_points", local_preview.get("important_points", []))
    parsed.setdefault("possible_abnormalities", local_preview.get("possible_abnormalities", []))
    parsed.setdefault("extracted_values", local_preview.get("extracted_values", []))
    parsed.setdefault("risk_level", local_preview.get("risk_level", "faible"))
    return normalize_ai_payload(parsed, document_type, raw_text)


def store_extracted_values(conn: sqlite3.Connection, analysis_id: int, document: dict[str, Any], values: list[dict[str, str]], confirmed: bool = False) -> None:
    for item in values:
        conn.execute(
            """
            INSERT INTO extracted_lab_values
            (patient_id, document_id, analyte, value, unit, reference_range, abnormal_flag, source_ai_analysis_id, doctor_confirmed)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                document["patient_id"],
                document["id"],
                item.get("analyte", ""),
                item.get("value", ""),
                item.get("unit", ""),
                item.get("reference_range", ""),
                item.get("abnormal_flag", ""),
                analysis_id,
                1 if confirmed else 0,
            ),
        )


def analysis_to_dict(conn: sqlite3.Connection, row: sqlite3.Row) -> dict[str, Any]:
    result = dict(row)
    for key in ("extracted_json", "validated_extracted_json"):
        try:
            result[key] = json.loads(result[key] or "{}")
        except Exception:
            result[key] = {}
    result["lab_values"] = rows_to_dicts(conn.execute(
        "SELECT * FROM extracted_lab_values WHERE source_ai_analysis_id = ? ORDER BY id",
        (row["id"],),
    ).fetchall())
    return result


def create_ai_analysis_record(
    conn: sqlite3.Connection,
    document: dict[str, Any],
    provider: str,
    model: str,
    document_type: str,
    data: dict[str, Any],
) -> dict[str, Any]:
    analysis_mode = normalize_analysis_mode(data.get("analysis_mode") or ai_analysis_mode())
    extracted_json = json.dumps({**data, "analysis_mode": analysis_mode}, ensure_ascii=False)
    cur = conn.execute(
        """
        INSERT INTO ai_document_analyses
        (patient_id, document_id, provider, model, document_type, analysis_mode, summary, extracted_json, risk_level, confidence, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)
        """,
        (
            document["patient_id"],
            document["id"],
            provider,
            model,
            document_type,
            analysis_mode,
            data.get("summary", ""),
            extracted_json,
            data.get("risk_level", "faible"),
            data.get("confidence", 0),
            now_iso(),
            now_iso(),
        ),
    )
    analysis_id = cur.lastrowid
    store_extracted_values(conn, analysis_id, document, data.get("extracted_values", []), confirmed=False)
    row = conn.execute("SELECT * FROM ai_document_analyses WHERE id = ?", (analysis_id,)).fetchone()
    return analysis_to_dict(conn, row)


def latest_document_analysis(conn: sqlite3.Connection, document_id: int, provider: str | None = None) -> sqlite3.Row | None:
    sql = "SELECT * FROM ai_document_analyses WHERE document_id = ?"
    params: list[Any] = [document_id]
    if provider:
        sql += " AND provider = ?"
        params.append(provider)
    sql += " ORDER BY created_at DESC, id DESC LIMIT 1"
    return conn.execute(sql, params).fetchone()


def analyze_document_with_ai(document_id: int, payload: AIAnalyzeIn) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Document introuvable")
        document = dict(row)
        analysis_mode = normalize_analysis_mode(payload.analysis_mode or ai_analysis_mode())
        if payload.force_local:
            provider = "local"
            cached = latest_document_analysis(conn, document_id, provider="local")
            if cached and not payload.re_analyze:
                return analysis_to_dict(conn, cached)
        else:

            provider = "openrouter"
            if not ai_document_ai_enabled():
                raise HTTPException(status_code=409, detail="Document AI disabled")
            api_key = ai_api_key_for_provider(provider)
            use_cloud = cloud_ai_configured()
            cached = latest_document_analysis(conn, document_id, provider="cloud" if use_cloud else "openrouter")
            if cached and not payload.re_analyze:
                return analysis_to_dict(conn, cached)

        path = Path(document["stored_path"])
        if not path.exists():
            raise HTTPException(status_code=404, detail="Fichier document introuvable")
        if path.stat().st_size > max_ai_file_bytes():
            raise HTTPException(status_code=413, detail="Fichier trop volumineux pour l'analyse IA")
        document_type = detect_document_type(document)
        if payload.force_local:
            model = "local-ocr-rules"
            data = local_rule_analysis(document, path, document_type)
        else:
            model = ai_document_model_for_provider("openrouter")
            local_preview = local_rule_analysis(document, path, document_type)
            raw_text = limited_text(local_preview.get("raw_ocr") or local_extract_text(path, guess_document_mime(document, path)), AI_DOCUMENT_CONTEXT_LIMIT)
            if not raw_text:
                data = local_preview
                provider = "local"
                model = "local-ocr-rules"
            else:
                prompt = build_document_ai_prompt(document_type, document, raw_text, local_preview, analysis_mode)
                messages = [ChatMessage(role="system", content=prompt), ChatMessage(role="user", content="Retourne uniquement le JSON demandé.")]
                estimated_input_tokens = estimate_messages_tokens(messages)
                estimated_output_tokens = analysis_mode_token_limit(analysis_mode)
                ensure_ai_usage_budget(conn, estimated_input_tokens + estimated_output_tokens)

                # === CREDIT SYSTEM: classify action and check ===
                doc_type_lower = (document_type or "").lower()
                if "ecg" in doc_type_lower:
                    action_type = "ecg_analysis"
                elif "irm" in doc_type_lower or "mri" in doc_type_lower:
                    action_type = "irm_analysis"
                elif any(k in doc_type_lower for k in ("echo", "scanner", "ct", "imaging", "image", "rx")):
                    action_type = "image_analysis"
                elif any(k in doc_type_lower for k in ("lab", "biolog", "analyse")):
                    action_type = "lab_analysis"
                else:
                    action_type = "pdf_analysis"
                # === CLOUD PROXY REDIRECTION ===
                if use_cloud and not payload.force_local:
                    provider = "cloud"
                    model = LOCKED_AI_MODEL
                    cloud_response = _cloud_ai_request(
                        "/api/me/ai/analyze-document",
                        {"document_id": document_id, "messages": [asdict(m) for m in messages], "action_type": action_type},
                        timeout=120,
                    )
                    cloud_payload = cloud_response.get("analysis") or cloud_response.get("data") or cloud_response
                    if isinstance(cloud_payload, dict):
                        parsed = dict(cloud_payload)
                    else:
                        parsed = parse_ai_json_text(_extract_cloud_text(cloud_payload))
                    parsed.setdefault("analysis_mode", analysis_mode)
                    parsed.setdefault("raw_ocr", raw_text)
                    parsed.setdefault("summary", local_preview.get("summary"))
                    parsed.setdefault("important_points", local_preview.get("important_points", []))
                    parsed.setdefault("possible_abnormalities", local_preview.get("possible_abnormalities", []))
                    parsed.setdefault("extracted_values", local_preview.get("extracted_values", []))
                    parsed.setdefault("risk_level", local_preview.get("risk_level", "faible"))
                    data = normalize_ai_payload(parsed, document_type, raw_text)
                    output_tokens = estimate_text_tokens(json.dumps(parsed, ensure_ascii=False, default=str))
                    with connect() as usage_conn:
                        log_ai_usage(
                            usage_conn,
                            "document",
                            model,
                            estimated_input_tokens,
                            output_tokens,
                            estimated_input_tokens + output_tokens,
                            patient_id=document["patient_id"],
                            document_id=document_id,
                            analysis_mode=analysis_mode,
                        )
                else:
                    if not api_key:
                        raise HTTPException(status_code=409, detail="AI analysis unavailable")

                    doctor_id_local = _doctor_id_from_request()
                    credit_cost_local = check_credits_or_raise(doctor_id_local, action_type)

                    try:
                        response = OpenRouterProvider(model=model, api_key=api_key, max_new_tokens=analysis_mode_token_limit(analysis_mode)).chat(messages)
                    except AIProviderError as exc:
                        detail_msg = str(exc)[:500]
                        deduct_credits(doctor_id_local, action_type, credit_cost_local,
                                       document_id=document_id, patient_id=document["patient_id"],
                                       success=False, details=detail_msg)
                        raise HTTPException(status_code=502, detail=detail_msg) from exc

                    # Success - deduct credits
                    deduct_credits(doctor_id_local, action_type, credit_cost_local,
                                   document_id=document_id, patient_id=document["patient_id"],
                                   success=True, details=f"document_type={document_type}")
                    parsed = parse_ai_json_text(response.content)
                    parsed.setdefault("analysis_mode", analysis_mode)
                    parsed.setdefault("raw_ocr", raw_text)
                    parsed.setdefault("summary", local_preview.get("summary"))
                    parsed.setdefault("important_points", local_preview.get("important_points", []))
                    parsed.setdefault("possible_abnormalities", local_preview.get("possible_abnormalities", []))
                    parsed.setdefault("extracted_values", local_preview.get("extracted_values", []))
                    parsed.setdefault("risk_level", local_preview.get("risk_level", "faible"))
                    data = normalize_ai_payload(parsed, document_type, raw_text)
                    output_tokens = estimate_text_tokens(response.content)
                    with connect() as usage_conn:
                        log_ai_usage(
                            usage_conn,
                            "document",
                            model,
                            estimated_input_tokens,
                            output_tokens,
                            estimated_input_tokens + output_tokens,
                            patient_id=document["patient_id"],
                            document_id=document_id,
                            analysis_mode=analysis_mode,
                        )
        data = normalize_ai_payload(data, document_type, data.get("raw_ocr", ""))
        data["analysis_mode"] = analysis_mode if payload.force_local or provider == "openrouter" else data.get("analysis_mode", ai_analysis_mode())
        analysis = create_ai_analysis_record(conn, document, provider, model, document_type, data)
        audit("create", "ai_document_analyses", analysis["id"], f"Analyse IA {provider} document {document_id}")
        return analysis


def get_ai_analysis_or_404(conn: sqlite3.Connection, analysis_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM ai_document_analyses WHERE id = ?", (analysis_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Analyse IA introuvable")
    return row


LAB_RESULT_FIELD_MAP = {
    "total cholesterol": "total_cholesterol",
    "cholesterol total": "total_cholesterol",
    "ldl": "ldl",
    "hdl": "hdl",
    "triglycerides": "triglycerides",
    "troponin": "troponin",
    "bnp": "bnp",
    "nt-probnp": "nt_probnp",
    "nt probnp": "nt_probnp",
    "creatinine": "creatinine",
}


def lab_result_field_for_analyte(analyte: str) -> str | None:
    normalized = analyte.strip().lower().replace("é", "e").replace("è", "e")
    return LAB_RESULT_FIELD_MAP.get(normalized)


@app.post("/api/patients/{patient_id}/documents", status_code=201)
async def upload_document(
    patient_id: int,
    type_document: str = Form("Analyse"),
    notes: str = Form(""),
    file: UploadFile = File(...),
) -> dict[str, Any]:
    return save_uploaded_document(patient_id, type_document, file, notes, "desktop")


@app.get("/api/documents/{document_id}")
def download_document(document_id: int) -> FileResponse:
    with connect() as conn:
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return FileResponse(row["stored_path"], filename=row["original_name"])


@app.put("/api/documents/{document_id}/notes")
def update_document_notes(document_id: int, payload: DocumentNoteIn) -> dict[str, Any]:
    with connect() as conn:
        exists = conn.execute("SELECT id FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Document introuvable")
        conn.execute("UPDATE documents SET notes = ? WHERE id = ?", (payload.notes, document_id))
    audit("update", "documents", document_id, "Notes document")
    return {"ok": True}


@app.post("/api/documents/{document_id}/ai-analyze")
def api_analyze_document(document_id: int, payload: AIAnalyzeIn | None = None) -> dict[str, Any]:
    analysis = analyze_document_with_ai(document_id, payload or AIAnalyzeIn())
    return {"analysis": analysis}


@app.post("/api/documents/{document_id}/sync-cloud")
def api_sync_cloud_analysis(document_id: int, body: dict[str, Any]) -> dict[str, Any]:
    with connect() as conn:
        doc = conn.execute("SELECT * FROM documents WHERE id = ?", (document_id,)).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document introuvable")
        provider = body.get("provider", "cloud")
        model = body.get("model", "qwen-2.5-7b")
        data = body.get("data", {})
        if isinstance(data, str):
            data = parse_ai_json_text(data)
        # Use existing logic to save it as a local analysis
        analysis = create_ai_analysis_record(conn, dict(doc), provider, model, doc["type_document"], data)
    audit("sync", "ai_document_analyses", analysis["id"], f"Synchronisation cloud document {document_id}")
    return {"analysis": analysis}


@app.get("/api/documents/{document_id}/ai-analysis")
def api_document_ai_analysis(document_id: int) -> dict[str, Any]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT * FROM ai_document_analyses WHERE document_id = ? ORDER BY created_at DESC, id DESC",
            (document_id,),
        ).fetchall()
        analyses = [analysis_to_dict(conn, row) for row in rows]
    return {"rows": analyses}


@app.put("/api/ai-analysis/{analysis_id}/accept")
def api_accept_ai_analysis(analysis_id: int, payload: AIAnalysisEditIn | None = Body(default=None)) -> dict[str, Any]:
    with connect() as conn:
        row = get_ai_analysis_or_404(conn, analysis_id)
        extracted = payload.extracted_json if payload and payload.extracted_json is not None else json.loads(row["extracted_json"] or "{}")
        summary = (payload.summary if payload and payload.summary is not None else row["validated_summary"] or row["summary"]) or ""
        conn.execute(
            """
            UPDATE ai_document_analyses
            SET status = 'accepted',
                validated_summary = ?,
                validated_extracted_json = ?,
                validated_by_doctor_at = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (summary, json.dumps(extracted, ensure_ascii=False), now_iso(), now_iso(), analysis_id),
        )
        updated = get_ai_analysis_or_404(conn, analysis_id)
        result = analysis_to_dict(conn, updated)
    audit("accept", "ai_document_analyses", analysis_id, "Analyse IA acceptee par le medecin")
    return {"analysis": result}


@app.put("/api/ai-analysis/{analysis_id}/reject")
def api_reject_ai_analysis(analysis_id: int) -> dict[str, Any]:
    with connect() as conn:
        get_ai_analysis_or_404(conn, analysis_id)
        conn.execute(
            "UPDATE ai_document_analyses SET status = 'rejected', validated_by_doctor_at = ?, updated_at = ? WHERE id = ?",
            (now_iso(), now_iso(), analysis_id),
        )
        result = analysis_to_dict(conn, get_ai_analysis_or_404(conn, analysis_id))
    audit("reject", "ai_document_analyses", analysis_id, "Analyse IA rejetee par le medecin")
    return {"analysis": result}


@app.put("/api/ai-analysis/{analysis_id}/edit")
def api_edit_ai_analysis(analysis_id: int, payload: AIAnalysisEditIn) -> dict[str, Any]:
    with connect() as conn:
        row = get_ai_analysis_or_404(conn, analysis_id)
        extracted = payload.extracted_json if payload.extracted_json is not None else json.loads(row["validated_extracted_json"] or row["extracted_json"] or "{}")
        summary = payload.summary if payload.summary is not None else row["validated_summary"] or row["summary"]
        risk_level = normalize_risk_level(payload.risk_level or row["risk_level"])
        confidence = payload.confidence if payload.confidence is not None else row["confidence"]
        conn.execute(
            """
            UPDATE ai_document_analyses
            SET validated_summary = ?,
                validated_extracted_json = ?,
                risk_level = ?,
                confidence = ?,
                updated_at = ?
            WHERE id = ?
            """,
            (summary, json.dumps(extracted, ensure_ascii=False), risk_level, confidence, now_iso(), analysis_id),
        )
        result = analysis_to_dict(conn, get_ai_analysis_or_404(conn, analysis_id))
    audit("update", "ai_document_analyses", analysis_id, "Analyse IA modifiee par le medecin")
    return {"analysis": result}


@app.post("/api/ai-analysis/{analysis_id}/save-labs")
def api_save_ai_labs(analysis_id: int, payload: AISaveLabsIn | None = None) -> dict[str, Any]:
    with connect() as conn:
        analysis = get_ai_analysis_or_404(conn, analysis_id)
        document = conn.execute("SELECT * FROM documents WHERE id = ?", (analysis["document_id"],)).fetchone()
        if not document:
            raise HTTPException(status_code=404, detail="Document introuvable")
        values = payload.values if payload and payload.values else []
        if not values:
            values = [
                ExtractedLabValueIn(**dict(row))
                for row in conn.execute(
                    "SELECT * FROM extracted_lab_values WHERE source_ai_analysis_id = ?",
                    (analysis_id,),
                ).fetchall()
            ]
        mapped: dict[str, float] = {}
        confirmed_ids: list[int] = []
        for item in values:
            field = lab_result_field_for_analyte(item.analyte)
            number = parse_float(item.value)
            if field and number is not None:
                mapped[field] = number
            if item.id:
                conn.execute(
                    """
                    UPDATE extracted_lab_values
                    SET analyte = ?, value = ?, unit = ?, reference_range = ?, abnormal_flag = ?, doctor_confirmed = 1
                    WHERE id = ? AND source_ai_analysis_id = ?
                    """,
                    (item.analyte, item.value, item.unit, item.reference_range, item.abnormal_flag, item.id, analysis_id),
                )
                confirmed_ids.append(item.id)
            else:
                cur = conn.execute(
                    """
                    INSERT INTO extracted_lab_values
                    (patient_id, document_id, analyte, value, unit, reference_range, abnormal_flag, source_ai_analysis_id, doctor_confirmed)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                    """,
                    (
                        analysis["patient_id"],
                        analysis["document_id"],
                        item.analyte,
                        item.value,
                        item.unit,
                        item.reference_range,
                        item.abnormal_flag,
                        analysis_id,
                    ),
                )
                confirmed_ids.append(cur.lastrowid)
        lab_result_id = None
        if mapped:
            columns = ["patient_id", "measured_at", "notes", *mapped.keys()]
            placeholders = ", ".join("?" for _ in columns)
            notes = f"Valeurs confirmees depuis analyse IA document {analysis['document_id']}. {AI_SAFETY_WARNING}"
            params = [analysis["patient_id"], now_iso(), notes, *mapped.values()]
            cur = conn.execute(
                f"INSERT INTO lab_results ({', '.join(columns)}) VALUES ({placeholders})",
                params,
            )
            lab_result_id = cur.lastrowid
        result = analysis_to_dict(conn, get_ai_analysis_or_404(conn, analysis_id))
    audit("create", "extracted_lab_values", analysis_id, "Valeurs biologiques IA confirmees")
    return {"ok": True, "analysis": result, "confirmed_ids": confirmed_ids, "lab_result_id": lab_result_id}


@app.post("/api/ai/test-provider")
def api_test_ai_provider(payload: AITestProviderIn | None = None) -> dict[str, Any]:
    _ = payload or AITestProviderIn()
    provider = "openrouter"
    model = LOCKED_AI_MODEL
    api_key = ai_api_key_for_provider(provider)
    if not api_key:
        raise HTTPException(status_code=409, detail="Cle OpenRouter manquante")
    try:
        answer = make_chat_provider(provider, model, max_new_tokens=16).chat([
            ChatMessage(role="user", content="Reponds uniquement OK."),
        ])
    except AIProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)[:500]) from exc
    return {"ok": True, "provider": provider, "model": model, "message": (answer.content or "OK").strip() or "OK"}


@app.get("/api/ai/settings")
def api_ai_settings() -> dict[str, Any]:
    return {"settings": ai_settings_payload(), "safety_note": AI_DECISION_SUPPORT_WARNING}


@app.get("/api/ai/usage")
def api_ai_usage(limit: int = 12) -> dict[str, Any]:
    safe_limit = max(1, min(limit, 50))
    with connect() as conn:
        summary = ai_usage_summary(conn)
        recent = rows_to_dicts(
            conn.execute(
                "SELECT * FROM ai_usage_logs ORDER BY created_at DESC, id DESC LIMIT ?",
                (safe_limit,),
            ).fetchall()
        )
    return {"summary": summary, "recent": recent}


@app.put("/api/ai/settings")
def api_update_ai_settings(payload: AISettingsUpdateIn) -> dict[str, Any]:
    allowed = {key for key in DEFAULT_SETTINGS if key.startswith("AI_")}
    for key, value in payload.settings.items():
        normalized_key = key.upper()
        if normalized_key not in allowed:
            raise HTTPException(status_code=400, detail=f"Parametre IA non autorise: {key}")
        set_setting(normalized_key, "" if value is None else str(value))
    enforce_locked_ai_settings()
    audit("update", "ai_settings", None, "Parametres IA mis a jour")
    return {"ok": True, "settings": ai_settings_payload()}


@app.post("/api/ai/chat")
def api_ai_chat(payload: AIChatIn) -> dict[str, Any]:
    return run_ai_chat(payload, patient_id=None)


@app.post("/api/ai/patient-chat/{patient_id}")
def api_ai_patient_chat(patient_id: int, payload: AIChatIn) -> dict[str, Any]:
    return run_ai_chat(payload, patient_id=patient_id)


# =====================================================================
# AI CREDIT SYSTEM - PUBLIC ENDPOINTS
# =====================================================================
@app.get("/api/ai/subscription")
def api_ai_subscription() -> dict[str, Any]:
    doctor_id = _doctor_id_from_request()
    state = subscription_state(doctor_id)
    state["plans"] = AI_PLANS
    state["credit_costs"] = credit_costs()
    return state


@app.get("/api/ai/credit-logs")
def api_ai_credit_logs(limit: int = 50) -> dict[str, Any]:
    doctor_id = _doctor_id_from_request()
    limit = max(1, min(int(limit or 50), 500))
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            """SELECT * FROM ai_credit_logs WHERE doctor_id = ?
               ORDER BY created_at DESC, id DESC LIMIT ?""",
            (doctor_id, limit),
        ).fetchall())
        # Aggregate stats
        total_used = conn.execute(
            "SELECT COALESCE(SUM(credits_used), 0) AS total FROM ai_credit_logs WHERE doctor_id = ?",
            (doctor_id,),
        ).fetchone()["total"]
        cache_hits = conn.execute(
            "SELECT COUNT(*) AS total FROM ai_credit_logs WHERE doctor_id = ? AND cached = 1",
            (doctor_id,),
        ).fetchone()["total"]
        # Daily usage last 30 days
        daily = rows_to_dicts(conn.execute(
            """SELECT substr(created_at, 1, 10) AS day, SUM(credits_used) AS credits
               FROM ai_credit_logs WHERE doctor_id = ?
               GROUP BY day ORDER BY day DESC LIMIT 30""",
            (doctor_id,),
        ).fetchall())
    return {"rows": rows, "total_used": total_used, "cache_hits": cache_hits, "daily": daily}


@app.get("/api/ai/plans")
def api_ai_plans() -> dict[str, Any]:
    return {"plans": AI_PLANS, "credit_costs": credit_costs()}


class AIPlanChangeIn(BaseModel):
    plan_name: str


@app.post("/api/ai/subscription/plan")
def api_ai_change_plan(payload: AIPlanChangeIn) -> dict[str, Any]:
    plan_name = (payload.plan_name or "").strip().lower()
    if plan_name not in AI_PLANS:
        raise HTTPException(status_code=400, detail="Plan inconnu")
    plan = AI_PLANS[plan_name]
    doctor_id = _doctor_id_from_request()
    with connect() as conn:
        get_or_create_subscription(conn, doctor_id)
        conn.execute(
            """UPDATE ai_subscriptions
               SET plan_name = ?, monthly_credits = ?, unlimited = ?, updated_at = ?
               WHERE doctor_id = ?""",
            (plan_name, plan["monthly_credits"], 1 if plan["unlimited"] else 0, now_iso(), doctor_id),
        )
    audit("update", "ai_subscriptions", doctor_id, f"Plan -> {plan_name}")
    return subscription_state(doctor_id)


@app.post("/api/ai/subscription/toggle")
def api_ai_toggle() -> dict[str, Any]:
    doctor_id = _doctor_id_from_request()
    with connect() as conn:
        sub = get_or_create_subscription(conn, doctor_id)
        new_value = 0 if sub["ai_enabled"] else 1
        conn.execute(
            "UPDATE ai_subscriptions SET ai_enabled = ?, updated_at = ? WHERE doctor_id = ?",
            (new_value, now_iso(), doctor_id),
        )
    return subscription_state(doctor_id)


@app.get("/api/ai/conversations")
def api_ai_conversations(patient_id: int | None = None, limit: int = 30) -> dict[str, Any]:
    sql = "SELECT * FROM ai_conversations"
    params: list[Any] = []
    if patient_id is not None:
        sql += " WHERE patient_id = ?"
        params.append(patient_id)
    sql += " ORDER BY updated_at DESC, id DESC LIMIT ?"
    params.append(limit)
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(sql, params).fetchall())
    return {"rows": rows}


@app.get("/api/ai/conversations/{conversation_id}")
def api_ai_conversation(conversation_id: int) -> dict[str, Any]:
    with connect() as conn:
        conversation = conn.execute("SELECT * FROM ai_conversations WHERE id = ?", (conversation_id,)).fetchone()
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation IA introuvable")
        messages = rows_to_dicts(conn.execute(
            "SELECT * FROM ai_messages WHERE conversation_id = ? ORDER BY created_at ASC, id ASC",
            (conversation_id,),
        ).fetchall())
    return {"conversation": dict(conversation), "messages": messages, "safety_note": AI_DECISION_SUPPORT_WARNING}


@app.get("/api/patients/{patient_id}/qr")
def patient_qr(patient_id: int) -> Response:
    token_info = create_mobile_upload_token(patient_id)
    url = token_info["url"]
    if qrcode is None:
        svg = f"<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><rect width='240' height='240' fill='white'/><text x='16' y='110' font-size='12'>{url}</text></svg>"
        return Response(svg, media_type="image/svg+xml")
    img = qrcode.make(url)
    out = DATA / f"qr_patient_{patient_id}.png"
    img.save(out)
    return FileResponse(out, media_type="image/png")


@app.post("/api/patients/{patient_id}/mobile-upload-token", response_model=MobileUploadTokenOut)
def mobile_upload_token(patient_id: int) -> dict[str, str]:
    token_info = create_mobile_upload_token(patient_id)
    audit("create", "mobile_upload_tokens", patient_id, "QR upload mobile 15 minutes")
    return token_info


@app.get("/mobile-upload/{token}", response_class=HTMLResponse)
def mobile_upload_page_legacy(token: str) -> str:
    return """<!doctype html><html lang="fr"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Upload mobile</title></head>
    <body style="font-family:Arial;padding:20px;background:#e8f3ff"><h2>Ancien lien expire</h2><p>Veuillez scanner le nouveau QR code depuis le logiciel du cabinet.</p></body></html>"""


MOBILE_PAGE_HTML = """<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Upload Document Medical</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Segoe UI',system-ui,sans-serif;background:linear-gradient(135deg,#e3f0ff 0%,#f0f7ff 100%);min-height:100vh;color:#173553}
.container{max-width:420px;margin:0 auto;padding:24px 16px}
.logo{text-align:center;margin-bottom:18px}
.logo h1{font-size:20px;color:#1a5276}
.logo p{font-size:13px;color:#5b7288}
.card{background:#fff;border-radius:12px;padding:20px;box-shadow:0 2px 12px rgba(0,0,0,.08);margin-bottom:16px}
.status{padding:10px 14px;border-radius:8px;font-size:13px;font-weight:600;margin-bottom:14px}
.status--ok{background:#effaf4;color:#1a5a3a;border:1px solid #56a37c}
.status--error{background:#fff0ee;color:#7b2118;border:1px solid #e8685a}
.status--info{background:#e8f3ff;color:#1a5276;border:1px solid #8fb8d8}
label{display:block;font-size:13px;font-weight:600;margin-bottom:6px;color:#1a5276}
select,input[type=file]{width:100%;padding:10px;border:1px solid #c4d9ed;border-radius:8px;font-size:14px;margin-bottom:12px;background:#f8fbff}
textarea{width:100%;padding:10px;border:1px solid #c4d9ed;border-radius:8px;font-size:14px;margin-bottom:12px;background:#f8fbff;resize:vertical;min-height:60px}
button[type=submit]{width:100%;padding:12px;background:linear-gradient(135deg,#1a5276,#2e86c1);color:#fff;border:none;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}
button[type=submit]:disabled{opacity:.5;cursor:not-allowed}
.progress-bar{height:24px;border:1px solid #8fb8d8;border-radius:7px;background:#eef7ff;overflow:hidden;position:relative;margin-bottom:12px;display:none}
.progress-fill{height:100%;width:0%;background:linear-gradient(90deg,#56a37c,#3fa97a);border-radius:6px;transition:width .2s}
.progress-text{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:11px;font-weight:700;color:#173553}
.privacy{text-align:center;font-size:11px;color:#5b7288;margin-top:10px;line-height:1.5}
form{display:none}
</style>
</head>
<body>
<div class="container">
  <div class="logo">
    <h1>MediSmart</h1>
    <p>Upload document medical securise</p>
  </div>
  <div class="card">
    <div id="status" class="status status--info">Verification du lien...</div>
    <form id="uploadForm">
      <label>Type de document</label>
      <select name="type_document">
        <option value="Mobile">Document mobile</option>
        <option value="Analyse biologique">Analyse biologique</option>
        <option value="ECG">ECG</option>
        <option value="Scanner">Scanner</option>
        <option value="IRM">IRM</option>
        <option value="Echo coeur">Echo coeur</option>
        <option value="PDF">PDF</option>
      </select>
      <label>Notes (optionnel)</label>
      <textarea name="notes" placeholder="Ajouter une note..."></textarea>
      <label>Fichier (PDF, JPG, PNG, DICOM)</label>
      <input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.dcm,.dicom" required />
      <div class="progress-bar" id="progressBar">
        <div class="progress-fill" id="progressFill"></div>
        <span class="progress-text" id="progressText"></span>
      </div>
      <button type="submit">Envoyer au dossier patient</button>
    </form>
  </div>
  <p class="privacy">Les fichiers sont envoyes directement au PC du cabinet.<br>Aucune donnee medicale n'est stockee en ligne.</p>
</div>
<script>
(function(){
  const ALLOWED=[".pdf",".jpg",".jpeg",".png",".dcm",".dicom"];
  const BLOCKED=[".exe",".bat",".cmd",".com",".msi",".scr",".pif",".vbs",".js",".ws",".wsf"];
  const MAX=50*1024*1024;
  const statusEl=document.getElementById("status");
  const form=document.getElementById("uploadForm");
  const fileInput=form.querySelector("input[name='file']");
  const progressBar=document.getElementById("progressBar");
  const progressFill=document.getElementById("progressFill");
  const progressText=document.getElementById("progressText");
  const params=new URLSearchParams(window.location.search);
  const token=params.get("token")||"";
  const pathMatch=window.location.pathname.match(/^\\/m\\/(\\d+)/);
  const patientId=pathMatch?pathMatch[1]:"";
  function show(msg,type){statusEl.textContent=msg;statusEl.className="status status--"+type}
  if(!patientId||!token){show("Lien invalide. Scannez un nouveau QR depuis le logiciel.","error");return}
  show("Lien valide 15 min. Choisissez un fichier a envoyer.","ok");
  form.style.display="block";
  function ext(name){const d=name.lastIndexOf(".");return d>=0?name.slice(d).toLowerCase():""}
  fileInput.addEventListener("change",function(){
    const f=fileInput.files[0];if(!f)return;
    const e=ext(f.name);
    if(BLOCKED.includes(e)){fileInput.value="";show("Fichier executable refuse.","error");return}
    if(!ALLOWED.includes(e)){fileInput.value="";show("Seuls PDF, JPG, PNG, DICOM sont acceptes.","error");return}
    if(f.size>MAX){fileInput.value="";show("Fichier trop gros. Maximum 50 Mo.","error");return}
    show(f.name+" ("+(f.size/1024/1024).toFixed(1)+" Mo) pret.","ok");
  });
  form.addEventListener("submit",function(ev){
    ev.preventDefault();
    const f=fileInput.files[0];if(!f){show("Choisissez un fichier.","error");return}
    const fd=new FormData(form);fd.set("token",token);
    const btn=form.querySelector("button");btn.disabled=true;
    show("Envoi en cours...","info");
    progressBar.style.display="block";progressFill.style.width="0%";progressText.textContent="0%";
    const xhr=new XMLHttpRequest();
    xhr.upload.addEventListener("progress",function(e){if(e.lengthComputable){const p=Math.round(e.loaded/e.total*100);progressFill.style.width=p+"%";progressText.textContent=p+"%"}});
    xhr.addEventListener("load",function(){
      if(xhr.status>=200&&xhr.status<300){form.reset();progressFill.style.width="100%";progressText.textContent="100%";show("Document envoye avec succes ! Il apparait sur le PC du cabinet.","ok")}
      else{try{show(JSON.parse(xhr.responseText).detail||"Erreur","error")}catch(e){show("Erreur (code "+xhr.status+")","error")}progressBar.style.display="none"}
      btn.disabled=false;
    });
    xhr.addEventListener("error",function(){show("Erreur reseau. Verifiez la connexion.","error");progressBar.style.display="none";btn.disabled=false});
    xhr.addEventListener("timeout",function(){show("Timeout. Le PC ne repond pas.","error");progressBar.style.display="none";btn.disabled=false});
    xhr.timeout=120000;
    xhr.open("POST","/api/patients/"+patientId+"/documents/upload-mobile");
    xhr.send(fd);
  });
})();
</script>
</body>
</html>"""


def mobile_error_page(message: str) -> str:
    safe = message.replace("<", "&lt;").replace(">", "&gt;")
    return f"""<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lien QR invalide</title>
<style>
body{{font-family:'Segoe UI',system-ui,sans-serif;background:#eef6ff;color:#173553;min-height:100vh;display:grid;place-items:center;margin:0;padding:20px}}
.card{{max-width:420px;background:#fff;border:1px solid #cfe1f3;border-radius:14px;padding:24px;box-shadow:0 10px 30px rgba(30,82,118,.12);text-align:center}}
h1{{font-size:20px;color:#1d4ed8;margin:0 0 10px}}p{{font-size:14px;line-height:1.5;color:#475569}}.badge{{display:inline-block;margin-top:10px;padding:6px 10px;border-radius:999px;background:#fff7ed;color:#9a3412;font-weight:700;font-size:12px}}
</style></head><body><main class="card"><h1>Upload mobile indisponible</h1><p>{safe}</p><span class="badge">Scanner un nouveau QR 15 min</span></main></body></html>"""


@app.get("/m/{patient_id}", response_class=HTMLResponse)
def self_hosted_mobile_page(patient_id: int, token: str = "") -> str:
    error = mobile_token_error(patient_id, token)
    if error:
        return mobile_error_page(error)
    return MOBILE_PAGE_HTML


@app.post("/api/patients/{patient_id}/documents/upload-mobile", status_code=201)
async def upload_document_mobile(
    patient_id: int,
    token: str = Form(...),
    type_document: str = Form("Mobile"),
    notes: str = Form("Upload depuis telephone"),
    file: UploadFile = File(...),
) -> JSONResponse:
    validate_mobile_file(file)
    with connect() as conn:
        patient = conn.execute("SELECT id FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        validate_mobile_upload_token(conn, patient_id, token)
    result = save_uploaded_document(patient_id, type_document, file, notes, "QR Mobile")
    return JSONResponse({"ok": True, "document": result}, status_code=201)


@app.post("/api/mobile-upload/{token}", status_code=201)
async def mobile_upload(token: str, type_document: str = Form("Mobile"), file: UploadFile = File(...)) -> JSONResponse:
    raise HTTPException(status_code=410, detail="Ancien endpoint desactive. Scanner un nouveau QR Vercel avec token 15 minutes.")


@app.get("/api/appointments")
def list_appointments(date_from: str = "", date_to: str = "") -> dict[str, Any]:
    sql = """
        SELECT a.*, p.nom, p.prenom, p.code
        FROM appointments a
        LEFT JOIN patients p ON p.id = a.patient_id
        WHERE (? = '' OR date(a.scheduled_at) >= date(?))
          AND (? = '' OR date(a.scheduled_at) <= date(?))
        ORDER BY a.scheduled_at ASC
        LIMIT 300
    """
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(sql, (date_from, date_from, date_to, date_to)).fetchall())
    return {"rows": rows}


@app.post("/api/appointments", status_code=201)
def create_appointment(payload: AppointmentIn) -> dict[str, Any]:
    with connect() as conn:
        cur = conn.execute(
            """
            INSERT INTO appointments
            (patient_id, title, scheduled_at, status, reminder_channel, reminder_note, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.patient_id,
                payload.title,
                payload.scheduled_at,
                payload.status,
                payload.reminder_channel,
                payload.reminder_note,
                payload.notes,
            ),
        )
        appointment_id = cur.lastrowid
    audit("create", "appointments", appointment_id, f"Rendez-vous {payload.status}")
    return {"id": appointment_id}


@app.put("/api/appointments/{appointment_id}")
def update_appointment(appointment_id: int, payload: AppointmentIn) -> dict[str, Any]:
    with connect() as conn:
        exists = conn.execute("SELECT id FROM appointments WHERE id = ?", (appointment_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Rendez-vous introuvable")
        conn.execute(
            """
            UPDATE appointments
            SET patient_id=?, title=?, scheduled_at=?, status=?, reminder_channel=?,
                reminder_note=?, notes=?, updated_at=?
            WHERE id=?
            """,
            (
                payload.patient_id,
                payload.title,
                payload.scheduled_at,
                payload.status,
                payload.reminder_channel,
                payload.reminder_note,
                payload.notes,
                now_iso(),
                appointment_id,
            ),
        )
    audit("update", "appointments", appointment_id, "Modification rendez-vous")
    return {"ok": True}


def detect_google_drive_sync_dir() -> str:
    home = Path.home()
    candidates = [
        home / "Google Drive",
        home / "My Drive",
        home / "Mon Drive",
        home / "GoogleDrive",
        Path("G:/My Drive"),
    ]
    for candidate in candidates:
        try:
            if candidate.exists() and candidate.is_dir():
                return str(candidate)
        except Exception:
            continue
    return ""


def resolve_google_drive_backup_dir() -> tuple[str, str]:
    configured = (get_setting("GOOGLE_DRIVE_BACKUP_DIR") or "").strip()
    if configured:
        path = Path(configured)
        if path.exists() and path.is_dir():
            return str(path), "configured"
    detected = detect_google_drive_sync_dir()
    if detected:
        return detected, "auto_detected"
    return "", "not_configured"


@app.post("/api/backups", status_code=201)
def create_backup() -> dict[str, Any]:
    BACKUPS.mkdir(parents=True, exist_ok=True)
    backup_path = BACKUPS / f"cardio_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}.sqlite3"
    shutil.copy2(DB_PATH, backup_path)
    drive_copy = ""
    drive_dir, drive_status = resolve_google_drive_backup_dir()
    if drive_dir:
        target_dir = Path(drive_dir) / "CardioCabinetBackups"
        target_dir.mkdir(parents=True, exist_ok=True)
        target_path = target_dir / backup_path.name
        shutil.copy2(backup_path, target_path)
        drive_copy = str(target_path)
        drive_status = "copied_to_drive_sync_folder" if drive_status == "configured" else "copied_to_auto_detected_drive"
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO backups (file_path, size_bytes) VALUES (?, ?)",
            (str(backup_path), backup_path.stat().st_size),
        )
    audit("backup", "database", cur.lastrowid, str(backup_path))
    return {
        "id": cur.lastrowid,
        "file_path": str(backup_path),
        "google_drive_email": get_setting("GOOGLE_DRIVE_BACKUP_EMAIL"),
        "google_drive_dir": drive_dir,
        "google_drive_status": drive_status,
        "google_drive_copy": drive_copy,
        "message": (
            "Backup copie dans le dossier Google Drive synchronise."
            if drive_copy
            else "Configurez GOOGLE_DRIVE_BACKUP_DIR ou utilisez un dossier Google Drive synchronise localement."
        ),
    }


@app.get("/api/audit")
def audit_entries(limit: int = 100) -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(conn.execute("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall())
    return {"rows": rows}


@app.get("/api/export/patients.csv")
def export_patients_csv() -> FileResponse:
    out = DATA / "patients_export.csv"
    with connect() as conn, out.open("w", newline="", encoding="utf-8") as handle:
        rows = rows_to_dicts(conn.execute("SELECT * FROM patients ORDER BY nom, prenom").fetchall())
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys() if rows else ["id", "nom", "prenom"])
        writer.writeheader()
        writer.writerows(rows)
    return FileResponse(out, media_type="text/csv", filename="patients_export.csv")


class SettingIn(BaseModel):
    key: str
    value: str


@app.get("/api/settings")
def api_get_settings() -> dict[str, Any]:
    settings = get_all_settings()
    return {"settings": settings}


@app.put("/api/settings")
def api_update_setting(payload: SettingIn) -> dict[str, Any]:
    set_setting(payload.key, payload.value)
    if payload.key.upper().startswith("AI_"):
        enforce_locked_ai_settings()
    if payload.key in SECRET_SETTING_KEYS:
        state = "configuree" if payload.value else "supprimee"
        audit("update", "app_settings", None, f"{payload.key} {state}")
    else:
        audit("update", "app_settings", None, f"{payload.key} = {payload.value}")
    return {"ok": True}


@app.get("/api/upload-mode")
def api_upload_mode() -> dict[str, Any]:
    """Return current upload mode status for the frontend."""
    mode = get_setting("UPLOAD_MODE")
    if mode == "remote" and tunnel_manager.find_binary():
        current = tunnel_manager.get_status()
        if current.get("status") not in {"running", "starting"}:
            tunnel_manager.start()
    tunnel = tunnel_manager.get_status()
    # If tunnel is live but setting wasn't persisted, treat as remote
    if (tunnel.get("url") or "").startswith("https://") and tunnel.get("status") == "running":
        mode = "remote"
    lan_ip = get_lan_ip()
    local_url = f"http://{lan_ip}:8000"
    public_pc_url = get_setting("PUBLIC_PC_UPLOAD_URL").strip().rstrip("/") or (tunnel.get("url") or "")
    vercel_url = get_setting("VERCEL_UPLOAD_URL").strip().rstrip("/") or DEFAULT_SETTINGS["VERCEL_UPLOAD_URL"]
    active_url = get_upload_base_url()
    remote_url = get_remote_upload_base_url()
    upload_ready = bool(active_url)
    return {
        "mode": mode,
        "lan_ip": lan_ip,
        "local_url": local_url,
        "remote_url": remote_url,
        "tunnel": tunnel,
        "active_url": active_url,
        "public_pc_upload_url": public_pc_url,
        "vercel_upload_url": vercel_url,
        "upload_ready": upload_ready,
        "status_label": "Internet upload ready" if mode == "remote" and remote_url else "Local upload ready",
        "setup_message": "" if upload_ready else "URL upload indisponible.",
        "cloudflared_available": tunnel["binary_found"],
    }


@app.post("/api/upload-mode/test")
def api_upload_mode_test() -> dict[str, Any]:
    base_url = get_upload_base_url()
    if not base_url:
        return {"ok": False, "message": "URL upload non disponible."}
    try:
        with urlopen(f"{base_url}/api/health", timeout=8) as response:
            return {"ok": response.status == 200, "status": response.status, "url": base_url}
    except Exception as exc:
        return {"ok": False, "url": base_url, "message": str(exc)}


@app.get("/api/qr/debug")
def api_qr_debug() -> dict[str, Any]:
    active_url = get_upload_base_url()
    routes = {route.path for route in app.routes}
    return {
        "lan_ip": get_lan_ip(),
        "active_url": active_url,
        "upload_mode": get_setting("UPLOAD_MODE") or "local",
        "remote_url": get_remote_upload_base_url(),
        "mobile_route_ok": "/m/{patient_id}" in routes,
        "upload_route_ok": "/api/patients/{patient_id}/documents/upload-mobile" in routes,
        "qr_format": f"{active_url}/m/{{patient_id}}?token=...",
    }


@app.post("/api/tunnel/start")
def api_tunnel_start() -> dict[str, Any]:
    result = tunnel_manager.start()
    if result.get("ok"):
        audit("start", "tunnel", None, "Demarrage tunnel Cloudflare")
    return result


@app.post("/api/tunnel/stop")
def api_tunnel_stop() -> dict[str, Any]:
    result = tunnel_manager.stop()
    audit("stop", "tunnel", None, "Arret tunnel Cloudflare")
    return result


@app.get("/api/tunnel/status")
def api_tunnel_status() -> dict[str, Any]:
    return tunnel_manager.get_status()


@app.get("/api/patients/{patient_id}/documents")
def list_patient_documents(patient_id: int) -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            "SELECT * FROM documents WHERE patient_id = ? ORDER BY uploaded_at DESC",
            (patient_id,),
        ).fetchall())
    return {"rows": rows}


@app.on_event("startup")
def on_startup() -> None:
    """Auto-start tunnel if user previously enabled remote mode."""
    try:
        mode = get_setting("UPLOAD_MODE")
        if mode == "remote" and tunnel_manager.find_binary():
            tunnel_manager.start()
    except Exception:
        pass  # DB not ready yet or no setting — ignore


# =====================================================================
# MEDICINE DATABASE - Smart Search
# =====================================================================


class MedicineSearchResult(BaseModel):
    id: int
    brand_name: str
    dci: str | None = ""
    dosage_strength: str | None = ""
    form: str | None = ""
    route: str | None = ""
    source: str | None = "local"


@app.get("/api/medicines/search")
def search_medicines(q: str = "", limit: int = 100) -> dict[str, Any]:
    """Smart medicine autocomplete: search by brand, DCI, substance, CIS/CIP, indications.
    Uses FTS5 for sub-100ms results on 20k+ rows, falls back to LIKE if FTS5 unavailable."""
    term = q.strip()
    if len(term) < 2:
        return {"rows": []}

    with connect() as conn:
        # Try FTS5 first — instant ranked full-text search
        try:
            fts_rows = rows_to_dicts(conn.execute(
                """SELECT m.id, m.brand_name, m.dci, m.active_substance,
                          m.dosage_strength, m.form, m.route, m.source,
                          m.cis_code, m.cip_code, m.indications, m.laboratory
                   FROM medicines_fts f
                   JOIN medicines_db m ON m.id = f.rowid
                   WHERE medicines_fts MATCH ?
                   ORDER BY rank
                   LIMIT ?"""  # limit capped at 500,
                (term + "*", min(limit, 500)),
            ).fetchall())
            if fts_rows:
                return {"rows": fts_rows, "engine": "fts5"}
        except Exception:
            pass  # FTS5 not available or not populated — fall through

        # Fallback: LIKE search with ranking
        like = f"%{term}%"
        rows = rows_to_dicts(conn.execute(
            """SELECT id, brand_name, dci, active_substance, dosage_strength, form, route, source,
                      cis_code, cip_code, indications, laboratory
               FROM medicines_db
               WHERE brand_name LIKE ? OR dci LIKE ? OR active_substance LIKE ?
                  OR cis_code LIKE ? OR cip_code LIKE ? OR indications LIKE ?
               ORDER BY
                 CASE WHEN brand_name LIKE ? THEN 0
                      WHEN dci LIKE ? THEN 1
                      ELSE 2 END,
                 brand_name
               LIMIT ?"""  ,
            (like, like, like, like, like, like, term + "%", term + "%", min(limit, 500)),
        ).fetchall())
    return {"rows": rows, "engine": "like"}


@app.get("/api/gestion-db/medicines")
def gestion_db_medicines_list(q: str = "", limit: int = 500) -> dict[str, Any]:
    """Parse GestionMedicale SQL backup → personal medicine list with usage counts."""
    import re as _re

    sql_path = Path(__file__).parent.parent / "GestionMedicaleDBbackup_02-05-2026.sql"
    if not sql_path.exists():
        return {"rows": [], "total": 0, "error": "Fichier SQL introuvable"}

    try:
        content = sql_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        try:
            content = sql_path.read_text(encoding="latin-1", errors="replace")
        except Exception:
            return {"rows": [], "total": 0, "error": "Impossible de lire le fichier"}

    def _parse_rows(text: str, table: str) -> list:
        m = _re.search(rf"INSERT INTO `{_re.escape(table)}` VALUES\s*([\s\S]+?);", text)
        if not m:
            return []
        src = m.group(1).strip()
        rows: list = []
        row: list = []
        col: list = []
        in_str = False
        i = 0
        n = len(src)
        while i < n:
            c = src[i]
            if in_str:
                if c == '\\' and i + 1 < n:
                    nc = src[i + 1]
                    col.append("'" if nc == "'" else '\\' if nc == '\\' else '\n' if nc == 'n' else nc)
                    i += 2
                    continue
                if c == "'":
                    in_str = False
                    i += 1
                    continue
                col.append(c)
            else:
                if c == "'":
                    in_str = True
                    i += 1
                    continue
                if c == ',':
                    v = ''.join(col)
                    row.append(None if v == 'NULL' else v)
                    col = []
                    i += 1
                    continue
                if c == ')':
                    v = ''.join(col)
                    row.append(None if v == 'NULL' else v)
                    if row:
                        rows.append(row)
                    row = []
                    col = []
                    i += 1
                    continue
                if c not in ('(', ' ', '\n', '\r', '\t'):
                    col.append(c)
            i += 1
        return rows

    # Count usage from ordonnancemedicine (col index 3 = MedicineID)
    usage: dict[int, int] = {}
    for row in _parse_rows(content, "ordonnancemedicine"):
        if len(row) >= 4 and row[3] is not None:
            try:
                mid = int(str(row[3]).strip())
                usage[mid] = usage.get(mid, 0) + 1
            except Exception:
                pass

    # medicine columns: 0=ID 1=Name 2=Posologie 3=Qsp 4=Favorite 5=QuantiteMedecine
    #                   6=NombreMedecine 7=DCI 8=Laboratory 9=Description
    #                   10=DefaultQuantity 11=DefaultMedicineNbre 12=Speciality 13=Therapeutic
    medicines: list[dict[str, Any]] = []
    ql = q.strip().lower()
    for row in _parse_rows(content, "medicine"):
        if len(row) < 2 or not row[1]:
            continue
        try:
            med_id = int(str(row[0]).strip())
        except Exception:
            med_id = 0
        name = (row[1] or "").strip()
        if not name:
            continue
        posologie = (row[2] or "").strip()
        dci = (row[7] or "").strip() if len(row) > 7 else ""
        laboratory = (row[8] or "").strip() if len(row) > 8 else ""
        specialty = (row[12] or "").strip() if len(row) > 12 else ""
        try:
            favorite = bool(int(str(row[4] or "0").strip()))
        except Exception:
            favorite = False
        if ql and ql not in name.lower() and ql not in dci.lower():
            continue
        medicines.append({
            "id": med_id,
            "name": name,
            "posologie": posologie,
            "dci": dci,
            "laboratory": laboratory,
            "specialty": specialty,
            "favorite": favorite,
            "use_count": usage.get(med_id, 0),
        })

    medicines.sort(key=lambda m: (-m["use_count"], m["name"]))
    total = len(medicines)
    return {
        "rows": medicines[:limit],
        "total": total,
        "max_usage": max((m["use_count"] for m in medicines), default=0),
    }


@app.post("/api/medicines")
def add_medicine_manual(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Manually add a single medicine to the local database."""
    brand = (payload.get("brand_name") or "").strip()
    if not brand:
        raise HTTPException(status_code=400, detail="brand_name is required")
    with connect() as conn:
        existing = conn.execute(
            "SELECT id FROM medicines_db WHERE lower(brand_name)=lower(?) AND (dci IS NULL OR lower(dci)=lower(?))",
            (brand, payload.get("dci") or ""),
        ).fetchone()
        if existing:
            return {"id": existing["id"], "created": False}
        cursor = conn.execute(
            """INSERT INTO medicines_db
               (brand_name, dci, active_substance, dosage_strength, form, indications, specialty, source, last_updated, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)""",
            (brand, payload.get("dci") or "", payload.get("dci") or "",
             payload.get("dosage_strength") or "", payload.get("form") or "",
             payload.get("indications") or "", payload.get("specialty") or ""),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "created": True}


@app.get("/api/medicines/stats")
def medicines_stats() -> dict[str, Any]:
    with connect() as conn:
        total = conn.execute("SELECT COUNT(*) AS total FROM medicines_db").fetchone()["total"]
        by_source = rows_to_dicts(conn.execute(
            "SELECT source, COUNT(*) AS count FROM medicines_db GROUP BY source"
        ).fetchall())
    return {"total": total, "by_source": by_source, "last_sync": get_setting("MEDICINE_LAST_SYNC")}


# ── BDPM import state ─────────────────────────────────────────────────────────
_bdpm_import_state: dict[str, Any] = {"status": "idle", "imported": 0, "skipped": 0, "total": 0, "error": ""}


@app.get("/api/medicines/bdpm-status")
def bdpm_import_status() -> dict[str, Any]:
    return _bdpm_import_state


@app.post("/api/medicines/import-bdpm")
def import_bdpm(background_tasks: Any = None) -> dict[str, Any]:
    """Download and import French BDPM (Base de données publique des médicaments) into medicines_db."""
    import threading as _threading

    if _bdpm_import_state.get("status") == "running":
        return {"ok": False, "message": "Import déjà en cours…"}

    def _run() -> None:
        global _bdpm_import_state
        _bdpm_import_state = {"status": "running", "imported": 0, "skipped": 0, "total": 0, "error": ""}
        try:
            # CIS_bdpm.txt — main product file (tab-separated, latin-1)
            cis_url = "https://base-donnees-publique.medicaments.gouv.fr/fichier.php?fichier=CIS_bdpm.txt"
            # CIS_COMPO_bdpm.txt — composition (substance active / DCI)
            compo_url = "https://base-donnees-publique.medicaments.gouv.fr/fichier.php?fichier=CIS_COMPO_bdpm.txt"

            req_cis = UrlRequest(cis_url, headers={"User-Agent": "MediSmart/2.0"})
            req_compo = UrlRequest(compo_url, headers={"User-Agent": "MediSmart/2.0"})

            # Download CIS (main names)
            with urlopen(req_cis, timeout=60) as resp:
                raw_cis = resp.read().decode("latin-1", errors="replace")

            # Download compo (DCI / substance active)
            dci_map: dict[str, str] = {}
            try:
                with urlopen(req_compo, timeout=60) as resp:
                    raw_compo = resp.read().decode("latin-1", errors="replace")
                import io
                for row in csv.reader(io.StringIO(raw_compo), delimiter="\t"):
                    # cols: CIS, seq, substance, dosage, unit, nature, link_ref, modified
                    if len(row) >= 3:
                        cis_c, substance = row[0].strip(), row[2].strip()
                        if cis_c and substance:
                            existing = dci_map.get(cis_c, "")
                            if substance not in existing:
                                dci_map[cis_c] = (existing + " + " + substance).lstrip(" + ")
            except Exception:
                pass  # DCI lookup is optional

            import io as _io
            rows_cis = list(csv.reader(_io.StringIO(raw_cis), delimiter="\t"))
            _bdpm_import_state["total"] = len(rows_cis)

            imported = 0
            skipped = 0
            with connect() as conn:
                # Pre-load existing CIS codes for fast lookup
                existing_cis: set[str] = {
                    r[0] for r in conn.execute(
                        "SELECT cis_code FROM medicines_db WHERE cis_code IS NOT NULL"
                    ).fetchall()
                }
                batch_insert: list[tuple] = []
                batch_update: list[tuple] = []

                for row in rows_cis:
                    if len(row) < 7:
                        skipped += 1
                        continue
                    cis_code = row[0].strip()
                    name = row[1].strip()
                    form = row[2].strip()
                    route = row[3].strip()

                    if not name or not cis_code:
                        skipped += 1
                        continue

                    dci = dci_map.get(cis_code, "")

                    if cis_code in existing_cis:
                        batch_update.append((name, dci, form, route, cis_code))
                    else:
                        batch_insert.append((cis_code, name, dci, form, route))
                        existing_cis.add(cis_code)
                    imported += 1
                    _bdpm_import_state["imported"] = imported
                    _bdpm_import_state["skipped"] = skipped

                # Commit in chunks for progress feedback
                CHUNK = 500
                for i in range(0, len(batch_insert), CHUNK):
                    conn.executemany(
                        "INSERT INTO medicines_db (cis_code, brand_name, dci, form, route, source, specialty) VALUES (?,?,?,?,?,'bdpm','')",
                        batch_insert[i : i + CHUNK],
                    )
                for i in range(0, len(batch_update), CHUNK):
                    conn.executemany(
                        "UPDATE medicines_db SET brand_name=?, dci=?, form=?, route=?, source='bdpm' WHERE cis_code=?",
                        batch_update[i : i + CHUNK],
                    )

                rebuild_medicines_fts(conn)
            set_setting("MEDICINE_LAST_SYNC", now_iso())
            _bdpm_import_state["status"] = "done"
        except Exception as exc:
            _bdpm_import_state["status"] = "error"
            _bdpm_import_state["error"] = str(exc)

    _threading.Thread(target=_run, daemon=True).start()
    return {"ok": True, "message": "Import BDPM démarré en arrière-plan."}


# =====================================================================
# SPECIALTY SMART-LISTS
# =====================================================================

@app.get("/api/medicines/specialties")
def list_specialties() -> dict[str, Any]:
    with connect() as conn:
        rows = conn.execute(
            "SELECT DISTINCT specialty FROM medicines_db WHERE specialty IS NOT NULL AND specialty != '' ORDER BY specialty"
        ).fetchall()
    return {"specialties": [r["specialty"] for r in rows]}


@app.get("/api/medicines/by-specialty")
def medicines_by_specialty(specialty: str = "", limit: int = 50) -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            """SELECT id, brand_name, dci, active_substance, dosage_strength, form, route, source,
                      cis_code, cip_code, indications, laboratory
               FROM medicines_db
               WHERE lower(specialty) = lower(?)
               ORDER BY brand_name
               LIMIT ?""",
            (specialty, limit),
        ).fetchall())
    return {"rows": rows}


# =====================================================================
# FAVORITES & RECENTLY-USED
# =====================================================================

@app.get("/api/medicines/favorites")
def list_favorite_medicines() -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            """SELECT m.id, m.brand_name, m.dci, m.active_substance, m.dosage_strength, m.form,
                      m.route, m.source, m.cis_code, m.cip_code, m.indications, m.laboratory
               FROM favorite_medicines f
               JOIN medicines_db m ON m.id = f.medicine_id
               ORDER BY f.sort_order, f.created_at DESC"""
        ).fetchall())
    return {"rows": rows}


@app.post("/api/medicines/favorites")
def add_favorite_medicine(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    medicine_id = payload.get("medicine_id")
    if not medicine_id:
        raise HTTPException(status_code=400, detail="medicine_id requis")
    with connect() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO favorite_medicines (medicine_id) VALUES (?)",
            (medicine_id,),
        )
    return {"ok": True}


@app.delete("/api/medicines/favorites/{medicine_id}")
def remove_favorite_medicine(medicine_id: int) -> dict[str, Any]:
    with connect() as conn:
        conn.execute("DELETE FROM favorite_medicines WHERE medicine_id = ?", (medicine_id,))
    return {"ok": True}


@app.get("/api/medicines/recent")
def list_recent_medicines(limit: int = 20) -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            """SELECT m.id, m.brand_name, m.dci, m.active_substance, m.dosage_strength, m.form,
                      m.route, m.source, m.cis_code, m.cip_code, m.indications, m.laboratory
               FROM recent_medicines r
               JOIN medicines_db m ON m.id = r.medicine_id
               ORDER BY r.last_used DESC
               LIMIT ?""",
            (limit,),
        ).fetchall())
    return {"rows": rows}


def _touch_recent_medicine(conn: sqlite3.Connection, medicine_id: int) -> None:
    """Bump or insert a medicine into the recently-used list."""
    existing = conn.execute(
        "SELECT id FROM recent_medicines WHERE medicine_id = ?", (medicine_id,)
    ).fetchone()
    if existing:
        conn.execute(
            "UPDATE recent_medicines SET last_used = ?, use_count = use_count + 1 WHERE medicine_id = ?",
            (now_iso(), medicine_id),
        )
    else:
        conn.execute(
            "INSERT INTO recent_medicines (medicine_id, last_used) VALUES (?, ?)",
            (medicine_id, now_iso()),
        )


@app.get("/api/medicines/{medicine_id}")
def get_medicine(medicine_id: int) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM medicines_db WHERE id = ?", (medicine_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Medicament introuvable")
    return {"medicine": dict(row)}


# =====================================================================
# PRESCRIPTION WORKFLOW
# =====================================================================


class PrescriptionItemIn(BaseModel):
    medicine_id: int | None = None
    medicine_name: str
    dci: str | None = ""
    dosage: str | None = ""
    frequency: str | None = ""
    duration: str | None = ""
    instructions: str | None = ""
    quantity: str | None = ""
    renewable: bool = False
    is_free_text: bool = False


class PrescriptionWorkflowIn(BaseModel):
    patient_id: int
    visit_id: int | None = None
    items: list[PrescriptionItemIn] = PydanticField(default_factory=list)
    doctor_validated: bool = False


@app.post("/api/prescriptions/workflow", status_code=201)
def create_prescription_workflow(payload: PrescriptionWorkflowIn) -> dict[str, Any]:
    """Create a structured prescription with items and safety check."""
    med_names = [item.medicine_name for item in payload.items if not item.is_free_text]
    check = cardio_check(AICheckIn(patient_id=payload.patient_id, medications=med_names))
    lines = []
    for item in payload.items:
        if item.is_free_text:
            lines.append(item.medicine_name)
        else:
            parts = [item.medicine_name]
            if item.dosage:
                parts.append(item.dosage)
            if item.frequency:
                parts.append(item.frequency)
            if item.duration:
                parts.append(f"pendant {item.duration}")
            if item.instructions:
                parts.append(f"({item.instructions})")
            lines.append(" - ".join(parts))
    with connect() as conn:
        cur = conn.execute(
            """INSERT INTO prescriptions (patient_id, visit_id, lines, ai_warnings, consultation_summary, doctor_validated)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                payload.patient_id,
                payload.visit_id,
                json.dumps(lines, ensure_ascii=False),
                json.dumps(check["warnings"], ensure_ascii=False),
                check.get("summary", ""),
                1 if payload.doctor_validated else 0,
            ),
        )
        prescription_id = cur.lastrowid
        for idx, item in enumerate(payload.items):
            conn.execute(
                """INSERT INTO prescription_items
                   (prescription_id, medicine_id, medicine_name, dci, dosage, frequency,
                    duration, instructions, quantity, renewable, is_free_text, sort_order)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    prescription_id, item.medicine_id, item.medicine_name, item.dci,
                    item.dosage, item.frequency, item.duration, item.instructions,
                    item.quantity, 1 if item.renewable else 0,
                    1 if item.is_free_text else 0, idx,
                ),
            )
            if item.medicine_id:
                _touch_recent_medicine(conn, item.medicine_id)
    audit("create", "prescriptions", prescription_id, "Ordonnance structuree")
    return {"id": prescription_id, "warnings": check["warnings"], "suggestions": check.get("suggestions", [])}


@app.get("/api/prescriptions/{prescription_id}/items")
def get_prescription_items(prescription_id: int) -> dict[str, Any]:
    with connect() as conn:
        items = rows_to_dicts(conn.execute(
            "SELECT * FROM prescription_items WHERE prescription_id = ? ORDER BY sort_order",
            (prescription_id,),
        ).fetchall())
    return {"items": items}


def render_prescription_preview_html(row: sqlite3.Row) -> str:
    settings = get_all_settings()
    clinic = html.escape(settings.get("CLINIC_NAME") or "Cabinet de Cardiologie")
    doctor_name = settings.get("DOCTOR_NAME") or "CHIALI Mohammed Kamel"
    doctor_display = doctor_name if doctor_name.lower().strip().startswith("dr") else f"Dr {doctor_name}"
    doctor_display = html.escape(doctor_display)
    specialty = html.escape(settings.get("DOCTOR_SPECIALTY") or "Cardiologie")
    order_number = html.escape(settings.get("DOCTOR_ORDER_NUMBER") or "")
    phone = html.escape(settings.get("DOCTOR_PHONE") or "")
    email = html.escape(settings.get("DOCTOR_EMAIL") or "")
    address = html.escape(settings.get("DOCTOR_ADDRESS") or "")
    items = json.loads(row["lines"] or "[]")
    lines_html = "".join(
        f"<li><span>{html.escape(str(item))}</span></li>"
        for item in items
    ) or "<li><span>Aucun traitement saisi.</span></li>"
    patient_name = html.escape(f"{row['nom']} {row['prenom']}".strip())
    patient_birth = html.escape(row["date_naissance"] or "")
    patient_phone = html.escape(row["telephone"] or "")
    patient_code = html.escape(row["code"] or "")
    patient_age = html.escape(str(row["age"] or ""))
    today = datetime.now().strftime("%d/%m/%Y")
    footer_parts = [part for part in [address, phone, email] if part]
    footer_contact = " - ".join(footer_parts) if footer_parts else clinic
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ordonnance {patient_name}</title>
  <style>
    @page {{ size: A5 portrait; margin: 0; }}
    * {{ box-sizing: border-box; }}
    body {{ margin: 0; font-family: Arial, Helvetica, sans-serif; background: #e9eef6; color: #0f172a; }}
    .toolbar {{ width: 148mm; margin: 16px auto 10px; display: flex; justify-content: flex-end; gap: 8px; }}
    .toolbar button {{ border: 0; border-radius: 8px; padding: 9px 14px; background: #2563eb; color: #fff; font-weight: 700; cursor: pointer; }}
    .toolbar button.secondary {{ background: #fff; color: #1e3a5f; border: 1px solid #cbd5e1; }}
    .sheet {{ position: relative; width: 148mm; min-height: 210mm; margin: 0 auto 18px; background: #fff; border: 1px solid #d8e1ee; box-shadow: 0 18px 34px rgba(15, 23, 42, .14); padding: 10mm 10mm 13mm; overflow: hidden; }}
    .topline {{ display: grid; grid-template-columns: 1fr 34px 1fr; align-items: center; gap: 8px; padding-bottom: 7mm; border-bottom: 1.4px solid #1e3a8a; }}
    .doctor-block strong, .clinic-block strong {{ display: block; font-size: 12.5px; color: #102a61; line-height: 1.25; }}
    .doctor-block span, .clinic-block span {{ display: block; margin-top: 2px; font-size: 9px; color: #526276; line-height: 1.35; }}
    .clinic-block {{ text-align: right; }}
    .heart {{ width: 32px; height: 32px; border-radius: 9px; background: #eaf2ff; display: grid; place-items: center; color: #2f6bea; font-size: 21px; line-height: 1; }}
    .heart::before {{ content: "\\2665"; }}
    .meta {{ display: flex; justify-content: space-between; align-items: center; margin: 8mm 0 5mm; font-size: 10px; color: #475569; }}
    .title {{ text-align: center; font-size: 22px; font-weight: 800; color: #0f172a; letter-spacing: .08em; text-transform: uppercase; margin-bottom: 5mm; }}
    .patient {{ border: 1px solid #cbd5e1; background: #f8fbff; border-radius: 8px; padding: 4mm 5mm; margin-bottom: 7mm; display: grid; grid-template-columns: 1.25fr .8fr; gap: 2mm 5mm; }}
    .patient span {{ display: block; font-size: 8px; font-weight: 700; color: #64748b; text-transform: uppercase; }}
    .patient strong {{ display: block; margin-top: 1px; font-size: 11px; color: #0f172a; }}
    .rx-body {{ min-height: 93mm; padding: 1mm 2mm 0; }}
    .rx-body ol {{ margin: 0; padding-left: 6mm; display: flex; flex-direction: column; gap: 4mm; }}
    .rx-body li {{ padding-left: 2mm; }}
    .rx-body li span {{ display: block; font-size: 12.5px; line-height: 1.55; white-space: pre-wrap; }}
    .signature {{ margin-top: 6mm; text-align: right; font-size: 10px; color: #0f172a; }}
    .signature-space {{ height: 18mm; }}
    .footer {{ position: absolute; left: 10mm; right: 10mm; bottom: 6mm; border-top: 1px solid #d8e1ee; padding-top: 3mm; text-align: center; font-size: 8.8px; line-height: 1.35; color: #53647a; }}
    .footer strong {{ color: #102a61; }}
    @media print {{
      body {{ background: #fff; }}
      .toolbar {{ display: none; }}
      .sheet {{ margin: 0; box-shadow: none; border: 0; width: 148mm; min-height: 210mm; }}
    }}
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="secondary" onclick="window.close()">Fermer</button>
    <button onclick="window.print()">Imprimer</button>
  </div>
  <div class="sheet">
    <div class="topline">
      <div class="doctor-block">
        <strong>{doctor_display}</strong>
        <span>{specialty}</span>
        {f"<span>N ordre: {order_number}</span>" if order_number else ""}
      </div>
      <div class="heart" aria-hidden="true"></div>
      <div class="clinic-block">
        <strong>{clinic}</strong>
      </div>
    </div>
    <div class="meta">
      <span>Le {today}</span>
      <span>{patient_code or ""}</span>
    </div>
    <div class="title">Ordonnance</div>
    <div class="patient">
      <div><span>Patient</span><strong>{patient_name}</strong></div>
      <div><span>Naissance</span><strong>{patient_birth or "-"}</strong></div>
      <div><span>Age</span><strong>{patient_age + " ans" if patient_age else "-"}</strong></div>
      <div><span>Telephone</span><strong>{patient_phone or "-"}</strong></div>
    </div>
    <div class="rx-body">
      <ol>{lines_html}</ol>
    </div>
    <div class="signature">
      <div>{doctor_display}</div>
      <div class="signature-space"></div>
      <strong>Signature et cachet</strong>
    </div>
    <div class="footer">
      <strong>{clinic}</strong><br>
      {footer_contact}
    </div>
  </div>
</body>
</html>"""


@app.get("/api/prescriptions/{prescription_id}/preview", response_class=HTMLResponse)
def prescription_preview(prescription_id: int) -> str:
    with connect() as conn:
        row = conn.execute(
            """
            SELECT pr.*, p.nom, p.prenom, p.age, p.code, p.date_naissance, p.telephone
            FROM prescriptions pr JOIN patients p ON p.id = pr.patient_id
            WHERE pr.id = ?
            """,
            (prescription_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Ordonnance introuvable")
    return render_prescription_preview_html(row)


@app.get("/api/prescription-templates")
def list_prescription_templates() -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            "SELECT * FROM prescription_templates ORDER BY name"
        ).fetchall())
    for row in rows:
        row["items"] = json.loads(row.get("items_json") or "[]")
    return {"rows": rows}


# =====================================================================
# MEDICINE SAFETY CHECKER (enhanced)
# =====================================================================


@app.post("/api/safety-check")
def safety_check_enhanced(payload: AICheckIn) -> dict[str, Any]:
    """Enhanced safety checker using medicines_db with detailed alerts."""
    with connect() as conn:
        patient = conn.execute("SELECT * FROM patients WHERE id = ?", (payload.patient_id,)).fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        cardio = cardio_summary_for_patient(conn, payload.patient_id)
        profile = cardio["profile"]
        latest_lab = latest_or_empty(cardio["labs"])
        latest_vital = latest_or_empty(cardio["vitals"])

    allergies = split_terms(patient["allergies"])
    diseases = split_terms(patient["maladies"])
    warnings: list[dict[str, str]] = []

    for med_name in payload.medications:
        med_lower = med_name.lower().strip()
        if not med_lower:
            continue
        with connect() as conn:
            med = conn.execute(
                "SELECT * FROM medicines_db WHERE lower(brand_name) LIKE ? OR lower(dci) LIKE ? LIMIT 1",
                (f"%{med_lower}%", f"%{med_lower}%"),
            ).fetchone()
        if not med:
            warnings.append({"level": "info", "message": f"{med_name}: non trouve dans la base medicaments."})
            continue
        med = dict(med)
        label = med["brand_name"]
        # Allergy check
        for allergy in allergies:
            if allergy and (allergy in label.lower() or allergy in (med.get("dci") or "").lower() or allergy in (med.get("active_substance") or "").lower()):
                warnings.append({"level": "danger", "message": f"{label}: ALLERGIE potentielle ({allergy})"})
        # Contraindication check
        contras = med.get("contraindications") or ""
        try:
            contra_list = json.loads(contras) if contras.startswith("[") else [contras]
        except Exception:
            contra_list = [contras]
        for disease in diseases:
            for c in contra_list:
                if disease and (disease in c.lower() or c.lower() in disease):
                    warnings.append({"level": "danger", "message": f"{label}: contre-indication avec {disease}"})
        # Interaction check between prescribed meds
        interactions = med.get("interactions") or ""
        try:
            inter_list = json.loads(interactions) if interactions.startswith("[") else [interactions]
        except Exception:
            inter_list = [interactions]
        for other in payload.medications:
            if other.lower().strip() != med_lower:
                for i in inter_list:
                    if other.lower().strip() in i.lower() or i.lower() in other.lower().strip():
                        warnings.append({"level": "warning", "message": f"{label}: interaction possible avec {other}"})
        # Renal check
        if latest_lab.get("creatinine") and latest_lab["creatinine"] > 1.5:
            renal = med.get("renal_precautions") or ""
            if renal or any(kw in (med.get("indications") or "").lower() for kw in ["iec", "ara2", "diuretique", "anticoagul"]):
                warnings.append({"level": "warning", "message": f"{label}: creatinine elevee ({latest_lab['creatinine']}), adapter dose renale"})
        # Hepatic check
        if profile.get("abnormal_liver_function"):
            hepatic = med.get("hepatic_precautions") or ""
            if hepatic or "hepat" in (med.get("contraindications") or "").lower():
                warnings.append({"level": "warning", "message": f"{label}: precaution hepatique requise"})
        # Pregnancy check
        if patient["sexe"] and "fem" in patient["sexe"].lower() and (patient["age"] or 0) < 50:
            preg = med.get("pregnancy_warnings") or ""
            if preg or "grossesse" in (med.get("contraindications") or "").lower():
                warnings.append({"level": "warning", "message": f"{label}: verifier grossesse (femme en age de procreer)"})
        # Age check
        if patient["age"] and patient["age"] >= 75:
            warnings.append({"level": "info", "message": f"{label}: patient >= 75 ans, adapter posologie"})

    if not warnings:
        warnings.append({"level": "ok", "message": "Aucun probleme detecte dans la base locale."})

    return {"warnings": warnings, "disclaimer": "Aide a la decision uniquement. Le medecin valide."}


# =====================================================================
# ANTHROPOMETRIC RECORDS (BMI / Waist circumference)
# =====================================================================


class AnthropometricIn(BaseModel):
    measured_at: str | None = None
    weight_kg: float | None = None
    height_cm: float | None = None
    waist_circumference_cm: float | None = None
    notes: str | None = ""


def compute_bmi_category(bmi: float | None) -> str:
    if bmi is None:
        return ""
    if bmi < 18.5:
        return "Insuffisance ponderale"
    if bmi < 25:
        return "Poids normal"
    if bmi < 30:
        return "Surpoids"
    return "Obesite"


def compute_waist_risk(waist_cm: float | None, sexe: str | None) -> str:
    if not waist_cm or not sexe:
        return ""
    sex_lower = sexe.lower()
    if "masc" in sex_lower or "homme" in sex_lower:
        return "Risque eleve" if waist_cm >= 102 else "Normal"
    if "fem" in sex_lower:
        return "Risque eleve" if waist_cm >= 88 else "Normal"
    return ""


@app.post("/api/patients/{patient_id}/anthropometry", status_code=201)
def add_anthropometry(patient_id: int, payload: AnthropometricIn) -> dict[str, Any]:
    bmi = calculate_bmi(payload.weight_kg, payload.height_cm)
    bmi_cat = compute_bmi_category(bmi)
    with connect() as conn:
        patient = conn.execute("SELECT sexe FROM patients WHERE id = ?", (patient_id,)).fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        waist_risk = compute_waist_risk(payload.waist_circumference_cm, patient["sexe"])
        cur = conn.execute(
            """INSERT INTO anthropometric_records
               (patient_id, measured_at, weight_kg, height_cm, waist_circumference_cm, bmi, bmi_category, waist_risk, notes)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                patient_id, payload.measured_at or now_iso(), payload.weight_kg,
                payload.height_cm, payload.waist_circumference_cm, bmi, bmi_cat, waist_risk, payload.notes,
            ),
        )
        record_id = cur.lastrowid
    audit("create", "anthropometric_records", record_id, f"IMC {bmi} - {bmi_cat}")
    return {"id": record_id, "bmi": bmi, "bmi_category": bmi_cat, "waist_risk": waist_risk}


@app.get("/api/patients/{patient_id}/anthropometry")
def get_anthropometry(patient_id: int) -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            "SELECT * FROM anthropometric_records WHERE patient_id = ? ORDER BY measured_at DESC LIMIT 50",
            (patient_id,),
        ).fetchall())
    return {"rows": rows}


# =====================================================================
# DOCUMENT TEMPLATES
# =====================================================================


class DocumentTemplateIn(BaseModel):
    name: str
    category: str = "general"
    body_html: str = ""
    is_default: bool = False


@app.get("/api/document-templates")
def list_document_templates() -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            "SELECT * FROM document_templates ORDER BY category, name"
        ).fetchall())
    return {"rows": rows}


@app.get("/api/document-templates/{template_id}")
def get_document_template(template_id: int) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM document_templates WHERE id = ?", (template_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Modele introuvable")
    return {"template": dict(row)}


@app.post("/api/document-templates", status_code=201)
def create_document_template(payload: DocumentTemplateIn) -> dict[str, Any]:
    with connect() as conn:
        cur = conn.execute(
            "INSERT INTO document_templates (name, category, body_html, is_default) VALUES (?, ?, ?, ?)",
            (payload.name, payload.category, payload.body_html, 1 if payload.is_default else 0),
        )
        template_id = cur.lastrowid
    audit("create", "document_templates", template_id, payload.name)
    return {"id": template_id}


@app.put("/api/document-templates/{template_id}")
def update_document_template(template_id: int, payload: DocumentTemplateIn) -> dict[str, Any]:
    with connect() as conn:
        exists = conn.execute("SELECT id FROM document_templates WHERE id = ?", (template_id,)).fetchone()
        if not exists:
            raise HTTPException(status_code=404, detail="Modele introuvable")
        conn.execute(
            "UPDATE document_templates SET name=?, category=?, body_html=?, is_default=?, updated_at=? WHERE id=?",
            (payload.name, payload.category, payload.body_html, 1 if payload.is_default else 0, now_iso(), template_id),
        )
    audit("update", "document_templates", template_id, payload.name)
    return {"ok": True}


@app.post("/api/document-templates/{template_id}/duplicate", status_code=201)
def duplicate_document_template(template_id: int) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM document_templates WHERE id = ?", (template_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Modele introuvable")
        cur = conn.execute(
            "INSERT INTO document_templates (name, category, body_html, variables) VALUES (?, ?, ?, ?)",
            (f"{row['name']} (copie)", row["category"], row["body_html"], row["variables"]),
        )
        new_id = cur.lastrowid
    return {"id": new_id}


# =====================================================================
# GENERATED DOCUMENTS (render template → PDF)
# =====================================================================


class GenerateDocumentIn(BaseModel):
    patient_id: int
    template_id: int | None = None
    title: str = ""
    body_html: str = ""
    variables: dict[str, str] = PydanticField(default_factory=dict)


def render_template_variables(html: str, variables: dict[str, str]) -> str:
    """Replace {{key}} placeholders with values."""
    result = html
    for key, value in variables.items():
        result = result.replace("{{" + key + "}}", value or "")
    return result


def build_template_variables(patient: dict[str, Any], extra: dict[str, str] | None = None) -> dict[str, str]:
    """Build standard variable dict from patient + settings."""
    settings = get_all_settings()
    specialty = settings.get("DOCTOR_SPECIALTY", "Cardiologie")
    doctor_name = settings.get("DOCTOR_NAME", "")
    patient_sex = str(patient.get("sexe") or "").strip().lower()
    is_female = patient_sex.startswith("f")
    patient_last = str(patient.get("nom") or "")
    patient_first = str(patient.get("prenom") or "")
    patient_full_upper = " ".join([part for part in [patient_last, patient_first] if part]).upper()
    specialty_label = specialty.lower().replace("medecin ", "").strip() or specialty.lower()
    clinic_city = settings.get("CLINIC_CITY", "") or "SIDI BEL ABBES"
    variables = {
        "doctor_name": doctor_name,
        "doctor_specialty": specialty,
        "doctor_specialty_lower": specialty.lower(),
        "doctor_specialty_template": specialty.upper() if specialty else "MEDECIN CARDIOLOGUE",
        "doctor_specialty_label": specialty_label,
        "doctor_template_name": format_doctor_template_name(doctor_name),
        "doctor_order_number": settings.get("DOCTOR_ORDER_NUMBER", "") or "22/620/13",
        "doctor_phone": settings.get("DOCTOR_PHONE", ""),
        "doctor_email": settings.get("DOCTOR_EMAIL", ""),
        "doctor_address": settings.get("DOCTOR_ADDRESS", ""),
        "doctor_phone_template": normalized_template_phone(settings.get("DOCTOR_PHONE", "")),
        "doctor_email_template": normalized_template_email(settings.get("DOCTOR_EMAIL", "")),
        "doctor_address_template": normalized_template_address(settings.get("DOCTOR_ADDRESS", ""), clinic_city),
        "doctor_address_note_template": settings.get("DOCTOR_ADDRESS_NOTE", "") or "(ex :rue Gambetta)",
        "clinic_city_template": clinic_city,
        "clinic_name": settings.get("CLINIC_NAME", "Cabinet de Cardiologie"),
        "clinic_logo_data_url": clinic_logo_data_url(),
        "patient_name": patient_last,
        "patient_first_name": patient_first,
        "patient_name_upper": patient_last.upper(),
        "patient_first_name_upper": patient_first.upper(),
        "patient_full_name_upper": patient_full_upper,
        "patient_age": str(patient.get("age") or ""),
        "patient_birth_date": format_display_date(patient.get("date_naissance") or ""),
        "patient_subject": "la patiente" if is_female else "le patient",
        "patient_birth_verb": "nee" if is_female else "ne",
        "patient_birth_label": "nee en" if is_female else "ne le",
        "patient_request_label": "l'interessee" if is_female else "l'interesse",
        "date_today": datetime.now().strftime("%d/%m/%Y"),
        "date_time_short": datetime.now().strftime("%d/%m/%Y"),
        "date_time_full": datetime.now().strftime("%d/%m/%Y %H:%M"),
        "diagnosis": "",
        "treatment": "",
        "duration": "",
        "school_year": current_school_year(),
    }
    if extra:
        variables.update(extra)
    return variables


@app.post("/api/generated-documents", status_code=201)
def generate_document(payload: GenerateDocumentIn) -> dict[str, Any]:
    with connect() as conn:
        patient = conn.execute("SELECT * FROM patients WHERE id = ?", (payload.patient_id,)).fetchone()
        if not patient:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        template_html = payload.body_html
        template_name = payload.title
        template_category = "general"
        if payload.template_id:
            tmpl = conn.execute("SELECT * FROM document_templates WHERE id = ?", (payload.template_id,)).fetchone()
            if tmpl:
                template_html = template_html or tmpl["body_html"]
                template_name = template_name or tmpl["name"]
                template_category = tmpl["category"] or template_category
        variables = build_template_variables(dict(patient), payload.variables)
        rendered = render_template_variables(template_html, variables)
        rendered = brand_document_html(rendered, variables, template_name, template_category)
        cur = conn.execute(
            """INSERT INTO generated_documents (patient_id, template_id, title, body_html, rendered_text)
               VALUES (?, ?, ?, ?, ?)""",
            (payload.patient_id, payload.template_id, template_name, template_html, rendered),
        )
        doc_id = cur.lastrowid
    audit("create", "generated_documents", doc_id, template_name)
    return {"id": doc_id, "rendered_html": rendered, "title": template_name}


def brand_document_html(body_html: str, variables: dict[str, str], title: str, category: str) -> str:
        category = (category or "").lower().strip()
        if category not in {"ordonnance", "certificat", "rapport"}:
                return body_html
        lower_body = (body_html or "").lower()
        if "width:210mm" in lower_body or "max-width:700px" in lower_body or "data-template-layout=\"full-page\"" in lower_body:
                return body_html

        logo = variables.get("clinic_logo_data_url", "")
        logo_html = f'<img src="{html.escape(logo, quote=True)}" alt="Logo" style="width:54px;height:54px;object-fit:contain;" />' if logo else ""
        clinic_name = html.escape(variables.get("clinic_name", "Cabinet de Cardiologie"))
        doctor_name = html.escape(variables.get("doctor_name", "Dr"))
        specialty = html.escape(variables.get("doctor_specialty", "Cardiologie"))
        order_number = html.escape(variables.get("doctor_order_number", ""))
        phone = html.escape(variables.get("doctor_phone", ""))
        email = html.escape(variables.get("doctor_email", ""))
        address = html.escape(variables.get("doctor_address", ""))
        date_today = html.escape(variables.get("date_today", datetime.now().strftime("%d/%m/%Y")))
        patient_name = html.escape(variables.get("patient_name", ""))
        patient_first_name = html.escape(variables.get("patient_first_name", ""))
        patient_birth_date = html.escape(variables.get("patient_birth_date", ""))
        patient_age = html.escape(variables.get("patient_age", ""))

        header_right = "<br/>".join([part for part in [clinic_name, address, phone, email] if part])
        patient_block = f"<strong>Patient:</strong> {patient_name} {patient_first_name}<br/><strong>Ne(e) le:</strong> {patient_birth_date or 'N/A'} | <strong>Age:</strong> {patient_age or 'N/A'} ans"
        title_text = html.escape(title or ("ORDONNANCE" if category == "ordonnance" else "CERTIFICAT MEDICAL"))

        return f"""
<div style="width:210mm; min-height:297mm; margin:0 auto; box-sizing:border-box; padding:16mm 15mm 15mm; border:2px solid #101828; background:#fff; color:#0f172a; font-family: Arial, Helvetica, sans-serif;">
    <div style="display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding-bottom:14px; border-bottom:2px solid #101828;">
        <div style="display:flex; align-items:flex-start; gap:12px; min-width:0;">
            {logo_html}
            <div style="line-height:1.5;">
                <div style="font-size:15px; font-weight:700;">{clinic_name}</div>
                <div style="font-size:13px; font-weight:700;">{doctor_name} - {specialty}</div>
                {f'<div style="font-size:11px;">N° Ordre: {order_number}</div>' if order_number else ''}
            </div>
        </div>
        <div style="text-align:right; font-size:11.5px; line-height:1.5; white-space:pre-line;">
            <div style="font-weight:700;">{date_today}</div>
            <div>{header_right}</div>
        </div>
    </div>
    <div style="margin-top:14px; text-align:center;">
        <div style="display:inline-block; min-width:320px; padding:10px 18px; border:2px solid #101828; font-size:20px; font-weight:800; letter-spacing:1px; line-height:1.3;">
            {title_text}
        </div>
    </div>
    <div style="margin-top:18px; padding:16px 18px; border:1px solid #cbd5e1; border-radius:10px; background:#f8fafc; font-size:12px; line-height:1.7;">
        {patient_block}
    </div>
    <div style="margin-top:18px; min-height:170mm; font-size:13px; line-height:1.8;">
        {body_html}
    </div>
    <div style="margin-top:18px; border-top:1px solid #cbd5e1; padding-top:10px; font-size:11px; color:#475569; text-align:center; line-height:1.6;">
        <div>Document établi au cabinet. La validation médicale, la signature et le cachet restent sous la responsabilité du médecin.</div>
        <div>{phone + (' | ' if phone and email else '') + email if (phone or email) else ''}</div>
    </div>
</div>
"""


@app.get("/api/generated-documents/{doc_id}")
def get_generated_document(doc_id: int) -> dict[str, Any]:
    with connect() as conn:
        row = conn.execute("SELECT * FROM generated_documents WHERE id = ?", (doc_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return {"document": dict(row)}


def printable_document_page(title: str, rendered_html: str) -> str:
    safe_title = html.escape(title or "Document")
    sheet_class = "sheet sheet--full-page" if is_full_page_document(rendered_html) else "sheet"
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{safe_title}</title>
  <style>
    @page {{ size: A4; margin: 10mm; }}
    body {{ margin: 0; font-family: Arial, Helvetica, sans-serif; background: #eef4fb; }}
    .toolbar {{ max-width: 210mm; margin: 24px auto 12px; display: flex; justify-content: flex-end; gap: 10px; }}
    .toolbar button {{ border: 0; border-radius: 999px; padding: 10px 18px; background: #2563eb; color: #fff; font-weight: 700; cursor: pointer; }}
    .toolbar button.secondary {{ background: #fff; color: #1e3a5f; border: 1px solid #cbd5e1; }}
    .sheet {{ width: 210mm; min-height: 297mm; margin: 0 auto 24px; background: #fff; box-shadow: 0 18px 40px rgba(15, 23, 42, .12); padding: 10mm; }}
    .sheet--full-page {{ padding: 0; overflow: hidden; }}
    @media print {{
      body {{ background: #fff; }}
      .toolbar {{ display: none; }}
      .sheet {{ margin: 0 auto; box-shadow: none; }}
    }}
  </style>
</head>
<body>
  <div class="toolbar">
    <button class="secondary" onclick="window.close()">Fermer</button>
    <button onclick="window.print()">Imprimer</button>
  </div>
  <div class="{sheet_class}">{rendered_html}</div>
</body>
</html>"""


@app.get("/api/patients/{patient_id}/generated-documents")
def list_patient_generated_documents(patient_id: int) -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            "SELECT * FROM generated_documents WHERE patient_id = ? ORDER BY created_at DESC",
            (patient_id,),
        ).fetchall())
    return {"rows": rows}


@app.get("/api/generated-documents/{doc_id}/pdf")
def generated_document_pdf(doc_id: int) -> FileResponse:
    """Generate PDF from a rendered document using reportlab."""
    if canvas is None or A4 is None:
        raise HTTPException(status_code=503, detail="reportlab non installe")
    with connect() as conn:
        row = conn.execute(
            """SELECT gd.*, p.nom, p.prenom, p.age, p.code, p.date_naissance, p.sexe
               FROM generated_documents gd JOIN patients p ON p.id = gd.patient_id
               WHERE gd.id = ?""",
            (doc_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Document introuvable")
    if is_sport_dispense_document(row):
        pdf_path = build_sport_dispense_certificate_pdf(row, doc_id)
        with connect() as conn:
            conn.execute("UPDATE generated_documents SET pdf_path = ? WHERE id = ?", (str(pdf_path), doc_id))
        return FileResponse(pdf_path, media_type="application/pdf", filename=f"{row['title'] or 'document'}.pdf")
    pdf_path = DATA / f"document_{doc_id}.pdf"
    c = canvas.Canvas(str(pdf_path), pagesize=A4)
    width, height = A4
    margin_x = 50

    settings = get_all_settings()
    patient = {
        "nom": row["nom"], "prenom": row["prenom"], "age": row["age"],
        "date_naissance": row["date_naissance"], "telephone": "",
    }
    title_raw = (row["title"] or "Document Médical").strip()
    title_lines = [title_raw[:60]]
    body_y = _draw_clinic_letterhead(c, width, height, settings, patient, title_lines)

    # Strip HTML tags for plain-text PDF rendering
    text = re.sub(r"<[^>]+>", "\n", row["rendered_text"] or row["body_html"] or "")
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    y = body_y
    c.setFillColorRGB(0, 0, 0)
    c.setFont("Helvetica", 11)
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            y -= 10
            continue
        if y < 160:
            _draw_clinic_footer(c, width)
            c.showPage()
            body_y = _draw_clinic_letterhead(c, width, height, settings, patient, title_lines)
            y = body_y
            c.setFont("Helvetica", 11)
        c.drawString(margin_x, y, line[:100])
        y -= 16
    _draw_clinic_footer(c, width)
    c.save()
    # Save path back
    with connect() as conn:
        conn.execute("UPDATE generated_documents SET pdf_path = ? WHERE id = ?", (str(pdf_path), doc_id))
    return FileResponse(pdf_path, media_type="application/pdf", filename=f"{row['title'] or 'document'}.pdf")


@app.post("/api/generated-documents/{doc_id}/preview")
def preview_document(doc_id: int, payload: GenerateDocumentIn | None = None) -> dict[str, Any]:
    """Return rendered HTML for preview."""
    with connect() as conn:
        row = conn.execute("SELECT * FROM generated_documents WHERE id = ?", (doc_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return {"rendered_html": row["rendered_text"] or row["body_html"]}


@app.get("/api/generated-documents/{doc_id}/printable", response_class=HTMLResponse)
def printable_generated_document(doc_id: int) -> str:
    with connect() as conn:
        row = conn.execute("SELECT * FROM generated_documents WHERE id = ?", (doc_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Document introuvable")
    return printable_document_page(row["title"] or "Document", row["rendered_text"] or row["body_html"] or "")


# =====================================================================
# BDPM IMPORT (French public medicine database)
# =====================================================================


def _parse_bdpm_cis(text: str) -> dict[str, dict]:
    """CIS_bdpm.txt → {cis: {brand_name, form, route, status, laboratory}}"""
    entries: dict[str, dict] = {}
    for line in text.strip().split("\n"):
        parts = line.split("\t")
        if len(parts) < 4:
            continue
        cis = parts[0].strip()
        if not cis:
            continue
        entries[cis] = {
            "brand_name": parts[1].strip() if len(parts) > 1 else "",
            "form": parts[2].strip() if len(parts) > 2 else "",
            "route": parts[3].strip() if len(parts) > 3 else "",
            "marketing_status": parts[6].strip() if len(parts) > 6 else "",
            "laboratory": parts[10].strip() if len(parts) > 10 else "",
        }
    return entries


def _parse_bdpm_compo(text: str) -> dict[str, list[dict]]:
    """CIS_COMPO_bdpm.txt → {cis: [{substance, dosage}, ...]}"""
    out: dict[str, list[dict]] = {}
    for line in text.strip().split("\n"):
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        cis = parts[0].strip()
        substance = parts[3].strip() if len(parts) > 3 else ""
        dosage = parts[4].strip() if len(parts) > 4 else ""
        if not cis or not substance:
            continue
        out.setdefault(cis, []).append({"substance": substance, "dosage": dosage})
    return out


@app.post("/api/medicines/import-bdpm")
def import_bdpm_from_upload(
    file: UploadFile | None = File(None),
) -> dict[str, Any]:
    """Import BDPM dataset into medicines_db.

    Accepts EITHER:
    - A single CIS_bdpm.txt (tab-separated)
    - A ZIP archive containing CIS_bdpm.txt + CIS_COMPO_bdpm.txt (recommended — adds DCI/dosage)

    Safe merge: uses CIS as unique key, updates existing rows without breaking prescriptions.
    """
    if not file:
        raise HTTPException(status_code=400, detail="Fichier BDPM requis (CIS_bdpm.txt ou .zip)")

    import zipfile, io
    raw = file.file.read()
    cis_text = ""
    compo_text = ""

    # Detect ZIP by magic bytes
    if raw[:2] == b"PK":
        try:
            with zipfile.ZipFile(io.BytesIO(raw)) as zf:
                for name in zf.namelist():
                    lower = name.lower()
                    if lower.endswith("cis_bdpm.txt") or lower == "cis_bdpm.txt":
                        cis_text = zf.read(name).decode("utf-8", errors="replace")
                    elif "compo" in lower and lower.endswith(".txt"):
                        compo_text = zf.read(name).decode("utf-8", errors="replace")
        except zipfile.BadZipFile:
            raise HTTPException(status_code=400, detail="Archive ZIP invalide")
    else:
        cis_text = raw.decode("utf-8", errors="replace")

    if not cis_text:
        raise HTTPException(status_code=400, detail="CIS_bdpm.txt introuvable dans le fichier")

    cis_entries = _parse_bdpm_cis(cis_text)
    compo_entries = _parse_bdpm_compo(compo_text) if compo_text else {}

    imported = 0
    updated = 0
    with connect() as conn:
        for cis, base in cis_entries.items():
            # Derive DCI + active substance from composition data when available
            subs = compo_entries.get(cis, [])
            dci = ", ".join(s["substance"] for s in subs) if subs else ""
            dosage_strength = ", ".join(f'{s["substance"]} {s["dosage"]}'.strip() for s in subs) if subs else ""

            # Fallback: parse from the commercial name
            if not dci and base["brand_name"]:
                name = base["brand_name"]
                # BDPM commercial names often end with ", <form> <strength>"
                # Use the first word as a heuristic DCI
                first_word = name.split(",")[0].split(" ")[0].strip()
                if len(first_word) > 2:
                    dci = first_word.title()

            existing = conn.execute("SELECT id FROM medicines_db WHERE cis_code = ?", (cis,)).fetchone()
            if existing:
                conn.execute(
                    """UPDATE medicines_db SET
                       brand_name = COALESCE(NULLIF(?, ''), brand_name),
                       dci = COALESCE(NULLIF(?, ''), dci),
                       active_substance = COALESCE(NULLIF(?, ''), active_substance),
                       form = COALESCE(NULLIF(?, ''), form),
                       route = COALESCE(NULLIF(?, ''), route),
                       dosage_strength = COALESCE(NULLIF(?, ''), dosage_strength),
                       marketing_status = COALESCE(NULLIF(?, ''), marketing_status),
                       laboratory = COALESCE(NULLIF(?, ''), laboratory),
                       source = 'bdpm',
                       last_updated = ?
                       WHERE cis_code = ?""",
                    (
                        base["brand_name"], dci, dci, base["form"], base["route"],
                        dosage_strength, base["marketing_status"], base["laboratory"],
                        now_iso(), cis,
                    ),
                )
                updated += 1
            else:
                conn.execute(
                    """INSERT INTO medicines_db
                       (cis_code, brand_name, dci, active_substance, form, route,
                        dosage_strength, marketing_status, laboratory, source)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'bdpm')""",
                    (
                        cis, base["brand_name"], dci, dci, base["form"], base["route"],
                        dosage_strength, base["marketing_status"], base["laboratory"],
                    ),
                )
                imported += 1

            # Persist individual substances in the normalized table (deduped)
            if subs:
                med_row = conn.execute("SELECT id FROM medicines_db WHERE cis_code = ?", (cis,)).fetchone()
                if med_row:
                    med_id = med_row["id"]
                    conn.execute("DELETE FROM medicine_substances WHERE medicine_id = ?", (med_id,))
                    for s in subs:
                        conn.execute(
                            "INSERT INTO medicine_substances (medicine_id, substance_name, dosage) VALUES (?, ?, ?)",
                            (med_id, s["substance"], s["dosage"]),
                        )

        set_setting("MEDICINE_LAST_SYNC", now_iso())
        rebuild_medicines_fts(conn)

    audit("import", "medicines_db", None, f"BDPM import: {imported} nouveaux, {updated} mis à jour")
    return {
        "ok": True,
        "imported": imported,
        "updated": updated,
        "total_cis": len(cis_entries),
        "with_composition": len(compo_entries),
    }


@app.post("/api/medicines/auto-download-bdpm")
def auto_download_bdpm() -> dict[str, Any]:
    """One-click: download the latest BDPM files from the official public French drug database,
    then import them. Requires internet. No API key. ~15,000 medications."""
    import urllib.request
    BASE_URL = "https://base-donnees-publique.medicaments.gouv.fr/telechargement.php"
    # Official public exports — both files are plain TXT, UTF-8, tab-separated
    urls = {
        "cis": f"{BASE_URL}?fichier=CIS_bdpm.txt",
        "compo": f"{BASE_URL}?fichier=CIS_COMPO_bdpm.txt",
    }
    try:
        req_cis = urllib.request.Request(urls["cis"], headers={"User-Agent": "MediSmartPro/1.0"})
        cis_text = urllib.request.urlopen(req_cis, timeout=60).read().decode("utf-8", errors="replace")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Téléchargement BDPM CIS échoué: {e}")
    try:
        req_compo = urllib.request.Request(urls["compo"], headers={"User-Agent": "MediSmartPro/1.0"})
        compo_text = urllib.request.urlopen(req_compo, timeout=60).read().decode("utf-8", errors="replace")
    except Exception:
        compo_text = ""  # non-fatal — we can still import CIS alone

    cis_entries = _parse_bdpm_cis(cis_text)
    compo_entries = _parse_bdpm_compo(compo_text) if compo_text else {}

    if not cis_entries:
        raise HTTPException(status_code=502, detail="Fichier BDPM vide ou invalide")

    imported = 0
    updated = 0
    with connect() as conn:
        for cis, base in cis_entries.items():
            subs = compo_entries.get(cis, [])
            dci = ", ".join(s["substance"] for s in subs) if subs else ""
            dosage_strength = ", ".join(f'{s["substance"]} {s["dosage"]}'.strip() for s in subs) if subs else ""
            if not dci and base["brand_name"]:
                first_word = base["brand_name"].split(",")[0].split(" ")[0].strip()
                if len(first_word) > 2:
                    dci = first_word.title()

            existing = conn.execute("SELECT id FROM medicines_db WHERE cis_code = ?", (cis,)).fetchone()
            if existing:
                conn.execute(
                    """UPDATE medicines_db SET
                       brand_name = COALESCE(NULLIF(?, ''), brand_name),
                       dci = COALESCE(NULLIF(?, ''), dci),
                       active_substance = COALESCE(NULLIF(?, ''), active_substance),
                       form = COALESCE(NULLIF(?, ''), form),
                       route = COALESCE(NULLIF(?, ''), route),
                       dosage_strength = COALESCE(NULLIF(?, ''), dosage_strength),
                       marketing_status = COALESCE(NULLIF(?, ''), marketing_status),
                       laboratory = COALESCE(NULLIF(?, ''), laboratory),
                       source = 'bdpm',
                       last_updated = ?
                       WHERE cis_code = ?""",
                    (base["brand_name"], dci, dci, base["form"], base["route"],
                     dosage_strength, base["marketing_status"], base["laboratory"],
                     now_iso(), cis),
                )
                updated += 1
            else:
                conn.execute(
                    """INSERT INTO medicines_db
                       (cis_code, brand_name, dci, active_substance, form, route,
                        dosage_strength, marketing_status, laboratory, source)
                       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'bdpm')""",
                    (cis, base["brand_name"], dci, dci, base["form"], base["route"],
                     dosage_strength, base["marketing_status"], base["laboratory"]),
                )
                imported += 1
        set_setting("MEDICINE_LAST_SYNC", now_iso())
        rebuild_medicines_fts(conn)

    audit("import", "medicines_db", None, f"BDPM auto-download: {imported} nouveaux, {updated} mis à jour")
    return {
        "ok": True,
        "imported": imported,
        "updated": updated,
        "total_cis": len(cis_entries),
        "with_composition": len(compo_entries),
        "source": "auto-download",
    }


# =====================================================================
# JSON / CSV BULK IMPORT (custom datasets: Algerian, hospital, etc.)
# =====================================================================

@app.post("/api/medicines/import-bulk")
def import_medicines_bulk(
    file: UploadFile = File(...),
    format_hint: str = Form("auto"),  # "json", "csv", "auto"
) -> dict[str, Any]:
    """Import a JSON or CSV file containing medications into medicines_db.

    JSON format (array of objects):
    [
      {
        "brand_name": "Doliprane",
        "dci": "Paracetamol",
        "dosage_strength": "500 mg",
        "form": "comprimé",
        "route": "orale",
        "indications": "Douleur, Fièvre",
        "laboratory": "Sanofi",
        "atc_code": "N02BE01"
      }
    ]

    CSV format (header row required):
    brand_name,dci,dosage_strength,form,route,indications,laboratory

    Deduplication: existing entries matched by (brand_name, dosage_strength, form) are updated.
    """
    import csv as csv_mod
    raw = file.file.read()
    text = raw.decode("utf-8-sig", errors="replace")

    # Auto-detect format
    fmt = format_hint
    if fmt == "auto":
        fmt = "json" if text.strip().startswith(("[", "{")) else "csv"

    meds: list[dict[str, Any]] = []
    if fmt == "json":
        try:
            data = json.loads(text)
            meds = data if isinstance(data, list) else [data]
        except json.JSONDecodeError as e:
            raise HTTPException(status_code=400, detail=f"JSON invalide: {e}")
    else:
        reader = csv_mod.DictReader(text.splitlines())
        meds = list(reader)

    if not meds:
        raise HTTPException(status_code=400, detail="Aucun médicament trouvé dans le fichier")

    imported = 0
    updated = 0
    skipped = 0
    errors = []

    with connect() as conn:
        for i, med in enumerate(meds):
            brand = str(med.get("brand_name", med.get("brand", ""))).strip()
            if not brand:
                skipped += 1
                continue

            dci = str(med.get("dci", med.get("generic_name", med.get("active_substance", "")))).strip()
            dosage = str(med.get("dosage_strength", med.get("dosage", med.get("strength", "")))).strip()
            form = str(med.get("form", med.get("dosage_form", ""))).strip()
            route = str(med.get("route", "")).strip()
            indications = str(med.get("indications", "")).strip()
            laboratory = str(med.get("laboratory", med.get("brand", ""))).strip()
            atc = str(med.get("atc_code", "")).strip()
            cis = str(med.get("cis_code", "")).strip()
            cip = str(med.get("cip_code", "")).strip()
            contraindications = str(med.get("contraindications", "")).strip()
            interactions = str(med.get("interactions", "")).strip()
            pregnancy = str(med.get("pregnancy_warnings", "")).strip()
            breastfeeding = str(med.get("breastfeeding_warnings", "")).strip()
            renal = str(med.get("renal_precautions", "")).strip()
            hepatic = str(med.get("hepatic_precautions", "")).strip()

            # Deduplication key: brand + dosage + form
            dup = conn.execute(
                """SELECT id FROM medicines_db
                   WHERE lower(brand_name) = lower(?)
                     AND lower(COALESCE(dosage_strength, '')) = lower(?)
                     AND lower(COALESCE(form, '')) = lower(?)""",
                (brand, dosage, form),
            ).fetchone()

            try:
                if dup:
                    conn.execute(
                        """UPDATE medicines_db SET
                           dci = COALESCE(NULLIF(?, ''), dci),
                           active_substance = COALESCE(NULLIF(?, ''), active_substance),
                           form = COALESCE(NULLIF(?, ''), form),
                           route = COALESCE(NULLIF(?, ''), route),
                           dosage_strength = COALESCE(NULLIF(?, ''), dosage_strength),
                           indications = COALESCE(NULLIF(?, ''), indications),
                           contraindications = COALESCE(NULLIF(?, ''), contraindications),
                           interactions = COALESCE(NULLIF(?, ''), interactions),
                           pregnancy_warnings = COALESCE(NULLIF(?, ''), pregnancy_warnings),
                           breastfeeding_warnings = COALESCE(NULLIF(?, ''), breastfeeding_warnings),
                           renal_precautions = COALESCE(NULLIF(?, ''), renal_precautions),
                           hepatic_precautions = COALESCE(NULLIF(?, ''), hepatic_precautions),
                           laboratory = COALESCE(NULLIF(?, ''), laboratory),
                           cis_code = COALESCE(NULLIF(?, ''), cis_code),
                           cip_code = COALESCE(NULLIF(?, ''), cip_code),
                           source = 'bulk-import',
                           last_updated = ?
                           WHERE id = ?""",
                        (
                            dci, dci, form, route, dosage, indications,
                            contraindications, interactions, pregnancy, breastfeeding,
                            renal, hepatic, laboratory, cis, cip,
                            now_iso(), dup["id"],
                        ),
                    )
                    updated += 1
                else:
                    conn.execute(
                        """INSERT INTO medicines_db
                           (brand_name, dci, active_substance, form, route, dosage_strength,
                            indications, contraindications, interactions, pregnancy_warnings,
                            breastfeeding_warnings, renal_precautions, hepatic_precautions,
                            laboratory, cis_code, cip_code, source)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'bulk-import')""",
                        (
                            brand, dci, dci, form, route, dosage, indications,
                            contraindications, interactions, pregnancy, breastfeeding,
                            renal, hepatic, laboratory, cis, cip,
                        ),
                    )
                    imported += 1
            except Exception as e:
                errors.append({"row": i + 1, "brand": brand, "error": str(e)})

        # Rebuild FTS5 so new meds are searchable immediately
        rebuild_medicines_fts(conn)

    audit("import", "medicines_db", None, f"Bulk import: {imported} nouveaux, {updated} mis à jour, {skipped} ignorés")
    return {
        "ok": True,
        "imported": imported,
        "updated": updated,
        "skipped": skipped,
        "errors": errors[:20],  # cap error list
        "total_in_file": len(meds),
    }


# =====================================================================
# VISIT TYPES / MOTIFS
# =====================================================================


@app.get("/api/visit-types")
def list_visit_types() -> dict[str, Any]:
    with connect() as conn:
        rows = rows_to_dicts(conn.execute("SELECT * FROM visit_types WHERE active=1 ORDER BY name").fetchall())
    return {"rows": rows}


@app.post("/api/visit-types", status_code=201)
def create_visit_type(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    name = payload.get("name", "").strip()
    price = float(payload.get("price", 0))
    if not name:
        raise HTTPException(status_code=400, detail="Nom requis")
    with connect() as conn:
        cur = conn.execute("INSERT OR IGNORE INTO visit_types (name, price) VALUES (?, ?)", (name, price))
    return {"id": cur.lastrowid, "ok": True}


@app.put("/api/visit-types/{vt_id}")
def update_visit_type(vt_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    with connect() as conn:
        conn.execute(
            "UPDATE visit_types SET name=?, price=?, active=? WHERE id=?",
            (payload.get("name", ""), float(payload.get("price", 0)), int(payload.get("active", 1)), vt_id),
        )
    return {"ok": True}


# =====================================================================
# BILAN (LAB/EXAM ORDER) API
# =====================================================================


@app.post("/api/bilan-catalog")
def add_bilan_catalog_item(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Manually add a new exam to the bilan catalog."""
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="name is required")
    category = (payload.get("category") or "Autre").strip()
    with connect() as conn:
        existing = conn.execute("SELECT id FROM bilan_catalog WHERE lower(name)=lower(?)", (name,)).fetchone()
        if existing:
            return {"id": existing["id"], "created": False}
        cursor = conn.execute(
            "INSERT INTO bilan_catalog (name, category, active, sort_order) VALUES (?, ?, 1, 999)",
            (name, category),
        )
        conn.commit()
        return {"id": cursor.lastrowid, "created": True, "name": name, "category": category}


@app.get("/api/bilan-catalog")
def list_bilan_catalog(category: str = "", q: str = "") -> dict[str, Any]:
    """Return bilan catalog, optionally filtered by category or search."""
    with connect() as conn:
        if category and q:
            rows = rows_to_dicts(conn.execute(
                "SELECT * FROM bilan_catalog WHERE active=1 AND category=? AND lower(name) LIKE ? ORDER BY sort_order, name",
                (category, f"%{q.lower()}%"),
            ).fetchall())
        elif category:
            rows = rows_to_dicts(conn.execute(
                "SELECT * FROM bilan_catalog WHERE active=1 AND category=? ORDER BY sort_order, name",
                (category,),
            ).fetchall())
        elif q:
            rows = rows_to_dicts(conn.execute(
                "SELECT * FROM bilan_catalog WHERE active=1 AND lower(name) LIKE ? ORDER BY sort_order, name",
                (f"%{q.lower()}%",),
            ).fetchall())
        else:
            rows = rows_to_dicts(conn.execute(
                "SELECT * FROM bilan_catalog WHERE active=1 ORDER BY category, sort_order, name"
            ).fetchall())
        cats = [r["category"] for r in conn.execute(
            "SELECT DISTINCT category FROM bilan_catalog WHERE active=1 ORDER BY category"
        ).fetchall()]
    return {"rows": rows, "categories": cats}


@app.post("/api/patients/{patient_id}/bilans", status_code=201)
def create_bilan(patient_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Create a new bilan (exam order) for a patient with selected exam items."""
    items = payload.get("items", [])  # list of {catalog_id, custom_name}
    note = payload.get("doctor_note", "")
    visit_id = payload.get("visit_id")
    date = payload.get("requested_date", now_iso())

    with connect() as conn:
        p = conn.execute("SELECT id FROM patients WHERE id=?", (patient_id,)).fetchone()
        if not p:
            raise HTTPException(status_code=404, detail="Patient introuvable")
        cur = conn.execute(
            "INSERT INTO bilans (patient_id, visit_id, requested_date, doctor_note) VALUES (?,?,?,?)",
            (patient_id, visit_id, date, note),
        )
        bilan_id = cur.lastrowid
        for it in items:
            conn.execute(
                "INSERT INTO bilan_items (bilan_id, catalog_id, custom_name) VALUES (?,?,?)",
                (bilan_id, it.get("catalog_id"), it.get("custom_name", "")),
            )
    audit("create", "bilans", bilan_id, f"Bilan créé pour patient {patient_id}")
    return {"id": bilan_id, "ok": True}


@app.get("/api/patients/{patient_id}/bilans")
def list_bilans(patient_id: int) -> dict[str, Any]:
    with connect() as conn:
        bilans = rows_to_dicts(conn.execute(
            "SELECT * FROM bilans WHERE patient_id=? ORDER BY requested_date DESC",
            (patient_id,),
        ).fetchall())
        for b in bilans:
            b["items"] = rows_to_dicts(conn.execute(
                """SELECT bi.*, bc.name AS catalog_name, bc.category
                   FROM bilan_items bi
                   LEFT JOIN bilan_catalog bc ON bc.id = bi.catalog_id
                   WHERE bi.bilan_id = ?
                   ORDER BY bi.id""",
                (b["id"],),
            ).fetchall())
    return {"rows": bilans}


@app.put("/api/bilans/{bilan_id}")
def update_bilan(bilan_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    with connect() as conn:
        conn.execute(
            "UPDATE bilans SET doctor_note=?, status=?, updated_at=? WHERE id=?",
            (payload.get("doctor_note", ""), payload.get("status", "requested"), now_iso(), bilan_id),
        )
    return {"ok": True}


@app.put("/api/bilan-items/{item_id}/result")
def update_bilan_item_result(item_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    with connect() as conn:
        conn.execute(
            "UPDATE bilan_items SET result=?, result_date=?, unit=?, reference_range=?, status=? WHERE id=?",
            (
                payload.get("result", ""),
                payload.get("result_date", now_iso()),
                payload.get("unit", ""),
                payload.get("reference_range", ""),
                payload.get("status", "done"),
                item_id,
            ),
        )
    return {"ok": True}


@app.delete("/api/bilans/{bilan_id}")
def delete_bilan(bilan_id: int) -> dict[str, Any]:
    with connect() as conn:
        conn.execute("DELETE FROM bilans WHERE id=?", (bilan_id,))
    return {"ok": True}


@app.get("/api/bilans/{bilan_id}/print")
def print_bilan(bilan_id: int) -> dict[str, Any]:
    """Return bilan data + doctor header (JSON) for client-side rendering."""
    with connect() as conn:
        bilan = conn.execute(
            """SELECT b.*, p.nom, p.prenom, p.date_naissance, p.sexe, p.telephone, p.age
               FROM bilans b JOIN patients p ON p.id = b.patient_id
               WHERE b.id=?""",
            (bilan_id,),
        ).fetchone()
        if not bilan:
            raise HTTPException(status_code=404, detail="Bilan introuvable")
        items = rows_to_dicts(conn.execute(
            """SELECT bi.*, bc.name AS catalog_name, bc.category
               FROM bilan_items bi
               LEFT JOIN bilan_catalog bc ON bc.id = bi.catalog_id
               WHERE bi.bilan_id = ? ORDER BY bc.category, bi.id""",
            (bilan_id,),
        ).fetchall())
        s = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM app_settings").fetchall()}
    doctor = {
        "name": s.get("DOCTOR_NAME", ""),
        "specialty": s.get("DOCTOR_SPECIALTY", ""),
        "order_number": s.get("DOCTOR_ORDER_NUMBER", ""),
        "phone": s.get("DOCTOR_PHONE", "") or s.get("CABINET_PHONE", ""),
        "address": s.get("DOCTOR_ADDRESS", "") or s.get("CABINET_ADDRESS", ""),
        "clinic_name": s.get("CLINIC_NAME", "") or s.get("CABINET_NAME", ""),
        "clinic_city": s.get("CLINIC_CITY", ""),
        "logo_b64": s.get("DOCTOR_LOGO_B64", ""),
    }
    return {"bilan": dict(bilan), "items": items, "doctor": doctor}


@app.get("/api/bilans/{bilan_id}/preview", response_class=HTMLResponse)
def preview_bilan_html(bilan_id: int) -> HTMLResponse:
    """Return a fully self-contained printable HTML page for the bilan (like ordonnance preview)."""
    with connect() as conn:
        bilan = conn.execute(
            """SELECT b.*, p.nom, p.prenom, p.date_naissance, p.sexe, p.telephone, p.age
               FROM bilans b JOIN patients p ON p.id = b.patient_id WHERE b.id=?""",
            (bilan_id,),
        ).fetchone()
        if not bilan:
            raise HTTPException(status_code=404, detail="Bilan introuvable")
        items = rows_to_dicts(conn.execute(
            """SELECT bi.*, bc.name AS catalog_name, bc.category
               FROM bilan_items bi
               LEFT JOIN bilan_catalog bc ON bc.id = bi.catalog_id
               WHERE bi.bilan_id = ? ORDER BY bc.category, bi.id""",
            (bilan_id,),
        ).fetchall())
        s = {r["key"]: r["value"] for r in conn.execute("SELECT key, value FROM app_settings").fetchall()}

    b = dict(bilan)
    doc_name = s.get("DOCTOR_NAME", "Dr. Médecin")
    doc_spec = s.get("DOCTOR_SPECIALTY", "")
    doc_num = s.get("DOCTOR_ORDER_NUMBER", "")
    doc_phone = s.get("DOCTOR_PHONE", "") or s.get("CABINET_PHONE", "")
    doc_addr = s.get("DOCTOR_ADDRESS", "") or s.get("CABINET_ADDRESS", "")
    clinic = s.get("CLINIC_NAME", "") or s.get("CABINET_NAME", "")
    city = s.get("CLINIC_CITY", "")
    logo_b64 = s.get("DOCTOR_LOGO_B64", "")

    import html as ht
    today = datetime.now().strftime("%d/%m/%Y")
    pat_name = ht.escape(f"{b.get('nom','').upper()} {b.get('prenom','')}")
    pat_dob = ht.escape(str(b.get("date_naissance", "") or "")[:10])
    pat_age = ht.escape(str(b.get("age", "") or ""))
    pat_sex = ht.escape(str(b.get("sexe", "") or ""))

    # Group items by category
    by_cat: dict[str, list[str]] = {}
    for it in items:
        cat = it.get("category") or "Autre"
        name = ht.escape(it.get("catalog_name") or it.get("custom_name") or "")
        by_cat.setdefault(cat, []).append(name)

    cat_colors = {"Biologie": "#1d4ed8", "Radiologie": "#7c3aed", "Autre": "#059669"}
    cat_html = ""
    for cat, names in by_cat.items():
        color = cat_colors.get(cat, "#374151")
        items_html = "".join(f"<li>{n}</li>" for n in names)
        cat_html += f"""
        <div class="cat-block">
          <div class="cat-title" style="color:{color};">{ht.escape(cat)}</div>
          <ul>{items_html}</ul>
        </div>"""

    note_html = ""
    if b.get("doctor_note"):
        note_html = f'<div class="note">Note: {ht.escape(str(b["doctor_note"]))}</div>'

    logo_html = ""
    if logo_b64:
        logo_html = f'<img src="{logo_b64}" style="max-height:70px;max-width:80px;object-fit:contain;" alt="logo"/>'

    doc_addr_full = doc_addr + (f" — {city}" if city else "")

    html_page = f"""<!DOCTYPE html>
<html lang="fr"><head>
<meta charset="utf-8">
<title>Bilan — {pat_name}</title>
<style>
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{font-family:'Times New Roman',serif;font-size:12pt;color:#111;background:#fff}}
  @page{{size:A4;margin:12mm 15mm}}
  .hdr-tbl{{width:100%;border-collapse:collapse;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:4px}}
  .hdr-tbl td{{vertical-align:top;padding:0 6px}}
  .hdr-left{{width:38%}}
  .hdr-center{{width:24%;text-align:center;vertical-align:middle}}
  .hdr-right{{width:38%;text-align:right}}
  .doc-name{{font-size:13.5pt;font-weight:bold;margin-bottom:2px}}
  .doc-spec{{font-size:10.5pt;font-weight:bold}}
  .doc-ordre{{font-size:9pt;margin-top:3px}}
  .hdr-right .rl{{font-size:10.5pt;margin:2px 0}}
  .sep{{border:none;border-top:2px solid #000;margin:6px 0 10px}}
  .title-line{{font-size:13pt;font-weight:700;text-align:center;margin:12px 0 10px;letter-spacing:.3px}}
  .cat-block{{margin-bottom:12px}}
  .cat-title{{font-size:10.5pt;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;color:#374151}}
  ul{{list-style:none;padding-left:0}}
  li{{padding:4px 0 4px 18px;border-bottom:1px solid #f3f4f6;position:relative;font-size:11.5pt}}
  li::before{{content:"☐";position:absolute;left:0;color:#9ca3af}}
  .note{{margin-top:14px;font-size:10pt;color:#6b7280;border-top:1px dashed #d1d5db;padding-top:8px}}
  .ftr{{margin-top:30px;border-top:1.5px solid #000;padding-top:7px;font-size:9pt;text-align:center;color:#374151}}
  .no-print{{display:block;text-align:center;margin:16px 0}}
  .print-btn{{padding:8px 24px;background:#1d4ed8;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600}}
  @media print{{.no-print{{display:none!important}}body{{padding:0}}}}
</style>
</head><body>

<table class="hdr-tbl"><tr>
  <td class="hdr-left">
    <div class="doc-name">{ht.escape(doc_name)}</div>
    <div class="doc-spec">{ht.escape(doc_spec)}</div>
    {('<div class="doc-ordre">N&deg; d\'ordre des m&eacute;decins : ' + ht.escape(doc_num) + '</div>') if doc_num else ''}
  </td>
  <td class="hdr-center">{logo_html}</td>
  <td class="hdr-right">
    <div class="rl">Date&nbsp;: <strong>{today}</strong></div>
    <div class="rl">Nom&nbsp;: <strong>{ht.escape(b.get('nom','').upper())}</strong></div>
    <div class="rl">Pr&eacute;nom&nbsp;: <strong>{ht.escape(str(b.get('prenom','') or ''))}</strong></div>
    {('<div class="rl">Age&nbsp;: <strong>' + ht.escape(pat_age) + ' ans</strong></div>') if pat_age else ''}
    {('<div class="rl">N&eacute;(e) le&nbsp;: <strong>' + ht.escape(pat_dob) + '</strong></div>') if pat_dob and not pat_age else ''}
  </td>
</tr></table>
<hr class="sep"/>

<div class="title-line">Demande d&rsquo;examens compl&eacute;mentaires</div>

{cat_html}
{note_html}

<div class="ftr">
  {('&#9990; ' + ht.escape(doc_phone) + ' &nbsp;&nbsp;') if doc_phone else ''}
  {('&#9993; ' + ht.escape(s.get('DOCTOR_EMAIL','') or '')) if s.get('DOCTOR_EMAIL') else ''}
  {('&nbsp;&nbsp;&#9492; ' + ht.escape(doc_addr_full)) if doc_addr_full else ''}
</div>

<div class="no-print"><button class="print-btn" onclick="window.print()">&#128438; Imprimer / Enregistrer PDF</button></div>
</body></html>"""
    return HTMLResponse(content=html_page)


# =====================================================================
# FINANCE / REVENUE API
# =====================================================================


@app.get("/api/finance/summary")
def finance_summary(
    date_from: str = "",
    date_to: str = "",
    period: str = "",
) -> dict[str, Any]:
    """Get financial summary. period can be 'today', 'week', 'month', 'year' or empty for custom range."""
    where_clauses = []
    params: list[Any] = []

    if period == "today":
        where_clauses.append("date(v.date_visite) = date('now', 'localtime')")
    elif period == "week":
        where_clauses.append("date(v.date_visite) >= date('now', 'localtime', '-7 days')")
    elif period == "month":
        where_clauses.append("strftime('%Y-%m', v.date_visite) = strftime('%Y-%m', 'now', 'localtime')")
    elif period == "year":
        where_clauses.append("strftime('%Y', v.date_visite) = strftime('%Y', 'now', 'localtime')")
    else:
        if date_from:
            where_clauses.append("date(v.date_visite) >= ?")
            params.append(date_from)
        if date_to:
            where_clauses.append("date(v.date_visite) <= ?")
            params.append(date_to)

    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    with connect() as conn:
        row = conn.execute(
            f"""SELECT
                COUNT(*) as total_visits,
                COALESCE(SUM(v.visit_fee), 0) as total_fees,
                COALESCE(SUM(v.fee_paid), 0) as total_paid,
                COALESCE(SUM(v.visit_fee) - SUM(v.fee_paid), 0) as total_unpaid
            FROM visits v{where_sql}""",
            params,
        ).fetchone()
        summary = dict(row) if row else {}

        # Per-visit-type breakdown
        by_type = rows_to_dicts(conn.execute(
            f"""SELECT
                COALESCE(v.visit_type, 'Non specifie') as visit_type,
                COUNT(*) as count,
                COALESCE(SUM(v.visit_fee), 0) as total_fees,
                COALESCE(SUM(v.fee_paid), 0) as total_paid
            FROM visits v{where_sql}
            GROUP BY v.visit_type
            ORDER BY total_fees DESC""",
            params,
        ).fetchall())

        # Daily breakdown for chart
        daily = rows_to_dicts(conn.execute(
            f"""SELECT
                date(v.date_visite) as day,
                COUNT(*) as visits,
                COALESCE(SUM(v.visit_fee), 0) as fees,
                COALESCE(SUM(v.fee_paid), 0) as paid
            FROM visits v{where_sql}
            GROUP BY date(v.date_visite)
            ORDER BY day DESC
            LIMIT 31""",
            params,
        ).fetchall())

        # Top patients by revenue
        top_patients = rows_to_dicts(conn.execute(
            f"""SELECT
                p.id, p.nom, p.prenom, p.code,
                COUNT(v.id) as visit_count,
                COALESCE(SUM(v.visit_fee), 0) as total_fees,
                COALESCE(SUM(v.fee_paid), 0) as total_paid,
                COALESCE(SUM(v.visit_fee) - SUM(v.fee_paid), 0) as balance
            FROM visits v
            JOIN patients p ON p.id = v.patient_id
            {where_sql}
            GROUP BY p.id
            ORDER BY total_fees DESC
            LIMIT 20""",
            params,
        ).fetchall())

    return {
        "summary": summary,
        "by_type": by_type,
        "daily": daily,
        "top_patients": top_patients,
    }


@app.get("/api/finance/patient/{patient_id}")
def patient_finance(patient_id: int) -> dict[str, Any]:
    """Get all visit fees for a specific patient."""
    with connect() as conn:
        visits = rows_to_dicts(conn.execute(
            """SELECT id, date_visite, visit_type, motif, visit_fee, fee_paid, payment_status
            FROM visits WHERE patient_id=? ORDER BY date_visite DESC""",
            (patient_id,),
        ).fetchall())
        totals = conn.execute(
            """SELECT
                COALESCE(SUM(visit_fee), 0) as total_fees,
                COALESCE(SUM(fee_paid), 0) as total_paid,
                COALESCE(SUM(visit_fee) - SUM(fee_paid), 0) as balance,
                COUNT(*) as total_visits
            FROM visits WHERE patient_id=?""",
            (patient_id,),
        ).fetchone()
    return {"visits": visits, "totals": dict(totals) if totals else {}}


@app.put("/api/visits/{visit_id}/payment")
def update_visit_payment(visit_id: int, payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    """Update payment for a visit."""
    fee_paid = float(payload.get("fee_paid", 0))
    with connect() as conn:
        visit = conn.execute("SELECT visit_fee FROM visits WHERE id=?", (visit_id,)).fetchone()
        if not visit:
            raise HTTPException(status_code=404, detail="Visite introuvable")
        status = "paid" if fee_paid >= visit["visit_fee"] and visit["visit_fee"] > 0 else ("partial" if fee_paid > 0 else "pending")
        conn.execute("UPDATE visits SET fee_paid=?, payment_status=? WHERE id=?", (fee_paid, status, visit_id))
    return {"ok": True, "payment_status": status}


# =====================================================================
# ENHANCED APPOINTMENTS (date-range filtering)
# =====================================================================


@app.get("/api/appointments/filtered")
def list_appointments_filtered(
    period: str = "today",
    date_from: str = "",
    date_to: str = "",
) -> dict[str, Any]:
    """List appointments with period filtering: today, week, month, custom."""
    where_clauses = []
    params: list[Any] = []

    if period == "today":
        where_clauses.append("date(a.scheduled_at) = date('now', 'localtime')")
    elif period == "week":
        where_clauses.append("date(a.scheduled_at) >= date('now', 'localtime', '-7 days')")
        where_clauses.append("date(a.scheduled_at) <= date('now', 'localtime', '+7 days')")
    elif period == "month":
        where_clauses.append("strftime('%Y-%m', a.scheduled_at) = strftime('%Y-%m', 'now', 'localtime')")
    elif period == "custom":
        if date_from:
            where_clauses.append("date(a.scheduled_at) >= ?")
            params.append(date_from)
        if date_to:
            where_clauses.append("date(a.scheduled_at) <= ?")
            params.append(date_to)

    where_sql = (" WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            f"""SELECT a.*, p.nom, p.prenom, p.code, p.telephone
            FROM appointments a
            LEFT JOIN patients p ON p.id = a.patient_id
            {where_sql}
            ORDER BY a.status = 'urgent' DESC, a.scheduled_at ASC""",
            params,
        ).fetchall())
        counts = conn.execute(
            f"SELECT COUNT(*) as total, SUM(CASE WHEN a.status='urgent' THEN 1 ELSE 0 END) as urgent FROM appointments a{where_sql}",
            params,
        ).fetchone()
    return {"rows": rows, "total": counts["total"] if counts else 0, "urgent": counts["urgent"] if counts else 0}


# ═══════════════════════════════════════════════════════════════════════════
# DATA MIGRATION / IMPORT API
# ═══════════════════════════════════════════════════════════════════════════

from backend.migration.connectors import ConnectorFactory
from backend.migration.backup import create_backup, list_import_backups, restore_backup
from backend.migration.importer import ImportEngine, detect_duplicates, _apply_mapping

_IMPORT_SESSION: dict = {}  # in-memory session per job_id


@app.post("/api/import/upload")
async def import_upload(file: UploadFile = File(...)):
    """Step 2: Upload file (CSV / Excel / SQLite / JSON). Returns tables + sample columns."""
    try:
        content = await file.read()
        fname = file.filename or "upload"
        ext = Path(fname).suffix.lstrip(".").lower()
        source_map = {"csv": "csv", "xlsx": "excel", "xls": "excel",
                      "sqlite3": "sqlite", "sqlite": "sqlite", "db": "sqlite",
                      "json": "json"}
        source_type = source_map.get(ext, ext)
        result = ConnectorFactory.from_file(source_type, content, fname)
        # store in session
        session_id = secrets.token_hex(8)
        _IMPORT_SESSION[session_id] = {
            "source_type": source_type, "filename": fname,
            "tables": result["tables"], "columns": result["columns"],
            "rows": result["rows"], "total": result["total"],
        }
        return {
            "session_id": session_id,
            "source_type": source_type,
            "tables": result["tables"],
            "columns": result["columns"],
            "total": result["total"],
            "sample": {t: result["rows"][t][:5] for t in result["tables"]},
        }
    except Exception as e:
        raise HTTPException(400, f"Erreur lecture fichier: {e}")


@app.post("/api/import/connect-db")
async def import_connect_db(body: dict = Body(...)):
    """Step 2 (DB): Connect to external MySQL / PostgreSQL / SQL Server."""
    try:
        result = ConnectorFactory.from_db(
            body["source_type"], body["host"], int(body.get("port", 3306)),
            body["user"], body["password"], body["database"],
            body.get("tables"),
        )
        session_id = secrets.token_hex(8)
        _IMPORT_SESSION[session_id] = {
            "source_type": body["source_type"],
            "filename": body["database"],
            "tables": result["tables"],
            "columns": result["columns"],
            "rows": result["rows"],
            "total": result["total"],
        }
        return {
            "session_id": session_id,
            "tables": result["tables"],
            "columns": result["columns"],
            "total": result["total"],
            "sample": {t: result["rows"][t][:5] for t in result["tables"]},
        }
    except Exception as e:
        raise HTTPException(400, f"Connexion impossible: {e}")


@app.get("/api/import/session/{session_id}")
def import_session_info(session_id: str):
    s = _IMPORT_SESSION.get(session_id)
    if not s:
        raise HTTPException(404, "Session expirée. Re-uploadez le fichier.")
    return {"tables": s["tables"], "columns": s["columns"], "total": s["total"]}


@app.post("/api/import/preview")
async def import_preview(body: dict = Body(...)):
    """Step 4-5: Preview mapped data with duplicate detection (first 50 rows)."""
    session_id = body.get("session_id", "")
    s = _IMPORT_SESSION.get(session_id)
    if not s:
        raise HTTPException(404, "Session expirée.")
    table = body.get("table", s["tables"][0] if s["tables"] else "")
    rows = s["rows"].get(table, [])
    patient_mapping = body.get("patient_mapping", {})
    source_name = s.get("filename") or s.get("source_name") or "import"
    engine = ImportEngine(str(DB_PATH))
    preview = engine.preview_with_duplicates(
        rows, patient_mapping, limit=50,
        source_name=source_name, old_table=table,
    )
    return {
        "rows": preview["rows"],
        "stats": preview["stats"],
        "total_source": s["total"].get(table, len(rows)),
    }


@app.post("/api/import/execute")
async def import_execute(body: dict = Body(...)):
    """Step 7: Execute import (dry_run or real). Creates backup first."""
    session_id = body.get("session_id", "")
    s = _IMPORT_SESSION.get(session_id)
    if not s:
        raise HTTPException(404, "Session expirée.")

    patient_table = body.get("patient_table", s["tables"][0] if s["tables"] else "")
    visit_table = body.get("visit_table", "")
    patient_mapping: dict = body.get("patient_mapping", {})
    visit_mapping: dict = body.get("visit_mapping", {})
    on_duplicate: str = body.get("on_duplicate", "skip")
    dry_run: bool = bool(body.get("dry_run", False))

    patient_rows = s["rows"].get(patient_table, [])
    visit_rows = s["rows"].get(visit_table, []) if visit_table else []

    backup_path_str = ""
    if not dry_run:
        try:
            bp = create_backup(DB_PATH, BACKUPS, label="pre_import")
            backup_path_str = str(bp)
        except Exception as e:
            raise HTTPException(500, f"Sauvegarde échouée: {e}")

    with connect() as conn:
        cur = conn.execute(
            """INSERT INTO import_jobs
               (source_type, source_name, status, dry_run, on_duplicate,
                patients_total, backup_path, mapping_json, created_at)
               VALUES (?,?,?,?,?,?,?,?,?)""",
            (s["source_type"], s.get("filename"), "running", int(dry_run),
             on_duplicate, len(patient_rows), backup_path_str,
             json.dumps({"patient": patient_mapping, "visit": visit_mapping}),
             now_iso()),
        )
        job_id = cur.lastrowid
        conn.commit()

    source_name = s.get("filename") or s.get("source_name") or "import"
    source_type = s.get("source_type", "file")
    try:
        engine = ImportEngine(str(DB_PATH))
        result = engine.execute(
            job_id, patient_rows, patient_mapping,
            visit_rows, visit_mapping,
            on_duplicate=on_duplicate, dry_run=dry_run,
            source_name=source_name, source_type=source_type,
            patient_table=patient_table, visit_table=visit_table,
        )
        if not dry_run:
            with connect() as conn:
                conn.execute(
                    """UPDATE import_jobs SET status='done',
                       patients_imported=?, patients_skipped=?, patients_merged=?,
                       patients_updated=?, visits_imported=?, errors=?, finished_at=? WHERE id=?""",
                    (result["patients"]["imported"], result["patients"]["skipped"],
                     result["patients"].get("merged", 0), result["patients"].get("updated", 0),
                     result["visits"]["imported"],
                     json.dumps(result["patients"]["errors"] + result["visits"]["errors"]),
                     now_iso(), job_id),
                )
                conn.commit()
        return {"job_id": job_id, "backup_path": backup_path_str, **result}
    except Exception as e:
        with connect() as conn:
            conn.execute("UPDATE import_jobs SET status='error', errors=?, finished_at=? WHERE id=?",
                         (str(e)[:2000], now_iso(), job_id))
            conn.commit()
        raise HTTPException(500, f"Erreur import: {e}")


@app.get("/api/import/jobs")
def import_list_jobs():
    with connect() as conn:
        rows = rows_to_dicts(conn.execute(
            "SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 50"
        ).fetchall())
    return {"rows": rows}


@app.get("/api/import/jobs/{job_id}")
def import_job_detail(job_id: int):
    with connect() as conn:
        job = conn.execute("SELECT * FROM import_jobs WHERE id=?", (job_id,)).fetchone()
        if not job:
            raise HTTPException(404, "Job introuvable")
        logs = rows_to_dicts(conn.execute(
            "SELECT * FROM import_logs WHERE job_id=? ORDER BY id DESC LIMIT 200",
            (job_id,)
        ).fetchall())
    return {"job": dict(job), "logs": logs}


@app.post("/api/import/rollback/{job_id}")
def import_rollback(job_id: int):
    with connect() as conn:
        job = conn.execute("SELECT * FROM import_jobs WHERE id=?", (job_id,)).fetchone()
        if not job:
            raise HTTPException(404, "Job introuvable")
        backup_path = job["backup_path"] or ""
    if not backup_path or not Path(backup_path).exists():
        raise HTTPException(400, "Aucune sauvegarde disponible pour ce job")
    try:
        restore_backup(Path(backup_path), DB_PATH)
        return {"ok": True, "message": f"Base restaurée depuis: {Path(backup_path).name}"}
    except Exception as e:
        raise HTTPException(500, f"Rollback échoué: {e}")


@app.get("/api/import/backups")
def import_list_backups():
    return {"backups": list_import_backups(BACKUPS)}


@app.get("/api/import/report/{job_id}")
def import_report(job_id: int):
    with connect() as conn:
        job = conn.execute("SELECT * FROM import_jobs WHERE id=?", (job_id,)).fetchone()
        if not job:
            raise HTTPException(404, "Job introuvable")
        job_dict = dict(job)
        errors = json.loads(job_dict.get("errors") or "[]")
        mapping = json.loads(job_dict.get("mapping_json") or "{}")
        logs_count = conn.execute(
            "SELECT COUNT(*) as n FROM import_logs WHERE job_id=?", (job_id,)
        ).fetchone()["n"]
    return {
        "job": job_dict,
        "errors": errors[:50],
        "mapping": mapping,
        "logs_count": logs_count,
        "summary": {
            "source": job_dict.get("source_name"),
            "type": job_dict.get("source_type"),
            "patients_imported": job_dict.get("patients_imported", 0),
            "patients_skipped": job_dict.get("patients_skipped", 0),
            "patients_merged": job_dict.get("patients_merged", 0),
            "visits_imported": job_dict.get("visits_imported", 0),
            "total_errors": len(errors),
            "dry_run": bool(job_dict.get("dry_run")),
            "status": job_dict.get("status"),
            "started": job_dict.get("created_at"),
            "finished": job_dict.get("finished_at"),
        },
    }


# ═══════════════════════════════════════════════════════════════════════════
# SETUP WIZARD + SPECIALITY API
# ═══════════════════════════════════════════════════════════════════════════

@app.get("/api/setup/status")
def setup_status():
    """Returns whether first-launch setup is complete and current speciality."""
    with connect() as conn:
        done = get_setting("SETUP_COMPLETE")
        speciality = get_setting("DOCTOR_SPECIALITY_ID") or "cardiologie"
        # Auto-complete: if DB has patients already, consider setup done
        if not done:
            count = conn.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
            if count > 0:
                conn.execute("INSERT OR REPLACE INTO app_settings(key,value) VALUES(?,?)", ("SETUP_COMPLETE", "1"))
                conn.execute("INSERT OR REPLACE INTO app_settings(key,value) VALUES(?,?)", ("DOCTOR_SPECIALITY_ID", speciality))
                conn.commit()
                done = "1"
        return {"setup_complete": bool(done), "speciality": speciality}


@app.post("/api/setup/complete")
def setup_complete(body: dict):
    """Save first-launch configuration and mark setup as done."""
    with connect() as conn:
        mapping = {
            "speciality":      "DOCTOR_SPECIALITY_ID",
            "doctor_name":     "DOCTOR_NAME",
            "doctor_order":    "DOCTOR_ORDER_NUMBER",
            "doctor_phone":    "DOCTOR_PHONE",
            "doctor_email":    "DOCTOR_EMAIL",
            "doctor_address":  "DOCTOR_ADDRESS",
            "clinic_name":     "CLINIC_NAME",
            "logo_b64":        "DOCTOR_LOGO_B64",
        }
        for field, key in mapping.items():
            val = body.get(field, "")
            if val:
                conn.execute("INSERT OR REPLACE INTO app_settings(key,value) VALUES(?,?)", (key, val))
                # mirror CLINIC_NAME → CABINET_NAME
                if key == "CLINIC_NAME":
                    conn.execute("INSERT OR REPLACE INTO app_settings(key,value) VALUES(?,?)", ("CABINET_NAME", val))
        conn.execute("INSERT OR REPLACE INTO app_settings(key,value) VALUES(?,?)", ("SETUP_COMPLETE", "1"))
        conn.commit()
    data_mode = body.get("data_mode", "new")
    return {"ok": True, "speciality": body.get("speciality", "cardiologie"), "data_mode": data_mode}


@app.post("/api/setup/restore")
async def setup_restore(file: UploadFile = File(...)) -> dict[str, Any]:
    """Restore a SQLite backup file as the main database."""
    import shutil
    from pathlib import Path

    fname = Path(file.filename or "").name
    if not fname.lower().endswith(".sqlite3"):
        raise HTTPException(400, "Fichier invalide. Veuillez sélectionner une sauvegarde .sqlite3.")

    tmp_path = DATA / f"_restore_tmp_{secrets.token_hex(6)}.sqlite3"
    try:
        content = await file.read()
        tmp_path.write_bytes(content)
        # Validate SQLite format
        try:
            with sqlite3.connect(str(tmp_path)) as test_conn:
                test_conn.execute("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1")
        except Exception:
            raise HTTPException(400, "Le fichier n'est pas une base SQLite valide.")

        # Backup current DB before overwrite
        if DB_PATH.is_file():
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            pre_restore = BACKUPS / f"pre_restore_{ts}.sqlite3"
            BACKUPS.mkdir(parents=True, exist_ok=True)
            shutil.copy2(DB_PATH, pre_restore)

        # Replace DB
        shutil.copy2(tmp_path, DB_PATH)

        # Re-run migrations to bring schema up to date
        init_db()

        # Mark setup complete
        with connect() as conn:
            conn.execute("INSERT OR REPLACE INTO app_settings(key,value) VALUES(?,?)", ("SETUP_COMPLETE", "1"))
            conn.commit()

        return {"ok": True, "message": "Base restaurée avec succès.", "tables_checked": True}
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


@app.get("/api/speciality/config")
def get_speciality_config():
    """Returns the current doctor speciality ID and settings."""
    spec = get_setting("DOCTOR_SPECIALITY_ID") or "cardiologie"
    name = get_setting("DOCTOR_NAME") or ""
    clinic = get_setting("CLINIC_NAME") or ""
    return {"speciality": spec, "doctor_name": name, "clinic_name": clinic}


@app.get("/api/patients/{patient_id}/specialty-data")
def get_specialty_data(patient_id: int):
    """Get speciality-specific data for a patient."""
    with connect() as conn:
        row = conn.execute(
            "SELECT data_json FROM patient_specialty_data WHERE patient_id = ?",
            (patient_id,)
        ).fetchone()
        if row:
            try:
                import json as _json
                return {"data": _json.loads(row["data_json"] or "{}")}
            except Exception:
                pass
        return {"data": {}}


@app.put("/api/patients/{patient_id}/specialty-data")
def save_specialty_data(patient_id: int, body: dict):
    """Save speciality-specific data for a patient."""
    import json as _json
    speciality = body.get("speciality", "generaliste")
    data = body.get("data", {})
    with connect() as conn:
        conn.execute("""
            INSERT INTO patient_specialty_data(patient_id, speciality, data_json, updated_at)
            VALUES(?,?,?,CURRENT_TIMESTAMP)
            ON CONFLICT(patient_id, speciality) DO UPDATE SET
              data_json=excluded.data_json,
              updated_at=excluded.updated_at
        """, (patient_id, speciality, _json.dumps(data, ensure_ascii=False)))
        conn.commit()
    return {"ok": True}


@app.on_event("shutdown")
def on_shutdown() -> None:
    tunnel_manager.stop()
