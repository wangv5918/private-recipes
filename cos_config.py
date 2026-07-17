#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""COS 配置加载（从 .env 文件读取）"""

import os


def load_env(env_path: str = None) -> dict:
    """从 .env 文件加载配置，返回字典。优先使用系统环境变量。"""
    if env_path is None:
        env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")

    config = {}
    if os.path.isfile(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, value = line.partition("=")
                    key = key.strip()
                    value = value.strip().strip('"').strip("'")
                    config[key] = value

    # 系统环境变量优先级更高
    for key in config:
        env_val = os.getenv(key)
        if env_val is not None:
            config[key] = env_val

    return config


def get_config() -> dict:
    """获取 COS 相关配置，校验必填字段"""
    cfg = load_env()

    required = ["COS_SECRET_ID", "COS_SECRET_KEY", "COS_REGION", "COS_BUCKET"]
    missing = [k for k in required if not cfg.get(k)]
    if missing:
        raise SystemExit(f"缺少配置项: {', '.join(missing)}，请检查 .env 文件")

    return cfg