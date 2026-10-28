# Nivora API

Express + MongoDB API for the Nivora storefront.

## Local setup

1. Copy `server/.env.example` to `server/.env`.
2. Set `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, and the
   frontend origin in `CLIENT_ORIGIN`. The full beginner walkthrough for Atlas,
   JWT generation, Razorpay test keys and the webhook secret is in the
   [project README](../README.md#getting-credentials-step-by-step).
3. Install dependencies, check configuration and load sample data:

```bash
npm install
npm run check-setup
npm run seed
npm run dev
```

`npm run check-setup` reports only whether values are present; it never prints
secret values. It also connects to MongoDB and reports whether transactions are
supported. Use `npm run check-setup -- --offline` to skip the database check.

`npm run seed` is idempotent and prints created/already-existed counts.
`npm run seed:validate` validates the sample records without writing.

The API listens on <http://localhost:5000>; the health endpoint is
<http://localhost:5000/api/health> and reports
`"status": "ok"` with a connected database when configuration is complete.

`JWT_EXPIRES_IN` controls token lifetime (default `7d`). `COOKIE_SAME_SITE`
accepts `lax`, `strict` or `none`; `none` requires HTTPS and is forced to a
`Secure` cookie.

Razorpay test keys are optional for local work. Without them the API still
serves the storefront, but online payment endpoints return `503`. See the
payments section below for the three variables and webhook setup.

Atlas M0 clusters are replica sets and support the transactions checkout
requires. A standalone local MongoDB does not; use a single-node replica set or
Atlas for checkout and payment testing.

In development, without `MONGODB_URI` or `JWT_SECRET` the API still starts for
catalogue and health checks, but registration, login and session endpoints
return `503`.

## Authentication

The API issues a JWT in an `httpOnly`, `SameSite`-configurable cookie. Tokens
are never returned in the JSON body. Browser clients must send requests with
`credentials: "include"`.

| Method | Path                | Notes                                      |
| ------ | ------------------- | ------------------------------------------ |
| POST   | `/api/auth/register` | Creates a customer account and signs in.   |
| POST   | `/api/auth/login`    | Generic failure message for bad credentials. |
| POST   | `/api/auth/logout`   | Clears the auth cookie.                    |
| GET    | `/api/auth/me`       | Returns the signed-in user.                |

Login and registration are rate limited. Passwords are hashed with bcrypt and
responses never include `passwordHash`. `requireAuth` and `requireAdmin`
middleware read the role from MongoDB on every protected request.

Seeded sample users are directory records only and have no password; they
cannot sign in. Register a new account before using it.

## Cart, checkout and customer orders

All cart and order routes require the `httpOnly` session cookie.

| Method | Path                          | Notes                                                        |
| ------ | ----------------------------- | ------------------------------------------------------------ |
| GET    | `/api/cart`                   | Returns the signed-in user's cart and server totals.          |
| POST   | `/api/cart/items`             | Adds a product by its stable `productId`.                     |
| PATCH  | `/api/cart/items/:productId`  | Replaces a line quantity.                                    |
| DELETE | `/api/cart/items/:productId`  | Removes a line.                                              |
| POST   | `/api/cart/merge`             | Merges guest lines after sign-in, capped at current stock.   |
| POST   | `/api/cart/quote`             | Validates a coupon and returns recalculated totals.          |
| DELETE | `/api/cart`                   | Clears the cart.                                             |
| POST   | `/api/orders`                 | Places a cash-on-delivery order from the server cart.        |
| GET    | `/api/orders`                 | Lists the signed-in user's orders, newest first.             |
| GET    | `/api/orders/:id`             | Returns one order owned by the signed-in user.               |

Cart writes validate the live product status, stock and quantity in MongoDB.
Checkout ignores client-supplied prices, discounts, shipping and totals:
the server rereads the cart and products, validates the coupon's status,
expiry, minimum order and usage limit, and stores snapshots on the order.
Guest carts remain in browser `localStorage` and are merged into the account
cart on sign-in without exceeding stock.

Cash on delivery remains available. Online payment with Razorpay is documented
below and is restricted to test-mode keys in this build.

## Razorpay test-mode payments

Online payment is offered beside cash on delivery on the checkout page.
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are read
from `server/.env`; only blank placeholders are committed in
`server/.env.example`. This build accepts keys starting with `rzp_test_` only,
so live credentials cannot be used and no real charge can be made. Until test
keys are set, the endpoints below return `503`.

| Method | Path                                            | Notes                                                                 |
| ------ | ----------------------------------------------- | --------------------------------------------------------------------- |
| POST   | `/api/payments/razorpay/checkout`               | Creates the internal order and a Razorpay order from the server cart. |
| POST   | `/api/payments/razorpay/orders/:orderId/retry`  | Reopens checkout for an unpaid order while its reservation is valid.  |
| POST   | `/api/payments/razorpay/verify`                 | Verifies the checkout result on the server, then settles the order.   |
| POST   | `/api/payments/razorpay/webhook`                | Razorpay-to-server webhook; authenticated by HMAC, not a session.     |

The authenticated endpoints use the server-side cart and checkout details.
Amounts, discount, shipping and line items always come from MongoDB and are
sent to Razorpay as integer paise; the API rejects totals below ₹1 for online
payment and never trusts a client total. The public key id is returned for
Checkout, while the key secret and webhook secret never leave the server.

Creating an online order decrements stock and increments coupon usage in the
same MongoDB transaction as cash on delivery. The reservation is held for 20
minutes. A pending or failed online reservation blocks a second online checkout
and cash on delivery for the same cart until it is retried or expires. A sweep
runs every 60 seconds, checks the gateway (including captured payments) and
releases expired reservations exactly once, restoring stock and coupon usage
without any non-transactional fallback.

The browser callback is not proof of payment. Verification:

1. Locates the signed-in user's order and uses the Razorpay order id stored on
   that internal order, not the id supplied by the browser.
2. Verifies the checkout HMAC with the key secret.
3. Fetches the payment from Razorpay and checks its `order_id`, amount and INR
   currency against the stored order total.
4. Captures an `authorized` payment server-side with the exact amount, then
   requires `status: "captured"` before marking the order paid.

If a capture arrives after the reservation expired, the server re-reserves the
stock inside a transaction. If the items are gone, the payment is still
recorded as `Paid` and the order as `Cancelled` with a manual-refund note; stock
is never decremented below zero.

Webhook signatures are verified with HMAC-SHA256 over the exact raw request
body using `RAZORPAY_WEBHOOK_SECRET`. The route is mounted with raw-body
middleware before the JSON parser, so other routes keep normal JSON parsing.
Deliveries are de-duplicated with a unique event id in `PaymentEvent`
(`x-razorpay-event-id`, or a SHA-256 of the raw body when absent).
`payment.captured` and `order.paid` settle an order; `payment.failed` marks an
unsettled attempt failed; other events are acknowledged and ignored. `Paid` and
`Refunded` states are never downgraded, and late failure events are ignored
after settlement.

For local webhook testing, expose port `5000` with a public HTTPS tunnel (for
example `cloudflared tunnel --url http://localhost:5000` or `ngrok http 5000`)
and register `https://<tunnel-host>/api/payments/razorpay/webhook` in the
Razorpay Dashboard. Subscribe to `payment.captured`, `order.paid` and
`payment.failed`, and keep `RAZORPAY_WEBHOOK_SECRET` identical in the dashboard
and `server/.env`.

