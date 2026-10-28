# Nivora

Nivora is a full-stack e-commerce project: a React storefront in
`client/Jobaaj-Store/` and an Express + MongoDB API in `server/`.

It supports catalogue browsing, customer accounts, a server-side cart, coupons,
cash-on-delivery checkout, order history, an admin area, and Razorpay
test-mode online payments.

> **No credentials are committed.** `server/.env` and
> `client/Jobaaj-Store/.env` are local-only, ignored by Git, and must never be
> committed. This build accepts Razorpay **test** keys only
> (`rzp_test_...`); live keys are rejected by the API. No real money can be
> charged.

## Repository layout

```text
.
├── client/Jobaaj-Store/   React 19 + Vite + Tailwind storefront
├── server/                Express 5 + Mongoose API
└── README.md              This guide
```

The API documentation, endpoint tables, payment rules and admin rules live in
[`server/README.md`](server/README.md).

## Prerequisites

- Node.js 20 or newer and npm.
- A MongoDB Atlas account (free M0 is enough) or a local MongoDB replica set.
- A Razorpay account in **Test Mode** if you want to exercise online payments.
- Two terminals for local development: one for the API, one for the storefront.

MongoDB Atlas M0 clusters are replica sets, so they support the transactions
checkout and payment reservations require. A standalone local MongoDB does not;
the API returns `503` for checkout in that case instead of writing a
non-transactional order.

## Local setup

### 1. Backend

```bash
cd server
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
npm install
npm run check-setup           # reports presence only, never values
npm run seed                  # idempotent sample data
npm run dev
```

Open <http://localhost:5000/api/health>. A working setup returns
`"status": "ok"` and `"database": { "configured": true, "status": "connected" }`.

If you have not created a database yet, `npm run check-setup -- --offline`
checks configuration without connecting.

### 2. Frontend

```bash
cd client/Jobaaj-Store
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>.

### 3. Create the first administrator

There is no public admin-granting endpoint:

1. Register a normal customer account in the storefront.
2. Stop at the prompt, then run this from `server/` with the same database
   connection:

```bash
npm run promote-admin -- you@example.com
```

3. Sign out and sign in again. The account now has the admin role.

Seeded sample users are directory records without passwords and cannot sign in.
Register your own account before promoting it.

## Environment variables

Two local environment files are involved, plus variables set in hosting
dashboards.

### Backend: `server/.env` (and backend host settings)

| Variable | Required | Secret? | Purpose |
| --- | --- | --- | --- |
| `PORT` | No | No | API port; defaults to `5000`. Render/Railway supply this automatically. |
| `NODE_ENV` | Yes | No | `development` locally, `production` when deployed. |
| `MONGODB_URI` | Yes for database features | **Yes** | Atlas or local MongoDB connection string. |
| `CLIENT_ORIGIN` | Yes in production | No | Exact allowed frontend origin, for example `http://localhost:5173`. |
| `JWT_SECRET` | Yes | **Yes** | At least 32 random characters; signs auth cookies. |
| `JWT_EXPIRES_IN` | No | No | Session lifetime, default `7d`. |
| `COOKIE_SAME_SITE` | No | No | `lax`, `strict` or `none`. Use `none` for different deployed sites over HTTPS. |
| `RAZORPAY_KEY_ID` | For online payments | No, but keep server-side | Razorpay **test** key id (`rzp_test_...`). |
| `RAZORPAY_KEY_SECRET` | For online payments | **Yes** | Razorpay test key secret. |
| `RAZORPAY_WEBHOOK_SECRET` | For webhooks | **Yes** | Secret you set on the Razorpay webhook endpoint. |

### Frontend: `client/Jobaaj-Store/.env` (and frontend host settings)

| Variable | Required | Secret? | Purpose |
| --- | --- | --- | --- |
| `VITE_API_BASE_URL` | Yes | No | Public API base URL including `/api`, for example `http://localhost:5000/api`. |

`VITE_*` values are compiled into the browser bundle. **Never** put
`MONGODB_URI`, `JWT_SECRET`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, or any other secret in a `VITE_*` variable, client
code, `localStorage`, or a screenshot.

### Where each value goes

