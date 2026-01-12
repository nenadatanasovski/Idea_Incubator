# Validation Agent & UX Testing Agent Specifications

**Created:** 2026-01-10
**Purpose:** Define missing agents for comprehensive testing
**Status:** Design Document

---

## Executive Summary

Two critical agents are missing from the current design:

1. **Validation Agent** - Comprehensive testing beyond basic validation commands
2. **UX Testing Agent** - Automated user experience testing via Puppeteer

These agents complete the quality assurance loop and are essential for the self-building system.

---

## 1. Validation Agent

### 1.1 Why It's Needed

Current state: Build Agent runs `npx tsc`, `npm test`, `npm run lint` after tasks.

**What's missing:**

| Gap | Risk |
|-----|------|
| No test generation | Code ships with minimal coverage |
| No edge case testing | Bugs in boundary conditions |
| No integration testing | Components work alone but fail together |
| No performance testing | Slow code ships to production |
| No security testing | Vulnerabilities reach production |
| No regression analysis | Can't pinpoint which change broke things |

### 1.2 Validation Agent Specification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VALIDATION AGENT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LOCATION: coding-loops/agents/validation_agent.py                          │
│                                                                              │
│  TRIGGERS:                                                                   │
│  ├─ Event: task.completed (validate single task)                            │
│  ├─ Event: build.validating (validate entire build)                         │
│  └─ Event: pr.created (validate before merge)                               │
│                                                                              │
│  INPUTS:                                                                     │
│  ├─ Code changes (git diff)                                                 │
│  ├─ Spec requirements                                                       │
│  ├─ Existing test suite                                                     │
│  └─ Historical test results                                                 │
│                                                                              │
│  OUTPUTS:                                                                    │
│  ├─ ValidationReport                                                        │
│  ├─ Generated test cases                                                    │
│  ├─ Coverage report                                                         │
│  ├─ Security scan results                                                   │
│  └─ Performance benchmarks                                                  │
│                                                                              │
│  DECISION: Pass / Fail / Needs Review                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Validation Levels

```python
# coding-loops/agents/validation_agent.py

class ValidationLevel(Enum):
    """
    Validation levels with increasing rigor.
    Higher levels include all lower level checks.
    """

    QUICK = 1       # Syntax, types, lint (< 30 sec)
    STANDARD = 2    # + Unit tests, basic coverage (< 2 min)
    THOROUGH = 3    # + Integration tests, edge cases (< 10 min)
    COMPREHENSIVE = 4  # + Performance, security, generated tests (< 30 min)
    RELEASE = 5     # + Full regression, load testing (< 2 hours)


VALIDATION_CHECKS = {

    ValidationLevel.QUICK: [
        'typescript_check',      # npx tsc --noEmit
        'lint_check',            # npm run lint
        'syntax_validation',     # Parse all changed files
    ],

    ValidationLevel.STANDARD: [
        'unit_tests',            # npm test -- --grep <changed files>
        'coverage_check',        # Must meet threshold (e.g., 80%)
        'import_validation',     # No circular imports, missing imports
    ],

    ValidationLevel.THOROUGH: [
        'integration_tests',     # npm test -- --grep integration
        'edge_case_tests',       # Generated tests for boundaries
        'error_path_tests',      # What happens when things fail
        'database_tests',        # Migration runs, queries work
    ],

    ValidationLevel.COMPREHENSIVE: [
        'performance_tests',     # Response time < thresholds
        'security_scan',         # OWASP checks, input validation
        'generated_tests',       # AI-generated test cases
        'mutation_testing',      # Tests actually catch bugs
        'api_contract_tests',    # Endpoints match spec
    ],

    ValidationLevel.RELEASE: [
        'full_regression',       # All tests across all modules
        'load_testing',          # Behavior under stress
        'compatibility_check',   # Browser/platform compatibility
        'accessibility_audit',   # WCAG compliance
        'end_to_end_tests',      # Full user journeys
    ]
}
```

### 1.4 Test Generation

