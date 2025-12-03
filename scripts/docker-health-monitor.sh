#!/bin/bash
#
# docker-health-monitor.sh - Monitor Docker and containers health
#
# This script checks Docker daemon and container health, providing
# warnings before issues become critical.
#
# Usage:
#   ./docker-health-monitor.sh         # Run once
#   ./docker-health-monitor.sh --watch # Continuous monitoring
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if Docker daemon is responsive
check_docker_daemon() {
    if timeout 5 docker info &>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Check Docker resource usage
check_docker_resources() {
    echo ""
    echo -e "${CYAN}=== Docker Resource Usage ===${NC}"
    
    # Get Docker system info
    local docker_info
    docker_info=$(docker system df 2>/dev/null)
    if [ $? -eq 0 ]; then
        echo "$docker_info"
    else
        log_error "Cannot get Docker resource info"
        return 1
    fi
    
    echo ""
    
    # Check for dangling images/containers
    local dangling_images
    dangling_images=$(docker images -f "dangling=true" -q 2>/dev/null | wc -l | tr -d ' ')
    if [ "$dangling_images" -gt 5 ]; then
        log_warn "Found $dangling_images dangling images. Consider running: docker image prune"
    fi
    
    local stopped_containers
    stopped_containers=$(docker ps -a -f "status=exited" -q 2>/dev/null | wc -l | tr -d ' ')
    if [ "$stopped_containers" -gt 5 ]; then
        log_warn "Found $stopped_containers stopped containers. Consider running: docker container prune"
    fi
}

# Check container health
check_containers() {
    echo ""
    echo -e "${CYAN}=== Container Status ===${NC}"
    
    # Check if compose project is running
    local containers
    containers=$(docker compose -f "$PROJECT_DIR/docker-compose.yml" ps --format json 2>/dev/null || echo "[]")
    
    if [ "$containers" = "[]" ] || [ -z "$containers" ]; then
        log_info "No containers running for this project"
        return 0
    fi
    
    # Show container status
    docker compose -f "$PROJECT_DIR/docker-compose.yml" ps 2>/dev/null || true
    
    echo ""
    
    # Check individual container stats
    echo -e "${CYAN}=== Container Resource Usage ===${NC}"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}" 2>/dev/null || true
    
    # Check for unhealthy containers
    local unhealthy
    unhealthy=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" 2>/dev/null)
    if [ -n "$unhealthy" ]; then
        echo ""
        log_warn "Unhealthy containers detected:"
        echo "$unhealthy"
    fi
    
    # Check for containers using too much memory
    local high_mem_containers
    high_mem_containers=$(docker stats --no-stream --format "{{.Name}}:{{.MemPerc}}" 2>/dev/null | awk -F: '{gsub(/%/,"",$2); if ($2 > 80) print $1}')
    if [ -n "$high_mem_containers" ]; then
        echo ""
        log_warn "Containers using >80% of their memory limit:"
        echo "$high_mem_containers"
    fi
}

# Check for hung Docker processes
check_hung_processes() {
    echo ""
    echo -e "${CYAN}=== Docker Process Check ===${NC}"
    
    local hung_stats
    hung_stats=$(pgrep -f "docker stats" 2>/dev/null | wc -l | tr -d ' ')
    
    if [ "$hung_stats" -gt 2 ]; then
        log_warn "Found $hung_stats 'docker stats' processes - may indicate hung connections"
        log_info "Consider running: ./scripts/docker-fix.sh"
    else
        log_success "No hung Docker processes detected"
    fi
}

# Check Piston specifically
check_piston() {
    echo ""
    echo -e "${CYAN}=== Piston Health ===${NC}"
    
    # Check if Piston container is running
    if ! docker ps --format "{{.Names}}" 2>/dev/null | grep -q "^piston$"; then
        log_warn "Piston container is not running"
        return 1
    fi
    
    # Check Piston API
    if curl -sf --max-time 5 "http://localhost:2000/api/v2/runtimes" > /dev/null 2>&1; then
        log_success "Piston API is responding"
        
        # Show installed runtimes
        local runtimes
        runtimes=$(curl -sf --max-time 5 "http://localhost:2000/api/v2/runtimes" 2>/dev/null | grep -o '"language":"[^"]*"' | cut -d'"' -f4 | sort -u | head -10 | tr '\n' ', ')
        if [ -n "$runtimes" ]; then
            log_info "Installed runtimes: ${runtimes%, }"
        fi
    else
        log_error "Piston API is not responding"
        log_info "Container logs:"
        docker logs --tail 20 piston 2>&1 || true
    fi
    
    # Check Piston resource usage
    local piston_mem
    piston_mem=$(docker stats --no-stream --format "{{.MemPerc}}" piston 2>/dev/null | tr -d '%')
    if [ -n "$piston_mem" ] && [ "${piston_mem%.*}" -gt 70 ]; then
        log_warn "Piston is using ${piston_mem}% of its memory limit"
    fi
}

# Main health check
run_health_check() {
    echo ""
    echo "==========================================="
    echo "  Docker Health Monitor"
    echo "  $(date)"
    echo "==========================================="
    
    # Check Docker daemon first
    echo ""
    echo -e "${CYAN}=== Docker Daemon ===${NC}"
    if check_docker_daemon; then
        log_success "Docker daemon is responsive"
    else
        log_error "Docker daemon is NOT responsive!"
        log_info "Run ./scripts/docker-fix.sh to attempt recovery"
        return 1
    fi
    
    check_hung_processes
    check_docker_resources
    check_containers
    check_piston
    
    echo ""
    echo "==========================================="
    log_success "Health check complete"
    echo "==========================================="
}

# Watch mode - continuous monitoring
watch_mode() {
    log_info "Starting continuous monitoring (Ctrl+C to stop)..."
    while true; do
        clear
        run_health_check
        echo ""
        log_info "Refreshing in 30 seconds..."
        sleep 30
    done
}

# Parse arguments
case "${1:-}" in
    --watch|-w)
        watch_mode
        ;;
    --help|-h)
        echo "Usage: $0 [--watch]"
        echo ""
        echo "Options:"
        echo "  --watch, -w   Continuous monitoring mode"
        echo "  --help, -h    Show this help"
        ;;
    *)
        run_health_check
        ;;
esac

