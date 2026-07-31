# Steward Provisioning Guide

Provision services in this order. Never paste real secret values into `.env.example`, source files, issues, screenshots, or chat. Put them only in the ignored local `.env` file and in the deployment platform's secret store.

## 1. a1mobile first

### Existing values

The local `.env` already contains:

- `A1MOBILE_TEAM_KEY`
- `OPENAI_API_KEY`

Keep both values. `OPENAI_API_KEY` is the a1mobile hackathon model-gateway key, not a second LLM provider.

### Fixed public configuration

Copy these values directly from `.env.example`:

```dotenv
A1MOBILE_BASE_URL=https://hack.a1mobile.com
A1MOBILE_MCP_URL=https://hack.a1mobile.com/mcp/
OPENAI_BASE_URL=https://h3zqfzovcybu5annkciuqf47mu0cbczd.lambda-url.us-east-2.on.aws/openai/v1
OPENAI_MODEL=openai.gpt-5.6-terra
```

### Claim the phone and SIP credentials

With `A1MOBILE_TEAM_KEY` loaded in the shell, call:

```powershell
curl.exe -X POST "https://hack.a1mobile.com/api/numbers/claim" `
  -H "X-Team-Key: $env:A1MOBILE_TEAM_KEY"
```

Copy the response fields into `.env`:

| Claim response | Environment variable |
|---|---|
| `phone_number` | `A1MOBILE_PHONE_NUMBER` |
| `sip_username` | `A1MOBILE_SIP_USERNAME` |
| `sip_password` | `A1MOBILE_SIP_PASSWORD` |

If the team already owns a number, verify whether the endpoint returns that assignment before requesting help from the organizers. Do not keep claiming numbers.

### Verify numbers used during the demo

The hackathon allows calls and texts only to OTP-verified numbers or organizer-provided test lines. Use the `/api/verified-numbers` and `/api/verified-numbers/confirm` endpoints from `resource.md`. Store verified recipients as vendor or test-contact records in Supabase, not as environment variables.

### Two a1mobile checks that must pass before implementation

1. Send a deliberately unrelated image, such as fruit, through the a1 Responses gateway and confirm that `openai.gpt-5.6-terra` accepts image input and describes the real image. If it cannot accept images, replace the single LLM choice for both conversation and vision; do not add a second vision-only model.
2. Confirm with an actual verified test number that the supplied SIP credentials permit outbound calling through `sip.telnyx.com`. The local hackathon notes confirm the credentials and inbound LiveKit path, but do not prove outbound permission.

## 2. LiveKit Cloud

Official references: [LiveKit project credentials](https://docs.livekit.io/reference/developer-tools/livekit-cli/projects/), [inbound trunks](https://docs.livekit.io/telephony/accepting-calls/inbound-trunk/), [dispatch rules](https://docs.livekit.io/telephony/accepting-calls/dispatch-rule/), and [outbound trunks](https://docs.livekit.io/telephony/making-calls/outbound-trunk/).

### Existing values

The current `.env` already contains working values for:

- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

The credentials were verified with `lk room list`. Keep the Build plan for the hackathon.

Set `NEXT_PUBLIC_LIVEKIT_URL` to the same WebSocket project URL as `LIVEKIT_URL`. The URL is public; the API secret is not.

Set:

```dotenv
LIVEKIT_AGENT_NAME=steward
```

### Create the SIP resources

Use the LiveKit dashboard under **Telephony**, or the installed `lk` CLI:

1. Create one inbound trunk for `A1MOBILE_PHONE_NUMBER`.
2. Create one individual dispatch rule that puts each inbound call in a unique room and dispatches `LIVEKIT_AGENT_NAME`.
3. Create one reusable outbound trunk at `sip.telnyx.com` using `A1MOBILE_SIP_USERNAME` and `A1MOBILE_SIP_PASSWORD`.
4. Test an outbound SIP participant against an OTP-verified or organizer test number.

Copy the IDs returned by LiveKit into:

```dotenv
LIVEKIT_SIP_INBOUND_TRUNK_ID=
LIVEKIT_SIP_OUTBOUND_TRUNK_ID=
LIVEKIT_SIP_DISPATCH_RULE_ID=
```

These are resource identifiers, not credentials, but keeping them configurable prevents accidental use of the wrong trunk.

### Avoid the Build-plan cold start

During development and judging, run the LiveKit agent worker continuously on the demo laptop or an always-on server. Do not depend on a Build-plan cloud-deployed agent waking from zero.

## 3. Deepgram

Official reference: [Creating Deepgram API keys](https://developers.deepgram.com/docs/create-additional-api-keys).

1. Create or sign in to a Deepgram account.
2. Open the correct project.
3. Go to **Settings → API Keys → Create a New API Key**.
4. Give it a Steward-specific name and copy it immediately into `DEEPGRAM_API_KEY`; Deepgram does not show it again.

Start with:

```dotenv
DEEPGRAM_STT_MODEL=flux-general-en
DEEPGRAM_TTS_MODEL=aura-2-thalia-en
DEEPGRAM_TTS_SPEED=1.0
```

The TTS model is a starting audition candidate, not a permanent hard-coded voice. Before the demo, record the same phone script with at least three Aura-2 voices and select the most natural one by changing `DEEPGRAM_TTS_MODEL`.

Steward connects directly to Deepgram. These calls do not consume LiveKit's small Build-plan inference credit.

## 4. Supabase

Official reference: [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

1. Create one Supabase project for Steward.
2. Open the project's **Connect** dialog or **Settings → API Keys**.
3. Copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
4. Create or copy the `sb_publishable_...` key into `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
5. Create a backend-only `sb_secret_...` key into `SUPABASE_SECRET_KEY`.

