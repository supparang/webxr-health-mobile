/**
 * Public frontend runtime configuration for NutriLens TH.
 *
 * IMPORTANT:
 * - NEVER place GEMINI_API_KEY or OPENAI_API_KEY here.
 * - After deploying your Cloudflare Worker (see DEPLOY_GEMINI_WORKER.md),
 *   paste the public Worker URL into DEFAULT_AI_API_BASE (e.g.
 *   'https://nutrilens-th-api.<your-subdomain>.workers.dev') and push once.
 * - Every device opening GitHub Pages will then use your central Gemini Vision
 *   backend automatically without entering any API key on user devices.
 */
export const APP_CONFIG = Object.freeze({
  // Leave empty '' to use same-origin server (e.g. local `npm start`),
  // or set to your deployed Cloudflare Worker / Cloud Run URL for GitHub Pages.
  DEFAULT_AI_API_BASE: 'https://nutrilens-th-api.supparang-r.workers.dev',
});
