# Requirements Document

## Introduction

Steward is an autonomous, voice-first property manager for short-term rentals. It answers guest calls, understands the real problem, requests visual evidence only when useful, attempts safe troubleshooting, coordinates approved vendors before searching externally, spends within an owner-defined budget, and verifies the result before reporting success or issuing a test-mode payment.

The hackathon implementation must close a real loop against systems and people it does not control. The judged experience is not a scripted lock demonstration. A judge may report any property problem, show any object to the camera, interrupt, mumble, change the subject, or cause a tool to fail. Steward must reason from the actual input and actual tool results.

The product has three participant types:

- Owners and vendors have permanent accounts. One identity may hold either or both roles.
- Guests normally use a temporary booking-scoped link and verify the booking email rather than creating a permanent account.
- During the hackathon, an email-verified judge may enter a seeded demo guest experience without an external booking-platform record.

## Non-negotiable product rules

1. **a1mobile first.** The hackathon phone number, SIP credentials, controlled test lines, SMS side effects, and primary OpenAI-compatible model gateway come from a1mobile.
2. **No hard-coded incident outcomes.** No scripted diagnosis, fixed “the lock is broken” response, arbitrary one-minute reveal, or object assumption may determine an outcome.
3. **One multimodal LLM.** Conversation, planning, tool selection, and image reasoning use the same configured model. If the a1 model cannot accept images, replace it for the whole reasoning path rather than adding a second vision-only model.
4. **No fabricated success.** Steward may report a call, booking, message, verification, or payment as complete only when a real tool result or evidence record confirms it.
5. **Controlled endpoints and test money.** During the hackathon, Steward calls or texts only OTP-verified numbers and organizer test lines, and uses Stripe sandbox objects only.
6. **The voice is the primary product.** The voice experience must remain natural, interruptible, focused, concise, and honest under latency and failure.
7. **Shared contracts before parallel implementation.** Person 1 defines and verifies all cross-branch contracts before Person 2 begins isolated work. Parallel branches integrate only through those contracts until consolidation.

## Glossary

- **Steward_System**: The complete web, voice-agent, data, telephony, vision, tool, and monitoring system.
- **Owner**: A permanent user who manages properties, policies, budgets, incidents, and approved vendors.
- **Vendor**: A permanent user or vendor record that receives work, communicates availability and quotes, submits evidence, and receives payment status.
- **Guest**: A temporary participant associated with a booking or seeded demo booking.
- **Identity**: A Supabase-authenticated person, identified primarily by verified email.
- **Role_Membership**: The relationship granting an Identity the Owner role, Vendor role, or both.
- **Role_Workspace**: The role-specific product surface and authorization boundary selected after login.
- **Guest_Link**: A high-entropy, revocable booking-scoped URL whose validity ends fourteen days after checkout.
- **Demo_Guest_Session**: An email-verified guest session attached to a seeded demo property when no booking-platform integration exists.
- **Incident**: The durable record of one reported problem, its participants, evidence, decisions, tool results, costs, and outcome.
- **Incident_Goal**: The current property-related outcome Steward is trying to achieve for the caller.
- **Incident_Timeline**: The append-only sequence of voice turns, decisions, tool calls, results, messages, evidence, quotes, status changes, and payments.
- **Approved_Vendor**: A vendor the Owner configured for a property or service category.
- **External_Vendor**: A vendor discovered outside the approved list after approved options prove unavailable or unsuitable.
- **Controlled_Contact**: An OTP-verified phone number or organizer-provided test line allowed by the hackathon.
- **Live_Voice_Session**: A LiveKit room containing a caller or browser participant and a running Steward agent.
- **Vendor_Call_Session**: A separate LiveKit room and SIP participant used to call one vendor without exposing other vendor conversations.
- **Vision_Request**: A structured agent request asking the Guest to enable a camera because visual evidence would materially help the active Incident.
- **Evidence_Record**: A photo, sampled frame, guest confirmation, vendor submission, smart-device result, or tool result tied to an Incident.
- **Tool_Result**: A typed success, failure, timeout, or partial result returned by an external action.
- **Verified_Outcome**: An Incident outcome supported by one or more Evidence_Records or authoritative Tool_Results.
- **Autonomous_Budget**: The Owner-configured amount and policy within which Steward may act without requesting approval.
- **Human_Speech_Controller**: The component controlling acknowledgements, contextual disfluencies, pacing, interruption, and truthful tool-wait updates.
- **Shared_Contracts**: Versioned Zod schemas and TypeScript types defining events, commands, API inputs, API outputs, tool results, and UI fixtures shared across branches.
- **Person_1**: The primary builder who owns specifications, Shared_Contracts, core voice, backend, tools, integration, and consolidation.
- **Person_2**: The parallel builder who owns only the isolated visual and guest-client tasks assigned after the Shared_Contracts freeze.

