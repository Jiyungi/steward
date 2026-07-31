# Steward demo release

Verified on July 31, 2026.

## Public product

- Product: <https://steward-sage.vercel.app>
- Browser voice: <https://steward-sage.vercel.app/voice>
- Owner control: <https://steward-sage.vercel.app/owner/demo>
- Vendor view: <https://steward-sage.vercel.app/vendor/demo>
- Health: <https://steward-sage.vercel.app/api/health>

The landing page's primary action opens the real browser voice session. Guest access remains available from the landing navigation.

## Start before judging

From the repository root:

```powershell
pnpm build
pnpm start:agent
```

Keep the laptop powered, awake, online, and the worker terminal open. The deployed web app is on Vercel; the always-on LiveKit agent runs on this laptop.

## Verified release gates

- `main` is pushed to GitHub and the public Vercel alias returns HTTP 200.
- Supabase health is ready.
- LiveKit worker registers as the named `steward` agent in US Central.
- The claimed a1 number is present on the configured inbound trunk.
- The inbound dispatch rule targets the inbound trunk and dispatches the named `steward` agent.
- The outbound trunk exists at `sip.telnyx.com` with one configured caller number.
- Browser microphone permission is requested only after the Start action.
- A real synthesized speech fixture completed Flux STT → a1 reasoning → Aura-2 TTS.
- Measured live turn: 251 ms end-of-turn, 1.84 s reasoning, 149 ms TTS, 2.33 s turn-to-speech.
- Barge-in interrupted the greeting.
- A spoken request to forget the active lock incident and discuss recipes/donkeys was stopped by the generic scope guard; the confirmation redirect reached TTS in 151 ms without replacing the incident goal.
- Incident and voice events persisted to the Owner timeline.
- Workspace typecheck, production build, and 98 unit tests pass.
- Landing browser checks pass on desktop and mobile, including enhanced 3D, static fallback, reduced motion, accessibility, and no-JavaScript behavior.
- Impeccable's detector reported no findings after consolidation.
- Eleven sensitive environment values were checked against tracked files and client bundles; no leak was found.

## Human proof actions still required

No controlled vendor phone is enrolled yet. In `/owner/demo`, enter a phone you control, request the a1 OTP, and confirm it. Only then can the real SMS and outbound vendor-call buttons run. Answer that vendor call and state a price, availability, arrival window, and scope so Steward can record a real quote. Stripe remains disabled until a real within-budget quote exists.

## Honest provider limits

- The current a1 Responses gateway rejects streamed HTTP responses and the Responses WebSocket endpoint. Steward uses the same a1 model through a non-streaming compatibility adapter; Deepgram audio transport remains streaming.
- Image input returned HTTP 400 across the available a1 models tested. Because the product is restricted to one reasoning model, camera analysis reports unavailable instead of sending the frame to a second model or fabricating an observation.
