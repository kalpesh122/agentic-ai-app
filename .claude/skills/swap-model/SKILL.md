---
name: swap-model
description: Change the default model, add a model id, or add a provider in this app. Use for any model/provider change.
argument-hint: [provider/model-id]
---

# Swap or add a model

1. **Known model, new default**: set `AI_MODEL=provider/model-id` in `.env` (and `.env.example` if the default should change for everyone). Nothing else.
2. **New model id**: add an entry to `MODELS` in `src/llm/models.ts` with verified list prices (USD per 1M tokens) and a one-line note. Unknown ids still run but are priced at 0 with `known: false`, which silently disables the cost cap, so always register.
3. **Cheap default**: `AI_MODEL=deepseek/deepseek-v4-flash` with `DEEPSEEK_API_KEY` is the lowest-cost capable option; keep embeddings on OpenAI or Google.
4. **New provider**: extend `Provider` and the `switch` in `src/llm/provider.ts` for both language and embedding models; add the key to `src/env.ts` (`loadEnv` requirement logic), `.env.example`, and the README table.
5. **Gateway**: setting `AI_GATEWAY_API_KEY` routes every model through Vercel AI Gateway with the same `provider/model` strings; direct keys become unnecessary.
6. Run `just check`, then `just eval` against the new default. Record the change in `docs/adr/` if it is a default change.