## Requirements

### Requirement 1: Permanent identities and multiple roles

**User Story:** As a person who may own properties and also perform vendor work, I want one identity with role-specific access, so that I do not maintain duplicate accounts.

#### Acceptance Criteria

1. THE Steward_System SHALL allow one Identity to hold Owner, Vendor, or both Role_Memberships.
2. WHEN an Identity has more than one Role_Membership, THE Steward_System SHALL provide an explicit workspace switcher.
3. WHEN a user switches roles, THE Steward_System SHALL change the visible navigation, permissions, and data scope without creating a new login session.
4. THE Owner Role_Workspace SHALL expose only owner-authorized properties, incidents, budgets, vendor configuration, and outcomes.
5. THE Vendor Role_Workspace SHALL expose only jobs, access details, messages, Evidence_Record requests, quotes, and payment status authorized for that vendor.
6. IF an Identity lacks a requested Role_Membership, THEN THE Steward_System SHALL reject access on the server and SHALL NOT rely only on hidden client controls.

### Requirement 2: Temporary guest access and hackathon entry

**User Story:** As a guest with a confirmed stay, I want a temporary link instead of another permanent account, so that I can get help with minimal friction.

#### Acceptance Criteria

1. THE Steward_System SHALL represent production guest access with a unique Guest_Link tied to exactly one booking and property.
2. THE Guest_Link SHALL expire fourteen calendar days after the booking checkout time.
3. THE Guest_Link SHALL be revocable before its natural expiration.
4. WHEN a production Guest opens a valid Guest_Link, THE Steward_System SHALL require verification of the email associated with the booking before revealing booking-specific data.
5. IF the Guest_Link is invalid, expired, revoked, or belongs to a different verified email, THEN THE Steward_System SHALL deny booking-specific access and present a recovery path.
6. WHEN `DEMO_GUEST_ACCESS_ENABLED` is true, THE Steward_System SHALL allow an email-verified judge without a matching external booking record to enter a Demo_Guest_Session attached to the seeded demo property.
7. THE demo path SHALL NOT require a fake Airbnb, Vrbo, or PMS integration and SHALL remain distinguishable in stored data from a production booking.
8. WHEN `DEMO_GUEST_ACCESS_ENABLED` is false, THE Steward_System SHALL NOT create Demo_Guest_Sessions.

### Requirement 3: Property, booking, policy, budget, and vendor context

**User Story:** As an Owner, I want Steward to understand each property and my operating constraints, so that it can make appropriate decisions.

#### Acceptance Criteria

1. THE Steward_System SHALL store properties, bookings, access instructions, appliances, Wi-Fi instructions, policies, Autonomous_Budgets, known hazards, and approved vendors as structured data.
2. THE Steward_System SHALL load only the active property's context into an Incident.
3. THE Steward_System SHALL allow an Owner to configure Approved_Vendors by service category and priority.
4. THE Steward_System SHALL store vendor contact consent or Controlled_Contact status before any hackathon call or text.
5. IF required property context is unavailable, THEN Steward SHALL state what is missing and reason from available evidence rather than inventing instructions.
6. THE Steward_System SHALL treat Owner policies and the Autonomous_Budget as constraints, not suggestions.