```python
class TestGenerator:
    """
    Generate test cases from code and specifications.
    """

    async def generate_tests(
        self,
        file_path: str,
        spec: Specification,
        existing_tests: List[str]
    ) -> List[GeneratedTest]:

        # 1. Analyze the code
        code = await read_file(file_path)
        analysis = await self.analyze_code(code)
        # Returns: functions, branches, inputs, outputs, edge cases

        # 2. Identify untested paths
        coverage = await self.get_coverage(file_path)
        untested = self.find_untested_paths(analysis, coverage)

        # 3. Generate test cases using Claude
        prompt = f"""
        Generate test cases for untested code paths.

        ## Code Analysis
        Functions: {analysis.functions}
        Uncovered branches: {untested.branches}
        Edge cases identified: {analysis.edge_cases}

        ## Existing Tests
        {existing_tests[:3]}  # Show pattern

        ## Requirements from Spec
        {spec.requirements}

        Generate test cases for:
        1. Each uncovered branch
        2. Boundary conditions (0, 1, max, null, empty)
        3. Error paths (what if DB fails? Network timeout?)
        4. Concurrency issues (if applicable)

        Output format:
        ```typescript
        describe('...', () => {{
            it('should...', async () => {{
                // Arrange
                // Act
                // Assert
            }});
        }});
        ```
        """

        generated = await claude.generate(prompt)

        # 4. Validate generated tests actually run
        validated = await self.validate_tests(generated)

        return validated
```

### 1.5 Security Scanning

```python
class SecurityScanner:
    """
    Scan code for security vulnerabilities.
    """

    CHECKS = {
        'sql_injection': {
            'patterns': [
                r'query\s*\(\s*[`\'"].*\$\{',  # Template literals in SQL
                r'execute\s*\(\s*.*\+',         # String concatenation in SQL
            ],
            'severity': 'critical',
            'fix': 'Use parameterized queries'
        },

        'xss': {
            'patterns': [
                r'innerHTML\s*=',               # Direct HTML injection
                r'dangerouslySetInnerHTML',     # React escape hatch
            ],
            'severity': 'high',
            'fix': 'Use textContent or sanitize input'
        },

        'path_traversal': {
            'patterns': [
                r'readFile\s*\(\s*req\.',       # User input in file path
                r'path\.join\s*\(\s*.*req\.',   # User input in path.join
            ],
            'severity': 'critical',
            'fix': 'Validate and sanitize file paths'
        },

        'secrets': {
            'patterns': [
                r'password\s*=\s*[\'"][^\'"]+[\'"]',  # Hardcoded passwords
                r'api[_-]?key\s*=\s*[\'"]',           # Hardcoded API keys
            ],
            'severity': 'critical',
            'fix': 'Use environment variables'
        },

        'input_validation': {
            'check': 'All user inputs must be validated',
            'method': 'Analyze request handlers for validation'
        }
    }

    async def scan(self, files: List[str]) -> SecurityReport:
        findings = []

        for file in files:
            content = await read_file(file)

            for check_name, check in self.CHECKS.items():
                if 'patterns' in check:
                    for pattern in check['patterns']:
                        matches = re.findall(pattern, content)
                        if matches:
                            findings.append(SecurityFinding(
                                check=check_name,
                                file=file,
                                severity=check['severity'],
                                matches=matches,
                                fix=check['fix']
                            ))

        return SecurityReport(
            passed=len([f for f in findings if f.severity == 'critical']) == 0,
            findings=findings
        )
```

### 1.6 Validation Report

```python
@dataclass
class ValidationReport:
    """
    Comprehensive validation report.
    """

    # Summary
    passed: bool
    level: ValidationLevel
    duration_seconds: float

    # Check results
    checks: Dict[str, CheckResult]
    # { 'typescript_check': CheckResult(passed=True, duration=2.3, output="...") }

    # Coverage
    coverage: CoverageReport
    # { overall: 85%, files: {...}, uncovered_lines: [...] }

    # Security
    security: SecurityReport
    # { passed: True, findings: [...] }

    # Performance
    performance: PerformanceReport
    # { avg_response_ms: 45, p95_response_ms: 120, memory_mb: 256 }

    # Generated tests
    generated_tests: List[GeneratedTest]
    # Tests created during validation

    # Recommendations
    recommendations: List[str]
    # ["Add tests for error path in createHabit", "Fix SQL injection in..."]

    # Blocking issues (must fix before merge)
    blockers: List[str]

    # Warnings (should fix but not blocking)
    warnings: List[str]
