// S3.5: authenticate the *receiver* as well as the outbound SIEM event.
// The SIEM must return an HMAC of the exact JSON receipt bytes. This is
// an application-level check IN ADDITION to real TLS/egress restrictions.
// Do not treat a 2xx/JSON response without the independent receipt MAC
// as evidence that an incident was durably accepted by an approved SIEM.
import crypto from "node:crypto";

const EVENT_ID=/^ACTIVA-S34-[a-f0-9]{32}$/;
const RECEIPT_ID=/^[A-Za-z0-9_-]{8,100}$/;
export const SIEM_ACK_MAC_HEADER="X-Activa-Ack-Signature-SHA256";
const MAC=/^[a-f0-9]{64}$/;
const RESPONSE_MAX_BYTES=4096;
const ACK_CONTEXT=Buffer.from("ACTIVA-AI-SIEM-ACK-V1\n","ascii");

// Validate signatures in constant time with cryptographic domain separation
// from the outbound request HMAC (which signs a different message).
export function computeSiemAckSignature(rawUtf8,secret){
  if(typeof secret!=="string"||secret.length<32 ||
     !Buffer.isBuffer(rawUtf8)){
    throw Error("S35_ACK_MAC_CONFIGURATION_INVALID");
  }
  return crypto.createHmac("sha256",secret)
    .update(ACK_CONTEXT).update(rawUtf8).digest("hex");
}

export async function verifySiemReceipt(response,{eventId,secret}={}){
  if(!EVENT_ID.test(eventId||"")||typeof secret!=="string" ||
     secret.length<32)throw Error("S35_ACK_VALIDATION_CONFIGURATION_INVALID");
  if(!response||![200,202].includes(response.status)||response.ok!==true||
     typeof response.headers?.get!=="function"){
    throw Error("S35_SIEM_RESPONSE_INVALID");
  }
  const signature=response.headers.get(SIEM_ACK_MAC_HEADER);
  if(!MAC.test(signature||"")){
    throw Error("S35_SIEM_AUTHENTICATED_ACK_REQUIRED");
  }
  // A ReadableStream is required: response.text() could buffer arbitrarily
  // large hostile bodies BEFORE any length check takes place.
  const reader=response.body?.getReader?.();
  if(!reader)throw Error("S35_SIEM_BOUNDED_RESPONSE_STREAM_REQUIRED");
  let total=0;
  const chunks=[];
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!(value instanceof Uint8Array)){
        throw Error("S35_SIEM_RECEIPT_INVALID");
      }
      total+=value.byteLength;
      if(total>RESPONSE_MAX_BYTES){
        throw Error("S35_SIEM_RECEIPT_TOO_LARGE");
      }
      chunks.push(Buffer.from(value));
    }
  }catch(error){
    await reader.cancel().catch(()=>{});
    throw error;
  }finally{
    reader.releaseLock();
  }
  const bytes=Buffer.concat(chunks,total);
  const expected=computeSiemAckSignature(bytes,secret);
  if(!crypto.timingSafeEqual(
    Buffer.from(signature,"hex"),Buffer.from(expected,"hex")
  ))throw Error("S35_SIEM_RECEIPT_SIGNATURE_INVALID");
  let result;
  try {
    const text=new TextDecoder("utf-8",{fatal:true}).decode(bytes);
    result=JSON.parse(text);
  }catch{throw Error("S35_SIEM_RECEIPT_JSON_INVALID");}
  if(!result || typeof result!=="object"||Array.isArray(result) ||
     Object.keys(result).length!==3 ||
     result.accepted!==true || result.eventId!==eventId ||
     !EVENT_ID.test(result.eventId) || !RECEIPT_ID.test(result.receiptId)){
    throw Error("S35_SIEM_RECEIPT_BINDING_INVALID");
  }
  return result.receiptId;
}
