import os
import json
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime, UTC


class Judge0Client:
    def __init__(self, base_url: str = "http://judge0:2358"):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()

    def get_languages(self) -> List[Dict[str, Any]]:
        """Get list of available languages from Judge0."""
        response = self.session.get(f"{self.base_url}/languages")
        response.raise_for_status()
        return response.json()

    def create_submission(self,
                         source_code: str,
                         language_id: int,
                         stdin: str = "",
                         expected_output: str = "",
                         cpu_time_limit: float = 5.0,
                         memory_limit: int = 256000000,  # 256MB
                         max_file_size: int = 1024000) -> str:  # 1MB
        """Create a submission for execution."""
        payload = {
            "source_code": source_code,
            "language_id": language_id,
            "stdin": stdin,
            "expected_output": expected_output,
            "cpu_time_limit": cpu_time_limit,
            "memory_limit": memory_limit,
            "max_file_size": max_file_size
        }

        response = self.session.post(f"{self.base_url}/submissions",
                                   json=payload,
                                   headers={"Content-Type": "application/json"})
        response.raise_for_status()
        return response.json()["token"]

    def get_submission(self, token: str) -> Dict[str, Any]:
        """Get submission result by token."""
        response = self.session.get(f"{self.base_url}/submissions/{token}")
        response.raise_for_status()
        return response.json()

    def wait_for_completion(self, token: str, timeout: int = 30) -> Dict[str, Any]:
        """Wait for submission to complete and return result."""
        import time
        start_time = time.time()

        while time.time() - start_time < timeout:
            result = self.get_submission(token)
            status = result.get("status", {})

            # Status 1 = In Queue, 2 = Processing, 3 = Accepted, 4-13 = Various errors
            if status.get("id", 0) not in [1, 2]:
                return result

            time.sleep(0.5)

        raise TimeoutError(f"Submission {token} did not complete within {timeout} seconds")


def get_judge0_client() -> Judge0Client:
    """Get configured Judge0 client instance."""
    judge0_url = os.getenv("JUDGE0_URL", "http://judge0:2358")
    return Judge0Client(judge0_url)
