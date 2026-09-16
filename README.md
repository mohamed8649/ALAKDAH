# الأكدح — Alakdah

An Arabic-first commerce platform for cash-on-delivery merchants. Three distinct
experiences share one database and one set of rules:

- **Merchant dashboard** — dense, keyboard-friendly, dark. Catalogue, orders,
  inventory, customers, shipping, marketing, analytics, billing.
- **Call-centre portal** — a separate login realm with its own queue-shaped UI.
  An agent sees the order in front of them, not a shrunken dashboard.
- **Storefront** — the customer's shop. Mobile-first, COD-first, fast.

Arabic is the primary language with native RTL; English is fully supported and
the structure is ready for French. Currency defaults to LYD, timezone to
Africa/Tripoli.

## Running it

```bash
npm install
cp .env.example .env          # then fill in the secrets
npm run db:push               # create the schema
npm run db:seed               # demo store, products and orders
npm run dev
```

The seeded merchant is `demo@alakdah.ly` / `demo1234`, and the demo storefront
is at `/ar/demo`.

### Environment

| Variable | What it does |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. |
| `SESSION_SECRET` | 32+ random bytes; signs session cookies. |
| `ENCRYPTION_KEY` | 32+ random bytes; AES-256-GCM key for integration credentials. |
| `AI_PROVIDER` | `mock` (deterministic, no network) or `anthropic`. |
| `ANTHROPIC_API_KEY` | Only needed when `AI_PROVIDER=anthropic`. |
| `UPLOAD_DIR` | Where the local storage driver writes uploads. |

`AI_PROVIDER=mock` is the default on purpose: every AI feature works offline,
deterministically, with no key and no bill.

## Checks

```bash
npm run typecheck    # tsc --noEmit, strict
npm run lint
npm test             # Vitest unit suite
npm run test:e2e     # Playwright; builds and starts the app itself
npm run test:all     # all of the above
```

The E2E suite runs against a production build rather than the dev server,
because server actions, RSC payloads and post-login redirects behave
differently under `next dev`.

## How the code is arranged

```
prisma/schema.prisma      ~45 models; conventions documented in its header
src/app/                  routes and server actions only — no business logic
src/components/ui/        the design system
src/features/<domain>/    client components and pure domain logic
src/server/services/      every mutation; the only place that writes
src/server/policies/      tenant context and permissions
src/lib/                  money, phone, dates, crypto, parsing
messages/{ar,en}.json     all copy
```

A route handler resolves the caller's store, calls a service, and renders. It
never queries directly and never decides what the caller may do.

## Decisions worth knowing

**Money is never a float.** Every amount is an integer of minor units, and LYD
has three of them — 235.000 LYD is `235000`. `src/lib/money.ts` is the only
place that converts, and `parseMoney` accepts Arabic-Indic digits and Arabic
decimal separators because merchants type them.

**The tenant comes from the session, never the request.** `getStoreContext()`
derives the store from the signed-in user's membership row. A `storeId` in a
request body is ignored. Hiding a button is not authorisation: every service
call re-checks permission server-side.

**Secrets are write-only.** Integration credentials and Conversions-API tokens
are encrypted before they reach the database and are never returned in
plaintext — the UI gets a mask. A blank input means "keep what is stored", so
editing an unrelated field cannot silently wipe a credential the merchant
cannot read back.

**Nothing is executable content.** The page builder stores a block document —
`{type, props}` validated per type — never HTML or JavaScript. A video block
holds a provider and an id, not an embed string. Unknown block types are
dropped without taking the rest of the page with them.

**Order status is a data table.** `src/features/orders/state-machine.ts` owns
the transitions, and everything else — stock, revenue, carrier handover,
timestamps — is derived from it. Status changes are idempotent: the guard is in
the `UPDATE` itself, so a double-click cannot double-restock.

**Pixels map nothing by default.** In a COD business an order is not a payment,
so no order event is wired to `Purchase` automatically. The merchant decides
what counts as a conversion; see the note at the top of
`src/server/catalog/pixels.ts`.

**Imports are jobs, not requests.** Rows are persisted before processing and
each is its own unit of work, so one bad row is recorded rather than aborting
the file. A run that finishes with some failures is `COMPLETED_WITH_ERRORS`,
which is a different thing from `FAILED`.

## Marked as proposals

Some behaviour was inferred rather than observed. Those places say so in a
comment beginning `REBUILD PROPOSAL` — notably the order-status transition
table, the logo generator (deterministic local SVG rather than an image model),
the carrier connection test, and the Shopify, WooCommerce and webhook
integrations, which have catalogue entries and credential handling but no live
driver yet.

## Not built

Automations, the full app marketplace beyond the shipped catalogue, and live
API drivers for the third-party commerce platforms above.
