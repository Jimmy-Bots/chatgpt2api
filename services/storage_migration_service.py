from __future__ import annotations

from pathlib import Path
from typing import Any

from services.storage.base import StorageBackend
from services.storage.factory import create_storage_backend, resolve_storage_settings


def snapshot_storage(storage: StorageBackend) -> dict[str, list[dict[str, Any]]]:
    return {
        "accounts": storage.load_accounts(),
        "auth_keys": storage.load_auth_keys(),
    }


def write_storage_snapshot(storage: StorageBackend, snapshot: dict[str, list[dict[str, Any]]]) -> dict[str, int]:
    accounts = snapshot.get("accounts") or []
    auth_keys = snapshot.get("auth_keys") or []
    storage.save_accounts(accounts)
    storage.save_auth_keys(auth_keys)
    return {
        "accounts": len(accounts),
        "auth_keys": len(auth_keys),
    }


def build_storage(data_dir: Path, settings: object, *, use_env: bool) -> StorageBackend:
    return create_storage_backend(data_dir, resolve_storage_settings(settings, use_env=use_env), use_env=False)
