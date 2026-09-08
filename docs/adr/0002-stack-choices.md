# 0002. Stack choices for the LLM agent boilerplate

Date: 2026-09-09
Status: accepted

## Context

An agent application boilerplate has to survive fast-moving SDKs, work with more than one model vendor, make the dangerous parts (tools that act, content from the web) safe by default, and be testable without spending money.

## Decision

AI SDK v7 (`ToolLoopAgent`, `Output.object`, UI message streams) as the provider-agnostic layer with direct `@ai-sdk/anthropic|openai|google` providers and an optional Vercel AI Gateway path; a priced model registry driving a per-request cost cap implemented as a `stopWhen` condition; SDK-agnostic `defineTool` definitions bridged to both the AI SDK and MCP; approval gating and untrusted-output wrapping in the registry; Postgres + pgvector with hybrid retrieval (cosine + full-text, RRF) and contextual chunk embedding; promptfoo evals through the real agent; OpenTelemetry with an optional Langfuse span processor; Hono for HTTP; the Anthropic SDK kept for a native prompt-caching example.

## Alternatives considered

- **LangGraph / Mastra / OpenAI Agents SDK** — heavier abstractions; LangGraph's checkpointed graphs are valuable for long-running workflows but unnecessary here, Mastra's production readiness is vendor-asserted, and the OpenAI Agents SDK is OpenAI-first with beta multi-provider support. The AI SDK's agent primitive is small and multi-provider by design.
- **Raw provider SDKs everywhere** — three APIs to keep in sync; kept only for the caching example.
- **generateObject** — removed in AI SDK v7; `Output.object` is the replacement.
- **sqlite-vec / LanceDB** — fine for local-first; Postgres is what the rest of the library runs on and pgvector's HNSW is enough until millions of vectors (pgvectorscale beyond that).
- **Hosted eval platforms** (Braintrust, LangSmith) — good products with per-seat pricing; promptfoo is MIT and runs in CI. Langfuse is MIT and self-hostable for tracing.
- **PGlite for memory tests** — PGlite 0.5 does not bundle pgvector, so the store test runs against real Postgres (CI service container, `just test-db` locally) and everything else is mocked.
- **Durable execution by default** — deferred; add Temporal/Inngest/Trigger.dev when runs must survive process restarts.

## Consequences

- Good: swapping models is a config change with correct cost accounting; destructive actions cannot run without explicit approval; prompt-injection defence is structural; `just check` is offline and fast.
- Bad: the AI SDK releases several times a day, so pnpm's supply-chain cooldown is set to 60 minutes here instead of 24 hours; the memory-store test needs Docker or a database URL.
- Neutral: tracing and Langfuse are opt-in; the eval suite needs provider keys and therefore runs on demand and in CI with secrets.
