import os
import tempfile
import shutil
from unittest.mock import patch, MagicMock
from pathlib import Path
import pytest

from app.services.sandbox import INNER_DOCKER, JOB_ROOT, run_pytest_job, _sh

def test_inner_docker_configuration():
    """Test that INNER_DOCKER is configured correctly."""
    assert INNER_DOCKER.startswith("tcp://") or INNER_DOCKER == "tcp://dind:2375"

def test_job_root_configuration():
    """Test that JOB_ROOT is configured correctly."""
    from pathlib import Path
    assert isinstance(JOB_ROOT, Path)
    # Check that it ends with runner/tmp regardless of path separator
    assert JOB_ROOT.parts[-2:] == ("runner", "tmp")


def test_sh_success():
    """Test _sh function with successful command."""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="success output")

        code, output = _sh("echo", "hello")

        assert code == 0
        assert output == "success output"
        mock_run.assert_called_once()


def test_sh_with_env():
    """Test _sh function with custom environment."""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="output")

        code, output = _sh("cmd", env={"TEST_VAR": "value"})

        assert code == 0
        # Check that env was updated
        call_kwargs = mock_run.call_args[1]
        assert "TEST_VAR" in call_kwargs["env"]
        assert call_kwargs["env"]["TEST_VAR"] == "value"


def test_sh_with_timeout():
    """Test _sh function with timeout."""
    with patch('subprocess.run') as mock_run:
        mock_run.return_value = MagicMock(returncode=0, stdout="output")

        code, output = _sh("cmd", timeout=30)

        assert code == 0
        call_kwargs = mock_run.call_args[1]
        assert call_kwargs["timeout"] == 30


def test_run_pytest_job_success():
    """Test run_pytest_job with successful execution."""
    files = {
        "student.py": "print('hello')",
        "tests/test_basic.py": "def test_hello():\n    assert True"
    }

    expected_output = "1 passed"

    with patch('app.services.sandbox._sh') as mock_sh, \
         patch('shutil.rmtree') as mock_rmtree, \
         patch('pathlib.Path.mkdir') as mock_mkdir, \
         patch('pathlib.Path.write_text') as mock_write:

        mock_sh.return_value = (0, expected_output)

        result = run_pytest_job(files, timeout_sec=10)

        assert result["exit_code"] == 0
        assert result["passed"] == 1
        assert result["failed"] == 0
        assert result["log"] == expected_output

        # Verify docker command was called
        mock_sh.assert_called_once()
        args, kwargs = mock_sh.call_args
        docker_cmd = args

        # Check that docker run command includes expected parts
        assert "docker" in docker_cmd
        assert "run" in docker_cmd
        assert "--rm" in docker_cmd
        assert "--network" in docker_cmd
        assert "none" in docker_cmd
        assert "--memory" in docker_cmd
        assert "128m" in docker_cmd
        assert "python-pytest:latest" in docker_cmd

        # Check environment
        assert kwargs["env"]["DOCKER_HOST"] == INNER_DOCKER


def test_run_pytest_job_with_failures():
    """Test run_pytest_job with test failures."""
    files = {"student.py": "x = 1", "tests/test_fail.py": "def test_fail():\n    assert False"}

    expected_output = "1 failed, 1 passed"

    with patch('app.services.sandbox._sh') as mock_sh, \
         patch('shutil.rmtree'), \
         patch('pathlib.Path.mkdir'), \
         patch('pathlib.Path.write_text'):

        mock_sh.return_value = (1, expected_output)

        result = run_pytest_job(files)

        assert result["exit_code"] == 1
        assert result["passed"] == 1  # From the output parsing
        assert result["failed"] == 1
        assert result["log"] == expected_output


def test_run_pytest_job_file_writing():
    """Test that files are written correctly."""
    files = {
        "main.py": "print('main')",
        "subdir/test.py": "assert True"
    }

    with patch('app.services.sandbox._sh') as mock_sh, \
         patch('shutil.rmtree'), \
         patch('pathlib.Path.mkdir') as mock_mkdir, \
         patch('pathlib.Path.write_text') as mock_write:

        mock_sh.return_value = (0, "")

        result = run_pytest_job(files)

        # Verify mkdir was called for subdirectories
        mkdir_calls = mock_mkdir.call_args_list
        assert len(mkdir_calls) >= 2  # main dir + subdir

        # Verify write_text was called for each file
        write_calls = mock_write.call_args_list
        assert len(write_calls) == 2

        # Check file contents were written
        written_contents = [call[0][0] for call in write_calls]
        assert "print('main')" in written_contents
        assert "assert True" in written_contents


def test_run_pytest_job_cleanup_on_error():
    """Test that cleanup happens even when docker command fails."""
    files = {"test.py": "content"}

    with patch('app.services.sandbox._sh') as mock_sh, \
         patch('shutil.rmtree') as mock_rmtree, \
         patch('pathlib.Path.mkdir'), \
         patch('pathlib.Path.write_text'):

        mock_sh.side_effect = Exception("Docker failed")

        try:
            run_pytest_job(files)
        except:
            pass  # Expected to fail

        # Verify cleanup was attempted
        mock_rmtree.assert_called_once()


def test_run_pytest_job_custom_timeout():
    """Test run_pytest_job with custom timeout."""
    files = {"test.py": "content"}

    with patch('app.services.sandbox._sh') as mock_sh, \
         patch('shutil.rmtree'), \
         patch('pathlib.Path.mkdir'), \
         patch('pathlib.Path.write_text'):

        mock_sh.return_value = (0, "")

        run_pytest_job(files, timeout_sec=30)

        # Verify timeout was passed to _sh
        args, kwargs = mock_sh.call_args
        assert kwargs["timeout"] == 30


def test_run_pytest_job_output_parsing_edge_cases():
    """Test output parsing with various formats."""
    files = {"test.py": "content"}

    test_cases = [
        ("2 passed", {"passed": 2, "failed": 0}),
        ("3 failed", {"passed": 0, "failed": 3}),
        ("1 passed, 2 failed", {"passed": 1, "failed": 2}),
        ("0 passed, 0 failed", {"passed": 0, "failed": 0}),
        ("invalid output", {"passed": 0, "failed": 0}),
        ("", {"passed": 0, "failed": 0}),
    ]

    for output, expected in test_cases:
        with patch('app.services.sandbox._sh') as mock_sh, \
             patch('shutil.rmtree'), \
             patch('pathlib.Path.mkdir'), \
             patch('pathlib.Path.write_text'):

            mock_sh.return_value = (0, output)

            result = run_pytest_job(files)

            assert result["passed"] == expected["passed"], f"Failed for output: {output}"
            assert result["failed"] == expected["failed"], f"Failed for output: {output}"