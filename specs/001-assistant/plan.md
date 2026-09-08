# Plan: Assistant agent

Spec: `spec.md`

## Steps

### 1. Env, model registry, providers, cost
- Files: `src/env.ts`, `src/llm/*`
- Test: `src/llm/models.test.ts`

### 2. Tool definitions and registry with gates
- Files: `src/tools/*`, `src/guardrails/untrusted.ts`
- Test: `src/tools/registry.test.ts`

### 3. Guardrails
- Files: `src/guardrails/{input,budget,output}.ts`
- Test: `src/guardrails/guardrails.test.ts`

### 4. Agent + HTTP
- Files: `src/agents/assistant.agent.ts`, `src/app.ts`, `src/http/extract.ts`, `src/index.ts`
- Test: `test/app.test.ts` with `MockLanguageModelV3`

### 5. Memory
- Files: `src/memory/*`, `drizzle/`
- Test: `src/memory/memory.test.ts` (pure), `test/memory-store.test.ts` (pgvector)

### 6. MCP, evals, telemetry
- Files: `src/mcp/server.ts`, `evals/*`, `src/telemetry/otel.ts`
- Test: `test/mcp.test.ts`; `just eval` (manual, keys)

## Rollback

Feature-level: remove the tool from `allTools`; env-level: `ALLOWED_TOOLS`.

## Out of scope / follow-ups

- Chat UI; durable execution; sandboxed code tool.
