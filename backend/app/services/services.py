import os, uuid, json, shutil, hashlib, subprocess, shlex
from datetime import datetime, UTC
from typing import List
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models import models as m

STORAGE_ROOT = "storage"

def ensure_storage():
    os.makedirs(STORAGE_ROOT, exist_ok=True)

def store_uploaded_file(name: str, content: bytes, category: m.FileCategory):
    ensure_storage()
    fid = str(uuid.uuid4())
    path = os.path.join(STORAGE_ROOT, fid + "_" + name)
    with open(path, "wb") as f:
        f.write(content)
    sha = hashlib.sha256(content).hexdigest()
    size = len(content)
    return fid, path, sha, size

def validate_file_ids(db: Session, file_ids: List[str], category: m.FileCategory):
    files = db.query(m.File).filter(m.File.id.in_(file_ids)).all()
    if len(files) != len(file_ids):
        raise HTTPException(400, "Some file_ids not found")
    for f in files:
        if f.category != category:
            raise HTTPException(400, "file_ids must all be category=" + category.value)
    return files

def create_run(db: Session, submission_id: str, testsuite_id: str, runtime_id: str) -> m.Run:
    if not db.get(m.Submission, submission_id): raise HTTPException(400, "submission not found")
    if not db.get(m.TestSuite, testsuite_id): raise HTTPException(400, "testsuite not found")
    runtime = db.get(m.Runtime, runtime_id)
    if not runtime or not runtime.enabled: raise HTTPException(400, "runtime missing or disabled")
    rid = str(uuid.uuid4())
    run = m.Run(id=rid, submission_id=submission_id, testsuite_id=testsuite_id, runtime_id=runtime_id, status=m.RunStatus.QUEUED)
    db.add(run); db.commit(); db.refresh(run)
    return run

def execute_run(db: Session, run: m.Run):
    # Minimal placeholder executor: marks RUNNING then SUCCEEDED without real isolation
    run.status = m.RunStatus.RUNNING
    run.started_at = datetime.now(UTC)
    db.commit()
    # TODO: integrate real sandbox + seccomp/AppArmor
    run.exit_code = 0
    run.finished_at = datetime.now(UTC)
    run.status = m.RunStatus.SUCCEEDED
    db.commit(); db.refresh(run)
    return run