### Requirement 4: Durable incident management

**User Story:** As an Owner, I want every problem tracked as one coherent incident, so that I can understand what happened from report to outcome.

#### Acceptance Criteria

1. WHEN a guest call, message, or demo report begins, THE Steward_System SHALL create or resume exactly one Incident.
2. THE Incident SHALL include the Incident_Goal, property, booking or demo session, participants, current state, available budget, incurred cost, evidence, and final outcome.
3. THE Incident_Timeline SHALL record every meaningful decision, external action, Tool_Result, Evidence_Record, message, quote, and payment reference with timestamps.
4. THE Steward_System SHALL support generic states including reported, triaging, diagnosing, sourcing, vendor-contacting, scheduled, verification-pending, resolved, failed, and escalated without treating that list as a scripted scenario path.
5. WHEN a Tool_Result, caller correction, or new Evidence_Record changes the facts, THE Steward_System SHALL replan from the updated Incident rather than continue an obsolete action sequence.
6. THE Incident SHALL NOT enter `resolved` without a Verified_Outcome.

### Requirement 5: a1mobile inbound calling through LiveKit

**User Story:** As a Guest, I want to call a real number and immediately reach Steward, so that help feels available at the moment of need.

#### Acceptance Criteria

1. THE Steward_System SHALL receive calls placed to `A1MOBILE_PHONE_NUMBER` through the configured a1mobile SIP credentials and LiveKit inbound trunk.
2. THE LiveKit dispatch rule SHALL create a unique room for each inbound call and dispatch `LIVEKIT_AGENT_NAME`.
3. WHEN the caller is connected, THE Steward_System SHALL create or resume the correct Incident before requesting sensitive property details.
4. THE agent worker SHALL be running and registered before the judging window so the Build-plan cloud cold start is not on the critical path.
5. IF the agent cannot join, THEN the call SHALL fail honestly or follow a configured safe fallback and SHALL NOT play a fabricated success message.
6. THE Steward_System SHALL preserve caller identity metadata required for audit while masking it from unauthorized product surfaces.

### Requirement 6: Outbound vendor calling and isolation

**User Story:** As an Owner, I want Steward to call vendors and collect real answers, so that I do not coordinate the incident myself.

#### Acceptance Criteria

1. THE Steward_System SHALL create outbound vendor calls through the configured LiveKit outbound SIP trunk and a1mobile credentials only after outbound permission passes provisioning verification.
2. DURING the hackathon, THE Steward_System SHALL call only Controlled_Contacts.
3. EACH Vendor_Call_Session SHALL use a separate LiveKit room so one vendor cannot hear another vendor or the Guest.
4. THE Steward_System SHALL attach each Vendor_Call_Session to the originating Incident.
5. THE maximum concurrent outbound calls SHALL be configurable through `MAX_PARALLEL_VENDOR_CALLS`.
6. WHEN a vendor does not answer, declines, provides an unusable quote, or fails a required condition, THE Steward_System SHALL record the actual outcome and continue sourcing when policy permits.
7. THE Steward_System SHALL NOT describe a vendor as booked until a real call or tool result confirms acceptance.

### Requirement 7: Conversational transcription, turn detection, and interruption

**User Story:** As a caller, I want Steward to know when I am finished and stop when I interrupt, so that the conversation feels human.

#### Acceptance Criteria

1. THE Live_Voice_Session SHALL stream caller audio to the configured Deepgram Flux model.
2. THE Steward_System SHALL use conversational end-of-turn signals rather than a fixed silence timer as the primary turn boundary.
3. WHEN the caller interrupts, THE Steward_System SHALL stop or yield active TTS promptly, preserve the interruption transcript, and answer from the updated context.
4. THE system SHALL target a measured p95 of 500 milliseconds or less from detected caller speech to stopped agent playback under the demo network.
5. THE system SHALL target a median of 1.0 seconds or less and p95 of 2.0 seconds or less from final end-of-turn detection to first meaningful agent audio for turns that do not require a blocking tool result.
6. IF audio is unintelligible or incomplete, THEN Steward SHALL ask a focused clarification rather than guess.
7. THE Steward_System SHALL retain timing measurements for end-of-turn, first model token, first TTS byte, first played audio, and interruption stop.

