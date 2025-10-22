import os, subprocess, sys, textwrap, pathlib

def sh(*args):
    print("$", " ".join(args), flush=True)
    cp = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    print(cp.stdout, flush=True)
    return cp.returncode, cp.stdout

def main():
    # Prove we can reach the inner daemon
    sh("docker", "version")
    sh("docker", "pull", "alpine:3.20")
    sh("docker", "run", "--rm", "alpine:3.20", "echo", "hello-from-inner-docker")

    # Leave the container alive for interactive poking via docker compose exec runner sh
    print("Runner is idle. You can exec into me and run 'docker ps' against the inner daemon.")
    pathlib.Path("/tmp/hold").touch()
    try:
        while True:
            pass
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
    sys.exit(main())
