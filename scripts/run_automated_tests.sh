#!/usr/bin/env bash
# ==============================================================================
# MultiNode POS: Comprehensive Automated Test Suite Runner
# File: scripts/run_automated_tests.sh
# Purpose: Orchestrates backend unit/integration tests, frontend build/types,
#          and NoSQL document validation for local verification & CI/CD.
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

cd "${PROJECT_ROOT}"

echo "================================================================================"
echo "MultiNode POS: Automated Test Suite Runner"
echo "Project Root: ${PROJECT_ROOT}"
echo "Date:         $(date)"
echo "================================================================================"

FAILED_SUITES=()

# ------------------------------------------------------------------------------
# Test Suite 1: Backend Pytest (Transactions, Injection Defense, API Routes)
# ------------------------------------------------------------------------------
echo ""
echo "--------------------------------------------------------------------------------"
echo "[1/3] Running Backend Unit & Integration Tests (Pytest)..."
echo "--------------------------------------------------------------------------------"
PYTHON_BIN="python3"
if [ -f "${PROJECT_ROOT}/backend/.venv/bin/python3" ]; then
  PYTHON_BIN="${PROJECT_ROOT}/backend/.venv/bin/python3"
fi

if PYTHONPATH=backend "${PYTHON_BIN}" -m pytest backend/tests/ -v --tb=short; then
  echo "✓ Test Suite 1 (Backend Pytest): PASSED"
else
  echo "✗ Test Suite 1 (Backend Pytest): FAILED"
  FAILED_SUITES+=("Backend Pytest")
fi

# ------------------------------------------------------------------------------
# Test Suite 2: Frontend TypeScript & Vite Production Build
# ------------------------------------------------------------------------------
echo ""
echo "--------------------------------------------------------------------------------"
echo "[2/3] Running Frontend TypeScript Typecheck & Production Build..."
echo "--------------------------------------------------------------------------------"
if npm --prefix frontend run build; then
  echo "✓ Test Suite 2 (Frontend Build): PASSED"
else
  echo "✗ Test Suite 2 (Frontend Build): FAILED"
  FAILED_SUITES+=("Frontend Build")
fi

# ------------------------------------------------------------------------------
# Test Suite 3: NoSQL Document Schema & Analytics Validation
# ------------------------------------------------------------------------------
echo ""
echo "--------------------------------------------------------------------------------"
echo "[3/3] Running NoSQL Schema & Business Analytics Verification..."
echo "--------------------------------------------------------------------------------"
if "${PYTHON_BIN}" database/07_nosql/verify_nosql.py; then
  echo "✓ Test Suite 3 (NoSQL Verification): PASSED"
else
  echo "✗ Test Suite 3 (NoSQL Verification): FAILED"
  FAILED_SUITES+=("NoSQL Verification")
fi

# ------------------------------------------------------------------------------
# Final Summary
# ------------------------------------------------------------------------------
echo ""
echo "================================================================================"
if [ ${#FAILED_SUITES[@]} -eq 0 ]; then
  echo "OVERALL RESULT: ALL AUTOMATED TEST SUITES PASSED (3/3)"
  echo "The repository is verified healthy and ready for Azure deployment."
  echo "================================================================================"
  exit 0
else
  echo "OVERALL RESULT: FAILURE in ${#FAILED_SUITES[@]} test suite(s):"
  for s in "${FAILED_SUITES[@]}"; do
    echo "  - ${s}"
  done
  echo "================================================================================"
  exit 1
fi
