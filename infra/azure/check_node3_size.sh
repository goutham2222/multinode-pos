#!/usr/bin/env bash
# ==============================================================================
# Script: check_node3_size.sh
# Purpose: Check available 2-vCPU VM sizes from other families in eastus
#          that have 0/4 cores used for this Azure subscription.
# ==============================================================================
set -euo pipefail

python3 - <<'EOF'
import json
import subprocess

CANDIDATES = [
    "Standard_D2s_v5",
    "Standard_D2s_v4",
    "Standard_D2s_v3",
    "Standard_F2s_v2",
    "Standard_B2s",
    "Standard_B1ms",
    "Standard_D2alds_v7",
    "Standard_D2als_v7"
]

print(f"{'Candidate VM Size':<20} | {'Status':<15} | {'Notes / Details'}")
print("-" * 65)

for size in CANDIDATES:
    try:
        proc = subprocess.run(
            ["az", "vm", "list-skus", "--location", "eastus", "--size", size, "--output", "json"],
            capture_output=True,
            text=True,
            check=True
        )
        skus = json.loads(proc.stdout)
    except Exception as e:
        print(f"{size:<20} | ERROR           | {e}")
        continue

    is_available = False
    details = "Available"
    for s in skus:
        if s.get("resourceType") != "virtualMachines":
            continue
        restrs = s.get("restrictions", [])
        if not restrs:
            is_available = True
            break
        else:
            reasons = [r.get("reasonCode") or r.get("type") for r in restrs]
            details = ", ".join(reasons)

    status = "AVAILABLE" if is_available else "RESTRICTED"
    print(f"{size:<20} | {status:<15} | {details}")

print("-" * 65)
EOF
