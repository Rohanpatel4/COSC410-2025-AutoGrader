from __future__ import annotations
from typing import Any, Dict, List, Optional
import httpx
from app.core.settings import settings

# Map friendly names to Judge0 language IDs (extend as needed)
LANGUAGE_ID = {
    "python": 71,   # Python 3.8.1
    # "python311": 92,  # example
    "c": 50,        # GCC 9.2.0
    "cpp": 54,      # G++ 9.2.0
    "java": 62,     # OpenJDK 13
    "javascript": 63,
}

class Judge0:
    def __init__(self, base_url: str | None = None):
        self.base_url = base_url or settings.JUDGE0_URL.rstrip("/")

    async def submit_source(
        self,
        source_code: str,
        language_id: int,
        stdin: str = "",
        args: str = "",
        wait: bool = True,
    ) -> Dict[str, Any]:
        params = {"base64_encoded": "false", "wait": "true" if wait else "false"}
        payload = {
            "language_id": language_id,
            "source_code": source_code,
            "stdin": stdin,
            "command_line_arguments": args,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{self.base_url}/submissions", params=params, json=payload)
            r.raise_for_status()
            return r.json()

    async def submit_files(
        self,
        files: List[Dict[str, str]],
        language_id: int,
        stdin: str = "",
        args: str = "",
        wait: bool = True,
    ) -> Dict[str, Any]:
        params = {"base64_encoded": "false", "wait": "true" if wait else "false"}
        payload = {
            "language_id": language_id,
            "files": files,
            "stdin": stdin,
            "command_line_arguments": args,
        }
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(f"{self.base_url}/submissions", params=params, json=payload)
            r.raise_for_status()
            return r.json()

    async def get_submission(self, token: str) -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(f"{self.base_url}/submissions/{token}", params={"base64_encoded": "false"})
            r.raise_for_status()
            return r.json()
