# AI Property Management — What Exists Today, and What's Missing

Compiled 31 July 2026.

---

## Part 0: Words you need before reading

I use these terms throughout. Read this section first.

- **Short-term rental (STR)** — Airbnb, Vrbo, and similar. Guests stay a few nights.
- **Long-term rental** — a normal apartment lease. A tenant stays for a year.
- **Multifamily** — big apartment buildings, usually hundreds of units owned by one company. A different market from Airbnb hosts.
- **Property Management System (PMS)** — the main software a host runs their business on. It holds the calendar, the bookings, the prices, and the guest messages. Guesty and Hostaway are examples. Think of it as the operating system for a rental business.
- **Unit / listing / door** — all three mean one rentable property. The industry uses them interchangeably. "$25 per door" means $25 per property per month.
- **Triage** — deciding how serious a problem is and what to do about it. Same idea as a hospital emergency room sorting patients.
- **Dispatch** — sending a worker (plumber, locksmith, cleaner) to the property.
- **Vendor** — any outside worker or company you hire. Plumber, electrician, locksmith, cleaning crew.
- **Accounts payable (AP)** — the process of paying bills a company owes. "AP automation" is software that processes invoices and gets them approved.
- **Gap night** — a single empty night between two bookings, which is hard to sell.
- **Middleware** — software that sits between two other systems and passes information between them. It does not do the work itself.

---

## Part 1: The shape of the market

There are four separate groups of companies. **Each group solves one piece of a problem, and none of them solves the whole thing.**

**Group 1 — Booking software.** Guesty, Hostaway, Hospitable. They hold your calendar, prices, and bookings. They have added AI features on top recently.

**Group 2 — Guest messaging.** Besty, HostAI (now called Conduit), Enso Connect, Duve. They reply to guest questions automatically and try to sell guests extras like a late checkout.

**Group 3 — Maintenance and operations.** Breezeway, Latchel, Lula, TIDY, Turno. They handle cleaning schedules, repair requests, and sending workers to properties.

**Group 4 — Door access.** RemoteLock, Operto. They create and delete door codes for each booking.

**Why this matters to you:** one real incident crosses all four groups. A guest is locked out at 2am. That involves the booking (Group 1), talking to the guest (Group 2), possibly sending a locksmith (Group 3), and the door code that failed (Group 4). No company today carries that single incident from start to finish. Each one hands it off or drops it.

---

## Part 2: Every company, what it does, what it costs

### Booking software

**Guesty** — the biggest player. On 1 June 2026 they launched "Agent Hub," a set of AI assistants covering pricing, guest messages, operations, finance, and reviews. A human operator still supervises them. Another feature, ReplyAI Autopilot, reads guest messages, spots problems, and creates tasks automatically.

Cost:
- Small hosts (1–3 properties): **$16 per property per month** if you pay yearly, **$23** if you pay monthly. Confusingly, Guesty's own FAQ page says pricing starts at $9. Their website contradicts itself.
- Bigger operators: price is quote-only. Reported real costs are **$50–75 per property per month**, plus a **one-time setup fee of $300–1,500**, plus **2–5% of your booking revenue**. Minimum around $38 per property.

**Hostaway** — aimed at mid-sized operators. They publish no prices at all.
- Reported: 1–4 properties costs roughly **$125–175 per month total**. 5–9 properties costs **$175–250 per month**. Above 10 properties the price drops to about **$15–25 per property**.

**Hospitable** — built for smaller hosts.
- Roughly **$40 per month** for a single property. Goes above **$100 per month** once you pass five properties.

### Guest messaging

**HostAI** — renamed to **Conduit** in 2025. It automatically replies to guest messages, updates calendars, notices maintenance problems mentioned in guest messages, and can answer guest phone calls with AI. After the rename it expanded beyond rentals into general customer support.
- **$500 per month** for their Growth plan.

**Besty AI** — writes automatic guest replies and sells extras like late checkout and gap nights. Quick to set up. Reviewers describe it as light on features and support.

**Enso Connect** — adds a guest-facing app and a combined message inbox on top of your booking software. Includes digital welcome guides, ID verification, smart lock connections, and upselling.
- **$9–16 per property per month, plus 5% commission** on anything it sells to guests.

### Maintenance and operations

**Breezeway** — the most established operations platform. Handles maintenance, cleaning, and inspections. Cleaners and vendors get a phone app to accept and complete jobs. Connects to 40+ booking systems.
- **$19.99 per property per month** for the core operations product. Guest messaging and guides cost extra. Your first property is free.