| Value | Local file | Hosting / provider |
| --- | --- | --- |
| `MONGODB_URI` | `server/.env` | Backend host environment (secret) |
| `JWT_SECRET` | `server/.env` | Backend host environment (secret) |
| `RAZORPAY_KEY_ID` | `server/.env` | Backend host environment |
| `RAZORPAY_KEY_SECRET` | `server/.env` | Backend host environment (secret) |
| `RAZORPAY_WEBHOOK_SECRET` | `server/.env` | Backend host environment (secret) and Razorpay Dashboard webhook settings |
| `CLIENT_ORIGIN` | `server/.env` | Backend host environment |
| `JWT_EXPIRES_IN`, `COOKIE_SAME_SITE` | `server/.env` | Backend host environment |
| `VITE_API_BASE_URL` | `client/Jobaaj-Store/.env` | Frontend host environment (public) |
| Webhook URL and event selection | Not a local file | Razorpay Dashboard webhook settings |
| Database user, network access, cluster | Not a local file | MongoDB Atlas dashboard |

Local `server/.env` and `client/Jobaaj-Store/.env` are ignored by Git. Hosting
dashboards store the deployed values; never put backend secrets in the
frontend host.

## Getting credentials, step by step

### `MONGODB_URI` — MongoDB Atlas

1. Create an account at <https://www.mongodb.com/cloud/atlas/register>.
2. Create a free **M0** cluster. Choose a region near your backend host.
3. Open **Database Access** → **Add New Database User**. Use password
   authentication and a dedicated user such as `nivora_app`. Generate a strong
   password and keep it in a password manager. Do not use your Atlas login
   password.
4. Open **Network Access** → **Add IP Address**:
   - Local development: add your current IP.
   - Render/Railway free tiers have changing outbound IPs, so their docs often
     require `0.0.0.0/0`. That is broad; use a strong database password and
     restrict it again when you have static IPs or private networking.
5. Open **Clusters** → **Connect** → **Drivers** → **Node.js** and copy the
   `mongodb+srv://...` connection string.
6. Replace the username and password placeholders. Add the database name
   `nivora` after the host if it is missing:

```text
mongodb+srv://nivora_app:<db_password>@cluster0.xxxxx.mongodb.net/nivora?retryWrites=true&w=majority
```

7. If the password contains reserved characters, percent-encode it. For
   example `@` becomes `%40`, `:` becomes `%3A`, `/` becomes `%2F`, `#` becomes
   `%23`, `?` becomes `%3F`, `&` becomes `%26`, `%` becomes `%25`, and a space
   becomes `%20`. A short alphanumeric password avoids the problem entirely.
8. Put the finished string in `server/.env` as `MONGODB_URI`, or in the
   backend host's environment settings. Never paste it into chat, a commit, or
   a frontend variable.

`npm run check-setup` connects and reports whether transactions are supported.

### `JWT_SECRET` — generate it yourself

This is **not** an API key and no service issues it. It signs the API's
`httpOnly` session cookie. Generate a long random value locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Copy the output into `JWT_SECRET` in `server/.env` (or the backend host's
secret settings). Use at least 32 characters, never reuse a value from another
project, and never send it in chat. Changing it signs every user out.

### `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` — test mode only

1. Sign in at <https://dashboard.razorpay.com/> and switch the dashboard to
   **Test Mode**.
2. Open **Account & Settings** → **API Keys** → **Generate Key**.
3. Copy the **Key ID** (starts with `rzp_test_`) and **Key Secret**. The secret
   is shown once; if you lose it, generate a new key.
4. Enter both in `server/.env` or the backend host's environment settings.
   - `RAZORPAY_KEY_ID=rzp_test_...`
   - `RAZORPAY_KEY_SECRET=...`

The API rejects live keys (`rzp_live_...`) and returns `503` until test keys are
present. Test-mode cards/UPI methods are listed in Razorpay's test documentation.
No real charge is made.

### `RAZORPAY_WEBHOOK_SECRET` — set it when creating the webhook

The webhook lets Razorpay notify the API even if the browser closes. The secret
is a value **you choose**, not one issued by Razorpay.

1. Make the API reachable over public HTTPS. Locally, use a tunnel:

   ```bash
   cloudflared tunnel --url http://localhost:5000
   # or: ngrok http 5000
   ```

2. In the Razorpay Dashboard, open **Account & Settings** → **Webhooks** →
   **Add New Webhook**.
3. Set the URL to:

   ```text
   https://<your-backend-host>/api/payments/razorpay/webhook
   ```

   For a tunnel, use the generated `https://...` URL plus the same path.
4. Enter a unique webhook secret. Generate one locally with the same Node
   command used for `JWT_SECRET`, or another long random value. Enter the exact
   same value in `RAZORPAY_WEBHOOK_SECRET` in the backend environment.
5. Select the events this code handles:
   - `payment.captured`
   - `order.paid`
   - `payment.failed`

   Other events are acknowledged and ignored.
6. Save the webhook. If the tunnel URL changes, update the dashboard URL; the
   secret can stay the same.