No live credentials, gateway calls or real test transaction were used during
this phase. The API and frontend were checked at code level; a Razorpay test
account, a transaction-capable MongoDB and a publicly reachable webhook URL are
required to exercise the gateway end to end.

## Protected administration API

Every route below is mounted under `/api/admin` and passes through
`requireAuth` and `requireAdmin`. The role is read from MongoDB on each request;
a browser-supplied role or local-storage value is never trusted. Responses are
marked `Cache-Control: no-store`.

| Method | Path                               | Notes                                                        |
| ------ | ---------------------------------- | ------------------------------------------------------------ |
| GET    | `/api/admin/dashboard`             | Server-calculated summary for `range`.                       |
| GET    | `/api/admin/products`              | Lists products with server-side search, status and sorting.  |
| POST   | `/api/admin/products`              | Creates a product after validating category, prices, stock, SKU, slug, image URLs and status. |
| PATCH  | `/api/admin/products/:id`          | Updates allowed product fields.                              |
| DELETE | `/api/admin/products/:id`          | Archives a product by setting `status` to `Draft`.           |
| GET    | `/api/admin/orders`                | Lists orders with customer, status and payment fields.       |
| GET    | `/api/admin/orders/:id`            | Returns one order by order number or database id.            |
| PATCH  | `/api/admin/orders/:id/status`     | Moves an order through an allowed status transition.         |
| GET    | `/api/admin/users`                 | Lists safe user fields only; password hashes are never selected. |
| PATCH  | `/api/admin/users/:id`             | Updates role or status with self-lockout and last-admin guards. |
| GET    | `/api/admin/coupons`               | Lists coupons with server-side search, status and sorting.   |
| POST   | `/api/admin/coupons`               | Creates a coupon and validates discount, minimum, expiry and usage-limit rules. |
| PATCH  | `/api/admin/coupons/:id`           | Updates allowed coupon fields; usage counts are rejected.    |
| DELETE | `/api/admin/coupons/:id`           | Deactivates a coupon instead of deleting it.                 |

