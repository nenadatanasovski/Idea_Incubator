# ARCH-001 Type Mapping

> Canonical mapping from old block types to new 9 types.
> 
> Use this for migration scripts and code updates.

---

## The 9 Target Types (ARCH-001)

| Type | Purpose | Question Answered |
|------|---------|-------------------|
| `knowledge` | Verified facts, patterns, insights | "What do we know?" |
| `decision` | Choices made with rationale | "What did we choose?" |
| `assumption` | Unverified beliefs to test | "What do we assume?" |
| `question` | Open unknowns to investigate | "What don't we know?" |
| `requirement` | Constraints, must-haves | "What must be true?" |
| `task` | Work items, actions | "What do we need to do?" |
| `proposal` | Suggested changes awaiting approval | "What might we do?" |
| `artifact` | Outputs (code, docs, specs) | "What did we produce?" |
| `evidence` | Validation data, proof | "How do we verify?" |

---

## Mapping: Schema Types (15 → 9)

| Old Type (Schema) | New Type | Rationale |
|-------------------|----------|-----------|
| `content` | `knowledge` | General content is knowledge |
| `synthesis` | `knowledge` | Synthesized info is knowledge |
| `pattern` | `knowledge` | Patterns are knowledge |
| `derived` | `knowledge` | Derived info is knowledge |
| `cycle` | `knowledge` | Cycle observations are knowledge |
| `stakeholder_view` | `knowledge` | Stakeholder perspectives are knowledge |
| `decision` | `decision` | Direct mapping |
| `option` | `decision` | Options are candidate decisions (store original as `wasOption: true` in properties) |
| `assumption` | `assumption` | Direct mapping |
| `action` | `task` | Actions are tasks |
| `external` | `evidence` | External data is evidence |
| `placeholder` | `question` | Placeholders represent unknowns |
| `link` | *REMOVE* | Use graph edges, not block type |
| `meta` | *REMOVE* | Use block properties |
| `topic` | *REMOVE* | Use `topic` dimension property |

---

## Mapping: Extractor Types (11 → 9)

| Old Type (Extractor) | New Type | Rationale |
|----------------------|----------|-----------|
| `insight` | `knowledge` | Insights are knowledge |
| `fact` | `knowledge` | Facts are knowledge (with higher confidence) |
| `pattern` | `knowledge` | Patterns are knowledge |
| `synthesis` | `knowledge` | Synthesis is knowledge |
| `decision` | `decision` | Direct mapping |
| `option` | `decision` | Options are candidate decisions |
| `assumption` | `assumption` | Direct mapping |
| `question` | `question` | Direct mapping |
| `requirement` | `requirement` | Direct mapping |
| `action` | `task` | Actions are tasks |
| `meta` | *REMOVE* | Use block properties |

---

## Migration Script Logic

```typescript
function mapBlockType(oldType: string): string {
  const mapping: Record<string, string> = {
    // Schema types → new
    'content': 'knowledge',
    'synthesis': 'knowledge',
    'pattern': 'knowledge',
    'derived': 'knowledge',
    'cycle': 'knowledge',
    'stakeholder_view': 'knowledge',
    'decision': 'decision',
    'option': 'decision',
    'assumption': 'assumption',
    'action': 'task',
    'external': 'evidence',
    'placeholder': 'question',
    
    // Extractor types → new
    'insight': 'knowledge',
    'fact': 'knowledge',
    'requirement': 'requirement',
    'question': 'question',
    
    // Already correct
    'knowledge': 'knowledge',
    'task': 'task',
    'proposal': 'proposal',
    'artifact': 'artifact',
    'evidence': 'evidence',
  };
  
  return mapping[oldType.toLowerCase()] || 'knowledge'; // Default to knowledge
}

function getPropertiesForMigration(oldType: string, existingProps: any): any {
  const props = { ...existingProps, migratedFrom: oldType };
  
  // Preserve semantic info
  if (oldType === 'option') {
    props.wasOption = true;
  }
  if (oldType === 'fact') {
    props.wasFactType = true; // May have higher confidence
  }
  if (oldType === 'insight') {
    props.wasInsight = true;
  }
  
  return props;
}
```

---

## Types to REMOVE (not migrate)

| Old Type | Reason | Action |
|----------|--------|--------|
| `link` | Graph edges, not blocks | Delete or convert to `REFERENCES` relationship |
| `meta` | Metadata about process | Move content to properties of related blocks |
| `topic` | Dimension, not type | Move to `topic` property on related blocks |

### Handling Removed Types

```typescript
function handleRemovedType(block: OldBlock): void {
  if (block.type === 'link') {
    // Convert to relationship if it references two blocks
    // Otherwise delete
  }
  
  if (block.type === 'meta') {
    // Find parent block via extractedFromMessageId or context
    // Add content to parent's properties
    // Delete meta block
  }
  
  if (block.type === 'topic') {
    // This is a dimension tag
    // Add to related blocks' topic property
    // Delete topic block
  }
}
```

---

## New Extractor Prompt Types

Update `BLOCK_EXTRACTION_PROMPT` to use exactly these 9:

```
1. **knowledge** - Verified facts, patterns, insights, conclusions
2. **decision** - Choices made or being considered
3. **assumption** - Unverified beliefs being made
4. **question** - Open unknowns, things to investigate
5. **requirement** - Must-have constraints, specifications
6. **task** - Actions, next steps, to-dos
7. **proposal** - Suggested changes or improvements
8. **artifact** - References to outputs (code, docs)
9. **evidence** - Validation data, proof, measurements
```

---

## Validation After Migration

```typescript
// Verify no old types remain
const oldTypes = [
  'content', 'link', 'meta', 'synthesis', 'pattern',
  'option', 'derived', 'cycle', 'placeholder',
  'stakeholder_view', 'topic', 'external', 'action',
  'insight', 'fact'
];

async function validateMigration() {
  for (const oldType of oldTypes) {
    const count = await countBlocksWithType(oldType);
    if (count > 0) {
      console.error(`❌ Found ${count} blocks with old type: ${oldType}`);
    }
  }
  
  // Verify new types exist
  const newTypes = [
    'knowledge', 'decision', 'assumption', 'question',
    'requirement', 'task', 'proposal', 'artifact', 'evidence'
  ];
  
  for (const newType of newTypes) {
    const count = await countBlocksWithType(newType);
    console.log(`✅ ${newType}: ${count} blocks`);
  }
}
```

---

## Revision History

| Date | Change | Author |
|------|--------|--------|
| 2026-02-05 | Initial creation | AI Agent (Kai) |

---

*This is a source-truth document for ARCH-001 migration.*
