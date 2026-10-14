// S2.8 CI-only: independently compare pinned SRI against exact raw CDN bytes.
// Reject redirects, changed scripts, unexpected content type or missing CORS.
// This step has no credentials and makes no Production API requests.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";

const manifest=JSON.parse(await readFile(new URL("./browser-asset-integrity.json",import.meta.url),"utf8"));
assert.equal(manifest.assets.length,2,"S2_8_UNREVIEWED_ASSET_INVENTORY");
for(const asset of manifest.assets) {
  const response=await fetch(asset.url,{
    method:"GET",redirect:"error",
    signal:AbortSignal.timeout(15000),
    headers:{Accept:"application/javascript, text/javascript, */*;q=0.5"},
  });
  assert(response.ok&&response.url===asset.url,
    "S2_8_CDN_RETRIEVAL_FAILED "+asset.id+" HTTP "+response.status);
  const bytes=Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.length,asset.bytes,"S2_8_CDN_SIZE_CHANGED "+asset.id);
  const sha384="sha384-"+createHash("sha384").update(bytes).digest("base64");
  const sha256=createHash("sha256").update(bytes).digest("hex");
  assert.equal(sha384,asset.sha384,"S2_8_CDN_SRI_MISMATCH "+asset.id);
  assert.equal(sha256,asset.sha256,"S2_8_CDN_SHA256_MISMATCH "+asset.id);
  const cors=response.headers.get("access-control-allow-origin");
  assert(cors==="*"||cors==="null"||cors==="https://supparang.github.io",
    "S2_8_CDN_CORS_UNVERIFIED "+asset.id);
  const type=String(response.headers.get("content-type")||"").toLowerCase();
  assert(type.includes("javascript"),"S2_8_UNEXPECTED_CONTENT_TYPE "+asset.id);
  console.log("S2_8_CDN_INTEGRITY_VERIFIED",JSON.stringify({
    asset:asset.id,bytes:bytes.length,sha384,
    cors,contentType:type,
  }));
}
console.log("ACTIVA-AI S2.8 live CDN integrity verification: PASS");
