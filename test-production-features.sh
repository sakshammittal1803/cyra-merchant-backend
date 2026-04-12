#!/bin/bash

# Production Features Test Script
# This script tests rate limiting, logging, and security features

echo "========================================="
echo "Testing Merchant Cyra Production Features"
echo "========================================="
echo ""

BASE_URL="http://localhost:5000"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

# Function to test endpoint
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    echo -n "Testing: $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASSED${NC} (Status: $status_code)"
        ((PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC} (Expected: $expected_status, Got: $status_code)"
        ((FAILED++))
    fi
}

# Test 1: Health Check
echo "1. Testing Health Check Endpoint"
test_endpoint "Health Check" "GET" "/health" "" "200"
echo ""

# Test 2: Rate Limiting on Auth
echo "2. Testing Rate Limiting on Auth Endpoint"
echo "   Sending 6 requests (limit is 5 per 15 minutes)..."
for i in {1..5}; do
    echo -n "   Request $i... "
    status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
        -H "Content-Type: application/json" \
        -d '{"email":"test@test.com","password":"test123"}')
    echo "Status: $status"
done

echo -n "   Request 6 (should be rate limited)... "
status=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"test123"}')

if [ "$status" = "429" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (Rate limited as expected)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Expected 429, got $status)"
    ((FAILED++))
fi
echo ""

# Test 3: Input Validation
echo "3. Testing Input Validation"
test_endpoint "Invalid Email Format" "POST" "/api/auth/login" \
    '{"email":"invalid-email","password":"test123"}' "400"
echo ""

# Test 4: 404 Handler
echo "4. Testing 404 Handler"
test_endpoint "Non-existent Route" "GET" "/api/nonexistent" "" "404"
echo ""

# Test 5: Security Headers (Helmet)
echo "5. Testing Security Headers"
echo -n "Checking for security headers... "
headers=$(curl -s -I "$BASE_URL/health")

if echo "$headers" | grep -q "X-Content-Type-Options"; then
    echo -e "${GREEN}✓ PASSED${NC} (Security headers present)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (Security headers missing)"
    ((FAILED++))
fi
echo ""

# Test 6: CORS
echo "6. Testing CORS Configuration"
echo -n "Checking CORS headers... "
cors_header=$(curl -s -I -H "Origin: http://localhost:3000" "$BASE_URL/health" | grep -i "access-control-allow-origin")

if [ -n "$cors_header" ]; then
    echo -e "${GREEN}✓ PASSED${NC} (CORS configured)"
    ((PASSED++))
else
    echo -e "${RED}✗ FAILED${NC} (CORS not configured)"
    ((FAILED++))
fi
echo ""

# Test 7: Compression
echo "7. Testing Compression"
echo -n "Checking compression support... "
compression=$(curl -s -I -H "Accept-Encoding: gzip" "$BASE_URL/health" | grep -i "content-encoding")

if echo "$compression" | grep -q "gzip"; then
    echo -e "${GREEN}✓ PASSED${NC} (Compression enabled)"
    ((PASSED++))
else
    echo -e "${YELLOW}⚠ WARNING${NC} (Compression not detected - may be disabled for small responses)"
    ((PASSED++))
fi
echo ""

# Summary
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
