// S3.1: dual-authority, commit-bound Production release acceptance.
// NEVER accept a Boolean/self-attested flag as proof of an independent
// security and operations review. The two Ed25519 PRIVATE signing keys MUST
// stay outside the application/repository/CI. Only public keys + signatures
// for an exact deployed source commit enter the application's environment.
// This cryptographic check does not independently verify assessment contents.
import crypto from "node:crypto";
import {deployedSourceCommit} from "./source-revision.js";
import {trustedReleaseSignerPins} from "./release-authority-trust.js";

const SHA40=/^[a-f0-9]{40}$/;
const SHA256=/^[a-f0-9]{64}$/;
const UTC=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/;
const BASE64=/^[A-Za-z0-9+/]+={0,2}$/;
const NONCE=/^[a-f0-9]{32,128}$/;
const MAX_APPROVAL_WINDOW_MS=24*60*60*1000;
const PREFIX="ACTIVA-AI-PRODUCTION-SECURITY-GO-V2";

function decodeBase64(value,maxBytes) {
  if(typeof value!=="string" || value.length<40 ||
     value.length>maxBytes*2 || !BASE64.test(value))return null;
  const b=Buffer.from(value,"base64");
  // The canonical encoding rules out aliases and malformed/truncated bytes.
  return b.length<=maxBytes&&b.length>0&&
    b.toString("base64")===value?b:null;
}
function publicKey(value) {
  const bytes=decodeBase64(value,1024);
  if(!bytes)return null;
  try{
    const key=crypto.createPublicKey({key:bytes,format:"der",type:"spki"});
    return key.asymmetricKeyType==="ed25519"?key:null;
  }catch{return null;}
}
export function signedProductionApprovalMessage(sha,stagingCommit,evidenceDigest,until,nonce) {
  if(!SHA40.test(sha||"")||!SHA40.test(stagingCommit||"")||
     !SHA256.test(evidenceDigest||"")||
     typeof until!=="string"||typeof nonce!=="string") {
    throw Error("S37_SIGNED_ACCEPTANCE_MESSAGE_INVALID");
  }
  // Both signers must approve exactly the same deployed SHA, verified
  // Staging revision and *independently reviewed* evidence-dossier digest.
  // The application cannot determine whether the dossier itself is genuine.
  return PREFIX+"\n"+sha+"\n"+stagingCommit+"\n"+
    evidenceDigest+"\n"+until+"\n"+nonce+"\n";
}
// The optional third argument is for local-only synthetic security unit tests.
// Application and deployment callers always use source-pinned trust anchors.
export function productionReleaseApproval(env=process.env,now=new Date(),pins=trustedReleaseSignerPins) {
  const failed=(reason)=>({approved:false,reason});
  // Explicit production tier + operator switch are separate prerequisites.
  if (env.ACTIVA_DEPLOYMENT_TIER!=="PRODUCTION" ||
      env.ACTIVA_PRODUCTION_GO_ENABLED!=="true") {
    return failed("S31_PRODUCTION_TIER_OR_GO_DISABLED");
  }
  const source=deployedSourceCommit(env);
  if(!source)return failed("S31_DEPLOYED_SOURCE_COMMIT_UNVERIFIED");
  const expected=String(env.ACTIVA_RELEASE_APPROVED_COMMIT||"").toLowerCase();
  if(!SHA40.test(expected)||expected!==source) {
    return failed("S31_SIGNED_COMMIT_NOT_CURRENT_DEPLOYMENT");
  }
  const stagingCommit=String(env.ACTIVA_RELEASE_STAGING_COMMIT||"").toLowerCase();
  if(!SHA40.test(stagingCommit)||stagingCommit!==source){
    return failed("S37_SIGNED_STAGING_COMMIT_NOT_CURRENT_DEPLOYMENT");
  }
  const evidenceDigest=String(env.ACTIVA_RELEASE_STAGING_EVIDENCE_SHA256||"");
  if(!SHA256.test(evidenceDigest)){
    return failed("S37_VERIFIED_STAGING_EVIDENCE_DIGEST_REQUIRED");
  }
  const until=String(env.ACTIVA_RELEASE_APPROVED_UNTIL_UTC||"");
  const nonce=String(env.ACTIVA_RELEASE_APPROVAL_NONCE||"");
  const expiry=Date.parse(until);
  const current=now instanceof Date?now.getTime():Number.NaN;
  if(!UTC.test(until)||!Number.isFinite(expiry)||!Number.isFinite(current)||
     expiry<=current||expiry-current>MAX_APPROVAL_WINDOW_MS||
     !NONCE.test(nonce)) {
    return failed("S31_SIGNED_APPROVAL_WINDOW_INVALID");
  }
  const security=publicKey(env.ACTIVA_RELEASE_SECURITY_PUBLIC_KEY_B64);
  const operations=publicKey(env.ACTIVA_RELEASE_OPERATIONS_PUBLIC_KEY_B64);
  if(!security||!operations){
    return failed("S31_DUAL_AUTHORITY_PUBLIC_KEYS_REQUIRED");
  }
  // Reusing the same public key for both roles is a one-person signoff.
  if(crypto.timingSafeEqual(
    crypto.createHash("sha256").update(security.export({type:"spki",format:"der"})).digest(),
    crypto.createHash("sha256").update(operations.export({type:"spki",format:"der"})).digest()
  )) return failed("S31_DISTINCT_SIGNING_AUTHORITIES_REQUIRED");
  const signatureSecurity=decodeBase64(env.ACTIVA_RELEASE_SECURITY_SIGNATURE_B64,64);
  const signatureOperations=decodeBase64(env.ACTIVA_RELEASE_OPERATIONS_SIGNATURE_B64,64);
  if(signatureSecurity?.length!==64||signatureOperations?.length!==64){
    return failed("S31_SIGNED_APPROVAL_SIGNATURES_REQUIRED");
  }
  const message=Buffer.from(signedProductionApprovalMessage(
    expected,stagingCommit,evidenceDigest,until,nonce),"utf8");
  try{
    if(!crypto.verify(null,message,security,signatureSecurity) ||
       !crypto.verify(null,message,operations,signatureOperations)) {
      return failed("S31_SIGNED_APPROVAL_VERIFICATION_FAILED");
    }
  } catch {return failed("S31_SIGNED_APPROVAL_VERIFICATION_FAILED");}
  // S3.8: signature validity is not signer AUTHORITY. A deployment operator
  // can replace all env public keys and signatures together. Trust anchors
  // must therefore be pinned in separately reviewed source code, not env.
  // A missing/not-yet-enrolled pin means HOLD, even with two valid signatures.
  const securityPin=pins?.security, operationsPin=pins?.operations;
  if(typeof securityPin!=="string"||!SHA256.test(securityPin)||
     typeof operationsPin!=="string"||!SHA256.test(operationsPin)||
     securityPin===operationsPin){
    return failed("S38_TRUSTED_SIGNING_IDENTITIES_NOT_ENROLLED");
  }
  const hashKey=key=>crypto.createHash("sha256").update(
    key.export({type:"spki",format:"der"})).digest();
  if(!crypto.timingSafeEqual(hashKey(security),Buffer.from(securityPin,"hex"))||
     !crypto.timingSafeEqual(hashKey(operations),Buffer.from(operationsPin,"hex"))){
    return failed("S38_SIGNING_IDENTITY_NOT_TRUSTED");
  }
  return {
    approved:true,
    reason:null,
    // Never return signature, keys, personal identities or other private data.
    releaseCommit:source,
    evidenceBound:true,
    expiresAtUtc:until,
    dualAuthorityRequired:true,
  };
}
