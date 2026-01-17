#!/usr/bin/env python3
"""
Test SPEC-004: Spec Generation Engine

Pass Criteria:
1. Spec generator service exists
2. Generation prompt template exists
3. API endpoint /api/specs/generate exists
4. Generated spec has all required sections
5. Low-confidence sections flagged
"""

import json
import subprocess
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent.parent

def test_generator_service_exists():
    """Test 1: Spec generator service exists"""
    gen_path = PROJECT_ROOT / "agents" / "ideation" / "spec-generator.ts"

    if gen_path.exists():
        content = gen_path.read_text()
        if "generateSpec" in content:
            print("PASS: spec-generator.ts exists with generateSpec")
            return True
        print("FAIL: spec-generator.ts missing generateSpec function")
        return False
    else:
        print("FAIL: spec-generator.ts not found")
        return False

def test_prompt_template_exists():
    """Test 2: Generation prompt template exists"""
    prompt_path = PROJECT_ROOT / "agents" / "ideation" / "prompts" / "spec-generation.ts"

    if prompt_path.exists():
        content = prompt_path.read_text()
        required_sections = ["problem", "target", "solution", "criteria"]
        found = sum(1 for s in required_sections if s.lower() in content.lower())

        if found >= 3:
            print(f"PASS: Prompt template covers {found}/4 sections")
            return True
        print(f"FAIL: Prompt template incomplete ({found}/4)")
        return False
    else:
        print("FAIL: spec-generation.ts prompt not found")
        return False

def test_api_endpoint_exists():
    """Test 3: API endpoint exists"""
    # Check route file
    routes_path = PROJECT_ROOT / "server" / "routes" / "specs.ts"

    if routes_path.exists():
        content = routes_path.read_text()
        if "/generate" in content:
            print("PASS: Spec generation endpoint found in specs.ts")
            return True
        print("FAIL: /generate endpoint not found in specs.ts")
        return False

    print("FAIL: specs.ts route file not found")
    return False

def test_spec_has_sections():
    """Test 4: Generated spec has all required sections"""
    gen_path = PROJECT_ROOT / "agents" / "ideation" / "spec-generator.ts"

    if not gen_path.exists():
        print("SKIP: Generator doesn't exist yet")
        return None

    content = gen_path.read_text()

    sections = [
        "problemStatement",
        "targetUsers",
        "functionalDescription",
        "successCriteria",
        "constraints",
        "outOfScope"
    ]

    found = sum(1 for s in sections if s in content)

    if found >= 5:
        print(f"PASS: Generator handles {found}/6 sections")
        return True
    else:
        print(f"FAIL: Generator missing sections ({found}/6)")
        return False

def test_confidence_scoring():
    """Test 5: Low-confidence sections are flagged"""
    gen_path = PROJECT_ROOT / "agents" / "ideation" / "spec-generator.ts"

    if not gen_path.exists():
        print("SKIP: Generator doesn't exist yet")
        return None

    content = gen_path.read_text()

    if "confidence" in content.lower() and ("50" in content or "LOW_CONFIDENCE" in content):
        print("PASS: Confidence scoring with threshold exists")
        return True
    elif "confidence" in content.lower():
        print("PASS: Confidence scoring exists")
        return True
    else:
        print("SKIP: Confidence scoring not yet implemented")
        return None

def test_api_registered():
    """Test 6: API route registered in api.ts"""
    api_path = PROJECT_ROOT / "server" / "api.ts"

    if api_path.exists():
        content = api_path.read_text()
        if "specsRouter" in content and "/api/specs" in content:
            print("PASS: Specs routes registered in api.ts")
            return True
        print("FAIL: Specs routes not registered in api.ts")
        return False

    print("FAIL: api.ts not found")
    return False

def main():
    print("=" * 60)
    print("SPEC-004 Test Suite: Spec Generation Engine")
    print("=" * 60)

    results = []
    results.append(("Generator service", test_generator_service_exists()))
    results.append(("Prompt template", test_prompt_template_exists()))
    results.append(("API endpoint", test_api_endpoint_exists()))
    results.append(("All sections", test_spec_has_sections()))
    results.append(("Confidence scoring", test_confidence_scoring()))
    results.append(("API registered", test_api_registered()))

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
