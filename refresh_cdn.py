#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
刷新腾讯云 CDN 缓存（仅用标准库）

使用场景：上传新文件到 COS 后，CDN 边缘节点仍缓存旧内容，
需要刷新 CDN 缓存让用户立即看到最新内容。

用法：
  py refresh_cdn.py                    # 刷新整站缓存
  py refresh_cdn.py index.html app.js  # 刷新指定文件
"""

import os
import sys
import json
import time
import hmac
import hashlib
import urllib.request
import urllib.error
import ssl
from datetime import datetime, timezone

from cos_config import get_config

# 绕过系统代理
PROXY_HANDLER = urllib.request.ProxyHandler({})
OPENER = urllib.request.build_opener(
    PROXY_HANDLER,
    urllib.request.HTTPSHandler(context=ssl._create_unverified_context()),
)
urllib.request.install_opener(OPENER)

_cfg = get_config()
SECRET_ID = _cfg["COS_SECRET_ID"]
SECRET_KEY = _cfg["COS_SECRET_KEY"]
CDN_DOMAIN = _cfg.get("CDN_DOMAIN", "")

CDN_HOST = "cdn.tencentcloudapi.com"
SERVICE = "cdn"
API_VERSION = "2018-06-06"


def sign_tc3(secret_id: str, secret_key: str, service: str, host: str,
             action: str, payload: str, region: str = "") -> dict:
    """生成腾讯云 API v3 签名（TC3-HMAC-SHA256）"""
    algorithm = "TC3-HMAC-SHA256"
    timestamp = str(int(time.time()))
    date = datetime.utcfromtimestamp(int(timestamp)).strftime("%Y-%m-%d")

    # 1. CanonicalRequest
    canonical_uri = "/"
    canonical_querystring = ""
    canonical_headers = f"content-type:application/json\nhost:{host}\n"
    signed_headers = "content-type;host"
    hashed_payload = hashlib.sha256(payload.encode("utf-8")).hexdigest()

    canonical_request = (
        f"POST\n{canonical_uri}\n{canonical_querystring}\n"
        f"{canonical_headers}\n{signed_headers}\n{hashed_payload}"
    )

    # 2. StringToSign
    credential_scope = f"{date}/{service}/tc3_request"
    hashed_canonical = hashlib.sha256(canonical_request.encode("utf-8")).hexdigest()
    string_to_sign = f"{algorithm}\n{timestamp}\n{credential_scope}\n{hashed_canonical}"

    # 3. Signature
    def _sign(key: bytes, msg: str) -> bytes:
        return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()

    secret_date = _sign(("TC3" + secret_key).encode("utf-8"), date)
    secret_service = _sign(secret_date, service)
    secret_signing = _sign(secret_service, "tc3_request")
    signature = _sign(secret_signing, string_to_sign).hex()

    # 4. Authorization
    authorization = (
        f"{algorithm} Credential={secret_id}/{credential_scope}, "
        f"SignedHeaders={signed_headers}, Signature={signature}"
    )

    return {
        "Authorization": authorization,
        "Content-Type": "application/json",
        "Host": host,
        "X-TC-Action": action,
        "X-TC-Version": API_VERSION,
        "X-TC-Timestamp": timestamp,
        "X-TC-Region": region,
    }


def call_cdn_api(action: str, body: dict, region: str = "") -> dict:
    """调用腾讯云 CDN API，返回 (success, data)"""
    payload = json.dumps(body)
    headers = sign_tc3(SECRET_ID, SECRET_KEY, SERVICE, CDN_HOST, action, payload, region)

    url = f"https://{CDN_HOST}/"
    req = urllib.request.Request(url, data=payload.encode("utf-8"), headers=headers, method="POST")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            data = json.loads(raw)
            # 检查业务层错误
            resp_data = data.get("Response", {})
            if "Error" in resp_data:
                err = resp_data["Error"]
                print(f"  API 业务错误: [{err.get('Code')}] {err.get('Message')}")
                return False, data
            return True, data
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8", errors="replace")
        print(f"  API HTTP 错误 [{e.code}]: {err_body}")
        return False, {"error": err_body}


def refresh_urls(urls: list[str]) -> bool:
    """刷新指定 URL 缓存"""
    if not urls:
        return True

    print(f"正在刷新 {len(urls)} 个 URL...")
    for u in urls:
        print(f"  {u}")

    result = call_cdn_api("PurgeUrlsCache", {"Urls": urls})
    if not result[0]:
        return False

    task_id = result[1].get("Response", {}).get("TaskId", "unknown")
    print(f"  刷新任务已提交，TaskId: {task_id}")
    return True


def refresh_all() -> bool:
    """刷新整站缓存（目录刷新）"""
    if not CDN_DOMAIN:
        print("错误: 请在 .env 中设置 CDN_DOMAIN")
        return False

    paths = [f"https://{CDN_DOMAIN}/"]
    print(f"正在刷新整站缓存: {paths[0]}")

    result = call_cdn_api("PurgePathCache", {"Paths": paths, "FlushType": "flush"})
    if not result[0]:
        return False

    task_id = result[1].get("Response", {}).get("TaskId", "unknown")
    print(f"  刷新任务已提交，TaskId: {task_id}")
    return True


def main():
    if not CDN_DOMAIN:
        print("警告: 未配置 CDN_DOMAIN，请在 .env 中设置后重试")
        print("  示例: CDN_DOMAIN=tocook.top")
        return

    args = sys.argv[1:]

    if args:
        # 刷新指定文件
        urls = []
        for f in args:
            f = f.lstrip("/")
            urls.append(f"https://{CDN_DOMAIN}/{f}")
        refresh_urls(urls)
    else:
        # 刷新整站
        refresh_all()

    print("\n提示: 刷新需要 5-10 分钟生效，可在腾讯云 CDN 控制台查看进度。")


if __name__ == "__main__":
    main()