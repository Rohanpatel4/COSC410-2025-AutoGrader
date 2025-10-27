"""
Judge0 HTTP Client

Direct HTTP client for Judge0 API based on simple polling approach.
Works with local Judge0 at http://localhost:2358
"""

import httpx
import asyncio
from typing import Dict, Any
import base64


PYTHON_LANG_ID = 71  # Python 3 in Judge0


async def submit_to_judge0(
    source_code: str,
    language_id: int = PYTHON_LANG_ID,
    stdin: str = "",
    judge0_url: str = "http://localhost:2358",
    use_base64: bool = True,
) -> Dict[str, Any]:
    """
    Submit code to Judge0 and poll for results.
    
    Args:
        source_code: The code to execute
        language_id: Judge0 language ID (default: 71 for Python 3)
        stdin: Standard input for the program
        judge0_url: Base URL for Judge0 API
        use_base64: Whether to base64-encode the source code
        
    Returns:
        Dict containing Judge0 result with status, stdout, stderr, time, memory
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Prepare payload
        if use_base64:
            encoded_source = base64.b64encode(source_code.encode("utf-8")).decode("ascii")
            payload = {
                "language_id": language_id,
                "source_code": encoded_source,
                "stdin": stdin,
            }
            params = {"base64_encoded": "true"}
        else:
            payload = {
                "language_id": language_id,
                "source_code": source_code,
                "stdin": stdin,
            }
            params = {"base64_encoded": "false"}
        
        # Submit to Judge0
        url = f"{judge0_url.rstrip('/')}/submissions"
        response = await client.post(url, json=payload, params=params)
        response.raise_for_status()
        
        submission_data = response.json()
        token = submission_data.get("token")
        
        if not token:
            raise RuntimeError(f"Judge0 did not return a token: {submission_data}")
        
        # Poll for results
        return await poll_result(client, judge0_url, token, max_wait=20.0)


async def poll_result(
    client: httpx.AsyncClient,
    judge0_url: str,
    token: str,
    max_wait: float = 20.0,
    poll_interval: float = 0.3,
) -> Dict[str, Any]:
    """
    Poll Judge0 for submission results.
    
    Args:
        client: httpx AsyncClient instance
        judge0_url: Base URL for Judge0 API
        token: Submission token from Judge0
        max_wait: Maximum time to wait in seconds
        poll_interval: Time between polls in seconds
        
    Returns:
        Dict containing final Judge0 result
    """
    url = f"{judge0_url.rstrip('/')}/submissions/{token}"
    start_time = asyncio.get_event_loop().time()
    
    while True:
        response = await client.get(url)
        response.raise_for_status()
        result = response.json()
        
        status = result.get("status", {})
        status_id = status.get("id", 0)
        
        # Status IDs: 1=In Queue, 2=Processing, 3+=Finished
        if status_id >= 3:
            return result
        
        # Check timeout
        elapsed = asyncio.get_event_loop().time() - start_time
        if elapsed > max_wait:
            return {
                **result,
                "status": {"id": -1, "description": "Timeout waiting for Judge0"},
            }
        
        await asyncio.sleep(poll_interval)


async def submit_with_wait(
    source_code: str,
    language_id: int = PYTHON_LANG_ID,
    stdin: str = "",
    judge0_url: str = "http://localhost:2358",
) -> Dict[str, Any]:
    """
    Submit code to Judge0 using wait=true parameter for synchronous execution.
    This is simpler but may not work on all Judge0 configurations.
    
    Args:
        source_code: The code to execute
        language_id: Judge0 language ID (default: 71 for Python 3)
        stdin: Standard input for the program
        judge0_url: Base URL for Judge0 API
        
    Returns:
        Dict containing Judge0 result with status, stdout, stderr, time, memory
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        url = f"{judge0_url.rstrip('/')}/submissions"
        params = {"base64_encoded": "false", "wait": "true"}
        payload = {
            "language_id": language_id,
            "source_code": source_code,
            "stdin": stdin,
        }
        
        response = await client.post(url, json=payload, params=params)
        response.raise_for_status()
        return response.json()

