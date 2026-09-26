(function () {
  "use strict";

  const STORAGE_KEY = "activa_ai_demo_v034";
  const ACTIVITY_PERMISSION_KEYS = [
    "CAN_CREATE_ACTIVITY",
    "CAN_EDIT_OWN_ACTIVITY",
    "CAN_ASSIGN_CO_ORGANIZER",
    "CAN_ASSIGN_VERIFIER",
    "CAN_CLOSE_ACTIVITY",
    "CAN_MANAGE_ALL_ACTIVITIES"
  ];
  const ORGANIZER_DEFAULT_PERMISSIONS = [
    "CAN_CREATE_ACTIVITY",
    "CAN_EDIT_OWN_ACTIVITY",
    "CAN_ASSIGN_CO_ORGANIZER",
    "CAN_ASSIGN_VERIFIER",
    "CAN_CLOSE_ACTIVITY"
  ];
  const now = () => new Date();
  const iso = (d = now()) => d.toISOString();
  const uid = (p) => p + "_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);

  function encodeBase64UrlUtf8(value){
    const bytes=new TextEncoder().encode(value);
    let binary="";
    for(const b of bytes) binary+=String.fromCharCode(b);
    return btoa(binary).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
  }

  function decodeBase64UrlUtf8(value){
    let normalized=value.replace(/-/g,"+").replace(/_/g,"/");
    while(normalized.length%4) normalized+="=";
    const binary=atob(normalized);
    const bytes=Uint8Array.from(binary,ch=>ch.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodePortableDemoQr(activity, purpose, expiresAtMs){
    const windows=activityTimeWindows(activity);
    const p=activity.policy||{};
    const participantEmployeeIds=(activity.participants||[])
      .filter(x=>x.status!=="CANCELLED")
      .map(x=>actor(x.userId)?.employeeId||x.userId)
      .filter(Boolean);
    const payload={
      v:1,
      q:String(purpose||"CHECKIN").toUpperCase(),
      id:activity.id,
      t:activity.title,
      c:activity.category||"",
      l:activity.location||"",
      s:activity.startAt,
      e:activity.endAt,
      io:windows.checkinOpenAt,
      ic:windows.checkinCloseAt,
      oo:windows.checkoutOpenAt,
      oc:windows.checkoutCloseAt,
      m:activity.participationMode||"OPEN",
      d:Array.isArray(activity.allowedDepartmentCodes)?activity.allowedDepartmentCodes:[],
      r:participantEmployeeIds,
      p:{
        q:p.qrRequired!==false,
        i:p.identityRequired!==false,
        ci:p.checkinRequired!==false,
        co:p.checkoutRequired!==false,
        du:p.durationRequired!==false,
        st:p.staffRequired!==false,
        sg:Boolean(p.signatureRequired),
        mr:Number(p.minDurationRatio??0.75)
      },
      iat:Date.now(),
      exp:expiresAtMs,
      n:Math.random().toString(36).slice(2)
    };
    return "ACTIVADEMO1."+encodeBase64UrlUtf8(JSON.stringify(payload));
  }

  function decodePortableDemoQr(token){
    if(typeof token!=="string"||!token.startsWith("ACTIVADEMO1.")) return null;
    try{
      const payload=JSON.parse(decodeBase64UrlUtf8(token.slice("ACTIVADEMO1.".length)));
      if(payload?.v!==1||!payload.id||!payload.exp||!payload.iat) return null;
      payload.q=String(payload.q||"CHECKIN").toUpperCase();
      if(!["CHECKIN","CHECKOUT"].includes(payload.q)) return null;
      return payload;
    }catch{return null;}
  }

  function createDemoPersonalToken(credentialId){
    return "ACTIVAPERSON1."+encodeBase64UrlUtf8(JSON.stringify({v:1,c:credentialId}));
  }

  function decodeDemoPersonalToken(token){
    if(typeof token!=="string"||!token.startsWith("ACTIVAPERSON1.")) return null;
    try{
      const payload=JSON.parse(decodeBase64UrlUtf8(token.slice("ACTIVAPERSON1.".length)));
      return payload?.v===1&&payload.c?payload:null;
    }catch{return null;}
  }

  function ensureDemoPersonalCredential(u){
    if(!u.personalQrCredential){
      u.personalQrCredential={id:uid("DEMO-PC"),issuedAt:iso(),revokedAt:null};
      save();
    }
    return u.personalQrCredential;
  }

  function materializePortableActivity(payload){
    let a=activity(payload.id);
    if(a) return a;
    const participantIds=(payload.r||[]).map(ref=>actor(ref)?.id).filter(Boolean);
    a={
      id:payload.id,
      title:payload.t||"กิจกรรมจาก Dynamic QR",
      category:payload.c||"ไม่ระบุ",
      description:"Imported from portable Demo QR",
      location:payload.l||"ไม่ระบุ",
      startAt:payload.s,
      endAt:payload.e,
      checkinOpenAt:payload.io,
      checkinCloseAt:payload.ic,
      checkoutOpenAt:payload.oo,
      checkoutCloseAt:payload.oc,
      organizerId:null,
      participationMode:payload.m||"OPEN",
      allowedDepartmentCodes:Array.isArray(payload.d)?payload.d:[],
      roleAssignments:[],
      participants:participantIds.map(userId=>({id:uid("DEMO-AP"),userId,status:"INVITED",addedById:null,createdAt:iso()})),
      policy:{
        qrRequired:payload.p?.q!==false,
        identityRequired:payload.p?.i!==false,
        checkinRequired:payload.p?.ci!==false,
        checkoutRequired:payload.p?.co!==false,
        durationRequired:payload.p?.du!==false,
        staffRequired:payload.p?.st!==false,
        signatureRequired:Boolean(payload.p?.sg),
        minDurationRatio:Number(payload.p?.mr??0.75)
      },
      qr:null,
      qrByPurpose:{},
      importedFromPortableQr:true,
      assignmentsUpdatedAt:null
    };
    state.activities.push(a);
    save();
    return a;
  }

  function todayAt(h, m) {
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  }

  function demoParticipantRoster() {
    return Array.from({length:10}, (_,i) => {
      const n=String(i+1).padStart(3,"0");
      return {
        id:"T"+n,
        employeeId:"T"+n,
        name:"บุคลากรทดลอง "+(i+1),
        role:"PARTICIPANT",
        status:"ACTIVE",
        activityPermissions:[]
      };
    });
  }

  function seed() {
    return {
      users: [
        {id:"ADM001",employeeId:"ADM001",name:"ผู้ดูแลระบบตัวอย่าง",role:"ADMIN",status:"ACTIVE"},
        {id:"ORG001",employeeId:"ORG001",name:"บุคลากรตัวอย่าง (ได้รับสิทธิ์จัดกิจกรรม)",role:"ORGANIZER",status:"ACTIVE",activityPermissions:ORGANIZER_DEFAULT_PERMISSIONS.map(permission=>({permission,grantedAt:iso(),validFrom:null,validUntil:null,reason:"Demo organizer permission seed",revokedAt:null}))},
        {id:"STF001",employeeId:"STF001",name:"ผู้ตรวจสอบหลักฐานตัวอย่าง 1",role:"STAFF",status:"ACTIVE"},
        {id:"STF002",employeeId:"STF002",name:"ผู้ตรวจสอบหลักฐานตัวอย่าง 2",role:"STAFF",status:"ACTIVE"},
        {id:"P001",employeeId:"P001",name:"บุคลากรผู้เข้าร่วมตัวอย่าง 1",role:"PARTICIPANT",status:"ACTIVE"},
        {id:"P002",employeeId:"P002",name:"บุคลากรผู้เข้าร่วมตัวอย่าง 2",role:"PARTICIPANT",status:"ACTIVE"},
        {id:"P003",employeeId:"P003",name:"บุคลากรผู้เข้าร่วมตัวอย่าง 3",role:"PARTICIPANT",status:"ACTIVE"},
        ...demoParticipantRoster()
      ],
      activities: [{
        id:"DEMO-EVT-001",
        title:"อบรมการใช้ AI อย่างรับผิดชอบ",
        category:"พัฒนาบุคลากร",
        description:"ข้อมูลสาธิตเท่านั้น",
        location:"ห้องประชุมคณะ",
        startAt:todayAt(9,0),
        endAt:todayAt(16,0),
        checkinOpenAt:todayAt(8,30),
        checkinCloseAt:todayAt(9,30),
        checkoutOpenAt:todayAt(15,30),
        checkoutCloseAt:todayAt(16,30),
        organizerId:"ORG001",
        participationMode:"OPEN",
        allowedDepartmentCodes:[],
        roleAssignments:[],
        participants:[],
        policy:{
          qrRequired:true,identityRequired:true,checkinRequired:true,checkoutRequired:true,
          durationRequired:true,staffRequired:true,signatureRequired:false,minDurationRatio:0.75
        },
        qr:null,
        qrByPurpose:{}
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

  function ensureSyntheticQaCases() {
    const batchId="SYNTHETIC-QA-GT-001";
    const existing=state?.attendance?.filter(r=>r.syntheticQaBatchId===batchId)||[];
    if(existing.length){
      return {ok:true,idempotent:true,batchId,activityId:existing[0].activityId,created:0,total:existing.length,syntheticDemo:true};
    }

    const activityId="DEMO-QA-GT-001";
    let a=state.activities.find(x=>x.id===activityId);
    if(!a){
      a={
        id:activityId,
        title:"ชุดทดสอบ Ground Truth (Synthetic QA)",
        category:"QA / Research Workflow",
        description:"ข้อมูลสังเคราะห์สำหรับทดสอบ Evidence → Ground Truth เท่านั้น ไม่ใช่ข้อมูลวิจัยจริง",
        location:"DEMO / SYNTHETIC",
        startAt:todayAt(9,0),
        endAt:todayAt(16,0),
        checkinOpenAt:todayAt(8,30),
        checkinCloseAt:todayAt(9,30),
        checkoutOpenAt:todayAt(15,30),
        checkoutCloseAt:todayAt(16,30),
        organizerId:"ORG001",
        participationMode:"OPEN",
        allowedDepartmentCodes:[],
        roleAssignments:[],
        participants:[],
        policy:{
          qrRequired:true,identityRequired:true,checkinRequired:true,checkoutRequired:true,
          durationRequired:true,staffRequired:true,signatureRequired:false,minDurationRatio:0.75
        },
        qr:null,qrByPurpose:{},
        syntheticQa:true,syntheticQaBatchId:batchId,
        assignmentsUpdatedAt:null
      };
      state.activities.push(a);
    }

    const at=(h,m)=>todayAt(h,m);
    const staff=(note)=>({verified:true,verifiedById:"STF001",verifiedAt:at(15,55),note});
    const specs=[
      {userId:"P002",checkinAt:at(9,0),checkoutAt:at(16,0),checkoutQrValid:true,checkoutMethod:"QR",staffVerification:staff("Synthetic QA complete evidence"),scanAttempts:1,scenario:"COMPLETE"},
      {userId:"P003",checkinAt:at(9,5),checkoutAt:at(15,55),checkoutQrValid:false,checkoutMethod:"STAFF_ASSISTED",staffVerification:staff("Synthetic QA staff-assisted checkout"),scanAttempts:1,scenario:"STAFF_ASSISTED_CHECKOUT"},
      {userId:"T001",checkinAt:at(9,0),checkoutAt:at(11,0),checkoutQrValid:true,checkoutMethod:"QR",staffVerification:staff("Synthetic QA short duration"),scanAttempts:1,scenario:"SHORT_DURATION"},
      {userId:"T002",checkinAt:at(9,0),checkoutAt:at(16,0),checkoutQrValid:true,checkoutMethod:"QR",staffVerification:null,scanAttempts:1,scenario:"MISSING_STAFF_VERIFICATION"},
      {userId:"T003",checkinAt:at(9,0),checkoutAt:null,checkoutQrValid:false,checkoutMethod:null,staffVerification:staff("Synthetic QA missing checkout"),scanAttempts:1,scenario:"MISSING_CHECKOUT"},
      {userId:"T004",checkinAt:at(9,0),checkoutAt:at(16,0),checkoutQrValid:true,checkoutMethod:"QR",staffVerification:staff("Synthetic QA duplicate scan attempts"),scanAttempts:3,scenario:"MULTIPLE_SCAN_ATTEMPTS"}
    ];

    const created=[];
    for(const spec of specs){
      if(!actor(spec.userId)) continue;
      const r={
        id:uid("DEMO-QA-ATT"),activityId:a.id,userId:spec.userId,createdAt:at(9,0),
        checkinAt:spec.checkinAt,checkoutAt:spec.checkoutAt,
        attendanceStatus:spec.checkoutAt?"COMPLETED":"CHECKED_IN",
        qrValid:true,identityVerified:true,signatureVerified:false,
        scanAttempts:spec.scanAttempts,staffVerification:spec.staffVerification,
        consistencyResult:null,finalEvidenceStatus:null,
        checkoutQrValid:spec.checkoutQrValid,checkoutMethod:spec.checkoutMethod,
        checkoutExceptionReason:spec.checkoutMethod==="STAFF_ASSISTED"?"SYNTHETIC_QA_STAFF_ASSISTED":null,
        captureSource:"SYNTHETIC_QA_GENERATOR",syntheticTest:true,
        syntheticQa:true,syntheticQaBatchId:batchId,syntheticQaScenario:spec.scenario
      };
      state.attendance.unshift(r);
      created.push(r);
      audit("ADM001","SYNTHETIC_QA_CASE_CREATED","AttendanceRecord",r.id,{
        demo:true,syntheticQa:true,batchId,scenario:spec.scenario,excludedFromRealResearch:true
      });
    }
    save();
    return {ok:true,idempotent:false,batchId,activityId:a.id,created:created.length,total:created.length,syntheticDemo:true,
      warning:"Synthetic QA only. These cases must not be reported as real research observations."};
  }

  function migrateLegacyState(data) {
    if (!data || !Array.isArray(data.attendance)) return data;

    let changed = false;

    if (!data.demoRoster054Migrated) {
      if (!Array.isArray(data.users)) data.users = [];
      for (const sample of demoParticipantRoster()) {
        if (!data.users.some(u => u.employeeId === sample.employeeId || u.id === sample.id)) {
          data.users.push(sample);
          changed = true;
        }
      }
      data.demoRoster054Migrated = true;
      changed = true;
    }

    if (!data.demoSecondReviewer100Migrated) {
      if (!Array.isArray(data.users)) data.users = [];
      if (!data.users.some(u => u.employeeId === "STF002" || u.id === "STF002")) {
        data.users.push({
          id:"STF002",
          employeeId:"STF002",
          name:"ผู้ตรวจสอบหลักฐานตัวอย่าง 2",
          role:"STAFF",
          status:"ACTIVE",
          activityPermissions:[]
        });
        changed = true;
      }
      const firstReviewer = data.users.find(u => u.employeeId === "STF001" || u.id === "STF001");
      if (firstReviewer && firstReviewer.name !== "ผู้ตรวจสอบหลักฐานตัวอย่าง 1") {
        firstReviewer.name = "ผู้ตรวจสอบหลักฐานตัวอย่าง 1";
        changed = true;
      }
      data.demoSecondReviewer100Migrated = true;
      changed = true;
    }

    for (const u of (data.users || [])) {
      if (!Array.isArray(u.activityPermissions)) {
        u.activityPermissions = u.role === "ORGANIZER"
          ? ORGANIZER_DEFAULT_PERMISSIONS.map(permission=>({
              permission,grantedAt:iso(),validFrom:null,validUntil:null,
              reason:"Legacy organizer migration",revokedAt:null
            }))
          : [];
        changed = true;
      }
    }
    data.legacyActivityPermissionsMigrated = true;

    if (!data.terminology051Migrated) {
      const demoNames = {
        ORG001: "บุคลากรตัวอย่าง (ได้รับสิทธิ์จัดกิจกรรม)",
        STF001: "ผู้ตรวจสอบหลักฐานตัวอย่าง 1",
        STF002: "ผู้ตรวจสอบหลักฐานตัวอย่าง 2",
        P001: "บุคลากรผู้เข้าร่วมตัวอย่าง 1",
        P002: "บุคลากรผู้เข้าร่วมตัวอย่าง 2",
        P003: "บุคลากรผู้เข้าร่วมตัวอย่าง 3",
      };
      for (const u of (data.users || [])) {
        if (demoNames[u.employeeId]) {
          u.name = demoNames[u.employeeId];
          changed = true;
        }
      }
      data.terminology051Migrated = true;
    }

    if (!data.timeWindows056Migrated) {
      for (const a of (data.activities || [])) {
        const w=activityTimeWindows(a);
        if(!a.checkinOpenAt) a.checkinOpenAt=w.checkinOpenAt;
        if(!a.checkinCloseAt) a.checkinCloseAt=w.checkinCloseAt;
        if(!a.checkoutOpenAt) a.checkoutOpenAt=w.checkoutOpenAt;
        if(!a.checkoutCloseAt) a.checkoutCloseAt=w.checkoutCloseAt;
      }
      data.timeWindows056Migrated=true;
      changed=true;
    }

    if (!data.assignmentsGovernance055Migrated) {
      for (const a of (data.activities || [])) {
        if (a.assignmentsUpdatedAt === undefined) {
          const latest=(a.roleAssignments||[])
            .map(x=>x.assignedAt)
            .filter(Boolean)
            .sort()
            .slice(-1)[0] || null;
          a.assignmentsUpdatedAt=latest;
        }
      }
      data.assignmentsGovernance055Migrated=true;
      changed=true;
    }

    if (!data.activityManagement052Migrated) {
      for (const a of (data.activities || [])) {
        if (!a.organizerId) a.organizerId = "ORG001";
        if (!a.participationMode) a.participationMode = "OPEN";
        if (!Array.isArray(a.allowedDepartmentCodes)) a.allowedDepartmentCodes = [];
        if (!Array.isArray(a.roleAssignments)) a.roleAssignments = [];
        if (!Array.isArray(a.participants)) a.participants = [];
      }
      data.activityManagement052Migrated = true;
      changed = true;
    }

    for (const r of data.attendance) {
      if (r.isVoided === undefined) { r.isVoided = false; changed = true; }
      if (!r.createdAt && r.checkinAt) { r.createdAt = r.checkinAt; changed = true; }

      if (r.finalEvidenceStatus === "VERIFIED") {
        const a = (data.activities || []).find(x => x.id === r.activityId);
        const p = a?.policy || {};
        const missing =
          (p.qrRequired && !r.qrValid) ||
          (p.identityRequired && !r.identityVerified) ||
          (p.checkinRequired && !r.checkinAt) ||
          (p.checkoutRequired && !r.checkoutAt) ||
          (p.staffRequired && !r.staffVerification) ||
          (p.signatureRequired && !r.signatureVerified);

        let shortDuration = false;
        if (p.durationRequired && r.checkinAt && r.checkoutAt && a?.startAt && a?.endAt) {
          const expected = new Date(a.endAt) - new Date(a.startAt);
          const actual = new Date(r.checkoutAt) - new Date(r.checkinAt);
          const ratio = expected > 0 ? Math.max(0, actual / expected) : null;
          shortDuration = ratio == null || ratio < Number(p.minDurationRatio || 0);
        } else if (p.durationRequired) {
          shortDuration = true;
        }

        const systemBlocked =
          !r.consistencyResult ||
          r.consistencyResult.status !== "COMPLETE" ||
          missing ||
          shortDuration;

        if (systemBlocked) {
          r.finalEvidenceStatus = null;
          r.legacyFinalClearedAt = new Date().toISOString();
          changed = true;
        }
      }
    }

    if (changed) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
    return data;
  }

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return migrateLegacyState(data && data.users ? data : seed());
    } catch {
      return seed();
    }
  }

  let state = load();

  function refreshStateFromStorage() {
    try {
      const raw=localStorage.getItem(STORAGE_KEY);
      if(!raw) return state;
      const parsed=JSON.parse(raw);
      if(parsed && parsed.users) state=migrateLegacyState(parsed);
    } catch {}
    return state;
  }

  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function reset() { state = seed(); save(); return {ok:true}; }

  window.addEventListener("storage",(event)=>{
    if(event.key!==STORAGE_KEY || !event.newValue) return;
    try{
      const parsed=JSON.parse(event.newValue);
      if(parsed && parsed.users) state=migrateLegacyState(parsed);
    }catch{}
  });
  function actor(ref) { return state.users.find(u => u.id === ref || u.employeeId === ref) || null; }
  function effectiveActivityPermissions(u) {
    if (!u) return [];
    if (u.role === "ADMIN") return [...ACTIVITY_PERMISSION_KEYS];
    const nowMs=Date.now();
    return (u.activityPermissions||[]).filter(p=>{
      if(p.revokedAt) return false;
      const from=p.validFrom?new Date(p.validFrom).getTime():null;
      const until=p.validUntil?new Date(p.validUntil).getTime():null;
      return (from==null||from<=nowMs)&&(until==null||until>=nowMs);
    }).map(p=>p.permission);
  }
  function hasActivityPermission(u,key){ return effectiveActivityPermissions(u).includes(key); }

  function activityLifecycle(a, at = Date.now()) {
    const start = new Date(a?.startAt || 0).getTime();
    const end = new Date(a?.endAt || 0).getTime();
    if (Number.isFinite(start) && at < start) return "BEFORE_START";
    if (Number.isFinite(end) && at > end) return "ENDED";
    return "ACTIVE";
  }

  function activityTimeWindows(a) {
    const start=new Date(a?.startAt||0).getTime();
    const end=new Date(a?.endAt||0).getTime();
    const checkinOpenAt=a?.checkinOpenAt || new Date(start-30*60000).toISOString();
    const checkinCloseAt=a?.checkinCloseAt || new Date(start+30*60000).toISOString();
    const checkoutOpenAt=a?.checkoutOpenAt || new Date(end-30*60000).toISOString();
    const checkoutCloseAt=a?.checkoutCloseAt || new Date(end+30*60000).toISOString();
    return {checkinOpenAt,checkinCloseAt,checkoutOpenAt,checkoutCloseAt};
  }

  function checkinWindowState(a, at=Date.now()) {
    const w=activityTimeWindows(a);
    const open=new Date(w.checkinOpenAt).getTime();
    const close=new Date(w.checkinCloseAt).getTime();
    if(at<open) return {ok:false,code:"QR_CHECKIN_NOT_OPEN",...w};
    if(at>close) return {ok:false,code:"QR_CHECKIN_CLOSED",...w};
    return {ok:true,code:"QR_CHECKIN_OPEN",...w};
  }

  function checkoutWindowState(a, at=Date.now()) {
    const w=activityTimeWindows(a);
    const open=new Date(w.checkoutOpenAt).getTime();
    const close=new Date(w.checkoutCloseAt).getTime();
    if(at<open) return {ok:false,code:"QR_CHECKOUT_NOT_OPEN",...w};
    if(at>close) return {ok:false,code:"QR_CHECKOUT_CLOSED",...w};
    return {ok:true,code:"QR_CHECKOUT_OPEN",...w};
  }

  function coAssignmentGovernance(u,a){
    const lifecycle=activityLifecycle(a);
    const base=canAssignActivityRole(u,a,"CAN_ASSIGN_CO_ORGANIZER");
    if(lifecycle==="BEFORE_START"){
      return {lifecycle,canEdit:base,reasonRequired:false,adminOverrideRequired:false};
    }
    if(lifecycle==="ACTIVE"){
      return {lifecycle,canEdit:base,reasonRequired:base,adminOverrideRequired:false};
    }
    const isAdmin=u?.role==="ADMIN";
    return {lifecycle,canEdit:isAdmin,reasonRequired:isAdmin,adminOverrideRequired:isAdmin};
  }
  function canManageActivity(u,a){
    if(!u||!a) return false;
    if(u.role==="ADMIN"||hasActivityPermission(u,"CAN_MANAGE_ALL_ACTIVITIES")) return true;
    if(a.organizerId===u.id && (hasActivityPermission(u,"CAN_EDIT_OWN_ACTIVITY")||hasActivityPermission(u,"CAN_CREATE_ACTIVITY"))) return true;
    return isActivityAssignment(u,a,"CO_ORGANIZER");
  }
  function canAssignActivityRole(u,a,key){
    if(!u||!a) return false;
    if(u.role==="ADMIN") return true;
    const ownerOrAll=a.organizerId===u.id||hasActivityPermission(u,"CAN_MANAGE_ALL_ACTIVITIES");
    return ownerOrAll&&hasActivityPermission(u,key);
  }
  function canAccessPersonnelDirectory(u){
    return Boolean(u&&(
      ["ADMIN","STAFF","ORGANIZER"].includes(u.role)||
      effectiveActivityPermissions(u).length||
      state.activities.some(a=>isActivityAssignment(u,a,"CO_ORGANIZER"))
    ));
  }

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
  const RELEASE_VERSION="ACTIVA-AI-1.0.0";
  const BACKUP_FORMAT="ACTIVA_AI_BACKUP_V1";

  function ensureDemoActivityMutable(a){
    if(!a) err("ACTIVITY_NOT_FOUND",404);
    if(a.pilotClosedAt) err("ACTIVITY_PILOT_CLOSED_IMMUTABLE",423);
  }

  function demoActivityCloseAssessment(a){
    if(!a) return null;
    const terminal=new Set(["VERIFIED","OVERRIDE_VERIFIED","REJECTED"]);
    const rows=state.attendance.filter(r=>!r.isVoided&&r.activityId===a.id);
    const critical=[];
    const byUser=new Map();
    rows.forEach(r=>{if(!byUser.has(r.userId))byUser.set(r.userId,[]);byUser.get(r.userId).push(r);});
    byUser.forEach(xs=>{if(xs.length>1)critical.push("DUPLICATE_NONVOID_ATTENDANCE");});
    rows.forEach(r=>{
      const latest=state.reviews.filter(x=>x.attendanceId===r.id).sort((x,y)=>String(y.reviewedAt).localeCompare(String(x.reviewedAt)))[0]||null;
      const blockers=[...(r.consistencyResult?.missingCodes||[]),...(r.consistencyResult?.reasonCodes||[])];
      if(r.checkinAt&&r.checkoutAt&&new Date(r.checkoutAt)<new Date(r.checkinAt))critical.push("CHECKOUT_BEFORE_CHECKIN");
      if(terminal.has(r.finalEvidenceStatus)&&!latest)critical.push("FINAL_STATUS_WITHOUT_HUMAN_REVIEW");
      if(r.finalEvidenceStatus==="VERIFIED"&&(!r.consistencyResult||r.consistencyResult.status!=="COMPLETE"||blockers.length))critical.push("NORMAL_VERIFY_WITH_SYSTEM_BLOCKERS");
    });
    const unevaluatedCount=rows.filter(r=>!r.consistencyResult).length;
    const unresolvedCount=rows.filter(r=>!terminal.has(r.finalEvidenceStatus)).length;
    const ended=new Date(a.endAt).getTime()<Date.now();
    const criticalIssues=[...new Set(critical)];
    const checklist=[
      {key:"ACTIVITY_ENDED",passed:ended},
      {key:"ALL_RECORDS_EVALUATED",passed:unevaluatedCount===0},
      {key:"NO_UNRESOLVED_HUMAN_REVIEW",passed:unresolvedCount===0},
      {key:"NO_CRITICAL_DATA_QUALITY",passed:criticalIssues.length===0}
    ];
    return {activity:a,rows,recordCount:rows.length,unevaluatedCount,unresolvedCount,criticalIssues,ended,checklist,closeReady:checklist.every(x=>x.passed)};
  }

  function demoBackup(){
    const cleanUsers=state.users.map(u=>{const copy={...u};delete copy.personalQrCredential;return copy;});
    const cleanActivities=state.activities.map(a=>{const copy={...a};delete copy.qr;delete copy.qrByPurpose;return copy;});
    const payload={
      users:cleanUsers,
      activities:cleanActivities,
      attendance:JSON.parse(JSON.stringify(state.attendance)),
      reviews:JSON.parse(JSON.stringify(state.reviews)),
      groundTruthLabels:JSON.parse(JSON.stringify(state.groundTruthLabels)),
      groundTruthCases:JSON.parse(JSON.stringify(state.groundTruthCases)),
      models:JSON.parse(JSON.stringify(state.models)),
      predictions:JSON.parse(JSON.stringify(state.predictions)),
      audit:JSON.parse(JSON.stringify(state.audit))
    };
    const serialized=JSON.stringify(payload);
    const checksum=hashDemo(serialized);
    const counts=Object.fromEntries(Object.entries(payload).map(([k,v])=>[k,Array.isArray(v)?v.length:0]));
    return {format:BACKUP_FORMAT,releaseVersion:RELEASE_VERSION,generatedAt:iso(),containsPII:true,containsSecrets:false,
      excludedEphemeralSecurityData:["DynamicQrToken","PersonalQrCredential"],checksumAlgorithm:"DEMO_FNV32",checksum,counts,payload,syntheticDemo:true};
  }

  function validateDemoBackup(backup){
    if(!backup||backup.format!==BACKUP_FORMAT||!backup.payload||!backup.checksum)return{valid:false,error:"INVALID_BACKUP_FORMAT"};
    const checksum=hashDemo(JSON.stringify(backup.payload));
    if(checksum!==backup.checksum)return{valid:false,error:"BACKUP_CHECKSUM_MISMATCH",expected:backup.checksum,actual:checksum};
    return{valid:true,checksum,releaseVersion:backup.releaseVersion||null,currentReleaseVersionMatch:backup.releaseVersion===RELEASE_VERSION,containsPII:Boolean(backup.containsPII),containsSecrets:Boolean(backup.containsSecrets)};
  }
  function activityPublic(a) {
    if(!a) return null;
    const assignments=(a.roleAssignments||[]).map(x=>({...x,user:userPublic(actor(x.userId))}));
    return {
      ...a,
      organizer:userPublic(actor(a.organizerId)),
      roleAssignments:assignments,
      _count:{participants:(a.participants||[]).length},
    };
  }
  function isActivityAssignment(u,a,role){
    return Boolean(u&&a&&(a.roleAssignments||[]).some(x=>x.userId===u.id&&(!role||x.role===role)));
  }

  function attendance(id) { return state.attendance.find(r => r.id === id); }
  function userPublic(u) {
    return {
      id:u.id,employeeId:u.employeeId,name:u.name,email:u.email||null,
      role:u.role,status:u.status,department:u.department||null,
      activityPermissions:(u.activityPermissions||[]).map(p=>({...p}))
    };
  }
  function durationInfo(r) {
    const a = activity(r.activityId);
    if (!a || !r.checkinAt || !r.checkoutAt) return {minutes:null,percentage:null,ratio:null};
    const actual = Math.max(0, Math.round((new Date(r.checkoutAt)-new Date(r.checkinAt))/60000));
    const expected = Math.max(1, Math.round((new Date(a.endAt)-new Date(a.startAt))/60000));
    return {minutes:actual,percentage:Math.min(100,(actual/expected)*100),ratio:Math.min(1,actual/expected)};
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
    if (p.durationRequired) {
      if (d.ratio == null) missing.push("MISSING_DURATION");
      else if (d.ratio < Number(p.minDurationRatio || 0)) reasons.push("SHORT_DURATION");
    }
    if (r.checkoutAt && !r.checkoutQrValid) {
      reasons.push(r.checkoutMethod==="STAFF_ASSISTED" ? "STAFF_ASSISTED_CHECKOUT" : "CHECKOUT_QR_NOT_VERIFIED");
    }
    let status = "COMPLETE";
    if (missing.length) status = "INCOMPLETE";
    if (reasons.length) status = "REVIEW_REQUIRED";
    r.consistencyResult = {
      id:"DEMO-CR-"+r.id,attendanceId:r.id,status,
      completenessRatio: Math.max(0,1-(missing.length/7)),
      missingCodes:missing,reasonCodes:reasons,
      durationRatio:d.ratio==null?null:Math.max(0,Math.min(1,d.ratio)),
      ruleVersion:"DEMO-RULES-0.3.10",evaluatedAt:iso()
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
    refreshStateFromStorage();
    const method = String(options.method || "GET").toUpperCase();
    const b = body(options);
    const who = actor(actorRef);
    const url = new URL(path, "https://demo.local");
    const p = url.pathname;

    if (p === "/api/health" && method === "GET") {
      return {ok:true,version:"1.0.0-demo",database:"demo-local",mode:"DEMO",synthetic:true,ai:state.models.some(x=>x.status==="DEPLOYED")?"decision-support-active":"no-deployed-model",deployedModelVersion:state.models.find(x=>x.status==="DEPLOYED")?.version||null,autonomousDecision:false};
    }
    if (p === "/api/me" && method === "GET") {
      if (!who) err("DEMO_USER_NOT_FOUND",404);
      if (who.status !== "ACTIVE") err("INVALID_OR_INACTIVE_USER",401);
      return {ok:true,user:{...userPublic(who),activityPermissions:effectiveActivityPermissions(who),activityAssignments:state.activities.flatMap(a=>(a.roleAssignments||[]).filter(x=>x.userId===who.id).map(x=>({activityId:a.id,role:x.role})))}};
    }
    if (!who || who.status !== "ACTIVE") err("DEMO_LOGIN_REQUIRED",401);

    if (p === "/api/personal-qr/me" && method === "GET") {
      const credential=ensureDemoPersonalCredential(who);
      return {
        ok:true,
        token:createDemoPersonalToken(credential.id),
        credentialId:credential.id,
        issuedAt:credential.issuedAt,
        reusableAcrossActivities:true,
        containsDirectPII:false,
        demo:true
      };
    }

    if (p === "/api/personal-qr/reissue" && method === "POST") {
      const previous=who.personalQrCredential?.id||null;
      who.personalQrCredential={id:uid("DEMO-PC"),issuedAt:iso(),revokedAt:null};
      save();
      audit(who.id,"PERSONAL_QR_REISSUED","User",who.id,{demo:true,previousCredentialId:previous,credentialId:who.personalQrCredential.id});
      return {
        ok:true,
        token:createDemoPersonalToken(who.personalQrCredential.id),
        credentialId:who.personalQrCredential.id,
        issuedAt:who.personalQrCredential.issuedAt,
        reusableAcrossActivities:true,
        containsDirectPII:false,
        demo:true
      };
    }

    if (p === "/api/personal-qr/resolve" && method === "POST") {
      if(!["ADMIN","STAFF"].includes(who.role)) err("FORBIDDEN",403);
      const payload=decodeDemoPersonalToken(b.token);
      if(!payload) err("INVALID_PERSONAL_QR",400);
      const u=state.users.find(x=>x.personalQrCredential?.id===payload.c);
      if(!u) err("PERSONAL_QR_REVOKED_OR_UNKNOWN",410);
      if(u.status!=="ACTIVE") err("PERSONAL_QR_USER_INACTIVE",409);
      const activityId=String(b.activityId||"").trim()||null;
      let matches=state.attendance.filter(r=>!r.isVoided&&r.userId===u.id&&(activityId?r.activityId===activityId:true));
      matches=matches.map(hydrateAttendance);
      audit(who.id,"PERSONAL_QR_RESOLVED","User",u.id,{demo:true,activityId,attendanceMatches:matches.length});
      return {ok:true,user:userPublic(u),attendance:matches};
    }

    if (p === "/api/demo/latest-qr" && method === "GET") {
      const purpose=String(url.searchParams.get("purpose")||"CHECKIN").toUpperCase();
      if(!["CHECKIN","CHECKOUT"].includes(purpose)) err("INVALID_QR_PURPOSE",400);
      const nowMs=Date.now();
      const windowOk=a=>purpose==="CHECKOUT"?checkoutWindowState(a,nowMs).ok:checkinWindowState(a,nowMs).ok;
      const qrFor=a=>a.qrByPurpose?.[purpose] || (purpose==="CHECKIN"?a.qr:null);
      const candidates=(state.activities||[])
        .map(a=>({a,qr:qrFor(a)}))
        .filter(x=>x.qr?.token && new Date(x.qr.expiresAt).getTime()>nowMs && windowOk(x.a))
        .sort((x,y)=>new Date(y.qr.issuedAt||0)-new Date(x.qr.issuedAt||0));
      const hit=candidates[0];
      if(!hit) err("DEMO_ACTIVE_QR_NOT_FOUND",404);
      return {
        ok:true,
        purpose,
        token:hit.qr.token,
        issuedAt:hit.qr.issuedAt,
        expiresAt:hit.qr.expiresAt,
        activity:activityPublic(hit.a),
        syntheticTest:true
      };
    }

    if (p === "/api/users" && method === "GET") {
      if(!canAccessPersonnelDirectory(who)) err("PERSONNEL_DIRECTORY_FORBIDDEN",403);
      return {ok:true,users:state.users.map(userPublic)};
    }
    if (p === "/api/users" && method === "POST") {
      if (who.role !== "ADMIN") err("FORBIDDEN",403);
      const employeeId=String(b.employeeId||"").trim().toUpperCase();
      const name=String(b.name||"").trim();
      const role=String(b.role||"PARTICIPANT").toUpperCase();
      if(!employeeId||!name) err("EMPLOYEE_ID_AND_NAME_REQUIRED",400);
      if(!["ADMIN","ORGANIZER","STAFF","PARTICIPANT"].includes(role)) err("INVALID_ROLE",400);
      if(state.users.some(u=>u.employeeId===employeeId)) err("EMPLOYEE_ID_ALREADY_EXISTS",409);
      const email=String(b.email||"").trim()||null;
      if(email && state.users.some(u=>String(u.email||"").toLowerCase()===email.toLowerCase())) err("EMAIL_ALREADY_EXISTS",409);
      const departmentName=String(b.department||"").trim();
      const user={
        id:employeeId,employeeId,name,email,role,status:"ACTIVE",
        department:departmentName?{code:"DEMO-"+uid("D").slice(-6).toUpperCase(),name:departmentName}:null
      };
      state.users.push(user);save();
      audit(who.id,"USER_CREATED","User",user.id,{employeeId,role,department:departmentName||null});
      return {ok:true,user:userPublic(user)};
    }

    let userMatch=p.match(/^\/api\/users\/([^/]+)$/);
    if(userMatch && method==="PATCH"){
      if(who.role!=="ADMIN") err("FORBIDDEN",403);
      const user=state.users.find(u=>u.id===decodeURIComponent(userMatch[1])); if(!user) err("USER_NOT_FOUND",404);
      const name=String(b.name||user.name).trim();
      const role=String(b.role||user.role).toUpperCase();
      if(!name) err("NAME_REQUIRED",400);
      if(!["ADMIN","ORGANIZER","STAFF","PARTICIPANT"].includes(role)) err("INVALID_ROLE",400);
      const email=String(b.email||"").trim()||null;
      if(email && state.users.some(u=>u.id!==user.id&&String(u.email||"").toLowerCase()===email.toLowerCase())) err("EMAIL_ALREADY_EXISTS",409);
      const departmentName=String(b.department||"").trim();
      Object.assign(user,{name,email,role,department:departmentName?{code:user.department?.code||"DEMO-"+uid("D").slice(-6).toUpperCase(),name:departmentName}:null});
      save();audit(who.id,"USER_UPDATED","User",user.id,{employeeId:user.employeeId,role,department:departmentName||null});
      return {ok:true,user:userPublic(user)};
    }

    userMatch=p.match(/^\/api\/users\/([^/]+)\/status$/);
    if(userMatch && method==="PATCH"){
      if(who.role!=="ADMIN") err("FORBIDDEN",403);
      const user=state.users.find(u=>u.id===decodeURIComponent(userMatch[1])); if(!user) err("USER_NOT_FOUND",404);
      const status=String(b.status||"").toUpperCase();
      if(!["ACTIVE","INACTIVE"].includes(status)) err("INVALID_USER_STATUS",400);
      if(user.id===who.id && status==="INACTIVE") err("CANNOT_DEACTIVATE_SELF",409);
      user.status=status;save();audit(who.id,"USER_STATUS_CHANGED","User",user.id,{employeeId:user.employeeId,status});
      return {ok:true,user:userPublic(user)};
    }

    userMatch=p.match(/^\/api\/users\/([^/]+)\/activity-permissions$/);
    if(userMatch && method==="PATCH"){
      if(who.role!=="ADMIN") err("FORBIDDEN",403);
      const user=state.users.find(u=>u.id===decodeURIComponent(userMatch[1])); if(!user) err("USER_NOT_FOUND",404);
      const requested=Array.isArray(b.permissions)?[...new Set(b.permissions.map(String))]:[];
      const invalid=requested.filter(x=>!ACTIVITY_PERMISSION_KEYS.includes(x));
      if(invalid.length) err("INVALID_ACTIVITY_PERMISSION",400);
      const reason=String(b.reason||"").trim(); if(reason.length<3) err("PERMISSION_REASON_REQUIRED",400);
      const validFrom=b.validFrom?new Date(b.validFrom).toISOString():null;
      const validUntil=b.validUntil?new Date(b.validUntil).toISOString():null;
      if(validFrom&&validUntil&&new Date(validUntil)<new Date(validFrom)) err("INVALID_PERMISSION_DATE_RANGE",400);

      user.activityPermissions=Array.isArray(user.activityPermissions)?user.activityPermissions:[];
      const changes={granted:[],updated:[],revoked:[]};
      for(const key of ACTIVITY_PERMISSION_KEYS){
        let cur=user.activityPermissions.find(x=>x.permission===key);
        const want=requested.includes(key);
        if(want){
          if(!cur){
            cur={permission:key,grantedAt:iso(),validFrom,validUntil,reason,revokedAt:null,revokedById:null,revokeReason:null};
            user.activityPermissions.push(cur);changes.granted.push(key);
            audit(who.id,"ACTIVITY_PERMISSION_GRANTED","User",user.id,{employeeId:user.employeeId,permission:key,validFrom,validUntil,reason});
          }else{
            const wasRevoked=Boolean(cur.revokedAt);
            Object.assign(cur,{grantedAt:wasRevoked?iso():cur.grantedAt,validFrom,validUntil,reason,revokedAt:null,revokedById:null,revokeReason:null});
            (wasRevoked?changes.granted:changes.updated).push(key);
            audit(who.id,wasRevoked?"ACTIVITY_PERMISSION_GRANTED":"ACTIVITY_PERMISSION_UPDATED","User",user.id,{employeeId:user.employeeId,permission:key,validFrom,validUntil,reason});
          }
        }else if(cur&&!cur.revokedAt){
          cur.revokedAt=iso();cur.revokedById=who.id;cur.revokeReason=reason;changes.revoked.push(key);
          audit(who.id,"ACTIVITY_PERMISSION_REVOKED","User",user.id,{employeeId:user.employeeId,permission:key,reason});
        }
      }
      save();
      return {ok:true,employeeId:user.employeeId,activityPermissions:user.activityPermissions,changes};
    }

    if (p === "/api/users/import" && method === "POST") {
      if(who.role!=="ADMIN") err("FORBIDDEN",403);
      const rows=Array.isArray(b.users)?b.users:[];
      if(!rows.length) err("USERS_REQUIRED",400);
      let createdCount=0,skippedCount=0,errorCount=0;
      const errors=[];
      for(const raw of rows.slice(0,2000)){
        try{
          const employeeId=String(raw.employeeId||"").trim().toUpperCase();
          const name=String(raw.name||"").trim();
          let role=String(raw.role||"PARTICIPANT").trim().toUpperCase();
          if(role==="ADMIN") role="PARTICIPANT";
          if(!employeeId||!name||!["ORGANIZER","STAFF","PARTICIPANT"].includes(role)){errorCount++;errors.push({employeeId,error:"INVALID_ROW"});continue;}
          if(state.users.some(u=>u.employeeId===employeeId)){skippedCount++;continue;}
          const email=String(raw.email||"").trim()||null;
          if(email && state.users.some(u=>String(u.email||"").toLowerCase()===email.toLowerCase())){errorCount++;errors.push({employeeId,error:"EMAIL_ALREADY_EXISTS"});continue;}
          const dept=String(raw.department||"").trim();
          const user={id:employeeId,employeeId,name,email,role,status:"ACTIVE",department:dept?{code:"DEMO-"+uid("D").slice(-6).toUpperCase(),name:dept}:null};
          state.users.push(user);createdCount++;
        }catch(e){errorCount++;errors.push({employeeId:String(raw.employeeId||""),error:String(e.message||e)});}
      }
      save();audit(who.id,"USER_IMPORT","User","BATCH",{createdCount,skippedCount,errorCount});
      return {ok:true,createdCount,skippedCount,errorCount,errors:errors.slice(0,50)};
    }
    if (p === "/api/dashboard/summary" && method === "GET") {
      const activeRows = state.attendance.filter(r=>!r.isVoided);
      const rows = who.role === "PARTICIPANT" ? activeRows.filter(r=>r.userId===who.id) : activeRows;
      return {ok:true,scope:who.role==="PARTICIPANT"?"SELF":"ORGANIZATION",summary:{
        activityCount:state.activities.length,
        recordCount:rows.length,
        verifiedCount:rows.filter(r=>["VERIFIED","OVERRIDE_VERIFIED"].includes(r.finalEvidenceStatus)).length,
        overrideVerifiedCount:rows.filter(r=>r.finalEvidenceStatus==="OVERRIDE_VERIFIED").length,
        reviewRequiredCount:rows.filter(r=>(r.consistencyResult?.status)==="REVIEW_REQUIRED").length,
        incompleteCount:rows.filter(r=>(r.consistencyResult?.status)==="INCOMPLETE").length
      }};
    }
    if (p === "/api/activities" && method === "GET") {
      return {ok:true,activities:state.activities.map(activityPublic)};
    }
    if (p === "/api/activities" && method === "POST") {
      if(!hasActivityPermission(who,"CAN_CREATE_ACTIVITY")) err("ACTIVITY_PERMISSION_REQUIRED",403);
      let primaryOrganizer=who;
      if(who.role==="ADMIN"&&b.primaryOrganizerId){
        const selected=actor(b.primaryOrganizerId);
        if(!selected||selected.status!=="ACTIVE") err("PRIMARY_ORGANIZER_NOT_FOUND_OR_INACTIVE",400);
        if(selected.role!=="ADMIN"&&!hasActivityPermission(selected,"CAN_CREATE_ACTIVITY")) err("PRIMARY_ORGANIZER_LACKS_CREATE_PERMISSION",409);
        primaryOrganizer=selected;
      }
      const startMs=new Date(b.startAt).getTime(), endMs=new Date(b.endAt).getTime();
      if(!Number.isFinite(startMs)||!Number.isFinite(endMs)||endMs<=startMs) err("INVALID_ACTIVITY_TIME_RANGE",400);
      const defaults={
        checkinOpenAt:new Date(startMs-30*60000).toISOString(),
        checkinCloseAt:new Date(startMs+30*60000).toISOString(),
        checkoutOpenAt:new Date(endMs-30*60000).toISOString(),
        checkoutCloseAt:new Date(endMs+30*60000).toISOString()
      };
      const windows={
        checkinOpenAt:b.checkinOpenAt||defaults.checkinOpenAt,
        checkinCloseAt:b.checkinCloseAt||defaults.checkinCloseAt,
        checkoutOpenAt:b.checkoutOpenAt||defaults.checkoutOpenAt,
        checkoutCloseAt:b.checkoutCloseAt||defaults.checkoutCloseAt
      };
      if(new Date(windows.checkinOpenAt)>=new Date(windows.checkinCloseAt)) err("INVALID_CHECKIN_WINDOW",400);
      if(new Date(windows.checkoutOpenAt)>=new Date(windows.checkoutCloseAt)) err("INVALID_CHECKOUT_WINDOW",400);
      if(new Date(windows.checkinCloseAt)>new Date(b.endAt)) err("CHECKIN_WINDOW_AFTER_ACTIVITY_END",400);
      if(new Date(windows.checkoutOpenAt)<new Date(b.startAt)) err("CHECKOUT_WINDOW_BEFORE_ACTIVITY_START",400);

      const a = {
        id:uid("DEMO-EVT"),title:b.title,category:b.category,description:b.description||"",
        location:b.location,startAt:b.startAt,endAt:b.endAt,...windows,organizerId:primaryOrganizer.id,
        participationMode:"OPEN",allowedDepartmentCodes:[],roleAssignments:[],participants:[],
        assignmentsUpdatedAt:null,pilotClosedAt:null,pilotClosedById:null,pilotClosureNote:null,pilotClosureVersion:null,pilotClosureHash:null,pilotClosureSnapshot:null,
        policy:b.policy||{},qr:null
      };
      state.activities.unshift(a); audit(who.id,"ACTIVITY_CREATED","Activity",a.id,{demo:true,primaryOrganizerId:primaryOrganizer.id,primaryOrganizerEmployeeId:primaryOrganizer.employeeId}); save();
      return {ok:true,activity:activityPublic(a)};
    }

    let m = p.match(/^\/api\/activities\/([^/]+)\/manage$/);
    if(m && method==="GET"){
      const a=activity(decodeURIComponent(m[1])); if(!a) err("ACTIVITY_NOT_FOUND",404);
      if(!canManageActivity(who,a)) err("ACTIVITY_MANAGEMENT_FORBIDDEN",403);
      const coGov=coAssignmentGovernance(who,a);
      return {ok:true,activity:{...activityPublic(a),participants:(a.participants||[]).map(x=>({...x,user:userPublic(actor(x.userId))}))},capabilities:{
        canManage:true,
        canManageParticipants:true,
        canAssignCo:coGov.canEdit,
        canAssignVerifier:canAssignActivityRole(who,a,"CAN_ASSIGN_VERIFIER"),
        lifecycle:coGov.lifecycle,
        coChangeReasonRequired:coGov.reasonRequired,
        coAdminOverrideRequired:coGov.adminOverrideRequired
      }};
    }

    m = p.match(/^\/api\/activities\/([^/]+)\/assignments$/);
    if(m && method==="PUT"){
      const a=activity(decodeURIComponent(m[1])); if(!a) err("ACTIVITY_NOT_FOUND",404); ensureDemoActivityMutable(a);
      const hasCo=Array.isArray(b.coOrganizerIds), hasVerifier=Array.isArray(b.verifierIds);
      if(!hasCo&&!hasVerifier) err("ASSIGNMENT_LIST_REQUIRED",400);

      const coGov=coAssignmentGovernance(who,a);
      if(hasCo&&!coGov.canEdit) {
        err(coGov.lifecycle==="ENDED"?"CO_ORGANIZER_LOCKED_AFTER_ACTIVITY":"CO_ORGANIZER_ASSIGNMENT_FORBIDDEN",403);
      }
      if(hasVerifier&&!canAssignActivityRole(who,a,"CAN_ASSIGN_VERIFIER")) err("VERIFIER_ASSIGNMENT_FORBIDDEN",403);

      const resolveIds=(refs)=>[...new Set(refs.map(String))].map(ref=>{
        const u=actor(ref); if(!u||u.status!=="ACTIVE") err("ASSIGNEE_NOT_FOUND_OR_INACTIVE",400); return u;
      });
      const before=(a.roleAssignments||[]).map(x=>({...x}));
      let next=[...(a.roleAssignments||[])];
      const reason=String(b.changeReason||"").trim();

      let coAdded=[],coRemoved=[];
      if(hasCo){
        const users=resolveIds(b.coOrganizerIds);
        if(users.some(u=>u.id===a.organizerId)) err("PRIMARY_ORGANIZER_CANNOT_BE_CO_ORGANIZER",409);

        const beforeIds=before.filter(x=>x.role==="CO_ORGANIZER").map(x=>x.userId).sort();
        const nextIds=users.map(u=>u.id).sort();
        coAdded=nextIds.filter(id=>!beforeIds.includes(id));
        coRemoved=beforeIds.filter(id=>!nextIds.includes(id));
        const changed=coAdded.length>0||coRemoved.length>0;

        if(changed&&coGov.reasonRequired&&reason.length<10){
          err(coGov.lifecycle==="ENDED"?"ADMIN_OVERRIDE_REASON_REQUIRED":"CHANGE_REASON_REQUIRED_DURING_ACTIVITY",400);
        }

        if(changed){
          next=next.filter(x=>x.role!=="CO_ORGANIZER");
          next.push(...users.map(u=>({id:uid("DEMO-ASG"),userId:u.id,role:"CO_ORGANIZER",assignedById:who.id,assignedAt:iso()})));
          a.assignmentsUpdatedAt=iso();
        }
      }

      if(hasVerifier){
        const users=resolveIds(b.verifierIds);
        next=next.filter(x=>x.role!=="VERIFIER");
        next.push(...users.map(u=>({id:uid("DEMO-ASG"),userId:u.id,role:"VERIFIER",assignedById:who.id,assignedAt:iso()})));
        a.assignmentsUpdatedAt=iso();
      }

      const noChange=hasCo&&coAdded.length===0&&coRemoved.length===0&&!hasVerifier;
      if(noChange) return {ok:true,assignments:activityPublic(a).roleAssignments,noChange:true,lifecycle:coGov.lifecycle};

      a.roleAssignments=next;save();
      const action=hasCo
        ? (coGov.lifecycle==="ENDED"?"CO_ORGANIZER_ADMIN_OVERRIDE_AFTER_END":
           coGov.lifecycle==="ACTIVE"?"CO_ORGANIZER_CHANGED_DURING_ACTIVITY":
           "CO_ORGANIZER_ASSIGNMENTS_UPDATED")
        : "ACTIVITY_ASSIGNMENTS_UPDATED";
      audit(who.id,action,"Activity",a.id,{
        demo:true,
        lifecycle:coGov.lifecycle,
        changeReason:reason||null,
        coAdded,
        coRemoved,
        before,
        after:next
      });
      return {ok:true,assignments:activityPublic(a).roleAssignments,noChange:false,lifecycle:coGov.lifecycle,assignmentsUpdatedAt:a.assignmentsUpdatedAt};
    }

    m = p.match(/^\/api\/activities\/([^/]+)\/participants$/);
    if(m && method==="PUT"){
      const a=activity(decodeURIComponent(m[1])); if(!a) err("ACTIVITY_NOT_FOUND",404); ensureDemoActivityMutable(a);
      if(!canManageActivity(who,a)) err("ACTIVITY_MANAGEMENT_FORBIDDEN",403);
      const mode=String(b.mode||"OPEN").toUpperCase();
      if(!["OPEN","ROSTER","GROUP"].includes(mode)) err("INVALID_PARTICIPATION_MODE",400);
      const userIds=[...new Set((Array.isArray(b.userIds)?b.userIds:[]).map(String))];
      const departmentCodes=[...new Set((Array.isArray(b.departmentCodes)?b.departmentCodes:[]).map(String).filter(Boolean))];
      if(mode==="ROSTER"&&!userIds.length) err("ROSTER_REQUIRES_PARTICIPANTS",400);
      if(mode==="GROUP"&&!departmentCodes.length) err("GROUP_REQUIRES_DEPARTMENT",400);
      const roster=mode==="ROSTER"?userIds.map(ref=>{
        const u=actor(ref); if(!u||u.status!=="ACTIVE") err("PARTICIPANT_NOT_FOUND_OR_INACTIVE",400);
        return {id:uid("DEMO-AP"),userId:u.id,status:"INVITED",addedById:who.id,createdAt:iso()};
      }):[];
      a.participationMode=mode;
      a.allowedDepartmentCodes=mode==="GROUP"?departmentCodes:[];
      a.participants=roster;
      save();audit(who.id,"ACTIVITY_PARTICIPATION_UPDATED","Activity",a.id,{demo:true,mode,participantCount:roster.length,departmentCodes:a.allowedDepartmentCodes});
      return {ok:true,activity:activityPublic(a)};
    }

    m = p.match(/^\/api\/activities\/([^/]+)\/qr$/);
    if (m && method === "POST") {
      const a = activity(decodeURIComponent(m[1])); if(!a) err("ACTIVITY_NOT_FOUND",404);
      if(!canManageActivity(who,a)) err("ACTIVITY_MANAGEMENT_FORBIDDEN",403);
      const purpose=String(b.purpose||"CHECKIN").toUpperCase();
      if(!["CHECKIN","CHECKOUT"].includes(purpose)) err("INVALID_QR_PURPOSE",400);
      const windowState=purpose==="CHECKOUT"?checkoutWindowState(a):checkinWindowState(a);
      if(!windowState.ok){
        const e=new Error(windowState.code);e.status=409;
        e.data={
          ok:false,error:windowState.code,purpose,
          checkinOpenAt:windowState.checkinOpenAt,checkinCloseAt:windowState.checkinCloseAt,
          checkoutOpenAt:windowState.checkoutOpenAt,checkoutCloseAt:windowState.checkoutCloseAt
        };
        throw e;
      }
      const closeAt=purpose==="CHECKOUT"?windowState.checkoutCloseAt:windowState.checkinCloseAt;
      const exp = new Date(Math.min(Date.now()+45000,new Date(closeAt).getTime()));
      const qrRecord = {
        token:encodePortableDemoQr(a,purpose,exp.getTime()),
        issuedAt:iso(),
        expiresAt:exp.toISOString(),
        purpose,
        format:"ACTIVADEMO1",
        portableAcrossDevices:true
      };
      a.qrByPurpose=a.qrByPurpose||{};
      a.qrByPurpose[purpose]=qrRecord;
      if(purpose==="CHECKIN") a.qr=qrRecord;
      audit(who.id,"QR_ISSUED","Activity",a.id,{demo:true,purpose,expiresAt:qrRecord.expiresAt,format:"ACTIVADEMO1",portableAcrossDevices:true}); save();
      return {
        ok:true,...qrRecord,demo:true,
        checkinOpenAt:windowState.checkinOpenAt,checkinCloseAt:windowState.checkinCloseAt,
        checkoutOpenAt:windowState.checkoutOpenAt,checkoutCloseAt:windowState.checkoutCloseAt
      };
    }

    if (p === "/api/demo/qa-cases" && method === "POST") {
      if(who.role!=="ADMIN") err("ADMIN_ONLY_SYNTHETIC_QA_GENERATOR",403);
      return ensureSyntheticQaCases();
    }

    if (p === "/api/attendance" && method === "GET") {
      const includeVoided = url.searchParams.get("includeVoided")==="true" && ["ADMIN","STAFF"].includes(who.role);
      let rows = includeVoided ? state.attendance : state.attendance.filter(r=>!r.isVoided);
      if (who.role === "PARTICIPANT") rows = rows.filter(r=>r.userId===who.id);
      const activityId = url.searchParams.get("activityId");
      if (activityId) rows = rows.filter(r=>r.activityId===activityId);
      return {ok:true,attendance:rows.map(hydrateAttendance)};
    }
    if (p === "/api/attendance/checkin" && method === "POST") {
      const u = actor(b.userId); if(!u) err("USER_NOT_FOUND",404);
      if (who.role==="PARTICIPANT" && who.id!==u.id) err("PARTICIPANT_CAN_ONLY_CHECKIN_SELF",403);
      let a = state.activities.find(x=>x.qrByPurpose?.CHECKIN?.token===b.token || x.qr?.token===b.token);
      const portable=decodePortableDemoQr(b.token);
      if(portable){
        const nowMs=Date.now();
        if(nowMs>Number(portable.exp)) err("INVALID_OR_EXPIRED_DEMO_QR",400);
        if(nowMs<Number(portable.iat)-120000) err("INVALID_DEMO_QR_CLOCK",400);
        if(portable.q!=="CHECKIN"){
          const e=new Error("QR_PURPOSE_MISMATCH");e.status=409;
          e.data={ok:false,error:"QR_PURPOSE_MISMATCH",expectedPurpose:"CHECKIN",actualPurpose:portable.q};
          throw e;
        }
        a=materializePortableActivity(portable);
        a.qrByPurpose=a.qrByPurpose||{};
        a.qrByPurpose.CHECKIN={token:b.token,issuedAt:new Date(Number(portable.iat)).toISOString(),expiresAt:new Date(Number(portable.exp)).toISOString(),purpose:"CHECKIN",format:"ACTIVADEMO1",portableAcrossDevices:true};
        a.qr=a.qrByPurpose.CHECKIN;
        save();
      }
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
      ensureDemoActivityMutable(a);
      if(a.qr?.token===b.token && new Date(a.qr.expiresAt)<=new Date()) err("INVALID_OR_EXPIRED_DEMO_QR",400);
      const windowState=checkinWindowState(a);
      if(!windowState.ok){
        const e=new Error(windowState.code);e.status=409;
        e.data={ok:false,error:windowState.code,checkinOpenAt:windowState.checkinOpenAt,checkinCloseAt:windowState.checkinCloseAt};
        throw e;
      }
      let participationAllowed=a.participationMode==="OPEN"||!a.participationMode;
      if(a.participationMode==="ROSTER") participationAllowed=(a.participants||[]).some(x=>x.userId===u.id&&x.status!=="CANCELLED");
      if(a.participationMode==="GROUP") participationAllowed=Boolean(u.department?.code&&(a.allowedDepartmentCodes||[]).includes(u.department.code));
      if(!participationAllowed) err("ACTIVITY_PARTICIPATION_NOT_ALLOWED",403);
      const existing = state.attendance.find(r=>r.activityId===a.id&&r.userId===u.id&&!r.isVoided);
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
      const createdAt=iso();
      const r = {id:uid("DEMO-ATT"),activityId:a.id,userId:u.id,createdAt,checkinAt:createdAt,checkoutAt:null,
        attendanceStatus:"CHECKED_IN",qrValid:true,identityVerified:true,signatureVerified:false,
        scanAttempts:1,staffVerification:null,consistencyResult:null,finalEvidenceStatus:null,
        checkoutQrValid:false,checkoutMethod:null,checkoutExceptionReason:null,
        captureSource:String(b.scanSource||"QR"),
        syntheticTest:Boolean(b.testMode)};
      state.attendance.unshift(r);
      audit(who.id,b.testMode?"DEMO_SAME_DEVICE_TEST_CHECKIN":"CHECKIN","AttendanceRecord",r.id,{
        demo:true,
        syntheticTest:Boolean(b.testMode),
        scanSource:String(b.scanSource||"QR")
      });
      save();
      return {ok:true,attendance:hydrateAttendance(r)};
    }

    m = p.match(/^\/api\/attendance\/([^/]+)\/checkout$/);
    if (m && method==="POST") {
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      if(r.isVoided) err("ATTENDANCE_VOIDED",409);
      if(who.role==="PARTICIPANT"&&r.userId!==who.id) err("PARTICIPANT_CAN_ONLY_CHECKOUT_SELF",403);
      if(r.checkoutAt) err("ALREADY_CHECKED_OUT",409);
      if(!b.token) err("CHECKOUT_QR_REQUIRED",400);

      const portable=decodePortableDemoQr(b.token);
      if(!portable) err("INVALID_OR_EXPIRED_DEMO_QR",400);
      const nowMs=Date.now();
      if(nowMs>Number(portable.exp)) err("INVALID_OR_EXPIRED_DEMO_QR",400);
      if(nowMs<Number(portable.iat)-120000) err("INVALID_DEMO_QR_CLOCK",400);
      if(portable.q!=="CHECKOUT"){
        const e=new Error("QR_PURPOSE_MISMATCH");e.status=409;
        e.data={ok:false,error:"QR_PURPOSE_MISMATCH",expectedPurpose:"CHECKOUT",actualPurpose:portable.q};
        throw e;
      }
      if(portable.id!==r.activityId){
        const e=new Error("CHECKOUT_QR_ACTIVITY_MISMATCH");e.status=409;
        e.data={ok:false,error:"CHECKOUT_QR_ACTIVITY_MISMATCH",expectedActivityId:r.activityId,actualActivityId:portable.id};
        throw e;
      }

      const a=activity(r.activityId)||materializePortableActivity(portable);
      const windowState=checkoutWindowState(a);
      if(!windowState.ok){
        const e=new Error(windowState.code);e.status=409;
        e.data={ok:false,error:windowState.code,checkoutOpenAt:windowState.checkoutOpenAt,checkoutCloseAt:windowState.checkoutCloseAt};
        throw e;
      }

      const previousFinal=r.finalEvidenceStatus||null;
      r.checkoutAt=iso();
      r.attendanceStatus="CHECKED_OUT";
      r.checkoutQrValid=true;
      r.checkoutMethod="DYNAMIC_QR";
      r.checkoutExceptionReason=null;
      r.checkoutCaptureSource=String(b.scanSource||"QR");
      r.checkoutSyntheticTest=Boolean(b.testMode);
      r.finalEvidenceStatus=null;
      save();
      if(previousFinal) audit(who.id,"FINAL_DECISION_INVALIDATED","AttendanceRecord",r.id,{demo:true,previousFinal,reason:"CHECKOUT_CHANGED"});
      audit(who.id,b.testMode?"DEMO_SAME_DEVICE_TEST_CHECKOUT":"CHECKOUT","AttendanceRecord",r.id,{
        demo:true,method:"DYNAMIC_QR",checkoutQrValid:true,syntheticTest:Boolean(b.testMode),scanSource:String(b.scanSource||"QR")
      });
      return {ok:true,attendance:hydrateAttendance(r)};
    }

    m = p.match(/^\/api\/attendance\/([^/]+)\/checkout-assist$/);
    if (m && method==="POST") {
      if(!["ADMIN","STAFF"].includes(who.role)) err("FORBIDDEN",403);
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      if(r.isVoided) err("ATTENDANCE_VOIDED",409);
      if(r.checkoutAt) err("ALREADY_CHECKED_OUT",409);
      const reason=String(b.reason||"").trim();
      if(reason.length<10) err("CHECKOUT_EXCEPTION_REASON_REQUIRED",400);
      const a=activity(r.activityId); if(!a) err("ACTIVITY_NOT_FOUND",404);
      const windowState=checkoutWindowState(a);
      const previousFinal=r.finalEvidenceStatus||null;
      r.checkoutAt=iso();
      r.attendanceStatus="CHECKED_OUT";
      r.checkoutQrValid=false;
      r.checkoutMethod="STAFF_ASSISTED";
      r.checkoutExceptionReason=reason;
      r.finalEvidenceStatus=null;
      save();
      if(previousFinal) audit(who.id,"FINAL_DECISION_INVALIDATED","AttendanceRecord",r.id,{demo:true,previousFinal,reason:"STAFF_ASSISTED_CHECKOUT"});
      audit(who.id,"STAFF_ASSISTED_CHECKOUT","AttendanceRecord",r.id,{demo:true,reason,checkoutWindowState:windowState.code});
      return {ok:true,attendance:hydrateAttendance(r),exception:true,windowState:windowState.code};
    }

    m = p.match(/^\/api\/attendance\/([^/]+)\/staff-verify$/);
    if (m && method==="POST") {
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      if(r.isVoided) err("ATTENDANCE_VOIDED",409);
      if(r.staffVerification) return {ok:true,verification:r.staffVerification,idempotent:true};
      const previousFinal=r.finalEvidenceStatus||null;
      r.staffVerification={id:uid("DEMO-SV"),attendanceId:r.id,verifierId:who.id,verifiedAt:iso(),status:"VERIFIED_PRESENT"};
      r.finalEvidenceStatus=null;
      save();
      if(previousFinal) audit(who.id,"FINAL_DECISION_INVALIDATED","AttendanceRecord",r.id,{demo:true,previousFinal,reason:"STAFF_VERIFICATION_CHANGED"});
      audit(who.id,"STAFF_VERIFIED","AttendanceRecord",r.id,{demo:true});
      return {ok:true,verification:r.staffVerification};
    }

    m = p.match(/^\/api\/attendance\/([^/]+)\/void$/);
    if (m && method==="POST") {
      if(!["ADMIN","STAFF"].includes(who.role)) err("FORBIDDEN",403);
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      if(r.isVoided) return {ok:true,attendance:hydrateAttendance(r),idempotent:true};
      const locked=state.groundTruthCases.find(x=>x.attendanceId===r.id&&x.status==="LOCKED");
      if(locked) err("LOCKED_GROUND_TRUTH_CANNOT_BE_VOIDED",409);
      const reason=String(b.reason||"").trim();
      if(reason.length<5) err("VOID_REASON_REQUIRED",400);
      r.isVoided=true;r.voidedAt=iso();r.voidedById=who.id;r.voidReason=reason;
      save();audit(who.id,"ATTENDANCE_VOIDED_BY_REVIEWER","AttendanceRecord",r.id,{demo:true,reason});
      return {ok:true,attendance:hydrateAttendance(r)};
    }

    m = p.match(/^\/api\/evidence\/([^/]+)\/evaluate$/);
    if (m && method==="POST") {
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      if(r.isVoided) err("ATTENDANCE_VOIDED",409);
      const result=evalEvidence(r);
      if(r.finalEvidenceStatus==="VERIFIED" && result.status!=="COMPLETE"){
        const previousFinal=r.finalEvidenceStatus;
        r.finalEvidenceStatus=null;
        audit(who.id,"FINAL_DECISION_INVALIDATED","AttendanceRecord",r.id,{demo:true,previousFinal,reason:"POLICY_BLOCKERS_AFTER_REEVALUATION"});
      }
      save(); audit(who.id,"EVIDENCE_EVALUATED","AttendanceRecord",r.id,{demo:true,status:result.status});
      return {ok:true,result,note:"DEMO rule-based result; not AI probability."};
    }

    m = p.match(/^\/api\/reviews\/([^/]+)$/);
    if (m && method==="POST") {
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      ensureDemoActivityMutable(activity(r.activityId));
      if(r.isVoided) err("ATTENDANCE_VOIDED",409);
      if(!r.consistencyResult) err("EVIDENCE_EVALUATION_REQUIRED",409);
      const allowed=["VERIFY","OVERRIDE_VERIFY","CORRECT","REQUEST_EVIDENCE","REJECT"];
      if(!allowed.includes(b.decision)) err("INVALID_DECISION",400);
      const blockers=[...(r.consistencyResult.missingCodes||[]),...(r.consistencyResult.reasonCodes||[])];
      const reason=String(b.reason||"").trim();
      if(b.decision==="VERIFY" && blockers.length) err("REVIEW_BLOCKERS_PRESENT",409);
      if(b.decision==="OVERRIDE_VERIFY"){
        if(who.role!=="ADMIN") err("ADMIN_ONLY_MANUAL_OVERRIDE",403);
        if(!blockers.length) err("OVERRIDE_NOT_NEEDED",409);
      }
      if(reason.length<3) err("REVIEW_REASON_REQUIRED",400);
      if(b.decision==="OVERRIDE_VERIFY"&&reason.length<10) err("OVERRIDE_REASON_REQUIRED",400);
      const previousFinalStatus=r.finalEvidenceStatus||null;
      const review={id:uid("DEMO-RV"),attendanceId:r.id,reviewerId:who.id,decision:b.decision,reason,
        reviewStartedAt:b.reviewStartedAt||null,reviewedAt:iso(),reviewDurationSeconds:b.reviewDurationSeconds||null,
        override:b.decision==="OVERRIDE_VERIFY",blockersAtDecision:blockers};
      state.reviews.push(review);
      r.finalEvidenceStatus=b.decision==="VERIFY"?"VERIFIED":b.decision==="OVERRIDE_VERIFY"?"OVERRIDE_VERIFIED":b.decision==="REJECT"?"REJECTED":"REVIEW_REQUIRED";
      save(); audit(who.id,b.decision==="OVERRIDE_VERIFY"?"MANUAL_OVERRIDE_VERIFIED":"HUMAN_REVIEW","AttendanceRecord",r.id,{
        demo:true,reviewId:review.id,reviewerId:who.id,decision:b.decision,reason,previousFinalStatus,
        finalEvidenceStatus:r.finalEvidenceStatus,systemEvidenceStatus:r.consistencyResult.status,blockers,
        reviewStartedAt:review.reviewStartedAt,reviewedAt:review.reviewedAt,reviewDurationSeconds:review.reviewDurationSeconds
      });
      return {ok:true,review,previousFinalStatus,finalEvidenceStatus:r.finalEvidenceStatus,systemEvidenceStatus:r.consistencyResult.status,blockers};
    }

    if (p === "/api/ground-truth/queue" && method==="GET") {
      const rows=state.attendance.filter(r=>!r.isVoided).map(r=>{
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
      const records=model?state.attendance.filter(r=>!r.isVoided&&!scored.has(r.id)).map(r=>({record_id:r.id,participant_hash:hashDemo(r.userId),
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
      const records=model?state.predictions
        .filter(x=>x.modelVersion===model.version)
        .sort((a,b)=>Number(b.riskProbability||0)-Number(a.riskProbability||0))
        .map((pr,index)=>({
          ...pr,
          priorityRank:index+1,
          riskPercent:Math.round(Number(pr.riskProbability||0)*100),
          modelFlaggedForReview:pr.predictedLabel==="REVIEW_REQUIRED",
          attendance:hydrateAttendance(attendance(pr.attendanceId))
        })):[];
      return {
        ok:true,deployedModel:model,decisionSupportOnly:true,syntheticDemo:true,
        rankingBasis:"deployed_model_risk_probability_desc",records
      };
    }

    if (p === "/api/operations/release-gate" && method==="GET") {
      if(!["ADMIN","STAFF"].includes(who.role)) err("FORBIDDEN",403);
      const ended=state.activities.filter(a=>new Date(a.endAt).getTime()<Date.now());
      const assessments=ended.map(a=>{
        if(a.pilotClosedAt)return{activityId:a.id,title:a.title,category:a.category,endAt:a.endAt,pilotClosedAt:a.pilotClosedAt,pilotClosureHash:a.pilotClosureHash,pilotClosureVersion:a.pilotClosureVersion,alreadyClosed:true,closeReady:true,criticalIssues:[],checklist:[{key:"IMMUTABLE_CLOSURE_RECORDED",passed:true}]};
        const x=demoActivityCloseAssessment(a);return{activityId:a.id,title:a.title,category:a.category,endAt:a.endAt,pilotClosedAt:null,pilotClosureHash:null,pilotClosureVersion:null,alreadyClosed:false,closeReady:x.closeReady,criticalIssues:x.criticalIssues,checklist:x.checklist,unresolvedCount:x.unresolvedCount,unevaluatedCount:x.unevaluatedCount};
      });
      const recovery=state.audit.find(log=>log.action==="BACKUP_RECOVERY_CHECK_PASSED"&&log.metadata?.backupReleaseVersion===RELEASE_VERSION&&log.metadata?.valid===true) || null;
      const recoveryFresh=Boolean(recovery&&(Date.now()-new Date(recovery.createdAt).getTime()<=24*3600000));
      const blockers=["DEMO_MODE_NOT_PRODUCTION"];
      if(assessments.some(x=>!x.alreadyClosed))blockers.push("ENDED_ACTIVITIES_NOT_IMMUTABLY_CLOSED");
      if(!recoveryFresh)blockers.push("RECENT_BACKUP_RECOVERY_CHECK_REQUIRED");
      const latestDecision=state.audit.find(log=>["PILOT_RELEASE_GO","PILOT_RELEASE_HOLD"].includes(log.action))||null;
      return {ok:true,releaseVersion:RELEASE_VERSION,gate:"HOLD",blockers,generatedAt:iso(),containsPII:false,syntheticDemo:true,
        security:{qrSigningReady:false,researchSaltReady:false,ready:false,secretsExposed:false,demoMode:true},
        reviewMonitoring:{targetHours:24,backlogCount:0,overTargetCount:0},
        activityClosure:{endedActivityCount:ended.length,closedCount:assessments.filter(x=>x.alreadyClosed).length,notClosedCount:assessments.filter(x=>!x.alreadyClosed).length,activities:assessments},
        backupRecovery:{required:true,freshnessHours:24,passed:recoveryFresh,lastPassedAt:recovery?.createdAt||null},
        scenarios:[
          {id:"DEMO_NOT_PRODUCTION",title:"Demo mode cannot receive production GO",status:"HOLD",evidence:{syntheticDemo:true}},
          {id:"HUMAN_FINAL_DECISION",title:"Human decision remains final authority",status:"PASS",evidence:{aiAutonomousDecision:false,humanFinalDecisionRequired:true}},
          {id:"ACTIVITY_IMMUTABILITY",title:"Ended activities are immutably closed before release",status:assessments.every(x=>x.alreadyClosed)?"PASS":"HOLD",evidence:{notClosedCount:assessments.filter(x=>!x.alreadyClosed).length}},
          {id:"BACKUP_RECOVERY",title:"Current-release backup recovery verification",status:recoveryFresh?"PASS":"HOLD",evidence:{passedAt:recovery?.createdAt||null}}
        ],
        latestReleaseDecision:latestDecision?{action:latestDecision.action,createdAt:latestDecision.createdAt,metadata:latestDecision.metadata}:null,
        note:"Demo mode is intentionally HOLD and cannot authorize a production pilot."
      };
    }

    m=p.match(/^\/api\/operations\/activities\/([^/]+)\/close$/);
    if(m&&method==="POST"){
      if(who.role!=="ADMIN")err("FORBIDDEN",403);
      const a=activity(decodeURIComponent(m[1]));if(!a)err("ACTIVITY_NOT_FOUND",404);
      if(a.pilotClosedAt)return{ok:true,idempotent:true,activityId:a.id,pilotClosedAt:a.pilotClosedAt,pilotClosureHash:a.pilotClosureHash,pilotClosureVersion:a.pilotClosureVersion};
      const assessment=demoActivityCloseAssessment(a);
      if(!assessment.closeReady){
        const e=new Error("ACTIVITY_NOT_CLOSE_READY");e.status=409;e.data={ok:false,error:"ACTIVITY_NOT_CLOSE_READY",checklist:assessment.checklist,unevaluatedCount:assessment.unevaluatedCount,unresolvedCount:assessment.unresolvedCount,criticalIssues:assessment.criticalIssues};throw e;
      }
      const reason=String(b.reason||"").trim();if(reason.length<10)err("ACTIVITY_CLOSURE_REASON_REQUIRED",400);
      const snapshot={releaseVersion:RELEASE_VERSION,activityId:a.id,title:a.title,category:a.category,startAt:a.startAt,endAt:a.endAt,policy:a.policy,checklist:assessment.checklist,recordCount:assessment.recordCount,
        records:assessment.rows.map(row=>({attendanceId:row.id,systemEvidenceStatus:row.consistencyResult?.status||null,finalEvidenceStatus:row.finalEvidenceStatus||null,
          latestHumanReview:(state.reviews.filter(x=>x.attendanceId===row.id).sort((x,y)=>String(y.reviewedAt).localeCompare(String(x.reviewedAt)))[0]||null)}))};
      a.pilotClosedAt=iso();a.pilotClosedById=who.id;a.pilotClosureNote=reason;a.pilotClosureVersion=RELEASE_VERSION;a.pilotClosureSnapshot=snapshot;a.pilotClosureHash=hashDemo(JSON.stringify(snapshot));
      save();audit(who.id,"ACTIVITY_PILOT_CLOSED","Activity",a.id,{demo:true,releaseVersion:RELEASE_VERSION,closureHash:a.pilotClosureHash,note:reason,recordCount:assessment.recordCount,checklist:assessment.checklist});
      return{ok:true,immutableOperationalClosure:true,activityId:a.id,pilotClosedAt:a.pilotClosedAt,pilotClosureHash:a.pilotClosureHash,pilotClosureVersion:a.pilotClosureVersion,syntheticDemo:true};
    }

    if(p==="/api/operations/backup"&&method==="GET"){
      if(who.role!=="ADMIN")err("FORBIDDEN",403);
      const backup=demoBackup();audit(who.id,"BACKUP_EXPORTED","System",RELEASE_VERSION,{demo:true,releaseVersion:RELEASE_VERSION,checksum:backup.checksum,counts:backup.counts,containsPII:true,containsSecrets:false});
      return{ok:true,warning:"DEMO backup contains synthetic PII-like fields only. It is not a production backup.",backup};
    }

    if(p==="/api/operations/recovery-check"&&method==="POST"){
      if(who.role!=="ADMIN")err("FORBIDDEN",403);
      const result=validateDemoBackup(b.backup);
      audit(who.id,result.valid?"BACKUP_RECOVERY_CHECK_PASSED":"BACKUP_RECOVERY_CHECK_FAILED","System",RELEASE_VERSION,{demo:true,valid:result.valid,checksum:result.checksum||b.backup?.checksum||null,backupReleaseVersion:b.backup?.releaseVersion||null,currentReleaseVersionMatch:Boolean(result.currentReleaseVersionMatch),error:result.error||null});
      if(!result.valid){const e=new Error(result.error);e.status=422;e.data={ok:false,...result};throw e;}
      return{ok:true,restorableStructureVerified:true,destructiveRestorePerformed:false,...result,syntheticDemo:true};
    }

    if(p==="/api/operations/release-decision"&&method==="POST"){
      if(who.role!=="ADMIN")err("FORBIDDEN",403);
      const decision=String(b.decision||"").toUpperCase(),reason=String(b.reason||"").trim();
      if(!["GO","HOLD"].includes(decision))err("INVALID_RELEASE_DECISION",400);
      if(reason.length<10)err("RELEASE_DECISION_REASON_REQUIRED",400);
      if(decision==="GO")err("DEMO_MODE_CANNOT_AUTHORIZE_PRODUCTION_GO",409);
      audit(who.id,"PILOT_RELEASE_HOLD","System",RELEASE_VERSION,{demo:true,releaseVersion:RELEASE_VERSION,decision:"HOLD",reason,blockersAtDecision:["DEMO_MODE_NOT_PRODUCTION"]});
      return{ok:true,releaseVersion:RELEASE_VERSION,decision:"HOLD",reason,blockersAtDecision:["DEMO_MODE_NOT_PRODUCTION"],recordedAt:iso(),syntheticDemo:true};
    }

    if (p === "/api/operations/pilot-readiness" && method==="GET") {
      if(!["ADMIN","STAFF"].includes(who.role)) err("FORBIDDEN",403);
      const nowMs=Date.now(), terminal=new Set(["VERIFIED","OVERRIDE_VERIFIED","REJECTED"]);
      const reviewTargetHours=24;
      const rows=state.attendance.filter(r=>!r.isVoided);
      const alerts=new Map(),activityCritical=new Map();
      const addAlert=(code,severity,activityId=null)=>{
        const key=severity+"::"+code;
        const item=alerts.get(key)||{code,severity,count:0};item.count++;alerts.set(key,item);
        if(severity==="CRITICAL"&&activityId)activityCritical.set(activityId,(activityCritical.get(activityId)||0)+1);
      };
      const dup=new Map();
      rows.forEach(r=>{const key=r.activityId+"::"+r.userId;if(!dup.has(key))dup.set(key,[]);dup.get(key).push(r);});
      dup.forEach(group=>{if(group.length>1)addAlert("DUPLICATE_NONVOID_ATTENDANCE","CRITICAL",group[0].activityId);});

      rows.forEach(r=>{
        const reviews=state.reviews.filter(x=>x.attendanceId===r.id).sort((a,b)=>String(b.reviewedAt).localeCompare(String(a.reviewedAt)));
        const latest=reviews[0]||null;
        const blockers=[...(r.consistencyResult?.missingCodes||[]),...(r.consistencyResult?.reasonCodes||[])];
        if(r.checkinAt&&r.checkoutAt&&new Date(r.checkoutAt)<new Date(r.checkinAt))addAlert("CHECKOUT_BEFORE_CHECKIN","CRITICAL",r.activityId);
        if(terminal.has(r.finalEvidenceStatus)&&!latest)addAlert("FINAL_STATUS_WITHOUT_HUMAN_REVIEW","CRITICAL",r.activityId);
        if(r.finalEvidenceStatus==="VERIFIED"&&(!r.consistencyResult||r.consistencyResult.status!=="COMPLETE"||blockers.length)){
          addAlert("NORMAL_VERIFY_WITH_SYSTEM_BLOCKERS","CRITICAL",r.activityId);
        }
        if(latest&&String(latest.reason||"").trim().length<3)addAlert("HUMAN_REVIEW_REASON_MISSING","WARNING",r.activityId);
        const a=activity(r.activityId),ended=new Date(a?.endAt||0).getTime()<nowMs;
        if(ended&&!terminal.has(r.finalEvidenceStatus)&&!r.consistencyResult)addAlert("ENDED_ACTIVITY_RECORD_NOT_EVALUATED","WARNING",r.activityId);
      });

      const backlog=rows.map(r=>{
        if(terminal.has(r.finalEvidenceStatus))return null;
        const a=activity(r.activityId),ended=new Date(a?.endAt||0).getTime()<nowMs;
        if(!r.consistencyResult&&!ended)return null;
        const queueStartedAt=r.consistencyResult?.evaluatedAt||a?.endAt||r.createdAt||iso();
        const ageHours=Math.max(0,(nowMs-new Date(queueStartedAt).getTime())/3600000);
        return {activityId:r.activityId,queueStartedAt,ageHours,systemEvidenceStatus:r.consistencyResult?.status||"NOT_EVALUATED"};
      }).filter(Boolean);
      const aging={
        under4h:backlog.filter(x=>x.ageHours<4).length,
        h4to24:backlog.filter(x=>x.ageHours>=4&&x.ageHours<24).length,
        h24to48:backlog.filter(x=>x.ageHours>=24&&x.ageHours<48).length,
        over48h:backlog.filter(x=>x.ageHours>=48).length
      };
      const overTargetCount=backlog.filter(x=>x.ageHours>=reviewTargetHours).length;
      const oldestBacklogHours=backlog.length?Math.max(...backlog.map(x=>x.ageHours)):null;

      const byActivity=new Map();
      rows.forEach(r=>{if(!byActivity.has(r.activityId))byActivity.set(r.activityId,[]);byActivity.get(r.activityId).push(r);});
      const endedActivities=state.activities.filter(a=>new Date(a.endAt).getTime()<nowMs).map(a=>{
        const records=byActivity.get(a.id)||[];
        const unevaluatedCount=records.filter(r=>!r.consistencyResult).length;
        const unresolvedCount=records.filter(r=>!terminal.has(r.finalEvidenceStatus)).length;
        const criticalDataQualityCount=activityCritical.get(a.id)||0;
        const checklist=[
          {key:"ACTIVITY_ENDED",passed:true},
          {key:"ALL_RECORDS_EVALUATED",passed:unevaluatedCount===0},
          {key:"NO_UNRESOLVED_HUMAN_REVIEW",passed:unresolvedCount===0},
          {key:"NO_CRITICAL_DATA_QUALITY",passed:criticalDataQualityCount===0}
        ];
        return {activityId:a.id,title:a.title,category:a.category,endedAt:a.endAt,recordCount:records.length,
          unevaluatedCount,unresolvedCount,criticalDataQualityCount,closeReady:checklist.every(x=>x.passed),checklist};
      });
      const alertRows=[...alerts.values()].sort((a,b)=>(a.severity===b.severity?b.count-a.count:a.severity==="CRITICAL"?-1:1)||a.code.localeCompare(b.code));
      const criticalAlertCount=alertRows.filter(x=>x.severity==="CRITICAL").reduce((s,x)=>s+x.count,0);
      const warningAlertCount=alertRows.filter(x=>x.severity==="WARNING").reduce((s,x)=>s+x.count,0);
      const notCloseReadyCount=endedActivities.filter(x=>!x.closeReady).length;
      let pilotStatus="READY";const blockers=[],warnings=[];
      if(criticalAlertCount>0){pilotStatus="BLOCKED";blockers.push("CRITICAL_DATA_QUALITY");}
      if(pilotStatus!=="BLOCKED"&&(overTargetCount>0||warningAlertCount>0||notCloseReadyCount>0))pilotStatus="WATCH";
      if(overTargetCount>0)warnings.push("REVIEW_BACKLOG_OVER_TARGET");
      if(warningAlertCount>0)warnings.push("DATA_QUALITY_WARNINGS");
      if(notCloseReadyCount>0)warnings.push("ENDED_ACTIVITIES_NOT_CLOSE_READY");
      const deployed=state.models.find(x=>x.status==="DEPLOYED")||null;
      return {
        ok:true,aggregated:true,containsPII:false,syntheticDemo:true,generatedAt:iso(),pilotStatus,blockers,warnings,
        governance:{humanFinalDecisionRequired:true,aiAutonomousDecision:false,groundTruthBlindedFromAiDuringLabeling:true,
          analyticsAggregateOnly:true,deployedModel:deployed?{version:deployed.version,modelFamily:deployed.modelFamily,deployedAt:deployed.deployedAt}:null,aiRequiredForPilot:false},
        reviewMonitoring:{targetHours:reviewTargetHours,targetType:"OPERATIONAL_MONITORING_TARGET_NOT_PERSONNEL_SCORE",
          backlogCount:backlog.length,overTargetCount,oldestBacklogHours,aging},
        dataQuality:{criticalAlertCount,warningAlertCount,alerts:alertRows},
        activityClosing:{endedActivityCount:endedActivities.length,closeReadyCount:endedActivities.filter(x=>x.closeReady).length,
          notCloseReadyCount,activities:endedActivities,note:"DEMO checklist only; does not mutate or lock activities."}
      };
    }

    if (p === "/api/analytics/verified" && method==="GET") {
      if(!["ADMIN","STAFF"].includes(who.role)) err("FORBIDDEN",403);
      const rows=state.attendance.filter(r=>!r.isVoided);
      const terminal=new Set(["VERIFIED","OVERRIDE_VERIFIED","REJECTED"]);
      const finalized=rows.filter(r=>terminal.has(r.finalEvidenceStatus));
      const unresolved=rows.filter(r=>!terminal.has(r.finalEvidenceStatus));
      const verified=finalized.filter(r=>["VERIFIED","OVERRIDE_VERIFIED"].includes(r.finalEvidenceStatus));
      const override=finalized.filter(r=>r.finalEvidenceStatus==="OVERRIDE_VERIFIED");
      const rejected=finalized.filter(r=>r.finalEvidenceStatus==="REJECTED");
      const mean=values=>values.length?values.reduce((s,x)=>s+x,0)/values.length:null;

      const reviewDurations=finalized.map(r=>{
        const rv=state.reviews.filter(x=>x.attendanceId===r.id).sort((a,b)=>String(b.reviewedAt).localeCompare(String(a.reviewedAt)))[0];
        return Number.isFinite(Number(rv?.reviewDurationSeconds))?Number(rv.reviewDurationSeconds):null;
      }).filter(x=>x!==null&&x>=0);

      const resolutionHours=finalized.map(r=>{
        const rv=state.reviews.filter(x=>x.attendanceId===r.id).sort((a,b)=>String(b.reviewedAt).localeCompare(String(a.reviewedAt)))[0];
        if(!rv?.reviewedAt||!r.createdAt)return null;
        const delta=new Date(rv.reviewedAt).getTime()-new Date(r.createdAt).getTime();
        return delta>=0?delta/3600000:null;
      }).filter(x=>x!==null&&Number.isFinite(x));

      const exceptionMap=new Map();
      finalized.forEach(r=>{
        const codes=[...(r.consistencyResult?.missingCodes||[]),...(r.consistencyResult?.reasonCodes||[])];
        [...new Set(codes.map(String))].forEach(code=>exceptionMap.set(code,(exceptionMap.get(code)||0)+1));
      });

      const activityMap=new Map();
      rows.forEach(r=>{
        const a=activity(r.activityId)||{};
        if(!activityMap.has(r.activityId)) activityMap.set(r.activityId,{
          activityId:r.activityId,title:a.title||"",category:a.category||"",
          recordCount:0,finalizedCount:0,verifiedCount:0,overrideVerifiedCount:0,rejectedCount:0,unresolvedCount:0
        });
        const x=activityMap.get(r.activityId);x.recordCount++;
        if(terminal.has(r.finalEvidenceStatus))x.finalizedCount++;else x.unresolvedCount++;
        if(["VERIFIED","OVERRIDE_VERIFIED"].includes(r.finalEvidenceStatus))x.verifiedCount++;
        if(r.finalEvidenceStatus==="OVERRIDE_VERIFIED")x.overrideVerifiedCount++;
        if(r.finalEvidenceStatus==="REJECTED")x.rejectedCount++;
      });
      const byActivity=[...activityMap.values()].map(x=>({...x,
        finalizationRate:x.recordCount?x.finalizedCount/x.recordCount:0,
        verifiedOutcomeRate:x.finalizedCount?x.verifiedCount/x.finalizedCount:null
      })).sort((a,b)=>b.recordCount-a.recordCount||a.title.localeCompare(b.title));

      const deployed=state.models.find(x=>x.status==="DEPLOYED")||null;
      const locked=state.groundTruthCases.filter(x=>x.status==="LOCKED"&&x.finalTarget);
      const comparable=locked.map(gt=>({
        gt,
        prediction:deployed?state.predictions.find(p=>p.attendanceId===gt.attendanceId&&p.modelVersion===deployed.version):null
      })).filter(x=>x.prediction);
      let tp=0,fp=0,tn=0,fn=0,agree=0;
      comparable.forEach(({gt,prediction})=>{
        const actual=gt.finalTarget,pred=prediction.predictedLabel;
        if(actual===pred)agree++;
        if(actual==="REVIEW_REQUIRED"&&pred==="REVIEW_REQUIRED")tp++;
        else if(actual==="NO_REVIEW_REQUIRED"&&pred==="REVIEW_REQUIRED")fp++;
        else if(actual==="NO_REVIEW_REQUIRED"&&pred==="NO_REVIEW_REQUIRED")tn++;
        else if(actual==="REVIEW_REQUIRED"&&pred==="NO_REVIEW_REQUIRED")fn++;
      });

      const labelGroups=new Map();
      state.groundTruthLabels.forEach(l=>{
        if(!labelGroups.has(l.attendanceId))labelGroups.set(l.attendanceId,[]);
        labelGroups.get(l.attendanceId).push(l);
      });
      const doubleLabeled=[...labelGroups.values()].filter(xs=>xs.length>=2);
      const reviewerAgree=doubleLabeled.filter(xs=>new Set(xs.map(x=>x.target)).size===1).length;

      return {
        ok:true,aggregated:true,containsPII:false,scope:"ORGANIZATION",syntheticDemo:true,generatedAt:iso(),
        operational:{
          recordCount:rows.length,finalizedCount:finalized.length,unresolvedCount:unresolved.length,
          verifiedCount:verified.length,overrideVerifiedCount:override.length,rejectedCount:rejected.length,
          finalizationRate:rows.length?finalized.length/rows.length:0,
          verifiedOutcomeRate:finalized.length?verified.length/finalized.length:null,
          averageReviewDurationSeconds:mean(reviewDurations),
          averageResolutionHours:mean(resolutionHours),
          turnaroundDefinition:"attendance_record_created_at_to_latest_terminal_human_review",
          exceptionPatterns:[...exceptionMap.entries()].map(([code,count])=>({code,count})).sort((a,b)=>b.count-a.count||a.code.localeCompare(b.code)),
          byActivity
        },
        researchSnapshot:{
          separatedFromOperationalOutcomes:true,
          deployedModel:deployed?{id:deployed.id,version:deployed.version,modelFamily:deployed.modelFamily,deployedAt:deployed.deployedAt}:null,
          lockedGroundTruthCount:locked.length,
          comparableModelGroundTruthCount:comparable.length,
          modelGroundTruthAgreementCount:agree,
          modelGroundTruthAgreementRate:comparable.length?agree/comparable.length:null,
          confusionMatrix:{tp,fp,tn,fn},
          doubleLabeledCaseCount:doubleLabeled.length,
          reviewerAgreementCount:reviewerAgree,
          reviewerAgreementRate:doubleLabeled.length?reviewerAgree/doubleLabeled.length:null,
          note:"DEMO/SYNTHETIC research snapshot; not personnel performance scores."
        }
      };
    }

    if (p === "/api/audit" && method==="GET") {
      const logs=state.audit.map(log=>{
        const r=log.entityType==="AttendanceRecord"?attendance(log.entityId):null;
        return {
          ...log,
          context:r?{
            participant:{employeeId:actor(r.userId)?.employeeId||"",name:actor(r.userId)?.name||""},
            activity:{id:r.activityId,title:activity(r.activityId)?.title||"",category:activity(r.activityId)?.category||""},
            isVoided:Boolean(r.isVoided)
          }:null
        };
      });
      return {ok:true,logs};
    }

    if (p === "/api/research/export" && method==="GET") {
      return {ok:true,deidentified:true,syntheticDemo:true,generatedAt:iso(),records:state.attendance.filter(r=>!r.isVoided).map(r=>({
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