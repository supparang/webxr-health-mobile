// S3.1 synthetic, local-only dual Ed25519 authority checks.
// Never uses actual Production keys, account data, APIs or database.
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {readFile} from "node:fs/promises";
import {
  productionReleaseApproval,signedProductionApprovalMessage,
} from "../server/production-release-approval.js";
import {deploymentConfigurationErrors} from "../server/deployment-config.js";

const SHA="a".repeat(40), ALT="b".repeat(40);
const future=new Date(Date.now()+60*60*1000);
const expiry=future.toISOString().replace(".000Z","Z");
const nonce="c".repeat(48);
const security=crypto.generateKeyPairSync("ed25519");
const operations=crypto.generateKeyPairSync("ed25519");
function b64pub(key){return key.export({format:"der",type:"spki"}).toString("base64");}
const message=Buffer.from(signedProductionApprovalMessage(SHA,expiry,nonce),"utf8");
const template={
  NODE_ENV:"production",ACTIVA_DEPLOYMENT_TIER:"PRODUCTION",
  ACTIVA_PRODUCTION_GO_ENABLED:"true",
  RENDER_GIT_COMMIT:SHA,ACTIVA_RELEASE_APPROVED_COMMIT:SHA,
  ACTIVA_RELEASE_APPROVED_UNTIL_UTC:expiry,
  ACTIVA_RELEASE_APPROVAL_NONCE:nonce,
  ACTIVA_RELEASE_SECURITY_PUBLIC_KEY_B64:b64pub(security.publicKey),
  ACTIVA_RELEASE_OPERATIONS_PUBLIC_KEY_B64:b64pub(operations.publicKey),
  ACTIVA_RELEASE_SECURITY_SIGNATURE_B64:crypto.sign(null,message,security.privateKey).toString("base64"),
  ACTIVA_RELEASE_OPERATIONS_SIGNATURE_B64:crypto.sign(null,message,operations.privateKey).toString("base64"),
  ACTIVA_AUTH_MODE:"GOOGLE_OIDC",
  GOOGLE_CLIENT_ID:"517090311491-u00q8g6aonuj2251ak7erqcose70gg2h.apps.googleusercontent.com",
  GOOGLE_ALLOWED_DOMAINS:"chandra.ac.th",GOOGLE_ALLOWED_EMAILS:"",
  ALLOWED_ORIGINS:"https://supparang.github.io",
  DATABASE_URL:"postgresql://synthetic:ci-local-only@db.internal:5432/activa?sslmode=require",
  QR_SIGNING_SECRET:"abcdef1234567890".repeat(5),
  RESEARCH_HASH_SALT:"fedcba0987654321".repeat(5),
  ACTIVA_SECURITY_ALERT_MODE:"GITHUB_ISSUE",
  ACTIVA_SECURITY_ALERT_GITHUB_REPO:"synthetic-fixture/incidents",
  ACTIVA_SECURITY_ALERT_GITHUB_TOKEN:"github_pat_"+"Z".repeat(50),
  ACTIVA_SECURITY_INCIDENT_STORE:"POSTGRES",
  ACTIVA_RATE_LIMIT_STORE:"POSTGRES",
  ACTIVA_RATE_LIMIT_HMAC_SECRET:"S3_1_SYNTHETIC_NON_PRODUCTION_ONLY_abcdef0123456789",
};
const ok=productionReleaseApproval(template);
assert.equal(ok.approved,true);
assert.equal(ok.releaseCommit,SHA);
assert.equal(ok.dualAuthorityRequired,true);
assert.equal(ok.expiresAtUtc,expiry);
assert.equal(deploymentConfigurationErrors(template).length,0,
  "Signed/strict-TLS Release config should be syntactically acceptable");
assert(!JSON.stringify(ok).includes(template.ACTIVA_RELEASE_SECURITY_SIGNATURE_B64));
assert(!JSON.stringify(ok).includes(template.ACTIVA_RELEASE_OPERATIONS_SIGNATURE_B64));
assert(!JSON.stringify(ok).includes(template.ACTIVA_RELEASE_SECURITY_PUBLIC_KEY_B64));

function rejected(input,expected){
  const actual=productionReleaseApproval(input);
  assert.equal(actual.approved,false,"Unsafe release environment accepted");
  if(expected)assert.equal(actual.reason,expected);
  assert.equal(JSON.stringify(actual).includes(template.ACTIVA_RELEASE_SECURITY_SIGNATURE_B64),false);
  assert.equal(deploymentConfigurationErrors(input).includes(
    "PRODUCTION_INDEPENDENT_SECURITY_SIGNOFF_REQUIRED"),true);
}
rejected({...template,ACTIVA_RELEASE_SECURITY_SIGNATURE_B64:undefined},
  "S31_SIGNED_APPROVAL_SIGNATURES_REQUIRED");
