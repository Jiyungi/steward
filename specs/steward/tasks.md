# Implementation Plan: Steward

## Overview

This plan is optimized for a short hackathon with two builders and one integration owner. It deliberately does not split work evenly.

The required sequence is:

1. Person 1 writes the complete specification and environment contract.
2. Person 1 creates and verifies every shared contract.
3. Both people branch from the same verified contract commit.
4. Person 1 builds the core system while Person 2 completes a few isolated visual/client tasks against fixtures.
5. Person 1 consolidates the branches, replaces fixtures with live adapters, and owns the release.

Person 2 must not wait for the voice agent, database, or telephony to become functional. Their branch must run against contract fixtures from the first parallel commit.

## Ownership and branch protocol

### Person 1 — primary and integration owner

Owns specifications, provisioning, monorepo foundation, shared contracts, Supabase, telephony, voice, reasoning, tools, vision, vendor orchestration, payments, monitoring, operational workspaces, consolidation, and final demo verification.

Suggested branch after the contract freeze:

```text
work/core-agent
```

### Person 2 — isolated visual/guest owner

Owns only:

1. The 3D landing page and its visual foundation.
2. The Guest temporary-access/live-incident frontend using shared fixtures.
3. Quality checks for those surfaces.

Suggested branch created from the contract-freeze commit:

```text
work/guest-visual
```

### Rules

- Person 1 lands the contract-freeze commit before either parallel branch starts.
- Person 2 does not modify `packages/contracts`, database migrations, provider adapters, environment names, or agent code.
- Person 2 uses fixture adapters that implement the same frontend interfaces as the future live endpoints.
- Contract changes are proposed to Person 1 and committed centrally.
- Person 1 performs the final merge and all live integration.
- Each builder makes small, descriptive commits and pushes the branch regularly.
- `.env`, secret values, call recordings containing private information, and unredacted screenshots are never committed.

## Task waves

| Wave | Owner | Purpose | Parallel? |
|---|---|---|---|
| 0 | Person 1 | Specifications and environment contract | No |
| 1 | Person 1 | Repository foundation and shared contracts | No |
| 2 | Person 1 | Provider provisioning gates and data foundation | No |
| 3A | Person 1 | Core agent, incidents, tools, and operational product | Yes |
| 3B | Person 2 | Three isolated visual/guest deliverables | Yes |
| 4 | Person 1 | Consolidation and live adapter wiring | No |
| 5 | Person 1 with Person 2 supporting | Voice, visual, resilience, and demo verification | Limited |

Person 2 starts Wave 3B immediately after the Task 1.6 contract-freeze commit while Person 1 continues through Wave 2 and Wave 3A. Person 2's tasks do not depend on provisioning, Supabase, SIP, the live agent, or any Wave 3A implementation task.

## Tasks

### Wave 0 — specification and provisioning contract

- [x] 0.1 Record the product requirements
  - Create `specs/steward/requirements.md`.
  - Include access roles, guest-link lifecycle, demo access, voice behavior, scope control, tool honesty, vision, vendors, budget, payment, evidence, UI, security, monitoring, demo rules, and collaboration constraints.
  - _Requirements: 1–24_
  - **Verification:** Every non-negotiable feature in `Md_files/steward-features.md` maps to at least one numbered requirement or an explicit out-of-scope item.

- [x] 0.2 Record the architecture and shared interfaces
  - Create `specs/steward/design.md`.
  - Define provider boundaries, monorepo layout, shared schemas, runtime flows, data model, UI direction, error handling, correctness properties, testing, and branch ownership.
  - _Requirements: 1–24_
  - **Verification:** Each requirement has an implementing component, contract, flow, table, or test strategy in the design.

- [x] 0.3 Record the contract-first implementation plan
  - Create this `tasks.md`.
  - Put shared contracts before the branch split.
  - Limit Person 2 to a few fixture-driven tasks independent of Person 1's live runtime.
  - _Requirements: 23_
  - **Verification:** The dependency graph has one explicit contract freeze, two parallel branches, and one consolidation owner.

- [x] 0.4 Create the environment template and provisioning guide
  - Create `.env.example` containing no secret values.
  - Create `Md_files/provisioning.md` beginning with a1mobile.
  - Document how every variable is obtained or chosen.
  - _Requirements: 5, 6, 14, 19–22_
  - **Verification:** Exact local `.env` values do not appear in tracked files; every `.env.example` variable appears in the guide.

