#!/bin/bash

# Merchant Cyra Backend Monitoring Script
# This script provides real-time monitoring of the application

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

BASE_URL="http://localhost:5000"
LOG_DIR="./logs"

# Function to print section header
print_header() {
    echo ""
    echo -e "${BLUE}=========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}=========================================${NC}"
}

# Function to check health
check_health() {
    print_header "Health Check"
    
    response=$(curl -s "$BASE_URL/health")
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Server is running${NC}"
        echo "$response" | jq '.'
    else
        echo -e "${RED}✗ Server is not responding${NC}"
        return 1
    fi
}

# Function to show recent logs
show_recent_logs() {
    print_header "Recent Logs (Last 10 entries)"
    
    if [ -d "$LOG_DIR" ]; then
        latest_log=$(ls -t "$LOG_DIR"/combined-*.log 2>/dev/null | head -1)
        if [ -n "$latest_log" ]; then
            tail -10 "$latest_log" | jq -r '. | "\(.timestamp) [\(.level)] \(.message)"'
        else
            echo -e "${YELLOW}No log files found${NC}"
        fi
    else
        echo -e "${YELLOW}Log directory not found${NC}"
    fi
}

# Function to show error summary
show_errors() {
    print_header "Recent Errors (Last 5)"
    
    if [ -d "$LOG_DIR" ]; then
        latest_error_log=$(ls -t "$LOG_DIR"/error-*.log 2>/dev/null | head -1)
        if [ -n "$latest_error_log" ] && [ -s "$latest_error_log" ]; then
            tail -5 "$latest_error_log" | jq -r '. | "\(.timestamp) - \(.message)"'
        else
            echo -e "${GREEN}No recent errors${NC}"
        fi
    else
        echo -e "${YELLOW}Log directory not found${NC}"
    fi
}

# Function to show rate limit violations
show_rate_limits() {
    print_header "Rate Limit Violations (Last 24 hours)"
    
    if [ -d "$LOG_DIR" ]; then
        latest_log=$(ls -t "$LOG_DIR"/combined-*.log 2>/dev/null | head -1)
        if [ -n "$latest_log" ]; then
            count=$(grep "Rate limit exceeded" "$latest_log" 2>/dev/null | wc -l)
            echo "Total violations: $count"
            
            if [ "$count" -gt 0 ]; then
                echo ""
                echo "Top offending IPs:"
                grep "Rate limit exceeded" "$latest_log" 2>/dev/null | \
                    jq -r '.ip' | sort | uniq -c | sort -rn | head -5
            fi
        else
            echo -e "${YELLOW}No log files found${NC}"
        fi
    else
        echo -e "${YELLOW}Log directory not found${NC}"
    fi
}

# Function to show request statistics
show_request_stats() {
    print_header "Request Statistics (Current log file)"
    
    if [ -d "$LOG_DIR" ]; then
        latest_log=$(ls -t "$LOG_DIR"/combined-*.log 2>/dev/null | head -1)
        if [ -n "$latest_log" ]; then
            total=$(grep '"level":"http"' "$latest_log" 2>/dev/null | wc -l)
            echo "Total requests: $total"
            
            if [ "$total" -gt 0 ]; then
                echo ""
                echo "Requests by status code:"
                grep '"level":"http"' "$latest_log" 2>/dev/null | \
                    jq -r '.status' | sort | uniq -c | sort -rn
                
                echo ""
                echo "Top 5 endpoints:"
                grep '"level":"http"' "$latest_log" 2>/dev/null | \
                    jq -r '.url' | sort | uniq -c | sort -rn | head -5
                
                echo ""
                echo "Average response time:"
                avg=$(grep '"level":"http"' "$latest_log" 2>/dev/null | \
                    jq -r '.responseTime' | awk '{sum+=$1; count++} END {if(count>0) print sum/count; else print 0}')
                echo "${avg}ms"
            fi
        else
            echo -e "${YELLOW}No log files found${NC}"
        fi
    else
        echo -e "${YELLOW}Log directory not found${NC}"
    fi
}

# Function to show disk usage
show_disk_usage() {
    print_header "Disk Usage"
    
    if [ -d "$LOG_DIR" ]; then
        echo "Log directory size:"
        du -sh "$LOG_DIR"
        echo ""
        echo "Individual log files:"
        du -h "$LOG_DIR"/*.log 2>/dev/null | sort -rh | head -10
    else
        echo -e "${YELLOW}Log directory not found${NC}"
    fi
}

# Function to show system resources
show_system_resources() {
    print_header "System Resources"
    
    # Check if PM2 is running
    if command -v pm2 &> /dev/null; then
        echo "PM2 Status:"
        pm2 list | grep merchant-backend
        echo ""
        echo "Memory Usage:"
        pm2 show merchant-backend 2>/dev/null | grep -A 5 "Monit"
    else
        echo "PM2 not installed or not running"
        echo ""
        echo "Node processes:"
        ps aux | grep node | grep -v grep
    fi
}

# Function to watch logs in real-time
watch_logs() {
    print_header "Watching Logs (Press Ctrl+C to stop)"
    
    if [ -d "$LOG_DIR" ]; then
        latest_log=$(ls -t "$LOG_DIR"/combined-*.log 2>/dev/null | head -1)
        if [ -n "$latest_log" ]; then
            tail -f "$latest_log" | jq -r '. | "\(.timestamp) [\(.level)] \(.message)"'
        else
            echo -e "${YELLOW}No log files found${NC}"
        fi
    else
        echo -e "${YELLOW}Log directory not found${NC}"
    fi
}

# Main menu
show_menu() {
    clear
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Merchant Cyra Backend Monitor        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo "1. Health Check"
    echo "2. Recent Logs"
    echo "3. Recent Errors"
    echo "4. Rate Limit Violations"
    echo "5. Request Statistics"
    echo "6. Disk Usage"
    echo "7. System Resources"
    echo "8. Watch Logs (Real-time)"
    echo "9. Full Report"
    echo "0. Exit"
    echo ""
    echo -n "Select option: "
}

# Full report
full_report() {
    clear
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  Full System Report                    ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    
    check_health
    show_recent_logs
    show_errors
    show_rate_limits
    show_request_stats
    show_disk_usage
    show_system_resources
    
    echo ""
    echo -e "${GREEN}Report generated at: $(date)${NC}"
    echo ""
    read -p "Press Enter to continue..."
}

# Main loop
if [ "$1" = "--watch" ]; then
    watch_logs
elif [ "$1" = "--report" ]; then
    full_report
else
    while true; do
        show_menu
        read -r choice
        
        case $choice in
            1) check_health; read -p "Press Enter to continue..." ;;
            2) show_recent_logs; read -p "Press Enter to continue..." ;;
            3) show_errors; read -p "Press Enter to continue..." ;;
            4) show_rate_limits; read -p "Press Enter to continue..." ;;
            5) show_request_stats; read -p "Press Enter to continue..." ;;
            6) show_disk_usage; read -p "Press Enter to continue..." ;;
            7) show_system_resources; read -p "Press Enter to continue..." ;;
            8) watch_logs ;;
            9) full_report ;;
            0) echo "Goodbye!"; exit 0 ;;
            *) echo -e "${RED}Invalid option${NC}"; sleep 1 ;;
        esac
    done
fi
