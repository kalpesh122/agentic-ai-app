---
name: add-tool
description: Add a new agent tool to this app (zod schema → execute → registry → guardrail flags → unit test → MCP exposure test → eval case). Use for any new capability the assistant should have.
argument-hint: [tool_name]
---

# Add a tool

Reference: `src/tools/search-notes.ts` (read-only, untrusted output) and `src/tools/save-note.ts` (destructive).

1. **Name** — `snake_case` verb phrase (`get_time`, `save_note`). File `src/tools/<name-with-dashes>.ts`.
2. **Define** — `export const x = defineTool({ name, description, inputSchema: z.object({...}), destructive, untrustedOutput?, execute })`.
   - `description` is for the model: what it does, when to use it, what it returns, side effects.
   - `.describe()` every argument; use defaults where sensible.
   - `destructive: true` for anything that writes, sends, deletes, or spends. `untrustedOutput: true` for anything from outside the system (web, documents, third-party APIs).
   - Collaborators come from `ToolContext`; add new ones there and to `createApp`/`createMcpServer` wiring.
3. **Register** — add to `allTools` in `src/tools/index.ts`; add the name to `ALLOWED_TOOLS` in `.env.example`.
4. **Tests** — `src/tools/registry.test.ts` or a colocated test: happy path, error path (returns `{ error }`), and, if destructive, the `approval_required` gate. `test/mcp.test.ts`: it appears in `tools/list` with the right annotations.
5. **Eval** — `add-eval-case` skill: at least one golden case that asserts the tool gets called.
6. **Verify** — `just check`; `just mcp-inspect` if you want to see the schema a host receives.
