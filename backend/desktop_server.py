from __future__ import annotations

import os
import sys
from pathlib import Path

import uvicorn


def _default_data_dir() -> Path:
    local_app_data = os.environ.get("LOCALAPPDATA")
    if local_app_data:
        return Path(local_app_data) / "MediSmart" / "data"
    return Path.home() / "MediSmart" / "data"


def _writable_data_dir(preferred: Path) -> Path:
    candidates = [
        preferred,
        Path(os.environ.get("APPDATA") or Path.home()) / "MediSmart" / "data",
        Path.home() / "Documents" / "MediSmart" / "data",
    ]
    for candidate in candidates:
        try:
            candidate.mkdir(parents=True, exist_ok=True)
            probe = candidate / ".write_test"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return candidate
        except Exception:
            continue
    return preferred


def main() -> None:
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        os.environ.setdefault("CARDIO_APP_ROOT", str(exe_dir))
        os.environ.setdefault("CARDIO_DATA_DIR", str(_writable_data_dir(_default_data_dir())))

    os.environ.setdefault("CARDIO_HOST", "127.0.0.1")
    os.environ.setdefault("CARDIO_PORT", "8000")

    from backend.main import app

    uvicorn.run(
        app,
        host=os.environ["CARDIO_HOST"],
        port=int(os.environ["CARDIO_PORT"]),
        log_level="warning",
        access_log=False,
    )


if __name__ == "__main__":
    main()