Products referenced by historical orders are archived rather than deleted, so
order snapshots and references remain intact. Only products with
`status: "Active"` appear in the public catalogue.

Order status updates use an explicit transition list:
`Pending → Preparing | Cancelled`, `Preparing → Shipped | Cancelled`,
`Shipped → Delivered`, and no outgoing transitions from `Delivered` or
`Cancelled`. A same-status request is accepted as a no-op. Status updates never
write item prices, customer snapshots, totals or payment status. Payment status
is read-only in the admin API and UI; only gateway verification and webhooks
change it. Unpaid online orders cannot move to `Preparing` or later, and paid
online orders cannot be cancelled until a refund workflow exists. Cancelling an
unpaid online order releases its stock reservation and coupon usage in a
transaction.

Coupon updates cannot change `usedCount`, and the API rejects attempts to set
it. A percentage discount cannot exceed 100, a usage limit cannot fall below
the recorded usage, and deactivation sets `status: "inactive"`.

Dashboard sales totals are aggregated in MongoDB and exclude cancelled orders.
The endpoint returns counts, status and daily order activity, recent order
summaries, and top active products; it does not expose customer addresses,
emails or other sensitive fields beyond the order list itself.

### Transaction requirement

Placing an order decrements stock, increments coupon usage, creates the order
and clears the cart in one MongoDB transaction. Online payment reservations use
the same transaction and are released by another transaction when they expire.
The deployment database must therefore be a replica set or a sharded cluster.
The API checks this before checkout and returns `503` with a clear message for a
standalone MongoDB; it never falls back to a non-transactional order path that
could leave stock and orders out of sync. Local single-node MongoDB servers
normally need to be started as a single-node replica set before checkout can be
used.

## Deployment

The API is a long-running Node service, so use a host that keeps a process
alive (Render Web Service, Railway, or similar) rather than a serverless
frontend host. The recommended setup is MongoDB Atlas + Render + Vercel; see
the [project README](../README.md#deployment) for the full walkthrough.

Backend service settings:

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Build command | `npm ci` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Node version | 20 or newer |

Environment variables to set in the host dashboard:

```text
NODE_ENV=production
MONGODB_URI=<Atlas connection string>
CLIENT_ORIGIN=https://<frontend origin>
JWT_SECRET=<32+ random characters>
JWT_EXPIRES_IN=7d
COOKIE_SAME_SITE=none
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=<test key secret>
RAZORPAY_WEBHOOK_SECRET=<webhook secret>
```

`PORT` is supplied by Render/Railway; do not set it manually. In production the
API refuses to start without `MONGODB_URI`, a 32+ character `JWT_SECRET`, and a
valid `CLIENT_ORIGIN`.

Use `COOKIE_SAME_SITE=none` when the storefront and API are on different sites
(for example `*.vercel.app` and `*.onrender.com`); HTTPS is required and the
cookie is forced `Secure` in production. If both use subdomains of one
registrable domain, `lax` is preferable. Production trusts one reverse-proxy
hop so the auth rate limiter sees visitor IPs; adjust that in `src/app.js` only
if you add another proxy/CDN.

After deployment:

- Health: `https://<api-host>/api/health` (expect `status: ok` and a connected
  database).
- Webhook: `https://<api-host>/api/payments/razorpay/webhook`, subscribed to
  `payment.captured`, `order.paid` and `payment.failed`, with the same secret as
  `RAZORPAY_WEBHOOK_SECRET`.
- Recheck the health endpoint after every environment change and redeploy the
  frontend after changing `VITE_API_BASE_URL` (Vite embeds it at build time).

## Manual administrator promotion

There is no public admin-granting endpoint. To promote an existing registered
account, run this on the server with the same environment used by the API:

```bash
npm run promote-admin -- owner@example.com
```

The command only updates an already registered email. It never creates an
account and never promotes based on browser input.
