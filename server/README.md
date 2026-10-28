# Nivora API

Express + MongoDB API for the Nivora storefront.

## Local setup

1. Copy `server/.env.example` to `server/.env`.
2. Set `MONGODB_URI`, a random `JWT_SECRET` of at least 32 characters, and the
   frontend origin in `CLIENT_ORIGIN`.
3. Install dependencies and start the API:

```bash
npm install
npm run dev
```

`JWT_EXPIRES_IN` controls token lifetime (default `7d`). `COOKIE_SAME_SITE`
accepts `lax`, `strict` or `none`; `none` requires HTTPS and is forced to a
`Secure` cookie.

Without `MONGODB_URI` or `JWT_SECRET` the API still starts for catalogue and
health checks, but registration, login and session endpoints return `503`.

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

Only cash on delivery is supported. No payment provider is called and no
online payment is implied.

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
write item prices, customer snapshots, totals or payment status; payment status
remains read-only until a payment provider exists.

Coupon updates cannot change `usedCount`, and the API rejects attempts to set
it. A percentage discount cannot exceed 100, a usage limit cannot fall below
the recorded usage, and deactivation sets `status: "inactive"`.

Dashboard sales totals are aggregated in MongoDB and exclude cancelled orders.
The endpoint returns counts, status and daily order activity, recent order
summaries, and top active products; it does not expose customer addresses,
emails or other sensitive fields beyond the order list itself.

### Transaction requirement

Placing an order decrements stock, increments coupon usage, creates the order
and clears the cart in one MongoDB transaction. The deployment database must
therefore be a replica set or a sharded cluster. The API checks this before
checkout and returns `503` with a clear message for a standalone MongoDB; it
never falls back to a non-transactional order path that could leave stock and
orders out of sync. Local single-node MongoDB servers normally need to be
started as a single-node replica set before checkout can be used.

## Manual administrator promotion

There is no public admin-granting endpoint. To promote an existing registered
account, run this on the server with the same environment used by the API:

```bash
npm run promote-admin -- owner@example.com
```

The command only updates an already registered email. It never creates an
account and never promotes based on browser input.
