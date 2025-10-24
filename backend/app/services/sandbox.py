# backend/app/services/sandbox.py
from __future__ import annotations
import os, shutil, subprocess, tempfile, uuid, json, pathlib

INNER_DOCKER = os.environ.get("DOCKER_HOST", "tcp://dind:2375")
JOB_ROOT = pathlib.Path("/runner/tmp")  # shared volume from compose

def _sh(*args: str, env: dict | None = None, timeout: int | None = None) -> tuple[int, str]:
    env2 = os.environ.copy()
    if env:
        env2.update(env)
    cp = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env2, timeout=timeout)
    return cp.returncode, cp.stdout

def run_pytest_job(files: dict[str, str], timeout_sec: int = 5) -> dict:
    """
    files: mapping of relative path -> content placed under /work.
           e.g. {"student.py": "...", "tests/test_1.py": "..."}
    """
    job_id = f"job_{uuid.uuid4().hex[:10]}"
    job_dir = JOB_ROOT / job_id
    job_dir.mkdir(parents=True, exist_ok=True)

    # write files
    for rel, content in files.items():
        p = job_dir / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding="utf-8")

    # docker run against inner daemon
    cmd = [
        "docker", "run", "--rm",
        "--network", "none",
        "--memory", "128m", "--memory-swap", "128m",
        "--cpus", "0.5",
        "--pids-limit", "64",
        "--read-only",
        "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
        "-v", f"{job_dir}:/work:ro",
        "-w", "/work",
        # security hardening (safe for Python)
        "--security-opt", "no-new-privileges",
        "--cap-drop=ALL",
        "python-pytest:latest"
    ]

    code, out = _sh(*cmd, env={"DOCKER_HOST": INNER_DOCKER}, timeout=timeout_sec)
    # best-effort cleanup; leaving artifacts is okay in dev
    try:
        shutil.rmtree(job_dir, ignore_errors=True)
    except Exception:
        pass

    # convert pytest-like output to a trivial result shape
    # heuristic parse: count "passed", "failed"
    passed = failed = 0
    for line in out.splitlines():
        line = line.strip()
        if line.endswith(" passed"):
            try:
                passed += int(line.split()[0])
            except: pass
        if " failed" in line and line.split()[0].isdigit():
            try:
                failed += int(line.split()[0])
            except: pass

    return {
        "exit_code": code,
        "passed": passed,
        "failed": failed,
        "log": out,
    }