```

### 1.7 Integration with Build Agent

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BUILD + VALIDATION FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BUILD AGENT                          VALIDATION AGENT                       │
│      │                                      │                                │
│      │  executes task                       │                                │
│      ├──────────────────────────────────────┤                                │
│      │                                      │                                │
│      │  task.completed ─────────────────────▶  QUICK validation             │
│      │                                      │  (syntax, types, lint)        │
│      │  ◀───────────────────────────────────┤  Pass → continue              │
│      │                                      │  Fail → rollback              │
│      │                                      │                                │
│      │  ... more tasks ...                  │                                │
│      │                                      │                                │
│      │  build.validating ───────────────────▶  STANDARD validation          │
│      │                                      │  (unit tests, coverage)       │
│      │  ◀───────────────────────────────────┤                                │
│      │                                      │                                │
│      │  if STANDARD passes:                 │                                │
│      │  build.complete ─────────────────────▶  THOROUGH validation          │
│      │                                      │  (integration, edge cases)    │
│      │                                      │                                │
│      │                                      │  generate tests               │
│      │                                      │  security scan                │
│      │                                      │                                │
│      │  ◀───────────────────────────────────┤  ValidationReport             │
│      │                                      │                                │
│      │  if blockers: rollback               │                                │
│      │  if warnings: record for SIA         │                                │
│      │  if passed: ready for merge          │                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. UX Testing Agent

### 2.1 Why It's Needed

Current state: No automated UX testing. We test if code works, not if it's usable.

**What's missing:**

| Gap | Risk |
|-----|------|
| No usability testing | Confusing UI ships |
| No first-time user simulation | Onboarding issues missed |
| No performance perception | Slow feels even if fast |
| No accessibility testing | Excludes users with disabilities |
| No mobile testing | Broken on small screens |
| No error experience | Poor error messages |

### 2.2 UX Testing Agent Specification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UX TESTING AGENT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LOCATION: coding-loops/agents/ux_agent.py                                  │
│                                                                              │
│  TECHNOLOGY: Puppeteer MCP (mcp__puppeteer__*)                              │
│                                                                              │
│  TRIGGERS:                                                                   │
│  ├─ Event: build.complete (test new features)                               │
│  ├─ Event: ui.changed (re-test affected flows)                              │
│  └─ Scheduled: Daily full UX audit                                          │
│                                                                              │
│  INPUTS:                                                                     │
│  ├─ User journey definitions                                                │
│  ├─ UI component specifications                                             │
│  ├─ Accessibility requirements                                              │
│  └─ Performance budgets                                                     │
│                                                                              │
│  OUTPUTS:                                                                    │
│  ├─ UXReport                                                                │
│  ├─ Usability scores                                                        │
│  ├─ Accessibility audit                                                     │
│  ├─ Screenshots / recordings                                                │
│  └─ Improvement recommendations                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.3 User Journey Testing

```python
# coding-loops/agents/ux_agent.py

class UXAgent:
    """
    Automated UX testing using Puppeteer MCP.
    """

    def __init__(self):
        self.puppeteer = PuppeteerMCP()
        self.journeys = self.load_journeys()

    async def test_journey(self, journey: UserJourney) -> JourneyResult:
        """
        Execute a user journey and measure usability metrics.

        Example journey: "Create first habit"
        1. Navigate to app
        2. Find 'Create Habit' button
        3. Fill habit form
        4. Submit
        5. Verify habit appears in list

        Measurements:
        - Time to complete each step
        - Number of clicks required
        - Confusion points (hesitation, backtracking)
        - Error encounters
        - Accessibility issues
        """

        metrics = JourneyMetrics()
        issues = []

        # Start fresh browser session
        await self.puppeteer.navigate(journey.start_url)

        for step in journey.steps:
            step_start = time.time()

            # MEASURE: Time to find target element
            find_start = time.time()
            element = await self.find_element(step.target)
            find_time = time.time() - find_start

            if find_time > 3.0:  # Took too long to find
                issues.append(UXIssue(
                    type='findability',
                    severity='medium',
                    step=step.name,
                    message=f'Took {find_time:.1f}s to locate {step.target}',
                    recommendation='Make element more prominent'
                ))

            # MEASURE: Is element visible without scrolling?
            is_visible = await self.is_in_viewport(element)
            if not is_visible:
                issues.append(UXIssue(
                    type='visibility',
                    severity='low',
                    step=step.name,
                    message=f'{step.target} required scrolling',
                    recommendation='Consider placement above fold'
                ))

            # MEASURE: Accessibility of element
            a11y = await self.check_accessibility(element)
            if not a11y.passed:
                issues.extend(a11y.issues)

            # PERFORM: The action
            if step.action == 'click':
                await self.puppeteer.click(element)
            elif step.action == 'fill':
                await self.puppeteer.fill(element, step.value)
            elif step.action == 'select':
                await self.puppeteer.select(element, step.value)

            # MEASURE: Response time after action
            if step.expects_navigation:
                nav_time = await self.measure_navigation()
                if nav_time > 2.0:
                    issues.append(UXIssue(
                        type='performance',
                        severity='medium',
                        step=step.name,
                        message=f'Navigation took {nav_time:.1f}s',
                        recommendation='Optimize page load'
                    ))

            # MEASURE: Step completion time
            step_time = time.time() - step_start
            metrics.step_times[step.name] = step_time

            # Take screenshot for review
            await self.puppeteer.screenshot(f'{journey.name}_{step.name}.png')

        # VERIFY: Journey outcome
        success = await self.verify_outcome(journey.expected_outcome)

        return JourneyResult(
            journey=journey.name,
            success=success,
            total_time=sum(metrics.step_times.values()),
            step_times=metrics.step_times,
            clicks=metrics.click_count,
            issues=issues,
            screenshots=metrics.screenshots
        )
