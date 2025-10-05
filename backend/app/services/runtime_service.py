from sqlalchemy.orm import Session
from app.models import models as m
from app.judge0_client import get_judge0_client
from typing import List, Dict, Any


# Common language mappings for Judge0
LANGUAGE_MAPPINGS = {
    71: {"language": "Python", "version": "3.8.1", "host_path": "/usr/bin/python3", "compile_cmd": None, "run_cmd": "python3"},
    62: {"language": "Java", "version": "11.0.6", "host_path": "/usr/bin/java", "compile_cmd": "javac", "run_cmd": "java"},
    50: {"language": "C", "version": "GCC 9.2.0", "host_path": "/usr/bin/gcc", "compile_cmd": "gcc", "run_cmd": "./a.out"},
    54: {"language": "C++", "version": "GCC 9.2.0", "host_path": "/usr/bin/g++", "compile_cmd": "g++", "run_cmd": "./a.out"},
    63: {"language": "JavaScript", "version": "Node.js 12.14.0", "host_path": "/usr/bin/node", "compile_cmd": None, "run_cmd": "node"},
    72: {"language": "Python", "version": "2.7.17", "host_path": "/usr/bin/python2", "compile_cmd": None, "run_cmd": "python2"},
    60: {"language": "Go", "version": "1.13.5", "host_path": "/usr/bin/go", "compile_cmd": "go build", "run_cmd": "./main"},
    67: {"language": "Pascal", "version": "FPC 3.0.4", "host_path": "/usr/bin/fpc", "compile_cmd": "fpc", "run_cmd": "./main"},
    51: {"language": "C#", "version": "Mono 6.6.0.161", "host_path": "/usr/bin/mono", "compile_cmd": "mcs", "run_cmd": "mono"},
    68: {"language": "Ruby", "version": "2.7.0", "host_path": "/usr/bin/ruby", "compile_cmd": None, "run_cmd": "ruby"},
    70: {"language": "Python", "version": "3.8.1", "host_path": "/usr/bin/python3", "compile_cmd": None, "run_cmd": "python3"},
}


def sync_runtimes_with_judge0(db: Session) -> List[m.Runtime]:
    """Sync available Judge0 languages with our runtime database."""
    try:
        client = get_judge0_client()
        judge0_languages = client.get_languages()

        synced_runtimes = []

        for lang in judge0_languages:
            lang_id = lang["id"]
            lang_name = lang["name"]

            # Check if we already have this runtime
            existing = db.query(m.Runtime).filter(m.Runtime.judge0_id == lang_id).first()

            if existing:
                # Update existing runtime
                existing.language = lang_name
                # Keep other fields as configured
            else:
                # Create new runtime using mapping if available
                mapping = LANGUAGE_MAPPINGS.get(lang_id, {
                    "language": lang_name,
                    "version": "Unknown",
                    "host_path": f"/usr/bin/{lang_name.lower()}",
                    "compile_cmd": None,
                    "run_cmd": lang_name.lower()
                })

                runtime = m.Runtime(
                    id=f"judge0_{lang_id}",
                    language=mapping["language"],
                    version=mapping["version"],
                    judge0_id=lang_id,
                    host_path=mapping["host_path"],
                    compile_cmd=mapping["compile_cmd"],
                    run_cmd=mapping["run_cmd"],
                    enabled=True
                )
                db.add(runtime)
                synced_runtimes.append(runtime)

        db.commit()
        return synced_runtimes

    except Exception as e:
        db.rollback()
        raise Exception(f"Failed to sync runtimes with Judge0: {str(e)}")


def get_enabled_runtimes(db: Session) -> List[m.Runtime]:
    """Get all enabled runtimes."""
    return db.query(m.Runtime).filter(m.Runtime.enabled == True).all()


def initialize_default_runtimes(db: Session) -> None:
    """Initialize default runtimes if none exist."""
    existing_count = db.query(m.Runtime).count()
    if existing_count == 0:
        # Add Python 3 as default
        python_runtime = m.Runtime(
            id="python3_default",
            language="Python",
            version="3.8.1",
            judge0_id=71,
            host_path="/usr/bin/python3",
            compile_cmd=None,
            run_cmd="python3",
            enabled=True
        )
        db.add(python_runtime)
        db.commit()