Do not use the legacy `anon` and `service_role` keys for a new project. Never expose `SUPABASE_SECRET_KEY` in browser code. Row Level Security is still required even though the publishable key is safe to expose.

Supabase Auth supplies email OTP for owners, vendors, and demo guests. Its built-in email delivery is sufficient for the hackathon; a separate email provider is not required initially.

## 5. Stripe sandbox

Official references: [Stripe API keys](https://docs.stripe.com/keys) and [Stripe webhooks](https://docs.stripe.com/webhooks).

1. Create or sign in to Stripe.
2. Use a **Sandbox** or enable test mode.
3. Open **Developers/Workbench → API keys**.
4. Copy `pk_test_...` into `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
5. Copy `sk_test_...` into `STRIPE_SECRET_KEY`.
6. During local development, run Stripe CLI forwarding for the Steward webhook route. Copy the `whsec_...` value printed by `stripe listen` into `STRIPE_WEBHOOK_SECRET`.
7. For a deployed app, create a sandbox webhook endpoint in Workbench and replace the local signing secret with that endpoint's secret.

Only Stripe sandbox objects are permitted for the hackathon. The demo vendor payment must create a real Stripe test-mode side effect and record its ID; it must never move real money.

## 6. Langfuse

Official reference: [Langfuse API key environment variables](https://langfuse.com/docs/api-and-data-platform/features/cli#authentication).

1. Create a Langfuse Cloud account and one Steward project.
2. Open **Project Settings → API Keys**.
3. Create a key pair.
4. Copy the public key into `LANGFUSE_PUBLIC_KEY` and the secret key into `LANGFUSE_SECRET_KEY`.
5. Set the host that matches the selected region. For the US cloud:

```dotenv
LANGFUSE_BASE_URL=https://us.cloud.langfuse.com
LANGFUSE_ENVIRONMENT=development
```

Use Langfuse for LLM decisions, tool calls, prompts, errors, cost, and incident-level traces. Use LiveKit observability for calls, rooms, audio, transcripts, and media latency.

## 7. Application configuration

These values are chosen by the project and require no provider account:

```dotenv
NODE_ENV=development
APP_BASE_URL=http://localhost:3000
DEMO_GUEST_ACCESS_ENABLED=true
DEMO_PROPERTY_SLUG=steward-demo-home
GUEST_LINK_EXPIRY_DAYS=14
MAX_PARALLEL_VENDOR_CALLS=2
```

`DEMO_GUEST_ACCESS_ENABLED=true` allows an email-verified judge to enter a seeded demo booking without a live Airbnb or PMS record. It must be disabled outside the controlled demo environment.

`MAX_PARALLEL_VENDOR_CALLS=2` is a safe demo default, not a scenario-specific outcome. It limits resource use while keeping the sourcing logic dynamic.

## 8. Optional Google Places vendor discovery

Official reference: [Set up Places API (New)](https://developers.google.com/maps/documentation/places/web-service/get-api-key).

`GOOGLE_MAPS_API_KEY` is not required for the core hackathon path. Approved vendors and organizer test lines come first.

For post-hack external vendor discovery:

1. Create a Google Cloud project with billing enabled.
2. Enable **Places API (New)**.
3. Create an API key restricted to the Places API and the Steward server's allowed origins or IPs.
4. Put it in `GOOGLE_MAPS_API_KEY`.

During the hackathon, search results must not be cold-called. Only OTP-verified or organizer-controlled phone numbers may receive calls or texts.

## Completion checklist

- [ ] a1mobile phone number and SIP credentials are stored in `.env`.
- [ ] a1 image-input test passes with an unrelated image.
- [ ] a1/LiveKit inbound call reaches a unique incident room.
- [ ] a1/LiveKit outbound call reaches a verified test number.
- [ ] Deepgram Flux transcribes a real phone call.
- [ ] The selected Aura-2 voice has been auditioned over the phone.
- [ ] Supabase email OTP and Row Level Security smoke tests pass.
- [ ] Stripe creates and verifies a sandbox payment event.
- [ ] Langfuse receives an incident trace with tool spans.
- [ ] `.env` remains ignored and `.env.example` contains no secrets.