```

### 2.4 First-Time User Simulation

```python
class FirstTimeUserSimulator:
    """
    Simulate a user who has never seen the app before.

    Measures:
    - Can they figure out what to do without instructions?
    - How long before first successful action?
    - What do they click on first?
    - Where do they get stuck?
    """

    async def simulate_first_visit(self, app_url: str) -> FirstTimeReport:

        await self.puppeteer.navigate(app_url)

        observations = []

        # 1. MEASURE: Initial comprehension time
        # How long would a user take to understand the page?
        page_content = await self.get_page_text()
        complexity = self.analyze_complexity(page_content)

        if complexity.word_count > 200:
            observations.append(Observation(
                type='cognitive_load',
                message='Too much text on landing page',
                severity='medium'
            ))

        # 2. MEASURE: Primary action clarity
        # Is the main CTA obvious?
        primary_cta = await self.find_primary_cta()
        if not primary_cta:
            observations.append(Observation(
                type='missing_cta',
                message='No clear primary call-to-action',
                severity='high'
            ))
        elif not await self.is_prominent(primary_cta):
            observations.append(Observation(
                type='weak_cta',
                message='Primary CTA not prominent enough',
                severity='medium'
            ))

        # 3. SIMULATE: Where would a new user click?
        clickable = await self.get_all_clickable()
        predicted_first_click = self.predict_first_click(clickable)

        if predicted_first_click != primary_cta:
            observations.append(Observation(
                type='attention_misdirection',
                message=f'User likely to click {predicted_first_click} instead of CTA',
                severity='medium'
            ))

        # 4. MEASURE: Time to first success
        # Navigate the most common first journey
        time_to_success = await self.attempt_primary_journey()

        if time_to_success > 60:  # More than 1 minute
            observations.append(Observation(
                type='onboarding_friction',
                message=f'First success takes {time_to_success}s',
                severity='high'
            ))

        # 5. CHECK: Error handling experience
        error_experience = await self.test_error_paths()

        for error in error_experience.errors:
            if not error.has_clear_message:
                observations.append(Observation(
                    type='poor_error_handling',
                    message=f'Error "{error.trigger}" shows unclear message',
                    severity='medium'
                ))

        return FirstTimeReport(
            comprehension_score=complexity.score,
            time_to_first_success=time_to_success,
            observations=observations,
            recommended_improvements=self.generate_recommendations(observations)
        )
