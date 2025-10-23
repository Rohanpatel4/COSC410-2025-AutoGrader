# backend/app/services/sandbox.py
from __future__ import annotations
import os, shutil, subprocess, tempfile, uuid, json, pathlib
from typing import Any
import httpx
from app.core.settings import settings

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


def run_piston_job(files: dict[str, str], timeout_sec: int = 5) -> dict[str, Any]:
    """
    Send files to a Piston API instance and return a simplified result.
    Piston's execute endpoint accepts a payload like:
      { "files": [{"name":"main.py","content":"..."}], "run_timeout": seconds }
    We'll post and translate the response to the {exit_code, passed, failed, log} shape.
    """
    url = settings.PISTON_URL.rstrip("/")

    # Piston expects a list of files with name/content. Convert mapping to that.
    files_payload = [{"name": name, "content": content} for name, content in files.items()]

    # Piston expects run_timeout in milliseconds and requires language/version.
    # Use python3 as a sensible default; callers may be extended later to pass language/version.
    payload = {
        "language": "python3",
        "version": "*",
        "files": files_payload,
        "stdin": "",
        # convert seconds -> milliseconds
        "run_timeout": int(timeout_sec * 1000),
    }

    try:
        with httpx.Client(timeout=timeout_sec + 2) as client:
            resp = client.post(url, json=payload)
            resp.raise_for_status()
            data = resp.json()
    except Exception as e:
        return {
            "exit_code": 1,
            "passed": 0,
            "failed": 0,
            "log": f"piston-error: {e}",
        }

    # Piston returns stdout, stderr, and code. We'll include them in the log.
    stdout = data.get("run", {}).get("stdout", "") if isinstance(data, dict) else ""
    stderr = data.get("run", {}).get("stderr", "") if isinstance(data, dict) else ""
    code = data.get("run", {}).get("code") if isinstance(data, dict) else None

    log = ""
    if stdout:
        log += "--- stdout ---\n" + stdout + "\n"
    if stderr:
        log += "--- stderr ---\n" + stderr + "\n"

    # We cannot meaningfully detect pytest 'passed'/'failed' counts from generic piston runs
    # unless the test runner prints a pytest-style summary. We'll attempt to parse it heuristically.
    passed = failed = 0
    for line in log.splitlines():
        line = line.strip()
        if line.endswith(" passed") and line.split()[0].isdigit():
            try:
                passed += int(line.split()[0])
            except Exception:
                pass
        if " failed" in line and line.split()[0].isdigit():
            try:
                failed += int(line.split()[0])
            except Exception:
                pass

    return {
        "exit_code": code if code is not None else 0,
        "passed": passed,
        "failed": failed,
        "log": log,
    }


def run_job(files: dict[str, str], timeout_sec: int = 5) -> dict[str, Any]:
    """Choose the executor: Piston (remote) or local docker pytest runner."""
    if getattr(settings, "USE_PISTON", False):
        return run_piston_job(files, timeout_sec=timeout_sec)
    return run_pytest_job(files, timeout_sec=timeout_sec)
