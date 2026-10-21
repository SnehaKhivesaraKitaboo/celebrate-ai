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

Open http://localhost:3000. The process reads `PORT` and listens on `0.0.0.0`, so Cloud Run and a local browser can both reach it. `npm start` loads `.env` when that file exists and does not override variables already set in the environment.

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
- `public/` — the dashboard. No framework and no API key. Pages call `/api/plan` and `/api/replan` on the same origin.
- Gemini model: `gemini-3.8-flash` through `@google/genai`, using JSON schema output. Override the model with `GEMINI_MODEL`.

The browser and API are one service. The Content Security Policy allows connections only to `'self'`, and the server does not add a cross-origin allow-list. Deploy the page and the API together. API failures return a short `error` and `code`. They do not return stack traces or the API key. A missing key is HTTP 503, a timeout is 504, and a provider or malformed model response is 502.

## Environment variables

Set these in `.env` locally or in the host's runtime configuration. Never commit secret values.

| Name | Required | Purpose |
|---|---|---|
| `PORT` | No | Listen port. Default 3000. Cloud Run sets this, usually to 8080. |
| `GEMINI_API_KEY` | For live plans | Server-only Gemini key. Leave unset to run without planning. |
| `GEMINI_MODEL` | No | Default `gemini-3.8-flash`. |
| `AI_TIMEOUT_MS` | No | Model timeout. Default 30000. |
| `PLAN_RATE_MAX` | No | Plan and replan requests per IP per window. Default 10. |
| `PLAN_RATE_WINDOW_MS` | No | Rate-limit window. Default 900000. |

## Tests

```bash
npm test
```

The suite covers dates, event validation, budget totals, deadlines, invalid and failed model responses, replanning that changes the budget while keeping the guest count, persistence, and security headers. Model calls in tests use a fake client. A live Gemini call is not part of `npm test`.

## Deployment

The browser files and the Express API stay separate. Nothing in this repository has been deployed, and a live Gemini request has not been confirmed against a deployed URL.

### Frontend: Firebase Hosting

Firebase project: `celebrate-ai-promptwars`.

`firebase deploy` builds `hosting-dist/` from `public/` and `shared/`, then uploads that directory. The published site keeps the same URLs the app already uses, including `/shared/`. `hosting-dist/` is generated and gitignored. No API key is included.

```bash
firebase login
firebase deploy --only hosting --project celebrate-ai-promptwars
```

### Backend: Cloud Run

Keep the Express server on Cloud Run in the same Google Cloud project. Cloud Run injects `PORT`. Pass `GEMINI_API_KEY` as a runtime secret. Do not put that key in Hosting files or the image.

```bash
gcloud run deploy celebrate-ai --source . --project celebrate-ai-promptwars --region REGION --allow-unauthenticated --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

Replace `REGION` and the secret name with your project values. After the service exists, add this rewrite to `firebase.json` inside `hosting` so the pages can keep calling `/api` on the Hosting origin:

```json
"rewrites": [{
  "source": "/api/**",
  "run": { "serviceId": "celebrate-ai", "region": "REGION" }
}]
```

Deploy Hosting again after adding the rewrite. Until that rewrite exists, the Hosting site can load the dashboard, and plan generation has no API behind it.

- The container runs as the `node` user and starts with `node server/index.js`.
- The rate limit is in memory, so each instance counts separately. `req.ip` is the connecting address. Behind Cloud Run that is the proxy address unless the platform's forwarded IP is trusted. This app does not enable open proxy trust.
- Static files are cached for one hour. After a deploy, wait or change the revision URL before judging an old page.

### Checks after you deploy

Run these against the Cloud Run URL. They are not a substitute for a successful deploy check in this repository.

1. `GET /api/health` returns `{"status":"ok"}`.
2. The site loads over HTTPS, and the browser console has no errors.
3. View source and the network log. `GEMINI_API_KEY` does not appear.
4. Submit a real event and confirm `POST /api/plan` returns a plan with a summary, budget items, timeline, and disclaimer.
5. Ask for a budget change that keeps the same guest count. Confirm the guest count stays and the budget total updates.
6. Reload the page and confirm the plan is still in this browser.
7. Submit an invalid date and confirm the form rejects it without calling the model.

Push only source files. `node_modules/` and `.env` are gitignored.
