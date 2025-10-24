import requests

PISTON_URL = "http://piston_api:2000/api/v2/execute"  # inside docker network
# If testing locally (backend not in container), use:
# PISTON_URL = "http://localhost:2000/api/v2/execute"

def run_code(language: str, code: str, stdin: str = ""):
    payload = {
        "language": language,
        "version": "*",
        "files": [{"name": "main", "content": code}],
        "stdin": stdin,
    }
    try:
        resp = requests.post(PISTON_URL, json=payload, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        return {"error": str(e)}