### Wave 1 — Person 1 repository foundation and shared contracts

- [ ] 1.1 Scaffold the TypeScript workspace
  - Add pnpm workspaces for `apps/web`, `apps/agent`, and the packages defined in `design.md`.
  - Configure one TypeScript baseline, linting, formatting, Vitest, and shared scripts.
  - Add `.dockerignore` and preserve `.env` exclusions.
  - _Requirements: 20, 23, 24_
  - **Verification:** One clean install succeeds and placeholder tests run from the repository root.

- [ ] 1.2 Implement typed environment validation
  - Create server, agent, and public-client environment schemas.
  - Fail startup with variable names but never secret values.
  - Enforce that no server-only variable is exposed with a `NEXT_PUBLIC_` prefix.
  - Validate the demo flag, guest expiry, and vendor-call concurrency.
  - _Requirements: 2, 6, 19, 20, 22_
  - **Verification:** Tests accept `.env.example`-shaped configuration, reject each missing required value, and confirm client config contains no server secrets.

- [x] 1.3 Create the shared contract package
  - Implement Zod schemas and inferred TypeScript types for:
    - `ActorClaim`
    - `GuestLinkClaim` and `DemoGuestSession`
    - `IncidentSnapshot`
    - `IncidentEvent`
    - `VoiceStatusEvent`
    - `VisionRequest`
    - `ToolResult<T>`
    - `VendorQuote`
    - `PaymentRecord`
    - `VerifiedOutcome`
  - Include contract versioning and unknown-version failure.
  - _Requirements: 1–16, 19, 21, 23_
  - **Verification:** Contract tests parse valid and boundary fixtures and reject invalid fixtures for every schema.

- [ ] 1.4 Create shared frontend interfaces and fixtures
  - Define the frontend ports for guest session, incident subscription, LiveKit token acquisition, vision response, and connection state.
  - Add complete fixture timelines covering listening, thinking, tool pending, vision requested, camera denied, reconnecting, resolved, failed, and expired-link states.
  - Add a fixture-driven adapter usable without Supabase or the agent.
  - _Requirements: 2, 4, 10, 11, 18, 23, 24_
  - **Verification:** A minimal fixture page can move through every Guest state without a network request.

- [ ] 1.5 Create and verify the visual token contract
  - Add the OKLCH brand tokens from `design.md` to `packages/ui`.
  - Add typography, spacing, radii, shadow, motion-duration, z-index, focus, and semantic-state tokens.
  - Add shared accessible primitives only where both branches need them.
  - _Requirements: 17, 18, 24_
  - **Verification:** Automated contrast checks pass for body text, interactive text, focus, success, warning, danger, and both landing/product themes.

- [ ] 1.6 Freeze and publish the shared-contract baseline
  - Run environment, contract, fixture, and token tests.
  - Commit the shared packages and record the commit SHA in the branch handoff.
  - Push the baseline before creating `work/core-agent` and `work/guest-visual`.
  - _Requirements: 23_
  - **Verification:** Both new branches point to the same verified commit and have clean working trees.

### Wave 2 — Person 1 provisioning gates and data foundation

- [ ] 2.1 Complete a1mobile provisioning first
  - Claim or confirm the assigned phone number.
  - Store the phone number and SIP credentials only in `.env` and deployment secrets.
  - OTP-verify all personal demo recipients and identify organizer-controlled lines.
  - Send one real confirmation SMS.
  - _Requirements: 5, 6, 16, 20, 22_
  - **Verification:** The a1 dashboard or API confirms the assigned number and a real SMS arrives on a Controlled_Contact.

- [ ] 2.2 Gate the single a1 model for Responses, tools, and vision
  - Send a normal Responses request to `OPENAI_MODEL` through `OPENAI_BASE_URL`.
  - Execute one harmless typed tool call.
  - Send at least two unrelated images, including a non-property object, and inspect the model's actual descriptions.
  - If image input fails, stop vision implementation and select one replacement model/provider for all reasoning before continuing.
  - _Requirements: 9–12, 20, 22_
  - **Verification:** Text, tool calling, and honest image understanding pass using one recorded model identifier.

