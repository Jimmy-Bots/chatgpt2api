from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from services.storage.base import StorageBackend
from services.storage.database_storage import DatabaseStorageBackend
from services.storage.git_storage import GitStorageBackend
from services.storage.json_storage import JSONStorageBackend


def _clean(value: object) -> str:
    return str(value or "").strip()


def _normalize_backend_type(value: object) -> str:
    normalized = _clean(value).lower()
    if normalized == "postgresql":
        return "postgres"
    if normalized == "database":
        return "sqlite"
    return normalized


def has_explicit_storage_settings(raw: object) -> bool:
    data = raw if isinstance(raw, dict) else {}
    return any(
        _clean(data.get(key))
        for key in (
            "type",
            "backend",
            "database_url",
            "git_repo_url",
            "git_token",
            "git_branch",
            "git_file_path",
            "git_auth_keys_file_path",
        )
    )


def normalize_storage_settings(raw: object) -> dict[str, str]:
    data = raw if isinstance(raw, dict) else {}
    return {
        "type": _normalize_backend_type(data.get("type") or data.get("backend")),
        "database_url": _clean(data.get("database_url")),
        "git_repo_url": _clean(data.get("git_repo_url")),
        "git_token": _clean(data.get("git_token")),
        "git_branch": _clean(data.get("git_branch")) or "main",
        "git_file_path": _clean(data.get("git_file_path")) or "accounts.json",
        "git_auth_keys_file_path": _clean(data.get("git_auth_keys_file_path")) or "auth_keys.json",
    }


def resolve_storage_settings(raw: object = None, *, use_env: bool = True) -> dict[str, str]:
    settings = normalize_storage_settings(raw)
    if use_env and not has_explicit_storage_settings(raw):
        env_backend_type = _normalize_backend_type(os.getenv("STORAGE_BACKEND"))
        env_database_url = _clean(os.getenv("DATABASE_URL"))
        env_git_repo_url = _clean(os.getenv("GIT_REPO_URL"))
        env_git_token = _clean(os.getenv("GIT_TOKEN"))
        env_git_branch = _clean(os.getenv("GIT_BRANCH"))
        env_git_file_path = _clean(os.getenv("GIT_FILE_PATH"))
        env_git_auth_keys_file_path = _clean(os.getenv("GIT_AUTH_KEYS_FILE_PATH"))
        if env_backend_type:
            settings["type"] = env_backend_type
        if env_database_url:
            settings["database_url"] = env_database_url
        if env_git_repo_url:
            settings["git_repo_url"] = env_git_repo_url
        if env_git_token:
            settings["git_token"] = env_git_token
        if env_git_branch:
            settings["git_branch"] = env_git_branch
        if env_git_file_path:
            settings["git_file_path"] = env_git_file_path
        if env_git_auth_keys_file_path:
            settings["git_auth_keys_file_path"] = env_git_auth_keys_file_path
    if not settings["type"]:
        settings["type"] = "json"
    return settings


def describe_storage_settings(raw: object = None, *, use_env: bool = True) -> dict[str, Any]:
    settings = resolve_storage_settings(raw, use_env=use_env)
    return {
        **settings,
        "git_token": "",
        "database_url_masked": _mask_password(settings["database_url"]),
        "git_repo_url_masked": _mask_token(settings["git_repo_url"]),
        "git_token_masked": "****" if settings["git_token"] else "",
    }


def get_storage_env_overrides(raw: object = None) -> dict[str, bool]:
    if has_explicit_storage_settings(raw):
        return {
            "type": False,
            "database_url": False,
            "git_repo_url": False,
            "git_token": False,
            "git_branch": False,
            "git_file_path": False,
            "git_auth_keys_file_path": False,
        }
    return {
        "type": bool(_clean(os.getenv("STORAGE_BACKEND"))),
        "database_url": bool(_clean(os.getenv("DATABASE_URL"))),
        "git_repo_url": bool(_clean(os.getenv("GIT_REPO_URL"))),
        "git_token": bool(_clean(os.getenv("GIT_TOKEN"))),
        "git_branch": bool(_clean(os.getenv("GIT_BRANCH"))),
        "git_file_path": bool(_clean(os.getenv("GIT_FILE_PATH"))),
        "git_auth_keys_file_path": bool(_clean(os.getenv("GIT_AUTH_KEYS_FILE_PATH"))),
    }


def create_storage_backend(data_dir: Path, settings: object = None, *, use_env: bool = True) -> StorageBackend:
    """
    根据配置和环境变量创建存储后端
    """
    resolved = resolve_storage_settings(settings, use_env=use_env)
    backend_type = resolved["type"]
    
    print(f"[storage] Initializing storage backend: {backend_type}")
    
    if backend_type == "json":
        # 本地 JSON 文件存储
        file_path = data_dir / "accounts.json"
        auth_keys_path = data_dir / "auth_keys.json"
        print(f"[storage] Using JSON storage: {file_path}")
        return JSONStorageBackend(file_path, auth_keys_path)
    
    elif backend_type in ("sqlite", "postgres"):
        # 数据库存储
        database_url = resolved["database_url"]
        
        if not database_url:
            # 如果没有指定 DATABASE_URL，使用本地 SQLite
            database_url = f"sqlite:///{data_dir / 'accounts.db'}"
            print(f"[storage] No DATABASE_URL provided, using local SQLite: {database_url}")
        else:
            print(f"[storage] Using database storage: {_mask_password(database_url)}")
        
        return DatabaseStorageBackend(database_url)
    
    elif backend_type == "git":
        # Git 仓库存储
        repo_url = resolved["git_repo_url"]
        token = resolved["git_token"]
        branch = resolved["git_branch"]
        file_path = resolved["git_file_path"]
        auth_keys_file_path = resolved["git_auth_keys_file_path"]
        
        if not repo_url:
            raise ValueError(
                "使用 Git 存储时必须填写 Git 仓库地址"
            )
        
        print(f"[storage] Using Git storage: {_mask_token(repo_url)}, branch: {branch}, file: {file_path}")
        
        cache_dir = data_dir / "git_cache"
        return GitStorageBackend(
            repo_url=repo_url,
            token=token,
            branch=branch,
            file_path=file_path,
            auth_keys_file_path=auth_keys_file_path,
            local_cache_dir=cache_dir,
        )
    
    else:
        raise ValueError(
            f"未知的存储后端类型：{backend_type}。支持的类型：json、sqlite、postgres、git"
        )


def _mask_password(url: str) -> str:
    """隐藏数据库连接字符串中的密码"""
    if "://" not in url:
        return url
    try:
        protocol, rest = url.split("://", 1)
        if "@" in rest:
            credentials, host = rest.split("@", 1)
            if ":" in credentials:
                username, _ = credentials.split(":", 1)
                return f"{protocol}://{username}:****@{host}"
        return url
    except Exception:
        return url


def _mask_token(url: str) -> str:
    """隐藏 URL 中的 token"""
    if "@" in url and "://" in url:
        protocol, rest = url.split("://", 1)
        if "@" in rest:
            _, host = rest.split("@", 1)
            return f"{protocol}://****@{host}"
    return url
