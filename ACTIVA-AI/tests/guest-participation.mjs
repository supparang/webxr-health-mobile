import { prisma } from "../server/db.js";
import crypto from "node:crypto";

const base=process.env.ACTIVA_BASE_URL||"http://127.0.0.1:3000";
const assert=(x,m)=>{if(!x)throw Error(m);};
async function req(path,{actor,guest,blind,body,method="GET"}={}){
 const headers={Accept:"application/json"};
 if(actor)headers["x-activa-user-id"]=actor;
 if(guest)headers.Authorization="GuestPass "+guest;
 if(blind)headers.Authorization="BlindReview "+blind;
 if(body!==undefined)headers["Content-Type"]="application/json";
 const res=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
 let data={};const raw=await res.text();try{data=JSON.parse(raw);}catch{}
 return {status:res.status,data,raw};
}
function tokenFromPath(path){
 const url=new URL(path,"https://ci.invalid");
 return new URLSearchParams(url.hash.slice(1)).get("token")||"";
}
const admin=await prisma.user.findUnique({where:{employeeId:"ADM001"}});
assert(admin,"ADMIN missing");
const beforeUsers=await prisma.user.count();
const now=Date.now();
async function activity(title,classification){
 return prisma.activity.create({data:{
  title,category:"วิจัย",location:"CI guest",
  dataClassification:classification,classifiedAt:new Date(),
  startAt:new Date(now-6*60000),endAt:new Date(now+30*60000),
  checkinOpenAt:new Date(now-15*60000),checkinCloseAt:new Date(now+12*60000),
  checkoutOpenAt:new Date(now-4*60000),checkoutCloseAt:new Date(now+45*60000),
  organizerId:admin.id,participationMode:"OPEN",
  policy:{create:{
    qrRequired:true,identityRequired:true,checkinRequired:true,checkoutRequired:true,
    durationRequired:true,staffRequired:true,signatureRequired:false,minDurationRatio:0.75,
  }},
 }});
}
const empirical=await activity("CI Accountless Empirical Fixture — SYNTHETIC","EMPIRICAL");
const other=await activity("CI Accountless Repeat Fixture — SYNTHETIC","EMPIRICAL");
const qa=await activity("CI Accountless QA Fixture — SYNTHETIC","QA_TEST");
const code="SUBJ-CIGUEST021";
const consentText="CI-only software acceptance test: this is disposable synthetic data, not an empirical participant or publication consent.";
const issue=async(a,studyCode=code)=>req("/api/activities/"+a.id+"/guest-passes",{
 actor:"ADM001",method:"POST",body:{
  studyCode,consentVersion:"CI-CONSENT-V1",consentText,adminAttestation:true
 }
});
const noAuth=await req("/api/public/guest/session");
assert(noAuth.status===401,"guest session must demand bearer token");
const invalidStudy=await issue(empirical,"P001");
assert(invalidStudy.status===400,"personnel-like code should be rejected");
const issued=await issue(empirical);
assert(issued.status===201, "guest issuance failed: "+issued.raw);
assert(issued.data.tokenReturnedOnce===true && issued.data.rawTokenPersisted===false,"one-time pass contract");
const pass=tokenFromPath(issued.data.path);
assert(pass.length>=32,"guest pass entropy too short");
assert((await prisma.user.count())===beforeUsers,"guest issuance created dummy account");
const dups=await issue(empirical);
assert(dups.status===409 && dups.data.error==="GUEST_ALREADY_REGISTERED_FOR_ACTIVITY","duplicate guest code accepted");
const stored=await prisma.guestParticipant.findUnique({where:{id:issued.data.guestId}});
assert(/^[a-f0-9]{64}$/.test(stored.passTokenHash),"pass token must be hashed");
assert(stored.passTokenHash!==pass && !JSON.stringify(stored).includes(code),"raw pass/study code persisted");
const session=await req("/api/public/guest/session",{guest:pass});
assert(session.status===200 && session.data.consent.accepted===false,"guest session failed");
assert(!JSON.stringify(session.data).includes(code) && !JSON.stringify(session.data).includes(stored.studyHash),"guest API leaked study code/hash");
const qr=async(a,purpose)=>req("/api/activities/"+a.id+"/qr",{
 actor:"ADM001",method:"POST",body:{purpose}
});
const checkinQr=await qr(empirical,"CHECKIN");
const checkoutQr=await qr(empirical,"CHECKOUT");
const wrongEventQr=await qr(other,"CHECKIN");
assert(checkinQr.status===200 && checkoutQr.status===200 && wrongEventQr.status===200,"CI organizer QR issuance failed");
const checkin=(guest,eventToken)=>req("/api/public/guest/checkin",{guest,method:"POST",body:{eventToken}});
const checkout=(guest,eventToken)=>req("/api/public/guest/checkout",{guest,method:"POST",body:{eventToken}});
const premature=await checkin(pass,checkinQr.data.token);
assert(premature.status===409 && premature.data.error==="GUEST_CONSENT_REQUIRED","check-in without consent accepted");
const wrongConsent=await req("/api/public/guest/consent",{guest:pass,method:"POST",body:{accepted:true,version:"wrong"}});
assert(wrongConsent.status===400,"wrong consent version accepted");
const accepted=await req("/api/public/guest/consent",{guest:pass,method:"POST",body:{accepted:true,version:"CI-CONSENT-V1"}});
assert(accepted.status===200,"guest consent failed");
const cross=await checkin(pass,wrongEventQr.data.token);
assert(cross.status===409 && cross.data.error==="QR_ACTIVITY_MISMATCH","cross-event QR accepted");
const purpose=await checkin(pass,checkoutQr.data.token);
assert(purpose.status===409 && purpose.data.error==="QR_PURPOSE_MISMATCH","check-out QR accepted as check-in");
const forged=await checkin(pass,checkinQr.data.token+"altered");
assert(forged.status===400,"bad QR signature accepted");
const inResult=await checkin(pass,checkinQr.data.token);
assert(inResult.status===201 && inResult.data.identityVerified===false,"guest check-in must NOT auto-verify identity");
const attendance=await prisma.attendanceRecord.findUnique({where:{id:inResult.data.attendanceId}});
assert(attendance.userId===null && attendance.guestParticipantId===issued.data.guestId,"guest attendance owner wrong");
const replay=await checkin(pass,checkinQr.data.token);
assert(replay.status===409 && replay.data.error==="ALREADY_CHECKED_IN","duplicate checkin allowed");
const noWitness=await req("/api/attendance/"+attendance.id+"/staff-verify",{actor:"ADM001",method:"POST"});
assert(noWitness.status===400 && noWitness.data.error==="GUEST_IN_PERSON_IDENTITY_ATTESTATION_REQUIRED","identity flag can be set without human witness");
const witnessed=await req("/api/attendance/"+attendance.id+"/staff-verify",{
 actor:"ADM001",method:"POST",body:{guestIdentityWitnessed:true}
});
assert(witnessed.status===200,"staff witness verification failed");
const verified=await prisma.attendanceRecord.findUnique({where:{id:attendance.id}});
assert(verified.identityVerified===true,"staff witness did not set verified identity");
const wrongCheckout=await checkout(pass,checkinQr.data.token);
assert(wrongCheckout.status===409,"check-in QR accepted as checkout");
const out=await checkout(pass,checkoutQr.data.token);
assert(out.status===200 && out.data.checkoutAt,"guest checkout failed");
const outReplay=await checkout(pass,checkoutQr.data.token);
assert(outReplay.status===409,"guest checkout replay allowed");
const queue=await req("/api/ground-truth/queue",{actor:"ADM001"});
assert(queue.data.records.some(x=>x.id===attendance.id && x.guestParticipant?.id===issued.data.guestId),"guest absent from Ground Truth queue");
const issuedOther=await issue(other);
const otherPass=tokenFromPath(issuedOther.data.path);
assert((await prisma.guestParticipant.findUnique({where:{id:issuedOther.data.guestId}})).studyHash===stored.studyHash,"stable pseudonym differs across events");

