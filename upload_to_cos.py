#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""上传当前目录下所有文件到腾讯云 COS（仅用标准库，无需安装第三方包）"""

import os
import time
import hmac
import hashlib
import urllib.request
import urllib.error
import mimetypes
import ssl

from cos_config import get_config

# 绕过系统代理，直连网络
PROXY_HANDLER = urllib.request.ProxyHandler({})
OPENER = urllib.request.build_opener(
    PROXY_HANDLER,
    urllib.request.HTTPSHandler(context=ssl._create_unverified_context()),
)
urllib.request.install_opener(OPENER)

# 从 .env 加载配置
_cfg = get_config()
SECRET_ID = _cfg["COS_SECRET_ID"]
SECRET_KEY = _cfg["COS_SECRET_KEY"]
REGION = _cfg["COS_REGION"]
BUCKET = _cfg["COS_BUCKET"]

# 本地目录（脚本所在目录）
LOCAL_DIR = os.path.dirname(os.path.abspath(__file__))

# COS 端点
COS_HOST = f"{BUCKET}.cos.{REGION}.myqcloud.com"

# 要跳过的文件和目录
SKIP_DIRS = {".git", "__pycache__", ".venv", "node_modules"}
SKIP_FILES = {".env", ".env.example", "upload_to_cos.py", "refresh_cdn.py", "cos_config.py"}


def sha1_hex(data: bytes) -> str:
    return hashlib.sha1(data).hexdigest()


def hmac_sha1(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha1).digest()


def generate_authorization(method: str, key: str, params: str = "") -> str:
    """生成 COS 签名 Authorization 头"""
    now = int(time.time())
    key_time = f"{now};{now + 3600}"

    sign_key = hmac_sha1(SECRET_KEY.encode("utf-8"), key_time).hex()

    uri_pathname = "/" + key if not key.startswith("/") else key

    http_string = f"{method.lower()}\n{uri_pathname}\n{params}\nhost={COS_HOST}\n"

    sha1_http = sha1_hex(http_string.encode("utf-8"))
    string_to_sign = f"sha1\n{key_time}\n{sha1_http}\n"

    signature = hmac_sha1(sign_key.encode("utf-8"), string_to_sign).hex()

    return (
        f"q-sign-algorithm=sha1"
        f"&q-ak={SECRET_ID}"
        f"&q-sign-time={key_time}"
        f"&q-key-time={key_time}"
        f"&q-header-list=host"
        f"&q-url-param-list="
        f"&q-signature={signature}"
    )


def upload_file(local_path: str, cos_key: str) -> bool:
    """上传单个文件到 COS"""
    try:
        file_size = os.path.getsize(local_path)
        content_type, _ = mimetypes.guess_type(local_path)
        if content_type is None:
            content_type = "application/octet-stream"

        with open(local_path, "rb") as f:
            data = f.read()

        method = "PUT"
        url = f"https://{COS_HOST}/{urllib.request.quote(cos_key, safe='/-_.~')}"

        headers = {
            "Host": COS_HOST,
            "Content-Type": content_type,
            "Content-Length": str(file_size),
        }
        headers["Authorization"] = generate_authorization(method, cos_key)

        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        with urllib.request.urlopen(req, timeout=30) as resp:
            if resp.status == 200:
                print(f"  [OK] {cos_key}")
                return True
            else:
                print(f"  [FAIL] {cos_key} -> HTTP {resp.status}")
                return False

    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")[:500]
        print(f"  [FAIL] {cos_key} -> HTTP {e.code}: {body}")
        return False
    except Exception as e:
        print(f"  [FAIL] {cos_key} -> {e}")
        return False


def main():
    success = 0
    fail = 0

    for root, dirs, files in os.walk(LOCAL_DIR):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]

        for fname in files:
            if fname in SKIP_FILES:
                continue

            local_path = os.path.join(root, fname)
            rel_path = os.path.relpath(local_path, LOCAL_DIR).replace("\\", "/")

            if upload_file(local_path, rel_path):
                success += 1
            else:
                fail += 1

    print(f"\n上传完成: 成功 {success}, 失败 {fail}")


if __name__ == "__main__":
    main()