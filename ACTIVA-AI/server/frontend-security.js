// S2.6 — explicit browser script allowlist for the ACTIVA-AI static UI.
// The same policy is used in HTML <meta> tags (GitHub Pages) and on HTML
// responses served by the Node backend. Meta CSP cannot set frame-ancestors.
export const FRONTEND_CSP_META = [
  "default-src 'self'",
  "script-src 'self' https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js https://accounts.google.com/gsi/client",
  "script-src-attr 'none'",
  // ACTIVA-AI legacy markup/QR scanner uses inline styles, not inline scripts.
  // Remove 'unsafe-inline' only after refactoring dynamic style attributes.
  "style-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/style",
  "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: data:",
  "font-src 'self' data: https:",
  "worker-src 'self' blob:",
  "frame-src https://accounts.google.com/gsi/",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join("; ");

// frame-ancestors cannot be enforced by an HTML CSP meta element.
// GitHub Pages needs a host/CDN that can set this HTTP header if clickjacking
// protection beyond JavaScript/API role checks is required.
export const FRONTEND_CSP_HEADER = FRONTEND_CSP_META + "; frame-ancestors 'none'";

export function setFrontendHtmlSecurityHeaders(res) {
  res.set("Content-Security-Policy", FRONTEND_CSP_HEADER);
  res.set("Cache-Control", "no-store");
}
