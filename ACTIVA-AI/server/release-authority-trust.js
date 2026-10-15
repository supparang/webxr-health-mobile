// S3.8: SOURCE-PINNED identity trust anchors for institutional release signers.
// A deploy-time operator must not be able to replace BOTH public keys and
// signatures in environment variables to manufacture an apparent dual approval.
//
// Deliberately UNPROVISIONED: this repository has no independently verified
// institutional Security/Operations signing identities as of 2026-10-15.
// Authorized maintainers must enroll two DISTINCT verified SHA-256 hashes of
// Ed25519 SPKI DER public keys through a protected, independently reviewed
// source change. Never auto-populate these pins from environment variables,
// CI test fixtures, or a user-supplied acceptance dossier. See S3.8 runbook.
export const trustedReleaseSignerPins = Object.freeze({
  security: null,
  operations: null,
});
