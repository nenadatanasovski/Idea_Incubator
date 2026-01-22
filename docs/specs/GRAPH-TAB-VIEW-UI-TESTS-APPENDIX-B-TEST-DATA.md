# Graph Tab View UI Tests - Appendix B: Test Data Templates

> **Parent Document**: [GRAPH-TAB-VIEW-UI-TESTS.md](GRAPH-TAB-VIEW-UI-TESTS.md)
> **Purpose**: Sample test data for UI testing scenarios

---

## Sample Blocks for Testing

```json
{
  "blocks": [
    {
      "id": "block_001",
      "type": "content",
      "content": "Legal tech market is $50B",
      "confidence": 0.85
    },
    {
      "id": "block_002",
      "type": "assumption",
      "content": "Lawyers want AI tools",
      "criticality": "critical"
    },
    {
      "id": "block_003",
      "type": "derived",
      "content": "SAM is $5B",
      "formula": "TAM * 0.1"
    },
    {
      "id": "block_004",
      "type": "action",
      "content": "Validate market size",
      "progress": 0.8
    },
    {
      "id": "block_005",
      "type": "external",
      "content": "Gartner Report 2026",
      "url": "https://example.com"
    }
  ]
}
```

---

## Sample Links for Testing

```json
{
  "links": [
    { "source": "block_001", "target": "block_003", "type": "derived_from" },
    { "source": "block_002", "target": "block_001", "type": "evidence_for" },
    { "source": "block_004", "target": "block_001", "type": "validates_claim" }
  ]
}
```

---

**Document Version**: 1.0
**Created**: 2026-01-23
**Parent**: [GRAPH-TAB-VIEW-UI-TESTS.md](GRAPH-TAB-VIEW-UI-TESTS.md)
