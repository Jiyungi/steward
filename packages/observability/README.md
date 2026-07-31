# Steward observability

This package owns Langfuse initialization, correlation propagation, trace shape, and telemetry redaction.

## Expected incident trace

```text
resolve-incident-turn (agent)
|- generate-incident-response (generation, created by @langfuse/openai)
|- <stable-verb-first-tool-name> (tool)
`- additional guardrail/retriever/tool observations as the agent is implemented
```

Use `withIncidentTrace` once per caller turn. Pass opaque database IDs for `userId`, `incidentId`, and `sessionId`; never pass an email address or phone number as an identifier. Wrap external actions with `traceToolCall`. The OpenAI-compatible a1 client is wrapped once with `observeOpenAI`, so do not add a second manual generation around the same request.

Raw camera frames, audio, video, credentials, phone numbers, email addresses, and payment data are removed before export. Langfuse failure must never block an incident-resolution action.

For a real preflight trace:

```powershell
pnpm trace:smoke
```
