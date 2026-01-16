# Evaluation Criteria

> **AUTHORITATIVE**: This file is the single source of truth for all 30 evaluation criteria.
> All code must import criteria definitions from this file or its parsed equivalent.

## Categories

### Problem/Opportunity Quality (5 criteria)

| ID  | Criterion           | Question                               | Score Guide                           |
| --- | ------------------- | -------------------------------------- | ------------------------------------- |
| P1  | Problem Clarity     | Is the problem well-defined?           | 10=Crystal clear, 1=Vague             |
| P2  | Problem Severity    | How painful is the problem?            | 10=Unbearable, 1=Trivial              |
| P3  | Target User Clarity | Who specifically is affected?          | 10=Precise persona, 1=Everyone        |
| P4  | Problem Validation  | Has it been validated with real users? | 10=Extensive validation, 1=Assumption |
| P5  | Problem Uniqueness  | Is this a novel problem?               | 10=Unaddressed, 1=Saturated solutions |

### Solution Quality (5 criteria)

| ID  | Criterion              | Question                               | Score Guide                       |
| --- | ---------------------- | -------------------------------------- | --------------------------------- |
| S1  | Solution Clarity       | Is the solution well-articulated?      | 10=Detailed spec, 1=Vague concept |
| S2  | Solution Feasibility   | Can it actually be built?              | 10=Proven tech, 1=Sci-fi          |
| S3  | Solution Uniqueness    | How differentiated from alternatives?  | 10=First of kind, 1=Me-too        |
| S4  | Solution Scalability   | Can it grow without proportional cost? | 10=Infinite scale, 1=Linear cost  |
| S5  | Solution Defensibility | Can it be protected?                   | 10=Strong moat, 1=Easily copied   |

### Feasibility (5 criteria)

| ID  | Criterion             | Question                      | Score Guide                 |
| --- | --------------------- | ----------------------------- | --------------------------- |
| F1  | Technical Complexity  | How hard to build?            | 10=Trivial, 1=Impossible    |
| F2  | Resource Requirements | Cost in time/money/people     | 10=Minimal, 1=Massive       |
| F3  | Skill Availability    | Do I have needed skills?      | 10=Expert, 1=No clue        |
| F4  | Time to Value         | How long until first results? | 10=Days, 1=Years            |
| F5  | Dependency Risk       | Reliance on external factors  | 10=Independent, 1=Dependent |

### Strategic Fit (5 criteria)

| ID  | Criterion         | Question              | Score Guide                         |
| --- | ----------------- | --------------------- | ----------------------------------- |
| FT1 | Personal Fit      | Fits with goals?      | 10=Perfect alignment, 1=Conflict    |
| FT2 | Passion Alignment | How excited am I?     | 10=Obsessed, 1=Indifferent          |
| FT3 | Skill Match       | Leverages my skills?  | 10=Core strength, 1=Weakness        |
| FT4 | Network Leverage  | Can I use my network? | 10=Strong connections, 1=Cold start |
| FT5 | Life Stage Fit    | Right moment?         | 10=Perfect timing, 1=Wrong phase    |

### Market/External Factors (5 criteria)

| ID  | Criterion             | Question                 | Score Guide                         |
| --- | --------------------- | ------------------------ | ----------------------------------- |
| M1  | Market Size           | Total addressable market | 10=Huge TAM, 1=Tiny niche           |
| M2  | Market Growth         | Is the market expanding? | 10=Explosive, 1=Declining           |
| M3  | Competition Intensity | How crowded?             | 10=Blue ocean, 1=Red ocean          |
| M4  | Entry Barriers        | Barriers to entry        | 10=Easy entry, 1=Fortress           |
| M5  | Timing                | Is the market ready?     | 10=Perfect moment, 1=Too early/late |

### Risk Assessment (5 criteria)

| ID  | Criterion       | Question                     | Score Guide                      |
| --- | --------------- | ---------------------------- | -------------------------------- |
| R1  | Execution Risk  | Risk of failing to build     | 10=Low risk, 1=High risk         |
| R2  | Market Risk     | Risk of no market            | 10=Proven demand, 1=Unproven     |
| R3  | Technical Risk  | Risk of technical failure    | 10=Proven tech, 1=Bleeding edge  |
| R4  | Financial Risk  | Risk of running out of money | 10=Self-funded, 1=Burn rate      |
| R5  | Regulatory Risk | Legal/compliance concerns    | 10=Clear path, 1=Legal minefield |

## Composite Score Calculation

```
Category Weights:
- Problem:     20%
- Solution:    20%
- Feasibility: 15%
- Fit:         15%
- Market:      15%
- Risk:        15%

Overall Score = (
  Problem Score × 0.20 +
  Solution Score × 0.20 +
  Feasibility Score × 0.15 +
  Fit Score × 0.15 +
  Market Score × 0.15 +
  Risk Score × 0.15
)
```

## Confidence Calculation

```
Confidence = (
  (challenges_defended / total_challenges) × 0.4 +
  (first_principles_bonuses / total_exchanges) × 0.2 +
  (1 - score_volatility) × 0.2 +
  information_completeness × 0.2
)
```

## Score Interpretation

| Score Range | Interpretation | Recommendation           |
| ----------- | -------------- | ------------------------ |
| 8.0 - 10.0  | Excellent      | PURSUE aggressively      |
| 7.0 - 7.9   | Strong         | PURSUE with focus        |
| 6.0 - 6.9   | Promising      | REFINE before proceeding |
| 5.0 - 5.9   | Uncertain      | REFINE significantly     |
| 4.0 - 4.9   | Weak           | PAUSE and reconsider     |
| 1.0 - 3.9   | Poor           | ABANDON or pivot         |
