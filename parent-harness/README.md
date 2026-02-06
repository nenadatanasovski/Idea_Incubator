# Parent Harness

External autonomous agent orchestration system for Vibe platform development.

## Key Concept

This harness runs **COPIES** of the Vibe platform agents on a separate server to test and build the Vibe platform itself. These are not the same agent instances - they are clones used as a litmus test during development.

## Quick Start

```bash
# From parent-harness/
docker-compose up -d

# View dashboard
open http://localhost:3333
```

## Architecture

```
parent-harness/ (this server)      →      Vibe Platform (target)
├── Orchestrator                          ├── Source code
├── Build Agent (copy)                    ├── Tests
├── Spec Agent (copy)                     └── Database
├── QA Agent (copy)
├── Task Agent (copy)
├── SIA Agent (copy)
└── [other agent copies]

Agents modify Vibe code, run tests, commit changes.
QA Agent verifies every 15 minutes.
```

## Documentation

- [AGENT_HARNESS_PLAN.md](./AGENT_HARNESS_PLAN.md) - Full specification
- [DECISIONS.md](./DECISIONS.md) - Design decisions and approvals

## Status

🚧 Under development
