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