rejected({...template,ACTIVA_RELEASE_OPERATIONS_SIGNATURE_B64:undefined});
rejected({...template,ACTIVA_RELEASE_OPERATIONS_PUBLIC_KEY_B64:template.ACTIVA_RELEASE_SECURITY_PUBLIC_KEY_B64},
  "S31_DISTINCT_SIGNING_AUTHORITIES_REQUIRED");
rejected({...template,RENDER_GIT_COMMIT:ALT},"S31_SIGNED_COMMIT_NOT_CURRENT_DEPLOYMENT");
rejected({...template,RENDER_GIT_COMMIT:"unverified"},"S31_DEPLOYED_SOURCE_COMMIT_UNVERIFIED");
rejected({...template,ACTIVA_RELEASE_APPROVED_COMMIT:ALT});
rejected({...template,ACTIVA_RELEASE_APPROVAL_NONCE:"d".repeat(48)},
  "S31_SIGNED_APPROVAL_VERIFICATION_FAILED");
rejected({...template,ACTIVA_RELEASE_APPROVED_UNTIL_UTC:new Date(Date.now()-60*1000).toISOString()},
  "S31_SIGNED_APPROVAL_WINDOW_INVALID");
rejected({...template,ACTIVA_RELEASE_APPROVED_UNTIL_UTC:new Date(Date.now()+48*60*60*1000).toISOString()},
  "S31_SIGNED_APPROVAL_WINDOW_INVALID");
rejected({...template,ACTIVA_RELEASE_OPERATIONS_SIGNATURE_B64:"AAAAAA"},
  "S31_SIGNED_APPROVAL_SIGNATURES_REQUIRED");
rejected({...template,ACTIVA_RELEASE_SECURITY_PUBLIC_KEY_B64:"AAAAA"},
  "S31_DUAL_AUTHORITY_PUBLIC_KEYS_REQUIRED");
assert.equal(productionReleaseApproval({...template,ACTIVA_PRODUCTION_GO_ENABLED:"false"}).approved,false);
assert.equal(productionReleaseApproval({...template,ACTIVA_DEPLOYMENT_TIER:"STAGING"}).approved,false);
for(const url of [
  "postgresql://synthetic:ci-local-only@db.internal/activa",
  "postgresql://synthetic:ci-local-only@db.internal/activa?sslmode=disable",
  "postgresql://synthetic:ci-local-only@db.internal/activa?sslmode=prefer",
  "postgresql://synthetic:ci-local-only@db.internal/activa?sslmode=require&sslaccept=accept_invalid_certs",
  "postgresql://synthetic:ci-local-only@db.internal/activa?sslmode=require&sslmode=disable",
]){
  const errors=deploymentConfigurationErrors({...template,DATABASE_URL:url,
    ACTIVA_PRODUCTION_GO_ENABLED:"false"});
  assert(errors.includes("PRODUCTION_DATABASE_TLS_REQUIRED"),
    "Database cleartext/downgrade setting must fail closed");
}
for(const sslmode of ["require","verify-ca","verify-full"]){
  const e=deploymentConfigurationErrors({...template,
    DATABASE_URL:"postgresql://synthetic:ci-local-only@db.internal/activa?sslmode="+sslmode,
    ACTIVA_PRODUCTION_GO_ENABLED:"false"});
  assert(!e.includes("PRODUCTION_DATABASE_TLS_REQUIRED"));
}
// In code review, both the informational release gate AND the state-changing
// ADMIN release decision must use identical external dual-signoff evaluation.
const index=await readFile(new URL("../server/index.js",import.meta.url),"utf8");
assert.equal(index.split("const signedSecurityApproval = productionReleaseApproval();").length-1,2);
assert.equal(index.split('blockers.push("INDEPENDENT_SIGNED_SECURITY_AND_OPERATIONS_ACCEPTANCE_REQUIRED")').length-1,1);
assert.equal(index.split('hardBlockers.push("INDEPENDENT_SIGNED_SECURITY_AND_OPERATIONS_ACCEPTANCE_REQUIRED")').length-1,1);
assert(index.includes('signedSecurityApprovalVerified: signedSecurityApproval.approved'));
assert(index.includes('status: signedSecurityApproval.approved ? "PASS" : "HOLD"'));
assert(index.includes("const startupDeploymentErrors ="),
  "Production config and signoffs must be checked at startup");
assert(index.includes("const configErrors = startupDeploymentErrors;"),
  "Short-lived release signature expiry must not disable live readiness");
assert(index.includes('if (!signedSecurityApproval.approved) hardBlockers.push('),
  "New Production GO decisions must still reject expired signatures");

console.log("ACTIVA-AI S3.1 Production TLS and two-authority cryptographic release signoff: PASS");
