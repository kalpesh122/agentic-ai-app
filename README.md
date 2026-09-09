# agentic-ai-app

A production-grade **LLM agent application** boilerplate in TypeScript, with the [agentic-kit](https://github.com/kalpesh122/agentic-kit) built in: one `AGENTS.md` every AI coding agent reads, skills that encode how to add tools, eval cases, and models, hooks that block destructive commands and force `just check` to pass before an agent can say "done", and a multi-model (Claude + Codex + Gemini) code-review council in CI.

What it gives you on day one: an assistant agent on **AI SDK v7** (`ToolLoopAgent`, streaming, `Output.object` structured output) that runs on **Claude, GPT, Gemini, or DeepSeek** through one `provider/model` switch (or Vercel AI Gateway); a **tool registry** where every tool is a zod-typed definition with an allowlist, an **approval gate** for destructive actions, and **untrusted-output wrapping** against prompt injection; **guardrails** for input size, a per-request **cost cap** (with a priced model registry), and output validation; **long-term memory** on Postgres + pgvector with hybrid retrieval (vector + full-text fused by RRF); **evals** with promptfoo driven through the real agent; **OpenTelemetry/Langfuse** tracing; and the same tools exposed as an **MCP server**. Tests run fully offline with the SDK's mock models.

## 60-second quickstart

```bash
git clone https://github.com/kalpesh122/agentic-ai-app my-agent && cd my-agent
cp .env.example .env               # add ANTHROPIC_API_KEY (or OPENAI_/GOOGLE_) and OPENAI_API_KEY for embeddings
just setup
just docker-up && just db-migrate  # pgvector Postgres on localhost:5436
just dev                           # http://localhost:3000/health
curl -s localhost:3000/agent/run -H 'content-type: application/json' -d '{"prompt":"What time is it in Kolkata?"}'
```

Requirements: Node 24 (`.node-version`), [just](https://github.com/casey/just), Docker (memory database; optional Langfuse). No keys are needed for `just check`.

## Commands

| Command | What it does |
|---------|--------------|
| `just setup` | Install dependencies (pnpm 12 via corepack) |
| `just dev` | HTTP API with watch on `PORT` (3000) |
| `just test` / `just test-db` | Offline tests with mocked models / plus the pgvector store test |
| `just lint` / `just fmt` | Biome check / fix |
| `just typecheck` / `just build` | `tsc --noEmit` / compile to `dist/` |
| `just check` | **Quality gate**: lint + typecheck + test + build (offline) |
| `just eval` / `just eval-view` / `just eval-redteam` | promptfoo golden suite / UI / red team (keys required) |
| `just mcp` / `just mcp-inspect` | Tool registry over MCP stdio / Inspector |
| `just docker-up` / `just db-migrate` / `just docker-build` | pgvector Postgres / migrations / production image |
| `just trace-up` | Self-hosted Langfuse v4 on http://localhost:3001 |
| `just council` | Local multi-model code review of your branch |

## HTTP API

| Route | Purpose |
|-------|---------|
| `GET /health`, `GET /models` | Liveness; the model registry with prices and the current default |
| `POST /agent/run` `{ prompt, approved?, tools? }` | One-shot tool loop. Returns `text`, `steps`, `toolCalls`, `approvalRequired`, `usage`, `costUsd` |
| `POST /chat` `{ messages: UIMessage[], approved? }` | Streaming (AI SDK UI message stream) for `useChat` clients |
| `POST /extract/contact` `{ text }` | Structured output via `Output.object`, validated on both sides |

Errors are `{ error: { code, message, requestId } }`: `validation_error` (422), `input_rejected` (422), `budget_exceeded` (402), `output_rejected` (500).

## Models and providers

| Id | List price (in / out per 1M tokens) |
|----|-------------------------------------|
| `anthropic/claude-opus-5` | $5 / $25 |
| `anthropic/claude-sonnet-5` (default) | $2 / $10 |
| `anthropic/claude-haiku-4-5` | $1 / $5 |
| `openai/gpt-5.6-sol` | $4 / $20 |
| `openai/gpt-5.6-terra` | $2 / $12 |
| `google/gemini-3.1-pro-preview` | $2 / $12 |
| `google/gemini-3.8-flash` | $0.75 / $3.75 |
| `deepseek/deepseek-v4-flash` | $0.44 / $1.32 (peak, cache miss; off-peak half, cache hits $0.014) |
| `deepseek/deepseek-v4-pro` | $1.32 / $3.96 (peak, cache miss; off-peak half, cache hits $0.044) |

Set `AI_MODEL=provider/model`. With `AI_GATEWAY_API_KEY` set, every model routes through Vercel AI Gateway with the same ids. Embeddings use `AI_EMBEDDING_MODEL` (OpenAI or Google; Anthropic and DeepSeek have no embedding models). DeepSeek runs over its OpenAI-compatible API through `@ai-sdk/deepseek` with `DEEPSEEK_API_KEY`; the registry pins its peak cache-miss rates so the cost cap never under-counts. Prices drive the per-request `MAX_COST_USD` cap, which is a `stopWhen` condition on the agent loop.

## Safety model

- **Allowlist**: `ALLOWED_TOOLS` decides which tools an agent may see; a request may narrow it further, never widen it.
- **Approval gate**: tools marked `destructive` return `approval_required` unless the request carries `approved: true`. The response lists pending approvals so a UI can ask the user.
- **Untrusted output**: results from `http_fetch` and `search_notes` are wrapped `{ untrusted: true, note, data }`, and the system prompt instructs the model to treat them as data.
- **Budgets**: `MAX_STEPS` and `MAX_COST_USD` per request; the loop stops and the API answers 402.
- **Input/output guardrails**: control characters stripped and size-limited on the way in; structured output re-validated on the way out.
- **Egress**: `http_fetch` only reaches `HTTP_FETCH_ALLOWED_HOSTS`, https only, no redirects, 10 s timeout, 200 kB cap.

## Folder map

```
src/index.ts             bootstrap and graceful shutdown
src/app.ts               Hono routes, error mapping
src/env.ts               zod-validated env; provider/model ids
src/llm/                 models (registry + prices) · provider (Claude/GPT/Gemini/Gateway) · cost
src/agents/              assistant.agent.ts (ToolLoopAgent + budget stop condition, runAssistant)
src/tools/               types (defineTool) · get-time · search-notes · save-note · http-fetch · index · registry
src/guardrails/          input · budget · output · untrusted
src/memory/              schema (pgvector) · chunk · embed · search (RRF) · store (hybrid) · migrate
src/prompts/             assistant.md + loader
src/http/extract.ts      Output.object example
src/mcp/server.ts        MCP exposure of the registry
src/anthropic/           native SDK example: prompt caching + adaptive thinking
src/telemetry/otel.ts    OTLP / Langfuse span processor
evals/                   promptfoo config, agent provider, golden cases, judge rubric
test/                    mocks (MockLanguageModelV3 helpers), app, mcp, memory-store (gated on TEST_DATABASE_URL)
.claude/ .agents/ AGENTS.md   the agentic kit
```

## Evals

`evals/golden/*.yaml` holds cases with deterministic assertions on tool calls and approvals plus a few `llm-rubric` judgements (judge model from a different family than the system under test). `just eval` runs them through the compiled agent; `.github/workflows/evals.yml` runs on prompt/tool changes and fails under 95% pass rate. Change a prompt, add a case.

## Observability

Set `OTEL_EXPORTER_OTLP_ENDPOINT` for any OTLP collector, or `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` (and `just trace-up` for a local Langfuse) to get per-request traces with token usage and cost from the AI SDK's telemetry.

## How AI agents work in this repo

- `AGENTS.md` (≤150 lines) is the map: commands, layout, hard rules, definition of done. `CLAUDE.md` imports it; Gemini, Copilot, and Cursor point at it.
- Skills in `.claude/skills/` (mirrored in `.agents/skills/`): `add-tool`, `add-eval-case`, `swap-model`, plus the kit's `brainstorm-spec`, `tdd`, `debug`, `code-review`, `council-review`, `verify-before-done`, `adr`, `git-hygiene`.
- Hooks in `.claude/settings.json`: block `rm -rf`, force pushes, reading `.env`; protect lockfiles; format every edited file with Biome; run `just check` when the agent tries to stop and block if it fails.
- CI: `ci.yml` runs `just check` with a pgvector service (so the store test runs), then builds the image; `evals.yml` gates prompt changes; `ai-council-review.yml` has three models review every PR.
- `specs/001-assistant/` shows the spec → plan → tasks flow; `docs/adr/` records why the stack looks like this.

## Swap-outs

- **Vector store**: `src/memory/store.ts` is the only file that knows about pgvector; LanceDB or a hosted store fits behind the `MemoryStore` interface.
- **Framework**: Hono routes are thin; the agent, tools, and guardrails are framework-free.
- **Durable execution**: wrap `runAssistant` in Temporal/Inngest/Trigger.dev when runs must survive restarts.
- **Sandboxed code execution**: add a tool that calls E2B or Anthropic's hosted code execution; mark it `destructive`.

## License

MIT © Kalpesh Mali
