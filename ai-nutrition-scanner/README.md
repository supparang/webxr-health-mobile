# NutriLens TH — AI Nutrition Scanner (Research MVP 0.2)

An isolated mobile-first Thai-language food scanner prototype, located within the existing repo but **not** connected to the live HeroHealth application.

## What works
- **Demo mode**: choose one of eight sample Thai dishes; photograph optional. Demo mode does **not** classify the image.
- **AI mode**: local Node gateway can send a photograph to OpenAI Responses API and request a single food ID from the limited catalog. User confirms item and portion. AI recognition is not validated.
- User edits item and weight (1–2,000 g), sees calculated illustrative nutrients, saves history **only on their own device**, exports CSV and deletes history.
- Unit and HTTP/API smoke tests run in Node.js; Playwright Chromium browser QA runs on desktop (1365px), 390px mobile and 320px mobile layouts.
- The browser QA runs a complete workflow: choose dish, recalculate, validate invalid weight, save/reload, export CSV, delete, preview/remove photo, reject oversize photo, reject AI mode without image/API key, check horizontal overflow, capture screenshots. Images uploaded to QA are synthetic 1-pixel pixels only.

## Data provenance and safety
**The eight food/nutrition records are invented software-test fixtures.** They do not represent validated Thai Food Composition Database values, observed foods, official nutrient references, or clinical measurements. Do not treat them as estimates suitable for research outcome measurement, personal health, publications, or public nutrition guidance.

The app does not persist photographs on disk or in browser storage. AI mode **sends the chosen image through the Node server to an external AI provider**. Use with real participant images requires consent, privacy and ethics review. No AI secrets should ever appear in browser code or the GitHub repository.

## Local setup
Requires Node.js 20+.
1. Change directory to ai-nutrition-scanner.
2. Run: npm test
3. Run: npm start
4. Open http://localhost:3000 and choose Demo.
5. To try AI: set OPENAI_API_KEY **on the server**, optionally OPENAI_VISION_MODEL, restart, and choose AI mode with a photograph. API usage may incur charges.

For optional local Chromium QA:
1. Run: npm install --no-save --no-package-lock playwright@1.56.1
2. Run: npx playwright install chromium
3. Start npm start in another terminal.
4. Run: node tests/browser-smoke.mjs

Screenshots are generated in qa-artifacts. GitHub Actions also collects screenshots into the nutrilens-browser-qa-screenshots artifact for review.

## Deployment separation
This PR intentionally remains **Draft**, unmerged into main. The repo's existing deploy-pages.yml automatically publishes **main**. After review and a deliberate merge, the static demo would be available under the existing Pages site's ai-nutrition-scanner/ subpath, subject to actual deployment verification. **No live URL is claimed until tested.**

GitHub Pages is static and **cannot run /api/analyze**; the AI recognition mode needs a separately hosted HTTPS Node API. Do not publish the current Node gateway directly to the Internet without authentication, origin/CSRF controls, rate limits, cost caps, image processing limits, audit logs, and privacy protections.

## Release gates before research or public usage
- Replace fabricated data with licensed, traceable, verified Thai food-composition values per 100 g and recipe-variation metadata.
- Test food recognition with labeled Thai food photographs; report top-1/top-3, confusion matrix, out-of-catalog behavior and subgroup differences.
- Test portion measurement against weighed reference meals; report errors and uncertainty. The current app does **not** infer accurate portion mass from pixels.
- Add separate handling of oil, sauces, sugar, sodium, multiple foods and unknown food.
- Implement user consent, retention, deletion, data minimization and ethics/IRB as required.
- Test on **real Android/iOS devices**, in addition to emulation, plus actual provider API integration.
- Maintain two explicit evidence categories: software functionality vs. scientific validity.

## Files
- index.html, styles.css, app.js — UI, image preview, correction, storage, CSV
- nutrition.js — source-labeled illustrative profiles and calculation logic
- server.mjs — local Node gateway and optional AI recognition
- tests/nutrition.test.mjs, tests/server.test.mjs — deterministic and API tests
- tests/browser-smoke.mjs — automated desktop/mobile browser QA
- .github/workflows/ai-nutrition-scanner.yml — test workflow and QA screenshots
