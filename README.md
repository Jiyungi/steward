# [Open Steward live →](https://steward-sage.vercel.app)

**Steward is an AI property manager for short-term rentals.** It handles guest issues from the first call through a verified resolution.

[Try the live call](https://steward-sage.vercel.app/voice) · [Owner workspace](https://steward-sage.vercel.app/owner) · [Vendor workspace](https://steward-sage.vercel.app/vendor/demo)

![Current Steward landing page](apps/web/screenshots/landing-current-desktop.png)

## The problem

Guest issues often leave owners manually diagnosing problems, contacting vendors, comparing quotes, sharing updates, and checking whether the work was completed. Guests wait, and owners are interrupted at any hour.

## What Steward changes

Steward answers by voice, understands the issue, guides safe troubleshooting, and contacts approved vendors when help is needed. It follows the owner’s rules and budget, keeps everyone updated, and does not close the incident until the result is verified.

## Impact

- Guests get help faster.
- Owners spend less time coordinating routine issues.
- Vendors receive clearer requests and context.
- Every decision, cost, and outcome stays traceable.

## Run locally

Requires Node.js 24+ and pnpm 10.24.

```bash
pnpm install
pnpm build
pnpm dev:web
```

Start the voice worker in a second terminal:

```bash
pnpm preflight
pnpm dev:agent
```

Use `.env.example` for configuration. Never commit real credentials.

## Test

```bash
pnpm typecheck
pnpm test
pnpm test:e2e
```
