"""Database backup utilities for safe import."""
from __future__ import annotations
import shutil
from datetime import datetime
from pathlib import Path


def create_backup(db_path: Path, backups_dir: Path, label: str = "pre_import") -> Path:
    """Copy the SQLite DB to backups dir. Returns the backup path."""
    backups_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = backups_dir / f"backup_{label}_{ts}.sqlite3"
    shutil.copy2(db_path, backup_path)
    return backup_path


def list_import_backups(backups_dir: Path) -> list[dict]:
    if not backups_dir.exists():
        return []
    files = sorted(backups_dir.glob("backup_pre_import_*.sqlite3"), reverse=True)
    return [
        {"filename": f.name, "path": str(f), "size_mb": round(f.stat().st_size / 1_048_576, 2),
         "created": datetime.fromtimestamp(f.stat().st_mtime).strftime("%Y-%m-%d %H:%M:%S")}
        for f in files[:20]
    ]


def restore_backup(backup_path: Path, db_path: Path) -> None:
    """Restore a backup to the DB path (emergency rollback)."""
    if not backup_path.exists():
        raise FileNotFoundError(f"Sauvegarde introuvable: {backup_path}")
    shutil.copy2(backup_path, db_path)
