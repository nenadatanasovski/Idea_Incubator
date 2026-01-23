# Idea Incubator

AI-powered idea incubation system with evaluation agents.

## Commands

```bash
# Dev
npm run dev              # Start server
npm test                 # Run tests

# Database
npm run sync             # Sync markdown to DB
npm run schema:generate  # Generate migration
npm run schema:migrate   # Apply migration

# Evaluation
npm run evaluate <slug>  # Run AI evaluation

# E2E (always use python3)
python3 tests/e2e/ralph_loop.py
```

## Rules

- **Always use python3** - Never `python`, always `python3`
- **Never stop servers** - Unless explicitly asked
- **Schema changes** - Only in `schema/entities/*.ts`, use `/schema-*` skills
- **Confirm idea context** - Ask which idea before making changes
- **Warn on expensive ops** - Evaluations cost ~$10

## Key Paths

- Ideas: `ideas/[slug]/`
- Schema: `schema/entities/*.ts`
- API routes: `server/routes/`
- Frontend: `frontend/src/`
- Docs: `docs/`

## Skills

- `/idea-capture`, `/idea-develop`, `/idea-evaluate`, `/idea-redteam`
- `/schema-add-entity`, `/schema-modify-entity`, `/schema-validate`
- `/validate-implementation` - Validate code against specs, find gaps/bugs, and fix them

## Mistakes to Avoid

- **Never upgrade reagraph to 4.30.7** - Causes "Cannot read properties of undefined (reading 'S')" error. Keep at 4.18.1
