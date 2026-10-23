# CelebrateAI

CelebrateAI plans weddings, birthdays, anniversaries, and community events. You enter the event details, and the server asks Google Gemini for a structured plan: a summary, budget allocation, timeline, vendor questions, ideas, assumptions, and an estimate disclaimer. Budget totals, deadlines, and replanning locks are calculated in the app.

## Local setup

Requires Node.js 22 or newer.

```bash
npm install
```

Windows: `copy .env.example .env`. macOS and Linux: `cp .env.example .env`.

The dashboard does not read `GEMINI_API_KEY`. Do not commit `.env` or put that key in frontend code.

```bash
npm start
```

Open http://localhost:3000. `npm start` loads `.env` when that file exists and does not override variables already set in the environment. The local process reads `PORT` and listens on `0.0.0.0`.

Generating a plan calls Firebase AI Logic in the browser. Until that product is enabled on the Spark plan, generation returns "AI planning is not configured on this server" or "The planning service is unavailable" and does not invent a plan. Budget, timeline, and quotation edits continue to work on a plan already saved in the browser.

`npm run dev` restarts the server when files change.

## Build and start

There is no frontend build. The server serves `public/` and `shared/` directly.

Local production start, with variables already in the environment:

```bash
node server/index.js
```

The container image still starts the local Express process. It is not part of the Firebase Hosting deployment.

```bash
docker build -t celebrate-ai .
docker run --rm -p 8080:8080 -e PORT=8080 celebrate-ai
```

Do not pass a Gemini key on a shared command line. The image does not copy `.env`. The dashboard served by the container uses Firebase AI Logic, the same as Hosting.

## Features

- Event form with required-field and date checks.
- AI plan from Firebase AI Logic, validated before it is shown.
- Editable estimates and actual costs. Estimated total, actual spending, and remaining budget are summed in JavaScript.
- Timeline with deadlines counted back from the event date, priorities, and completion.
- Vendor categories, questions, and quotations you enter yourself. The lowest quotation is highlighted.
- Replanning from one change request. An explicit budget or guest count in the request overrides the model. Actual costs, completed tasks, and quotations stay on matching items.
- Before-and-after summary, planner notes, and budget or scheduling conflicts.
- The plan is stored in this browser with `localStorage`.
- Print summary from the plan page.

Costs are planning estimates. The app does not name real vendors or claim verified prices.

## Architecture

- `public/` — the dashboard. Generate and replan call Firebase AI Logic with `GoogleAIBackend` (Gemini Developer API). The browser never receives the server Gemini key.
- `shared/` — validation, prompts, budget totals, deadlines, plan schema, and replan rules.
- `server/` — local static hosting and the previous Express routes. The deployed site does not call those routes.
- Gemini model: `gemini-3.5-flash-lite`, JSON schema output, from the browser through Firebase AI Logic.

Firebase Hosting on the Spark plan serves `public/` and `shared/`. There is no Cloud Functions, Cloud Run, Vercel, or Render deployment.

## Environment variables

`npm start` still reads `.env` for the local Express process. The dashboard ignores it. Never commit secret values.

| Name | Required | Purpose |
|---|---|---|
| `PORT` | No | Listen port for `npm start`. Default 3000. |
| `GEMINI_API_KEY` | No | Not used by the dashboard or Firebase Hosting. Leave it out of frontend files. |

## Tests

```bash
npm test
```

The suite covers dates, event validation, budget totals, deadlines, invalid and failed model responses, replanning that changes the budget while keeping the guest count, persistence, and security headers. Model calls in tests use a fake client. A live Gemini call is not part of `npm test`.

## Deployment

Stay on the Firebase Spark plan. Do not add a payment method, and do not enable the Agent Platform Gemini API (formerly Vertex AI). The dashboard uses the Gemini Developer API free tier through Firebase AI Logic. Firebase provisions access with its own service agent. The server Gemini key is not part of that setup.

The web app `CelebrateAI` is already registered. Its public config is in `public/js/firebasePublicConfig.js`. That `apiKey` is the Firebase web API key, not the server Gemini key.

`firebase deploy` copies `public/` and `shared/` into `hosting-dist/`. That directory is gitignored. The prepare script does not read `.env`.

### Firebase Console

1. Open [Firebase console](https://console.firebase.google.com/project/celebrate-ai-promptwars/overview) and confirm the plan is Spark. If a screen offers Blaze or asks for a card, cancel.
2. Go to **AI Services → AI Logic → Get started**.
3. Choose **Gemini Developer API**. Do not choose Agent Platform.
4. Finish the workflow. It enables the Gemini Developer API and the Firebase AI Logic API, and it provisions the Firebase AI Logic service agent. If it creates a Gemini API key, leave that key out of the source.
5. Go to **Security → App Check**. Register the existing web app `CelebrateAI` with **reCAPTCHA Enterprise**. Use the no-cost tier. Do not link a billing account. Allow these domains:
   - `celebrate-ai-promptwars.web.app`
   - `celebrate-ai-promptwars.firebaseapp.com`
   - `localhost`
6. Copy the reCAPTCHA Enterprise **site key** into `appCheckSiteKey` in `public/js/firebasePublicConfig.js`. Leave it empty only for a short local check before App Check is enforced.
7. In Google Cloud, open **APIs & Services → Credentials** and select the browser key that matches `firebaseConfig.apiKey`.
   - Application restriction: **HTTP referrers**
   - `https://celebrate-ai-promptwars.web.app/*`
   - `https://celebrate-ai-promptwars.firebaseapp.com/*`
   - `http://localhost:3000/*`
   - `http://127.0.0.1:3000/*`
   - API restriction: **Firebase AI Logic API** only. Do not add the Generative Language API to this key.
8. Enforce App Check for Firebase AI Logic after the site key is in the deployed page. Firebase will enforce it automatically on 2 November 2026.

### Publish Hosting

From `celebrate-ai`:

```bash
firebase login
firebase deploy --only hosting --project celebrate-ai-promptwars
```

Do not run a full `firebase deploy` that adds other products. Do not deploy to Vercel, Render, Cloud Functions, or Cloud Run.

Static files are cached for one hour. After a Hosting deploy, wait or bypass the cache before judging an old page.

### Checks after you deploy

1. The Hosting page loads over HTTPS, and the browser console has no errors.
2. View source and the network log. The server Gemini key does not appear. Requests go to `firebasevertexai.googleapis.com`, not to `/api/plan`.
3. Submit a real event and confirm the plan has a summary, budget items, timeline, and disclaimer.
4. Ask for a budget change that keeps the same guest count. Confirm the guest count stays and the budget total updates.
5. Reload the page and confirm the plan is still in this browser.
6. Submit an invalid date and confirm the form rejects it without calling the model.
7. In Usage and billing, confirm the project is still Spark.

Push only source files. `node_modules/`, `.env`, and `hosting-dist/` are gitignored.
