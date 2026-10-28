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
