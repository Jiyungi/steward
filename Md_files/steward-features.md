# Steward Product Features

Steward is an autonomous short-term-rental property manager for guests, owners, and vendors. It handles an incident from the first report to a verified resolution.

## Non-negotiable behavior

- **No hard-coded scenarios** — Steward must not use scripted outcomes, fixed timers, or decision trees that assume what the caller will say or show.
- **Reason from real input** — Every decision must use the actual conversation, live visual input, property data, policies, available budget, and real tool results.
- **Interpret visual evidence honestly** — Steward must identify what the camera or image actually shows. It must never assume that the input contains a lock, appliance, damage, or any other expected object.
- **Replan from results** — When an action fails or new information appears, Steward reasons again from the updated incident state instead of following a predetermined demo path.
- **No fabricated success** — Steward never reports that an action succeeded unless a real tool result or verification confirms it.

## Communication

1. **24/7 voice and text support** — Guests, owners, and vendors can call or message Steward at any time.
2. **Multilingual communication** — Steward speaks to each person in their preferred language while preserving the same incident context.
3. **Automatic updates** — Steward keeps the guest, owner, and vendor informed without making them coordinate manually.
4. **Human escalation** — Steward transfers control when a situation is unsafe, legally sensitive, unclear, or outside its authority.

## Knowledge and reasoning

5. **Property memory** — Store bookings, access instructions, appliances, Wi-Fi, rules, warranties, previous incidents, and preferred vendors for each property.
6. **Incident management** — Track the people involved, actions taken, money spent, current status, and final result for every problem.
7. **Autonomous decision-making** — Give the model the incident, property context, actual voice and visual input, available tools, policies, and budget. Let it reason instead of following hard-coded decision trees.
8. **Cost-aware planning** — Compare possible solutions by price, speed, risk, and guest impact.
9. **Performance learning** — Learn which fixes work, which vendors perform well, common property failures, average costs, and guest satisfaction.

## Guest support

10. **Guided troubleshooting** — Talk the guest through possible fixes before spending money.
11. **Visual diagnosis** — Request photos, video, or a live camera view when visual information would help diagnose the problem.
12. **Alternative resolutions** — Choose between troubleshooting, compensation, repair, replacement, or alternative accommodation when appropriate.

## Owner control

13. **Budget and permission controls** — Owners set the available budget and operating rules. Steward acts independently within that authority.
14. **Delegated payment authority** — For the hackathon demo, Steward can select and pay a vendor from the available budget without asking the owner for approval.
15. **Owner dashboard** — Show open incidents, budgets, spending, approvals, vendor activity, property history, and completed outcomes.

## Vendor operations

16. **Approved vendor list** — Each owner provides preferred vendors for different types of work. Steward contacts suitable approved vendors first.
17. **External vendor search** — If the approved vendors are unavailable or unsuitable, Steward searches the web for other qualified vendors.
18. **Vendor outreach** — Contact suitable vendors by phone, text, or email, including multiple vendors when useful.
19. **Quote comparison and negotiation** — Collect prices, availability, arrival times, and guarantees, then select the best overall option.
20. **Scheduling and access coordination** — Book the vendor, provide temporary property access, update the guest, and add the appointment to the calendar.
21. **Proof-of-work verification** — Require photos, video, guest confirmation, vendor documentation, or smart-device status before closing a job.

## Actions and accountability

22. **Tool integrations** — Connect to booking systems, smart locks, calendars, messaging, email, payments, maps, and property-management software. Use computer control when an API is unavailable.
23. **Payments, refunds, and compensation** — Pay vendors autonomously after verification, issue permitted guest refunds or credits, and keep receipts. Stripe test mode provides payment execution during the hackathon.
24. **Verified action records** — Record every tool result, message, booking, verification, and payment. Steward never claims an action succeeded without evidence.

## Identity and access

