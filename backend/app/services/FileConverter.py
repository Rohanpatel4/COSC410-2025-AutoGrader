from __future__ import annotations
from fastapi import UploadFile, HTTPException

async def file_to_text(file: UploadFile) -> str:
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty upload")
    try:
        return raw.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(status_code=415, detail="File is not valid UTF-8 text")


def text_to_file(text: str) -> dict:
    if text is None:
        raise ValueError("text must not be None")
    content_bytes = text.encode("utf-8")
    return {
        "content_bytes": content_bytes,
        "encoding": "utf-8",
        "size_bytes": len(content_bytes),
    }