- [ ] 2.3 Provision and test LiveKit SIP
  - Create one inbound trunk, one individual dispatch rule, and one outbound trunk.
  - Save returned IDs in `.env`.
  - Run the agent worker continuously.
  - Test inbound calling from a controlled phone.
  - Test outbound calling to a controlled phone and record whether a1 enables it.
  - _Requirements: 5, 6, 20, 22_
  - **Verification:** Inbound creates a unique room and outbound reaches a Controlled_Contact, or outbound is recorded as a confirmed external blocker before the implementation plan is adjusted.

- [ ] 2.4 Provision and audition Deepgram
  - Create the Steward-specific API key.
  - Test Flux over real phone audio.
  - Record the same script with at least three Aura-2 voices through the call path.
  - Select the voice and speed by listening for natural pacing, fillers, codes, prices, and interruptions.
  - _Requirements: 7, 8, 20, 21_
  - **Verification:** The chosen `DEEPGRAM_TTS_MODEL` and speed are recorded in local configuration with an audition note and test recording reference outside Git.

- [ ] 2.5 Create the Supabase project, schema, seed, and RLS
  - Create migrations for every table in `design.md`.
  - Seed one Owner, one dual-role Owner/Vendor identity path, approved Controlled_Contacts, one demo property, and one demo booking template.
  - Add RLS for Owner, Vendor, and Guest scopes.
  - Create evidence storage policies.
  - _Requirements: 1–4, 11–19_
  - **Verification:** An authorization-matrix test proves each role can read and write only the intended rows and objects.

- [ ] 2.6 Provision Stripe sandbox and Langfuse
  - Add Stripe sandbox keys and local webhook forwarding.
  - Create one idempotent test payment and verify its webhook.
  - Create the Langfuse project and send one redacted trace with a tool span.
  - _Requirements: 14, 20–22_
  - **Verification:** Stripe and Langfuse dashboards show the expected test records without secrets or real money.

### Wave 3A — Person 1 core branch

- [ ] 3A.1 Implement Incident repository and event timeline
  - Implement create, resume, optimistic update, append event, and role-filtered read operations.
  - Enforce closure evidence and generic state guards.
  - Correlate incidents with rooms, calls, tools, evidence, and payments.
  - _Requirements: 3, 4, 15, 19, 21_
  - **Verification:** Unit and integration tests prove event ordering, replay, conflict handling, role filtering, and no closure without evidence.

- [ ] 3A.2 Implement permanent-role and temporary-guest backend flows
  - Implement Supabase email OTP integration.
  - Implement Role_Membership switching claims.
  - Implement high-entropy hashed Guest_Links, revocation, and checkout-plus-fourteen-day expiry.
  - Implement email-verified Demo_Guest_Session creation behind the feature flag.
  - Implement room-scoped LiveKit token issuance.
  - _Requirements: 1, 2, 19_
  - **Verification:** Browser/API tests cover dual role, valid guest, wrong email, expired, revoked, demo enabled, and demo disabled.

- [ ] 3A.3 Build the always-running LiveKit agent shell
  - Register `LIVEKIT_AGENT_NAME`.
  - Accept inbound rooms and attach Incident metadata.
  - Integrate Flux input and Aura-2 streaming output.
  - Implement cancellation and barge-in handling.
  - Emit `VoiceStatusEvent` fixtures as live events.
  - _Requirements: 5, 7, 8, 20–22_
  - **Verification:** A real call supports greeting, two complete turns, interruption, reconnect behavior, and persisted latency metrics.

- [ ] 3A.4 Implement one-model reasoning and scope control
  - Connect the a1 Responses gateway with `OPENAI_MODEL`.
  - Load the Incident_Goal, property context, budget, policies, evidence, tool schemas, and recent speech context.
  - Implement streaming tool calls.
  - Implement deterministic rejection/regeneration for unrelated long answers or unrelated tools.
  - _Requirements: 9, 12, 20_
  - **Verification:** The agent redirects recipes, donkey facts, and trivia naturally while continuing the incident, without using a second model.

- [ ] 3A.5 Implement the Human_Speech_Controller
  - Track communicative act, caller affect, risk, recent speech patterns, critical-data mode, and pending operations.
  - Produce varied contextual acknowledgements and optional disfluency.
  - Use Aura-compatible punctuation and pacing.
  - Emit grounded progress updates from actual tool state and observed latency.
  - Prevent filler in critical facts.
  - _Requirements: 7, 8, 10, 21_
  - **Verification:** Automated text checks and recorded call review show no consecutive canned pattern, no filler in critical facts, grounded wait updates, and acceptable latency.