The API verifies the HMAC over the exact raw request body. Deliveries are
idempotent: Razorpay retries reuse the event id and are not processed twice.

### `CLIENT_ORIGIN` — exact frontend origin

Use the scheme, host and port only, with no path or trailing slash:

- Local: `http://localhost:5173`
- Vercel: `https://your-store.vercel.app`
- Netlify: `https://your-store.netlify.app`
- Custom domain: `https://shop.example.com`

CORS allows exactly one origin. Preview deployments with different URLs will be
blocked unless you point `CLIENT_ORIGIN` at that URL or use a stable custom
domain. Never use `*`.

### `VITE_API_BASE_URL` — public backend URL

This is the API base **including `/api`**:

- Local: `http://localhost:5000/api`
- Render: `https://your-api.onrender.com/api`
- Railway: `https://your-api.up.railway.app/api`

It is public configuration, not a secret. Vite bakes it into the build, so
redeploy the frontend after changing it.

## Local verification checklist

After entering values:

1. `cd server && npm run check-setup`
   - every required line says present;
   - MongoDB says connected;
   - transactions say supported.
2. `npm run seed` — idempotent; reports created/already-existed counts.
3. `npm run dev`, then check `http://localhost:5000/api/health`.
4. Register a customer, promote the intended admin, and confirm both roles.
5. Exercise the catalogue, cart, coupon quote, cash-on-delivery checkout,
   order history, and admin product/order/coupon/user screens.
6. Place a checkout on Atlas and confirm it succeeds. A standalone MongoDB
   should return the transaction-required `503` instead.
7. With Razorpay test keys:
   - one successful test payment (order becomes `Paid`);
   - one failed or cancelled attempt (order stays unpaid and can be retried);
   - one expired reservation (20-minute window; stock and coupon usage are
     released by the sweep).
8. Deliver a webhook through the tunnel. Confirm a valid signature is accepted,
   an invalid signature is rejected, and a repeated event id is treated as a
   duplicate.
9. Run the existing checks:

   ```bash
   cd client/Jobaaj-Store
   npm run lint
   npm run build
   ```

   and `node --check` over `server/src`. No test framework is used.

Test-mode success is not a live payment. Do not switch to live keys or enable
real charges in this phase.

## Deployment

### Recommended architecture

- **Database:** MongoDB Atlas M0 (replica set, transactions supported).
- **Backend:** Render Web Service or Railway, root directory `server/`.
- **Frontend:** Vercel or Netlify, root directory `client/Jobaaj-Store/`.

This keeps the long-running Express API and Razorpay webhook on a server host,
while the static Vite build is served by a CDN. A serverless frontend host is
not a good fit for this API as written.

### 1. Database

Create the Atlas cluster, database user and network access as described above.
Copy the connection string into the backend host's `MONGODB_URI`.

### 2. Backend on Render

1. Push the repository to GitHub (see the remote section below).
2. In Render, choose **New** → **Web Service** and connect the repository.
3. Settings:
   - **Root Directory:** `server`
   - **Runtime:** Node
   - **Build Command:** `npm ci`
   - **Start Command:** `npm start`
   - **Health Check Path:** `/api/health`
   - **Node version:** 20 or newer (the `engines` field requires it)
4. Add environment variables:

   ```text
   NODE_ENV=production
   MONGODB_URI=<your Atlas connection string>
   CLIENT_ORIGIN=https://<your frontend domain>
   JWT_SECRET=<your generated secret>
   JWT_EXPIRES_IN=7d
   COOKIE_SAME_SITE=none
   RAZORPAY_KEY_ID=rzp_test_...
   RAZORPAY_KEY_SECRET=<your test key secret>
   RAZORPAY_WEBHOOK_SECRET=<your webhook secret>
   ```

   Do not set `PORT`; Render provides it. `CLIENT_ORIGIN` and a 32+ character
   `JWT_SECRET` are required in production, and the API refuses to start without
   them.
5. Deploy, then open `https://<your-api-host>/api/health`. It must return
   `"status": "ok"` and a connected database.
6. Free Render services sleep when idle. For reliable payment webhooks use an
   always-on instance; Razorpay retries deliveries, but a sleeping service can
   delay them.

**Railway alternative:** create a project from the repository, set the service
root to `server`, start command `npm start`, add the same variables, and use
the generated HTTPS domain for the health and webhook URLs. Railway supplies
`PORT`.

### 3. Frontend on Vercel

1. In Vercel, choose **Add New** → **Project** and import the repository.
2. Set **Root Directory** to `client/Jobaaj-Store`.
3. Framework preset: Vite. Build command `npm run build`, output directory
   `dist`, install command `npm ci`.
