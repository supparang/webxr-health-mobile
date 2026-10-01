import { classificationForNewActivity } from "../server/research-scope.js";
import { prisma } from "../server/db.js";

const base=process.env.ACTIVA_BASE_URL || "http://127.0.0.1:3000";
const future=new Date(Date.now()+4*3600000);
const end=new Date(future.getTime()+3600000);
function assert(x,m){if(!x)throw new Error(m);}
async function api(path,{actor="ADM001",method="GET",body}={}){
  const headers={"Accept":"application/json","x-activa-user-id":actor};
  if(body!==undefined)headers["Content-Type"]="application/json";
  const r=await fetch(base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json();
  return {status:r.status,data};
}
assert(classificationForNewActivity({}, "ADMIN", future).value==="UNCLASSIFIED","fail-closed default");
assert(classificationForNewActivity({dataClassification:"EMPIRICAL"},"ADMIN",future).error==="EMPIRICAL_PROVENANCE_ATTESTATION_REQUIRED","missing research attestation");
assert(classificationForNewActivity({dataClassification:"EMPIRICAL",empiricalAttestation:true},"ORGANIZER",future).error==="ADMIN_REQUIRED_FOR_RESEARCH_CLASSIFICATION","non-admin promotion");
assert(classificationForNewActivity({dataClassification:"EMPIRICAL",empiricalAttestation:true},"ADMIN",new Date(Date.now()-10000)).error==="EMPIRICAL_CLASSIFICATION_MUST_PRECEDE_ACTIVITY","retroactive classification");

const body={
  title:"CI future governed provenance activity",
  category:"วิจัย",
  location:"CI governance",
  startAt:future.toISOString(),
  endAt:end.toISOString(),
  policy:{staffRequired:false},
};
const forbidden=await api("/api/activities",{actor:"ORG001",method:"POST",body:{...body,dataClassification:"EMPIRICAL",empiricalAttestation:true}});
assert(forbidden.status===409&&forbidden.data.error==="ADMIN_REQUIRED_FOR_RESEARCH_CLASSIFICATION","non-admin classification not blocked");
const unsigned=await api("/api/activities",{method:"POST",body:{...body,dataClassification:"EMPIRICAL"}});
assert(unsigned.status===409&&unsigned.data.error==="EMPIRICAL_PROVENANCE_ATTESTATION_REQUIRED","unsigned classification accepted");
const created=await api("/api/activities",{method:"POST",body:{...body,dataClassification:"EMPIRICAL",empiricalAttestation:true}});
assert(created.status===201&&created.data.activity?.dataClassification==="EMPIRICAL","new empirical classification not persisted");
const id=created.data.activity.id;
const patch=await api("/api/activities/"+encodeURIComponent(id),{method:"PATCH",body:{dataClassification:"QA_TEST",changeReason:"CI posthoc mutation should fail"}});
assert(patch.status===409&&patch.data.error==="DATA_CLASSIFICATION_IMMUTABLE_USE_QA_DOWNGRADE","normal edit changed classification");
const invalidQuarantine=await api("/api/activities/"+encodeURIComponent(id)+"/quarantine-qa",{method:"POST",body:{reason:"short"}});
assert(invalidQuarantine.status===400,"missing quarantine reason not blocked");
const quarantine=await api("/api/activities/"+encodeURIComponent(id)+"/quarantine-qa",{method:"POST",body:{reason:"CI excludes simulated and contaminated activity permanently"}});
assert(quarantine.status===200&&quarantine.data.classification==="QA_TEST","quarantine failed");
const noPromotion=await api("/api/activities/"+encodeURIComponent(id),{method:"PATCH",body:{dataClassification:"EMPIRICAL"}});
assert(noPromotion.status===409,"QA was promoted through edit");
const stored=await prisma.activity.findUnique({where:{id},select:{dataClassification:true}});
assert(stored.dataClassification==="QA_TEST","QA downgrade not persisted");
const audit=await prisma.auditLog.count({where:{action:"ACTIVITY_QUARANTINED_QA",entityId:id}});
assert(audit===1,"QA quarantine audit missing");
console.log("ACTIVA-AI Phase 3 activity provenance and one-way QA quarantine tests passed");
await prisma.$disconnect();
