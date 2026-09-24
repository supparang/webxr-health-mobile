(function () {
  "use strict";

  const STORAGE_KEY = "activa_ai_demo_v034";
  const now = () => new Date();
  const iso = (d = now()) => d.toISOString();
  const uid = (p) => p + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);

  function todayAt(h, m) {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  function seed() {
    return {
      users: [
        {id:"ADM001",employeeId:"ADM001",name:"ผู้ดูแลระบบตัวอย่าง",role:"ADMIN",status:"ACTIVE"},
        {id:"ORG001",employeeId:"ORG001",name:"ผู้จัดกิจกรรมตัวอย่าง",role:"ORGANIZER",status:"ACTIVE"},
        {id:"STF001",employeeId:"STF001",name:"เจ้าหน้าที่ตรวจสอบตัวอย่าง",role:"STAFF",status:"ACTIVE"},
        {id:"P001",employeeId:"P001",name:"ผู้เข้าร่วมตัวอย่าง 1",role:"PARTICIPANT",status:"ACTIVE"},
        {id:"P002",employeeId:"P002",name:"ผู้เข้าร่วมตัวอย่าง 2",role:"PARTICIPANT",status:"ACTIVE"},
        {id:"P003",employeeId:"P003",name:"ผู้เข้าร่วมตัวอย่าง 3",role:"PARTICIPANT",status:"ACTIVE"}
      ],
      activities: [{
        id:"DEMO-EVT-001",
        title:"อบรมการใช้ AI อย่างรับผิดชอบ",
        category:"พัฒนาบุคลากร",
        description:"ข้อมูลสาธิตเท่านั้น",
        location:"ห้องประชุมคณะ",
        startAt:todayAt(9,0),
        endAt:todayAt(16,0),
        policy:{
          qrRequired:true,identityRequired:true,checkinRequired:true,checkoutRequired:true,
          durationRequired:true,staffRequired:true,signatureRequired:false,minDurationRatio:0.75
        },
        qr:null
      }],
      attendance: [],
      reviews: [],
      groundTruthLabels: [],
      groundTruthCases: [],
      models: [],
      predictions: [],
      audit: []
    };
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return data && data.users ? data : seed();
    } catch {
      return seed();
    }
  }

  let state = load();
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function reset() { state = seed(); save(); return {ok:true}; }
  function actor(ref) { return state.users.find(u => u.id === ref || u.employeeId === ref) || null; }
  function body(options) {
    if (!options || !options.body) return {};
    if (typeof options.body === "string") {
      try { return JSON.parse(options.body); } catch { return {}; }
    }
    return options.body;
  }
  function err(code, status=400) {
    const e = new Error(code);
    e.status = status;
    e.data = {ok:false,error:code};
    throw e;
  }
  function audit(actorRef, action, entityType, entityId, metadata={}) {
    state.audit.unshift({
      id:uid("AUD"),createdAt:iso(),actorId:actorRef || null,
      actor:actor(actorRef),action,entityType,entityId,metadata
    });
    state.audit = state.audit.slice(0,300);
    save();
  }
  function activity(id) { return state.activities.find(a => a.id === id); }
  function attendance(id) { return state.attendance.find(r => r.id === id); }
  function userPublic(u) {
    return {id:u.id,employeeId:u.employeeId,name:u.name,role:u.role,status:u.status};
  }
  function durationInfo(r) {
    const a = activity(r.activityId);
    if (!a || !r.checkinAt || !r.checkoutAt) return {minutes:null,percentage:null,ratio:null};
    const actual = Math.max(0, Math.round((new Date(r.checkoutAt)-new Date(r.checkinAt))/60000));
    const expected = Math.max(1, Math.round((new Date(a.endAt)-new Date(a.startAt))/60000));
    return {minutes:actual,percentage:Math.min(100,(actual/expected)*100),ratio:actual/expected};
  }
  function evalEvidence(r) {
    const a = activity(r.activityId);
    const p = a.policy || {};
    const missing = [];
    const reasons = [];
    const d = durationInfo(r);
    if (p.qrRequired && !r.qrValid) missing.push("MISSING_QR");
    if (p.identityRequired && !r.identityVerified) missing.push("MISSING_IDENTITY");
    if (p.checkinRequired && !r.checkinAt) missing.push("MISSING_CHECKIN");
    if (p.checkoutRequired && !r.checkoutAt) missing.push("MISSING_CHECKOUT");
    if (p.staffRequired && !r.staffVerification) missing.push("MISSING_STAFF_VERIFICATION");
    if (p.signatureRequired && !r.signatureVerified) missing.push("MISSING_SIGNATURE");
    if (p.durationRequired && d.ratio != null && d.ratio < Number(p.minDurationRatio || 0)) reasons.push("SHORT_DURATION");
    let status = "COMPLETE";
    if (missing.length) status = "INCOMPLETE";
    if (reasons.length) status = "REVIEW_REQUIRED";
    if (r.finalEvidenceStatus === "VERIFIED") status = "VERIFIED";
    if (r.finalEvidenceStatus === "REJECTED") status = "REJECTED";
    r.consistencyResult = {
      id:"DEMO-CR-"+r.id,attendanceId:r.id,status,
      completenessRatio: Math.max(0,1-(missing.length/7)),
      missingCodes:missing,reasonCodes:reasons,durationRatio:d.ratio,
      ruleVersion:"DEMO-RULES-0.3.6",evaluatedAt:iso()
    };
    return r.consistencyResult;
  }
  function hydrateAttendance(r) {
    const d = durationInfo(r);
    return {
      ...r,
      durationMinutes:d.minutes,
      attendancePercentage:d.percentage,
      user:userPublic(actor(r.userId)),
      activity:activity(r.activityId),
      humanReviews:state.reviews.filter(x=>x.attendanceId===r.id).sort((a,b)=>String(b.reviewedAt).localeCompare(String(a.reviewedAt)))
    };
  }
  function hashDemo(s) {
    let h = 2166136261;
    for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h,16777619); }
    return "demo_"+(h>>>0).toString(16);
  }

  async function request(path, options={}, actorRef=null) {
    const method = String(options.method || "GET").toUpperCase();
    const b = body(options);
    const who = actor(actorRef);
    const url = new URL(path, "https://demo.local");
    const p = url.pathname;

    if (p === "/api/health" && method === "GET") {
      return {ok:true,version:"0.3.6-demo",database:"demo-local",mode:"DEMO",synthetic:true};
    }
    if (p === "/api/me" && method === "GET") {
      if (!who) err("DEMO_USER_NOT_FOUND",404);
      return {ok:true,user:userPublic(who)};
    }
    if (!who) err("DEMO_LOGIN_REQUIRED",401);

    if (p === "/api/users" && method === "GET") {
      return {ok:true,users:state.users.map(userPublic)};
    }
    if (p === "/api/dashboard/summary" && method === "GET") {
      const rows = who.role === "PARTICIPANT" ? state.attendance.filter(r=>r.userId===who.id) : state.attendance;
      return {ok:true,scope:who.role==="PARTICIPANT"?"SELF":"ORGANIZATION",summary:{
        activityCount:state.activities.length,
        recordCount:rows.length,
        verifiedCount:rows.filter(r=>r.finalEvidenceStatus==="VERIFIED").length,
        reviewRequiredCount:rows.filter(r=>(r.consistencyResult?.status)==="REVIEW_REQUIRED").length,
        incompleteCount:rows.filter(r=>(r.consistencyResult?.status)==="INCOMPLETE").length
      }};
    }
    if (p === "/api/activities" && method === "GET") {
      return {ok:true,activities:state.activities};
    }
    if (p === "/api/activities" && method === "POST") {
      const a = {
        id:uid("DEMO-EVT"),title:b.title,category:b.category,description:b.description||"",
        location:b.location,startAt:b.startAt,endAt:b.endAt,organizerId:who.id,
        policy:b.policy||{},qr:null
      };
      state.activities.unshift(a); audit(who.id,"ACTIVITY_CREATED","Activity",a.id,{demo:true}); save();
      return {ok:true,activity:a};
    }

    let m = p.match(/^\/api\/activities\/([^/]+)\/qr$/);
    if (m && method === "POST") {
      const a = activity(decodeURIComponent(m[1])); if(!a) err("ACTIVITY_NOT_FOUND",404);
      const exp = new Date(Date.now()+45000);
      a.qr = {token:"DEMO|"+a.id+"|"+Date.now()+"|"+Math.random().toString(36).slice(2),issuedAt:iso(),expiresAt:exp.toISOString()};
      audit(who.id,"QR_ISSUED","Activity",a.id,{demo:true,expiresAt:a.qr.expiresAt}); save();
      return {ok:true,...a.qr,demo:true};
    }

    if (p === "/api/attendance" && method === "GET") {
      let rows = state.attendance;
      if (who.role === "PARTICIPANT") rows = rows.filter(r=>r.userId===who.id);
      const activityId = url.searchParams.get("activityId");
      if (activityId) rows = rows.filter(r=>r.activityId===activityId);
      return {ok:true,attendance:rows.map(hydrateAttendance)};
    }
    if (p === "/api/attendance/checkin" && method === "POST") {
      const u = actor(b.userId); if(!u) err("USER_NOT_FOUND",404);
      if (who.role==="PARTICIPANT" && who.id!==u.id) err("PARTICIPANT_CAN_ONLY_CHECKIN_SELF",403);
      let a = state.activities.find(x=>x.qr?.token===b.token);
      if (!a && typeof b.token === "string" && b.token.startsWith("DEMO|")) {
        const parts = b.token.split("|");
        const activityId = parts[1];
        const issuedAtMs = Number(parts[2]);
        const candidate = activity(activityId);
        const ageMs = Date.now() - issuedAtMs;
        if (candidate && Number.isFinite(issuedAtMs) && ageMs >= 0 && ageMs <= 45000) {
          a = candidate;
        }
      }
      if(!a) err("INVALID_OR_EXPIRED_DEMO_QR",400);
      if(a.qr?.token===b.token && new Date(a.qr.expiresAt)<=new Date()) err("INVALID_OR_EXPIRED_DEMO_QR",400);
      const existing = state.attendance.find(r=>r.activityId===a.id&&r.userId===u.id);
      if(existing) {
        const code = existing.checkoutAt ? "ACTIVITY_ALREADY_COMPLETED" : "ALREADY_CHECKED_IN";
        const e = new Error(code);
        e.status = 409;
        e.data = {
          ok:false,
          error:code,
          attendanceId:existing.id,
          checkinAt:existing.checkinAt,
          checkoutAt:existing.checkoutAt,
          attendanceStatus:existing.attendanceStatus
        };
        throw e;
      }
      const r = {id:uid("DEMO-ATT"),activityId:a.id,userId:u.id,checkinAt:iso(),checkoutAt:null,
        attendanceStatus:"CHECKED_IN",qrValid:true,identityVerified:true,signatureVerified:false,
        scanAttempts:1,staffVerification:null,consistencyResult:null,finalEvidenceStatus:null};
      state.attendance.unshift(r); audit(who.id,"CHECKIN","AttendanceRecord",r.id,{demo:true}); save();
      return {ok:true,attendance:hydrateAttendance(r)};
    }

    m = p.match(/^\/api\/attendance\/([^/]+)\/checkout$/);
    if (m && method==="POST") {
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      if(who.role==="PARTICIPANT"&&r.userId!==who.id) err("PARTICIPANT_CAN_ONLY_CHECKOUT_SELF",403);
      if(r.checkoutAt) err("ALREADY_CHECKED_OUT",409);
      r.checkoutAt=iso(); r.attendanceStatus="CHECKED_OUT"; save();
      audit(who.id,"CHECKOUT","AttendanceRecord",r.id,{demo:true});
      return {ok:true,attendance:hydrateAttendance(r)};
    }

    m = p.match(/^\/api\/attendance\/([^/]+)\/staff-verify$/);
    if (m && method==="POST") {
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      r.staffVerification={id:uid("DEMO-SV"),attendanceId:r.id,verifierId:who.id,verifiedAt:iso(),status:"VERIFIED_PRESENT"};
      save(); audit(who.id,"STAFF_VERIFIED","AttendanceRecord",r.id,{demo:true});
      return {ok:true,verification:r.staffVerification};
    }

    m = p.match(/^\/api\/evidence\/([^/]+)\/evaluate$/);
    if (m && method==="POST") {
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      const result=evalEvidence(r); save(); audit(who.id,"EVIDENCE_EVALUATED","AttendanceRecord",r.id,{demo:true,status:result.status});
      return {ok:true,result,note:"DEMO rule-based result; not AI probability."};
    }

    m = p.match(/^\/api\/reviews\/([^/]+)$/);
    if (m && method==="POST") {
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      const review={id:uid("DEMO-RV"),attendanceId:r.id,reviewerId:who.id,decision:b.decision,reason:b.reason||"",
        reviewStartedAt:b.reviewStartedAt||null,reviewedAt:iso(),reviewDurationSeconds:b.reviewDurationSeconds||null};
      state.reviews.push(review);
      r.finalEvidenceStatus=b.decision==="VERIFY"?"VERIFIED":b.decision==="REJECT"?"REJECTED":"REVIEW_REQUIRED";
      save(); audit(who.id,"HUMAN_REVIEW","AttendanceRecord",r.id,{demo:true,decision:b.decision});
      return {ok:true,review,finalEvidenceStatus:r.finalEvidenceStatus};
    }

    if (p === "/api/ground-truth/queue" && method==="GET") {
      const rows=state.attendance.map(r=>{
        const labels=state.groundTruthLabels.filter(x=>x.attendanceId===r.id);
        const safe=who.role==="ADMIN"?labels:labels.filter(x=>x.reviewerId===who.id);
        return {...hydrateAttendance(r),groundTruthLabels:safe,
          groundTruthCase:state.groundTruthCases.find(x=>x.attendanceId===r.id)||null,
          consistencyResult:undefined};
      });
      return {ok:true,blinded:true,syntheticDemo:true,records:rows};
    }

    m=p.match(/^\/api\/ground-truth\/([^/]+)\/labels$/);
    if(m&&method==="POST"){
      const attendanceId=decodeURIComponent(m[1]);
      const locked=state.groundTruthCases.find(x=>x.attendanceId===attendanceId&&x.status==="LOCKED");
      if(locked) err("GROUND_TRUTH_LOCKED_NO_MORE_LABEL_CHANGES",409);
      let label=state.groundTruthLabels.find(x=>x.attendanceId===attendanceId&&x.reviewerId===who.id);
      if(label){Object.assign(label,{target:b.target,reasonCodes:b.reasonCodes||[],notes:b.notes||""});}
      else {label={id:uid("DEMO-GTL"),attendanceId,reviewerId:who.id,target:b.target,reasonCodes:b.reasonCodes||[],notes:b.notes||"",createdAt:iso()};state.groundTruthLabels.push(label);}
      save(); audit(who.id,"GROUND_TRUTH_LABEL","AttendanceRecord",attendanceId,{demo:true,target:b.target});
      return {ok:true,label};
    }

    m=p.match(/^\/api\/ground-truth\/([^/]+)\/adjudicate$/);
    if(m&&method==="POST"){
      const attendanceId=decodeURIComponent(m[1]);
      const labels=state.groundTruthLabels.filter(x=>x.attendanceId===attendanceId);
      let c=state.groundTruthCases.find(x=>x.attendanceId===attendanceId);
      if(c?.status==="LOCKED") err("GROUND_TRUTH_LOCKED_NO_READJUDICATION",409);
      if(labels.length<2 && b.force!==true) err("TWO_INDEPENDENT_LABELS_REQUIRED",409);
      if(!c){c={id:uid("DEMO-GTC"),attendanceId};state.groundTruthCases.push(c);}
      Object.assign(c,{finalTarget:b.finalTarget,reasonCodes:b.reasonCodes||[],status:"ADJUDICATED",adjudicatorId:who.id,notes:b.notes||"",adjudicatedAt:iso(),lockedAt:null});
      save(); audit(who.id,"GROUND_TRUTH_ADJUDICATED","AttendanceRecord",attendanceId,{demo:true});
      return {ok:true,groundTruthCase:c,labelCount:labels.length};
    }

    m=p.match(/^\/api\/ground-truth\/([^/]+)\/lock$/);
    if(m&&method==="POST"){
      const attendanceId=decodeURIComponent(m[1]);
      const c=state.groundTruthCases.find(x=>x.attendanceId===attendanceId);
      if(!c||c.status!=="ADJUDICATED") err("ADJUDICATION_REQUIRED_BEFORE_LOCK",409);
      c.status="LOCKED";c.lockedAt=iso();save();audit(who.id,"GROUND_TRUTH_LOCKED","AttendanceRecord",attendanceId,{demo:true});
      return {ok:true,groundTruthCase:c};
    }

    if (p === "/api/ml/readiness" && method==="GET") {
      const locked=state.groundTruthCases.filter(x=>x.status==="LOCKED");
      return {ok:true,aiEnabled:false,note:"DEMO counts only",counts:{
        labelCount:state.groundTruthLabels.length,
        adjudicatedCount:state.groundTruthCases.filter(x=>x.status==="ADJUDICATED").length,
        lockedCount:locked.length,
        reviewLocked:locked.filter(x=>x.finalTarget==="REVIEW_REQUIRED").length,
        noReviewLocked:locked.filter(x=>x.finalTarget==="NO_REVIEW_REQUIRED").length
      }};
    }

    if (p === "/api/ml/dataset" && method==="GET") {
      const records=state.groundTruthCases.filter(x=>x.status==="LOCKED").map(c=>{
        const r=attendance(c.attendanceId),a=activity(r.activityId),d=durationInfo(r);
        return {record_id:r.id,participant_hash:hashDemo(r.userId),event_id:r.activityId,activity_type:a.category,
          qr_valid:Number(r.qrValid),identity_verified:Number(r.identityVerified),checkin_present:Number(Boolean(r.checkinAt)),
          checkout_present:Number(Boolean(r.checkoutAt)),duration_ratio:d.ratio,staff_verified:Number(Boolean(r.staffVerification)),
          signature_verified:Number(r.signatureVerified),scan_attempts:r.scanAttempts,final_target:c.finalTarget,
          reason_codes:c.reasonCodes,locked_at:c.lockedAt};
      });
      return {ok:true,datasetStatus:"DEMO_LOCKED_GROUND_TRUTH_ONLY",syntheticDemo:true,deidentified:true,records};
    }

    if (p === "/api/models" && method==="GET") return {ok:true,models:state.models};
    if (p === "/api/models/import-evaluation" && method==="POST") {
      let model=state.models.find(x=>x.version===b.version);
      const status=b.testMetrics?"EVALUATED":"CANDIDATE";
      if(!model){model={id:uid("DEMO-MDL"),createdAt:iso()};state.models.push(model);}
      Object.assign(model,{...b,status,updatedAt:iso()});save();audit(who.id,"MODEL_EVALUATION_IMPORTED","ModelRun",model.id,{demo:true});
      return {ok:true,model,note:"DEMO only"};
    }

    m=p.match(/^\/api\/models\/([^/]+)\/approve$/);
    if(m&&method==="POST"){const model=state.models.find(x=>x.id===decodeURIComponent(m[1]));if(!model)err("MODEL_NOT_FOUND",404);model.status="APPROVED";model.approvedAt=iso();save();return{ok:true,model};}
    m=p.match(/^\/api\/models\/([^/]+)\/deploy$/);
    if(m&&method==="POST"){const model=state.models.find(x=>x.id===decodeURIComponent(m[1]));if(!model)err("MODEL_NOT_FOUND",404);state.models.forEach(x=>{if(x.status==="DEPLOYED")x.status="RETIRED";});model.status="DEPLOYED";model.deployedAt=iso();save();return{ok:true,model,note:"DEMO/SYNTHETIC only"};}

    if (p === "/api/ml/inference-dataset" && method==="GET") {
      const model=state.models.find(x=>x.status==="DEPLOYED")||null;
      const scored=new Set(state.predictions.filter(x=>x.modelVersion===model?.version).map(x=>x.attendanceId));
      const records=model?state.attendance.filter(r=>!scored.has(r.id)).map(r=>({record_id:r.id,participant_hash:hashDemo(r.userId),
        event_id:r.activityId,activity_type:activity(r.activityId).category,qr_valid:Number(r.qrValid),identity_verified:Number(r.identityVerified),
        checkin_present:Number(Boolean(r.checkinAt)),checkout_present:Number(Boolean(r.checkoutAt)),duration_ratio:durationInfo(r).ratio,
        staff_verified:Number(Boolean(r.staffVerification)),signature_verified:Number(r.signatureVerified),scan_attempts:r.scanAttempts})):[];
      return {ok:true,deployedModel:model?{id:model.id,version:model.version,modelFamily:model.modelFamily,status:model.status}:null,
        deidentified:true,groundTruthIncluded:false,records};
    }

    if (p === "/api/predictions/import-batch" && method==="POST") {
      const model=state.models.find(x=>x.version===b.modelVersion&&x.status==="DEPLOYED");if(!model)err("ONLY_DEPLOYED_MODEL_PREDICTIONS_CAN_BE_IMPORTED",409);
      for(const x of (b.predictions||[])){let pr=state.predictions.find(y=>y.attendanceId===x.attendanceId&&y.modelVersion===b.modelVersion);
        if(pr)Object.assign(pr,x);else state.predictions.push({id:uid("DEMO-AIP"),modelRunId:model.id,modelVersion:b.modelVersion,...x,createdAt:iso()});}
      save();return{ok:true,importedCount:(b.predictions||[]).length,modelVersion:b.modelVersion,decisionSupportOnly:true};
    }

    if (p === "/api/xai/queue" && method==="GET") {
      const model=state.models.find(x=>x.status==="DEPLOYED")||null;
      const records=model?state.predictions.filter(x=>x.modelVersion===model.version).map(pr=>({...pr,attendance:hydrateAttendance(attendance(pr.attendanceId))})):[];
      return {ok:true,deployedModel:model,decisionSupportOnly:true,syntheticDemo:true,records};
    }

    if (p === "/api/audit" && method==="GET") return {ok:true,logs:state.audit};

    if (p === "/api/research/export" && method==="GET") {
      return {ok:true,deidentified:true,syntheticDemo:true,generatedAt:iso(),records:state.attendance.map(r=>({
        record_id:r.id,participant_hash:hashDemo(r.userId),event_id:r.activityId,activity_type:activity(r.activityId)?.category||"",
        qr_valid:Number(r.qrValid),identity_verified:Number(r.identityVerified),checkin_time:r.checkinAt||"",checkout_time:r.checkoutAt||"",
        staff_verified:Number(Boolean(r.staffVerification)),signature_verified:Number(r.signatureVerified),
        consistency_status:r.consistencyResult?.status||"",human_decision:state.reviews.filter(x=>x.attendanceId===r.id).slice(-1)[0]?.decision||"",
        final_status:r.finalEvidenceStatus||r.consistencyResult?.status||""
      }))};
    }

    err("DEMO_ROUTE_NOT_IMPLEMENTED: "+method+" "+p,404);
  }

  window.ACTIVA_DEMO_API = {
    request,
    reset,
    isDemoData:true,
    label:"DEMO / SYNTHETIC — ไม่ใช่ข้อมูลวิจัยจริง"
  };
})();