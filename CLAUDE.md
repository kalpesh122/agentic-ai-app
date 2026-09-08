@AGENTS.md

## Claude Code specifics

- Use the `add-tool`, `add-eval-case`, and `swap-model` skills; they encode the registry, guardrail, and eval conventions.
- Hooks enforce the hard rules in AGENTS.md (dangerous commands, `.env`, lockfiles, format-on-edit, `just check` on stop). Do not work around them.
- Tests are offline by design; if you need a real model to reproduce something, write an eval case instead.
- To use this app's tools from this session: `just build` then `claude mcp add ai-app -- node dist/mcp/server.js` (writes stay gated unless `MCP_APPROVED=true`).
