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

## Manual administrator promotion

There is no public admin-granting endpoint. To promote an existing registered
account, run this on the server with the same environment used by the API:

```bash
npm run promote-admin -- owner@example.com
```

The command only updates an already registered email. It never creates an
account and never promotes based on browser input.
