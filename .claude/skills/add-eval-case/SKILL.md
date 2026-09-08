---
name: add-eval-case
description: Add a promptfoo golden case for a prompt, tool, or behaviour change. Use whenever src/prompts, src/tools, or agent behaviour changes.
---

# Add an eval case

1. Open `evals/golden/*.yaml` (create a new file per theme when a file passes ~15 cases).
2. Write the case:
   ```yaml
   - description: <behaviour in one sentence>
     vars: { prompt: "<user message>" }
     assert:
       - type: javascript          # deterministic first: tool calls, approvals, metadata
         value: context.metadata.toolCalls.some(c => c.tool === 'get_time')
       - type: icontains           # cheap text checks
         value: "<expected substring>"
       - type: llm-rubric          # only when judgement is genuinely needed
         value: "<what a good answer must do>"
   ```
   `context.metadata` carries `toolCalls`, `approvalRequired`, `steps` from `evals/agent-provider.mjs`.
3. Prefer deterministic assertions; use `llm-rubric` sparingly (the judge is a different model family; keep it that way).
4. Run `just eval` (needs provider keys). New cases must pass; if an existing case fails, decide whether the behaviour or the case is wrong and say which in the PR.
5. Commit the case together with the change it protects.