- [ ] 3A.6 Implement typed tool dispatcher and a1 messaging
  - Persist `tool.started` before provider execution.
  - Normalize success, partial, failure, timeout, canceled, and unknown results.
  - Add idempotency and safe retry policy.
  - Implement a1 SMS and store the provider result.
  - _Requirements: 4, 10, 16, 20, 21_
  - **Verification:** Fixture and live tests cover successful SMS, rejected recipient, provider failure, timeout, retry, and no fabricated delivery.

- [ ] 3A.7 Implement camera request and same-model vision
  - Generate a `VisionRequest` only from current uncertainty.
  - Consume Guest permission events and LiveKit camera tracks.
  - Sample frames for the active question.
  - Send selected frames to the same configured reasoning model.
  - Store selected evidence only when needed.
  - _Requirements: 11, 12, 19, 20, 21_
  - **Verification:** Relevant object, unrelated fruit, dark frame, blurred frame, denial, and disconnect tests all produce honest, distinct behavior.

- [ ] 3A.8 Implement approved-vendor-first sourcing and vendor calls
  - Query Approved_Vendors before the optional external provider.
  - Enforce Controlled_Contact status for hackathon outreach.
  - Create isolated vendor-call rooms up to configured concurrency.
  - Extract `VendorQuote` from actual calls with unresolved fields preserved.
  - Rank options and persist rationale.
  - _Requirements: 6, 12, 13, 20, 21_
  - **Verification:** Tests cover approved success, no answer, decline, missing quote, multiple quotes, approved exhaustion, and blocked unverified outreach.

- [ ] 3A.9 Implement budget, Stripe sandbox payment, and closure
  - Enforce Owner policy and budget.
  - Create idempotent Stripe sandbox payment objects without Owner approval inside authority.
  - Verify webhook signatures and statuses.
  - Keep payment and outcome verification separate.
  - Close only with required Evidence_Records.
  - _Requirements: 12, 14, 15, 21, 22_
  - **Verification:** Tests cover within-budget success, over-budget block, duplicate request, payment failure, successful payment without resolved work, and resolved work with failed payment.

- [ ] 3A.10 Build Owner and Vendor operational surfaces
  - Build role switching.
  - Build Owner active-incident list and incident detail with timeline, evidence, vendors, costs, and final outcome.
  - Build Vendor jobs, quote, evidence, and payment surfaces.
  - Consume Shared_Contracts and Realtime events.
  - _Requirements: 1, 3, 4, 13–19, 24_
  - **Verification:** Role matrix, empty, loading, live, failure, payment, evidence, mobile, desktop, keyboard, and 200%-zoom tests pass.

- [ ] 3A.11 Wire incident observability and evaluation harness
  - Propagate correlation IDs across LiveKit, Supabase, Stripe, application logs, and Langfuse.
  - Redact secrets and unnecessary PII.
  - Add timing spans and evaluation fixtures.
  - Add a repeatable voice/vision adversarial test runner.
  - _Requirements: 7–11, 20–22_
  - **Verification:** One incident can be followed across both dashboards and local logs without revealing a secret.

### Wave 3B — Person 2 isolated branch

Person 2 starts only after Task 1.6. These tasks do not depend on Wave 3A runtime work.

- [ ] 3B.1 Build the visual foundation and 3D landing page
  - Consume the frozen `packages/ui` tokens.
  - Build the landing route with one interactive 3D property composition using React Three Fiber.
  - Communicate guest signal → Steward coordination → vendor/tool action → evidence-backed closure without pretending it is a fixed incident flow.
  - Keep above-the-fold copy minimal and provide one clear primary action.
  - Lazy-load compressed 3D assets.
  - Add reduced-motion and WebGL-unavailable static compositions.
  - Do not copy Apple assets, typography, layout, or choreography.
  - _Requirements: 17, 24_
  - **Verification:** The landing works with fixtures only, preserves navigation before 3D loads, passes reduced-motion and no-WebGL tests, and avoids the banned Impeccable patterns.

- [ ] 3B.2 Build the fixture-driven Guest access and incident surface
  - Use the frozen frontend ports and fixtures from Task 1.4.
  - Build email-verification, demo entry, link-validating, expired, revoked, connecting, and reconnecting states.
  - Build the simple conversation surface using `VoiceStatusEvent`.
  - Build inline `VisionRequest` acceptance, decline, camera permission, preview, denial, disconnect, and return-to-voice states.
  - Build resolved, failed, and escalated outcomes.
  - Do not call Supabase, LiveKit, a1mobile, or the agent directly in this branch.
  - _Requirements: 2, 11, 18, 23, 24_
  - **Verification:** Story/fixture controls traverse every state without live services, at 320px mobile width and desktop width.

