import time, requests, json
from urllib.parse import urlsplit
from app.core.settings import settings

def _validate_base(url: str | None) -> str:
    """Ensure the Judge0 base URL is allowed and safe."""
    base = (url or "http://localhost:2358").rstrip("/")
    if hasattr(settings, "JUDGE0_ALLOWED_BASES"):
        if base not in settings.JUDGE0_ALLOWED_BASES:
            raise ValueError("Disallowed Judge0 base URL")
    return base


class Judge0Client:
    """Lightweight client to communicate with a local Judge0 instance safely."""

    def __init__(self, base: str | None = None, session: requests.Session | None = None):
        # Prefer explicit param → then settings → then safe default
        self.base = _validate_base(getattr(settings, "JUDGE0_URL", None) or base)
        self.s = session or requests.Session()
        self.timeout = 30

    def _raise_with_body(self, r: requests.Response, url: str):
        """Raise a detailed error with safe data for debugging."""
        try:
            body_json = r.json()
        except Exception:
            body_json = None

        detail = {
            "status_code": r.status_code,
            "method": r.request.method,
            "url": url,
            "response_json": body_json,
            "response_text": r.text[:2000],
        }

        if getattr(settings, "DEBUG", False):
            req_body = r.request.body
            detail["request_body"] = (
                req_body.decode() if hasattr(req_body, "decode") else str(req_body)
            )

        raise RuntimeError(detail)

    def _post(self, path: str, params: dict | None = None, json: dict | None = None):
        url = f"{self.base}{path}"
        r = self.s.post(url, params=params or {}, json=json or {}, timeout=self.timeout)
        if r.status_code >= 400:
            self._raise_with_body(r, url)
        return r.json()

    def _get(self, path: str, params: dict | None = None):
        url = f"{self.base}{path}"
        r = self.s.get(url, params=params or {}, timeout=self.timeout)
        if r.status_code >= 400:
            self._raise_with_body(r, url)
        return r.json()

    def create_submission(self, *, source_code: str, language_id: int, stdin: str | None = None) -> str:
        """
        Submit code to Judge0 and run synchronously (wait=true)
        so it executes immediately — ideal for development.
        """
        payload = {"source_code": str(source_code), "language_id": int(language_id)}
        if stdin is not None and str(stdin).strip() != "":
            payload["stdin"] = str(stdin)

        data = self._post(
            "/submissions",
            params={"base64_encoded": "false", "wait": "true"},
            json=payload,
        )

        token = data.get("token")
        if not token:
            raise RuntimeError(
                {"message": "Judge0 create_submission returned no token", "data": data}
            )
        return token

    def get_submission(self, token: str):
        """Fetch submission details from Judge0."""
        return self._get(
            f"/submissions/{token}",
            params={"base64_encoded": "false", "fields": "*"},
        )

    def wait_for_completion(self, token: str, timeout=30, sleep=0.4):
        """Poll Judge0 until completion (safe for synchronous or async)."""
        deadline = time.time() + timeout
        while True:
            data = self.get_submission(token)
            st = (data.get("status") or {}).get("id")
            if st in {3, 4, 5, 6, 7, 11, 12, 13}:  # Terminal states
                return data
            if time.time() > deadline:
                raise RuntimeError({"message": "Timeout waiting for Judge0", "data": data})
            time.sleep(sleep)


def get_judge0_client() -> Judge0Client:
    """Factory method for dependency injection."""
    return Judge0Client()