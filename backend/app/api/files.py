from fastapi import APIRouter, UploadFile, File, HTTPException
from starlette import status
import app.services.FileConverter as fc  # this is your converter module

router = APIRouter()  # prefix /api/v1/files is added in main.py


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_py_and_echo(file: UploadFile = File(..., description=".py test file")):
    """
    Accept a Python test file, convert it to UTF-8 text using FileConverter,
    and return it as JSON to the frontend.
    """
    # Validate file type
    if not file.filename or not file.filename.lower().endswith(".py"):
        raise HTTPException(status_code=415, detail="Only .py files are accepted.")

    # Convert file content → text
    try:
        text = await fc.file_to_text(file)
    except HTTPException as e:
        raise e
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Conversion failed: {e}")

    # Return it to the frontend
    return {
        "status": "ok",
        "filename": file.filename,
        "test_case": text,
        "converter": "file_to_text",
    }