**Latchel** — the closest existing product to your idea. Available 24/7. Its AI sorts repair requests into three buckets: emergency (flood, no heat, electrical danger), urgent (broken appliance), and routine (cosmetic). It tries to talk the resident through a fix before sending anyone. Then it coordinates the vendor.
- **$25 per property per month.** Custom pricing above a certain size.
- They claim **up to 30% of problems get solved on the first call**, with no vendor sent. Broader industry studies say **30–50%** is achievable.

**Lula** — maintenance with an AI layer called LuMi. It takes the resident's first report, tries to troubleshoot, decides how urgent it is, and then sends a worker from **Lula's own network of 9,000+ licensed and insured professionals**.
- **No monthly fee, no setup fee, no per-user fee.** Lula makes money on the completed repair work instead, charged as one line on your bill at or below normal market rates.

**TIDY** — automates cleanings, maintenance, guest messages, and pricing.
- **3.9% of your booking revenue plus 3.9% of what you spend on cleaning and repair jobs. Minimum $39 per month.**

### Voice-based AI

**Super** (hiresuper.com) — your closest voice competitor. It answers phone calls, emails, and texts for property managers, and creates maintenance tickets and work orders. Notably, **Super built its own voice technology rather than renting someone else's**, which they say makes it more reliable. Speaks English and Spanish by voice, more languages by text.
- Outreach plan: **$150/month**, includes 250 minutes of calls.
- Receptionist plan: **$415/month**, includes 1,000 minutes plus unlimited email and text. This is their most popular.
- Concierge plan: **$515/month**, includes 1,300 minutes plus unlimited email and text.
- No setup fee. Half price for the first 30 days.
- **Setup takes 2 to 4 weeks** with their team doing the configuration.
- They claim **34% of incoming questions get resolved without any human involvement.**

**EliseAI** — built for large apartment buildings, not Airbnb. Handles leasing, maintenance, lease renewals, and chasing late rent, over text, email, chat, and voice. Claims it resolves 95%+ of routine questions.
- Reported at **$3–6 per unit per month with a minimum of about $25,000 per year.** EliseAI publishes no pricing publicly, so treat these numbers as second-hand.
- That $25,000 minimum means it only makes financial sense if you have several hundred units.

**Entrata** — announced in March 2026 a system with **more than 100 AI assistants** covering leasing, maintenance, accounting, payments, and resident services. Sold to large apartment companies.

### Door access

**RemoteLock and Operto** — they connect smart locks to booking software. When a booking is made, they automatically create a door code that works only during that stay, then delete it afterward.
- RemoteLock: **first year free** for vacation rentals. After that, price depends on how many locks and what type. Lower plans cap you at 150 guests and keep 90 days of history.

---

## Part 3: The gaps — what nobody does

These are the seven things no company in Part 2 currently does. This is your opportunity.

### Gap 1 — They sort problems by urgency, never by cost

Latchel sorts into emergency, urgent, and routine. Lula sorts by urgency. Every product asks **"how serious is this?"**

**No product asks "what is the cheapest thing that actually fixes this?"**

None of them hold a spending budget. None of them are trying to protect the owner's profit. Nothing on the market can reason like this:

> "A locksmith costs $150 and takes 90 minutes. A $40 refund makes this guest happy right now. Three minutes of me walking them through the keypad costs nothing. Let me try the keypad first."

**This is the biggest hole in the market, and it is exactly the idea you described.**

### Gap 2 — Paying the vendor is always a separate, human step

Software exists to process invoices (AvidXchange, Scrypt). But it only prepares the paperwork and routes it to a person for approval. The standard industry position is that AI prepares, and humans approve and pay.

**Nobody has an agent that confirms the work was actually done and then releases the money.** That whole chain — verify, then pay — is broken into pieces handled by different people and different software.

### Gap 3 — "Vendor dispatch" means picking from a pre-approved list, not making a phone call

This is a subtle but important distinction.

- Lula assigns jobs from its own network of 9,000 approved workers.
- Latchel coordinates with vendors you already use.
- Breezeway sends vendors a task in an app for them to accept.

All three are **choosing from a closed list inside a piece of software.**

**None of them phone an unknown vendor, ask if they're available, get a price, compare it against another vendor, and book the better one.** Super has an outbound calling product, but it's built for chasing late rent and lease renewals — not for finding and negotiating with vendors.

### Gap 4 — Nobody diagnoses the problem live with the guest

Guest messaging tools answer questions and sell upgrades. Latchel and Lula do walk residents through fixes, but only in long-term rentals, and only by text or a scripted call.

In short-term rentals, **no product runs a live guided diagnosis with a guest.** And across this entire market, **no product asks the guest to show it the problem through their phone camera.** That capability does not exist anywhere here.

### Gap 5 — Voice AI exists, but not where the pain is