- [ ] 3B.3 Complete visual, responsive, motion, and accessibility gates
  - Add Playwright coverage for the landing and Guest surface.
  - Add axe checks for functional content.
  - Verify keyboard flow, visible focus, text alternatives, non-color status, 200% zoom where applicable, and reduced motion.
  - Record visual snapshots for all fixture states.
  - Profile 3D loading and interaction on a mid-range laptop and phone.
  - Run an Impeccable critique and address all P0/P1 findings on Person 2-owned routes.
  - _Requirements: 17, 18, 23, 24_
  - **Verification:** All Person 2 checks pass on the isolated branch and the handoff notes list routes, fixtures, assets, performance results, and any nonblocking follow-ups.

### Wave 4 — Person 1 consolidation

- [ ] 4.1 Review and merge the Person 2 branch
  - Confirm Person 2 did not fork or duplicate Shared_Contracts.
  - Review the 3D asset licenses, bundle impact, fixture coverage, and Impeccable critique.
  - Merge with a deliberate commit.
  - _Requirements: 17, 18, 23, 24_
  - **Verification:** Main contains both branches, installs cleanly, passes all pre-merge checks, and has no unresolved contract duplication.

- [ ] 4.2 Replace Guest fixture adapters with live endpoints
  - Wire verified email sessions, Demo_Guest_Session creation, Guest_Link validation, LiveKit token acquisition, incident subscription, Vision_Request response, and camera publishing.
  - Retain fixture mode for tests and demonstrations when providers are intentionally disabled.
  - _Requirements: 2, 5, 11, 18, 19, 23_
  - **Verification:** The same UI state suite passes against fixtures and a live local environment; the camera is never requested before acceptance.

- [ ] 4.3 Integrate live status across voice and web
  - Publish `VoiceStatusEvent` and Incident events through the chosen Realtime path.
  - Ensure call, tool, vendor, evidence, payment, and resolution state agree across Guest and Owner surfaces.
  - _Requirements: 4–16, 18, 21_
  - **Verification:** One live incident produces consistent state on the phone, Guest page, Owner page, database, and trace.

- [ ] 4.4 Run consolidated security and secret audit
  - Scan tracked files and built client assets for exact secret values and secret-like patterns.
  - Verify RLS and token scope after frontend integration.
  - Confirm demo guest access cannot expose real bookings.
  - _Requirements: 2, 19, 21, 23_
  - **Verification:** Secret scan, client bundle scan, authorization matrix, expired-link, revoked-link, and demo-isolation tests pass.

### Wave 5 — final verification and demo

- [ ] 5.1 Tune voice latency and interruption on the real phone path
  - Measure end-of-turn to first audio and speech-start to playback-stop.
  - Tune Flux thresholds and streaming behavior from recordings.
  - Remove repeated filler and written-language responses.
  - Confirm clear codes, prices, times, addresses, safety statements, and payment outcomes.
  - _Requirements: 7, 8, 10, 21, 22_
  - **Verification:** Recorded runs meet the defined latency targets or document the exact measured miss and mitigation before judging.

- [ ] 5.2 Run the adversarial voice and vision matrix
  - Test interruption, mumbling, correction, anger, long pauses, donkeys, recipes, irrelevant images, camera denial, tool delay, tool failure, vendor no-answer, contradictory evidence, and payment failure.
  - Review recordings and traces.
  - _Requirements: 7–15, 21, 22_
  - **Verification:** Steward remains incident-focused, does not hallucinate visual objects or success, and preserves an honest timeline in every run.

- [ ] 5.3 Run live side-effect checks
  - Receive an inbound a1 call.
  - Make an allowed outbound call if provisioning permits.
  - Send an a1 SMS to a Controlled_Contact.
  - Create and verify a Stripe sandbox payment.
  - Show each result in the Owner timeline.
  - _Requirements: 5, 6, 14–16, 20–22_
  - **Verification:** Each claimed side effect is independently visible in the responsible provider and linked to the Incident.

