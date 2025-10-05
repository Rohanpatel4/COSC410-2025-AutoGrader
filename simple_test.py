#!/usr/bin/env python3
"""
Simple test to verify the sandbox works.
"""

import requests
import json
import time
import os

def test_sandbox():
    print("Testing Sandbox Execution")
    print("=" * 40)

    # Check services
    print("1. Checking services...")

    # Backend
    try:
        response = requests.get("http://localhost:8000/docs", timeout=5)
        print("   Backend: OK")
    except:
        print("   Backend: FAIL")
        return

    # Judge0
    try:
        response = requests.get("http://localhost:2358/health", timeout=5)
        print("   Judge0: OK")
    except:
        print("   Judge0: FAIL")
        return

    # Initialize runtime
    print("2. Initializing runtime...")
    try:
        requests.post("http://localhost:8000/api/v1/runtimes/initialize", timeout=5)
        print("   Runtime init: OK")
    except:
        print("   Runtime init: FAIL")

    # Create test files
    print("3. Creating test files...")

    import time
    import random
    timestamp = str(int(time.time()))
    random_num = random.randint(1, 100)

    # Test input
    input_file = f"input_{timestamp}.txt"
    with open(input_file, "w") as f:
        f.write(f"{42 + random_num}\n")

    # Expected output
    output_file = f"output_{timestamp}.txt"
    with open(output_file, "w") as f:
        f.write(f"{(42 + random_num) * (42 + random_num)}\n")

    # Python solution
    code_file = f"code_{timestamp}.py"
    with open(code_file, "w") as f:
        f.write(f"# Test code {random_num}\nimport sys\nn = int(sys.stdin.read().strip())\nprint(n * n)\n")

    print(f"   Test files created: {input_file}, {output_file}, {code_file}")

    # Upload files
    print("4. Uploading files...")

    files = [
        (input_file, "TEST_CASE"),
        (output_file, "TEST_CASE"),
        (code_file, "SUBMISSION")
    ]

    file_ids = []
    for filename, category in files:
        with open(filename, 'rb') as f:
            response = requests.post(
                "http://localhost:8000/api/v1/files",
                files={'f': (filename, f, 'text/plain')},
                data={'category': category},
                timeout=10
            )
        if response.status_code == 201:
            file_ids.append(response.json()['id'])
            print(f"   Uploaded {filename}: OK")
        else:
            print(f"   Uploaded {filename}: FAIL (status {response.status_code})")
            print(f"   Response: {response.text}")
            return

    # Create test suite
    print("5. Creating test suite...")
    response = requests.post(
        "http://localhost:8000/api/v1/test-suites",
        json={"name": "Test", "file_ids": file_ids[:2]},  # input and output
        timeout=10
    )
    if response.status_code in [200, 201]:
        suite_id = response.json()['id']
        print("   Test suite: OK")
    else:
        print(f"   Test suite: FAIL (status {response.status_code})")
        print(f"   Response: {response.text}")
        return

    # Create submission
    print("6. Creating submission...")
    response = requests.post(
        "http://localhost:8000/api/v1/submissions",
        json={"name": "Test", "file_ids": [file_ids[2]]},  # code
        timeout=10
    )
    if response.status_code in [200, 201]:
        submission_id = response.json()['id']
        print("   Submission: OK")
    else:
        print(f"   Submission: FAIL (status {response.status_code})")
        print(f"   Response: {response.text}")
        return

    # Get runtime
    print("7. Getting runtime...")
    response = requests.get("http://localhost:8000/api/v1/runtimes", timeout=10)
    if response.status_code == 200:
        runtimes = response.json()
        if runtimes:
            runtime_id = runtimes[0]['id']
            print("   Runtime: OK")
        else:
            print("   Runtime: FAIL - no runtimes")
            return
    else:
        print("   Runtime: FAIL")
        return

    # Create run
    print("8. Creating run...")
    response = requests.post(
        "http://localhost:8000/api/v1/runs",
        json={
            "submission_id": submission_id,
            "testsuite_id": suite_id,
            "runtime_id": runtime_id
        },
        timeout=10
    )
    if response.status_code in [200, 201]:
        run_data = response.json()
        run_id = run_data['id']
        print("   Run created: OK")
    else:
        print(f"   Run created: FAIL (status {response.status_code})")
        print(f"   Response: {response.text}")
        return

    # Execute run
    print("9. Executing run...")
    response = requests.post(f"http://localhost:8000/api/v1/runs/{run_id}/execute", timeout=10)
    if response.status_code == 200:
        print("   Execution started: OK")
    else:
        print("   Execution started: FAIL")
        return

    # Wait for completion
    print("10. Waiting for results...")
    for i in range(10):
        time.sleep(1)
        response = requests.get(f"http://localhost:8000/api/v1/runs/{run_id}", timeout=10)
        if response.status_code == 200:
            run_status = response.json()
            status = run_status.get('status')
            print(f"    Status: {status}")
            if status in ['SUCCEEDED', 'FAILED']:
                break

    # Get results
    print("11. Getting results...")
    if run_status.get('status') == 'SUCCEEDED' and run_status.get('stdout_path'):
        response = requests.get(f"http://localhost:8000/api/v1/files/results/{run_id}", timeout=10)
        if response.status_code == 200:
            results = response.json()
            print("   Results retrieved: OK")
            print("\nTEST RESULTS:")
            print("-" * 20)
            for result in results:
                status = "PASS" if result.get('passed', False) else "FAIL"
                print(f"{result['test_name']}: {status}")
                if result.get('stdout'):
                    print(f"  Output: {result['stdout'].strip()}")
        else:
            print("   Results retrieved: FAIL")
    else:
        print("   Run did not succeed")

    # Cleanup
    print("12. Cleaning up...")
    import os
    for f in [input_file, output_file, code_file]:
        try:
            os.remove(f)
        except:
            pass
    print("   Cleanup: OK")

    print("\n" + "=" * 40)
    print("SANDBOX TEST COMPLETE!")
    if run_status.get('status') == 'SUCCEEDED':
        print("Result: SUCCESS - Your sandbox is working!")
    else:
        print("Result: FAILED - Check the logs above")

if __name__ == "__main__":
    test_sandbox()

