# Graph Tab View UI Tests - Appendix A: SQL Validation Queries

> **Parent Document**: [GRAPH-TAB-VIEW-UI-TESTS.md](GRAPH-TAB-VIEW-UI-TESTS.md)
> **Purpose**: SQL validation queries for stress test scenarios

---

## Table of Contents

1. [Input Complexity Scenarios (1-4, 16, 21, 23)](#input-complexity-scenarios-1-4-16-21-23)
2. [Meta & Subjective Scenarios (5-6, 12-13, 17, 20, 24-25)](#meta--subjective-scenarios-5-6-12-13-17-20-24-25)
3. [Relationship Nuance Scenarios (7, 10-11, 18, 22)](#relationship-nuance-scenarios-7-10-11-18-22)
4. [Temporal & Evolution Scenarios (8-9, 19, 26)](#temporal--evolution-scenarios-8-9-19-26)
5. [Scale & Aggregation Scenarios (14-15, 27)](#scale--aggregation-scenarios-14-15-27)

---

## Input Complexity Scenarios (1-4, 16, 21, 23)

### S.1.1: Compound Statement Extraction Display

```sql
-- Verify 5+ blocks created from this message
SELECT COUNT(*) as block_count,
       GROUP_CONCAT(DISTINCT type) as block_types
FROM memory_blocks
WHERE session_id = :session_id
  AND extracted_from_message_id = :message_id;
-- Expected: block_count >= 5

-- Verify graph memberships
SELECT mb.id, mb.content, mgm.graph_type
FROM memory_blocks mb
JOIN memory_graph_memberships mgm ON mb.id = mgm.block_id
WHERE mb.session_id = :session_id
  AND mb.extracted_from_message_id = :message_id;
-- Expected: rows with graph_type IN ('solution', 'market', 'risk')
```

### S.2.1: Contradiction Handling - Supersedes Display

```sql
-- Verify supersedes link exists
SELECT ml.id, ml.link_type,
       src.content as source_content, src.status as source_status,
       tgt.content as target_content, tgt.status as target_status
FROM memory_links ml
JOIN memory_blocks src ON ml.source_block_id = src.id
JOIN memory_blocks tgt ON ml.target_block_id = tgt.id
WHERE ml.session_id = :session_id
  AND ml.link_type = 'supersedes';
-- Expected: 1 row where source_content LIKE '%SMB%'
--           AND target_status = 'superseded'

-- Verify old block status updated
SELECT id, content, status
FROM memory_blocks
WHERE session_id = :session_id
  AND content LIKE '%Enterprise%'
  AND status = 'superseded';
-- Expected: 1 row
```

### S.2.2: Superseded Node Inspector

```sql
-- Get superseding block info for inspector display
SELECT tgt.id as superseded_id, tgt.content as superseded_content,
       src.id as superseding_id, src.content as superseding_content,
       ml.reason
FROM memory_links ml
JOIN memory_blocks src ON ml.source_block_id = src.id
JOIN memory_blocks tgt ON ml.target_block_id = tgt.id
WHERE tgt.id = :selected_block_id
  AND ml.link_type = 'supersedes';
-- Expected: 1 row with superseding block details
```

### S.3.1: Refinement vs Replacement Confirmation

```sql
-- Pre-test: Verify original block exists
SELECT id, content, status
FROM memory_blocks
WHERE session_id = :session_id
  AND content LIKE '%Research takes too long%';
-- Expected: 1 row with status = 'active'
```

### S.3.2: Refines Link Display

```sql
-- Verify refines link and both blocks active
SELECT ml.link_type,
       src.status as new_block_status,
       tgt.status as old_block_status
FROM memory_links ml
JOIN memory_blocks src ON ml.source_block_id = src.id
JOIN memory_blocks tgt ON ml.target_block_id = tgt.id
WHERE ml.session_id = :session_id
  AND ml.link_type = 'refines';
-- Expected: 1 row where new_block_status = 'active'
--           AND old_block_status = 'active'
```

### S.3.3: Replaces Link Display

```sql
-- Verify replaces link and old block abandoned
SELECT ml.link_type,
       src.status as new_block_status,
       tgt.status as old_block_status
FROM memory_links ml
JOIN memory_blocks src ON ml.source_block_id = src.id
JOIN memory_blocks tgt ON ml.target_block_id = tgt.id
WHERE ml.session_id = :session_id
  AND ml.link_type = 'replaces';
-- Expected: 1 row where new_block_status = 'active'
--           AND old_block_status = 'abandoned'
```

### S.4.1: Hypothetical Block Indicator

```sql
-- Verify hypothetical block properties
SELECT id, content,
       json_extract(properties, '$.hypothetical') as hypothetical,
       json_extract(properties, '$.condition') as condition,
       status
FROM memory_blocks
WHERE session_id = :session_id
  AND json_extract(properties, '$.hypothetical') = true;
-- Expected: 1 row where hypothetical = true
--           AND condition LIKE '%ML expertise%'
--           AND status = 'potential'
```

### S.16.1: Decision Block Display

```sql
-- Verify decision and option blocks exist
SELECT d.id as decision_id, d.content as decision_content,
       o.id as option_id, o.content as option_content,
       json_extract(o.properties, '$.selection_status') as selection_status
FROM memory_blocks d
JOIN memory_links ml ON d.id = ml.source_block_id OR d.id = ml.target_block_id
JOIN memory_blocks o ON (ml.source_block_id = o.id OR ml.target_block_id = o.id) AND o.id != d.id
WHERE d.session_id = :session_id
  AND d.type = 'decision'
  AND o.type = 'option';
-- Expected: 3+ rows (decision with options)

-- Verify alternative_to links between options
SELECT COUNT(*) as alt_link_count
FROM memory_links
WHERE session_id = :session_id
  AND link_type = 'alternative_to';
-- Expected: count >= 2 (n-1 links for n options)
```

### S.16.2: Option Selection Status

```sql
-- Verify selection status distribution
SELECT json_extract(properties, '$.selection_status') as status,
       COUNT(*) as count
FROM memory_blocks
WHERE session_id = :session_id
  AND type = 'option'
  AND json_extract(properties, '$.decision') = :decision_block_id
GROUP BY json_extract(properties, '$.selection_status');
-- Expected: 1 row with status='selected', 2+ rows with status IN ('rejected', 'exploring')

-- Verify decision block updated with decided_option
SELECT id, json_extract(properties, '$.decided_option') as decided_option
FROM memory_blocks
WHERE id = :decision_block_id;
-- Expected: decided_option IS NOT NULL
```

### S.21.1: Assumption Surfacing

```sql
-- Verify assumption block with AI surfacing
SELECT mb.id, mb.content, mb.type,
       json_extract(mb.properties, '$.surfaced_by') as surfaced_by,
       json_extract(mb.properties, '$.criticality') as criticality,
       json_extract(mb.properties, '$.assumption_status') as assumption_status,
       ml.source_block_id as implied_by_block
FROM memory_blocks mb
LEFT JOIN memory_links ml ON mb.id = ml.target_block_id AND ml.link_type = 'implied_by'
WHERE mb.session_id = :session_id
  AND mb.type = 'assumption'
  AND json_extract(mb.properties, '$.surfaced_by') = 'ai';
-- Expected: 1+ rows with surfaced_by = 'ai'
--           AND criticality IN ('critical', 'important', 'minor')
--           AND implied_by_block IS NOT NULL
```

### S.21.2: Assumption Validation Flow

```sql
-- Verify assumption validated with method and timestamp
SELECT id, content,
       json_extract(properties, '$.assumption_status') as status,
       json_extract(properties, '$.validation_method') as method,
       json_extract(properties, '$.validated_at') as validated_at,
       json_extract(properties, '$.validated_by') as validated_by
FROM memory_blocks
WHERE id = :assumption_block_id;
-- Expected: status = 'validated'
--           AND method IS NOT NULL
--           AND validated_at IS NOT NULL
```

### S.23.1: Placeholder Block Display

```sql
-- Verify placeholder block properties
SELECT id, content, type,
       json_extract(properties, '$.placeholder_for') as placeholder_for,
       json_extract(properties, '$.research_query') as research_query,
       json_extract(properties, '$.existence_confirmed') as existence_confirmed,
       json_extract(properties, '$.details_unknown') as details_unknown
FROM memory_blocks
WHERE session_id = :session_id
  AND type = 'placeholder';
-- Expected: 1 row where placeholder_for IS NOT NULL
--           AND details_unknown = true
```

### S.23.2: Placeholder Research Action

```sql
-- Verify action block created for research
SELECT a.id, a.content, a.type,
       json_extract(a.properties, '$.action_type') as action_type,
       ml.target_block_id as researches_block
FROM memory_blocks a
JOIN memory_links ml ON a.id = ml.source_block_id
WHERE a.session_id = :session_id
  AND a.type = 'action'
  AND json_extract(a.properties, '$.action_type') = 'research'
  AND ml.target_block_id = :placeholder_block_id;
-- Expected: 1 row linking action to placeholder
```

---

## Meta & Subjective Scenarios (5-6, 12-13, 17, 20, 24-25)

### S.5.1: Meta Block Display

```sql
-- Verify meta block with about reference
SELECT mb.id, mb.content, mb.type,
       json_extract(mb.properties, '$.meta_type') as meta_type,
       json_extract(mb.properties, '$.about') as about_block_id,
       ref.content as referenced_block_content
FROM memory_blocks mb
LEFT JOIN memory_blocks ref ON json_extract(mb.properties, '$.about') = ref.id
WHERE mb.session_id = :session_id
  AND mb.type = 'meta';
-- Expected: 1+ rows where meta_type IN ('uncertainty', 'research_needed', 'assessment', 'question', 'commitment')
--           AND about_block_id IS NOT NULL

-- Verify about link exists
SELECT COUNT(*) as about_links
FROM memory_links
WHERE session_id = :session_id
  AND link_type = 'about';
-- Expected: count >= 1
```

### S.5.2: Meta Block Inspector

```sql
-- Get meta block details for inspector
SELECT mb.id, mb.content,
       json_extract(mb.properties, '$.meta_type') as meta_type,
       json_extract(mb.properties, '$.about') as about_block_id,
       json_extract(mb.properties, '$.resolved') as resolved,
       ref.content as about_content
FROM memory_blocks mb
LEFT JOIN memory_blocks ref ON json_extract(mb.properties, '$.about') = ref.id
WHERE mb.id = :selected_block_id;
-- Expected: 1 row with all fields populated
```

### S.6.1: Question Block Display

```sql
-- Verify question/exploring block
SELECT id, content, status,
       json_extract(properties, '$.exploring') as exploring,
       json_extract(properties, '$.considering') as considering,
       json_extract(properties, '$.current') as current_value
FROM memory_blocks
WHERE session_id = :session_id
  AND (status = 'question'
       OR json_extract(properties, '$.exploring') IS NOT NULL
       OR json_extract(properties, '$.considering') IS NOT NULL);
-- Expected: 1 row with exploring or considering value set
```

### S.12.1: Source Attribution Display

```sql
-- Verify source attribution properties
SELECT id, content,
       json_extract(properties, '$.source_type') as source_type,
       json_extract(properties, '$.source_name') as source_name,
       json_extract(properties, '$.source_date') as source_date,
       json_extract(properties, '$.verifiable') as verifiable,
       confidence
FROM memory_blocks
WHERE id = :selected_block_id;
-- Expected: source_type IN ('research_firm', 'primary_research', 'expert', 'anecdote', 'assumption', 'unknown')
--           AND source_name IS NOT NULL for research_firm
```

### S.12.2: Source Credibility Mapping

```sql
-- Compare confidence by source type
SELECT json_extract(properties, '$.source_type') as source_type,
       AVG(confidence) as avg_confidence,
       COUNT(*) as block_count
FROM memory_blocks
WHERE session_id = :session_id
  AND json_extract(properties, '$.source_type') IS NOT NULL
GROUP BY json_extract(properties, '$.source_type')
ORDER BY avg_confidence DESC;
-- Expected: research_firm > expert > primary_research > anecdote > assumption
```

### S.13.1: Objectivity Indicator

```sql
-- Verify objectivity property values
SELECT id, content,
       json_extract(properties, '$.objectivity') as objectivity
FROM memory_blocks
WHERE session_id = :session_id
  AND json_extract(properties, '$.objectivity') IS NOT NULL;
-- Expected: rows with objectivity IN ('objective', 'subjective', 'mixed')
```

### S.17.1: Range Property Display

```sql
-- Verify range properties exist
SELECT id, content,
       json_extract(properties, '$.market_size_min') as min_val,
       json_extract(properties, '$.market_size_max') as max_val,
       json_extract(properties, '$.market_size_estimate') as estimate
FROM memory_blocks
WHERE session_id = :session_id
  AND json_extract(properties, '$.market_size_min') IS NOT NULL
  AND json_extract(properties, '$.market_size_max') IS NOT NULL;
-- Expected: 1 row with min_val = 30000000000, max_val = 70000000000
```

### S.17.2: High Uncertainty Warning

```sql
-- Find blocks with high uncertainty (max/min > 3)
SELECT id, content,
       json_extract(properties, '$.market_size_min') as min_val,
       json_extract(properties, '$.market_size_max') as max_val,
       CAST(json_extract(properties, '$.market_size_max') AS REAL) /
       CAST(json_extract(properties, '$.market_size_min') AS REAL) as ratio
FROM memory_blocks
WHERE session_id = :session_id
  AND json_extract(properties, '$.market_size_min') IS NOT NULL
  AND json_extract(properties, '$.market_size_max') IS NOT NULL
  AND CAST(json_extract(properties, '$.market_size_max') AS REAL) /
      CAST(json_extract(properties, '$.market_size_min') AS REAL) > 3;
-- Expected: 1+ rows with ratio > 3
```

### S.20.1: Evidence Chain Traversal

```sql
-- Traverse evidence chain from claim to sources
WITH RECURSIVE evidence_chain AS (
  -- Start with the selected block
  SELECT mb.id, mb.content, mb.confidence, 0 as depth
  FROM memory_blocks mb
  WHERE mb.id = :selected_block_id

  UNION ALL

  -- Recursively find evidence sources
  SELECT src.id, src.content, src.confidence, ec.depth + 1
  FROM evidence_chain ec
  JOIN memory_links ml ON ml.target_block_id = ec.id
  JOIN memory_blocks src ON ml.source_block_id = src.id
  WHERE ml.link_type = 'evidence_for'
    AND ec.depth < 10  -- Prevent infinite loops
)
SELECT * FROM evidence_chain ORDER BY depth;
-- Expected: 2+ rows showing evidence chain depth
```

### S.20.2: Derived Confidence Display

```sql
-- Get evidence chain with strength multipliers
SELECT ml.id as link_id,
       src.id as source_id, src.content as source_content, src.confidence as source_confidence,
       tgt.id as target_id, tgt.content as target_content,
       json_extract(tgt.properties, '$.derived_confidence') as derived_confidence,
       ml.confidence as link_confidence,
       json_extract(ml.reason, '$.evidence_strength') as evidence_strength
FROM memory_links ml
JOIN memory_blocks src ON ml.source_block_id = src.id
JOIN memory_blocks tgt ON ml.target_block_id = tgt.id
WHERE ml.link_type = 'evidence_for'
  AND ml.session_id = :session_id;
-- Expected: rows with evidence_strength IN ('strong', 'moderate', 'weak')
--           AND derived_confidence calculated from chain
```

### S.20.3: Source Invalidation Warning

```sql
-- Find blocks with invalidated sources in their evidence chain
SELECT mb.id, mb.content,
       json_extract(mb.properties, '$.evidence_status') as evidence_status,
       src.id as source_id, src.status as source_status
FROM memory_blocks mb
JOIN memory_links ml ON ml.target_block_id = mb.id AND ml.link_type = 'evidence_for'
JOIN memory_blocks src ON ml.source_block_id = src.id
WHERE mb.session_id = :session_id
  AND src.status IN ('superseded', 'abandoned', 'invalidated');
-- Expected: rows where evidence_status = 'source_invalidated'
```

### S.24.1: Stakeholder View Display

```sql
-- Get stakeholder view blocks with topic grouping
SELECT mb.id, mb.content, mb.type,
       json_extract(mb.properties, '$.stakeholder') as stakeholder,
       json_extract(mb.properties, '$.stakeholder_role') as role,
       json_extract(mb.properties, '$.view_status') as view_status,
       json_extract(mb.properties, '$.topic') as topic
FROM memory_blocks mb
WHERE mb.session_id = :session_id
  AND mb.type = 'stakeholder_view';
-- Expected: 2+ rows with different stakeholders
--           AND role IN ('decision_maker', 'domain_expert', 'advisor', 'team_member')
```

### S.24.2: Stakeholder Conflict Resolution

```sql
-- Get all views for a topic with resolution status
SELECT sv.id, sv.content,
       json_extract(sv.properties, '$.stakeholder') as stakeholder,
       json_extract(sv.properties, '$.view_status') as status,
       json_extract(sv.properties, '$.incorporated_into') as incorporated_into,
       json_extract(sv.properties, '$.overruled_reason') as overruled_reason
FROM memory_blocks sv
WHERE sv.session_id = :session_id
  AND sv.type = 'stakeholder_view'
  AND json_extract(sv.properties, '$.topic') = :topic_block_id;
-- Expected: status distribution showing resolution

-- Count by status
SELECT json_extract(properties, '$.view_status') as status, COUNT(*) as count
FROM memory_blocks
WHERE session_id = :session_id
  AND type = 'stakeholder_view'
GROUP BY json_extract(properties, '$.view_status');
-- Expected: rows for 'active', 'adopted', 'overruled', 'withdrawn'
```

### S.24.3: View Resolution Display

```sql
-- Get overruled view with resolution details
SELECT sv.id, sv.content,
       json_extract(sv.properties, '$.view_status') as status,
       json_extract(sv.properties, '$.overruled_reason') as reason,
       json_extract(sv.properties, '$.incorporated_into') as incorporated_into,
       adopted.content as adopted_view_content
FROM memory_blocks sv
LEFT JOIN memory_blocks adopted ON json_extract(sv.properties, '$.incorporated_into') = adopted.id
WHERE sv.id = :selected_block_id
  AND json_extract(sv.properties, '$.view_status') = 'overruled';
-- Expected: 1 row with reason NOT NULL
```

### S.25.1: External Resource Display

```sql
-- Get external block with URL properties
SELECT id, content, type,
       json_extract(properties, '$.url') as url,
       json_extract(properties, '$.snapshot_date') as snapshot_date,
       json_extract(properties, '$.url_status') as url_status,
       json_extract(properties, '$.domain_credibility') as credibility
FROM memory_blocks
WHERE session_id = :session_id
  AND type = 'external';
-- Expected: 1+ rows with url NOT NULL
```

### S.25.2: URL Health Check

```sql
-- Verify URL status after check
SELECT id,
       json_extract(properties, '$.url') as url,
       json_extract(properties, '$.url_status') as url_status,
       json_extract(properties, '$.last_checked') as last_checked,
       json_extract(properties, '$.status_changed_at') as status_changed_at
FROM memory_blocks
WHERE id = :selected_block_id;
-- Expected: url_status IN ('alive', 'redirected', 'dead', 'changed')
--           AND last_checked > NOW() - INTERVAL 1 MINUTE
```

### S.25.3: Domain Credibility Display

```sql
-- Get external blocks grouped by credibility
SELECT json_extract(properties, '$.domain_credibility') as credibility,
       COUNT(*) as count,
       GROUP_CONCAT(json_extract(properties, '$.url')) as urls
FROM memory_blocks
WHERE session_id = :session_id
  AND type = 'external'
GROUP BY json_extract(properties, '$.domain_credibility');
-- Expected: credibility IN ('high', 'medium', 'low', 'very_low')
```

### S.25.4: Content Change Detection

```sql
-- Find externals with content changes
SELECT id, content,
       json_extract(properties, '$.url') as url,
       json_extract(properties, '$.url_status') as url_status,
       json_extract(properties, '$.snapshot_date') as snapshot_date,
       json_extract(properties, '$.content_hash') as old_hash,
       json_extract(properties, '$.current_hash') as new_hash
FROM memory_blocks
WHERE session_id = :session_id
  AND type = 'external'
  AND json_extract(properties, '$.url_status') = 'changed';
-- Expected: 1+ rows where url_status = 'changed'
--           AND old_hash != new_hash
```

---

## Relationship Nuance Scenarios (7, 10-11, 18, 22)

### S.7.1: Link Degree Display

```sql
-- Get links with degree metadata
SELECT ml.id, ml.link_type, ml.degree, ml.confidence,
       src.content as source_content,
       tgt.content as target_content
FROM memory_links ml
JOIN memory_blocks src ON ml.source_block_id = src.id
JOIN memory_blocks tgt ON ml.target_block_id = tgt.id
WHERE ml.session_id = :session_id
  AND ml.link_type = 'addresses';
-- Expected: rows with degree IN ('full', 'partial', 'minimal')
```

### S.7.2: Link Confidence Display

```sql
-- Get links by confidence range
SELECT ml.id, ml.link_type, ml.confidence,
       CASE
         WHEN ml.confidence >= 0.8 THEN 'high'
         WHEN ml.confidence >= 0.5 THEN 'medium'
         ELSE 'low'
       END as confidence_level
FROM memory_links ml
WHERE ml.session_id = :session_id
ORDER BY ml.confidence;
-- Expected: variety of confidence levels for visual testing
```

### S.7.3: Link Metadata in Inspector

```sql
-- Get full link details for inspector
SELECT ml.id, ml.link_type, ml.degree, ml.confidence,
       ml.reason, ml.status, ml.created_at, ml.updated_at,
       src.id as source_id, src.content as source_content,
       tgt.id as target_id, tgt.content as target_content
FROM memory_links ml
JOIN memory_blocks src ON ml.source_block_id = src.id
JOIN memory_blocks tgt ON ml.target_block_id = tgt.id
WHERE ml.id = :selected_link_id;
-- Expected: 1 row with all fields populated
```

### S.10.1: Excludes Link Display

```sql
-- Verify excludes links exist
SELECT ml.id, ml.link_type,
       src.content as excludes_content,
       tgt.content as excluded_from_content
FROM memory_links ml
JOIN memory_blocks src ON ml.source_block_id = src.id
JOIN memory_blocks tgt ON ml.target_block_id = tgt.id
WHERE ml.session_id = :session_id
  AND ml.link_type = 'excludes';
-- Expected: 1+ rows
```

### S.10.2: Negative Information Filtering

```sql
-- Count includes vs excludes links for filter testing
SELECT link_type, COUNT(*) as count
FROM memory_links
WHERE session_id = :session_id
  AND link_type IN ('includes', 'excludes')
GROUP BY link_type;
-- Expected: both types present for filter testing

-- After filter applied, verify only excludes visible
-- (Application-level check: compare visible edges to this result)
SELECT COUNT(*) as excludes_count
FROM memory_links
WHERE session_id = :session_id
  AND link_type = 'excludes';
```

### S.11.1: Blocks/Unblocks Edge Display

```sql
-- Get blocking relationship links
SELECT ml.id, ml.link_type,
       src.content as blocker,
       tgt.content as blocked
FROM memory_links ml
JOIN memory_blocks src ON ml.source_block_id = src.id
JOIN memory_blocks tgt ON ml.target_block_id = tgt.id
WHERE ml.session_id = :session_id
  AND ml.link_type IN ('blocks', 'unblocks');
-- Expected: 1+ rows with blocks or unblocks type
```

### S.11.2: Dependency Traversal

```sql
-- Traverse blocking dependencies transitively
WITH RECURSIVE blocked_chain AS (
  -- Start with blocks from selected node
  SELECT ml.target_block_id as blocked_id, 1 as depth
  FROM memory_links ml
  WHERE ml.source_block_id = :selected_block_id
    AND ml.link_type = 'blocks'

  UNION ALL

  -- Recursively find transitively blocked nodes
  SELECT ml.target_block_id, bc.depth + 1
  FROM blocked_chain bc
  JOIN memory_links ml ON ml.source_block_id = bc.blocked_id
  WHERE ml.link_type = 'blocks'
    AND bc.depth < 10
)
SELECT mb.id, mb.content, bc.depth
FROM blocked_chain bc
JOIN memory_blocks mb ON bc.blocked_id = mb.id
ORDER BY bc.depth;
-- Expected: 2+ rows showing B and C in chain
```

### S.18.1: Context-Qualified Value Display

```sql
-- Get block with context-qualified properties
SELECT id, content,
       json_extract(properties, '$.varies_by') as varies_by,
       json_extract(properties, '$.price__enterprise') as enterprise_price,
       json_extract(properties, '$.price__smb') as smb_price,
       properties
FROM memory_blocks
WHERE session_id = :session_id
  AND json_extract(properties, '$.varies_by') IS NOT NULL;
-- Expected: 1 row with context-specific values
```

### S.18.2: Varies By Indicator

```sql
-- Find all blocks with varies_by dimension
SELECT id, content,
       json_extract(properties, '$.varies_by') as dimension
FROM memory_blocks
WHERE session_id = :session_id
  AND json_extract(properties, '$.varies_by') IS NOT NULL;
-- Expected: 1+ rows with dimension value
```

### S.22.1: Cycle Detection Display

```sql
-- Find cycle blocks
SELECT mb.id, mb.content, mb.type,
       json_extract(mb.properties, '$.cycle_id') as cycle_id,
       json_extract(mb.properties, '$.cycle_position') as position,
       json_extract(mb.properties, '$.cycle_type') as cycle_type
FROM memory_blocks mb
WHERE mb.session_id = :session_id
  AND mb.type = 'cycle';
-- Expected: 1+ cycle block rows

-- Find members of a specific cycle
SELECT mb.id, mb.content,
       json_extract(mb.properties, '$.cycle_id') as in_cycle
FROM memory_blocks mb
WHERE mb.session_id = :session_id
  AND json_extract(mb.properties, '$.cycle_id') IS NOT NULL;
-- Expected: 2+ blocks in cycle
```

### S.22.2: Cycle Type Classification

```sql
-- Get cycle types
SELECT json_extract(properties, '$.cycle_type') as cycle_type,
       COUNT(*) as count
FROM memory_blocks
WHERE session_id = :session_id
  AND type = 'cycle'
GROUP BY json_extract(properties, '$.cycle_type');
-- Expected: rows for 'blocking' and 'reinforcing'
```

### S.22.3: Break Point Selection UI

```sql
-- Verify break point set on cycle
SELECT id, content,
       json_extract(properties, '$.break_point') as break_point,
       json_extract(properties, '$.break_strategy') as strategy
FROM memory_blocks
WHERE id = :cycle_block_id
  AND type = 'cycle';
-- Expected: break_point IS NOT NULL (block ID)
```

### S.22.4: Cycle Resolution Flow

```sql
-- Verify cycle resolved
SELECT id, content, status,
       json_extract(properties, '$.break_point') as break_point,
       json_extract(properties, '$.break_strategy') as strategy,
       json_extract(properties, '$.resolved_at') as resolved_at
FROM memory_blocks
WHERE id = :cycle_block_id
  AND type = 'cycle';
-- Expected: status = 'resolved' OR properties has resolved_at
```

---

## Temporal & Evolution Scenarios (8-9, 19, 26)

### S.8.1: Temporal Property Display

```sql
-- Get blocks with temporal properties
SELECT id, content,
       json_extract(properties, '$.when') as when_value,
       json_extract(properties, '$.duration') as duration,
       json_extract(properties, '$.planned_for') as planned_for,
       json_extract(properties, '$.valid_until') as valid_until
FROM memory_blocks
WHERE session_id = :session_id
  AND (json_extract(properties, '$.when') IS NOT NULL
       OR json_extract(properties, '$.duration') IS NOT NULL
       OR json_extract(properties, '$.planned_for') IS NOT NULL);
-- Expected: 1+ rows with temporal data
```

### S.8.2: Relative Time Display

```sql
-- Get blocks with relative time values
SELECT id, content,
       json_extract(properties, '$.when') as when_value
FROM memory_blocks
WHERE session_id = :session_id
  AND json_extract(properties, '$.when') LIKE '-%';
-- Expected: 1 row with when_value like '-6_months'
```

### S.8.3: Future Planning Display

```sql
-- Get blocks with planned_for dates
SELECT id, content,
       json_extract(properties, '$.planned_for') as planned_for,
       status
FROM memory_blocks
WHERE session_id = :session_id
  AND json_extract(properties, '$.planned_for') IS NOT NULL;
-- Expected: 1 row with planned_for = 'Q3_2026'
```

### S.9.1: Quantification Refinement Chain

```sql
-- Get refines chain with confidence progression
WITH RECURSIVE refines_chain AS (
  SELECT mb.id, mb.content, mb.confidence, 0 as depth
  FROM memory_blocks mb
  WHERE mb.id = :latest_block_id

  UNION ALL

  SELECT orig.id, orig.content, orig.confidence, rc.depth + 1
  FROM refines_chain rc
  JOIN memory_links ml ON ml.source_block_id = rc.id AND ml.link_type = 'refines'
  JOIN memory_blocks orig ON ml.target_block_id = orig.id
  WHERE rc.depth < 10
)
SELECT * FROM refines_chain ORDER BY depth DESC;
-- Expected: 3+ rows with increasing confidence (earlier = lower)
```

### S.19.1: Derived Block Display

```sql
-- Get derived block with formula details
SELECT id, content, type,
       json_extract(properties, '$.formula') as formula,
       json_extract(properties, '$.computed_value') as computed_value,
       json_extract(properties, '$.computed_at') as computed_at,
       json_extract(properties, '$.stale') as is_stale
FROM memory_blocks
WHERE session_id = :session_id
  AND type = 'derived';
-- Expected: 1+ rows with formula NOT NULL
```

### S.19.2: Stale Derived Block Indicator

```sql
-- Find stale derived blocks with source info
SELECT d.id, d.content,
       json_extract(d.properties, '$.stale') as is_stale,
       json_extract(d.properties, '$.computed_at') as computed_at,
       src.id as source_id, src.content as source_content,
       src.updated_at as source_updated
FROM memory_blocks d
JOIN memory_links ml ON d.id = ml.source_block_id AND ml.link_type = 'derived_from'
JOIN memory_blocks src ON ml.target_block_id = src.id
WHERE d.session_id = :session_id
  AND d.type = 'derived'
  AND src.updated_at > d.updated_at;
-- Expected: rows where source was updated after derived block
```

### S.19.3: Recalculate Derived Value

```sql
-- Verify recalculation (after action)
SELECT id,
       json_extract(properties, '$.computed_value') as value,
       json_extract(properties, '$.computed_at') as computed_at,
       json_extract(properties, '$.stale') as is_stale,
       updated_at
FROM memory_blocks
WHERE id = :derived_block_id;
-- Expected: stale = false OR NULL, computed_at recent
```

### S.19.4: Override Derived Value

```sql
-- Verify override applied
SELECT id,
       json_extract(properties, '$.computed_value') as original_value,
       json_extract(properties, '$.override_value') as override_value,
       json_extract(properties, '$.override_reason') as override_reason
FROM memory_blocks
WHERE id = :derived_block_id;
-- Expected: override_value = 6000000000
--           AND override_reason = 'CEO directive'
```

### S.26.1: Action Block Display

```sql
-- Get action blocks with type
SELECT id, content, type,
       json_extract(properties, '$.action_type') as action_type,
       json_extract(properties, '$.required_count') as required,
       json_extract(properties, '$.completed_count') as completed
FROM memory_blocks
WHERE session_id = :session_id
  AND type = 'action';
-- Expected: 1+ rows with action_type IN ('validate', 'research', 'build', 'decide', 'other')
```

### S.26.2: Action Progress Bar

```sql
-- Get action progress
SELECT id,
       json_extract(properties, '$.required_count') as required,
       json_extract(properties, '$.completed_count') as completed,
       CAST(json_extract(properties, '$.completed_count') AS REAL) /
       CAST(json_extract(properties, '$.required_count') AS REAL) * 100 as percent
FROM memory_blocks
WHERE id = :action_block_id;
-- Expected: required = 10, completed = 8, percent = 80
```

### S.26.3: Action Due Date Warning

```sql
-- Get actions with due dates and urgency
SELECT id, content,
       json_extract(properties, '$.due_date') as due_date,
       julianday(json_extract(properties, '$.due_date')) - julianday('now') as days_until,
       CASE
         WHEN julianday(json_extract(properties, '$.due_date')) < julianday('now') THEN 'overdue'
         WHEN julianday(json_extract(properties, '$.due_date')) - julianday('now') <= 3 THEN 'urgent'
         ELSE 'normal'
       END as urgency
FROM memory_blocks
WHERE session_id = :session_id
  AND type = 'action'
  AND json_extract(properties, '$.due_date') IS NOT NULL;
-- Expected: 1+ rows with urgency categorization
```

### S.26.4: Action Completion Flow

```sql
-- Verify action completed with outcome
SELECT a.id, a.content, a.status,
       json_extract(a.properties, '$.outcome') as outcome,
       json_extract(a.properties, '$.completed_at') as completed_at,
       ml.target_block_id as validated_claim
FROM memory_blocks a
LEFT JOIN memory_links ml ON a.id = ml.source_block_id AND ml.link_type = 'validates_claim'
WHERE a.id = :action_block_id;
-- Expected: status = 'completed' OR 'validated'
--           AND outcome IN ('validated', 'invalidated', 'inconclusive')
```

---

## Scale & Aggregation Scenarios (14-15, 27)

### S.14.1: Synthesis Block Display

```sql
-- Get synthesis block with synthesized members
SELECT s.id, s.content, s.type,
       json_extract(s.properties, '$.cluster_theme') as theme,
       COUNT(ml.id) as synthesized_count
FROM memory_blocks s
LEFT JOIN memory_links ml ON s.id = ml.source_block_id AND ml.link_type = 'synthesizes'
WHERE s.session_id = :session_id
  AND s.type = 'synthesis'
GROUP BY s.id;
-- Expected: 1+ rows with synthesized_count >= 10
```

### S.14.2: Synthesis Expansion

```sql
-- Get all blocks synthesized by this synthesis block
SELECT mb.id, mb.content, mb.type,
       ml.reason as contribution
FROM memory_links ml
JOIN memory_blocks mb ON ml.target_block_id = mb.id
WHERE ml.source_block_id = :synthesis_block_id
  AND ml.link_type = 'synthesizes';
-- Expected: 10+ rows showing synthesized source blocks
```

### S.14.3: Synthesis Regeneration

```sql
-- Verify synthesis updated and versioned
SELECT id, content, updated_at,
       json_extract(properties, '$.version') as version,
       json_extract(properties, '$.previous_version_id') as previous_id
FROM memory_blocks
WHERE id = :synthesis_block_id;
-- Expected: updated_at recent, version incremented

-- Verify old version preserved
SELECT COUNT(*) as old_versions
FROM memory_blocks
WHERE json_extract(properties, '$.superseded_by') = :synthesis_block_id
  AND type = 'synthesis';
-- Expected: 1+ old versions preserved
```

### S.15.1: Global Pattern Display

```sql
-- Get global pattern blocks
SELECT id, content, type,
       json_extract(properties, '$.scope') as scope,
       json_extract(properties, '$.portfolio_tag') as portfolio_tag
FROM memory_blocks
WHERE type = 'pattern'
  AND json_extract(properties, '$.scope') = 'global';
-- Expected: 1+ rows with scope = 'global'
```

### S.15.2: Pattern Instances Display

```sql
-- Get pattern instances across ideas
SELECT mb.id, mb.content, mb.idea_id,
       i.slug as idea_slug, i.name as idea_name,
       ml.id as instance_link_id
FROM memory_links ml
JOIN memory_blocks mb ON ml.source_block_id = mb.id
JOIN ideas i ON mb.idea_id = i.id
WHERE ml.target_block_id = :pattern_block_id
  AND ml.link_type = 'instance_of';
-- Expected: 3+ rows from different idea_ids
```

### S.15.3: Portfolio Tag Grouping

```sql
-- Get blocks by portfolio tag across ideas
SELECT mb.id, mb.content, mb.idea_id,
       i.slug as idea_slug,
       json_extract(mb.properties, '$.portfolio_tag') as tag
FROM memory_blocks mb
JOIN ideas i ON mb.idea_id = i.id
WHERE json_extract(mb.properties, '$.portfolio_tag') = :portfolio_tag;
-- Expected: blocks from 2+ different idea_ids

-- Count ideas per portfolio tag
SELECT json_extract(properties, '$.portfolio_tag') as tag,
       COUNT(DISTINCT idea_id) as idea_count,
       COUNT(*) as block_count
FROM memory_blocks
WHERE json_extract(properties, '$.portfolio_tag') IS NOT NULL
GROUP BY json_extract(properties, '$.portfolio_tag');
-- Expected: idea_count >= 2 for test tag
```

### S.27.1: Abstraction Level Filter

```sql
-- Count blocks by abstraction level
SELECT abstraction_level, COUNT(*) as count
FROM memory_blocks
WHERE session_id = :session_id
  AND abstraction_level IS NOT NULL
GROUP BY abstraction_level;
-- Expected: rows for 'vision', 'strategy', 'tactic', 'implementation'

-- Get vision blocks only (for filter verification)
SELECT id, content, abstraction_level
FROM memory_blocks
WHERE session_id = :session_id
  AND abstraction_level = 'vision';
-- Expected: 1+ rows (these should be visible after filter)
```

### S.27.2: Hierarchical Layout by Abstraction

```sql
-- Get implements chain for hierarchical layout
WITH RECURSIVE impl_chain AS (
  SELECT mb.id, mb.content, mb.abstraction_level, 0 as depth
  FROM memory_blocks mb
  WHERE mb.session_id = :session_id
    AND mb.abstraction_level = 'vision'

  UNION ALL

  SELECT child.id, child.content, child.abstraction_level, ic.depth + 1
  FROM impl_chain ic
  JOIN memory_links ml ON ml.target_block_id = ic.id AND ml.link_type = 'implements'
  JOIN memory_blocks child ON ml.source_block_id = child.id
  WHERE ic.depth < 10
)
SELECT * FROM impl_chain ORDER BY depth;
-- Expected: vision at depth 0, implementation at depth 3
```

### S.27.3: "Why is this here?" Abstraction Query

```sql
-- Traverse implements chain upward to vision
WITH RECURSIVE why_chain AS (
  SELECT mb.id, mb.content, mb.abstraction_level, 0 as depth
  FROM memory_blocks mb
  WHERE mb.id = :selected_implementation_block_id

  UNION ALL

  SELECT parent.id, parent.content, parent.abstraction_level, wc.depth + 1
  FROM why_chain wc
  JOIN memory_links ml ON ml.source_block_id = wc.id AND ml.link_type = 'implements'
  JOIN memory_blocks parent ON ml.target_block_id = parent.id
  WHERE wc.depth < 10
)
SELECT * FROM why_chain ORDER BY depth;
-- Expected: chain from implementation → tactic → strategy → vision
```

### S.27.4: Abstraction Level Navigation

```sql
-- Get immediate parent in abstraction hierarchy
SELECT parent.id, parent.content, parent.abstraction_level
FROM memory_links ml
JOIN memory_blocks parent ON ml.target_block_id = parent.id
WHERE ml.source_block_id = :current_block_id
  AND ml.link_type = 'implements';
-- Expected: 1 row with higher abstraction level

-- Verify navigation path exists
SELECT COUNT(*) as path_length
FROM (
  WITH RECURSIVE path AS (
    SELECT id, 0 as depth FROM memory_blocks WHERE id = :tactic_block_id
    UNION ALL
    SELECT parent.id, p.depth + 1
    FROM path p
    JOIN memory_links ml ON ml.source_block_id = p.id AND ml.link_type = 'implements'
    JOIN memory_blocks parent ON ml.target_block_id = parent.id
    WHERE p.depth < 5
  )
  SELECT * FROM path WHERE depth > 0
);
-- Expected: path_length >= 2 (strategy and vision)
```

---

**Document Version**: 1.0
**Created**: 2026-01-23
**Parent**: [GRAPH-TAB-VIEW-UI-TESTS.md](GRAPH-TAB-VIEW-UI-TESTS.md)