### Requirement 8: Human speech, pacing, and emotional calibration

**User Story:** As a stressed Guest, I want Steward to sound like a capable person rather than a scripted bot, so that I can communicate naturally.

#### Acceptance Criteria

1. THE Human_Speech_Controller SHALL produce concise spoken-language responses rather than paragraph-style written answers.
2. Steward MAY use contextually appropriate markers such as “um,” “uh,” “hmm,” “mm-hmm,” breaths, and pauses, but SHALL avoid mechanically inserting them into every response.
3. THE Human_Speech_Controller SHALL track recently used acknowledgement patterns and SHALL avoid obvious consecutive repetition.
4. Steward SHALL NOT use filler while speaking access codes, prices, times, addresses, safety instructions, payment confirmations, or final outcomes.
5. Steward SHALL adapt tone to caller distress and incident risk without becoming theatrical, falsely cheerful, or alarmist.
6. Steward SHALL remember facts already provided or shown and SHALL NOT ask for them again unless they remain unclear or contradictory.
7. THE selected Aura-2 voice and speed SHALL be configurable and SHALL be chosen from phone-call recordings rather than browser-only samples.

### Requirement 9: Incident scope and natural off-topic redirection

**User Story:** As an Owner, I want Steward to stay focused on property operations, so that it cannot be diverted into a general-purpose assistant during an incident.

#### Acceptance Criteria

1. THE reasoning context SHALL contain an explicit Incident_Goal and permitted operational scope.
2. WHEN the caller asks for unrelated recipes, animal facts, trivia, entertainment, or other general-assistant work, Steward SHALL acknowledge the shift briefly and redirect naturally to the unresolved Incident_Goal.
3. Steward SHALL NOT perform unrelated tool calls or provide a long unrelated answer while the Incident remains active.
4. Steward MAY answer a short clarification that directly affects safety, accessibility, communication, or the property incident.
5. WHEN the caller explicitly ends or abandons the incident, Steward SHALL confirm that intent and record the incomplete outcome honestly.
6. Scope enforcement SHALL use the same configured LLM and deterministic policy checks; it SHALL NOT add a second classifier model.

### Requirement 10: Honest speech during tool latency

**User Story:** As a caller, I want to know Steward is still working without hearing fake progress, so that waiting feels natural and trustworthy.

#### Acceptance Criteria

1. WHEN a real tool call begins, THE Steward_System SHALL make the pending tool name, purpose, start time, and observable state available to the Human_Speech_Controller.
2. Steward MAY emit a short acknowledgement while a tool is pending, provided it does not delay tool initiation.
3. IF the wait exceeds the tool's expected latency budget, THEN Steward MAY provide a longer status update grounded in the actual pending state.
4. THE Steward_System SHALL adapt progress timing from real elapsed time and observed or declared tool latency rather than an incident-specific scripted timer.
5. Steward SHALL NOT claim to have found, booked, sent, paid, unlocked, or verified anything before the corresponding Tool_Result exists.
6. WHEN a tool fails or times out, Steward SHALL state the failure plainly, preserve partial results, and offer or attempt a permitted alternative.

### Requirement 11: Camera-on-demand and honest visual reasoning

**User Story:** As a Guest, I want to show Steward a problem only when useful, so that I can get better help without unnecessary camera access.

#### Acceptance Criteria

