#!/usr/bin/env bash
# ==============================================================================
# Script: check_available_regions.sh
# Purpose: Find ALL available 1-vCPU and 2-vCPU VM sizes in eastus and other
#          common regions for this specific Azure for Students subscription.
# ==============================================================================
set -euo pipefail

python3 - <<'EOF'
import json
import subprocess

REGIONS = ["eastus", "eastus2", "centralus", "southcentralus"]

print("Finding available 1-vCPU and 2-vCPU VM sizes for your subscription...\n")

for region in REGIONS:
    print(f"Checking region: {region}...")
    try:
        proc = subprocess.run(
            ["az", "vm", "list-skus", "--location", region, "--output", "json"],
            capture_output=True,
            text=True,
            check=True
        )
        skus = json.loads(proc.stdout)
    except Exception as e:
        print(f"  Error fetching SKUs for {region}: {e}")
        continue

    available_skus = []
    for s in skus:
        if s.get("resourceType") != "virtualMachines":
            continue
        
        # Check restrictions
        restrs = s.get("restrictions", [])
        has_restriction = False
        for r in restrs:
            target_locs = [x.lower() for x in (r.get("restrictionInfo", {}).get("locations", []) or r.get("values", []))]
            if not target_locs or region.lower() in target_locs:
                if r.get("type") == "Location":
                    has_restriction = True
                    break

        if has_restriction:
            continue

        # Extract vCPUs and Memory
        caps = {c.get("name"): c.get("value") for c in s.get("capabilities", [])}
        vcpus = caps.get("vCPUs")
        mem_gb = caps.get("MemoryGB")
        
        # Look for 1 or 2 vCPUs (cost-effective for student tier)
        if vcpus in ["1", "2"]:
            name = s.get("name")
            available_skus.append((name, vcpus, mem_gb))

    if available_skus:
        print(f"  Available VM sizes in {region}:")
        for name, vcpu, mem in available_skus[:8]:  # show top 8 options
            print(f"    - {name:<22} ({vcpu} vCPU, {mem} GB RAM)")
        print()
    else:
        print(f"  No unrestricted 1-2 vCPU sizes found in {region}.\n")
EOF