4. Add environment variable for Production (and Preview if you use it):

   ```text
   VITE_API_BASE_URL=https://<your-api-host>/api
   ```

5. Deploy, then copy the production URL into the backend's `CLIENT_ORIGIN` and
   redeploy the backend.
6. The app uses hash routing (`#/...`), so no SPA rewrite is required. If you
   later switch to history routing, add a catch-all rewrite to `index.html`.

**Netlify alternative:** base directory `client/Jobaaj-Store`, build command
`npm run build`, publish directory `dist`, and the same
`VITE_API_BASE_URL` environment variable.

### 4. CORS and cookies

- `CLIENT_ORIGIN` must exactly match the deployed frontend origin.
- If the frontend and backend are on different sites (for example
  `*.vercel.app` and `*.onrender.com`), set `COOKIE_SAME_SITE=none`. HTTPS is
  mandatory and production forces the `Secure` cookie flag.
- If both use custom subdomains of one registrable domain (for example
  `shop.example.com` and `api.example.com`), `COOKIE_SAME_SITE=lax` is
  preferable and avoids third-party-cookie blocking.
- Browsers may block cross-site cookies (notably Safari/ITP). A custom domain
  shared by the storefront and API is the most reliable production setup.
- The frontend already sends `credentials: "include"`. After login, the
  `nivora_session` cookie should be `HttpOnly`, `Secure` in production, and
  have the configured `SameSite` value.
- In production the API trusts one reverse-proxy hop so the auth rate limiter
  sees the visitor IP. If you add another proxy or CDN in front, adjust that
  setting in `server/src/app.js`.

### 5. Production webhook

Set the Razorpay webhook URL to:

```text
https://<your-api-host>/api/payments/razorpay/webhook
```

Use the same `RAZORPAY_WEBHOOK_SECRET` in the dashboard and backend
environment, and subscribe to `payment.captured`, `order.paid`, and
`payment.failed`. The endpoint is public by design; the HMAC signature is its
authentication. Never replace that with a browser session or API key.

### 6. Redeploy after environment changes

- **Backend:** save the new variables and restart/redeploy. Then recheck
  `/api/health`.
- **Frontend:** redeploy after changing `VITE_API_BASE_URL`; Vite embeds it at
  build time.
- **Razorpay:** update the webhook URL if the backend domain changes.

### Deployment reference

| Item | Value |
| --- | --- |
| Backend root | `server/` |
| Backend build | `npm ci` |
| Backend start | `npm start` |
| Backend health URL | `https://<api-host>/api/health` |
| Backend webhook URL | `https://<api-host>/api/payments/razorpay/webhook` |
| Frontend root | `client/Jobaaj-Store/` |
| Frontend build | `npm run build` |
| Frontend output | `dist` |
| Frontend host variable | `VITE_API_BASE_URL` only |

### GitHub remote

No Git remote is configured yet. To publish:

1. Create an empty repository on GitHub (no README, no `.gitignore`).
2. Copy its HTTPS or SSH URL.
3. From the project root:

```bash
git remote add origin https://github.com/<your-username>/<repository>.git
git push -u origin main
```

No remote URL is included in this repository. Do not invent one, add a remote,
push, or publish hosting without the real repository and account details. If
you want an agent to add the remote, provide the URL yourself.

Before pushing, confirm that `git status` shows no `.env`, credentials,
`node_modules`, or `dist` files. The root `.gitignore` already ignores `.env*`
except `.env.example`, dependency folders, and build output.

## Security notes

- Keep `server/.env` local and untracked. Commit only `.env.example`.
- Secrets belong only in the backend environment. The browser receives the
  Razorpay public key id, Razorpay order id, amount, and prefill details, never
  a key secret or webhook secret.
- Payment status is changed only by server-side verification and webhooks, not
  by admin or client requests.
- If a secret leaks, rotate it: regenerate the Razorpay key/webhook secret and
  replace `JWT_SECRET` (which signs everyone out), then redeploy.
- This phase uses Razorpay test mode only. Live keys are rejected by code.

## Remaining user actions

1. Create the Atlas cluster/user and enter `MONGODB_URI`.
2. Generate and enter `JWT_SECRET`.
3. Enter Razorpay test keys and the webhook secret.
4. Run the local verification checklist, including a test payment and webhook.
5. Create the GitHub repository and provide its URL if you want it connected.
6. Connect the backend and frontend hosts, set their variables, deploy, and
   configure the production webhook.
7. Record the test transaction result. Until then, no real payment has been
   verified.