1. THE guest surface SHALL NOT request camera permission on page load or merely because an Incident exists.
2. WHEN the configured LLM determines that visual evidence would materially reduce uncertainty, THE Steward_System SHALL issue a Vision_Request explaining what Steward needs to inspect and why.
3. THE Guest SHALL explicitly accept or decline the Vision_Request before the browser requests camera permission.
4. WHEN accepted, THE guest client SHALL publish a camera track to the Incident's LiveKit room.
5. THE agent SHALL sample only the frames required for the active diagnostic question and SHALL send them to the same configured multimodal LLM used for conversation and planning.
6. THE LLM SHALL describe and reason from what the frame actually contains and SHALL NOT assume the object is a lock, appliance, leak, or expected demo prop.
7. IF the camera is declined, unavailable, disconnected, dark, blurry, or irrelevant, THEN Steward SHALL continue using voice clarification or another permitted evidence source.
8. Visual conclusions SHALL be stored as claims linked to the source frame and SHALL remain unverified until corroborated when the decision carries material cost or safety risk.

### Requirement 12: Dynamic troubleshooting and replanning

**User Story:** As an Owner, I want Steward to try safe low-cost resolutions before dispatching help, so that it protects guest experience and property profit.

#### Acceptance Criteria

1. THE configured LLM SHALL receive current Incident facts, property context, policies, Autonomous_Budget, available tools, actual voice and visual input, and prior Tool_Results.
2. Steward SHALL compare candidate actions by safety, expected effectiveness, time, cost, guest impact, and reversibility.
3. Steward SHALL attempt safe guided troubleshooting when it is reasonable and SHALL NOT delay emergency or safety escalation to save money.
4. Steward SHALL ask only the next useful question or instruction rather than reciting a fixed diagnostic tree.
5. WHEN the Guest reports the result of a troubleshooting step, Steward SHALL update the Incident and re-evaluate the plan.
6. IF evidence contradicts the current hypothesis, THEN Steward SHALL revise the hypothesis rather than defend the earlier answer.
7. No acceptance test SHALL depend on a particular incident category, object, elapsed minute, or scripted judge phrase.

### Requirement 13: Approved vendors, discovery, quotes, and selection

**User Story:** As an Owner, I want preferred vendors tried first and alternatives compared intelligently, so that Steward respects relationships without getting stuck.

#### Acceptance Criteria

1. Steward SHALL contact suitable available Approved_Vendors before initiating External_Vendor discovery.
2. Steward MAY contact multiple suitable vendors concurrently within `MAX_PARALLEL_VENDOR_CALLS`.
3. THE Steward_System SHALL capture availability, arrival time, quoted price, scope, conditions, and guarantees from actual vendor responses.
4. IF Approved_Vendors are unavailable, unsuitable, or outside policy, THEN Steward MAY search an enabled external discovery provider.
5. DURING the hackathon, external discovery SHALL NOT authorize cold outreach to an unverified number.
6. Steward SHALL rank viable options using the current Incident's safety, speed, price, confidence, and guest-impact needs.
7. Steward SHALL record why the chosen vendor won and why rejected options were not selected.
8. Steward SHALL NOT manufacture a quote or infer acceptance from silence.

### Requirement 14: Autonomous budget and Stripe test payment

**User Story:** As an Owner, I want Steward to act within a delegated budget and produce a verifiable payment record, so that routine incidents close without waiting for me.

#### Acceptance Criteria

1. THE Incident SHALL load the applicable Autonomous_Budget and spending policy before committing money.
2. DURING the hackathon, Steward SHALL NOT request Owner approval for a permitted vendor payment within the Autonomous_Budget.
3. Steward SHALL NOT create a payment until the selected vendor, agreed amount, Incident, and required pre-payment evidence are present.
4. THE payment adapter SHALL use Stripe sandbox credentials only.
5. EACH payment attempt SHALL use an idempotency key tied to the Incident and payment purpose.
6. THE Incident_Timeline SHALL store the Stripe object ID, amount, currency, vendor reference, status, and verified webhook result.
7. Steward SHALL report payment success only after an authoritative Stripe Tool_Result or verified webhook confirms it.
8. IF payment fails, THEN Steward SHALL state the failure, preserve the vendor agreement, and replan without claiming the vendor was paid.

