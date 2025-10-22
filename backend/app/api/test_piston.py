from fastapi import APIRouter
import httpx
import os

router = APIRouter()

@router.get("/_test/piston-python")
async def test_piston():
    piston_url = os.getenv("PISTON_URL", "http://piston:2000")
    payload = {
        "language": "python",
        "version": "3.9.4",
        "files": [{"name": "main.py", "content": 'print("hello-from-piston")'}]
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{piston_url}/api/v2/execute", json=payload)
        return r.json()