async function lockByBlindPair(attendanceId){
 const batch=await req("/api/ground-truth/"+attendanceId+"/blind-batch",{
  actor:"ADM001",method:"POST",body:{expiresHours:2}
 });
 assert(batch.status===201,"Guest Ground Truth batch failed");
 for(const link of batch.data.links){
  const token=tokenFromPath(link.path);
  const label=await req("/api/public/blind-review/submit",{
   blind:token,method:"POST",body:{
    target:"NO_REVIEW_REQUIRED",reasonCodes:[],independenceAttested:true,notes:"CI synthetic logic test only",
   }
  });
  assert(label.status===201,"Guest external label failed");
 }
 const locked=await req("/api/ground-truth/"+attendanceId+"/lock",{actor:"ADM001",method:"POST"});
 assert(locked.status===200 && locked.data.groundTruthCase.status==="LOCKED","Guest Ground Truth lock failed");
}
await lockByBlindPair(attendance.id);
const ds=await req("/api/ml/dataset",{actor:"ADM001"});
const guestRow=ds.data.records.find(x=>x.record_id===attendance.id);
assert(guestRow && guestRow.data_classification==="EMPIRICAL" && guestRow.identity_verified===1,"empirical guest missing from research dataset");
assert(ds.data.syntheticDemo===true,"CI records must be explicitly synthetic software fixtures");
const exportResult=await req("/api/research/export",{actor:"ADM001"});
assert(exportResult.data.records.some(x=>x.record_id===attendance.id && x.participant_hash===guestRow.participant_hash),"guest research export hash mismatch");

const qaIssued=await issue(qa,"SUBJ-CIGUESTQA1");
assert(qaIssued.status===201,"QA guest issuance failed");
const qaGuest=await prisma.guestParticipant.findUnique({where:{id:qaIssued.data.guestId}});
assert(qaGuest,"QA guest missing");
assert(!ds.data.records.some(x=>x.participant_hash===qaGuest.studyHash),"QA guest leaked into research");

const withdrawn=await req("/api/public/guest/withdraw",{
 guest:pass,method:"POST",body:{confirmWithdrawal:true}
});
assert(withdrawn.status===200 && withdrawn.data.researchUseExcluded===true,"guest withdrawal failed");
const revokedAccess=await req("/api/public/guest/session",{guest:pass});
assert(revokedAccess.status===410,"withdrawn guest pass remained active");
const excluded=await req("/api/ml/dataset",{actor:"ADM001"});
assert(!excluded.data.records.some(x=>x.record_id===attendance.id),"withdrawn guest leaked into locked research export");
assert((await prisma.groundTruthCase.findUnique({where:{attendanceId:attendance.id}})).status==="LOCKED","withdrawal deleted immutable operational Ground Truth");
const audit=await prisma.auditLog.count({where:{entityType:"GuestParticipant",entityId:issued.data.guestId}});
assert(audit>=4,"Guest audit trail incomplete");
console.log("ACTIVA-AI P3.2.3 accountless guest pass + consent + dynamic QR + identity + research exclusion E2E PASS");
await prisma.$disconnect();