- [ ] 5.4 Run visual and product quality gates
  - Run the Impeccable critique, audit, and polish passes on the landing, Guest, Owner, and Vendor routes.
  - Run responsive, keyboard, axe, reduced-motion, no-WebGL, and visual regression tests.
  - Confirm copy is concise and no AI-slop patterns were introduced during consolidation.
  - _Requirements: 17, 18, 24_
  - **Verification:** No P0/P1 design or accessibility issue remains and the critical flows work without the 3D scene.

- [ ] 5.5 Rehearse the live judge path without a scripted incident
  - Use a teammate to invent an incident unknown to the operator.
  - Introduce at least one planted failure and one off-topic interruption.
  - Allow the agent to choose whether vision is needed.
  - Require a real verifiable side effect and honest final status.
  - _Requirements: 11–16, 21, 22_
  - **Verification:** The complete run finishes without editing code, manually changing database state, whispering a script, or claiming an unsupported success.

- [ ] 5.6 Create the release commit and demo tag
  - Confirm the working tree contains only intended files.
  - Commit all final verified changes with the GitHub-linked author identity.
  - Push `main` and create a demo tag.
  - Record the deployed URLs, a1 phone number, provider preflight status, and known limitations in the README without secrets.
  - _Requirements: 22, 23_
  - **Verification:** GitHub shows the release commit and tag; a fresh checkout can reach the documented demo using provisioned secrets.

## Dependency graph

```json
{
  "integration_owner": "person_1",
  "contract_freeze_task": "1.6",
  "waves": [
    {
      "id": 0,
      "name": "Specifications and environment contract",
      "owner": "person_1",
      "tasks": ["0.1", "0.2", "0.3", "0.4"]
    },
    {
      "id": 1,
      "name": "Repository and shared contracts",
      "owner": "person_1",
      "depends_on": [0],
      "tasks": ["1.1", "1.2", "1.3", "1.4", "1.5", "1.6"]
    },
    {
      "id": 2,
      "name": "Provisioning gates and data foundation",
      "owner": "person_1",
      "depends_on": [1],
      "tasks": ["2.1", "2.2", "2.3", "2.4", "2.5", "2.6"]
    },
    {
      "id": "3A",
      "name": "Core system",
      "owner": "person_1",
      "depends_on": [2],
      "tasks": ["3A.1", "3A.2", "3A.3", "3A.4", "3A.5", "3A.6", "3A.7", "3A.8", "3A.9", "3A.10", "3A.11"]
    },
    {
      "id": "3B",
      "name": "Isolated visual and guest client",
      "owner": "person_2",
      "depends_on": ["1.6"],
      "independent_of": ["3A"],
      "tasks": ["3B.1", "3B.2", "3B.3"]
    },
    {
      "id": 4,
      "name": "Consolidation",
      "owner": "person_1",
      "depends_on": ["3A", "3B"],
      "tasks": ["4.1", "4.2", "4.3", "4.4"]
    },
    {
      "id": 5,
      "name": "Final verification and release",
      "owner": "person_1",
      "support": "person_2",
      "depends_on": [4],
      "tasks": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6"]
    }
  ],
  "completion_rule": "A task is complete only after its stated verification passes.",
  "parallel_rule": "Person 2 may start only from the verified contract-freeze commit and must remain independent of Wave 3A runtime work.",
  "merge_rule": "Person 1 consolidates the branches and owns the release commit."
}
```

## Immediate next actions

1. Complete Tasks 2.1 through 2.4 before spending time on application screens.
2. Start implementation with Tasks 1.1 through 1.6 and publish the contract-freeze commit.
3. Create both parallel branches from that commit.
4. Give Person 2 only Tasks 3B.1 through 3B.3.
5. Keep Person 1 focused on the live phone loop until a real inbound call can be interrupted, use a tool, and speak an honest result.

## Notes

- `tasks.md` is intentionally unbalanced. Person 2 has three meaningful but isolated tasks; Person 1 owns the product's critical path.
- Do not make Person 2 wait for live backend APIs. Fixtures are part of the shared contract and are the intended integration boundary.
- Do not add work merely to make the split look equal.
- Do not mark voice quality complete from transcripts alone.
- Do not mark vision complete with only a lock image; use unrelated and contradictory images.
- Do not mark payment complete from a client response alone; verify the Stripe sandbox event.
- Do not let the 3D landing page delay the inbound voice loop.
- Every implementation change is committed and pushed after its verification passes.
