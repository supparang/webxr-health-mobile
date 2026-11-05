import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const workflow=await readFile(
  new URL("../../.github/workflows/activa-ai-staging-acceptance.yml",import.meta.url),"utf8"
);
const script=await readFile(
  new URL("../scripts/verify-staging-security.mjs",import.meta.url),"utf8"
);

// The workflow must not start monitoring, deploy or call a remote endpoint
// merely because a PR, push, schedule or other CI event happened.
assert(/\bon:\s*\n\s+workflow_dispatch:/.test(workflow));
assert(!/\n\s+(?:push|pull_request|schedule|workflow_run|repository_dispatch):/.test(workflow));
assert(/permissions:\s*\n\s+contents:\s*read/.test(workflow));
assert(!/\n\s+(?:issues|actions|deployments|packages|checks|pull-requests):\s*write\b/.test(workflow));
assert(workflow.includes("environment: ACTIVA-Staging-ReadOnly"));
assert(workflow.includes('ACTIVA_S211_APPROVAL_ENABLED: ${{ vars.ACTIVA_S211_APPROVAL_ENABLED }}'));
const approvedOrigin='ACTIVA_S210_STAGING_URL: ${{ vars.ACTIVA_S211_APPROVED_STAGING_ORIGIN }}';
const independentOrigin='ACTIVA_S210_APPROVED_ORIGIN: ${{ vars.ACTIVA_S211_APPROVED_STAGING_ORIGIN }}';
assert(workflow.includes(approvedOrigin));
assert(workflow.includes(independentOrigin));
assert(workflow.includes('ACTIVA_S210_FRONTEND_ORIGIN: ${{ vars.ACTIVA_S211_APPROVED_FRONTEND_ORIGIN }}'));
assert(workflow.includes('ACTIVA_S210_EXPECTED_COMMIT: ${{ inputs.expected_source_commit }}'));
assert(workflow.includes('ACTIVA_S210_READ_ONLY_CONFIRM: "true"'));
assert(workflow.includes('if [[ "${ACTIVA_S211_APPROVAL_ENABLED}" != "true" ]]'));
assert(workflow.includes('^[0-9a-fA-F]{40}$'));
assert(workflow.includes("ref: main"),"Audited checkout must use main only");
assert(workflow.includes("persist-credentials: false"));
assert(workflow.includes("node scripts/verify-staging-security.mjs"));
assert(workflow.includes("test-results/s2-11-staging-acceptance.json"));
assert(workflow.includes("retention-days: 14"));
assert(workflow.includes("Production security GO: HOLD"));

// Only the existing S2.10 read-only verifier is authorized to send traffic.
// It performs GET/OPTIONS with omitted credentials and blocked redirects.
assert(script.includes('credentials:"omit",redirect:"error"'));
assert(script.includes('method:"GET"'));
assert(script.includes("validateS210Target(options)"));
assert(script.includes("productionGoApproved:false"));
assert(script.includes('manualAcceptanceStatus:"NOT_TESTED"'));
for(const forbidden of [
  "gh issue create", "gh pr merge", "docker push", "kubectl apply",
  "ACTIVA_PRODUCTION_GO_ENABLED=true", "on: push",
])assert(!workflow.includes(forbidden),"Dangerous workflow action: "+forbidden);
console.log("ACTIVA-AI S2.11 manual-dispatch gate and non-mutating workflow contract: PASS");
