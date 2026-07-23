# Multi-Provider Fallback for Jarvis — Design

**Date:** 2026-07-23
**Status:** Approved (option B in conversation), implemented same day.

## Goal

When Gemini's free-tier quota is exhausted, Jarvis should transparently fall
back to other free providers (Mistral, Groq) instead of telling the user to
wait. Also restructure the assistant service so adding/reordering providers is
a small, isolated change.

## Key research findings (drove the chain order)

- **OpenAI**: no free API tier — key returns `insufficient_quota`. Excluded.
- **Mistral free tier**: handles our ~11.7k-token system prompt comfortably on
  `mistral-small-latest` and `open-mistral-nemo`; both support tool calling.
  Limits are per-minute/per-month (generous). Strong secondary.
- **Groq free tier**: per-model tokens-per-minute caps make most models
  unusable for us — `gpt-oss-120b` (8k TPM) and `llama-3.1-8b` (6k TPM) reject
  a single full-prompt request outright (413 `rate_limit_exceeded`). Only
  `llama-3.3-70b-versatile` (12k TPM) fits, barely. Usable as a late-chain,
  roughly-one-request-per-minute fallback. Its 413s are typed like rate
  limits, so the chain treats them as quota errors and steps down.

## Chain order

1. `gemini-flash-latest` → 2. `gemini-flash-lite-latest` → 3. `gemini-2.0-flash`
   (best quality, 1M context, best Hindi/Hinglish)
4. `mistral-small-latest` — independent quota pool, fits our prompt easily
5. `llama-3.3-70b-versatile` on Groq — third independent pool, TPM-tight
6. `open-mistral-nemo` — final net (shares Mistral account quota; near-free to include)

Providers with no API key in the environment are left out of the chain, so
local dev with only `GEMINI_API_KEY` still works.

## Architecture (option B: adapters + chain of responsibility)

```
assistantService.js      facade: tool declarations, chain wiring, public API (unchanged exports)
  agentLoop.js           provider-neutral loop: rounds, tool execution, deltas/status
  providerChain.js       failover policy: ordered entries, per-entry cooldowns, QuotaExhaustedError
  providers/
    geminiProvider.js    @google/genai adapter (owns thought-signature echo)
    openaiCompatProvider.js  Mistral + Groq adapter (SSE over fetch, owns tool_call_id quirks)
```

- **Neutral message format** between loop and adapters:
  `{role:'user'|'assistant'|'tool', content?, toolCalls?:[{id?,name,args}], results?, raw?}`.
  `raw` is an opaque `{provider, parts}` payload so Gemini can replay its own
  turns verbatim (thought signatures); other providers rebuild from neutral
  fields. Because history is neutral, a conversation can switch provider
  mid-chat when quota flips.
- **Failover policy is data**: one entries array. Per-entry cooldowns come from
  each provider's own retry hints (`parseRetryAfter`), floored at 120s so a
  short hint on a daily-exhausted quota doesn't burn a failing request per
  message. The old sticky-preferred-index machinery is gone — accurate
  cooldowns subsume it.
- **Failover happens at round start only** (request time / first chunk). A
  mid-stream failure after the first chunk propagates rather than silently
  replaying on another model, which would duplicate streamed output.
- **Error taxonomy per adapter**: each provider classifies its own quota
  errors (Google `RESOURCE_EXHAUSTED`/`retryDelay`; OpenAI-compat 429 + Groq's
  413 TPM rejections + `retry-after` header / "try again in Xs" messages).
- **Provider quirks stay in adapters**: Mistral requires tool_call ids of
  exactly 9 alphanumerics — replayed history may carry Gemini/Groq-style ids,
  so the adapter maps every id deterministically (hash) to a compliant one,
  keeping call/result pairs consistent.

## Env vars

- `MISTRAL_API_KEY`, `GROQ_API_KEY` (new; optional — entries skipped if absent)
- `GEMINI_API_KEY` (existing)

## Out of scope

- OpenAI (no free tier), paid tiers, per-user routing, mid-stream replay.
