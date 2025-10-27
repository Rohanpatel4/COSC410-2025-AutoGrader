#!/bin/bash
# Monitor backend logs for submission testing

echo "🔍 Monitoring backend logs..."
echo "Press Ctrl+C to stop"
echo ""

docker-compose logs -f backend | grep -E "(POST|GET|judge0|grade|submission|error|Error|Exception)" --color=always
