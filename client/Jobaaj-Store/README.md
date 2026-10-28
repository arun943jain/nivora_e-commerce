# Nivora storefront

React 19 + Vite + Tailwind CSS storefront for the Nivora e-commerce project.

It provides catalogue browsing, authentication, a server-side cart, coupons,
cash-on-delivery checkout, Razorpay test-mode online payments, order history,
and the admin screens. All prices, stock, discounts and payment status are
calculated or confirmed by the API; the browser never decides a total or marks
an order paid.

## Local development

```bash
cd client/Jobaaj-Store
cp .env.example .env          # PowerShell: Copy-Item .env.example .env
npm install
npm run dev
```

Open <http://localhost:5173>. The API is expected at the URL in
`VITE_API_BASE_URL` (default `http://localhost:5000/api`).

Start the backend first as described in
[`server/README.md`](../../server/README.md) and the
[project README](../../README.md#local-setup).

## Environment

Only one variable is read:

| Variable | Secret? | Value |
| --- | --- | --- |
| `VITE_API_BASE_URL` | No | Public API base URL including `/api`, for example `http://localhost:5000/api` or `https://your-api.onrender.com/api`. |

`VITE_*` values are compiled into the browser bundle. Never put
`MONGODB_URI`, `JWT_SECRET`, `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`, or any other secret in this file, in client code, or
in browser storage. The Razorpay public key id is returned by the API at
checkout time and is not stored here.

Vite embeds `VITE_API_BASE_URL` at build time, so redeploy after changing it.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite dev server. |
| `npm run lint` | Run Oxlint. |
| `npm run build` | Create the production build in `dist/`. |
| `npm run preview` | Preview the production build locally. |

## Deployment

Recommended: Vercel or Netlify.

- **Root directory:** `client/Jobaaj-Store`
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm ci`
- **Environment:** `VITE_API_BASE_URL=https://<your-api-host>/api`

After deploying, set the backend's `CLIENT_ORIGIN` to this site's exact origin
(scheme + host, no path or trailing slash) and redeploy the backend. If the API
is on a different site, the backend also needs `COOKIE_SAME_SITE=none` and
HTTPS; see the [project README](../../README.md#deployment) for the full CORS,
cookie, webhook and hosting checklist.

The app uses hash routing (`#/...`), so no SPA rewrite is required. Add a
catch-all rewrite to `index.html` only if you switch to history routing.

## Notes

- This build uses Razorpay **test mode** only; live keys are rejected by the
  API. No real money is charged.
- Payment success in the Razorpay window is not final until the API verifies
  the signature, amount and captured status.
- Cash on delivery remains available alongside online payment.
