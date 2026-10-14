// S2.8 provenance checkpoint (CI-only). Compute cryptographic digests of
// the exact script bytes that the browser URL serves. This is a discovery
// step; do not copy hashes into HTML until CI confirms successful retrieval.
import {createHash} from "node:crypto";
const assets=[
  {
    id:"qrcodejs-1.0.0",
    url:"https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js",
    maxSize:150000,
  },
  {
    id:"html5-qrcode-2.3.8",
    url:"https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js",
    maxSize:1000000,
  },
];
for (const asset of assets) {
  const response=await fetch(asset.url,{
    method:"GET",redirect:"error",
    signal:AbortSignal.timeout(15000),
    headers:{Accept:"application/javascript, text/javascript, */*;q=0.5"},
  });
  if(!response.ok || response.url!==asset.url) {
    throw new Error("S2_8_CDN_RETRIEVAL_FAILED "+asset.id+" HTTP "+response.status);
  }
  const bytes=Buffer.from(await response.arrayBuffer());
  if (bytes.length<1000 || bytes.length>asset.maxSize) {
    throw new Error("S2_8_UNEXPECTED_SCRIPT_SIZE "+asset.id+" bytes="+bytes.length);
  }
  const sha384=createHash("sha384").update(bytes).digest("base64");
  const sha256=createHash("sha256").update(bytes).digest("hex");
  console.log("S2_8_VERIFIED_CDN_BYTES",JSON.stringify({
    id:asset.id,url:asset.url,length:bytes.length,sha384:"sha384-"+sha384,sha256,
    contentType:response.headers.get("content-type"),
    cors:response.headers.get("access-control-allow-origin"),
  }));
}