```

### 2.5 Usability Heuristics Evaluation

```python
class HeuristicEvaluator:
    """
    Evaluate against Nielsen's 10 Usability Heuristics.
    """

    HEURISTICS = {

        'visibility_of_system_status': {
            'description': 'System should keep users informed',
            'checks': [
                'Loading indicators present during async operations',
                'Success/error feedback after actions',
                'Current state is clearly visible'
            ]
        },

        'match_between_system_and_real_world': {
            'description': 'Use familiar language and concepts',
            'checks': [
                'Labels use common words',
                'Icons are recognizable',
                'Metaphors are appropriate'
            ]
        },

        'user_control_and_freedom': {
            'description': 'Easy to undo/redo, clear exits',
            'checks': [
                'Cancel buttons on modals',
                'Undo available for destructive actions',
                'Clear navigation back'
            ]
        },

        'consistency_and_standards': {
            'description': 'Follow conventions',
            'checks': [
                'Buttons look like buttons',
                'Links are distinguishable',
                'Similar actions have similar UI'
            ]
        },

        'error_prevention': {
            'description': 'Prevent errors before they occur',
            'checks': [
                'Confirmation for destructive actions',
                'Input validation before submission',
                'Disabled states for invalid actions'
            ]
        },

        'recognition_rather_than_recall': {
            'description': 'Make info visible, reduce memory load',
            'checks': [
                'Options visible, not hidden',
                'Context provided where needed',
                'Recent items easily accessible'
            ]
        },

        'flexibility_and_efficiency': {
            'description': 'Cater to both novice and expert',
            'checks': [
                'Keyboard shortcuts available',
                'Common actions easily accessible',
                'Advanced features available but not cluttering'
            ]
        },

        'aesthetic_and_minimalist_design': {
            'description': 'No unnecessary information',
            'checks': [
                'No competing visual elements',
                'White space used effectively',
                'Content is focused'
            ]
        },

        'help_users_recognize_recover_from_errors': {
            'description': 'Clear error messages with solutions',
            'checks': [
                'Error messages explain what went wrong',
                'Error messages suggest how to fix',
                'Errors are visually distinct'
            ]
        },

        'help_and_documentation': {
            'description': 'Provide help when needed',
            'checks': [
                'Help is searchable',
                'Contextual help available',
                'Common tasks documented'
            ]
        }
    }

    async def evaluate(self, url: str) -> HeuristicReport:
        """
        Evaluate a page against all 10 heuristics.
        """

        await self.puppeteer.navigate(url)

        scores = {}
        issues = []

        for heuristic_id, heuristic in self.HEURISTICS.items():
            score, heuristic_issues = await self.evaluate_heuristic(
                heuristic_id,
                heuristic
            )
            scores[heuristic_id] = score
            issues.extend(heuristic_issues)

        return HeuristicReport(
            overall_score=sum(scores.values()) / len(scores),
            heuristic_scores=scores,
            issues=issues,
            recommendations=self.prioritize_recommendations(issues)
        )
```

### 2.6 Accessibility Testing

```python
class AccessibilityTester:
    """
    WCAG 2.1 Level AA compliance testing.
    """

    async def audit(self, url: str) -> AccessibilityReport:

        await self.puppeteer.navigate(url)

        issues = []

        # 1. COLOR CONTRAST
        contrast_issues = await self.check_color_contrast()
        # Text must have 4.5:1 contrast ratio

        # 2. KEYBOARD NAVIGATION
        keyboard_issues = await self.test_keyboard_navigation()
        # All interactive elements must be keyboard accessible

        # 3. SCREEN READER
        screen_reader_issues = await self.test_screen_reader()
        # All content must be readable by screen readers
        # Images need alt text, forms need labels

        # 4. FOCUS INDICATORS
        focus_issues = await self.test_focus_visibility()
        # Focus state must be visible

        # 5. ARIA ROLES
        aria_issues = await self.check_aria_roles()
        # Dynamic content needs appropriate ARIA

        # 6. HEADING STRUCTURE
        heading_issues = await self.check_heading_structure()
        # Headings should be hierarchical (h1 > h2 > h3)

        # 7. FORM LABELS
        form_issues = await self.check_form_labels()
        # All inputs need associated labels

        issues.extend(contrast_issues)
        issues.extend(keyboard_issues)
        issues.extend(screen_reader_issues)
        issues.extend(focus_issues)
        issues.extend(aria_issues)
        issues.extend(heading_issues)
        issues.extend(form_issues)

        # Calculate WCAG level
        critical = [i for i in issues if i.wcag_level == 'A']
        warnings = [i for i in issues if i.wcag_level == 'AA']

        level_achieved = 'AAA'
        if critical:
            level_achieved = 'Fail'
        elif warnings:
            level_achieved = 'A'

        return AccessibilityReport(
            level_achieved=level_achieved,
            issues=issues,
            critical_count=len(critical),
            warning_count=len(warnings),
            recommendations=self.generate_fixes(issues)
        )
