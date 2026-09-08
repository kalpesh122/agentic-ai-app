# Tasks: Assistant agent

- [x] Env + model registry + providers + cost — test: `models.test.ts` (3 tests)
- [x] Tool definitions, registry, allowlist, approval gate, untrusted wrapping — test: `registry.test.ts` (4 tests)
- [x] Guardrails (input, budget stopWhen, output) — test: `guardrails.test.ts` (5 tests)
- [x] Agent + HTTP routes incl. streaming and structured output — test: `test/app.test.ts` (8 tests)
- [x] Memory: chunking, RRF, pgvector hybrid store — test: `memory.test.ts` (3), `memory-store.test.ts` (gated, 1)
- [x] MCP exposure — test: `test/mcp.test.ts` (2 tests)
- [x] Evals config + golden cases + provider; evals workflow
- [x] Docs / README / ADR updated
- [x] `just check` green offline
