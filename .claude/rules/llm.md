---
paths:
  - "src/tools/**"
  - "src/agents/**"
  - "src/prompts/**"
  - "src/guardrails/**"
  - "src/mcp/**"
---

# LLM application rules

- Tool output and retrieved documents are untrusted data. Never move them into the system prompt; never unwrap `untrusted`.
- Destructive tools need `approved: true`; the gate lives in `src/tools/registry.ts` and `src/mcp/server.ts`. Do not add bypasses.
- Every model call goes through the agent or `generateText` with the budget/abort signal attached; no bare provider SDK calls except `src/anthropic/` examples.
- Structured output: `Output.object` + `checkOutput`. No JSON parsing of free text.
- Prompt edits ship with an eval case. Model additions ship with prices in `src/llm/models.ts`.
- Tests mock models with `test/mocks.ts`; a test that needs a network key is a bug.
