# CelebrateAI

CelebrateAI plans weddings, birthdays, anniversaries, and community events. You enter the event details, and the server asks Google Gemini for a structured plan: a summary, budget allocation, timeline, vendor questions, ideas, assumptions, and an estimate disclaimer. Budget totals, deadlines, and replanning locks are calculated in the app.

## Local setup

Requires Node.js 22 or newer.

```bash
npm install
```

Windows: `copy .env.example .env`. macOS and Linux: `cp .env.example .env`.

Put your Gemini API key in `.env`. The key stays on the server. Do not commit `.env` or put the key in frontend code.

```bash
npm start
```

Open http://localhost:3000. `npm start` loads `.env` when that file exists and does not override variables already set in the environment. The local process reads `PORT` and listens on `0.0.0.0`.

Without `GEMINI_API_KEY`, the site still runs. Generating or revising a plan returns "AI planning is not configured on this server" and does not invent a plan. Budget, timeline, and quotation edits continue to work on a plan already saved in the browser.

`npm run dev` restarts the server when files change.

## Build and start

There is no frontend build. The server serves `public/` and `shared/` directly.

Local production start, with variables already in the environment:

```bash
node server/index.js
```

The container image uses the same command after `npm ci --omit=dev`:

```bash
docker build -t celebrate-ai .
docker run --rm -p 8080:8080 -e PORT=8080 -e GEMINI_API_KEY=your-key-here celebrate-ai
```

Do not pass a real key on a shared command line if your shell history is retained. Prefer the platform secret store. The image does not copy `.env`.

## Features

- Event form with required-field and date checks.
- AI plan from `POST /api/plan`, validated before it is shown.
- Editable estimates and actual costs. Estimated total, actual spending, and remaining budget are summed in JavaScript.
- Timeline with deadlines counted back from the event date, priorities, and completion.
- Vendor categories, questions, and quotations you enter yourself. The lowest quotation is highlighted.
- Replanning from one change request. An explicit budget or guest count in the request overrides the model. Actual costs, completed tasks, and quotations stay on matching items.
- Before-and-after summary, planner notes, and budget or scheduling conflicts.
- The plan is stored in this browser with `localStorage`.
- Print summary from the plan page.

Costs are planning estimates. The app does not name real vendors or claim verified prices.

## Architecture

- `server/` — Express, security headers, rate limit, Gemini client, plan and replan routes.
- `shared/` — validation, budget totals, deadlines, plan schema, and replan rules. The browser and the server both use these files.
- `public/` — the dashboard. No framework and no API key. `public/js/apiConfig.js` exports an empty `API_BASE`, so local pages call relative `/api/plan` and `/api/replan`.
- Gemini model: `gemini-3.5-flash-lite` through `@google/genai`, using JSON schema output. Override the model with `GEMINI_MODEL`.

Locally, Express serves the pages and the API on one origin. On Firebase Hosting the pages are static, and the API runs as a Vercel Hobby function. `ALLOWED_ORIGINS` allows only `https://celebrate-ai-promptwars.web.app` and `https://celebrate-ai-promptwars.firebaseapp.com`. Set `API_BASE_URL` to the Vercel origin when publishing Hosting; the prepare script writes that origin into `hosting-dist/js/apiConfig.js` and adds it to `connect-src`. API failures return a short `error` and `code`. They do not return stack traces or the API key. A missing key is HTTP 503, a timeout is 504, and a provider or malformed model response is 502.

## Environment variables

Set these in `.env` locally or in the host's runtime configuration. Never commit secret values.

| Name | Required | Purpose |
|---|---|---|
| `PORT` | No | Listen port for `npm start`. Default 3000. Vercel does not use this value. |
| `GEMINI_API_KEY` | For live plans | Server-only Gemini key. Leave unset to run without planning. |
| `GEMINI_MODEL` | No | Default `gemini-3.5-flash-lite`. |
| `AI_TIMEOUT_MS` | No | Model timeout. Default 30000. |
| `PLAN_RATE_MAX` | No | Plan and replan requests per IP per window. Default 10. |
| `PLAN_RATE_WINDOW_MS` | No | Rate-limit window. Default 900000. |
| `ALLOWED_ORIGINS` | For the hosted site | Comma-separated Hosting origins allowed to call the API. Any other origin is ignored. Leave unset locally. |
| `API_BASE_URL` | When publishing Hosting | Public https origin of the Vercel project. Hosting prepare script only. Leave unset until that URL exists. |

