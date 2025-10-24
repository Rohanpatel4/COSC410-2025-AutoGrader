# import os
# import base64
# import json
# import urllib.request

# J0_URL = os.getenv("J0_URL", "http://localhost:2358")
# LANG_ID = int(os.getenv("J0_LANG_ID", "71"))  # Python 3.x in Judge0 CE

# def _post_json(url: str, payload: dict) -> dict:
#     data = json.dumps(payload).encode("utf-8")
#     req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
#     with urllib.request.urlopen(req) as resp:
#         return json.loads(resp.read().decode("utf-8"))

# def run_in_judge0(source_code: str) -> dict:
#     """
#     Sends combined source to Judge0 with wait=true and base64 encoding.
#     Returns the Judge0 response dict (status/stdout/stderr/time/memory).
#     """
#     b64 = base64.b64encode(source_code.encode("utf-8")).decode("ascii")
#     url = f"{J0_URL}/submissions?base64_encoded=true&wait=true"
#     payload = {
#         "language_id": LANG_ID,
#         "source_code": b64,
#     }
#     return _post_json(url, payload)


# integration_bridge/send_to_judge0.py
import os
import base64
import json
import time
import urllib.request

J0_URL = os.getenv("J0_URL", "http://localhost:2358")
LANG_ID = int(os.getenv("J0_LANG_ID", "71"))  # Python 3.x
POLL_INTERVAL = float(os.getenv("J0_POLL_INTERVAL", "0.3"))  # seconds

def _http_post(url: str, payload: dict) -> dict:
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def _http_get(url: str) -> dict:
    req = urllib.request.Request(url, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def submit_to_judge0(source_code: str) -> str:
    """Submit code to Judge0 and return the submission token."""
    b64 = base64.b64encode(source_code.encode("utf-8")).decode("ascii")
    url = f"{J0_URL}/submissions?base64_encoded=true"
    payload = {"language_id": LANG_ID, "source_code": b64}
    res = _http_post(url, payload)
    token = res.get("token")
    if not token:
        raise RuntimeError(f"Judge0 did not return a token: {res}")
    return token

def poll_result(token: str, max_wait: float = 20.0) -> dict:
    """Poll Judge0 until result.status.id >= 3 (finished) or timeout."""
    start = time.time()
    while True:
        res = _http_get(f"{J0_URL}/submissions/{token}")
        status = res.get("status", {})
        if status.get("id", 0) >= 3:  # Finished (Accepted, Wrong, Runtime Error, etc.)
            return res
        if time.time() - start > max_wait:
            res["status"] = {"id": -1, "description": "Timeout waiting for Judge0"}
            return res
        time.sleep(POLL_INTERVAL)

def run_in_judge0(source_code: str) -> dict:
    """
    Submit → poll → return final result.
    Non-blocking at API level, scalable in parallel.
    """
    token = submit_to_judge0(source_code)
    return poll_result(token)
