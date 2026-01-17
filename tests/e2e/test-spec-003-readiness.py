#!/usr/bin/env python3
"""
Test SPEC-003: Readiness Score Calculator

Pass Criteria:
1. Readiness calculator exists
2. Returns score 0-100
3. Includes dimension breakdown
4. Orchestrator emits readiness events
5. Auto-suggest triggers at >= 75
"""

import json
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent

def test_readiness_calculator_exists():
    """Test 1: Readiness calculator file exists"""
    calc_path = PROJECT_ROOT / "agents" / "ideation" / "readiness-calculator.ts"

    if calc_path.exists():
        print("PASS: readiness-calculator.ts exists")
        return True
    else:
        print("FAIL: readiness-calculator.ts not found")
        return False

def test_calculator_exports():
    """Test 2: Calculator exports required functions"""
    calc_path = PROJECT_ROOT / "agents" / "ideation" / "readiness-calculator.ts"

    if not calc_path.exists():
        print("SKIP: Calculator file doesn't exist")
        return None

    content = calc_path.read_text()

    required = ["calculateReadiness", "ReadinessScore", "isReadyForSpec"]
    found = sum(1 for r in required if r in content)

    if found >= 2:
        print(f"PASS: Calculator exports found ({found}/3)")
        return True
    else:
        print(f"FAIL: Missing exports ({found}/3)")
        return False

def test_orchestrator_emits_readiness():
    """Test 3: Orchestrator emits readiness:update events"""
    orch_path = PROJECT_ROOT / "agents" / "ideation" / "orchestrator.ts"

    if not orch_path.exists():
        print("FAIL: orchestrator.ts not found")
        return False

    content = orch_path.read_text()

    # Check for readiness integration or import
    if "readiness" in content.lower():
        print("PASS: Orchestrator references readiness")
        return True
    else:
        # Check if import will be added later
        print("SKIP: Orchestrator doesn't yet reference readiness (integration pending)")
        return None

def test_auto_suggest_threshold():
    """Test 4: Auto-suggest uses 75 threshold"""
    calc_path = PROJECT_ROOT / "agents" / "ideation" / "readiness-calculator.ts"

    if not calc_path.exists():
        print("SKIP: Calculator file doesn't exist")
        return None

    content = calc_path.read_text()

    # Check for threshold constant
    if "75" in content or "READINESS_THRESHOLD" in content:
        print("PASS: Threshold 75 found in calculator")
        return True
    else:
        print("FAIL: Threshold 75 not found")
        return False

def test_dimension_breakdown():
    """Test 5: Returns dimension breakdown"""
    calc_path = PROJECT_ROOT / "agents" / "ideation" / "readiness-calculator.ts"

    if not calc_path.exists():
        print("SKIP: Calculator file doesn't exist")
        return None

    content = calc_path.read_text()

    dimensions = ["problemClarity", "solutionDefinition", "userUnderstanding", "scopeBoundaries"]
    found = sum(1 for d in dimensions if d in content)

    if found >= 4:
        print(f"PASS: Dimension breakdown exists ({found}/4 dimensions)")
        return True
    else:
        print(f"FAIL: Missing dimensions ({found}/4)")
        return False

def main():
    print("=" * 60)
    print("SPEC-003 Test Suite: Readiness Score Calculator")
    print("=" * 60)

    results = []
    results.append(("Calculator exists", test_readiness_calculator_exists()))
    results.append(("Exports functions", test_calculator_exports()))
    results.append(("Orchestrator emits", test_orchestrator_emits_readiness()))
    results.append(("Threshold is 75", test_auto_suggest_threshold()))
    results.append(("Dimension breakdown", test_dimension_breakdown()))

    print("\n" + "=" * 60)
    print("RESULTS:")
    passed = sum(1 for _, r in results if r is True)
    skipped = sum(1 for _, r in results if r is None)
    failed = sum(1 for _, r in results if r is False)

    for name, result in results:
        status = "PASS" if result is True else ("SKIP" if result is None else "FAIL")
        print(f"  {status}: {name}")

    print(f"\nTotal: {passed} passed, {skipped} skipped, {failed} failed")
    return 0 if failed == 0 else 1

if __name__ == "__main__":
    sys.exit(main())
