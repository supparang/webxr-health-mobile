# NutriLens TH — AI Nutrition Scanner (Research MVP 0.1)
Standalone, mobile-first Thai food scanner prototype. Isolated from the existing HeroHealth production files.

## Status
- Working **demo mode**: use a sample Thai food choice; it does **NOT** recognize photographs.
- Optional **AI image recognition mode**: Node server calls OpenAI Responses API with a user-selected image. Only food identification against a limited list is AI-assisted; the user must confirm food and adjust grams.
- The eight included food nutrient values are **invented illustrative software-test fixtures**, not Thai Food Composition Database data. **Do not use them for decisions, research results, health advice or publication.**
- No image is written to disk or localStorage. In AI mode the selected image is sent from the browser to the Node server, then to the AI provider. Local history contains only confirmed food, mode, weight, mock nutrient estimates and timestamp.

## Run
Node.js 20+ required. No npm dependencies.
1. From this directory run: npm test
2. Run: npm start
3. Open http://localhost:3000
4. Demo: choose a dish and click Analyze; photo is optional and **not** read.
5. AI mode: supply OPENAI_API_KEY as a **server-side environment variable**; optionally set OPENAI_VISION_MODEL (default gpt-4.1-mini). Restart server, choose AI mode, provide JPEG/PNG/WebP image (<=3 MB), and analyze.

GitHub Pages may display the static demo, but **cannot execute /api/analyze**. Deploy server.mjs to a compatible Node host with HTTPS for AI mode. Never put your API key in JavaScript, GitHub source or browser localStorage.

## Files
- index.html — responsive Thai interface and disclosure
- styles.css — layout and mobile styles
- app.js — photograph preview, explicit demo/AI modes, confirmation, calculation, CSV, local-only history
- nutrition.js — source-tagged **mock** data and pure calculation functions
- server.mjs — optional API image classification gateway; no uploads persisted
- tests/nutrition.test.mjs — invariant tests

## Before a human-subject or public pilot
1. License and integrate a verified Thai food-composition data source, with recipe, portion size, per-100g basis, revision date and traceability. Replace every illustrative fixture; verify units and rounding.
2. Add ground-truth food photographs with measured portion mass and recipe/ingredient records; report top-1/top-3 classification, portion MAE/MAPE, nutrient MAE and subgroup performance. Do not use the model's self-rated confidence as empirical accuracy.
3. Add consent, privacy notice, deletion/export policy, risk review, authentication/role access if storing server-side, data retention and provider-processing disclosure; seek ethics approval where required.
4. Develop multi-food detection, unknown-food fallback and explicit recipe-specific ingredients (oil, sauces, sugar). Hidden sodium/oil cannot be accurately measured from an image alone.
5. Perform end-to-end mobile/browser tests and validate AI service credentials before pilot; tests presently only cover the deterministic nutrition functions.

## Security and limitations
- Simple Node gateway is a **local prototype**, not production hardened: add request rate limiting, authentication, abuse/billing controls, CSRF/origin checks, TLS, logging minimization and provider retention review prior to internet deployment.
- AI error never silently falls back to demo. Data export marks all values illustrative.
- No public deployed app or live AI accuracy is claimed by this commit.
