# `@steward/providers`

Normalized, audited provider adapters for a1mobile, LiveKit SIP, and Stripe test mode. Public adapter methods return `ToolResult<T>` and never expose raw provider responses.

Create one `ProviderActionAuditor` from the server-side incident store and pass it into each provider. It records `tool.started`, the idempotent operation, the normalized result, and `tool.completed`.

Safety invariants:

- SMS and calls accept `ControlledContact`, not arbitrary phone strings, and reject contacts that are neither OTP-verified nor organizer-controlled.
- a1 SMS success means the request was accepted; delivery remains `unknown`.
- LiveKit uses `waitUntilAnswered: true`; a SIP answer still reports `quoteStatus: "not-collected"`.
- Stripe only accepts `sk_test_` keys, enforces the incident budget and pre-payment evidence, uses a stable payment idempotency key, and records success verification only from a signed raw webhook.
- Approved vendors are returned before the optional external directory is queried.
