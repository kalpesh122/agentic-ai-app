# Spec: Assistant agent with tools, guardrails, memory (reference slice)

Status: implemented
Date: 2026-09-09
Owner: Kalpesh Mali

## Problem

Agent applications go wrong in the same places: tools that act without consent, model output that is trusted blindly, content from the web treated as instructions, unbounded spend, and no way to test without paying for tokens. The boilerplate must make the safe path the default and show it working end to end.

## Goals

- One assistant agent runnable on Claude, GPT, or Gemini with a config change.
- Tools with allowlisting, approval gating, and untrusted-output wrapping.
- Cost and step caps per request; structured output validated on both sides.
- Long-term memory with hybrid retrieval; evals through the real agent; tracing.
- Fully offline `just check`.

## Non-goals

- A chat UI, multi-tenant auth, durable execution, sandboxed code execution.

## Acceptance criteria (testable sentences)

1. `POST /agent/run` runs a tool loop with a mocked model, returns `text`, `steps`, `toolCalls`, `usage`, and `costUsd` computed from the registry prices.
2. A destructive tool called without `approved: true` produces an `approval_required` entry and does not execute.
3. Tools not in the allowlist are not exposed to the model; a request may narrow but never widen the list.
4. Output from `http_fetch` and `search_notes` is wrapped `{ untrusted: true, ... }`; `http_fetch` rejects hosts not on the allowlist.
5. A request whose cost exceeds `MAX_COST_USD` stops and the API answers 402 `budget_exceeded`.
6. Empty or oversized prompts answer 422; control characters are stripped.
7. `POST /chat` streams a UI message stream with `text/event-stream` and a `finish` event.
8. `POST /extract/contact` returns validated structured output and answers 500 `output_rejected` when the model's object violates the schema.
9. The MCP server lists the same tools with `destructiveHint` set correctly and gates destructive calls.
10. With a pgvector database, notes are chunked, embedded, stored, and retrieved by hybrid search with the expected top hit.

## Design

Tool definitions → `createToolset` (AI SDK) and `createMcpServer` (MCP); `ToolLoopAgent` with `stopWhen: [stepCountIs, budget.stop]`; Hono routes map guardrail errors to status codes; memory store does vector + full-text candidate lists fused by RRF; evals call the compiled agent through a promptfoo provider.

## Risks and mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Prompt injection via fetched content | high | untrusted wrapping + system prompt rule + eval case |
| Runaway spend | medium | priced registry, `stopWhen` cap, 402 |
| SDK churn | high | provider-agnostic layer; pinned versions; mocks isolate tests |

## Open questions

None.