Super and EliseAI are genuinely voice-first, but both are built for long-term apartments. Short-term rental software is built around text messaging.

The problem is that **a 2am lockout is a phone call.** The guest is standing outside a door in the dark. They are not going to open a web chat window and type.

### Gap 6 — Door access software stops at creating the code

RemoteLock and Operto create and delete codes. That's it. **When the code doesn't work, there is no software layer at all** — it becomes a phone call to a host who is asleep. The access companies have no way to handle the failure of their own product.

### Gap 7 — Small owners cannot afford any of this

Look at the entry prices for anything with real AI:

- EliseAI: about **$25,000 per year minimum**
- Super: **$415/month** plus 2–4 weeks of setup
- Guesty's serious tier: **$50–75 per property** plus 2–5% of revenue
- HostAI/Conduit: **$500/month**

Someone with 3 properties has **nothing** available to them that acts independently. The cheapest real options are Breezeway at $19.99 and Latchel at $25 per property — and neither is autonomous, and neither is voice-first.

### Bonus gap — Almost everyone charges the same whether or not they fix anything

Nearly every company charges a flat monthly fee per property. Latchel solves 30% of problems on the first call. Super solves 34%. Both charge the same amount regardless.

Only **Lula** (paid on completed work) and **TIDY** (a percentage of job costs) tie their revenue to actually solving something. This proves customers in this market will accept paying for outcomes.

---

## Part 4: How Regent wins

**One sentence:** every existing product is a to-do list that routes work to humans. Regent is the first one that holds a budget and decides how to spend it.

Three things nobody in Part 2 can claim:

1. **It spends real money and protects the owner's profit.** Every incident is a money decision, and it says the tradeoff out loud to the guest.
2. **It phones vendors and negotiates** — including vendors not on any pre-approved list. It gets quotes, compares them, and rebooks when the first choice falls through.
3. **It checks the work before it pays, and checks the result before it claims success.**

**On pricing, charge per problem solved, not per property.** Lula and TIDY already proved this market accepts outcome-based pricing. It's also the sharpest possible contrast to a $25,000 annual minimum.

**Start with owners who have 1 to 20 properties.** EliseAI, Super, and Guesty have all priced that group out entirely.

---

## Part 5: Numbers to say on stage

- **30–50%** of maintenance problems can be solved without sending anyone (industry studies)
- **30%** solved on the first call — Latchel's own claim
- **34%** solved without a human — Super's own claim
- **$25,000 per year** minimum before you can even start with EliseAI
- **2 to 4 weeks** to set up Super — compare that to a1mobile onboarding a business on stage in 5 minutes
- **85%** of large apartment operators say AI reduced their operating costs (EliseAI report, 29 July 2026)

---

## Sources

Booking software: [Guesty pricing](https://costbench.com/software/vacation-rental-software/guesty/) · [Guesty pricing contradiction](https://aitoolsbakery.com/blog/guesty-pricing/) · [Guesty 100-property review](https://www.rakidzich.com/articles/guesty-for-airbnb-operators-2026) · [Agent Hub launch](https://shorttermrentalz.com/news/technology-news/guesty-launches-ai-agent-platform-for-short-term-rental-operations/) · [Hostaway cost](https://www.rakidzich.com/articles/how-much-does-hostaway-cost-2026) · [Hospitable cost](https://www.rakidzich.com/articles/how-much-does-hospitable-cost-2026)

Maintenance: [Breezeway pricing](https://www.breezeway.io/breezeway-pricing) · [Latchel](https://latchel.com/) · [AI triage overview](https://www.theaiconsultingnetwork.com/blog/ai-maintenance-request-triage-property-managers) · [Lula vendor network](https://www.appfolio.com/blog/lula-vendor-network) · [TIDY pricing](https://fieldservicesoftware.io/software/tidy/)

Voice AI: [Super pricing](https://www.hiresuper.com/pricing) · [Super call center](https://www.hiresuper.com/solutions/ai-call-center) · [EliseAI platform](https://eliseai.com/platform-overview) · [EliseAI review](https://aitoolsbakery.com/blog/eliseai-review/) · [EliseAI 2026 report](https://www.globenewswire.com/news-release/2026/07/29/3335276/0/en/EliseAI-Unveils-New-State-of-AI-in-Multifamily-Report-85-See-Reduced-Operating-Expenses.html)

Messaging and access: [Enso Connect vs Besty](https://ensoconnect.com/resources/besty-ai-vs-enso-connect-str-tools-comparison) · [HostAI/Conduit](https://www.softwareadvice.com/product/449969-HostAI/) · [RemoteLock pricing](https://remotelock.com/pricing)