### Requirement 15: Proof of work and verified closure

**User Story:** As an Owner and Guest, we want proof that the problem was resolved, so that nobody confuses activity with an outcome.

#### Acceptance Criteria

1. Steward SHALL define the evidence needed to close the current Incident based on the actual problem and risk.
2. Evidence MAY include Guest confirmation, vendor media, camera inspection, receipt, sandbox tool result, or smart-device state.
3. THE Steward_System SHALL preserve evidence provenance, timestamp, submitter, and Incident relationship.
4. Steward SHALL distinguish “vendor scheduled,” “work reported complete,” and “outcome verified.”
5. THE Incident SHALL enter `resolved` only after required evidence supports a Verified_Outcome.
6. IF verification is inconclusive, THEN Steward SHALL keep the Incident open, request additional evidence, or escalate.
7. The owner view SHALL make the final evidence and payment relationship visible without requiring log inspection.

### Requirement 16: SMS and participant updates

**User Story:** As a Guest, Owner, or Vendor, I want accurate updates without coordinating everyone myself, so that I know what will happen next.

#### Acceptance Criteria

1. THE Steward_System SHALL send hackathon SMS through a1mobile only to Controlled_Contacts.
2. Messages SHALL be generated from current Incident state and real Tool_Results.
3. THE system SHALL record the provider result for every send attempt.
4. Steward SHALL NOT describe an SMS as delivered merely because it attempted a request.
5. Updates SHALL be concise and role-appropriate, excluding information the recipient is not authorized to see.
6. WHEN an action fails after an earlier update, THE system SHALL send or display a correction when the recipient would otherwise rely on stale information.

### Requirement 17: Three-dimensional landing page and brand system

**User Story:** As a prospective Owner or judge, I want to understand Steward quickly through a memorable visual experience, so that the product feels differentiated before the demo begins.

#### Acceptance Criteria

1. THE landing page SHALL use an interactive three-dimensional property composition built with Three.js through React Three Fiber.
2. THE 3D narrative SHALL communicate the relationship among a property, Guest contact, Steward, vendor action, evidence, and verified resolution without depicting a scripted diagnosis as real product behavior.
3. THE page SHALL use minimal copy, one clear primary action, and no wordy feature dump above the fold.
4. THE visual direction MAY take inspiration from the spatial restraint and presentation quality of Apple's Vision Pro page but SHALL NOT copy Apple's product, assets, typography, layout, or choreography.
5. THE initial palette SHALL use a near-black neutral landing surface, a harbor-blue primary anchored near hue 230, a clearly differentiated signal-amber accent, and high-contrast neutral text, expressed in OKLCH tokens.
6. THE authenticated product SHALL use a restrained light variant of the same palette rather than forcing the dark landing theme into operational screens.
7. THE design SHALL NOT use gradient text, decorative glassmorphism, generic repeated card grids, tiny uppercase labels on every section, or meaningless hero metrics.
8. THE 3D scene SHALL lazy-load, avoid blocking the initial navigation and copy, and provide a static fallback when WebGL is unavailable.
9. WHEN reduced motion is requested, THE page SHALL remove scroll-bound camera choreography and preserve content and navigation in a stable composition.

### Requirement 18: Owner, vendor, guest, and conversation surfaces

**User Story:** As each participant, I want a focused interface for my role, so that I see the next action without product clutter.

#### Acceptance Criteria

1. THE Owner Role_Workspace SHALL prioritize active Incidents, risk, budget usage, pending actions, vendor status, evidence, and Verified_Outcomes.
2. THE Vendor Role_Workspace SHALL prioritize available jobs, accepted work, access instructions, quote submission, evidence submission, and payment status.
3. THE Guest surface SHALL prioritize the current conversation, next instruction, Vision_Request, camera state, and resolution status.
4. THE chat and live-incident surface SHALL remain visually polished but SHALL NOT surround every message or status with nested cards.
5. Loading states SHALL use contextual skeletons or explicit connection states rather than an unexplained spinner.
6. Empty states SHALL teach the relevant first action.
7. Error states SHALL explain what failed, what remains safe, and what the user can do next.
8. Owner and Vendor interfaces SHALL remain usable on desktop and mobile; the Guest surface SHALL be mobile-first.

