# Lifecycle Stages

> **AUTHORITATIVE**: This file defines all valid lifecycle stages for ideas.

## Stage Definitions

| Stage         | Code        | Description                            | Typical Duration |
| ------------- | ----------- | -------------------------------------- | ---------------- |
| **Spark**     | `SPARK`     | Initial raw capture, unrefined thought | Hours to days    |
| **Clarify**   | `CLARIFY`   | Define problem/opportunity clearly     | Days to week     |
| **Research**  | `RESEARCH`  | Gather information, prior art, context | Week to month    |
| **Ideate**    | `IDEATE`    | Brainstorm approaches and solutions    | Days to week     |
| **Evaluate**  | `EVALUATE`  | Score against criteria matrix          | Hours to days    |
| **Validate**  | `VALIDATE`  | Test core assumptions                  | Week to month    |
| **Design**    | `DESIGN`    | Architecture and detailed planning     | Week to months   |
| **Prototype** | `PROTOTYPE` | Build minimum viable version           | Week to months   |
| **Test**      | `TEST`      | User testing and feedback              | Week to month    |
| **Refine**    | `REFINE`    | Iterate based on learnings             | Ongoing          |
| **Build**     | `BUILD`     | Full implementation                    | Months           |
| **Launch**    | `LAUNCH`    | Release to target audience             | Week to month    |
| **Grow**      | `GROW`      | Scale and optimize                     | Ongoing          |
| **Maintain**  | `MAINTAIN`  | Ongoing operation                      | Ongoing          |
| **Pivot**     | `PIVOT`     | Major direction change                 | Variable         |
| **Pause**     | `PAUSE`     | Intentionally on hold                  | Variable         |
| **Sunset**    | `SUNSET`    | Winding down                           | Months           |
| **Archive**   | `ARCHIVE`   | Historical reference only              | Permanent        |
| **Abandoned** | `ABANDONED` | Decided not to pursue                  | Permanent        |

## Stage Transitions

```
SPARK → CLARIFY → RESEARCH → IDEATE → EVALUATE → VALIDATE
                                                     ↓
                                    DESIGN ← (feedback loop)
                                       ↓
                                 PROTOTYPE → TEST → REFINE
                                                      ↓
                                    BUILD ← (feedback loop)
                                       ↓
                                   LAUNCH → GROW → MAINTAIN
                                                      ↓
                                              SUNSET → ARCHIVE

Any stage can transition to:
- PAUSE (on hold)
- PIVOT (major change, returns to CLARIFY)
- ABANDONED (stopped pursuing)
```

## Stage Requirements

### Entry Requirements

| Stage     | Required Before Entry         |
| --------- | ----------------------------- |
| CLARIFY   | Problem statement captured    |
| RESEARCH  | Problem defined               |
| IDEATE    | Background research complete  |
| EVALUATE  | Multiple solution ideas exist |
| VALIDATE  | Evaluation score > 6.0        |
| DESIGN    | Core assumptions validated    |
| PROTOTYPE | Design document complete      |
| TEST      | Working prototype exists      |
| BUILD     | User testing complete         |
| LAUNCH    | Build complete and tested     |
| GROW      | Successful launch             |
| MAINTAIN  | Growth phase stable           |

### Stage Indicators

Each stage should update the idea's frontmatter:

```yaml
stage: EVALUATE
stage_entered: 2025-12-21
stage_notes: "Ready for AI evaluation"
```
