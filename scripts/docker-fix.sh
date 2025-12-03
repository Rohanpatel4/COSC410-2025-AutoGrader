#!/bin/bash
#
# docker-fix.sh - Fix Docker Desktop when it becomes unresponsive
#
# This script handles the common issue where Docker Desktop shows as "running"
# but the daemon is actually unresponsive (ECONNREFUSED errors).
#
# Cross-platform support: macOS, Linux, Windows (Git Bash/WSL)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Detect operating system
detect_os() {
    case "$(uname -s)" in
        Darwin*)
            echo "macos"
            ;;
        Linux*)
            if grep -q Microsoft /proc/version 2>/dev/null; then
                echo "wsl"
            else
                echo "linux"
            fi
            ;;
        CYGWIN*|MINGW*|MSYS*)
            echo "windows"
            ;;
        *)
            echo "unknown"
            ;;
    esac
}

# Check if Docker daemon is responsive
check_docker_responsive() {
    if docker info &>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Kill hung docker processes (stats collectors, etc.)
kill_hung_docker_processes() {
    local os="$1"
    log_info "Killing hung Docker processes..."
    
    case "$os" in
        macos|linux)
            # Kill hung docker stats processes
            pkill -f "docker stats" 2>/dev/null || true
            # Kill other potentially hung docker CLI processes
            pkill -f "docker ps" 2>/dev/null || true
            pkill -f "docker compose" 2>/dev/null || true
            ;;
        wsl|windows)
            taskkill //F //IM "docker.exe" 2>/dev/null || true
            ;;
    esac
    
    sleep 2
    log_success "Hung processes killed"
}

# Restart Docker on macOS
restart_docker_macos() {
    log_info "Stopping Docker Desktop on macOS..."
    
    # Try graceful quit first
    osascript -e 'quit app "Docker Desktop"' 2>/dev/null || true
    osascript -e 'quit app "Docker"' 2>/dev/null || true
    
    # Wait for quit
    sleep 3
    
    # Force kill if still running
    if pgrep -x "Docker Desktop" &>/dev/null || pgrep -f "Docker.app" &>/dev/null; then
        log_warn "Docker Desktop didn't quit gracefully, force killing..."
        pkill -9 -f "Docker Desktop" 2>/dev/null || true
        pkill -9 -f "Docker.app" 2>/dev/null || true
        # Also kill the hypervisor/VM processes
        pkill -9 -f "com.docker.hyperkit" 2>/dev/null || true
        pkill -9 -f "com.docker.virtualization" 2>/dev/null || true
        pkill -9 -f "vfkit" 2>/dev/null || true
        sleep 3
    fi
    
    # Clear stale socket files (they should be recreated)
    log_info "Cleaning up stale socket files..."
    rm -f ~/.docker/run/docker.sock 2>/dev/null || true
    
    log_info "Starting Docker Desktop..."
    open -a "Docker Desktop"
    
    # Wait for Docker to become responsive
    log_info "Waiting for Docker daemon to become responsive..."
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if check_docker_responsive; then
            log_success "Docker Desktop is now responsive!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_error "Docker Desktop did not become responsive after $((max_attempts * 2)) seconds"
    return 1
}

# Restart Docker on Linux
restart_docker_linux() {
    log_info "Restarting Docker daemon on Linux..."
    
    if command -v systemctl &>/dev/null; then
        sudo systemctl restart docker
    elif command -v service &>/dev/null; then
        sudo service docker restart
    else
        log_error "Cannot determine how to restart Docker on this system"
        return 1
    fi
    
    sleep 5
    
    if check_docker_responsive; then
        log_success "Docker daemon is now responsive!"
        return 0
    else
        log_error "Docker daemon is still not responsive"
        return 1
    fi
}

# Restart Docker on WSL
restart_docker_wsl() {
    log_info "Restarting Docker Desktop from WSL..."
    
    # Try to restart Docker Desktop via Windows
    powershell.exe -Command "Stop-Process -Name 'Docker Desktop' -Force -ErrorAction SilentlyContinue" 2>/dev/null || true
    sleep 3
    powershell.exe -Command "Start-Process 'C:\Program Files\Docker\Docker\Docker Desktop.exe'" 2>/dev/null || true
    
    log_info "Waiting for Docker daemon to become responsive..."
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if check_docker_responsive; then
            log_success "Docker Desktop is now responsive!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_error "Docker Desktop did not become responsive"
    return 1
}

# Restart Docker on Windows (Git Bash)
restart_docker_windows() {
    log_info "Restarting Docker Desktop on Windows..."
    
    # Stop Docker Desktop
    taskkill //F //IM "Docker Desktop.exe" 2>/dev/null || true
    sleep 3
    
    # Start Docker Desktop
    start "" "C:/Program Files/Docker/Docker/Docker Desktop.exe" 2>/dev/null || \
    start "" "$PROGRAMFILES/Docker/Docker/Docker Desktop.exe" 2>/dev/null || true
    
    log_info "Waiting for Docker daemon to become responsive..."
    local max_attempts=60
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if check_docker_responsive; then
            log_success "Docker Desktop is now responsive!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        echo -n "."
        sleep 2
    done
    
    echo ""
    log_error "Docker Desktop did not become responsive"
    return 1
}

# Main function
main() {
    echo ""
    echo "==========================================="
    echo "  Docker Desktop Recovery Script"
    echo "==========================================="
    echo ""
    
    local os=$(detect_os)
    log_info "Detected OS: $os"
    
    # First, check if Docker is already responsive
    if check_docker_responsive; then
        log_success "Docker is already responsive!"
        docker info | head -20
        exit 0
    fi
    
    log_warn "Docker daemon is not responsive. Starting recovery..."
    
    # Kill hung processes first
    kill_hung_docker_processes "$os"
    
    # Now restart Docker based on OS
    case "$os" in
        macos)
            restart_docker_macos
            ;;
        linux)
            restart_docker_linux
            ;;
        wsl)
            restart_docker_wsl
            ;;
        windows)
            restart_docker_windows
            ;;
        *)
            log_error "Unsupported operating system: $os"
            exit 1
            ;;
    esac
    
    # Verify Docker is working
    if check_docker_responsive; then
        echo ""
        log_success "Docker has been successfully restarted!"
        echo ""
        docker info | head -10
        echo ""
        log_info "You can now run: docker compose up --build"
    else
        echo ""
        log_error "Docker recovery failed. Please try:"
        echo "  1. Completely quit Docker Desktop from the menu bar/system tray"
        echo "  2. Wait 10 seconds"
        echo "  3. Restart Docker Desktop manually"
        echo "  4. If still failing, restart your computer"
        exit 1
    fi
}

# Run main function
main "$@"