### Requirement 19: Authentication, authorization, and data protection

**User Story:** As an Owner, Vendor, or Guest, I want my information limited to the appropriate people and time window, so that Steward can be trusted with access and incident data.

#### Acceptance Criteria

1. THE Steward_System SHALL use Supabase Auth for email verification and authenticated sessions.
2. THE database SHALL enable Row Level Security for every user-accessible table.
3. Owner policies SHALL authorize only properties owned by or delegated to that Identity.
4. Vendor policies SHALL authorize only assigned or legitimately discoverable job data required for vendor action.
5. Guest policies SHALL authorize only the active booking or Demo_Guest_Session and associated Incident data.
6. `SUPABASE_SECRET_KEY`, `LIVEKIT_API_SECRET`, SIP password, Stripe secret, Deepgram key, Langfuse secret, and a1mobile keys SHALL remain server-side.
7. LiveKit participant tokens SHALL be short-lived, room-scoped, identity-specific, and generated by a trusted backend endpoint.
8. THE system SHALL record security-relevant access changes and Guest_Link revocation.
9. Camera tracks and captured frames SHALL NOT be exposed outside the authorized Incident.

### Requirement 20: Provider boundaries and one-model rule

**User Story:** As a builder, I want clear provider responsibilities, so that the system remains debuggable and does not accidentally duplicate expensive capabilities.

#### Acceptance Criteria

1. a1mobile SHALL provide the hackathon phone identity, controlled calling/SMS rails, SIP credentials, and primary OpenAI-compatible Responses gateway.
2. LiveKit SHALL provide real-time rooms, SIP participants, media transport, agent sessions, and call observability.
3. Deepgram Flux SHALL provide speech-to-text and conversational turn signals.
4. Deepgram Aura-2 SHALL provide text-to-speech.
5. The configured a1 LLM SHALL provide conversation reasoning, scope decisions, planning, tool selection, and image understanding if its image-input provisioning test passes.
6. Supabase SHALL provide authentication, Postgres data, Realtime updates, and evidence storage.
7. Stripe SHALL provide test-mode payment side effects and webhook verification.
8. Langfuse SHALL provide LLM and tool traces; it SHALL NOT replace LiveKit media observability.
9. The implementation SHALL NOT add Pipecat, VoiceOS, browser control, or computer-use automation to the hackathon scope.
10. A provider change SHALL preserve the Shared_Contracts so the rest of the system does not depend on vendor-specific response shapes.

### Requirement 21: Observability, evaluation, and honesty audit

**User Story:** As a builder, I want one trace from call to outcome, so that I can find latency, reasoning, and tool failures before judging.

#### Acceptance Criteria

1. EACH Incident SHALL have a correlation identifier shared across LiveKit metadata, application logs, Langfuse traces, Tool_Results, database records, and Stripe metadata.
2. THE Steward_System SHALL record voice timing, LLM timing, tool timing, TTS timing, interruption events, and call outcomes without logging secret values.
3. Langfuse SHALL capture model inputs and outputs only after sensitive-field redaction appropriate to the demo.
4. THE system SHALL emit structured success, partial, failure, timeout, canceled, and unknown tool outcomes.
5. THE evaluation set SHALL include normal reports, interruptions, mumbling, off-topic requests, contradictory answers, irrelevant camera objects, camera denial, slow tools, failed tools, unavailable vendors, payment failure, and inconclusive evidence.
6. THE demo SHALL NOT be approved unless recordings are reviewed for repetition, robotic pacing, overlong answers, false empathy, talking over callers, and unsupported success claims.
7. THE system SHALL expose current LiveKit Build-plan usage and external provider usage before the judging run.

