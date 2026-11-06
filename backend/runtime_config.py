"""DocuAnalytics runtime secret source selection.

Production must never parse backend/.env, even when the deployment image contains it.
Only APP_ENV=production is treated as production; unknown modes fail closed.
"""
import os
from pathlib import Path
from dotenv import dotenv_values, load_dotenv


def load_app_env(root: Path):
    mode = (os.environ.get("APP_ENV") or "test").strip().lower()
    if mode not in {"production", "test", "preview", "development"}:
        raise RuntimeError("APP_ENV non valido; avvio bloccato.")
    if mode == "production":
        return {}
    env_file = Path(root) / ".env"
    load_dotenv(env_file, override=False)
    return dotenv_values(env_file) if env_file.exists() else {}