25. **One identity, multiple permanent roles** — Owners and vendors have permanent accounts. The same email may belong to an owner, a vendor, or both. A person with multiple roles can switch workspaces without creating duplicate accounts.
26. **Role-specific workspaces** — Owners see properties, incidents, budgets, vendors, and outcomes. Vendors see only the jobs, access details, messages, evidence requests, and payments relevant to them. Role switching changes the workspace and permissions, not the underlying identity.
27. **Temporary guest access** — Guests do not need permanent Steward accounts. A confirmed booking produces a unique property-and-booking link that expires two weeks after checkout.
28. **Guest identity check** — In the production flow, a guest verifies access using the email associated with the booking before viewing booking-specific information or joining an incident.
29. **Hackathon guest access** — Until a booking-platform integration exists, the demo must let a judge enter the guest experience without requiring a matching Airbnb, Vrbo, or property-management-system record. The demo path must remain clearly separated from the future production booking-verification path.
30. **Camera only when useful** — The guest experience does not request camera access by default. Steward requests it only when visual evidence would materially help the current incident, explains why it is needed, and continues without camera access when the guest declines or permission fails.

## Product experience and visual direction

31. **Ambitious spatial landing page** — The public landing page uses deliberate 3D composition and meaningful animation to communicate Steward's ability to connect guests, properties, vendors, calls, evidence, and payments. The 3D scene must support the product story rather than act as unrelated decoration.
32. **Enterprise clarity** — Pages use little copy, decisive hierarchy, precise labels, and visible evidence. The interface must feel credible enough to operate real properties and money without becoming a generic corporate dashboard.
33. **Simple conversation surface** — The chat and live-incident views are visually polished but operationally simple. The current conversation, active action, evidence request, and outcome state take priority over decorative controls.
34. **Motion with a usable fallback** — 3D and animation are first-class design elements, while keyboard navigation, readable contrast, visible focus, screen-reader semantics, and reduced-motion or static fallbacks remain supported. Accessibility must not be used as a reason to make the primary experience visually ordinary.
35. **No AI-generated design clichés** — Avoid generic card grids, gradient text, decorative glass panels, excessive badges, tiny uppercase labels, meaningless metrics, wordy hero sections, and motion that does not communicate state or product behavior.

## Human voice requirements

36. **Incident-bound conversation** — Steward remains focused on resolving the active property or stay problem. If a caller suddenly asks for unrelated recipes, animals, trivia, or general-assistant tasks, Steward responds naturally and briefly, then redirects to the incident instead of following the unrelated topic.
37. **Natural acknowledgement and repair** — Steward acknowledges frustration, uncertainty, corrections, and interruptions in language appropriate to the moment. It does not repeat the same canned empathy sentence or restart the entire troubleshooting flow after a correction.
38. **Varied, contextual disfluency** — Steward may use short human speech markers such as “um,” “uh,” “hmm,” “mm-hmm,” breaths, or brief pauses when they fit the moment. They must vary, remain occasional, and never be inserted mechanically into every response.
39. **Honest latency masking** — While a real tool call is pending, Steward can use a brief acknowledgement, then a longer truthful progress update if the wait continues. The language must reflect the actual pending action and elapsed wait rather than a fixed timer, fabricated progress, or a repeated filler loop.
40. **No filler around critical facts** — Steward speaks access codes, prices, appointment times, addresses, safety instructions, payment confirmations, and final outcomes clearly and without distracting filler.
41. **Fast interruption handling** — When a caller begins speaking, Steward stops or yields quickly, listens to the complete correction or interruption, and responds from the updated context. It does not talk over the caller or ignore barge-in speech.
42. **Conversational pacing** — Responses are short enough for a phone call, use natural punctuation and pauses, and avoid written-language monologues. Steward asks one useful question at a time unless grouping information is necessary.
43. **Adaptive emotional tone** — Steward sounds calm and capable during ordinary troubleshooting, more direct during safety risks, and appropriately reassuring when a guest is distressed. It does not become cheerful, theatrical, or casual when the situation is serious.
44. **Context continuity** — Steward remembers what the caller already said or showed, refers to it naturally, and does not repeatedly ask for the same fact unless the earlier answer was unclear or contradicted.
45. **Voice quality verification** — Before the demo, test normal incidents, interruptions, mumbling, topic drift, contradictory answers, camera refusal, slow tools, failed tools, and incomplete vendor responses. Review recordings and latency traces; do not approve the voice experience based only on written transcripts.