### Requirement 22: Hackathon demo path and resilience

**User Story:** As a judge, I want to use the real product with an unseen scenario and planted friction, so that Steward proves it can adapt rather than replay a demo.

#### Acceptance Criteria

1. THE demo SHALL start from a real inbound call or a judge-accessible Guest surface connected to the same live agent.
2. THE judge SHALL be able to report an arbitrary property incident in natural language.
3. THE demo SHALL tolerate at least one unavailable option, tool failure, ambiguity, interruption, or contradictory input without fabricating success.
4. THE demo SHALL produce at least one externally verifiable side effect, such as a real a1mobile SMS, controlled call result, stored booking-like action, or Stripe sandbox payment.
5. THE demo SHALL show the Incident_Timeline and final evidence in the Owner Role_Workspace.
6. THE agent worker, a1mobile number, LiveKit trunks, verified test lines, Deepgram key, database, Stripe webhook, and Langfuse trace ingestion SHALL pass preflight before judging.
7. IF a required provider is unavailable, THEN Steward SHALL report the actual blocker and preserve all completed side effects.
8. The demo SHALL NOT depend on a prerecorded call, Wizard-of-Oz operator, hard-coded object, or preselected judge phrase.

### Requirement 23: Shared contracts and parallel implementation boundary

**User Story:** As a two-person team, we want a contract-first split, so that both people can build quickly without repeatedly blocking or overwriting one another.

#### Acceptance Criteria

1. Person_1 SHALL create the full requirements, design, and tasks specifications before feature implementation begins.
2. Person_1 SHALL implement and commit all Shared_Contracts before parallel branches diverge.
3. Shared_Contracts SHALL include role and session claims, Incident models and events, Guest_Link and Demo_Guest_Session shapes, Vision_Request events, voice status events, vendor quote results, tool result envelopes, payment events, and UI fixtures.
4. EACH Shared_Contract SHALL have schema validation and at least one valid fixture plus one invalid fixture.
5. Person_2 SHALL branch from the verified contract commit and SHALL NOT redefine Shared_Contracts inside the parallel branch.
6. Person_2's assigned work SHALL remain limited to a small set of visual and guest-client tasks capable of running against contract fixtures without the live core agent.
7. Person_1 SHALL own final consolidation, live adapter wiring, conflict resolution, end-to-end verification, and the release commit.
8. No parallel task SHALL be marked complete solely because it renders; its contract, responsive, accessibility, error, and integration checks SHALL pass.

### Requirement 24: Performance and inclusive interaction

**User Story:** As a caller or product user, I want Steward to remain responsive and understandable on ordinary hardware and networks, so that visual ambition does not damage the real task.

#### Acceptance Criteria

1. Functional content and authentication SHALL remain usable if the 3D landing bundle fails or is disabled.
2. THE landing page SHALL avoid loading the full 3D scene before primary navigation and essential copy become interactive.
3. THE application SHALL provide visible keyboard focus and logical focus order.
4. Status SHALL use text or iconography in addition to color.
5. Text and interactive controls SHALL meet WCAG 2.2 AA contrast requirements.
6. All functional animations SHALL provide a reduced-motion alternative.
7. Camera, microphone, and call states SHALL be available as text, not only animation.
8. The Guest surface SHALL preserve its primary incident actions at 320 CSS pixels wide without horizontal scrolling.
9. The authenticated product SHALL preserve primary workflows at desktop zoom up to 200 percent.

## Out of scope for the hackathon implementation

- Live Airbnb, Vrbo, Guesty, or other PMS integration.
- Real vendor cold outreach or unverified phone numbers.
- Real-money vendor payouts, refunds, or compensation.
- VoiceOS, browser control, and computer-use automation.
- A second LLM dedicated to vision or scope classification.
- Production-grade tax, insurance, licensing, or vendor compliance verification.
- Native iOS or Android applications.
- Unlimited vendor-call concurrency or production autoscaling.
- Final model training from incident history.