```

### 2.7 UX Report

```python
@dataclass
class UXReport:
    """
    Comprehensive UX testing report.
    """

    # Overall scores (0-100)
    usability_score: float
    accessibility_score: float
    performance_perception_score: float
    first_time_user_score: float

    # Journey results
    journey_results: List[JourneyResult]

    # Heuristic evaluation
    heuristic_report: HeuristicReport

    # Accessibility audit
    accessibility_report: AccessibilityReport

    # First-time user simulation
    first_time_report: FirstTimeReport

    # Performance perception
    # (not just fast, but FEELS fast)
    perceived_performance: PerceivedPerformance

    # Issues by severity
    critical_issues: List[UXIssue]  # Must fix
    major_issues: List[UXIssue]     # Should fix
    minor_issues: List[UXIssue]     # Nice to fix

    # Recommendations prioritized by impact
    recommendations: List[Recommendation]

    # Screenshots and recordings
    artifacts: List[str]

    # Comparison with previous run
    delta: Optional[UXDelta]
    # { usability: +5, accessibility: -2, new_issues: [...] }
```

### 2.8 Integration with Build Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    BUILD + VALIDATION + UX FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BUILD AGENT ────▶ VALIDATION AGENT ────▶ UX AGENT ────▶ MERGE              │
│       │                  │                    │              │               │
│       │                  │                    │              │               │
│   Executes           Validates            Tests UX       If all pass        │
│   code tasks         correctness          with users                        │
│                                                                              │
│                                                                              │
│  BLOCKING CONDITIONS:                                                        │
│  ├─ Validation: Any critical security issue                                │
│  ├─ Validation: Test coverage < 80%                                        │
│  ├─ UX: Accessibility level < A                                            │
│  ├─ UX: Critical usability issues                                          │
│  └─ UX: First-time user success rate < 70%                                 │
│                                                                              │
│  NON-BLOCKING (recorded for SIA):                                           │
│  ├─ UX: Minor usability issues                                             │
│  ├─ UX: Performance perception < threshold                                 │
│  └─ Validation: Warnings                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Agent Relationship Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPLETE AGENT ECOSYSTEM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                           ┌──────────────┐                                  │
│                           │     USER     │                                  │
│                           └──────┬───────┘                                  │
│                                  │                                          │
│                                  ▼                                          │
│                           ┌──────────────┐                                  │
│                           │   IDEATION   │                                  │
│                           │    AGENT     │                                  │
│                           └──────┬───────┘                                  │
│                                  │                                          │
│                                  ▼                                          │
│                           ┌──────────────┐                                  │
│                           │    SPEC      │                                  │
│                           │    AGENT     │                                  │
│                           └──────┬───────┘                                  │
│                                  │                                          │
│                                  ▼                                          │
│                           ┌──────────────┐                                  │
│                           │    BUILD     │                                  │
│                           │    AGENT     │                                  │
│                           └──────┬───────┘                                  │
│                                  │                                          │
│              ┌───────────────────┼───────────────────┐                      │
│              ▼                   ▼                   ▼                      │
│       ┌──────────────┐   ┌──────────────┐   ┌──────────────┐               │
│       │  VALIDATION  │   │     UX       │   │   MONITOR    │               │
│       │    AGENT     │   │    AGENT     │   │    AGENT     │               │
│       │              │   │ (Puppeteer)  │   │              │               │
│       │ • Tests      │   │ • Usability  │   │ • Health     │               │
│       │ • Security   │   │ • A11y       │   │ • Stuck      │               │
│       │ • Coverage   │   │ • Journeys   │   │ • Deadlocks  │               │
│       └──────┬───────┘   └──────┬───────┘   └──────┬───────┘               │
│              │                   │                   │                      │
│              └───────────────────┼───────────────────┘                      │
│                                  │                                          │
│                                  ▼                                          │
│                           ┌──────────────┐                                  │
│                           │      PM      │                                  │
│                           │    AGENT     │                                  │
│                           │              │                                  │
│                           │ • Conflicts  │                                  │
│                           │ • Decisions  │                                  │
│                           │ • Escalation │                                  │
│                           └──────┬───────┘                                  │
│                                  │                                          │
│                                  ▼                                          │
│                           ┌──────────────┐                                  │
│                           │     SIA      │                                  │
│                           │    AGENT     │                                  │
│                           │              │                                  │
│                           │ • Learning   │                                  │
│                           │ • Gotchas    │                                  │
│                           │ • Patterns   │                                  │
│                           │ • Improve    │                                  │
│                           └──────────────┘                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

*See SELF-BUILDING-BOOTSTRAP.md for how this system builds itself.*