## Tests

```bash
npm test
```

The suite covers dates, event validation, budget totals, deadlines, invalid and failed model responses, replanning that changes the budget while keeping the guest count, persistence, and security headers. Model calls in tests use a fake client. A live Gemini call is not part of `npm test`.

## Deployment

Firebase Hosting stays on the Spark plan and serves the static dashboard at `https://celebrate-ai-promptwars.web.app`. The Express API is a Vercel Hobby function. Spark Hosting cannot run Node, so the published pages call the Vercel origin directly once `API_BASE_URL` is set.

`GEMINI_API_KEY` belongs in the Vercel project environment. Do not put it in frontend files, `hosting-dist/`, `vercel.json`, or Firebase config. Use the Hobby plan and do not add a payment method.

### Backend: Vercel Hobby

`app.js` exports the existing Express app for Vercel. `npm start` still runs `server/index.js` and is the local server. Vercel looks for that root `app.js` entry, so the project root must be this `celebrate-ai` directory.

`vercel.json` sets the function `maxDuration` to 60 seconds. Hobby allows up to 300 seconds. Gemini uses `AI_TIMEOUT_MS` (default 30 seconds), and the browser stops waiting after 40 seconds.

Set these environment variables on the Vercel project. Leave them out of git:

| Name | Value |
|---|---|
| `GEMINI_API_KEY` | Server-side Gemini key |
| `ALLOWED_ORIGINS` | `https://celebrate-ai-promptwars.web.app,https://celebrate-ai-promptwars.firebaseapp.com` |

Optional variables are `GEMINI_MODEL`, `AI_TIMEOUT_MS`, `PLAN_RATE_MAX`, and `PLAN_RATE_WINDOW_MS`. Vercel does not use `PORT`.

The rate limit is in memory, so each instance counts separately. `req.ip` is the connecting address. This app does not trust forwarded client IPs.

On Vercel, `express.static()` is not used. Firebase Hosting serves `public/` and `shared/`. Use `https://celebrate-ai-promptwars.web.app` for the dashboard.

### Frontend: Firebase Hosting

`firebase deploy` runs `scripts/prepare-firebase-hosting.js`, which copies `public/` and `shared/` into `hosting-dist/`. That directory is gitignored. The script reads `API_BASE_URL` from the environment, or from `.env` when the environment variable is unset. It ignores every other `.env` entry, including `GEMINI_API_KEY`.

Leave `API_BASE_URL` unset until Vercel shows the project URL. With it unset, Hosting keeps relative `/api` URLs and `connect-src 'self'`.

After the URL exists, set `API_BASE_URL` to that https origin with no path (for example `https://your-project.vercel.app`) and deploy Hosting:

```bash
firebase login
firebase deploy --only hosting --project celebrate-ai-promptwars
```

The prepare script then writes the origin into `hosting-dist/js/apiConfig.js` and adds it to `connect-src` in `firebase.json`. Commit that `firebase.json` change. It contains the public API origin, not the Gemini key.

Static files are cached for one hour. After a Hosting deploy, wait or bypass the cache before judging an old page.

### Checks after you deploy

1. `GET https://<vercel-host>/api/health` returns `{"status":"ok"}`.
2. The Hosting page loads over HTTPS, and the browser console has no errors.
3. View source and the network log. `GEMINI_API_KEY` does not appear.
4. Submit a real event and confirm `POST /api/plan` on the Vercel host returns a plan with a summary, budget items, timeline, and disclaimer.
5. Ask for a budget change that keeps the same guest count. Confirm the guest count stays and the budget total updates.
6. Reload the page and confirm the plan is still in this browser.
7. Submit an invalid date and confirm the form rejects it without calling the model.

Push only source files. `node_modules/`, `.env`, and `.vercel/` are gitignored.
