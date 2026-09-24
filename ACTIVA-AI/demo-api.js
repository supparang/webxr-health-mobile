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
        {id:"STF001",employeeId:"STF001",name:"ผู้ตรวจสอบหลักฐานตัวอย่าง",role:"STAFF",status:"ACTIVE"},
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
        organizerId:"ORG001",
        participationMode:"OPEN",
        allowedDepartmentCodes:[],
        roleAssignments:[],
        participants:[],
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
        STF001: "ผู้ตรวจสอบหลักฐานตัวอย่าง",
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
  function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  function reset() { state = seed(); save(); return {ok:true}; }
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
    if (p.durationRequired) {
      if (d.ratio == null) missing.push("MISSING_DURATION");
      else if (d.ratio < Number(p.minDurationRatio || 0)) reasons.push("SHORT_DURATION");
    }
    let status = "COMPLETE";
    if (missing.length) status = "INCOMPLETE";
    if (reasons.length) status = "REVIEW_REQUIRED";
    r.consistencyResult = {
      id:"DEMO-CR-"+r.id,attendanceId:r.id,status,
      completenessRatio: Math.max(0,1-(missing.length/7)),
      missingCodes:missing,reasonCodes:reasons,durationRatio:d.ratio,
      ruleVersion:"DEMO-RULES-0.3.9",evaluatedAt:iso()
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
      return {ok:true,version:"0.5.4-demo",database:"demo-local",mode:"DEMO",synthetic:true};
    }
    if (p === "/api/me" && method === "GET") {
      if (!who) err("DEMO_USER_NOT_FOUND",404);
      if (who.status !== "ACTIVE") err("INVALID_OR_INACTIVE_USER",401);
      return {ok:true,user:{...userPublic(who),activityPermissions:effectiveActivityPermissions(who),activityAssignments:state.activities.flatMap(a=>(a.roleAssignments||[]).filter(x=>x.userId===who.id).map(x=>({activityId:a.id,role:x.role})))}};
    }
    if (!who || who.status !== "ACTIVE") err("DEMO_LOGIN_REQUIRED",401);

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
      const a = {
        id:uid("DEMO-EVT"),title:b.title,category:b.category,description:b.description||"",
        location:b.location,startAt:b.startAt,endAt:b.endAt,organizerId:primaryOrganizer.id,
        participationMode:"OPEN",allowedDepartmentCodes:[],roleAssignments:[],participants:[],
        policy:b.policy||{},qr:null
      };
      state.activities.unshift(a); audit(who.id,"ACTIVITY_CREATED","Activity",a.id,{demo:true,primaryOrganizerId:primaryOrganizer.id,primaryOrganizerEmployeeId:primaryOrganizer.employeeId}); save();
      return {ok:true,activity:activityPublic(a)};
    }

    let m = p.match(/^\/api\/activities\/([^/]+)\/manage$/);
    if(m && method==="GET"){
      const a=activity(decodeURIComponent(m[1])); if(!a) err("ACTIVITY_NOT_FOUND",404);
      if(!canManageActivity(who,a)) err("ACTIVITY_MANAGEMENT_FORBIDDEN",403);
      return {ok:true,activity:{...activityPublic(a),participants:(a.participants||[]).map(x=>({...x,user:userPublic(actor(x.userId))}))},capabilities:{
        canManage:true,
        canManageParticipants:true,
        canAssignCo:canAssignActivityRole(who,a,"CAN_ASSIGN_CO_ORGANIZER"),
        canAssignVerifier:canAssignActivityRole(who,a,"CAN_ASSIGN_VERIFIER")
      }};
    }

    m = p.match(/^\/api\/activities\/([^/]+)\/assignments$/);
    if(m && method==="PUT"){
      const a=activity(decodeURIComponent(m[1])); if(!a) err("ACTIVITY_NOT_FOUND",404);
      const hasCo=Array.isArray(b.coOrganizerIds), hasVerifier=Array.isArray(b.verifierIds);
      if(!hasCo&&!hasVerifier) err("ASSIGNMENT_LIST_REQUIRED",400);
      if(hasCo&&!canAssignActivityRole(who,a,"CAN_ASSIGN_CO_ORGANIZER")) err("CO_ORGANIZER_ASSIGNMENT_FORBIDDEN",403);
      if(hasVerifier&&!canAssignActivityRole(who,a,"CAN_ASSIGN_VERIFIER")) err("VERIFIER_ASSIGNMENT_FORBIDDEN",403);

      const resolveIds=(refs)=>[...new Set(refs.map(String))].map(ref=>{
        const u=actor(ref); if(!u||u.status!=="ACTIVE") err("ASSIGNEE_NOT_FOUND_OR_INACTIVE",400); return u;
      });
      const before=(a.roleAssignments||[]).map(x=>({...x}));
      let next=[...(a.roleAssignments||[])];
      if(hasCo){
        const users=resolveIds(b.coOrganizerIds);
        if(users.some(u=>u.id===a.organizerId)) err("PRIMARY_ORGANIZER_CANNOT_BE_CO_ORGANIZER",409);
        next=next.filter(x=>x.role!=="CO_ORGANIZER");
        next.push(...users.map(u=>({id:uid("DEMO-ASG"),userId:u.id,role:"CO_ORGANIZER",assignedById:who.id,assignedAt:iso()})));
      }
      if(hasVerifier){
        const users=resolveIds(b.verifierIds);
        next=next.filter(x=>x.role!=="VERIFIER");
        next.push(...users.map(u=>({id:uid("DEMO-ASG"),userId:u.id,role:"VERIFIER",assignedById:who.id,assignedAt:iso()})));
      }
      a.roleAssignments=next;save();
      audit(who.id,"ACTIVITY_ASSIGNMENTS_UPDATED","Activity",a.id,{demo:true,before,after:next});
      return {ok:true,assignments:activityPublic(a).roleAssignments};
    }

    m = p.match(/^\/api\/activities\/([^/]+)\/participants$/);
    if(m && method==="PUT"){
      const a=activity(decodeURIComponent(m[1])); if(!a) err("ACTIVITY_NOT_FOUND",404);
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
      const exp = new Date(Date.now()+45000);
      a.qr = {token:"DEMO|"+a.id+"|"+Date.now()+"|"+Math.random().toString(36).slice(2),issuedAt:iso(),expiresAt:exp.toISOString()};
      audit(who.id,"QR_ISSUED","Activity",a.id,{demo:true,expiresAt:a.qr.expiresAt}); save();
      return {ok:true,...a.qr,demo:true};
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
      const r = {id:uid("DEMO-ATT"),activityId:a.id,userId:u.id,checkinAt:iso(),checkoutAt:null,
        attendanceStatus:"CHECKED_IN",qrValid:true,identityVerified:true,signatureVerified:false,
        scanAttempts:1,staffVerification:null,consistencyResult:null,finalEvidenceStatus:null};
      state.attendance.unshift(r); audit(who.id,"CHECKIN","AttendanceRecord",r.id,{demo:true}); save();
      return {ok:true,attendance:hydrateAttendance(r)};
    }

    m = p.match(/^\/api\/attendance\/([^/]+)\/checkout$/);
    if (m && method==="POST") {
      const r=attendance(decodeURIComponent(m[1])); if(!r) err("ATTENDANCE_NOT_FOUND",404);
      if(r.isVoided) err("ATTENDANCE_VOIDED",409);
      if(who.role==="PARTICIPANT"&&r.userId!==who.id) err("PARTICIPANT_CAN_ONLY_CHECKOUT_SELF",403);
      if(r.checkoutAt) err("ALREADY_CHECKED_OUT",409);
      const previousFinal=r.finalEvidenceStatus||null;
      r.checkoutAt=iso(); r.attendanceStatus="CHECKED_OUT"; r.finalEvidenceStatus=null; save();
      if(previousFinal) audit(who.id,"FINAL_DECISION_INVALIDATED","AttendanceRecord",r.id,{demo:true,previousFinal,reason:"CHECKOUT_CHANGED"});
      audit(who.id,"CHECKOUT","AttendanceRecord",r.id,{demo:true});
      return {ok:true,attendance:hydrateAttendance(r)};
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
        if(reason.length<10) err("OVERRIDE_REASON_REQUIRED",400);
      }
      if(["CORRECT","REQUEST_EVIDENCE","REJECT"].includes(b.decision) && reason.length<3) err("REVIEW_REASON_REQUIRED",400);
      const review={id:uid("DEMO-RV"),attendanceId:r.id,reviewerId:who.id,decision:b.decision,reason,
        reviewStartedAt:b.reviewStartedAt||null,reviewedAt:iso(),reviewDurationSeconds:b.reviewDurationSeconds||null,
        override:b.decision==="OVERRIDE_VERIFY",blockersAtDecision:blockers};
      state.reviews.push(review);
      r.finalEvidenceStatus=b.decision==="VERIFY"?"VERIFIED":b.decision==="OVERRIDE_VERIFY"?"OVERRIDE_VERIFIED":b.decision==="REJECT"?"REJECTED":"REVIEW_REQUIRED";
      save(); audit(who.id,b.decision==="OVERRIDE_VERIFY"?"MANUAL_OVERRIDE_VERIFIED":"HUMAN_REVIEW","AttendanceRecord",r.id,{demo:true,decision:b.decision,reason,blockers});
      return {ok:true,review,finalEvidenceStatus:r.finalEvidenceStatus,systemEvidenceStatus:r.consistencyResult.status};
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
      const records=model?state.predictions.filter(x=>x.modelVersion===model.version).map(pr=>({...pr,attendance:hydrateAttendance(attendance(pr.attendanceId))})):[];
      return {ok:true,deployedModel:model,decisionSupportOnly:true,syntheticDemo:true,records};
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