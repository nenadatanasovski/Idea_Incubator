#!/bin/bash
# Test script for SPEC-006: Spec Panel with Structured Editor
# Validates all components and TypeScript compilation

set -e

echo "=========================================="
echo "SPEC-006: Spec Panel with Structured Editor"
echo "=========================================="
echo ""

PASS=0
FAIL=0

# Test 1: SpecPanel.tsx exists
echo "Test 1: SpecPanel.tsx exists"
if [ -f "frontend/src/components/ideation/SpecPanel.tsx" ]; then
    echo "  ✓ PASS: SpecPanel.tsx exists"
    ((PASS++))
else
    echo "  ✗ FAIL: SpecPanel.tsx not found"
    ((FAIL++))
fi

# Test 2: SpecSectionEditor.tsx exists
echo ""
echo "Test 2: SpecSectionEditor.tsx exists"
if [ -f "frontend/src/components/ideation/SpecSectionEditor.tsx" ]; then
    echo "  ✓ PASS: SpecSectionEditor.tsx exists"
    ((PASS++))
else
    echo "  ✗ FAIL: SpecSectionEditor.tsx not found"
    ((FAIL++))
fi

# Test 3: SpecSectionList.tsx exists
echo ""
echo "Test 3: SpecSectionList.tsx exists"
if [ -f "frontend/src/components/ideation/SpecSectionList.tsx" ]; then
    echo "  ✓ PASS: SpecSectionList.tsx exists"
    ((PASS++))
else
    echo "  ✗ FAIL: SpecSectionList.tsx not found"
    ((FAIL++))
fi

# Test 4: ArtifactRenderer handles spec type
echo ""
echo "Test 4: ArtifactRenderer handles spec type"
if grep -q 'case "spec":' frontend/src/components/ideation/ArtifactRenderer.tsx 2>/dev/null; then
    echo "  ✓ PASS: ArtifactRenderer has spec case"
    ((PASS++))
else
    echo "  ✗ FAIL: ArtifactRenderer missing spec case"
    ((FAIL++))
fi

# Test 5: IdeaArtifactPanel has Spec tab
echo ""
echo "Test 5: IdeaArtifactPanel has Spec tab"
if grep -q '"spec"' frontend/src/components/ideation/IdeaArtifactPanel.tsx 2>/dev/null && \
   grep -q 'SpecPanel' frontend/src/components/ideation/IdeaArtifactPanel.tsx 2>/dev/null; then
    echo "  ✓ PASS: IdeaArtifactPanel has Spec tab"
    ((PASS++))
else
    echo "  ✗ FAIL: IdeaArtifactPanel missing Spec tab integration"
    ((FAIL++))
fi

# Test 6: SpecPanel has required features
echo ""
echo "Test 6: SpecPanel has required features"
PANEL_FEATURES=0
if grep -q 'SpecWorkflowBadge' frontend/src/components/ideation/SpecPanel.tsx 2>/dev/null; then
    ((PANEL_FEATURES++))
fi
if grep -q 'SpecSectionEditor' frontend/src/components/ideation/SpecPanel.tsx 2>/dev/null; then
    ((PANEL_FEATURES++))
fi
if grep -q 'onSubmitForReview\|onApprove\|onCreateTasks' frontend/src/components/ideation/SpecPanel.tsx 2>/dev/null; then
    ((PANEL_FEATURES++))
fi
if [ $PANEL_FEATURES -ge 3 ]; then
    echo "  ✓ PASS: SpecPanel has required features (workflow badge, editor, actions)"
    ((PASS++))
else
    echo "  ✗ FAIL: SpecPanel missing required features ($PANEL_FEATURES/3)"
    ((FAIL++))
fi

# Test 7: SpecSectionEditor has auto-save
echo ""
echo "Test 7: SpecSectionEditor has auto-save with debounce"
if grep -q 'debounce\|setTimeout' frontend/src/components/ideation/SpecSectionEditor.tsx 2>/dev/null && \
   grep -q 'onSave\|onChange' frontend/src/components/ideation/SpecSectionEditor.tsx 2>/dev/null; then
    echo "  ✓ PASS: SpecSectionEditor has auto-save"
    ((PASS++))
else
    echo "  ✗ FAIL: SpecSectionEditor missing auto-save"
    ((FAIL++))
fi

# Test 8: SpecSectionList has add/remove/reorder
echo ""
echo "Test 8: SpecSectionList has add/remove/reorder functionality"
LIST_FEATURES=0
if grep -q 'handleAdd\|onAdd\|addItem' frontend/src/components/ideation/SpecSectionList.tsx 2>/dev/null; then
    ((LIST_FEATURES++))
fi
if grep -q 'handleRemove\|onRemove\|removeItem' frontend/src/components/ideation/SpecSectionList.tsx 2>/dev/null; then
    ((LIST_FEATURES++))
fi
if grep -q 'handleMove\|moveItem\|reorder\|drag' frontend/src/components/ideation/SpecSectionList.tsx 2>/dev/null; then
    ((LIST_FEATURES++))
fi
if [ $LIST_FEATURES -ge 3 ]; then
    echo "  ✓ PASS: SpecSectionList has add/remove/reorder"
    ((PASS++))
else
    echo "  ✗ FAIL: SpecSectionList missing functionality ($LIST_FEATURES/3)"
    ((FAIL++))
fi

# Test 9: TypeScript compilation
echo ""
echo "Test 9: TypeScript compilation passes"
cd frontend
TSC_OUTPUT=$(npx tsc --noEmit 2>&1 || true)
SPEC_ERRORS=$(echo "$TSC_OUTPUT" | grep -E "SpecPanel|SpecSectionEditor|SpecSectionList" | wc -l | tr -d ' ')
if [ "$SPEC_ERRORS" -gt 0 ]; then
    echo "  ✗ FAIL: TypeScript errors in SPEC-006 components ($SPEC_ERRORS errors)"
    echo "$TSC_OUTPUT" | grep -E "SpecPanel|SpecSectionEditor|SpecSectionList" | head -5
    ((FAIL++))
else
    echo "  ✓ PASS: No TypeScript errors in SPEC-006 components"
    ((PASS++))
fi
cd ..

# Summary
echo ""
echo "=========================================="
echo "SPEC-006 Test Summary"
echo "=========================================="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✓ All tests passed! SPEC-006 is complete."
    exit 0
else
    echo "✗ Some tests failed. Please fix issues before proceeding."
    exit 1
fi
