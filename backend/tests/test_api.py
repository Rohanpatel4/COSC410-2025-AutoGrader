import os, io, json
from fastapi.testclient import TestClient
from app.api.main import app
from app.core.db import Base, engine

client = TestClient(app)

def test_upload_and_list_files():
    data = {"category": "TEST_CASE"}
    file_content = b"print('hello')"
    r = client.post("/api/v1/files", files={"f": ("t.py", file_content, "text/x-python")}, data=data)
    assert r.status_code == 200
    fid = r.json()["id"]
    r2 = client.get("/api/v1/files?category=TEST_CASE")
    assert r2.status_code == 200
    assert any(x["id"] == fid for x in r2.json())

def test_testsuite_and_submission_and_run():
    # upload files
    fc = b"input1"
    sc = "print('solution')".encode()
    f1 = client.post("/api/v1/files", files={"f": ("in.txt", fc, "text/plain")}, data={"category":"TEST_CASE"}).json()
    f2 = client.post("/api/v1/files", files={"f": ("sol.py", sc, "text/x-python")}, data={"category":"SUBMISSION"}).json()
    # create test suite and submission
    ts = client.post("/api/v1/test-suites", json={"name":"ts1","file_ids":[f1["id"]]}).json()
    sub = client.post("/api/v1/submissions", json={"name":"s1","file_ids":[f2["id"]]}).json()
    # runtime
    rt = client.post("/api/v1/runtimes", json={"language":"python","version":"3.11","host_path":"/usr/bin/python3","run_cmd":"{entry}"}).json()
    # run
    run = client.post("/api/v1/runs", json={"submission_id": sub["id"], "testsuite_id": ts["id"], "runtime_id": rt["id"]}).json()
    got = client.post(f"/api/v1/runs/{run['id']}/execute").json()
    assert got["status"] in ("RUNNING","SUCCEEDED")
