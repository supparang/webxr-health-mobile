(function () {
  "use strict";

  const SESSION_KEY = "activa_ai_v034_session";
  const MODE_KEY = "activa_ai_mode";
  const NAV_GROUP_KEY = "activa_ai_nav_groups";
  const SELECTED_ACTIVITY_KEY = "activa_ai_selected_activity";
  let appMode = sessionStorage.getItem(MODE_KEY) || "server";
  let session = readSession();
  let activeView = "dashboard";
  let qrTimer = null;
  let qrState = null;

  const ACTIVITY_PERMISSION_DEFS = [
    ["CAN_CREATE_ACTIVITY","สร้างกิจกรรม","สร้างกิจกรรมใหม่และเป็นผู้จัดกิจกรรมหลักของกิจกรรมที่สร้าง"],
    ["CAN_EDIT_OWN_ACTIVITY","จัดการกิจกรรมของตน","แก้ไข/ดำเนินงานกิจกรรมที่ตนเป็นผู้จัดกิจกรรมหลัก"],
    ["CAN_ASSIGN_CO_ORGANIZER","เพิ่มผู้จัดร่วม","มอบหมายผู้จัดกิจกรรมร่วม"],
    ["CAN_ASSIGN_VERIFIER","มอบหมายผู้ตรวจสอบ","เลือกผู้ตรวจสอบหลักฐานของกิจกรรม"],
    ["CAN_CLOSE_ACTIVITY","ปิดกิจกรรม","ปิดกิจกรรมเมื่อดำเนินงานเสร็จ"],
    ["CAN_MANAGE_ALL_ACTIVITIES","จัดการกิจกรรมทั้งหมด","สิทธิ์ระดับสูงสำหรับจัดการกิจกรรมทุกกิจกรรม"]
  ];

  const app = () => document.getElementById("app");
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
  const fmt = (dt) => !dt ? "—" : new Date(dt).toLocaleString("th-TH", { dateStyle:"short", timeStyle:"short" });
  const roleLabel = (r) => ({
    ADMIN:"ผู้ดูแลระบบ",
    ORGANIZER:"บุคลากรที่ได้รับสิทธิ์จัดกิจกรรม",
    STAFF:"ผู้ตรวจสอบหลักฐาน",
    PARTICIPANT:"บุคลากรผู้เข้าร่วมกิจกรรม"
  })[r] || r;
  const can = (...roles) => session && roles.includes(session.role);

  function activityPermissionKeys(user = session) {
    if (!user) return [];
    if (user.role === "ADMIN") return ACTIVITY_PERMISSION_DEFS.map(([key])=>key);
    return (user.activityPermissions || []).map(p => typeof p === "string" ? p : p.permission).filter(Boolean);
  }

  function hasActivityPermission(key, user = session) {
    return activityPermissionKeys(user).includes(key);
  }

  function canManageActivities(user = session) {
    return user?.role === "ADMIN" ||
      activityPermissionKeys(user).length > 0 ||
      (user?.activityAssignments || []).some(x=>x.role==="CO_ORGANIZER");
  }

  function canManageActivityClient(activity) {
    if (can("ADMIN") || hasActivityPermission("CAN_MANAGE_ALL_ACTIVITIES")) return true;
    if (activity?.organizerId === session?.id &&
      (hasActivityPermission("CAN_EDIT_OWN_ACTIVITY") || hasActivityPermission("CAN_CREATE_ACTIVITY"))) return true;
    return (activity?.roleAssignments || []).some(x=>x.role==="CO_ORGANIZER"&&x.userId===session?.id);
  }

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  }

  function saveSession() {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  }

  async function api(path, options = {}, actorOverride = null) {
    const actor = actorOverride || session?.employeeId;
    if (appMode === "demo") {
      if (!window.ACTIVA_DEMO_API) throw new Error("DEMO_API_NOT_LOADED");
      return window.ACTIVA_DEMO_API.request(path, options, actor);
    }

    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    if (actor) headers.set("x-activa-user-id", actor);

    const response = await fetch(path, { ...options, headers });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const err = new Error(data.error || ("HTTP_" + response.status));
      err.status = response.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function setMode(mode) {
    appMode = mode;
    sessionStorage.setItem(MODE_KEY, mode);
  }

  function setView(view) {
    activeView = view;
    render();
  }

  function viewTitle() {
    return ({
      dashboard:"ภาพรวม",
      myqr:"QR ประจำตัวของฉัน",
      users:"บุคลากร / ผู้ใช้งาน",
      activities:"กิจกรรมและนโยบายหลักฐาน",
      qr:"Dynamic QR",
      attendance:"Check-in / Check-out",
      evidence:"Evidence Matrix",
      review:"Human Review",
      groundtruth:"Ground Truth",
      readiness:"AI Readiness",
      models:"Model Evaluation",
      xai:"AI/XAI Review",
      audit:"Audit Trail",
      analytics:"Verified Analytics",
      operations:"Pilot Readiness",
      research:"Research Export"
    })[activeView] || "ACTIVA-AI";
  }

  function navGroups() {
    const groups = [];

    const work = [["dashboard","ภาพรวม"],["myqr","QR ประจำตัวของฉัน"]];
    if (can("ADMIN")) work.push(["users","บุคลากร"]);
    if (canManageActivities()) work.push(["activities","กิจกรรม"]);
    if (can("ADMIN") || hasActivityPermission("CAN_CREATE_ACTIVITY") || hasActivityPermission("CAN_EDIT_OWN_ACTIVITY") || hasActivityPermission("CAN_MANAGE_ALL_ACTIVITIES")) work.push(["qr","Dynamic QR"]);
    work.push(["attendance","เข้า–ออก"]);
    groups.push({key:"work",label:"งานประจำ",items:work});

    const verify = [["evidence","หลักฐาน"]];
    if (can("ADMIN","STAFF")) verify.push(["review","ตรวจสอบโดยมนุษย์"]);
    if (can("ADMIN")) verify.push(["audit","Audit Trail"]);
    if (can("ADMIN","STAFF")) verify.push(["analytics","Verified Analytics"],["operations","Pilot Readiness"]);
    groups.push({key:"verification",label:"การตรวจสอบ",items:verify});

    const research = [];
    if (can("ADMIN","STAFF")) research.push(["groundtruth","Ground Truth"]);
    if (can("ADMIN")) research.push(["readiness","AI Readiness"],["models","Model Evaluation"]);
    if (can("ADMIN","STAFF")) research.push(["xai","AI/XAI Review"]);
    if (can("ADMIN")) research.push(["research","ข้อมูลวิจัย"]);
    if (research.length) groups.push({key:"research",label:"งานวิจัยและ AI",items:research});

    groups.push({key:"system",label:"ระบบ",items:[]});
    return groups;
  }

  function readNavGroupState() {
    try {
      const raw = JSON.parse(sessionStorage.getItem(NAV_GROUP_KEY) || "{}");
      return raw && typeof raw === "object" ? raw : {};
    } catch {
      return {};
    }
  }

  function writeNavGroupState(state) {
    sessionStorage.setItem(NAV_GROUP_KEY, JSON.stringify(state));
  }

  function groupHasActive(group) {
    return group.items.some(([key]) => key === activeView);
  }

  function shouldOpenNavGroup(group, storedState) {
    if (groupHasActive(group)) return true;
    if (Object.prototype.hasOwnProperty.call(storedState, group.key)) return Boolean(storedState[group.key]);

    const compact = window.matchMedia && window.matchMedia("(max-width: 1000px)").matches;
    if (!compact) return true;
    return group.key === "work";
  }

  function navGroupHtml(group, storedState) {
    const open = shouldOpenNavGroup(group, storedState);
    const active = groupHasActive(group);
    const items = group.items.map(([key,label]) =>
      '<button data-view="'+key+'" class="nav-item '+(activeView===key?"active":"")+'">'+label+'</button>'
    ).join("");

    const systemItems = group.key === "system"
      ? '<button id="logout" class="nav-item nav-logout">ออกจากระบบ</button>'
      : items;

    return '<section class="nav-group '+(active?"has-active":"")+'" data-nav-group="'+group.key+'">'+
      '<button type="button" class="nav-group-toggle" data-nav-toggle="'+group.key+'" aria-expanded="'+(open?"true":"false")+'">'+
        '<span>'+esc(group.label)+'</span><span class="nav-chevron" aria-hidden="true">⌄</span>'+
      '</button>'+
      '<div class="nav-group-items" data-nav-items="'+group.key+'" '+(open?"":"hidden")+'>'+systemItems+'</div>'+
    '</section>';
  }

  function shell() {
    const storedState = readNavGroupState();
    const nav = navGroups().map(group => navGroupHtml(group, storedState)).join("");

    return '<div class="shell">'+
      '<aside class="sidebar">'+
        '<div class="brand">ACTIVA-AI<small>Trusted Participation Verification</small></div>'+
        '<nav class="nav" aria-label="เมนูหลัก">'+nav+'</nav>'+
        '<div class="version">V0.9.0 • Pilot Readiness + Operational Monitoring</div>'+
      '</aside>'+
      '<main class="main">'+
        '<div class="topbar"><div><div class="kicker">ACTIVA-AI • RESEARCH PROTOTYPE</div><h1>'+viewTitle()+'</h1></div>'+
        '<div class="top-actions"><span id="conn" class="badge">กำลังเชื่อมต่อ…</span><span class="badge">'+esc(session.name)+' • '+roleLabel(session.role)+'</span></div></div>'+
        '<div id="view"></div>'+
      '</main></div>';
  }

  function showLoading(v, text) {
    v.innerHTML = '<div class="panel"><div class="loading">'+esc(text || "กำลังโหลดข้อมูล…")+'</div></div>';
  }

  function errorBox(error) {
    const hint = appMode === "demo"
      ? "กำลังใช้ Demo Mode; ข้อมูลทั้งหมดเป็นข้อมูลจำลองในเบราว์เซอร์"
      : "ตรวจว่า PostgreSQL และ ACTIVA-AI server กำลังทำงานอยู่";
    return '<div class="alert bad"><b>เกิดข้อผิดพลาด:</b> '+esc(error?.message || error)+
      '<br><span class="muted">'+esc(hint)+'</span></div>';
  }

  async function render() {
    clearInterval(qrTimer);
    qrTimer = null;
    if (!session) return renderLogin();

    app().innerHTML = shell();
    document.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => setView(b.dataset.view));

    document.querySelectorAll("[data-nav-toggle]").forEach((toggle) => {
      toggle.onclick = () => {
        const key = toggle.dataset.navToggle;
        const items = document.querySelector('[data-nav-items="'+key+'"]');
        if (!items) return;

        const nextOpen = items.hasAttribute("hidden");
        if (nextOpen) items.removeAttribute("hidden");
        else items.setAttribute("hidden","");

        toggle.setAttribute("aria-expanded", nextOpen ? "true" : "false");
        const state = readNavGroupState();
        state[key] = nextOpen;
        writeNavGroupState(state);
      };
    });

    document.getElementById("logout").onclick = () => {
      session = null;
      saveSession();
      activeView = "dashboard";
      render();
    };

    const conn = document.getElementById("conn");
    if (appMode === "demo") {
      conn.textContent = "DEMO • ไม่ใช้ PostgreSQL";
      conn.className = "badge demo";
    } else {
      api("/api/health", {}, session.employeeId)
        .then((d) => { conn.textContent = d.database === "connected" ? "PostgreSQL พร้อม" : "ฐานข้อมูลมีปัญหา"; conn.className = "badge"; })
        .catch(() => { conn.textContent = "Server/DB ออฟไลน์"; conn.className = "badge danger"; });
    }

    const v = document.getElementById("view");
    try {
      if (activeView === "dashboard") await renderDashboard(v);
      else if (activeView === "myqr") await renderPersonalQr(v);
      else if (activeView === "users") await renderUsersAdmin(v);
      else if (activeView === "activities") await renderActivities(v);
      else if (activeView === "qr") await renderQr(v);
      else if (activeView === "attendance") await renderAttendance(v);
      else if (activeView === "evidence") await renderEvidence(v);
      else if (activeView === "review") await renderReview(v);
      else if (activeView === "groundtruth") await renderGroundTruth(v);
      else if (activeView === "readiness") await renderReadiness(v);
      else if (activeView === "models") await renderModels(v);
      else if (activeView === "xai") await renderXai(v);
      else if (activeView === "audit") await renderAudit(v);
      else if (activeView === "analytics") await renderVerifiedAnalytics(v);
      else if (activeView === "operations") await renderPilotReadiness(v);
      else if (activeView === "research") await renderResearch(v);
    } catch (error) {
      v.innerHTML = '<div class="panel">'+errorBox(error)+'</div>';
    }
  }

  function renderLogin() {
    app().innerHTML =
      '<div class="login-wrap"><div class="login-card">'+
      '<div class="kicker">ACTIVA-AI V0.9.0</div><h1>เลือกโหมดใช้งาน</h1>'+
      '<p>ช่วงนี้ยังไม่ต้องเชื่อม PostgreSQL ก็สามารถทดลอง workflow ของ ACTIVA-AI ได้</p>'+
      '<div class="demo-box"><b>บัญชีทดลอง</b>'+
      '<div class="demo-account-list">'+
        '<div><b>ADM001</b><span>ผู้ดูแลระบบ</span></div>'+
        '<div><b>ORG001</b><span>บุคลากรตัวอย่าง • ได้รับสิทธิ์จัดกิจกรรม</span></div>'+
        '<div><b>STF001</b><span>ผู้ตรวจสอบหลักฐาน</span></div>'+
        '<div><b>P001</b><span>บุคลากรผู้เข้าร่วมกิจกรรม</span></div>'+
        '<div><b>T001–T010</b><span>บุคลากรทดลองสำหรับทดสอบหลายคน</span></div>'+
      '</div>'+
      '<div class="demo-note">หมายเหตุ: “ผู้จัดกิจกรรม” เป็นสิทธิ์ที่ ADMIN เพิ่ม/ลดให้บุคลากร ไม่ใช่ประเภทบุคลากรถาวร</div></div>'+
      '<div class="field"><label>รหัสบุคลากร</label><input id="loginId" value="ADM001"></div>'+
      '<div class="actions">'+
        '<button class="btn primary" id="demoLogin">เข้า Demo Mode</button>'+
        '<button class="btn secondary" id="serverLogin">เข้า Server Mode</button>'+
      '</div>'+
      '<div class="hint"><b>Demo Mode:</b> ไม่ต้องใช้ PostgreSQL ข้อมูลเก็บใน browser และเป็นข้อมูลสาธิต/สังเคราะห์เท่านั้น<br><b>Server Mode:</b> ใช้ API + PostgreSQL ตามสถาปัตยกรรมจริง</div>'+
      '<div class="actions"><button class="btn warn" id="resetDemo">ล้างข้อมูล Demo</button></div>'+
      '<div id="loginMsg"></div></div></div>';

    async function login(mode) {
      const id = document.getElementById("loginId").value.trim().toUpperCase();
      const msg = document.getElementById("loginMsg");
      if (!id) return msg.innerHTML = '<div class="alert bad">กรุณาระบุรหัสบุคลากร</div>';
      setMode(mode);
      msg.innerHTML = '<div class="alert">กำลังเข้าสู่ '+(mode==="demo"?"Demo Mode":"Server Mode")+'…</div>';
      try {
        const data = await api("/api/me", {}, id);
        session = data.user;
        saveSession();
        activeView = "dashboard";
        render();
      } catch (error) {
        if (mode === "demo" && error?.message === "DEMO_USER_NOT_FOUND") {
          msg.innerHTML =
            '<div class="alert bad"><b>ไม่พบรหัส '+esc(id)+' ในบัญชี Demo</b><br>'+
            'ใช้ ADM001, ORG001, STF001, P001–P003 หรือ T001–T010 ได้ทันที</div>';
        } else {
          msg.innerHTML = errorBox(error);
        }
      }
    }

    document.getElementById("demoLogin").onclick = () => login("demo");
    document.getElementById("serverLogin").onclick = () => login("server");
    document.getElementById("resetDemo").onclick = () => {
      if (window.ACTIVA_DEMO_API) window.ACTIVA_DEMO_API.reset();
      document.getElementById("loginMsg").innerHTML = '<div class="alert ok">ล้างข้อมูล Demo แล้ว</div>';
    };
  }

  function card(label, value) {
    return '<div class="card"><div class="label">'+esc(label)+'</div><div class="n">'+esc(value)+'</div></div>';
  }

  async function renderPersonalQr(v) {
    showLoading(v);
    const data=await api("/api/personal-qr/me");
    v.innerHTML=
      '<div class="panel personal-qr-panel"><div class="section-head"><div><h2>QR ประจำตัวของฉัน</h2>'+
      '<p class="muted">ใช้เพื่อระบุตัวบุคคลและเรียก record เมื่อต้องตรวจสอบ ไม่ใช่การรับรองผล Human Review อัตโนมัติ</p></div></div>'+
      '<div class="personal-qr-layout"><div id="personalQrCode" class="qr personal-qr"></div><div>'+
      '<p><b>'+esc(session.employeeId+" • "+session.name)+'</b></p>'+
      '<p class="muted">ใช้ QR นี้ข้ามกิจกรรมได้ ตราบใดที่บัญชียัง Active และ QR ยังไม่ถูกออกใหม่</p>'+
      '<div class="token">'+esc(data.token)+'</div>'+
      '<div class="actions"><button class="btn warn" id="reissuePersonalQr">ออก Personal QR ใหม่</button></div>'+
      '<div class="hint">'+(appMode==="demo"
        ? '<b>Demo Mode:</b> ใช้ token สาธิตใน browser ไม่ใช่ลายมือชื่อ production'
        : '<b>Server Mode:</b> QR ใช้ signed opaque credential และไม่บรรจุชื่อ/รหัสบุคลากรโดยตรง')+
      '<br>หาก QR รั่วหรือสงสัยว่าถูกคัดลอก ให้กดออก QR ใหม่ ซึ่งจะยกเลิก credential เดิม</div></div></div></div>';
    if(window.QRCode)new QRCode(document.getElementById("personalQrCode"),{
      text:data.token,width:260,height:260,correctLevel:QRCode.CorrectLevel.M
    });
    document.getElementById("reissuePersonalQr").onclick=async()=>{
      if(!confirm("ออก Personal QR ใหม่? QR เดิมจะใช้ไม่ได้อีก"))return;
      try{
        await api("/api/personal-qr/reissue",{method:"POST"});
        await renderPersonalQr(v);
      }catch(e){v.insertAdjacentHTML("afterbegin",errorBox(e));}
    };
  }

  async function renderDashboard(v) {
    showLoading(v);
    const data = await api("/api/dashboard/summary");
    const s = data.summary;
    const scopeText = data.scope === "SELF" ? "ข้อมูลของฉัน" : "ภาพรวมหน่วยงาน";
    v.innerHTML =
      '<div class="grid cards">'+
      card("กิจกรรม", s.activityCount)+
      card("รายการเข้าร่วม", s.recordCount)+
      card("รับรองแล้ว", s.verifiedCount)+
      card("Manual Override", s.overrideVerifiedCount || 0)+
      card("ต้องตรวจสอบ", s.reviewRequiredCount)+
      card("หลักฐานไม่ครบ", s.incompleteCount)+
      '</div>'+
      (appMode==="demo"?'<div class="alert warn"><b>DEMO / SYNTHETIC DATA</b> — ใช้ทดลองระบบเท่านั้น ห้ามนำไปอ้างเป็นผลวิจัยจริง<br>V0.5.3 ใช้คำเรียกบทบาทให้สอดคล้องกับ permission model โดย “สิทธิ์จัดกิจกรรม” ไม่ใช่ประเภทบุคลากรถาวร</div>':'')+
      '<div class="panel"><h2>เส้นทางการตรวจสอบ</h2>'+
      '<span class="status s-info">'+scopeText+'</span>'+
      '<div class="hint">Dynamic QR → ยืนยันตัวตน → Check-in → Check-out/ระยะเวลา → เจ้าหน้าที่ยืนยัน → ตรวจความสอดคล้อง → Human Review → Verified Participation</div>'+
      '<p class="muted">ผลจาก Evidence Engine ในระยะนี้เป็นกฎตรวจสอบ (rule-based) ไม่ใช่ค่าความน่าจะเป็นจาก AI</p></div>';
  }

  function analyticsPct(value) {
    if (value === null || value === undefined || value === "") return "—";
    const n=Number(value);
    return Number.isFinite(n) ? (n*100).toFixed(1)+"%" : "—";
  }

  function analyticsNumber(value, digits=1) {
    if (value === null || value === undefined || value === "") return "—";
    const n=Number(value);
    return Number.isFinite(n) ? n.toFixed(digits) : "—";
  }

  async function renderVerifiedAnalytics(v) {
    if (!can("ADMIN","STAFF")) throw new Error("FORBIDDEN");
    showLoading(v);
    const data=await api("/api/analytics/verified");
    const o=data.operational||{};
    const research=data.researchSnapshot||{};
    const byActivity=o.byActivity||[];
    const patterns=o.exceptionPatterns||[];
    const cm=research.confusionMatrix||{tp:0,fp:0,tn:0,fn:0};

    const activityRows=byActivity.length
      ? byActivity.map(x=>'<tr>'+
          '<td><b>'+esc(x.title||x.activityId)+'</b><br><span class="muted">'+esc(x.category||"")+'</span></td>'+
          '<td>'+esc(x.recordCount)+'</td>'+
          '<td>'+esc(x.finalizedCount)+'</td>'+
          '<td>'+esc(x.verifiedCount)+'</td>'+
          '<td>'+esc(x.rejectedCount)+'</td>'+
          '<td>'+esc(x.unresolvedCount)+'</td>'+
          '<td>'+analyticsPct(x.finalizationRate)+'</td>'+
          '<td>'+analyticsPct(x.verifiedOutcomeRate)+'</td>'+
        '</tr>').join("")
      : '<tr><td colspan="8">ยังไม่มีข้อมูลกิจกรรม</td></tr>';

    const patternRows=patterns.length
      ? patterns.slice(0,12).map(x=>'<tr><td>'+esc(auditReasonLabel(x.code))+'<div class="audit-code">'+esc(x.code)+'</div></td><td><b>'+esc(x.count)+'</b></td></tr>').join("")
      : '<tr><td colspan="2">ยังไม่มี exception ในรายการที่ผ่าน Human Decision</td></tr>';

    v.innerHTML=
      (data.syntheticDemo?'<div class="alert warn"><b>DEMO / SYNTHETIC DATA</b> — ตัวเลขหน้านี้ใช้ทดสอบ workflow เท่านั้น ไม่ใช่ผลการดำเนินงานจริง</div>':'')+
      '<div class="panel"><div class="section-head"><div><h2>Verified Analytics & Management Dashboard</h2>'+
      '<p class="muted">Outcome metrics ใช้เฉพาะรายการที่ผ่าน Human Decision แล้ว ส่วน unresolved แสดงเพื่อบริหารคิวงานเท่านั้น • API นี้ส่งข้อมูล aggregate และไม่ส่งชื่อ/รหัสบุคลากร</p></div>'+
      '<span class="badge">'+(data.containsPII?'PII PRESENT':'NO PII')+'</span></div>'+
      '<div class="grid cards">'+
        card("รายการทั้งหมด",o.recordCount||0)+
        card("ผ่าน Human Decision",o.finalizedCount||0)+
        card("ค้างตรวจ",o.unresolvedCount||0)+
        card("รับรองแล้ว",o.verifiedCount||0)+
        card("ไม่รับรอง",o.rejectedCount||0)+
        card("Manual Override",o.overrideVerifiedCount||0)+
      '</div>'+
      '<div class="grid cards">'+
        card("Finalization Rate",analyticsPct(o.finalizationRate))+
        card("Verified Outcome Rate",analyticsPct(o.verifiedOutcomeRate))+
        card("เวลา Review เฉลี่ย",o.averageReviewDurationSeconds==null?"—":analyticsNumber(o.averageReviewDurationSeconds,0)+" วินาที")+
        card("เวลาถึงผลตัดสินเฉลี่ย",o.averageResolutionHours==null?"—":analyticsNumber(o.averageResolutionHours,2)+" ชม.")+
      '</div>'+
      '<div class="hint"><b>นิยาม Turnaround:</b> จากเวลาสร้าง attendance record ถึง Human Review ล่าสุดที่ให้ผลสุดท้าย การวัดนี้ยังไม่ใช่ SLA ตั้งแต่ “เข้าคิว Review” เพราะระบบยังไม่มี queuedAt แยกเฉพาะ</div></div>'+
      '<div class="panel"><h2>เปรียบเทียบตามกิจกรรม</h2>'+
      '<div class="table-wrap"><table><thead><tr><th>กิจกรรม</th><th>ทั้งหมด</th><th>ตัดสินแล้ว</th><th>รับรอง</th><th>ไม่รับรอง</th><th>ค้าง</th><th>Finalization</th><th>Verified Outcome</th></tr></thead><tbody>'+activityRows+'</tbody></table></div>'+
      '<p class="muted">Verified Outcome Rate ใช้ตัวหารเฉพาะ case ที่ผ่าน Human Decision แล้ว จึงไม่เอา case ค้างตรวจมาปะปนกับผลลัพธ์สุดท้าย</p></div>'+
      '<div class="split"><div class="panel"><h2>Exception Patterns หลัง Human Decision</h2>'+
      '<div class="table-wrap"><table><thead><tr><th>สาเหตุจาก Evidence Engine</th><th>จำนวน case</th></tr></thead><tbody>'+patternRows+'</tbody></table></div>'+
      '</div><div class="panel"><h2>Research Snapshot — แยกจาก Operational</h2>'+
      '<div class="hint"><b>ไม่ใช่คะแนนบุคลากร:</b> ส่วนนี้ใช้ตรวจคุณภาพกระบวนการวิจัยและโมเดลเท่านั้น</div>'+
      '<div class="analytics-kv">'+
        '<p><b>Deployed model:</b> '+esc(research.deployedModel?.version||"ยังไม่มี")+'</p>'+
        '<p><b>Locked Ground Truth:</b> '+esc(research.lockedGroundTruthCount||0)+'</p>'+
        '<p><b>Model ↔ Ground Truth comparable:</b> '+esc(research.comparableModelGroundTruthCount||0)+'</p>'+
        '<p><b>Agreement:</b> '+analyticsPct(research.modelGroundTruthAgreementRate)+'</p>'+
        '<p><b>Double-labeled cases:</b> '+esc(research.doubleLabeledCaseCount||0)+'</p>'+
        '<p><b>Reviewer agreement:</b> '+analyticsPct(research.reviewerAgreementRate)+'</p>'+
      '</div>'+
      '<div class="table-wrap"><table><thead><tr><th>TP</th><th>FP</th><th>TN</th><th>FN</th></tr></thead><tbody><tr><td>'+esc(cm.tp||0)+'</td><td>'+esc(cm.fp||0)+'</td><td>'+esc(cm.tn||0)+'</td><td>'+esc(cm.fn||0)+'</td></tr></tbody></table></div>'+
      '<p class="muted">Positive class = REVIEW_REQUIRED • การเปรียบเทียบใช้ deployed-model prediction กับ locked ground truth เท่านั้น</p></div></div>';
  }


  function pilotStatusBadge(status) {
    const cls=status==="READY"?"s-ok":status==="WATCH"?"s-warn":"s-bad";
    const label=status==="READY"?"พร้อมทดลองใช้":status==="WATCH"?"พร้อมแบบมีจุดต้องเฝ้าระวัง":"ยังไม่ควรเปิด Pilot";
    return '<span class="status '+cls+'">'+label+'</span>';
  }

  function pilotAlertLabel(code) {
    return ({
      DUPLICATE_NONVOID_ATTENDANCE:"พบ attendance ซ้ำในกิจกรรมเดียวกัน",
      CHECKOUT_BEFORE_CHECKIN:"เวลา Check-out อยู่ก่อน Check-in",
      FINAL_STATUS_WITHOUT_HUMAN_REVIEW:"มีผลสุดท้ายแต่ไม่พบ Human Review",
      NORMAL_VERIFY_WITH_SYSTEM_BLOCKERS:"รับรองปกติทั้งที่ Evidence Engine ยังมี blocker",
      HUMAN_REVIEW_REASON_MISSING:"Human Review เดิมไม่มีเหตุผลที่เพียงพอ",
      ENDED_ACTIVITY_RECORD_NOT_EVALUATED:"กิจกรรมจบแล้วแต่มี record ยังไม่ประเมินหลักฐาน"
    })[code]||code;
  }

  function pilotChecklistLabel(key) {
    return ({
      ACTIVITY_ENDED:"กิจกรรมสิ้นสุดแล้ว",
      ALL_RECORDS_EVALUATED:"ประเมินหลักฐานครบทุก record",
      NO_UNRESOLVED_HUMAN_REVIEW:"ไม่มี case ค้าง Human Review",
      NO_CRITICAL_DATA_QUALITY:"ไม่มีปัญหา Data Quality ระดับวิกฤต"
    })[key]||key;
  }

  async function renderPilotReadiness(v) {
    if(!can("ADMIN","STAFF")) throw new Error("FORBIDDEN");
    showLoading(v);
    const data=await api("/api/operations/pilot-readiness");
    const review=data.reviewMonitoring||{};
    const dq=data.dataQuality||{};
    const closing=data.activityClosing||{};
    const governance=data.governance||{};
    const aging=review.aging||{};
    const alerts=dq.alerts||[];
    const activities=closing.activities||[];

    const alertRows=alerts.length
      ? alerts.map(x=>'<tr><td>'+esc(x.severity)+'</td><td>'+esc(pilotAlertLabel(x.code))+'<div class="audit-code">'+esc(x.code)+'</div></td><td><b>'+esc(x.count)+'</b></td></tr>').join("")
      : '<tr><td colspan="3">ไม่พบ Data Quality alert จากกฎ V0.9</td></tr>';

    const activityRows=activities.length
      ? activities.map(a=>{
          const checks=(a.checklist||[]).map(x=>
            '<span class="status '+(x.passed?"s-ok":"s-warn")+'">'+(x.passed?"✓ ":"• ")+esc(pilotChecklistLabel(x.key))+'</span>'
          ).join(" ");
          return '<tr>'+
            '<td><b>'+esc(a.title||a.activityId)+'</b><br><span class="muted">'+esc(a.category||"")+'</span></td>'+
            '<td>'+esc(a.recordCount||0)+'</td>'+
            '<td>'+esc(a.unevaluatedCount||0)+'</td>'+
            '<td>'+esc(a.unresolvedCount||0)+'</td>'+
            '<td>'+esc(a.criticalDataQualityCount||0)+'</td>'+
            '<td>'+(a.closeReady?'<span class="status s-ok">Close-ready</span>':'<span class="status s-warn">ยังไม่พร้อมปิด</span>')+'<div style="margin-top:6px">'+checks+'</div></td>'+
          '</tr>';
        }).join("")
      : '<tr><td colspan="6">ยังไม่มีกิจกรรมที่สิ้นสุดสำหรับตรวจ checklist</td></tr>';

    v.innerHTML=
      (data.syntheticDemo?'<div class="alert warn"><b>DEMO / SYNTHETIC DATA</b> — ใช้ตรวจ workflow เท่านั้น ไม่ใช่สถานะระบบจริง</div>':'')+
      '<div class="panel"><div class="section-head"><div><h2>Pilot Readiness & Operational Monitoring</h2>'+
      '<p class="muted">ใช้เพื่อตรวจความพร้อมของกระบวนการ ไม่ใช้เป็นคะแนนรายบุคคล และ endpoint นี้ส่งเฉพาะข้อมูล aggregate</p></div>'+
      '<div>'+pilotStatusBadge(data.pilotStatus)+'</div></div>'+
      '<div class="grid cards">'+
        card("Review backlog",review.backlogCount||0)+
        card("เกินเป้าหมาย "+esc(review.targetHours||24)+" ชม.",review.overTargetCount||0)+
        card("Critical data alerts",dq.criticalAlertCount||0)+
        card("Warning data alerts",dq.warningAlertCount||0)+
        card("กิจกรรม Close-ready",closing.closeReadyCount||0)+
        card("กิจกรรมยังปิดไม่ได้",closing.notCloseReadyCount||0)+
      '</div>'+
      '<div class="hint"><b>เกณฑ์ Pilot:</b> CRITICAL data-quality issue → BLOCKED • backlog เกิน target / warning / กิจกรรมจบแล้วยังปิดไม่ได้ → WATCH • ไม่มีเงื่อนไขดังกล่าว → READY<br>'+
      '<b>Review target:</b> '+esc(review.targetHours||24)+' ชั่วโมง เป็นเป้าหมายการติดตามเชิงปฏิบัติการ ไม่ใช่ performance score ของผู้ตรวจ</div></div>'+

      '<div class="split"><div class="panel"><h2>Review Backlog Aging</h2>'+
      '<div class="grid cards">'+
        card("< 4 ชม.",aging.under4h||0)+
        card("4–24 ชม.",aging.h4to24||0)+
        card("24–48 ชม.",aging.h24to48||0)+
        card("≥ 48 ชม.",aging.over48h||0)+
      '</div>'+
      '<p><b>Oldest backlog:</b> '+(review.oldestBacklogHours==null?"—":analyticsNumber(review.oldestBacklogHours,1)+" ชม.")+'</p>'+
      '<p class="muted">Queue age เริ่มจาก Evidence Evaluation; หากกิจกรรมจบแล้วยังไม่ประเมิน จะเริ่มนับจากเวลาสิ้นสุดกิจกรรม</p></div>'+
      '<div class="panel"><h2>Governance Gate</h2>'+
      '<p>'+statusBadge(governance.humanFinalDecisionRequired?"VERIFIED":"REVIEW_REQUIRED")+' Human final decision required</p>'+
      '<p>'+statusBadge(governance.aiAutonomousDecision?"REVIEW_REQUIRED":"VERIFIED")+' AI autonomous decision = '+esc(String(Boolean(governance.aiAutonomousDecision)))+'</p>'+
      '<p>'+statusBadge(governance.groundTruthBlindedFromAiDuringLabeling?"VERIFIED":"REVIEW_REQUIRED")+' Ground Truth blinded from AI</p>'+
      '<p>'+statusBadge(governance.analyticsAggregateOnly?"VERIFIED":"REVIEW_REQUIRED")+' Aggregate analytics only</p>'+
      '<p><b>Deployed model:</b> '+esc(governance.deployedModel?.version||"ไม่มี — Pilot ยังทำงานได้โดยไม่ใช้ AI")+'</p>'+
      '<p class="muted">AI ไม่ใช่ prerequisite ของ Pilot เพราะแกนหลักคือ Evidence + Human Review + Audit Trail</p></div></div>'+

      '<div class="panel"><h2>Data Quality Alerts</h2>'+
      '<div class="table-wrap"><table><thead><tr><th>ระดับ</th><th>รายการตรวจพบ</th><th>จำนวน</th></tr></thead><tbody>'+alertRows+'</tbody></table></div></div>'+

      '<div class="panel"><h2>Activity Closing Checklist</h2>'+
      '<div class="table-wrap"><table><thead><tr><th>กิจกรรม</th><th>Records</th><th>ยังไม่ Evaluate</th><th>ค้าง Review</th><th>Critical</th><th>Checklist</th></tr></thead><tbody>'+activityRows+'</tbody></table></div>'+
      '<p class="muted">V0.9 คำนวณ Close-ready เท่านั้น ยังไม่ lock/close activity จริง เพื่อป้องกันการเปลี่ยนสถานะถาวรก่อนผ่าน Pilot acceptance</p></div>';
  }

  function field(label,id,placeholder,type,value) {
    return '<div class="field"><label>'+esc(label)+'</label><input id="'+id+'" type="'+(type||"text")+'" placeholder="'+esc(placeholder||"")+'" value="'+esc(value||"")+'"></div>';
  }
  function check(id,label,on) {
    return '<label class="check"><input type="checkbox" id="'+id+'" '+(on?"checked":"")+'> '+esc(label)+'</label>';
  }
  const checked = (id) => document.getElementById(id).checked;

  async function loadActivities() {
    return (await api("/api/activities")).activities || [];
  }

  function policyText(p) {
    if (!p) return "ยังไม่กำหนด";
    const labels = [
      ["qrRequired","QR"],["identityRequired","ตัวตน"],["checkinRequired","เข้า"],
      ["checkoutRequired","ออก"],["durationRequired","ระยะเวลา"],["staffRequired","เจ้าหน้าที่"],
      ["signatureRequired","ลายเซ็น"]
    ];
    return labels.filter(([k]) => p[k]).map(([,l]) => l).join(", ");
  }


  function userStatusLabel(status) {
    return status === "ACTIVE" ? "ใช้งาน" : "ปิดใช้งาน";
  }

  function roleOptions(selected) {
    const roles = [
      ["PARTICIPANT","บุคลากรผู้เข้าร่วมกิจกรรม"],
      ["STAFF","ผู้ตรวจสอบหลักฐาน"],
      ["ORGANIZER","บุคลากรที่ได้รับสิทธิ์จัดกิจกรรม (Legacy Role)"],
      ["ADMIN","ผู้ดูแลระบบ"]
    ];
    return roles.map(([value,label]) =>
      '<option value="'+value+'" '+(value===selected?"selected":"")+'>'+label+'</option>'
    ).join("");
  }

  function parseCsvRows(text) {
    const rows=[]; let row=[]; let cell=""; let quoted=false;
    for(let i=0;i<text.length;i++){
      const ch=text[i], next=text[i+1];
      if(ch==='"'){
        if(quoted && next==='"'){cell+='"';i++;}
        else quoted=!quoted;
      } else if(ch==="," && !quoted){row.push(cell);cell="";}
      else if((ch==="\n" || ch==="\r") && !quoted){
        if(ch==="\r" && next==="\n") i++;
        row.push(cell);cell="";
        if(row.some(x=>String(x).trim()!=="")) rows.push(row);
        row=[];
      } else cell+=ch;
    }
    row.push(cell); if(row.some(x=>String(x).trim()!=="")) rows.push(row);
    return rows;
  }

  function normalizeUserCsv(text) {
    const rows=parseCsvRows(text);
    if(rows.length<2) throw new Error("CSV_NO_DATA");
    const norm=s=>String(s||"").trim().toLowerCase().replace(/\s+/g,"");
    const aliases={
      employeeId:["employeeid","employee_id","รหัสบุคลากร","รหัส"],
      name:["name","fullname","ชื่อ","ชื่อ-นามสกุล","ชื่อสกุล"],
      email:["email","อีเมล"],
      department:["department","departmentname","หน่วยงาน","สาขา"],
      role:["role","บทบาท"]
    };
    const header=rows[0].map(norm);
    const idx={};
    Object.entries(aliases).forEach(([key,names])=>{
      idx[key]=header.findIndex(h=>names.map(norm).includes(h));
    });
    if(idx.employeeId<0 || idx.name<0) throw new Error("CSV_REQUIRED_HEADERS");
    return rows.slice(1).map(r=>({
      employeeId:String(r[idx.employeeId]||"").trim().toUpperCase(),
      name:String(r[idx.name]||"").trim(),
      email:idx.email>=0?String(r[idx.email]||"").trim():"",
      department:idx.department>=0?String(r[idx.department]||"").trim():"",
      role:idx.role>=0?String(r[idx.role]||"PARTICIPANT").trim().toUpperCase():"PARTICIPANT"
    })).filter(r=>r.employeeId && r.name);
  }

  async function renderUsersAdmin(v) {
    if (!can("ADMIN")) throw new Error("FORBIDDEN");
    showLoading(v);
    const data=await api("/api/users");
    const users=data.users||[];
    const active=users.filter(u=>u.status==="ACTIVE").length;
    const participants=users.filter(u=>u.role==="PARTICIPANT"&&u.status==="ACTIVE").length;
    const staff=users.filter(u=>u.role==="STAFF"&&u.status==="ACTIVE").length;

    v.innerHTML=
      '<div class="panel"><div class="section-head"><div><h2>บุคลากร / ผู้ใช้งาน</h2>'+
      '<p class="muted">เฉพาะผู้ดูแลระบบเพิ่ม แก้ไข หรือปิดใช้งานบัญชีหลัก ส่วนสิทธิ์สร้าง/จัดกิจกรรมให้กำหนดแยกใน “สิทธิ์กิจกรรม” ของแต่ละบุคคล</p></div></div>'+
      '<div class="grid cards">'+card("ทั้งหมด",users.length)+card("ใช้งาน",active)+card("ผู้เข้าร่วม",participants)+card("เจ้าหน้าที่ตรวจสอบ",staff)+'</div></div>'+

      '<div class="split"><div class="panel"><h2>เพิ่มบุคลากรทีละคน</h2>'+
      '<div class="form-grid">'+
        field("รหัสบุคลากร","uEmp","เช่น 6612345")+
        field("ชื่อ–นามสกุล","uName","ชื่อผู้ใช้งาน")+
        field("อีเมล (ถ้ามี)","uEmail","name@university.ac.th","email")+
        field("หน่วยงาน / สาขา","uDept","เช่น เทคโนโลยีสารสนเทศ")+
        '<div class="field"><label>บทบาทระบบพื้นฐาน</label><select id="uRole">'+roleOptions("PARTICIPANT")+'</select><small class="muted">สิทธิ์จัดกิจกรรมกำหนดแยกจากบทบาทระบบ</small></div>'+
      '</div>'+
      '<div class="actions"><button class="btn primary" id="createUser">เพิ่มบุคลากร</button></div><div id="userMsg"></div></div>'+

      '<div class="panel"><h2>นำเข้าจาก CSV</h2>'+
      '<p class="muted">รองรับหัวคอลัมน์: รหัสบุคลากร, ชื่อ, อีเมล, หน่วยงาน, บทบาท หรือ employeeId,name,email,department,role</p>'+
      '<div class="actions"><button class="btn secondary" id="userTemplate">ดาวน์โหลดไฟล์ตัวอย่าง</button></div>'+
      '<div class="field" style="margin-top:12px"><label>เลือกไฟล์ CSV UTF-8</label><input id="userCsv" type="file" accept=".csv,text/csv"></div>'+
      '<div class="actions"><button class="btn primary" id="importUsers">นำเข้าบุคลากร</button></div>'+
      '<div class="hint">การนำเข้าแบบชุดจะไม่สร้าง ADMIN และจะข้ามรหัสบุคลากรที่มีอยู่แล้ว เพื่อป้องกันการเขียนทับข้อมูลโดยไม่ตั้งใจ</div>'+
      '<div id="importMsg"></div></div></div>'+

      '<div id="permissionEditor"></div>'+
      '<div class="panel"><div class="section-head"><div><h2>รายชื่อบุคลากร</h2><p class="muted">ไม่ลบบัญชีที่เคยมีประวัติการใช้งาน ให้ใช้ “ปิดใช้งาน” เพื่อคง Audit Trail</p></div>'+
      '<div class="field compact-field"><input id="userSearch" placeholder="ค้นหารหัส ชื่อ หน่วยงาน..."></div></div>'+
      '<div id="userList"></div></div>';

    function renderList(){
      const q=document.getElementById("userSearch").value.trim().toLowerCase();
      const visible=users.filter(u=>[
        u.employeeId,u.name,u.email,u.department?.name,roleLabel(u.role),userStatusLabel(u.status)
      ].join(" ").toLowerCase().includes(q));

      document.getElementById("userList").innerHTML=
        '<div class="table-wrap desktop-attendance"><table><thead><tr><th>รหัส</th><th>ชื่อ</th><th>หน่วยงาน</th><th>บทบาทระบบ</th><th>สถานะ</th><th></th></tr></thead><tbody>'+
        visible.map(u=>'<tr><td>'+esc(u.employeeId)+'</td><td>'+esc(u.name)+'</td><td>'+esc(u.department?.name||"—")+'</td><td>'+esc(roleLabel(u.role))+'</td><td>'+statusBadge(u.status==="ACTIVE"?"CONSISTENT":"INCOMPLETE")+' '+esc(userStatusLabel(u.status))+'</td><td>'+
          '<button class="btn mini secondary editUser" data-id="'+u.id+'">แก้ไข</button> '+
          '<button class="btn mini secondary permUser" data-id="'+u.id+'">สิทธิ์กิจกรรม</button> '+
          (u.employeeId!==session.employeeId?'<button class="btn mini '+(u.status==="ACTIVE"?"bad":"ok")+' toggleUser" data-id="'+u.id+'" data-status="'+u.status+'">'+(u.status==="ACTIVE"?"ปิดใช้งาน":"เปิดใช้งาน")+'</button>':'')+
        '</td></tr>').join("")+'</tbody></table></div>'+
        '<div class="attendance-cards">'+visible.map(u=>
          '<article class="attendance-card"><div class="attendance-card-head"><div><b>'+esc(u.employeeId)+'</b><div>'+esc(u.name)+'</div></div>'+
          '<span class="status '+(u.status==="ACTIVE"?"s-ok":"s-warn")+'">'+esc(userStatusLabel(u.status))+'</span></div>'+
          '<div class="attendance-meta"><span><b>หน่วยงาน</b>'+esc(u.department?.name||"—")+'</span><span><b>บทบาทระบบ</b>'+esc(roleLabel(u.role))+'</span></div>'+
          (u.email?'<div class="muted">'+esc(u.email)+'</div>':'')+
          '<div class="actions"><button class="btn mini secondary editUser" data-id="'+u.id+'">แก้ไข</button>'+
          '<button class="btn mini secondary permUser" data-id="'+u.id+'">สิทธิ์กิจกรรม</button>'+
          (u.employeeId!==session.employeeId?'<button class="btn mini '+(u.status==="ACTIVE"?"bad":"ok")+' toggleUser" data-id="'+u.id+'" data-status="'+u.status+'">'+(u.status==="ACTIVE"?"ปิดใช้งาน":"เปิดใช้งาน")+'</button>':'')+
          '</div></article>'
        ).join("")+'</div>';

      document.querySelectorAll(".editUser").forEach(btn=>btn.onclick=()=>{
        const u=users.find(x=>x.id===btn.dataset.id); if(!u)return;
        document.getElementById("uEmp").value=u.employeeId;
        document.getElementById("uEmp").disabled=true;
        document.getElementById("uName").value=u.name||"";
        document.getElementById("uEmail").value=u.email||"";
        document.getElementById("uDept").value=u.department?.name||"";
        document.getElementById("uRole").value=u.role;
        const create=document.getElementById("createUser");
        create.textContent="บันทึกการแก้ไข";
        create.dataset.editId=u.id;
        window.scrollTo({top:0,behavior:"smooth"});
      });

      function openPermissionEditor(u){
        const host=document.getElementById("permissionEditor");
        const activeKeys=activityPermissionKeys(u);
        const currentRows=(u.activityPermissions||[]).filter(p=>typeof p!=="string"&&!p.revokedAt);
        const sharedFrom=currentRows.map(p=>p.validFrom).filter(Boolean)[0]||"";
        const sharedUntil=currentRows.map(p=>p.validUntil).filter(Boolean)[0]||"";
        const dateValue=(iso)=>iso?new Date(iso).toISOString().slice(0,10):"";

        host.innerHTML=
          '<div class="panel permission-editor"><div class="section-head"><div><h2>สิทธิ์การกำหนดกิจกรรม</h2>'+
          '<p><b>'+esc(u.employeeId+" • "+u.name)+'</b></p></div><button class="btn mini secondary" id="closePerm">ปิด</button></div>'+
          '<div class="permission-grid">'+ACTIVITY_PERMISSION_DEFS.map(([key,label,desc])=>
            '<label class="permission-option"><input type="checkbox" data-permission="'+key+'" '+(activeKeys.includes(key)?"checked":"")+'>'+
            '<span><b>'+esc(label)+'</b><small>'+esc(desc)+'</small><code>'+esc(key)+'</code></span></label>'
          ).join("")+'</div>'+
          '<div class="form-grid" style="margin-top:14px">'+
            '<div class="field"><label>เริ่มมีผล (ถ้าไม่ระบุ = ทันที)</label><input id="permFrom" type="date" value="'+esc(dateValue(sharedFrom))+'"></div>'+
            '<div class="field"><label>สิ้นสุดสิทธิ์ (ถ้าไม่ระบุ = ไม่หมดอายุ)</label><input id="permUntil" type="date" value="'+esc(dateValue(sharedUntil))+'"></div>'+
          '</div>'+
          '<div class="field"><label>เหตุผลการเพิ่ม/ลดสิทธิ์</label><textarea id="permReason" placeholder="เช่น ผู้รับผิดชอบโครงการปีงบประมาณ 2570 / สิ้นสุดการมอบหมาย"></textarea></div>'+
          '<div class="hint">การเอาเครื่องหมาย ✓ ออกจากสิทธิ์เดิม = ถอนสิทธิ์ทันที และบันทึกผู้ดำเนินการ/เหตุผลลง Audit Trail</div>'+
          '<div class="actions"><button class="btn primary" id="savePerm">บันทึกสิทธิ์</button></div><div id="permMsg"></div></div>';

        document.getElementById("closePerm").onclick=()=>{host.innerHTML="";};
        document.getElementById("savePerm").onclick=async()=>{
          const selected=[...host.querySelectorAll("[data-permission]:checked")].map(x=>x.dataset.permission);
          const reason=document.getElementById("permReason").value.trim();
          const msg=document.getElementById("permMsg");
          if(reason.length<3){msg.innerHTML='<div class="alert warn">กรุณาระบุเหตุผลการเพิ่ม/ลดสิทธิ์</div>';return;}
          const from=document.getElementById("permFrom").value;
          const until=document.getElementById("permUntil").value;
          try{
            const result=await api("/api/users/"+encodeURIComponent(u.id)+"/activity-permissions",{
              method:"PATCH",
              body:JSON.stringify({
                permissions:selected,
                validFrom:from?new Date(from+"T00:00:00").toISOString():null,
                validUntil:until?new Date(until+"T23:59:59").toISOString():null,
                reason
              })
            });
            msg.innerHTML='<div class="alert ok">บันทึกแล้ว • เพิ่ม '+esc(result.changes?.granted?.length||0)+' • ปรับ '+esc(result.changes?.updated?.length||0)+' • ถอน '+esc(result.changes?.revoked?.length||0)+'</div>';
            setTimeout(()=>renderUsersAdmin(v),500);
          }catch(e){msg.innerHTML=errorBox(e);}
        };
        host.scrollIntoView({behavior:"smooth",block:"start"});
      }

      document.querySelectorAll(".permUser").forEach(btn=>btn.onclick=()=>{
        const u=users.find(x=>x.id===btn.dataset.id); if(u)openPermissionEditor(u);
      });

      document.querySelectorAll(".toggleUser").forEach(btn=>btn.onclick=async()=>{
        const next=btn.dataset.status==="ACTIVE"?"INACTIVE":"ACTIVE";
        if(!confirm((next==="INACTIVE"?"ปิด":"เปิด")+"การใช้งานบัญชีนี้?")) return;
        try{
          await api("/api/users/"+encodeURIComponent(btn.dataset.id)+"/status",{method:"PATCH",body:JSON.stringify({status:next})});
          await renderUsersAdmin(v);
        }catch(e){alert(e.message);}
      });
    }

    document.getElementById("userSearch").oninput=renderList;
    renderList();

    document.getElementById("createUser").onclick=async()=>{
      const msg=document.getElementById("userMsg");
      const button=document.getElementById("createUser");
      const employeeId=document.getElementById("uEmp").value.trim().toUpperCase();
      const name=document.getElementById("uName").value.trim();
      if(!employeeId||!name){msg.innerHTML='<div class="alert warn">กรุณาระบุรหัสบุคลากรและชื่อ–นามสกุล</div>';return;}
      const payload={
        employeeId,name,
        email:document.getElementById("uEmail").value.trim()||null,
        department:document.getElementById("uDept").value.trim()||null,
        role:document.getElementById("uRole").value
      };
      try{
        if(button.dataset.editId){
          await api("/api/users/"+encodeURIComponent(button.dataset.editId),{method:"PATCH",body:JSON.stringify(payload)});
        }else{
          await api("/api/users",{method:"POST",body:JSON.stringify(payload)});
        }
        msg.innerHTML='<div class="alert ok">บันทึกข้อมูลบุคลากรแล้ว</div>';
        setTimeout(()=>renderUsersAdmin(v),350);
      }catch(e){msg.innerHTML=errorBox(e);}
    };

    document.getElementById("userTemplate").onclick=()=>{
      const csv="\uFEFFรหัสบุคลากร,ชื่อ,อีเมล,หน่วยงาน,บทบาท\nP101,สมชาย ตัวอย่าง,somchai@example.ac.th,เทคโนโลยีสารสนเทศ,PARTICIPANT\nSTF101,สมหญิง ตัวอย่าง,somying@example.ac.th,สำนักงานคณะ,STAFF\n";
      download("activa-users-template.csv",csv,"text/csv;charset=utf-8");
    };

    document.getElementById("importUsers").onclick=async()=>{
      const msg=document.getElementById("importMsg");
      const file=document.getElementById("userCsv").files?.[0];
      if(!file){msg.innerHTML='<div class="alert warn">กรุณาเลือกไฟล์ CSV</div>';return;}
      try{
        const rows=normalizeUserCsv(await file.text());
        if(!rows.length) throw new Error("CSV_NO_VALID_ROWS");
        const result=await api("/api/users/import",{method:"POST",body:JSON.stringify({users:rows})});
        msg.innerHTML='<div class="alert ok">นำเข้าสำเร็จ '+esc(result.createdCount)+' คน • ข้าม '+esc(result.skippedCount)+' คน'+
          (result.errorCount?' • ผิดพลาด '+esc(result.errorCount)+' คน':'')+'</div>';
        setTimeout(()=>renderUsersAdmin(v),600);
      }catch(e){msg.innerHTML=errorBox(e);}
    };
  }

  async function renderActivities(v) {
    if (!canManageActivities()) throw new Error("FORBIDDEN");
    showLoading(v);
    const [activities, users, activityAttendance] = await Promise.all([
      loadActivities(),
      can("ADMIN") ? loadUsers() : Promise.resolve([]),
      loadAttendance().catch(()=>[])
    ]);
    const mayCreate = hasActivityPermission("CAN_CREATE_ACTIVITY");
    const eligibleOrganizers = users.filter(u =>
      u.status === "ACTIVE" &&
      (u.role === "ADMIN" || activityPermissionKeys(u).includes("CAN_CREATE_ACTIVITY"))
    );

    const createPanel = mayCreate
      ? '<div class="panel"><h2>สร้างกิจกรรม</h2><div class="form-grid">'+
        field("ชื่อกิจกรรม","aTitle","เช่น อบรมการใช้ AI")+
        '<div class="field"><label>ประเภทกิจกรรม</label><select id="aCat"><option>พัฒนาบุคลากร</option><option>ประชุม</option><option>บริการวิชาการ</option><option>วิจัย</option><option>ประกันคุณภาพ</option></select></div>'+
        field("วันที่","aDate","","date",new Date().toISOString().slice(0,10))+
        field("สถานที่","aLoc","ห้องประชุม")+
        field("เวลาเริ่ม","aStart","","time","09:00")+
        field("เวลาสิ้นสุด","aEnd","","time","16:00")+
        field("เปิด Check-in QR","aCiOpen","","time","08:30")+
        field("ปิด Check-in QR","aCiClose","","time","09:30")+
        field("เปิดช่วง Check-out","aCoOpen","","time","15:30")+
        field("ปิดช่วง Check-out","aCoClose","","time","16:30")+
        '<div class="hint full"><b>กติกา QR:</b> สร้างและสแกน Check-in ได้เฉพาะช่วง “เปิด–ปิด Check-in QR” เท่านั้น • QR แต่ละใบมีอายุไม่เกิน 45 วินาที</div>'+
        (can("ADMIN")
          ? '<div class="field full"><label>ผู้จัดกิจกรรมหลัก</label><select id="primaryOrganizer">'+
            eligibleOrganizers.map(u=>'<option value="'+esc(u.id)+'" '+(u.id===session.id?"selected":"")+'>'+esc(u.employeeId+" • "+u.name)+'</option>').join("")+
            '</select><small class="muted">เลือกได้เฉพาะบุคลากรที่มีสิทธิ์ “สร้างกิจกรรม”</small></div>'
          : '<div class="hint full">ผู้จัดกิจกรรมหลัก: <b>'+esc(session.name)+'</b> (กำหนดอัตโนมัติจากผู้สร้างกิจกรรม)</div>')+
        '</div><h3>นโยบายหลักฐานของกิจกรรม</h3><div class="policy">'+
        check("pQr","QR กิจกรรม",true)+check("pId","ยืนยันตัวตน",true)+
        check("pIn","Check-in",true)+check("pOut","Check-out",true)+
        check("pDur","ระยะเวลา",true)+check("pStaff","เจ้าหน้าที่ยืนยัน",true)+
        check("pSig","ลายเซ็น",false)+
        '<div class="field"><label>สัดส่วนเวลาขั้นต่ำ</label><input id="pRatio" type="number" min="0" max="1" step=".05" value=".75"></div>'+
        '</div><div class="actions"><button class="btn primary" id="createAct">บันทึกกิจกรรม</button></div><div id="actMsg"></div></div>'
      : '<div class="panel"><div class="hint"><b>สิทธิ์ปัจจุบัน:</b> คุณจัดการกิจกรรมที่ได้รับสิทธิ์ได้ แต่ไม่มีสิทธิ์สร้างกิจกรรมใหม่</div></div>';

    v.innerHTML =
      '<div class="panel"><div id="activityCenter"></div></div>'+
      createPanel+
      '<div id="activityManager"></div>';

    const activityState={filter:"RELEVANT",search:"",page:1,pageSize:20};

    function activityLifecycleClient(a,now=Date.now()){
      const start=new Date(a.startAt).getTime(),end=new Date(a.endAt).getTime();
      if(now<start)return "UPCOMING";
      if(now>end)return "ENDED";
      return "ACTIVE";
    }
    function activityReviewCount(activityId){
      return activityAttendance.filter(r=>(r.activity?.id||r.activityId)===activityId&&
        ["REVIEW_REQUIRED","INCOMPLETE","INCONSISTENT"].includes(evidenceStatusOf(r))&&
        !["VERIFIED","OVERRIDE_VERIFIED","REJECTED"].includes(finalStatusOf(r))).length;
    }
    function activityMatchesFilter(a,filter){
      const now=Date.now();
      const start=new Date(a.startAt).getTime(),end=new Date(a.endAt).getTime();
      const ci=clientCheckinWindowState(a);
      if(filter==="ACTIVE")return now>=start&&now<=end;
      if(filter==="CHECKIN")return ci.ok;
      if(filter==="TODAY")return new Date(a.startAt).toDateString()===new Date().toDateString();
      if(filter==="UPCOMING")return start>now;
      if(filter==="REVIEW")return activityReviewCount(a.id)>0;
      if(filter==="ENDED")return end<now;
      if(filter==="RELEVANT")return end>=now-24*60*60*1000;
      return true;
    }
    function renderActivityCenter(){
      const host=document.getElementById("activityCenter");if(!host)return;
      const term=activityState.search.trim().toLowerCase();
      let filtered=activities.filter(a=>activityMatchesFilter(a,activityState.filter)).filter(a=>{
        if(!term)return true;
        return [a.title,a.category,a.location,a.organizer?.name,a.organizer?.employeeId]
          .filter(Boolean).join(" ").toLowerCase().includes(term);
      });
      filtered.sort((a,b)=>{
        const al=activityLifecycleClient(a),bl=activityLifecycleClient(b);
        const rank={ACTIVE:0,UPCOMING:1,ENDED:2};
        if(rank[al]!==rank[bl])return rank[al]-rank[bl];
        return al==="ENDED"?new Date(b.startAt)-new Date(a.startAt):new Date(a.startAt)-new Date(b.startAt);
      });
      const pages=Math.max(1,Math.ceil(filtered.length/activityState.pageSize));
      activityState.page=Math.min(Math.max(1,activityState.page),pages);
      const pageRows=filtered.slice((activityState.page-1)*activityState.pageSize,activityState.page*activityState.pageSize);
      const filters=[
        ["RELEVANT","ที่เกี่ยวข้อง"],
        ["ACTIVE","กำลังดำเนินอยู่"],
        ["CHECKIN","เปิด Check-in"],
        ["TODAY","วันนี้"],
        ["UPCOMING","กำลังจะมาถึง"],
        ["REVIEW","มีรายการต้องตรวจ"],
        ["ENDED","สิ้นสุดแล้ว"],
        ["ALL","ประวัติทั้งหมด"]
      ];

      host.innerHTML=
        '<div class="section-head"><div><h2>ศูนย์กิจกรรม</h2><p class="muted">ค้นหาและกรองก่อน ไม่ต้องไล่ dropdown เมื่อมีกิจกรรมจำนวนมาก</p></div></div>'+
        '<div class="event-toolbar"><div class="field"><label>ค้นหากิจกรรม</label><input id="actSearch" value="'+esc(activityState.search)+'" placeholder="ชื่อกิจกรรม / ประเภท / สถานที่ / ผู้จัด"></div>'+
        '<div class="field"><label>สถานะ</label><select id="actFilter">'+filters.map(([k,l])=>'<option value="'+k+'" '+(activityState.filter===k?'selected':'')+'>'+l+'</option>').join("")+'</select></div></div>'+
        '<div class="result-meta">พบ '+filtered.length+' กิจกรรม • แสดง '+pageRows.length+' รายการในหน้านี้</div>'+
        '<div class="activity-center-list">'+(pageRows.length?pageRows.map(a=>{
          const life=activityLifecycleClient(a);
          const reviewCount=activityReviewCount(a.id);
          const lifecycleLabel=life==="ACTIVE"?"กำลังดำเนินอยู่":life==="UPCOMING"?"กำลังจะมาถึง":"สิ้นสุดแล้ว";
          return '<article class="activity-center-row">'+
            '<div class="activity-center-main"><b>'+esc(a.title)+'</b><span>'+esc(a.category)+' • '+fmt(a.startAt)+' → '+fmt(a.endAt)+'</span><small>'+esc(a.location)+' • ผู้จัด '+esc(a.organizer?.name||a.organizerId||"—")+'</small></div>'+
            '<div class="activity-center-status"><span class="status '+(life==="ACTIVE"?"s-ok":life==="UPCOMING"?"s-info":"s-warn")+'">'+lifecycleLabel+'</span>'+
              (reviewCount?'<span class="status s-bad">ต้องตรวจ '+reviewCount+'</span>':'')+'</div>'+
            '<div class="activity-center-actions">'+
              '<button class="btn mini secondary openAttendanceActivity" data-id="'+esc(a.id)+'">ผู้เข้าร่วม</button>'+
              '<button class="btn mini secondary openQrActivity" data-id="'+esc(a.id)+'">QR</button>'+
              (canManageActivityClient(a)?'<button class="btn mini primary manageActivity" data-id="'+esc(a.id)+'">จัดการ</button>':'')+
            '</div></article>';
        }).join(""):'<div class="empty">ไม่พบกิจกรรมตามเงื่อนไข</div>')+'</div>'+
        '<div class="pagination"><button class="btn mini secondary" id="actPrev" '+(activityState.page<=1?'disabled':'')+'>ก่อนหน้า</button><span>หน้า '+activityState.page+' / '+pages+'</span><button class="btn mini secondary" id="actNext" '+(activityState.page>=pages?'disabled':'')+'>ถัดไป</button></div>';

      const search=document.getElementById("actSearch");
      search.oninput=e=>{activityState.search=e.target.value;activityState.page=1;renderActivityCenter();const n=document.getElementById("actSearch");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length);}};
      document.getElementById("actFilter").onchange=e=>{activityState.filter=e.target.value;activityState.page=1;renderActivityCenter();};
      document.getElementById("actPrev").onclick=()=>{activityState.page--;renderActivityCenter();};
      document.getElementById("actNext").onclick=()=>{activityState.page++;renderActivityCenter();};

      host.querySelectorAll(".manageActivity").forEach(btn=>btn.onclick=()=>{
        renderActivityManagement(document.getElementById("activityManager"),btn.dataset.id);
      });
      host.querySelectorAll(".openAttendanceActivity").forEach(btn=>btn.onclick=()=>{
        sessionStorage.setItem(SELECTED_ACTIVITY_KEY,btn.dataset.id);setView("attendance");
      });
      host.querySelectorAll(".openQrActivity").forEach(btn=>btn.onclick=()=>{
        sessionStorage.setItem(SELECTED_ACTIVITY_KEY,btn.dataset.id);setView("qr");
      });
    }
    renderActivityCenter();

    const createBtn=document.getElementById("createAct");
    if(!createBtn) return;

    function shiftTime(value, minutes){
      const [h,m]=(value||"00:00").split(":").map(Number);
      const d=new Date(2000,0,1,h||0,m||0);
      d.setMinutes(d.getMinutes()+minutes);
      return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");
    }
    const syncDefaultWindows=()=>{
      const start=document.getElementById("aStart").value;
      const end=document.getElementById("aEnd").value;
      document.getElementById("aCiOpen").value=shiftTime(start,-30);
      document.getElementById("aCiClose").value=shiftTime(start,30);
      document.getElementById("aCoOpen").value=shiftTime(end,-30);
      document.getElementById("aCoClose").value=shiftTime(end,30);
    };
    document.getElementById("aStart").addEventListener("change",syncDefaultWindows);
    document.getElementById("aEnd").addEventListener("change",syncDefaultWindows);

    createBtn.onclick = async () => {
      const msg = document.getElementById("actMsg");
      const title = document.getElementById("aTitle").value.trim();
      if (!title) return msg.innerHTML = '<div class="alert bad">กรุณาระบุชื่อกิจกรรม</div>';
      const date = document.getElementById("aDate").value;
      const start = document.getElementById("aStart").value;
      const end = document.getElementById("aEnd").value;
      const ciOpen = document.getElementById("aCiOpen").value;
      const ciClose = document.getElementById("aCiClose").value;
      const coOpen = document.getElementById("aCoOpen").value;
      const coClose = document.getElementById("aCoClose").value;
      const startDt=new Date(date+"T"+start), endDt=new Date(date+"T"+end);
      const ciOpenDt=new Date(date+"T"+ciOpen), ciCloseDt=new Date(date+"T"+ciClose);
      const coOpenDt=new Date(date+"T"+coOpen), coCloseDt=new Date(date+"T"+coClose);
      if(endDt<=startDt) return msg.innerHTML='<div class="alert bad">เวลาสิ้นสุดต้องอยู่หลังเวลาเริ่ม</div>';
      if(ciCloseDt<=ciOpenDt) return msg.innerHTML='<div class="alert bad">เวลาปิด Check-in ต้องอยู่หลังเวลาเปิด Check-in</div>';
      if(ciCloseDt>endDt) return msg.innerHTML='<div class="alert bad">ช่วง Check-in ต้องปิดไม่เกินเวลาสิ้นสุดกิจกรรม</div>';
      if(coCloseDt<=coOpenDt) return msg.innerHTML='<div class="alert bad">เวลาปิด Check-out ต้องอยู่หลังเวลาเปิด Check-out</div>';
      if(coOpenDt<startDt) return msg.innerHTML='<div class="alert bad">ช่วง Check-out ต้องไม่เปิดก่อนกิจกรรมเริ่ม</div>';
      try {
        await api("/api/activities", {
          method:"POST",
          body:JSON.stringify({
            title,
            category:document.getElementById("aCat").value,
            location:document.getElementById("aLoc").value || "ไม่ระบุ",
            startAt:startDt.toISOString(),
            endAt:endDt.toISOString(),
            checkinOpenAt:ciOpenDt.toISOString(),
            checkinCloseAt:ciCloseDt.toISOString(),
            checkoutOpenAt:coOpenDt.toISOString(),
            checkoutCloseAt:coCloseDt.toISOString(),
            primaryOrganizerId:document.getElementById("primaryOrganizer")?.value || session.id,
            policy:{
              qrRequired:checked("pQr"),identityRequired:checked("pId"),checkinRequired:checked("pIn"),
              checkoutRequired:checked("pOut"),durationRequired:checked("pDur"),staffRequired:checked("pStaff"),
              signatureRequired:checked("pSig"),minDurationRatio:Number(document.getElementById("pRatio").value || .75)
            }
          })
        });
        msg.innerHTML = '<div class="alert ok">บันทึกกิจกรรมแล้ว • จากนั้นกด “จัดผู้รับผิดชอบ/ผู้เข้าร่วม” เพื่อเพิ่ม Co-organizer ผู้ตรวจสอบ และกำหนดผู้เข้าร่วม</div>';
        setTimeout(() => renderActivities(v), 300);
      } catch (error) { msg.innerHTML = errorBox(error); }
    };
  }

  function activityLifecycleLabel(value) {
    return ({
      BEFORE_START:"ก่อนเริ่มกิจกรรม",
      ACTIVE:"กำลังดำเนินกิจกรรม",
      ENDED:"กิจกรรมสิ้นสุดแล้ว"
    })[value] || value || "—";
  }

  function participationModeLabel(mode) {
    return ({OPEN:"บุคลากรทุกคน",ROSTER:"เฉพาะรายชื่อ",GROUP:"เฉพาะหน่วยงาน"})[mode] || mode || "บุคลากรทุกคน";
  }

  function activitiesTable(items) {
    if (!items.length) return '<div class="empty">ยังไม่มีกิจกรรม</div>';
    const row = (a) => {
      const primary=a.organizer?.name || a.organizerId || "—";
      const count=a._count?.participants ?? (a.participants||[]).length ?? 0;
      const manage=canManageActivityClient(a)
        ? '<button class="btn mini secondary manageActivity" data-id="'+esc(a.id)+'">จัดผู้รับผิดชอบ/ผู้เข้าร่วม</button>'
        : '';
      return '<tr><td><b>'+esc(a.title)+'</b><br><span class="muted">'+esc(a.category)+' • '+esc(a.id)+'</span></td>'+
        '<td>'+fmt(a.startAt)+'<br>ถึง '+fmt(a.endAt)+'<br><span class="muted">Check-in '+fmt(a.checkinOpenAt||new Date(new Date(a.startAt).getTime()-30*60000))+' → '+fmt(a.checkinCloseAt||new Date(new Date(a.startAt).getTime()+30*60000))+'</span></td>'+
        '<td>'+esc(a.location)+'</td>'+
        '<td>'+esc(primary)+'</td>'+
        '<td>'+esc(participationModeLabel(a.participationMode))+(a.participationMode==="ROSTER"?' • '+count+' คน':'')+'</td>'+
        '<td>'+esc(policyText(a.policy))+'</td><td>'+manage+'</td></tr>';
    };
    const cards=items.map(a=>{
      const primary=a.organizer?.name || a.organizerId || "—";
      const count=a._count?.participants ?? (a.participants||[]).length ?? 0;
      return '<article class="activity-card">'+
        '<div class="activity-card-head"><div><b>'+esc(a.title)+'</b><small>'+esc(a.category)+'</small></div><span class="status s-info">'+esc(participationModeLabel(a.participationMode))+'</span></div>'+
        '<div class="activity-meta"><span><b>วัน/เวลา</b>'+fmt(a.startAt)+' → '+fmt(a.endAt)+'</span><span><b>ช่วง Check-in QR</b>'+fmt(a.checkinOpenAt||new Date(new Date(a.startAt).getTime()-30*60000))+' → '+fmt(a.checkinCloseAt||new Date(new Date(a.startAt).getTime()+30*60000))+'</span><span><b>สถานที่</b>'+esc(a.location)+'</span>'+
        '<span><b>ผู้จัดกิจกรรมหลัก</b>'+esc(primary)+'</span><span><b>รายชื่อที่กำหนด</b>'+(a.participationMode==="ROSTER"?esc(count)+" คน":"—")+'</span></div>'+
        '<div class="muted">'+esc(policyText(a.policy))+'</div>'+
        (canManageActivityClient(a)?'<div class="actions"><button class="btn secondary manageActivity" data-id="'+esc(a.id)+'">จัดผู้รับผิดชอบ/ผู้เข้าร่วม</button></div>':'')+
        '</article>';
    }).join("");
    return '<div class="table-wrap desktop-activities"><table><thead><tr><th>กิจกรรม</th><th>วัน/เวลา</th><th>สถานที่</th><th>ผู้จัดหลัก</th><th>ผู้เข้าร่วม</th><th>Evidence Policy</th><th></th></tr></thead><tbody>'+
      items.map(row).join("")+'</tbody></table></div><div class="activity-cards">'+cards+'</div>';
  }

  function assignmentChecks(users, selectedIds, className, disabled) {
    const selected=new Set(selectedIds||[]);
    return '<div class="assignment-list">'+users.map(u=>
      '<label class="assignment-person"><input type="checkbox" class="'+className+'" value="'+esc(u.id)+'" '+(selected.has(u.id)?"checked":"")+' '+(disabled?"disabled":"")+'>'+
      '<span><b>'+esc(u.employeeId+" • "+u.name)+'</b><small>'+esc(u.department?.name||"ไม่ระบุหน่วยงาน")+'</small></span></label>'
    ).join("")+'</div>';
  }

  async function renderActivityManagement(host, activityId) {
    host.innerHTML='<div class="panel"><div class="loading">กำลังโหลดผู้รับผิดชอบและผู้เข้าร่วม…</div></div>';
    try {
      const [detail, users] = await Promise.all([
        api("/api/activities/"+encodeURIComponent(activityId)+"/manage"),
        loadUsers()
      ]);
      const a=detail.activity, caps=detail.capabilities||{};
      const activeUsers=users.filter(u=>u.status==="ACTIVE");
      const coIds=(a.roleAssignments||[]).filter(x=>x.role==="CO_ORGANIZER").map(x=>x.userId);
      const verifierIds=(a.roleAssignments||[]).filter(x=>x.role==="VERIFIER").map(x=>x.userId);
      const rosterIds=(a.participants||[]).filter(x=>x.status!=="CANCELLED").map(x=>x.userId);
      const depts=[...new Map(activeUsers.filter(u=>u.department?.code).map(u=>[u.department.code,u.department])).values()];
      const allowedDepts=new Set(Array.isArray(a.allowedDepartmentCodes)?a.allowedDepartmentCodes:[]);

      host.innerHTML=
        '<div class="panel activity-manager"><div class="section-head"><div><h2>ผู้รับผิดชอบและผู้เข้าร่วมกิจกรรม</h2><p><b>'+esc(a.title)+'</b></p></div><button class="btn mini secondary" id="closeActivityManager">ปิด</button></div>'+
        '<div class="hint"><b>ผู้จัดกิจกรรมหลัก:</b> '+esc(a.organizer?.employeeId+" • "+a.organizer?.name)+'</div>'+
        '<div class="split">'+
          '<div><h3>ผู้จัดกิจกรรมร่วม (Co-organizer)</h3><p class="muted">สิทธิ์นี้มีผลเฉพาะกิจกรรมนี้ ไม่ทำให้บุคคลเป็นผู้จัดกิจกรรมอื่น</p>'+
            '<div class="assignment-governance">'+
              '<span class="status s-info">'+esc(activityLifecycleLabel(caps.lifecycle))+'</span>'+
              (a.assignmentsUpdatedAt?'<span class="muted">บันทึกล่าสุด '+esc(fmt(a.assignmentsUpdatedAt))+'</span>':'<span class="muted">ยังไม่เคยบันทึกการเปลี่ยนแปลงผู้รับผิดชอบ</span>')+
            '</div>'+
            (caps.lifecycle==="ACTIVE"?'<div class="alert warn">กิจกรรมกำลังดำเนินอยู่ การเปลี่ยนผู้จัดร่วมทำได้เฉพาะผู้มีสิทธิ์และต้องระบุเหตุผล ระบบจะบันทึก Audit Trail</div>':'')+
            (caps.lifecycle==="ENDED"?(caps.canAssignCo?'<div class="alert warn"><b>กิจกรรมสิ้นสุดแล้ว</b><br>แก้ไขผู้จัดร่วมได้เฉพาะ ADMIN พร้อมเหตุผล และจะถูกบันทึกเป็น Administrative Override</div>':'<div class="alert bad"><b>กิจกรรมสิ้นสุดแล้ว</b><br>รายชื่อผู้จัดร่วมถูกล็อก ผู้ใช้ทั่วไปแก้ไขไม่ได้</div>'):'')+
            assignmentChecks(activeUsers.filter(u=>u.id!==a.organizerId),coIds,"coAssign",!caps.canAssignCo)+
            (caps.coChangeReasonRequired?'<div class="field"><label>'+(caps.coAdminOverrideRequired?'เหตุผลการแก้ไขหลังสิ้นสุดกิจกรรม':'เหตุผลการเปลี่ยนแปลงระหว่างกิจกรรม')+'</label><textarea id="coChangeReason" placeholder="ระบุเหตุผลอย่างน้อย 10 ตัวอักษร"></textarea></div>':'')+
            (caps.canAssignCo?'<div class="actions"><button class="btn primary" id="saveCo">'+(a.assignmentsUpdatedAt?'บันทึกการเปลี่ยนแปลง':'บันทึกผู้จัดร่วม')+'</button></div>':'<div class="hint">บัญชีนี้ดูได้ แต่ไม่มีสิทธิ์เปลี่ยนผู้จัดร่วม</div>')+
          '</div>'+
          '<div><h3>ผู้ตรวจสอบหลักฐานของกิจกรรม</h3><p class="muted">เป็นการมอบหมายเฉพาะกิจกรรม ไม่ใช่การเปลี่ยนบทบาทระบบถาวร</p>'+
            assignmentChecks(activeUsers,verifierIds,"verifierAssign",!caps.canAssignVerifier)+
            (caps.canAssignVerifier?'<div class="actions"><button class="btn primary" id="saveVerifier">บันทึกผู้ตรวจสอบ</button></div>':'<div class="hint">บัญชีนี้ดูได้ แต่ไม่มีสิทธิ์เปลี่ยนผู้ตรวจสอบ</div>')+
          '</div>'+
        '</div>'+
        '<hr><h3>กำหนดผู้เข้าร่วมกิจกรรม</h3>'+
        '<div class="participation-modes">'+
          '<label><input type="radio" name="participationMode" value="OPEN" '+(a.participationMode==="OPEN"?"checked":"")+'> <b>บุคลากรทุกคน</b><small>บุคลากรที่ใช้งานอยู่สามารถสแกนเข้าร่วมได้</small></label>'+
          '<label><input type="radio" name="participationMode" value="ROSTER" '+(a.participationMode==="ROSTER"?"checked":"")+'> <b>เฉพาะรายชื่อที่กำหนด</b><small>เฉพาะบุคลากรที่เลือกไว้จึงสแกนเข้าร่วมได้</small></label>'+
          '<label><input type="radio" name="participationMode" value="GROUP" '+(a.participationMode==="GROUP"?"checked":"")+'> <b>เฉพาะหน่วยงาน</b><small>จำกัดตามหน่วยงานของบุคลากร</small></label>'+
        '</div>'+
        '<div id="rosterBox"><h4>เลือกรายชื่อบุคลากร</h4>'+assignmentChecks(activeUsers,rosterIds,"rosterPerson",!caps.canManageParticipants)+'</div>'+
        '<div id="groupBox"><h4>เลือกหน่วยงาน</h4><div class="assignment-list">'+depts.map(d=>
          '<label class="assignment-person"><input type="checkbox" class="groupDept" value="'+esc(d.code)+'" '+(allowedDepts.has(d.code)?"checked":"")+' '+(!caps.canManageParticipants?"disabled":"")+'>'+
          '<span><b>'+esc(d.name)+'</b><small>'+esc(d.code)+'</small></span></label>'
        ).join("")+'</div></div>'+
        (caps.canManageParticipants?'<div class="actions"><button class="btn primary" id="saveParticipation">บันทึกผู้เข้าร่วม</button></div>':'')+
        '<div id="activityManageMsg"></div></div>';

      const updateMode=()=>{
        const mode=host.querySelector('input[name="participationMode"]:checked')?.value||"OPEN";
        document.getElementById("rosterBox").style.display=mode==="ROSTER"?"block":"none";
        document.getElementById("groupBox").style.display=mode==="GROUP"?"block":"none";
      };
      host.querySelectorAll('input[name="participationMode"]').forEach(x=>x.onchange=updateMode);
      updateMode();
      document.getElementById("closeActivityManager").onclick=()=>{host.innerHTML="";};

      const checkedValues=(selector)=>[...host.querySelectorAll(selector+":checked")].map(x=>x.value);
      async function saveAssignments(payload,message){
        const msg=document.getElementById("activityManageMsg");
        try{
          await api("/api/activities/"+encodeURIComponent(activityId)+"/assignments",{method:"PUT",body:JSON.stringify(payload)});
          msg.innerHTML='<div class="alert ok">'+esc(message)+'</div>';
          setTimeout(()=>renderActivityManagement(host,activityId),300);
        }catch(e){msg.innerHTML=errorBox(e);}
      }
      if(document.getElementById("saveCo")) document.getElementById("saveCo").onclick=async()=>{
        const reason=document.getElementById("coChangeReason")?.value.trim()||"";
        if(caps.coChangeReasonRequired&&reason.length<10){
          document.getElementById("activityManageMsg").innerHTML='<div class="alert warn">กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร</div>';
          return;
        }
        const msg=document.getElementById("activityManageMsg");
        try{
          const result=await api("/api/activities/"+encodeURIComponent(activityId)+"/assignments",{
            method:"PUT",
            body:JSON.stringify({coOrganizerIds:checkedValues(".coAssign"),changeReason:reason})
          });
          msg.innerHTML=result.noChange
            ? '<div class="alert">ไม่มีการเปลี่ยนแปลงรายชื่อผู้จัดร่วม</div>'
            : '<div class="alert ok">'+(caps.lifecycle==="ENDED"?'บันทึก Administrative Override แล้ว':'บันทึกการเปลี่ยนแปลงผู้จัดร่วมแล้ว')+'</div>';
          if(!result.noChange) setTimeout(()=>renderActivityManagement(host,activityId),350);
        }catch(e){msg.innerHTML=errorBox(e);}
      };
      if(document.getElementById("saveVerifier")) document.getElementById("saveVerifier").onclick=()=>saveAssignments({verifierIds:checkedValues(".verifierAssign")},"บันทึกผู้ตรวจสอบหลักฐานแล้ว");
      if(document.getElementById("saveParticipation")) document.getElementById("saveParticipation").onclick=async()=>{
        const msg=document.getElementById("activityManageMsg");
        const mode=host.querySelector('input[name="participationMode"]:checked')?.value||"OPEN";
        try{
          await api("/api/activities/"+encodeURIComponent(activityId)+"/participants",{method:"PUT",body:JSON.stringify({
            mode,
            userIds:checkedValues(".rosterPerson"),
            departmentCodes:checkedValues(".groupDept")
          })});
          msg.innerHTML='<div class="alert ok">บันทึกเงื่อนไขผู้เข้าร่วมแล้ว</div>';
          setTimeout(()=>renderActivityManagement(host,activityId),300);
        }catch(e){msg.innerHTML=errorBox(e);}
      };
    } catch(error) {
      host.innerHTML='<div class="panel">'+errorBox(error)+'</div>';
    }
  }

  function clientEventWindowState(a, purpose="CHECKIN") {
    const p=String(purpose||"CHECKIN").toUpperCase();
    const start=new Date(a.startAt).getTime();
    const end=new Date(a.endAt).getTime();
    const open=p==="CHECKOUT"
      ? new Date(a.checkoutOpenAt||new Date(end-30*60000)).getTime()
      : new Date(a.checkinOpenAt||new Date(start-30*60000)).getTime();
    const close=p==="CHECKOUT"
      ? new Date(a.checkoutCloseAt||new Date(end+30*60000)).getTime()
      : new Date(a.checkinCloseAt||new Date(start+30*60000)).getTime();
    const now=Date.now();
    const prefix=p==="CHECKOUT"?"QR_CHECKOUT":"QR_CHECKIN";
    return {
      ok:now>=open&&now<=close,
      code:now<open?prefix+"_NOT_OPEN":now>close?prefix+"_CLOSED":prefix+"_OPEN",
      openAt:new Date(open).toISOString(),
      closeAt:new Date(close).toISOString(),
      purpose:p
    };
  }

  function clientCheckinWindowState(a){ return clientEventWindowState(a,"CHECKIN"); }
  function clientCheckoutWindowState(a){ return clientEventWindowState(a,"CHECKOUT"); }

  async function renderQr(v) {
    if (!(can("ADMIN") || hasActivityPermission("CAN_CREATE_ACTIVITY") || hasActivityPermission("CAN_EDIT_OWN_ACTIVITY") || hasActivityPermission("CAN_MANAGE_ALL_ACTIVITIES"))) throw new Error("FORBIDDEN");
    showLoading(v);
    const activities = (await loadActivities()).filter(canManageActivityClient);
    if (!activities.length) return v.innerHTML = '<div class="panel"><div class="empty">ยังไม่มีกิจกรรมสำหรับสร้าง QR</div></div>';

    v.innerHTML =
      '<div class="panel"><h2>Dynamic Event QR</h2>'+
      '<div class="event-toolbar">'+
        '<div class="field"><label>เลือกกิจกรรม</label><select id="qrAct">'+activities.map(a => '<option value="'+a.id+'">'+esc(a.title)+'</option>').join("")+'</select></div>'+
        '<div class="field"><label>ประเภท QR</label><select id="qrPurpose"><option value="CHECKIN">QR สำหรับ Check-in</option><option value="CHECKOUT">QR สำหรับ Check-out</option></select></div>'+
      '</div>'+
      '<div id="qrWindowInfo"></div>'+
      '<div class="actions"><button class="btn primary" id="newQr">สร้าง/หมุน QR ใหม่</button></div>'+
      '<div id="qrArea"></div>'+
      '<div class="hint">'+
        (appMode==="demo"
          ? '<b>Demo Mode:</b> QR แบบ portable สำหรับทดสอบข้ามอุปกรณ์ ไม่ใช่ลายมือชื่อ HMAC จริง'
          : '<b>Server Mode:</b> Token ลงลายมือชื่อ HMAC-SHA256 มี nonce, purpose และวันหมดอายุ')+
        '<br><b>CHECKIN</b> ใช้ได้เฉพาะ Check-in Window • <b>CHECKOUT</b> ใช้ได้เฉพาะ Check-out Window • QR คนละ purpose ใช้แทนกันไม่ได้</div></div>';

    const storedActivityId=sessionStorage.getItem(SELECTED_ACTIVITY_KEY);
    const qrSelect=document.getElementById("qrAct");
    if(storedActivityId&&[...qrSelect.options].some(o=>o.value===storedActivityId)) qrSelect.value=storedActivityId;

    const selectedActivity=()=>activities.find(a=>a.id===document.getElementById("qrAct").value);
    const selectedPurpose=()=>document.getElementById("qrPurpose").value;

    function updateWindowInfo() {
      const a=selectedActivity();
      const purpose=selectedPurpose();
      const state=clientEventWindowState(a,purpose);
      const info=document.getElementById("qrWindowInfo");
      const btn=document.getElementById("newQr");
      if(!a||!info||!btn)return;
      const isOut=purpose==="CHECKOUT";
      const label=state.ok
        ? (isOut?"เปิด Check-out อยู่":"เปิด Check-in อยู่")
        : state.code.endsWith("NOT_OPEN")
          ? (isOut?"ยังไม่เปิด Check-out":"ยังไม่เปิด Check-in")
          : (isOut?"ปิด Check-out แล้ว":"ปิด Check-in แล้ว");
      info.innerHTML='<div class="alert '+(state.ok?"ok":"warn")+'"><b>'+label+'</b><br>ช่วง '+(isOut?"Check-out":"Check-in")+': '+esc(fmt(state.openAt))+' → '+esc(fmt(state.closeAt))+'</div>';
      btn.disabled=!state.ok;
      btn.textContent=isOut?"สร้าง/หมุน Check-out QR":"สร้าง/หมุน Check-in QR";
    }

    async function issue() {
      const activityId=document.getElementById("qrAct").value;
      const purpose=selectedPurpose();
      qrState=await api("/api/activities/"+encodeURIComponent(activityId)+"/qr",{
        method:"POST",
        body:JSON.stringify({purpose})
      });
      draw();
    }

    function draw() {
      if(!qrState)return;
      const remain=Math.max(0,Math.ceil((new Date(qrState.expiresAt).getTime()-Date.now())/1000));
      const area=document.getElementById("qrArea");
      if(!area)return;
      const purpose=qrState.purpose||selectedPurpose();
      const closeAt=purpose==="CHECKOUT"?qrState.checkoutCloseAt:qrState.checkinCloseAt;
      const label=purpose==="CHECKOUT"?"CHECK-OUT QR":"CHECK-IN QR";
      area.innerHTML=
        '<div class="qrbox" style="margin-top:18px"><div id="qrcode" class="qr"></div><div>'+
        '<p><b>'+label+'</b> • หมดอายุใน <b>'+remain+'</b> วินาที</p>'+
        '<p class="muted">'+(purpose==="CHECKOUT"?"Check-out":"Check-in")+' ได้ถึง '+esc(fmt(closeAt))+'</p>'+
        '<div class="token">'+esc(qrState.token)+'</div></div></div>';
      if(window.QRCode)new QRCode(document.getElementById("qrcode"),{
        text:qrState.token,width:240,height:240,correctLevel:QRCode.CorrectLevel.L
      });
    }

    function qrError(e){
      qrState=null;
      const area=document.getElementById("qrArea");
      const purpose=selectedPurpose();
      if(e?.message==="QR_CHECKIN_NOT_OPEN"||e?.message==="QR_CHECKOUT_NOT_OPEN"){
        const openAt=purpose==="CHECKOUT"?e.data?.checkoutOpenAt:e.data?.checkinOpenAt;
        const closeAt=purpose==="CHECKOUT"?e.data?.checkoutCloseAt:e.data?.checkinCloseAt;
        area.innerHTML='<div class="alert warn"><b>ยังไม่เปิดช่วง '+(purpose==="CHECKOUT"?"Check-out":"Check-in")+'</b><br>เปิด '+esc(fmt(openAt))+' ถึง '+esc(fmt(closeAt))+'</div>';
      }else if(e?.message==="QR_CHECKIN_CLOSED"||e?.message==="QR_CHECKOUT_CLOSED"){
        area.innerHTML='<div class="alert bad"><b>ปิดช่วง '+(purpose==="CHECKOUT"?"Check-out":"Check-in")+' แล้ว</b><br>ไม่สามารถสร้าง QR เพิ่มได้</div>';
      }else{
        area.innerHTML=errorBox(e);
      }
      updateWindowInfo();
    }

    function resetAndMaybeIssue(){
      qrState=null;
      const area=document.getElementById("qrArea");
      if(area)area.innerHTML="";
      updateWindowInfo();
      if(clientEventWindowState(selectedActivity(),selectedPurpose()).ok)issue().catch(qrError);
    }

    document.getElementById("newQr").onclick=()=>issue().catch(qrError);
    document.getElementById("qrAct").onchange=resetAndMaybeIssue;
    document.getElementById("qrPurpose").onchange=resetAndMaybeIssue;

    updateWindowInfo();
    if(clientEventWindowState(selectedActivity(),selectedPurpose()).ok)await issue().catch(qrError);

    qrTimer=setInterval(async()=>{
      updateWindowInfo();
      const state=clientEventWindowState(selectedActivity(),selectedPurpose());
      if(!state.ok){
        qrState=null;
        const area=document.getElementById("qrArea");
        if(area)area.innerHTML='<div class="empty">'+(state.code.endsWith("NOT_OPEN")?"รอเวลาเปิด "+(state.purpose==="CHECKOUT"?"Check-out":"Check-in"):"ปิดช่วง "+(state.purpose==="CHECKOUT"?"Check-out":"Check-in")+" แล้ว")+'</div>';
        return;
      }
      if(!qrState||qrState.purpose!==selectedPurpose()||new Date(qrState.expiresAt).getTime()<=Date.now()){
        try{await issue();}catch(e){qrError(e);}
      }else draw();
    },1000);
  }

  async function loadUsers() {
    if (can("PARTICIPANT") && !canManageActivities()) return [session];
    const data = await api("/api/users");
    return data.users || [];
  }

  async function loadAttendance() {
    return (await api("/api/attendance")).attendance || [];
  }

  function statusLabel(status) {
    const s = status || "NOT_EVALUATED";
    const labels = {
      NOT_EVALUATED:"ยังไม่ประเมิน",
      PENDING:"รอการตัดสิน",
      COMPLETE:"หลักฐานครบ",
      INCOMPLETE:"หลักฐานไม่ครบ",
      CONSISTENT:"สอดคล้อง",
      INCONSISTENT:"ไม่สอดคล้อง",
      REVIEW_REQUIRED:"ต้องตรวจสอบ",
      VERIFIED:"รับรองแล้ว",
      OVERRIDE_VERIFIED:"รับรองเป็นกรณีพิเศษ",
      REJECTED:"ไม่รับรอง",
      OPEN:"เปิดอยู่",
      ADJUDICATED:"ตัดสินแล้ว",
      LOCKED:"ล็อกแล้ว",
      REVIEW_REQUIRED:"ต้องตรวจสอบ",
      NO_REVIEW_REQUIRED:"ไม่ต้องตรวจเพิ่ม",
      CANDIDATE:"โมเดลผู้สมัคร",
      EVALUATED:"ประเมินแล้ว",
      APPROVED:"อนุมัติแล้ว",
      DEPLOYED:"นำไปใช้แล้ว",
      RETIRED:"ยุติการใช้",
      CHECKED_IN:"เช็กอินแล้ว",
      CHECKED_OUT:"เช็กเอาต์แล้ว"
    };
    return labels[s] || s;
  }

  function statusBadge(status) {
    const s = status || "NOT_EVALUATED";
    const cls = ["VERIFIED","COMPLETE","CONSISTENT","APPROVED","DEPLOYED","LOCKED"].includes(s) ? "s-ok" :
      ["OVERRIDE_VERIFIED","INCOMPLETE","ADJUDICATED","EVALUATED"].includes(s) ? "s-warn" :
      ["REVIEW_REQUIRED","REJECTED","INCONSISTENT"].includes(s) ? "s-bad" : "s-info";
    return '<span class="status '+cls+'" title="'+esc(s)+'" data-code="'+esc(s)+'">'+esc(statusLabel(s))+'</span>';
  }

  function evidenceStatusOf(r) {
    return r.consistencyResult?.status || "NOT_EVALUATED";
  }

  function finalStatusOf(r) {
    return r.finalEvidenceStatus || "PENDING";
  }

  function evidenceReasonLabel(code) {
    const labels = {
      SHORT_DURATION:"ระยะเวลาเข้าร่วมไม่ถึงเกณฑ์",
      MISSING_QR:"ไม่มีหลักฐาน QR",
      MISSING_IDENTITY:"ยังไม่ยืนยันตัวตน",
      MISSING_CHECKIN:"ไม่มีเวลาเข้า",
      MISSING_CHECKOUT:"ไม่มีเวลาออก",
      MISSING_DURATION:"ไม่มีข้อมูลระยะเวลา",
      MISSING_STAFF_VERIFICATION:"ยังไม่มีการยืนยันโดยเจ้าหน้าที่",
      MISSING_SIGNATURE:"ยังไม่มีหลักฐานลายเซ็น",
      CHECKOUT_QR_NOT_VERIFIED:"Check-out ไม่ได้ยืนยันด้วย Dynamic QR",
      STAFF_ASSISTED_CHECKOUT:"Check-out แบบเจ้าหน้าที่ช่วย ต้องตรวจสอบเหตุผล",
      DUPLICATE_SCAN:"พบการสแกนซ้ำ",
      TEMPORAL_CONFLICT:"ข้อมูลเวลาขัดแย้ง",
      STAFF_WITHOUT_CHECKIN:"มีการยืนยันโดยเจ้าหน้าที่แต่ไม่มีเวลาเข้า"
    };
    return labels[code] || code;
  }

  function evidenceReasonText(codes) {
    return (codes || []).map(code => evidenceReasonLabel(code)).join(" • ");
  }

  function recordOptionLabel(r) {
    const person = r.user?.employeeId || r.userId || "";
    const title = r.activity?.title || r.activityId || "";
    const inTime = r.checkinAt ? new Date(r.checkinAt).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}) : "—";
    const outTime = r.checkoutAt ? new Date(r.checkoutAt).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}) : "ยังไม่ออก";
    return person+" • "+title+" • "+inTime+" → "+outTime;
  }

  function activeDuplicateCount(rows) {
    const seen = new Set();
    let duplicates = 0;
    for (const r of rows) {
      const key = (r.user?.id || r.userId || "")+"|"+(r.activity?.id || r.activityId || "");
      if (seen.has(key)) duplicates++;
      else seen.add(key);
    }
    return duplicates;
  }

  function attendanceNeedsReview(r) {
    const system=evidenceStatusOf(r);
    const final=finalStatusOf(r);
    return ["REVIEW_REQUIRED","INCOMPLETE","INCONSISTENT"].includes(system) || final==="REJECTED";
  }

  function attendanceFilterMatch(r, filter) {
    if(filter==="ACTIVE") return Boolean(r.checkinAt) && !r.checkoutAt;
    if(filter==="CHECKED_OUT") return Boolean(r.checkoutAt);
    if(filter==="WAIT_STAFF") return Boolean(r.checkinAt) && !r.staffVerification;
    if(filter==="NEEDS_REVIEW") return attendanceNeedsReview(r);
    if(filter==="NOT_EVALUATED") return evidenceStatusOf(r)==="NOT_EVALUATED";
    if(filter==="VERIFIED") return ["VERIFIED","OVERRIDE_VERIFIED"].includes(finalStatusOf(r));
    return true;
  }

  function attendanceStateBadge(r) {
    if(attendanceNeedsReview(r)) return statusBadge("REVIEW_REQUIRED");
    if(["VERIFIED","OVERRIDE_VERIFIED"].includes(finalStatusOf(r))) return statusBadge(finalStatusOf(r));
    if(r.checkinAt && !r.checkoutAt) return '<span class="status s-info">กำลังเข้าร่วม</span>';
    if(r.checkoutAt && !r.staffVerification) return '<span class="status s-warn">รอเจ้าหน้าที่</span>';
    if(evidenceStatusOf(r)==="NOT_EVALUATED") return statusBadge("NOT_EVALUATED");
    return statusBadge(finalStatusOf(r));
  }

  function attendanceSummary(rows) {
    return {
      total:rows.length,
      active:rows.filter(r=>r.checkinAt&&!r.checkoutAt).length,
      checkedOut:rows.filter(r=>r.checkoutAt).length,
      staff:rows.filter(r=>r.staffVerification).length,
      needsReview:rows.filter(attendanceNeedsReview).length,
      notEvaluated:rows.filter(r=>evidenceStatusOf(r)==="NOT_EVALUATED").length,
      verified:rows.filter(r=>["VERIFIED","OVERRIDE_VERIFIED"].includes(finalStatusOf(r))).length
    };
  }

  function compactAttendanceCard(r, actionButtons) {
    const u=r.user||{};
    const c=r.consistencyResult;
    const reasons=[].concat(c?.missingCodes||[],c?.reasonCodes||[]);
    const pct=r.attendancePercentage==null?"—":Number(r.attendancePercentage).toFixed(1)+"%";
    const timeText=(r.checkinAt?new Date(r.checkinAt).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}):"—")+
      " → "+(r.checkoutAt?new Date(r.checkoutAt).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"}):"ยังไม่ออก");

    return '<details class="attendance-compact">'+
      '<summary>'+
        '<span class="compact-person"><b>'+esc(u.employeeId||"")+'</b><span>'+esc(u.name||"")+'</span></span>'+
        '<span class="compact-time">'+esc(timeText)+'</span>'+
        '<span class="compact-state">'+attendanceStateBadge(r)+'</span>'+
      '</summary>'+
      '<div class="compact-detail">'+
        '<div class="compact-evidence-grid">'+
          '<span><b>เข้า</b>'+fmt(r.checkinAt)+'</span>'+
          '<span><b>ออก</b>'+fmt(r.checkoutAt)+'</span>'+
          '<span><b>ระยะเวลา</b>'+pct+'</span>'+
          '<span><b>เจ้าหน้าที่</b>'+(r.staffVerification?"✓":"—")+'</span>'+
          '<span><b>ผลระบบ</b>'+statusBadge(evidenceStatusOf(r))+'</span>'+
          '<span><b>ผลสุดท้าย</b>'+statusBadge(finalStatusOf(r))+'</span>'+
        '</div>'+
        '<div class="compact-reason"><b>เหตุผล/ข้อสังเกต:</b> '+esc(evidenceReasonText(reasons)||"ไม่มี")+'</div>'+
        (actionButtons?'<div class="actions compact-actions">'+
          '<button class="btn mini secondary dashManageBtn" data-id="'+r.id+'">จัดการรายการ</button>'+
          '<button class="btn mini primary dashEvalBtn" data-id="'+r.id+'" '+(r.staffVerification?"":"title=\"ยังไม่มีการยืนยันโดยเจ้าหน้าที่\"")+'>ประเมินหลักฐาน</button>'+
        '</div>':'')+
      '</div>'+
    '</details>';
  }

  async function renderAttendance(v) {
    showLoading(v);
    const [activities, users, rows] = await Promise.all([loadActivities(), loadUsers(), loadAttendance()]);
    const participants = users.filter(u => u.role === "PARTICIPANT");
    let qrScanner = null;
    let scannerBusy = false;
    let checkoutScanner = null;
    let checkoutScannerBusy = false;

    v.innerHTML =
      '<div class="split"><div class="panel"><h2>Check-in</h2>'+
      '<div class="field"><label>กิจกรรม</label><select id="ciAct">'+activities.map(a => '<option value="'+a.id+'">'+esc(a.title)+'</option>').join("")+'</select></div>'+
      '<div class="field" style="margin-top:10px"><label>ผู้เข้าร่วม</label><select id="ciUser">'+participants.map(u => '<option value="'+esc(u.employeeId)+'">'+esc(u.employeeId+" • "+u.name)+'</option>').join("")+'</select></div>'+
      '<div class="actions scan-actions">'+
        '<button class="btn primary scan-btn" id="scanQrBtn">📷 สแกน QR</button>'+
        (appMode==="demo"?'<button class="btn demo-test" id="sameDeviceTestBtn">🧪 ทดสอบ QR บนเครื่องนี้</button>':'')+
        '<button class="btn secondary" id="manualTokenBtn">กรอก/วาง Token</button>'+
      '</div>'+
      (appMode==="demo"?'<div class="hint"><b>ทดสอบเครื่องเดียว:</b> เปิด Dynamic QR ไว้อีกแท็บในเบราว์เซอร์เดียวกัน แล้วกด “🧪 ทดสอบ QR บนเครื่องนี้” ระบบจะใช้ QR ล่าสุดที่ยังไม่หมดอายุผ่าน Check-in logic เดียวกัน และบันทึก Audit เป็น TEST/DEMO SCAN</div>':'')+
      '<div id="scannerPanel" class="scanner-panel" hidden>'+
        '<div class="scanner-head"><div><b>สแกน Dynamic QR</b><br><span class="muted">อนุญาตการใช้กล้อง แล้วเล็ง QR ให้อยู่กลางกรอบ</span></div><button class="btn secondary mini" id="stopQrBtn">ปิดกล้อง</button></div>'+
        '<div id="qrReader" class="qr-reader"></div>'+
        '<div id="qrScanMsg"></div>'+
      '</div>'+
      '<div class="field token-fallback" id="tokenField" hidden style="margin-top:10px"><label>Dynamic QR Token</label><textarea id="ciToken" placeholder="วาง token จาก Dynamic QR"></textarea></div>'+
      '<div class="actions"><button class="btn secondary" id="ciBtn">ยืนยัน Check-in จาก Token</button></div><div id="ciMsg"></div></div>'+
      '<div class="panel" id="recordActionsPanel"><h2>Check-out / Staff Verification</h2>'+
      '<div class="field"><label>รายการเข้าร่วม</label><select id="coRecord">'+rows.map(r => '<option value="'+r.id+'">'+esc(recordOptionLabel(r))+'</option>').join("")+'</select></div>'+
      '<div class="actions checkout-actions">'+
        '<button class="btn primary" id="coScanQrBtn">📷 สแกน Check-out QR</button>'+
        (appMode==="demo"?'<button class="btn demo-test" id="sameDeviceCheckoutTestBtn">🧪 ทดสอบ Check-out QR</button>':'')+
        '<button class="btn secondary" id="coManualTokenBtn">กรอก/วาง Check-out Token</button>'+
        (can("ADMIN","STAFF")?'<button class="btn warn" id="assistCheckoutBtn">Check-out กรณีพิเศษ</button>':'')+
        (can("ADMIN","ORGANIZER","STAFF")?'<button class="btn ok" id="staffBtn">เจ้าหน้าที่ยืนยัน</button>':'')+
        (can("ADMIN","STAFF")?'<button class="btn bad" id="voidBtn">ยกเลิกรายการผิด</button>':'')+
      '</div>'+
      '<div id="checkoutScannerPanel" class="scanner-panel" hidden>'+
        '<div class="scanner-head"><div><b>สแกน Dynamic Check-out QR</b><br><span class="muted">ต้องเป็น QR ประเภท CHECKOUT ของกิจกรรมเดียวกันและอยู่ใน Check-out Window</span></div><button class="btn secondary mini" id="stopCheckoutQrBtn">ปิดกล้อง</button></div>'+
        '<div id="checkoutQrReader" class="qr-reader"></div><div id="checkoutQrScanMsg"></div>'+
      '</div>'+
      '<div class="field token-fallback" id="coTokenField" hidden style="margin-top:10px"><label>Dynamic Check-out QR Token</label><textarea id="coToken" placeholder="วาง CHECKOUT token"></textarea>'+
        '<div class="actions"><button class="btn secondary" id="coBtn">ยืนยัน Check-out จาก Token</button></div></div>'+
      '<div class="hint">Check-out ปกติต้องใช้ Dynamic CHECKOUT QR ณ จุดกิจกรรม หากสแกนไม่ได้จริง เจ้าหน้าที่/ผู้ดูแลระบบใช้ “Check-out กรณีพิเศษ” พร้อมเหตุผล และรายการจะถูกส่งให้ตรวจสอบ</div>'+
      '<div id="coMsg"></div></div></div>'+
      ((()=>{const seen=new Set();let dup=0;for(const r of rows){const k=(r.user?.id||r.userId)+"|"+(r.activity?.id||r.activityId);if(seen.has(k))dup++;else seen.add(k);}return dup>0&&can("ADMIN","STAFF")?'<div class="alert warn"><b>พบรายการซ้ำจากข้อมูล Demo เก่า '+dup+' รายการ</b><br>เลือกแถวที่ผิดจากรายการด้านบน แล้วกด “ยกเลิกรายการผิด” ระบบจะเก็บ Audit Trail ไว้</div>':'';})())+
      '<div class="panel"><div id="attendanceDashboard"></div></div>';


    const storedAttendanceActivity=sessionStorage.getItem(SELECTED_ACTIVITY_KEY);
    const ciActivitySelect=document.getElementById("ciAct");
    if(storedAttendanceActivity&&ciActivitySelect&&[...ciActivitySelect.options].some(o=>o.value===storedAttendanceActivity)){
      ciActivitySelect.value=storedAttendanceActivity;
    }

    const dashboardState={
      activityId:document.getElementById("ciAct")?.value || activities[0]?.id || "",
      filter:"AUTO",
      search:"",
      page:1,
      pageSize:20
    };

    function renderAttendanceDashboard() {
      const host=document.getElementById("attendanceDashboard");
      if(!host) return;

      const activityOptions=activities.map(a=>'<option value="'+esc(a.id)+'" '+(a.id===dashboardState.activityId?'selected':'')+'>'+esc(a.title)+'</option>').join("");
      const eventRows=rows.filter(r=>!dashboardState.activityId || (r.activity?.id||r.activityId)===dashboardState.activityId);
      const summary=attendanceSummary(eventRows);

      if(dashboardState.filter==="AUTO"){
        dashboardState.filter=(can("ADMIN","ORGANIZER","STAFF")&&summary.needsReview>0)?"NEEDS_REVIEW":"ALL";
      }

      const term=dashboardState.search.trim().toLowerCase();
      let filtered=eventRows.filter(r=>{
        if(!attendanceFilterMatch(r,dashboardState.filter)) return false;
        if(!term) return true;
        const hay=[r.user?.employeeId,r.user?.name,r.userId].filter(Boolean).join(" ").toLowerCase();
        return hay.includes(term);
      });

      filtered=filtered.sort((a,b)=>{
        const ap=attendanceNeedsReview(a)?0:(!a.staffVerification?1:2);
        const bp=attendanceNeedsReview(b)?0:(!b.staffVerification?1:2);
        if(ap!==bp) return ap-bp;
        return new Date(b.checkinAt||0)-new Date(a.checkinAt||0);
      });

      const pages=Math.max(1,Math.ceil(filtered.length/dashboardState.pageSize));
      dashboardState.page=Math.min(Math.max(1,dashboardState.page),pages);
      const start=(dashboardState.page-1)*dashboardState.pageSize;
      const pageRows=filtered.slice(start,start+dashboardState.pageSize);

      const filters=[
        ["ALL","ทั้งหมด",summary.total],
        ["ACTIVE","กำลังเข้าร่วม",summary.active],
        ["CHECKED_OUT","ออกแล้ว",summary.checkedOut],
        ["WAIT_STAFF","รอเจ้าหน้าที่",eventRows.filter(r=>attendanceFilterMatch(r,"WAIT_STAFF")).length],
        ["NEEDS_REVIEW","ต้องตรวจสอบ",summary.needsReview],
        ["NOT_EVALUATED","ยังไม่ประเมิน",summary.notEvaluated],
        ["VERIFIED","รับรองแล้ว",summary.verified]
      ];

      host.innerHTML=
        '<div class="event-dashboard-head"><div><h2>ภาพรวมผู้เข้าร่วมรายกิจกรรม</h2><p class="muted">เลือกกิจกรรมก่อน แล้วดูเฉพาะรายการที่ต้องจัดการ — รายละเอียดแต่ละคนถูกยุบไว้เพื่อรองรับกิจกรรมที่มีผู้เข้าร่วมจำนวนมาก</p></div></div>'+
        '<div class="event-toolbar">'+
          '<div class="field"><label>กิจกรรม</label><select id="dashActivity">'+activityOptions+'</select></div>'+
          '<div class="field"><label>ค้นหารหัส/ชื่อบุคลากร</label><input id="dashSearch" value="'+esc(dashboardState.search)+'" placeholder="เช่น T004 หรือชื่อบุคลากร"></div>'+
        '</div>'+
        '<div class="event-summary-grid">'+
          '<div class="event-stat"><b>'+summary.total+'</b><span>รายการทั้งหมด</span></div>'+
          '<div class="event-stat"><b>'+summary.active+'</b><span>กำลังเข้าร่วม</span></div>'+
          '<div class="event-stat"><b>'+summary.checkedOut+'</b><span>ออกแล้ว</span></div>'+
          '<div class="event-stat"><b>'+summary.staff+'</b><span>เจ้าหน้าที่ยืนยัน</span></div>'+
          '<div class="event-stat alert-stat"><b>'+summary.needsReview+'</b><span>ต้องตรวจสอบ</span></div>'+
          '<div class="event-stat"><b>'+summary.verified+'</b><span>รับรองแล้ว</span></div>'+
        '</div>'+
        '<div class="filter-chips">'+filters.map(([key,label,count])=>
          '<button class="filter-chip '+(dashboardState.filter===key?'active':'')+'" data-filter="'+key+'">'+esc(label)+' <span>'+count+'</span></button>'
        ).join("")+'</div>'+
        '<div class="result-meta">แสดง '+pageRows.length+' จาก '+filtered.length+' รายการ'+
          (dashboardState.filter==="NEEDS_REVIEW"?'<span class="exception-note"> • โหมด Exception-first</span>':'')+
        '</div>'+
        '<div class="compact-list">'+
          (pageRows.length?pageRows.map(r=>compactAttendanceCard(r,can("ADMIN","ORGANIZER","STAFF"))).join(""):'<div class="empty">ไม่พบรายการตามตัวกรอง</div>')+
        '</div>'+
        '<div class="pagination">'+
          '<button class="btn secondary mini" id="dashPrev" '+(dashboardState.page<=1?'disabled':'')+'>ก่อนหน้า</button>'+
          '<span>หน้า '+dashboardState.page+' / '+pages+'</span>'+
          '<button class="btn secondary mini" id="dashNext" '+(dashboardState.page>=pages?'disabled':'')+'>ถัดไป</button>'+
        '</div>';

      document.getElementById("dashActivity").onchange=(e)=>{
        dashboardState.activityId=e.target.value;
        dashboardState.filter="AUTO";
        dashboardState.search="";
        dashboardState.page=1;
        renderAttendanceDashboard();
      };

      document.getElementById("dashSearch").oninput=(e)=>{
        dashboardState.search=e.target.value;
        dashboardState.page=1;
        renderAttendanceDashboard();
        const next=document.getElementById("dashSearch");
        if(next){ next.focus(); next.setSelectionRange(next.value.length,next.value.length); }
      };

      host.querySelectorAll(".filter-chip").forEach(btn=>btn.onclick=()=>{
        dashboardState.filter=btn.dataset.filter;
        dashboardState.page=1;
        renderAttendanceDashboard();
      });

      const prev=document.getElementById("dashPrev");
      const next=document.getElementById("dashNext");
      if(prev) prev.onclick=()=>{dashboardState.page--;renderAttendanceDashboard();};
      if(next) next.onclick=()=>{dashboardState.page++;renderAttendanceDashboard();};

      host.querySelectorAll(".dashManageBtn").forEach(btn=>btn.onclick=()=>{
        const select=document.getElementById("coRecord");
        if(select){
          select.value=btn.dataset.id;
          syncRecordActions();
          document.getElementById("recordActionsPanel")?.scrollIntoView({behavior:"smooth",block:"start"});
        }
      });

      host.querySelectorAll(".dashEvalBtn").forEach(btn=>btn.onclick=async()=>{
        btn.disabled=true;
        try{
          await api("/api/evidence/"+encodeURIComponent(btn.dataset.id)+"/evaluate",{method:"POST"});
          await renderAttendance(v);
        }catch(e){
          btn.disabled=false;
          alert(e.message);
        }
      });
    }

    renderAttendanceDashboard();

    async function stopScanner() {
      if (!qrScanner) return;
      try {
        const state = qrScanner.getState ? qrScanner.getState() : null;
        if (state !== 1) await qrScanner.stop();
      } catch {}
      try { await qrScanner.clear(); } catch {}
      qrScanner = null;
      scannerBusy = false;
      const panel = document.getElementById("scannerPanel");
      if (panel) panel.hidden = true;
    }

    async function performCheckin(token, source, testMode=false) {
      const msg = document.getElementById("ciMsg");
      if (!token) {
        msg.innerHTML = '<div class="alert warn">ยังไม่มีข้อมูล QR/Token</div>';
        return;
      }
      try {
        const result = await api("/api/attendance/checkin", {
          method:"POST",
          body:JSON.stringify({
            userId:document.getElementById("ciUser").value,
            token:String(token).trim(),
            scanSource:String(source||"QR"),
            testMode:Boolean(testMode)
          })
        });
        msg.innerHTML =
          '<div class="alert ok"><b>Check-in สำเร็จ</b><br>อ่านจาก '+esc(source||"QR")+
          ' • เวลา '+esc(fmt(result.attendance.checkinAt))+
          (testMode?'<br><b>สถานะ:</b> TEST/DEMO SCAN — ไม่ใช่การสแกนกล้องจริง':'')+
          '</div>';
        await stopScanner();
        setTimeout(() => renderAttendance(v), 900);
      } catch (e) {
        if (e?.message === "ALREADY_CHECKED_IN") {
          msg.innerHTML = '<div class="alert warn"><b>Check-in แล้ว</b><br>กิจกรรมนี้มีรายการ Check-in อยู่แล้ว จึงไม่สร้างรายการซ้ำ</div>';
        } else if (e?.message === "ACTIVITY_ALREADY_COMPLETED") {
          msg.innerHTML = '<div class="alert ok"><b>กิจกรรมนี้บันทึกเข้า–ออกแล้ว</b><br>ไม่ต้อง Check-in ซ้ำ ให้ดำเนินการ Staff Verification / Evidence Review ต่อ</div>';
        } else if (e?.message === "QR_CHECKIN_NOT_OPEN") {
          msg.innerHTML = '<div class="alert warn"><b>ยังไม่ถึงเวลา Check-in</b><br>เปิด '+esc(fmt(e.data?.checkinOpenAt))+' ถึง '+esc(fmt(e.data?.checkinCloseAt))+'</div>';
          await stopScanner();
        } else if (e?.message === "QR_CHECKIN_CLOSED") {
          msg.innerHTML = '<div class="alert bad"><b>หมดเวลา Check-in แล้ว</b><br>หากมีเหตุจำเป็นให้ติดต่อผู้จัดกิจกรรม/เจ้าหน้าที่</div>';
          await stopScanner();
        } else if (e?.message === "INVALID_OR_EXPIRED_DEMO_QR" || e?.message === "TOKEN_EXPIRED") {
          msg.innerHTML = '<div class="alert warn"><b>QR ใช้ไม่ได้หรือหมดอายุ</b><br>ให้สแกน Dynamic QR ใบล่าสุดอีกครั้ง</div>';
          await stopScanner();
        } else if (e?.message === "INVALID_DEMO_QR_CLOCK") {
          msg.innerHTML = '<div class="alert warn"><b>เวลาในอุปกรณ์ไม่สอดคล้องกัน</b><br>ตรวจการตั้งวันที่/เวลาอัตโนมัติของมือถือทั้งสองเครื่อง แล้วสแกนใหม่</div>';
          await stopScanner();
        } else {
          msg.innerHTML = errorBox(e);
        }
      }
    }

    document.getElementById("ciAct")?.addEventListener("change",(e)=>{
      dashboardState.activityId=e.target.value;
      dashboardState.filter="AUTO";
      dashboardState.page=1;
      renderAttendanceDashboard();
    });

    const sameDeviceTestBtn=document.getElementById("sameDeviceTestBtn");
    if(sameDeviceTestBtn) sameDeviceTestBtn.onclick=async()=>{
      const msg=document.getElementById("ciMsg");
      sameDeviceTestBtn.disabled=true;
      sameDeviceTestBtn.textContent="กำลังหา QR ล่าสุด…";
      try{
        const latest=await api("/api/demo/latest-qr?purpose=CHECKIN");
        const select=document.getElementById("ciAct");
        if(select && latest.activity){
          let option=[...select.options].find(o=>o.value===latest.activity.id);
          if(!option){
            option=document.createElement("option");
            option.value=latest.activity.id;
            option.textContent=latest.activity.title;
            select.appendChild(option);
          }
          select.value=latest.activity.id;
        }
        msg.innerHTML='<div class="alert">พบ QR ล่าสุดของ <b>'+esc(latest.activity?.title||"กิจกรรม")+'</b> กำลังจำลองการสแกน…</div>';
        await performCheckin(latest.token,"TEST/DEMO SCAN",true);
      }catch(e){
        if(e?.message==="DEMO_ACTIVE_QR_NOT_FOUND"){
          msg.innerHTML='<div class="alert warn"><b>ไม่พบ Dynamic QR ที่ยังใช้งานได้</b><br>เปิดอีกแท็บเป็นผู้จัดกิจกรรม → หน้า Dynamic QR แล้วสร้าง/หมุน QR ใหม่ จากนั้นกลับมากดปุ่มนี้ภายใน 45 วินาที</div>';
        }else{
          msg.innerHTML=errorBox(e);
        }
      }finally{
        if(document.body.contains(sameDeviceTestBtn)){
          sameDeviceTestBtn.disabled=false;
          sameDeviceTestBtn.textContent="🧪 ทดสอบ QR บนเครื่องนี้";
        }
      }
    };

    document.getElementById("manualTokenBtn").onclick = () => {
      const field = document.getElementById("tokenField");
      field.hidden = !field.hidden;
      if (!field.hidden) document.getElementById("ciToken").focus();
    };

    document.getElementById("ciBtn").onclick = async () => {
      await performCheckin(document.getElementById("ciToken").value, "Token ที่กรอก");
    };

    document.getElementById("scanQrBtn").onclick = async () => {
      const scanMsg = document.getElementById("qrScanMsg");
      const panel = document.getElementById("scannerPanel");
      panel.hidden = false;

      if (!window.isSecureContext) {
        scanMsg.innerHTML = '<div class="alert bad">กล้องต้องเปิดผ่าน HTTPS หรือ localhost</div>';
        return;
      }
      if (!window.Html5Qrcode) {
        scanMsg.innerHTML = '<div class="alert bad">โหลดตัวอ่าน QR ไม่สำเร็จ กรุณารีเฟรชหน้า</div>';
        return;
      }
      if (scannerBusy) return;

      scannerBusy = true;
      scanMsg.innerHTML = '<div class="alert">กำลังเปิดกล้อง…</div>';
      try {
        qrScanner = new Html5Qrcode("qrReader");
        await qrScanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 },
          async (decodedText) => {
            if (!scannerBusy) return;
            scannerBusy = false;
            scanMsg.innerHTML = '<div class="alert ok">อ่าน QR สำเร็จ กำลัง Check-in…</div>';
            const tokenBox = document.getElementById("ciToken");
            if (tokenBox) tokenBox.value = decodedText;
            await performCheckin(decodedText, "กล้องสแกน QR");
          },
          () => {}
        );
        scanMsg.innerHTML = '<div class="alert ok">กล้องพร้อมแล้ว — เล็ง QR ให้อยู่ในกรอบ</div>';
      } catch (e) {
        scannerBusy = false;
        qrScanner = null;
        const name = String(e?.name || "");
        const detail = String(e?.message || e || "");
        let hint = detail;
        if (/NotAllowed|Permission/i.test(name+" "+detail)) hint = "ไม่ได้รับอนุญาตให้ใช้กล้อง กรุณาอนุญาต Camera permission ในเบราว์เซอร์";
        if (/NotFound/i.test(name+" "+detail)) hint = "ไม่พบกล้องบนอุปกรณ์นี้";
        scanMsg.innerHTML = '<div class="alert bad"><b>เปิดกล้องไม่สำเร็จ</b><br>'+esc(hint)+'</div>';
      }
    };

    document.getElementById("stopQrBtn").onclick = stopScanner;

    async function stopCheckoutScanner(){
      if(!checkoutScanner)return;
      try{
        const state=checkoutScanner.getState?checkoutScanner.getState():null;
        if(state!==1)await checkoutScanner.stop();
      }catch{}
      try{await checkoutScanner.clear();}catch{}
      checkoutScanner=null;
      checkoutScannerBusy=false;
      const panel=document.getElementById("checkoutScannerPanel");
      if(panel)panel.hidden=true;
    }

    async function performCheckout(token,source,testMode=false){
      const id=document.getElementById("coRecord").value;
      const msg=document.getElementById("coMsg");
      if(!id)return msg.innerHTML='<div class="alert warn">ยังไม่มีรายการสำหรับ Check-out</div>';
      if(!token)return msg.innerHTML='<div class="alert warn">กรุณาสแกนหรือวาง Check-out QR Token ก่อน</div>';
      try{
        const result=await api("/api/attendance/"+encodeURIComponent(id)+"/checkout",{
          method:"POST",
          body:JSON.stringify({token:String(token).trim(),scanSource:String(source||"QR"),testMode:Boolean(testMode)})
        });
        msg.innerHTML='<div class="alert ok"><b>Check-out สำเร็จ</b><br>อ่านจาก '+esc(source||"QR")+
          ' • เวลา '+esc(fmt(result.attendance.checkoutAt))+
          (testMode?'<br><b>สถานะ:</b> TEST/DEMO SCAN — ไม่ใช่การสแกนกล้องจริง':'')+'</div>';
        await stopCheckoutScanner();
        setTimeout(()=>renderAttendance(v),650);
      }catch(e){
        if(e?.message==="ALREADY_CHECKED_OUT"){
          msg.innerHTML='<div class="alert ok">รายการนี้ Check-out ไปแล้ว ไม่ต้องทำซ้ำ</div>';
        }else if(e?.message==="CHECKOUT_QR_REQUIRED"){
          msg.innerHTML='<div class="alert warn"><b>ต้องใช้ Check-out QR</b><br>สแกน Dynamic QR ประเภท CHECKOUT ของกิจกรรมนี้</div>';
        }else if(e?.message==="QR_PURPOSE_MISMATCH"){
          msg.innerHTML='<div class="alert bad"><b>ใช้ QR ผิดประเภท</b><br>Check-out ต้องใช้ QR ประเภท CHECKOUT เท่านั้น</div>';
        }else if(e?.message==="CHECKOUT_QR_ACTIVITY_MISMATCH"){
          msg.innerHTML='<div class="alert bad"><b>QR เป็นคนละกิจกรรม</b><br>เลือก/สแกน Check-out QR ของกิจกรรมเดียวกับรายการนี้</div>';
        }else if(e?.message==="QR_CHECKOUT_NOT_OPEN"){
          msg.innerHTML='<div class="alert warn"><b>ยังไม่ถึงเวลา Check-out</b><br>เปิด '+esc(fmt(e.data?.checkoutOpenAt))+' ถึง '+esc(fmt(e.data?.checkoutCloseAt))+'</div>';
        }else if(e?.message==="QR_CHECKOUT_CLOSED"){
          msg.innerHTML='<div class="alert bad"><b>หมดเวลา Check-out แล้ว</b><br>หากมีเหตุจำเป็นให้เจ้าหน้าที่ใช้ Check-out กรณีพิเศษพร้อมเหตุผล</div>';
        }else if(["INVALID_OR_EXPIRED_DEMO_QR","EXPIRED_TOKEN","TOKEN_EXPIRED"].includes(e?.message)){
          msg.innerHTML='<div class="alert warn"><b>Check-out QR หมดอายุ</b><br>สแกน Dynamic Check-out QR ใบล่าสุดอีกครั้ง</div>';
        }else{
          msg.innerHTML=errorBox(e);
        }
      }
    }

    function syncRecordActions() {
      const select=document.getElementById("coRecord");
      const scan=document.getElementById("coScanQrBtn");
      const testBtn=document.getElementById("sameDeviceCheckoutTestBtn");
      const assist=document.getElementById("assistCheckoutBtn");
      const staff=document.getElementById("staffBtn");
      const voidBtn=document.getElementById("voidBtn");
      const co=document.getElementById("coBtn");
      if(!select)return;
      const selected=rows.find(r=>r.id===select.value);
      const done=Boolean(selected?.checkoutAt);
      if(scan){scan.disabled=!selected||done;scan.textContent=done?"Check-out แล้ว":"📷 สแกน Check-out QR";}
      if(testBtn)testBtn.disabled=!selected||done;
      if(assist)assist.disabled=!selected||done;
      if(co)co.disabled=!selected||done;
      if(staff){
        staff.disabled=!selected||Boolean(selected?.staffVerification);
        staff.textContent=selected?.staffVerification?"เจ้าหน้าที่ยืนยันแล้ว":"เจ้าหน้าที่ยืนยัน";
      }
      if(voidBtn)voidBtn.disabled=!selected;
    }
    document.getElementById("coRecord").onchange=syncRecordActions;
    syncRecordActions();

    document.getElementById("coManualTokenBtn").onclick=()=>{
      const field=document.getElementById("coTokenField");
      field.hidden=!field.hidden;
      if(!field.hidden)document.getElementById("coToken").focus();
    };

    document.getElementById("coBtn").onclick=async()=>{
      await performCheckout(document.getElementById("coToken").value,"Token ที่กรอก");
    };

    document.getElementById("coScanQrBtn").onclick=async()=>{
      const panel=document.getElementById("checkoutScannerPanel");
      const scanMsg=document.getElementById("checkoutQrScanMsg");
      panel.hidden=false;
      if(!window.isSecureContext){
        scanMsg.innerHTML='<div class="alert bad">กล้องต้องเปิดผ่าน HTTPS หรือ localhost</div>';return;
      }
      if(!window.Html5Qrcode){
        scanMsg.innerHTML='<div class="alert bad">โหลดตัวอ่าน QR ไม่สำเร็จ กรุณารีเฟรชหน้า</div>';return;
      }
      if(checkoutScannerBusy)return;
      checkoutScannerBusy=true;
      scanMsg.innerHTML='<div class="alert">กำลังเปิดกล้อง…</div>';
      try{
        checkoutScanner=new Html5Qrcode("checkoutQrReader");
        await checkoutScanner.start(
          {facingMode:"environment"},
          {fps:10,qrbox:{width:250,height:250},aspectRatio:1.0},
          async(decodedText)=>{
            if(!checkoutScannerBusy)return;
            checkoutScannerBusy=false;
            scanMsg.innerHTML='<div class="alert ok">อ่าน QR สำเร็จ กำลัง Check-out…</div>';
            const box=document.getElementById("coToken");if(box)box.value=decodedText;
            await performCheckout(decodedText,"กล้องสแกน Check-out QR");
          },
          ()=>{}
        );
        scanMsg.innerHTML='<div class="alert ok">กล้องพร้อมแล้ว — เล็ง CHECKOUT QR ให้อยู่ในกรอบ</div>';
      }catch(e){
        checkoutScannerBusy=false;checkoutScanner=null;
        const detail=String(e?.message||e||"");
        scanMsg.innerHTML='<div class="alert bad"><b>เปิดกล้องไม่สำเร็จ</b><br>'+esc(detail)+'</div>';
      }
    };

    document.getElementById("stopCheckoutQrBtn").onclick=stopCheckoutScanner;

    const sameDeviceCheckoutTestBtn=document.getElementById("sameDeviceCheckoutTestBtn");
    if(sameDeviceCheckoutTestBtn)sameDeviceCheckoutTestBtn.onclick=async()=>{
      const msg=document.getElementById("coMsg");
      sameDeviceCheckoutTestBtn.disabled=true;
      sameDeviceCheckoutTestBtn.textContent="กำลังหา Check-out QR…";
      try{
        const latest=await api("/api/demo/latest-qr?purpose=CHECKOUT");
        const matching=rows.find(r=>(r.activity?.id||r.activityId)===latest.activity?.id&&!r.checkoutAt);
        if(matching){
          document.getElementById("coRecord").value=matching.id;
          syncRecordActions();
        }
        msg.innerHTML='<div class="alert">พบ Check-out QR ล่าสุดของ <b>'+esc(latest.activity?.title||"กิจกรรม")+'</b> กำลังจำลองการสแกน…</div>';
        await performCheckout(latest.token,"TEST/DEMO CHECKOUT SCAN",true);
      }catch(e){
        if(e?.message==="DEMO_ACTIVE_QR_NOT_FOUND"){
          msg.innerHTML='<div class="alert warn"><b>ไม่พบ Check-out QR ที่ยังใช้งานได้</b><br>อีกแท็บให้ผู้จัดเลือก “QR สำหรับ Check-out” และสร้าง/หมุน QR ใหม่ในช่วง Check-out Window</div>';
        }else msg.innerHTML=errorBox(e);
      }finally{
        if(document.body.contains(sameDeviceCheckoutTestBtn)){
          sameDeviceCheckoutTestBtn.disabled=false;
          sameDeviceCheckoutTestBtn.textContent="🧪 ทดสอบ Check-out QR";
        }
      }
    };

    const assistCheckoutBtn=document.getElementById("assistCheckoutBtn");
    if(assistCheckoutBtn)assistCheckoutBtn.onclick=async()=>{
      const id=document.getElementById("coRecord").value;
      const msg=document.getElementById("coMsg");
      if(!id)return;
      const reason=prompt("ระบุเหตุผล Check-out กรณีพิเศษอย่างน้อย 10 ตัวอักษร เช่น ออกจากงานก่อนเวลาเพราะมีภารกิจราชการ");
      if(reason===null)return;
      if(reason.trim().length<10){
        msg.innerHTML='<div class="alert warn">กรุณาระบุเหตุผลอย่างน้อย 10 ตัวอักษร</div>';return;
      }
      try{
        await api("/api/attendance/"+encodeURIComponent(id)+"/checkout-assist",{
          method:"POST",body:JSON.stringify({reason:reason.trim()})
        });
        msg.innerHTML='<div class="alert warn"><b>บันทึก Check-out กรณีพิเศษแล้ว</b><br>รายการนี้ไม่มี Dynamic Checkout QR และจะถูกส่งให้ตรวจสอบหลักฐาน</div>';
        setTimeout(()=>renderAttendance(v),650);
      }catch(e){msg.innerHTML=errorBox(e);}
    };

    const voidBtn = document.getElementById("voidBtn");
    if (voidBtn) voidBtn.onclick = async () => {
      const id=document.getElementById("coRecord").value;
      const msg=document.getElementById("coMsg");
      if(!id) return;
      const reason=prompt("ระบุเหตุผลที่ยกเลิกรายการนี้ เช่น Check-in ซ้ำจากการทดสอบ");
      if(reason===null) return;
      if(reason.trim().length<5){
        msg.innerHTML='<div class="alert warn">กรุณาระบุเหตุผลอย่างน้อย 5 ตัวอักษร</div>';
        return;
      }
      try{
        await api("/api/attendance/"+encodeURIComponent(id)+"/void",{method:"POST",body:JSON.stringify({reason:reason.trim()})});
        msg.innerHTML='<div class="alert ok">ยกเลิกรายการผิดแล้ว และเก็บ Audit Trail ไว้</div>';
        setTimeout(()=>renderAttendance(v),450);
      }catch(e){msg.innerHTML=errorBox(e);}
    };

    const staffBtn = document.getElementById("staffBtn");
    if (staffBtn) staffBtn.onclick = async () => {
      const id = document.getElementById("coRecord").value;
      const msg = document.getElementById("coMsg");
      if (!id) return msg.innerHTML = '<div class="alert warn">ยังไม่มีรายการสำหรับยืนยัน</div>';
      try {
        await api("/api/attendance/"+encodeURIComponent(id)+"/staff-verify", {method:"POST"});
        msg.innerHTML = '<div class="alert ok">บันทึกการยืนยันโดยเจ้าหน้าที่แล้ว</div>';
        setTimeout(() => renderAttendance(v), 350);
      } catch (e) { msg.innerHTML = errorBox(e); }
    };

  }

  async function renderEvidence(v) {
    showLoading(v);
    const rows = await loadAttendance();
    const duplicateCount = activeDuplicateCount(rows);
    const rowHtml = rows.map(r => {
      const c=r.consistencyResult;
      const reasons=[].concat(c?.missingCodes||[],c?.reasonCodes||[]);
      return '<tr><td>'+esc((r.user?.employeeId||"")+" • "+(r.user?.name||""))+'</td>'+
        '<td>'+(r.qrValid?"✓":"✕")+'</td><td>'+(r.identityVerified?"✓":"✕")+'</td><td>'+(r.checkinAt?"✓":"✕")+'</td><td>'+(r.checkoutAt?"✓":"✕")+'</td>'+
        '<td>'+(r.checkoutQrValid?"✓":"✕")+'</td><td>'+(c?.durationRatio==null?"—":(Number(c.durationRatio)*100).toFixed(1)+"%")+'</td><td>'+(r.staffVerification?"✓":"✕")+'</td>'+
        '<td>'+statusBadge(evidenceStatusOf(r))+'</td><td>'+statusBadge(finalStatusOf(r))+'</td><td>'+esc(evidenceReasonText(reasons)||"—")+'</td></tr>';
    }).join("");

    const cards=rows.map(r=>{
      const c=r.consistencyResult;
      const reasons=[].concat(c?.missingCodes||[],c?.reasonCodes||[]);
      return '<article class="evidence-card"><div class="attendance-card-head"><div><b>'+esc(r.user?.employeeId||"")+'</b><div>'+esc(r.user?.name||"")+'</div></div>'+statusBadge(evidenceStatusOf(r))+'</div>'+
        '<div class="attendance-card-title">'+esc(r.activity?.title||"")+'</div>'+
        '<div class="evidence-grid"><span>Check-in QR <b>'+(r.qrValid?"✓":"✕")+'</b></span><span>ตัวตน <b>'+(r.identityVerified?"✓":"✕")+'</b></span>'+
        '<span>เข้า <b>'+(r.checkinAt?"✓":"✕")+'</b></span><span>ออก <b>'+(r.checkoutAt?"✓":"✕")+'</b></span>'+
        '<span>Check-out QR <b>'+(r.checkoutQrValid?"✓":"✕")+'</b></span>'+
        '<span>ระยะเวลา <b>'+(c?.durationRatio==null?"—":(Number(c.durationRatio)*100).toFixed(1)+"%")+'</b></span><span>Staff <b>'+(r.staffVerification?"✓":"✕")+'</b></span></div>'+
        '<div class="evidence-final">ผลตัดสินสุดท้าย '+statusBadge(finalStatusOf(r))+'</div>'+
        '<div class="muted">'+esc(evidenceReasonText(reasons)||"ยังไม่มีเหตุผลผิดปกติ")+'</div></article>';
    }).join("");

    v.innerHTML =
      '<div class="panel"><div class="section-head"><div><h2>ตารางตรวจสอบหลักฐาน</h2><p class="muted"><b>ผลตรวจหลักฐานของระบบ</b> คือผลจากกฎตรวจสอบ ส่วน <b>ผลตัดสินสุดท้าย</b> คือผลจากผู้ตรวจสอบ — แยกกันเสมอ</p></div>'+
      (can("ADMIN","ORGANIZER","STAFF")?'<button class="btn primary" id="evalAll" '+(duplicateCount>0?'disabled':'')+'>ประเมินหลักฐานทั้งหมดที่มองเห็น</button>':'')+
      '</div>'+
      (duplicateCount>0?'<div class="alert warn"><b>พบข้อมูลซ้ำ '+duplicateCount+' รายการ</b><br>กรุณาไปเมนู “เข้า–ออก” แล้วใช้ “ยกเลิกรายการผิด” ก่อนประเมินหลักฐาน เพื่อไม่ให้ข้อมูลซ้ำเข้าสู่ Ground Truth/งานวิจัย</div>':'')+
      '<div class="table-wrap desktop-attendance"><table><thead><tr><th>บุคลากร</th><th>Check-in QR</th><th>ตัวตน</th><th>เข้า</th><th>ออก</th><th>Check-out QR</th><th>ระยะเวลา</th><th>เจ้าหน้าที่</th><th>ผลตรวจหลักฐานของระบบ</th><th>ผลตัดสินสุดท้าย</th><th>เหตุผล</th></tr></thead><tbody>'+rowHtml+'</tbody></table></div>'+
      '<div class="attendance-cards">'+cards+'</div></div>';

    const evalAll=document.getElementById("evalAll");
    if(evalAll) evalAll.onclick=async()=>{
      evalAll.disabled=true;evalAll.textContent="กำลังประเมิน…";
      for(const r of rows){try{await api("/api/evidence/"+encodeURIComponent(r.id)+"/evaluate",{method:"POST"});}catch{}}
      await renderEvidence(v);
    };
  }

  function reviewWorkflowStatus(r){
    const latest=(r.humanReviews||[])[0]||null;
    if(finalStatusOf(r)==="VERIFIED")return "VERIFIED";
    if(finalStatusOf(r)==="OVERRIDE_VERIFIED")return "OVERRIDE_VERIFIED";
    if(finalStatusOf(r)==="REJECTED")return "REJECTED";
    if(latest?.decision==="REQUEST_EVIDENCE")return "WAIT_PARTICIPANT";
    if(latest?.decision==="CORRECT")return "RETURNED";
    const c=r.consistencyResult;
    if(!c)return "NOT_READY";
    const blockers=[...(c.missingCodes||[]),...(c.reasonCodes||[])];
    if(blockers.length)return "PENDING_REVIEW";
    return "READY_DECISION";
  }

  function reviewWorkflowLabel(status){
    return ({
      PENDING_REVIEW:"รอตรวจ",
      WAIT_PARTICIPANT:"รอข้อมูลจากผู้เข้าร่วม",
      RETURNED:"ส่งกลับแก้ไข",
      READY_DECISION:"พร้อมตัดสิน",
      VERIFIED:"รับรองแล้ว",
      OVERRIDE_VERIFIED:"รับรองกรณีพิเศษ",
      REJECTED:"ไม่รับรอง",
      NOT_READY:"รอประเมินหลักฐาน"
    })[status]||status;
  }

  function reviewAiRisk(prediction){
    const value=Number(prediction?.riskProbability);
    return Number.isFinite(value)?Math.max(0,Math.min(1,value)):null;
  }

  function reviewAiBadge(prediction){
    const risk=reviewAiRisk(prediction);
    if(risk===null)return '<span class="muted">ยังไม่มี AI score</span>';
    const flagged=prediction?.modelFlaggedForReview===true||prediction?.predictedLabel==="REVIEW_REQUIRED";
    return '<span class="status '+(flagged?"s-warn":"s-info")+'">AI Priority '+Math.round(risk*100)+'%</span>';
  }

  async function renderReview(v) {
    if (!can("ADMIN","STAFF")) throw new Error("FORBIDDEN");
    showLoading(v);
    const [rows,activities,xaiData]=await Promise.all([
      loadAttendance(),
      loadActivities(),
      api("/api/xai/queue").catch(()=>({deployedModel:null,records:[],decisionSupportOnly:true}))
    ]);
    const deployedModel=xaiData?.deployedModel||null;
    const riskByAttendance=new Map((xaiData?.records||[]).map(p=>[p.attendanceId,p]));
    const state={activityId:"ALL",filter:"PENDING",search:"",page:1,pageSize:20};
    const stored=sessionStorage.getItem(SELECTED_ACTIVITY_KEY);
    if(stored&&activities.some(a=>a.id===stored))state.activityId=stored;
    let personalScanner=null,personalScannerBusy=false;

    v.innerHTML=
      '<div class="panel"><div class="section-head"><div><h2>Human Review Queue</h2>'+
      '<p class="muted">Review Queue เป็นวิธีหลัก • Personal QR ใช้เพียงค้นหา/เปิด case เมื่อบุคคลอยู่ตรงหน้า ไม่ต้องสแกนครบทุกคน</p></div>'+
      '<div class="hint">'+(deployedModel?'<b>AI prioritization:</b> ใช้ '+esc(deployedModel.version)+' เรียงลำดับ case ที่รอดำเนินการตาม risk probability เท่านั้น — AI ไม่ตัดสินผลแทนผู้ตรวจ':'<b>AI prioritization:</b> ยังไม่มี deployed model หรือ prediction ที่พร้อมใช้ Queue จะทำงานจาก workflow/evidence ตามปกติ')+'</div>'+
      '<div class="actions"><button class="btn primary" id="scanPersonalQrBtn">📷 สแกน Personal QR</button><button class="btn secondary" id="manualPersonalQrBtn">วาง Personal QR Token</button></div></div>'+
      '<div id="personalScanPanel" class="scanner-panel" hidden><div class="scanner-head"><div><b>สแกน Personal QR</b><br><span class="muted">ระบบจะค้นหา record ของบุคคลใน Review Queue</span></div><button class="btn secondary mini" id="stopPersonalQrBtn">ปิดกล้อง</button></div><div id="personalQrReader" class="qr-reader"></div><div id="personalScanMsg"></div></div>'+
      '<div id="personalTokenField" class="field" hidden><label>Personal QR Token</label><textarea id="personalQrToken" placeholder="วาง token จาก QR ประจำตัว"></textarea><div class="actions"><button class="btn secondary" id="resolvePersonalQrBtn">ค้นหา Case</button></div></div>'+
      '<div id="reviewQueue"></div></div><div id="reviewDetail"></div>';

    function pendingStatus(s){return ["PENDING_REVIEW","WAIT_PARTICIPANT","RETURNED","READY_DECISION"].includes(s);}
    function renderQueue(){
      const host=document.getElementById("reviewQueue");
      const term=state.search.trim().toLowerCase();
      let filtered=rows.filter(r=>state.activityId==="ALL"||(r.activity?.id||r.activityId)===state.activityId)
        .filter(r=>{
          const s=reviewWorkflowStatus(r);
          if(state.filter==="PENDING")return pendingStatus(s);
          if(state.filter==="HISTORY")return ["VERIFIED","OVERRIDE_VERIFIED","REJECTED"].includes(s);
          if(state.filter==="WAIT_PARTICIPANT")return s==="WAIT_PARTICIPANT";
          if(state.filter==="NOT_READY")return s==="NOT_READY";
          return true;
        }).filter(r=>{
          if(!term)return true;
          return [r.user?.employeeId,r.user?.name,r.activity?.title].filter(Boolean).join(" ").toLowerCase().includes(term);
        });
      filtered.sort((a,b)=>{
        const sa=reviewWorkflowStatus(a),sb=reviewWorkflowStatus(b);
        const pa=pendingStatus(sa),pb=pendingStatus(sb);
        if(pa!==pb)return pa?-1:1;
        if(pa&&pb){
          const ra=reviewAiRisk(riskByAttendance.get(a.id));
          const rb=reviewAiRisk(riskByAttendance.get(b.id));
          if(ra!==null||rb!==null){
            const diff=(rb??-1)-(ra??-1);
            if(Math.abs(diff)>1e-12)return diff;
          }
        }
        const rank={PENDING_REVIEW:0,WAIT_PARTICIPANT:1,RETURNED:2,READY_DECISION:3,NOT_READY:4,REJECTED:5,OVERRIDE_VERIFIED:6,VERIFIED:7};
        return (rank[sa]??9)-(rank[sb]??9)||new Date(b.checkinAt||0)-new Date(a.checkinAt||0);
      });
      const pages=Math.max(1,Math.ceil(filtered.length/state.pageSize));
      state.page=Math.min(Math.max(1,state.page),pages);
      const pageRows=filtered.slice((state.page-1)*state.pageSize,state.page*state.pageSize);
      const pendingCount=rows.filter(r=>pendingStatus(reviewWorkflowStatus(r))).length;

      host.innerHTML=
        '<div class="event-summary-grid review-summary"><div class="event-stat alert-stat"><b>'+pendingCount+'</b><span>รอดำเนินการ</span></div>'+
        '<div class="event-stat"><b>'+rows.filter(r=>reviewWorkflowStatus(r)==="WAIT_PARTICIPANT").length+'</b><span>รอข้อมูล</span></div>'+
        '<div class="event-stat"><b>'+rows.filter(r=>reviewWorkflowStatus(r)==="VERIFIED").length+'</b><span>รับรองแล้ว</span></div>'+
        '<div class="event-stat"><b>'+rows.filter(r=>reviewWorkflowStatus(r)==="OVERRIDE_VERIFIED").length+'</b><span>กรณีพิเศษ</span></div>'+
        '<div class="event-stat"><b>'+rows.filter(r=>reviewWorkflowStatus(r)==="REJECTED").length+'</b><span>ไม่รับรอง</span></div></div>'+
        '<div class="event-toolbar"><div class="field"><label>กิจกรรม</label><select id="reviewActivity"><option value="ALL">ทุกกิจกรรม</option>'+activities.map(a=>'<option value="'+a.id+'" '+(state.activityId===a.id?'selected':'')+'>'+esc(a.title)+'</option>').join("")+'</select></div>'+
        '<div class="field"><label>ค้นหา</label><input id="reviewSearch" value="'+esc(state.search)+'" placeholder="รหัส / ชื่อ / กิจกรรม"></div></div>'+
        '<div class="filter-chips">'+[
          ["PENDING","รอดำเนินการ"],["WAIT_PARTICIPANT","รอข้อมูล"],["NOT_READY","รอประเมิน"],["HISTORY","ประวัติ"],["ALL","ทั้งหมด"]
        ].map(([k,l])=>'<button class="filter-chip '+(state.filter===k?'active':'')+'" data-rvf="'+k+'">'+l+'</button>').join("")+'</div>'+
        '<div class="result-meta">แสดง '+pageRows.length+' จาก '+filtered.length+' case • Human Review แบบ Exception-first'+(deployedModel?' • Pending queue เรียงตาม AI risk จากมากไปน้อย':'')+'</div>'+
        '<div class="compact-list">'+(pageRows.length?pageRows.map(r=>{
          const c=r.consistencyResult;
          const blockers=[...(c?.missingCodes||[]),...(c?.reasonCodes||[])];
          const status=reviewWorkflowStatus(r);
          const prediction=riskByAttendance.get(r.id)||null;
          return '<details class="attendance-compact review-case"><summary><span class="compact-person"><b>'+esc(r.user?.employeeId||"")+'</b><span>'+esc(r.user?.name||"")+'</span></span>'+
            '<span class="compact-time">'+esc(r.activity?.title||"")+'</span><span class="compact-state"><span class="status '+(pendingStatus(status)?"s-bad":"s-info")+'">'+esc(reviewWorkflowLabel(status))+'</span>'+reviewAiBadge(prediction)+'</span></summary>'+
            '<div class="compact-detail"><div class="compact-evidence-grid"><span><b>เข้า</b>'+fmt(r.checkinAt)+'</span><span><b>ออก</b>'+fmt(r.checkoutAt)+'</span><span><b>Check-out QR</b>'+(r.checkoutQrValid?"✓":"✕")+'</span><span><b>Staff</b>'+(r.staffVerification?"✓":"✕")+'</span><span><b>ผลระบบ</b>'+statusBadge(evidenceStatusOf(r))+'</span><span><b>Final</b>'+statusBadge(finalStatusOf(r))+'</span><span><b>AI Priority</b>'+(prediction?Math.round(reviewAiRisk(prediction)*100)+'% • '+esc(prediction.predictedLabel):'—')+'</span></div>'+
            '<div class="compact-reason"><b>ข้อที่ต้องตรวจ:</b> '+esc(evidenceReasonText(blockers)||"ไม่มี")+'</div>'+
            '<div class="actions"><button class="btn primary mini rvOpen" data-id="'+r.id+'">เปิดตรวจสอบ</button></div></div></details>';
        }).join(""):'<div class="empty">ไม่มี case ตามตัวกรอง</div>')+'</div>'+
        '<div class="pagination"><button class="btn secondary mini" id="rvPrev" '+(state.page<=1?'disabled':'')+'>ก่อนหน้า</button><span>หน้า '+state.page+' / '+pages+'</span><button class="btn secondary mini" id="rvNext" '+(state.page>=pages?'disabled':'')+'>ถัดไป</button></div>';

      document.getElementById("reviewActivity").onchange=e=>{state.activityId=e.target.value;state.page=1;renderQueue();};
      document.getElementById("reviewSearch").oninput=e=>{state.search=e.target.value;state.page=1;renderQueue();const n=document.getElementById("reviewSearch");if(n){n.focus();n.setSelectionRange(n.value.length,n.value.length);}};
      host.querySelectorAll("[data-rvf]").forEach(b=>b.onclick=()=>{state.filter=b.dataset.rvf;state.page=1;renderQueue();});
      document.getElementById("rvPrev").onclick=()=>{state.page--;renderQueue();};
      document.getElementById("rvNext").onclick=()=>{state.page++;renderQueue();};
      host.querySelectorAll(".rvOpen").forEach(btn=>btn.onclick=()=>showReviewDetail(btn.dataset.id,rows,riskByAttendance,deployedModel));
    }
    renderQueue();

    async function resolvePersonalToken(token){
      const msg=document.getElementById("personalScanMsg");
      if(!token){msg.innerHTML='<div class="alert warn">ยังไม่มี Personal QR Token</div>';return;}
      try{
        const data=await api("/api/personal-qr/resolve",{
          method:"POST",
          body:JSON.stringify({token:String(token).trim(),activityId:state.activityId==="ALL"?null:state.activityId})
        });
        const matches=(data.attendance||[]).filter(x=>rows.some(r=>r.id===x.id));
        const preferred=matches.find(r=>pendingStatus(reviewWorkflowStatus(r)))||matches[0];
        if(!preferred){
          msg.innerHTML='<div class="alert warn"><b>'+esc(data.user?.employeeId+" • "+data.user?.name)+'</b><br>ไม่พบ case ในขอบเขตกิจกรรมที่เลือก ใช้ Review Queue ค้นหาย้อนหลังได้</div>';
          return;
        }
        state.search=data.user?.employeeId||"";
        state.filter="ALL";
        state.page=1;
        renderQueue();
        msg.innerHTML='<div class="alert ok">พบ '+esc(data.user?.employeeId+" • "+data.user?.name)+' และเปิด case ที่ตรงกันแล้ว</div>';
        showReviewDetail(preferred.id,rows,riskByAttendance,deployedModel);
        document.getElementById("reviewDetail")?.scrollIntoView({behavior:"smooth",block:"start"});
        await stopPersonalScanner();
      }catch(e){msg.innerHTML=errorBox(e);}
    }

    async function stopPersonalScanner(){
      if(!personalScanner)return;
      try{const s=personalScanner.getState?personalScanner.getState():null;if(s!==1)await personalScanner.stop();}catch{}
      try{await personalScanner.clear();}catch{}
      personalScanner=null;personalScannerBusy=false;
      const panel=document.getElementById("personalScanPanel");if(panel)panel.hidden=true;
    }

    document.getElementById("manualPersonalQrBtn").onclick=()=>{
      const f=document.getElementById("personalTokenField");f.hidden=!f.hidden;if(!f.hidden)document.getElementById("personalQrToken").focus();
    };
    document.getElementById("resolvePersonalQrBtn").onclick=()=>resolvePersonalToken(document.getElementById("personalQrToken").value);
    document.getElementById("stopPersonalQrBtn").onclick=stopPersonalScanner;
    document.getElementById("scanPersonalQrBtn").onclick=async()=>{
      const panel=document.getElementById("personalScanPanel"),msg=document.getElementById("personalScanMsg");
      panel.hidden=false;
      if(!window.isSecureContext){msg.innerHTML='<div class="alert bad">กล้องต้องเปิดผ่าน HTTPS หรือ localhost</div>';return;}
      if(!window.Html5Qrcode){msg.innerHTML='<div class="alert bad">โหลดตัวอ่าน QR ไม่สำเร็จ</div>';return;}
      if(personalScannerBusy)return;
      personalScannerBusy=true;msg.innerHTML='<div class="alert">กำลังเปิดกล้อง…</div>';
      try{
        personalScanner=new Html5Qrcode("personalQrReader");
        await personalScanner.start({facingMode:"environment"},{fps:10,qrbox:{width:250,height:250},aspectRatio:1.0},async decoded=>{
          if(!personalScannerBusy)return;personalScannerBusy=false;
          msg.innerHTML='<div class="alert ok">อ่าน Personal QR สำเร็จ กำลังค้นหา case…</div>';
          await resolvePersonalToken(decoded);
        },()=>{});
        msg.innerHTML='<div class="alert ok">กล้องพร้อมแล้ว — สแกน QR ประจำตัวของบุคลากร</div>';
      }catch(e){personalScannerBusy=false;personalScanner=null;msg.innerHTML='<div class="alert bad"><b>เปิดกล้องไม่สำเร็จ</b><br>'+esc(e?.message||e)+'</div>';}
    };
  }

  function showReviewDetail(id, rows, riskByAttendance=new Map(), deployedModel=null) {
    const r=rows.find(x=>x.id===id); if(!r)return;
    const prediction=riskByAttendance.get(r.id)||null;
    const c=r.consistencyResult;
    const missing=[].concat(c?.missingCodes||[]);
    const reasons=[].concat(c?.reasonCodes||[]);
    const blockers=[...missing,...reasons];
    const evaluated=Boolean(c);
    const canNormalVerify=evaluated&&blockers.length===0&&c.status==="COMPLETE";
    const box=document.getElementById("reviewDetail");
    const started=new Date().toISOString();

    box.innerHTML=
      '<div class="panel"><h2>ตรวจสอบรายการ</h2><p><b>'+esc(r.user?.name||"")+'</b> • '+esc(r.activity?.title||"")+'</p>'+
      '<div class="review-status-grid"><div><small>ผลตรวจหลักฐานของระบบ</small>'+statusBadge(evidenceStatusOf(r))+'</div><div><small>ผลตัดสินสุดท้าย</small>'+statusBadge(finalStatusOf(r))+'</div></div>'+
      (prediction?'<div class="hint"><b>AI Decision Support • Priority #'+esc(prediction.priorityRank||"—")+'</b><br>Risk probability <b>'+Math.round(reviewAiRisk(prediction)*100)+'%</b> • '+statusBadge(prediction.predictedLabel)+' • Model '+esc(prediction.modelVersion||deployedModel?.version||"—")+'<div style="margin-top:8px">'+formatExplanation(prediction.explanation)+'</div><small>ใช้เพื่อจัดลำดับและช่วยอธิบายการตรวจเท่านั้น ไม่ใช่ข้อสรุปเชิงสาเหตุ และไม่เปลี่ยนผลรับรองอัตโนมัติ</small></div>':'<div class="hint"><b>AI Decision Support:</b> ยังไม่มี prediction สำหรับ case นี้ การตัดสินยังอิงหลักฐานและ Human Review ตามปกติ</div>')+
      '<div class="timeline"><div><b>เวลาเข้า</b> — '+fmt(r.checkinAt)+'</div><div><b>เวลาออก</b> — '+fmt(r.checkoutAt)+'</div><div><b>วิธี Check-out</b> — '+esc(r.checkoutMethod||"—")+' / QR '+(r.checkoutQrValid?"✓":"✕")+'</div><div><b>เจ้าหน้าที่ยืนยัน</b> — '+(r.staffVerification?fmt(r.staffVerification.verifiedAt):"ไม่มี")+'</div>'+
      '<div><b>ข้อที่ต้องตรวจ</b> — '+esc(evidenceReasonText(blockers)||"ไม่มี")+'</div></div>'+
      '<div class="hint"><b>Personal QR เป็นทางเลือกสำหรับค้นหา case เท่านั้น</b> หากบุคคลกลับไปแล้ว ให้ตรวจจาก Review Queue และหลักฐานที่มีได้ตามปกติ</div>'+
      (!evaluated?'<div class="alert warn"><b>ยังประเมินหลักฐานไม่ได้</b><br>กลับไปหน้า “หลักฐาน” และประเมินรายการนี้ก่อนการตรวจสอบโดยมนุษย์</div>':'')+
      (evaluated&&blockers.length?'<div class="alert warn"><b>รับรองปกติไม่ได้</b><br>'+esc(evidenceReasonText(blockers))+
        '<details class="tech-inline"><summary>ดูรหัสทางเทคนิค</summary><code>'+esc(blockers.join(" • "))+'</code></details></div>':'')+
      '<div class="field" style="margin-top:14px"><label>เหตุผล/หมายเหตุการตัดสินใจ <span class="required">*</span></label><textarea id="rvReason" placeholder="ระบุเหตุผลทุกครั้ง เพื่อให้ตรวจสอบย้อนหลังได้"></textarea><small class="muted">บังคับกรอกสำหรับทุกผลตัดสิน รวมถึง “รับรองปกติ”</small></div>'+
      '<div class="actions">'+
        '<button class="btn ok" data-dec="VERIFY" '+(!canNormalVerify?'disabled':'')+'>รับรองปกติ</button>'+
        '<button class="btn secondary" data-dec="CORRECT" '+(!evaluated?'disabled':'')+'>แก้ไข/ส่งกลับ</button>'+
        '<button class="btn warn" data-dec="REQUEST_EVIDENCE" '+(!evaluated?'disabled':'')+'>ขอหลักฐานเพิ่ม</button>'+
        '<button class="btn bad" data-dec="REJECT" '+(!evaluated?'disabled':'')+'>ไม่รับรอง</button>'+
        (can("ADMIN")&&evaluated&&blockers.length?'<button class="btn override" data-dec="OVERRIDE_VERIFY">รับรองเป็นกรณีพิเศษ</button>':'')+
      '</div><div id="rvMsg"></div></div>';

    box.querySelectorAll("[data-dec]").forEach(btn=>btn.onclick=async()=>{
      const decision=btn.dataset.dec;
      const reason=document.getElementById("rvReason").value.trim();
      if(reason.length<3){
        document.getElementById("rvMsg").innerHTML='<div class="alert warn">กรุณาระบุเหตุผลการตัดสินใจทุกครั้ง เพื่อให้ตรวจสอบย้อนหลังได้</div>';return;
      }
      if(decision==="OVERRIDE_VERIFY"&&reason.length<10){
        document.getElementById("rvMsg").innerHTML='<div class="alert warn">การรับรองเป็นกรณีพิเศษต้องระบุเหตุผลอย่างน้อย 10 ตัวอักษร</div>';return;
      }
      const seconds=Math.max(1,Math.round((Date.now()-new Date(started).getTime())/1000));
      try{
        const result=await api("/api/reviews/"+encodeURIComponent(id),{method:"POST",body:JSON.stringify({decision,reason,reviewStartedAt:started,reviewDurationSeconds:seconds})});
        document.getElementById("rvMsg").innerHTML='<div class="alert ok">บันทึกผลแล้ว: '+esc(result.finalEvidenceStatus)+'</div>';
        setTimeout(()=>renderReview(document.getElementById("view")),450);
      }catch(e){document.getElementById("rvMsg").innerHTML=errorBox(e);}
    });
  }

  async function renderGroundTruth(v) {
    if (!can("ADMIN","STAFF")) throw new Error("FORBIDDEN");
    showLoading(v);
    const data = await api("/api/ground-truth/queue");
    const rows = data.records || [];
    const reasonCodes = ["MISSING_QR","MISSING_IDENTITY","MISSING_CHECKOUT","MISSING_STAFF_VERIFICATION","SHORT_DURATION","DUPLICATE_SCAN","TEMPORAL_CONFLICT","STAFF_WITHOUT_CHECKIN","OTHER"];

    const withTwo = rows.filter(r => (r.groundTruthLabels || []).length >= 2).length;
    const disagreements = can("ADMIN") ? rows.filter(r => {
      const targets = [...new Set((r.groundTruthLabels || []).map(x => x.target))];
      return targets.length > 1;
    }).length : "—";
    const adjudicated = rows.filter(r => r.groundTruthCase?.status === "ADJUDICATED").length;
    const locked = rows.filter(r => r.groundTruthCase?.status === "LOCKED").length;

    v.innerHTML =
      '<div class="grid cards">'+
      card("ระเบียน Ground Truth",rows.length)+
      card("มี ≥2 labels",can("ADMIN")?withTwo:"ซ่อนเพื่อความอิสระ")+
      card("ไม่ตรงกัน",disagreements)+
      card("Adjudicated",adjudicated)+
      card("Locked",locked)+
      '</div>'+
      '<div class="panel"><h2>Ground Truth Workspace</h2>'+
      '<div class="hint"><b>Blinded independent labeling:</b> ผู้ประเมิน STAFF เห็นเฉพาะฉลากของตนเอง และ API ไม่ส่ง AI prediction หรือผล Rule Consistency มาที่หน้านี้</div>'+
      (rows.length ? '<div class="field"><label>เลือกระเบียน</label><select id="gtRecord">'+rows.map(r => '<option value="'+r.id+'">'+esc((r.user?.employeeId||r.userId)+" • "+(r.activity?.title||""))+'</option>').join("")+'</select></div>'+
      '<div id="gtForm"></div>' : '<div class="empty">ยังไม่มีระเบียนสำหรับสร้าง Ground Truth</div>')+
      '</div>';

    if (!rows.length) return;

    const renderForm = () => {
      const r = rows.find(x => x.id === document.getElementById("gtRecord").value);
      const labels = r.groundTruthLabels || [];
      const mine = labels.find(x => x.reviewerId === session.id);
      const gtCase = r.groundTruthCase || null;
      const lockedCase = gtCase?.status === "LOCKED";

      const rawEvidence =
        '<div class="evidence-strip">'+
          '<span>QR '+(r.qrValid?"✓":"✕")+'</span>'+
          '<span>ตัวตน '+(r.identityVerified?"✓":"✕")+'</span>'+
          '<span>เข้า '+(r.checkinAt?fmt(r.checkinAt):"—")+'</span>'+
          '<span>ออก '+(r.checkoutAt?fmt(r.checkoutAt):"—")+'</span>'+
          '<span>Staff '+(r.staffVerification?"✓":"✕")+'</span>'+
          '<span>Scan '+esc(r.scanAttempts ?? 0)+' ครั้ง</span>'+
        '</div>';

      let adminPanel = "";
      if (can("ADMIN")) {
        const targetSet = [...new Set(labels.map(x => x.target))];
        const agreement = labels.length < 2 ? "ยังมีผู้ประเมินไม่ครบ" : (targetSet.length === 1 ? "ผู้ประเมินสอดคล้องกัน" : "ผู้ประเมินไม่ตรงกัน ต้อง adjudicate");
        const labelRows = labels.length ? labels.map((x,i) =>
          '<tr><td>Reviewer '+(i+1)+'</td><td>'+esc(x.target)+'</td><td>'+esc((x.reasonCodes||[]).join(" • ")||"—")+'</td></tr>'
        ).join("") : '<tr><td colspan="3">ยังไม่มีฉลาก</td></tr>';

        adminPanel =
          '<hr><h3>ส่วนผู้ตัดสินข้อขัดแย้ง (Admin Adjudication)</h3>'+
          '<p>'+statusBadge(gtCase?.status || "OPEN")+' <span class="muted">'+esc(agreement)+'</span></p>'+
          '<div class="table-wrap"><table><thead><tr><th>ฉลาก</th><th>Target</th><th>Reason Codes</th></tr></thead><tbody>'+labelRows+'</tbody></table></div>'+
          '<div class="form-grid" style="margin-top:14px">'+
            '<div class="field"><label>Final Target หลัง adjudication</label><select id="adjTarget"><option value="NO_REVIEW_REQUIRED">NO_REVIEW_REQUIRED</option><option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option></select></div>'+
            '<div class="field"><label>Reason Codes สุดท้าย (คั่นด้วย comma)</label><input id="adjReasons" placeholder="เช่น SHORT_DURATION,MISSING_CHECKOUT"></div>'+
            '<div class="field full"><label>บันทึกเหตุผลการ adjudication</label><textarea id="adjNotes" placeholder="จำเป็นเมื่อผู้ประเมินไม่ตรงกัน"></textarea></div>'+
          '</div>'+
          '<div class="actions">'+
            '<button class="btn primary" id="adjBtn" '+(lockedCase?'disabled':'')+'>Adjudicate</button>'+
            '<button class="btn ok" id="lockBtn" '+(gtCase?.status==="ADJUDICATED"?'':'disabled')+'>Lock Ground Truth</button>'+
          '</div><div id="adjMsg"></div>';
      }

      document.getElementById("gtForm").innerHTML =
        '<h3>Raw Evidence สำหรับผู้ประเมิน</h3>'+rawEvidence+
        '<p class="muted">ไม่แสดง Risk Probability, AI Recommendation หรือ Rule-Based Evidence Status ในพื้นที่นี้</p>'+
        '<h3>การติดป้ายโดยผู้ประเมิน</h3>'+
        '<div class="field"><label>Final Target</label><select id="gtTarget" '+(lockedCase?'disabled':'')+'><option value="NO_REVIEW_REQUIRED">NO_REVIEW_REQUIRED</option><option value="REVIEW_REQUIRED">REVIEW_REQUIRED</option></select></div>'+
        '<h3>Reason Codes (เลือกได้หลายข้อ)</h3><div class="policy">'+reasonCodes.map(code => '<label class="check"><input type="checkbox" class="gtReason" value="'+code+'" '+(lockedCase?'disabled':'')+'> '+code+'</label>').join("")+'</div>'+
        '<div class="field" style="margin-top:12px"><label>หมายเหตุ</label><textarea id="gtNotes" '+(lockedCase?'disabled':'')+'></textarea></div>'+
        '<div class="actions"><button class="btn primary" id="gtSave" '+(lockedCase?'disabled':'')+'>บันทึก Independent Label</button></div><div id="gtMsg"></div>'+
        (lockedCase?'<div class="alert ok">Ground Truth นี้ถูก LOCK แล้ว ไม่สามารถแก้ฉลากหรือ adjudicate ซ้ำได้</div>':'')+
        adminPanel;

      if (mine) {
        document.getElementById("gtTarget").value = mine.target;
        document.getElementById("gtNotes").value = mine.notes || "";
        document.querySelectorAll(".gtReason").forEach(ch => ch.checked = (mine.reasonCodes || []).includes(ch.value));
      }
      if (gtCase?.finalTarget && document.getElementById("adjTarget")) {
        document.getElementById("adjTarget").value = gtCase.finalTarget;
        document.getElementById("adjReasons").value = (gtCase.reasonCodes || []).join(",");
        document.getElementById("adjNotes").value = gtCase.notes || "";
      }

      const saveBtn = document.getElementById("gtSave");
      if (saveBtn && !lockedCase) saveBtn.onclick = async () => {
        const selected = [...document.querySelectorAll(".gtReason:checked")].map(x => x.value);
        try {
          await api("/api/ground-truth/"+encodeURIComponent(r.id)+"/labels", {
            method:"POST",
            body:JSON.stringify({
              target:document.getElementById("gtTarget").value,
              reasonCodes:selected,
              notes:document.getElementById("gtNotes").value.trim()
            })
          });
          document.getElementById("gtMsg").innerHTML = '<div class="alert ok">บันทึก independent label แล้ว</div>';
          setTimeout(() => renderGroundTruth(document.getElementById("view")), 350);
        } catch (e) { document.getElementById("gtMsg").innerHTML = errorBox(e); }
      };

      const adjBtn = document.getElementById("adjBtn");
      if (adjBtn && !lockedCase) adjBtn.onclick = async () => {
        const codes = document.getElementById("adjReasons").value.split(",").map(x=>x.trim()).filter(Boolean);
        try {
          await api("/api/ground-truth/"+encodeURIComponent(r.id)+"/adjudicate", {
            method:"POST",
            body:JSON.stringify({
              finalTarget:document.getElementById("adjTarget").value,
              reasonCodes:codes,
              notes:document.getElementById("adjNotes").value.trim()
            })
          });
          document.getElementById("adjMsg").innerHTML = '<div class="alert ok">Adjudication สำเร็จ พร้อมสำหรับการ Lock</div>';
          setTimeout(() => renderGroundTruth(document.getElementById("view")), 350);
        } catch (e) { document.getElementById("adjMsg").innerHTML = errorBox(e); }
      };

      const lockBtn = document.getElementById("lockBtn");
      if (lockBtn) lockBtn.onclick = async () => {
        if (!confirm("ยืนยัน Lock Ground Truth? หลัง Lock จะไม่แก้ label/adjudication ใน prototype นี้")) return;
        try {
          await api("/api/ground-truth/"+encodeURIComponent(r.id)+"/lock", {method:"POST"});
          document.getElementById("adjMsg").innerHTML = '<div class="alert ok">LOCK Ground Truth แล้ว</div>';
          setTimeout(() => renderGroundTruth(document.getElementById("view")), 350);
        } catch (e) { document.getElementById("adjMsg").innerHTML = errorBox(e); }
      };
    };

    document.getElementById("gtRecord").onchange = renderForm;
    renderForm();
  }

  async function renderReadiness(v) {
    if (!can("ADMIN")) throw new Error("FORBIDDEN");
    showLoading(v);
    const data = await api("/api/ml/readiness");
    const c = data.counts || {};
    const locked = Number(c.lockedCount || 0);
    const positive = Number(c.reviewLocked || 0);
    const negative = Number(c.noReviewLocked || 0);

    v.innerHTML =
      '<div class="grid cards">'+
        card("Independent Labels",c.labelCount||0)+
        card("Adjudicated",c.adjudicatedCount||0)+
        card("Locked",locked)+
        card("REVIEW_REQUIRED",positive)+
        card("NO_REVIEW_REQUIRED",negative)+
      '</div>'+
      '<div class="panel"><h2>AI Readiness Gate</h2>'+
        '<div class="research-gate">'+
          gate("1","Independent Labels",Number(c.labelCount||0)>0)+
          gate("2","Adjudication",Number(c.adjudicatedCount||0)>0)+
          gate("3","Ground Truth Lock",locked>0)+
          gate("4","มีข้อมูลทั้ง 2 classes",positive>0 && negative>0)+
          gate("5","Offline ML Evaluation",false)+
          gate("6","Deployment Review",false)+
        '</div>'+
        '<div class="hint"><b>AI ยังไม่เปิดใช้งานในระบบสด</b> หน้านี้เป็น readiness dashboard เท่านั้น จำนวน record ที่เพียงพอสำหรับงานวิจัยต้องกำหนดจาก protocol/sample planning ไม่ใช่จากตัวเลขคงที่ในระบบ</div>'+
        '<div class="actions"><button class="btn primary" id="mlDownload" '+(locked? "":"disabled")+'>ดาวน์โหลด Locked ML Dataset (JSON)</button></div>'+
        '<div id="mlMsg"></div>'+
      '</div>'+
      '<div class="panel"><h2>Model Evaluation Plan</h2>'+
        '<p>เมื่อข้อมูลพร้อม จะเปรียบเทียบ Logistic Regression, Random Forest และ Gradient Boosting โดยเลือก model family จาก validation set และกัน final test set ออกจากการปรับโมเดล</p>'+
        '<p class="muted">Metrics: Precision, Recall/Sensitivity, Specificity, F1, ROC-AUC, PR-AUC, Brier Score, Calibration และ 95% CI ตาม analysis protocol</p>'+
      '</div>';

    const btn = document.getElementById("mlDownload");
    if (btn && locked) btn.onclick = async () => {
      try {
        const dataset = await api("/api/ml/dataset");
        download("activa-locked-ml-dataset.json", JSON.stringify(dataset,null,2), "application/json");
        document.getElementById("mlMsg").innerHTML = '<div class="alert ok">ดาวน์โหลดชุดข้อมูล LOCKED Ground Truth แล้ว</div>';
      } catch (e) { document.getElementById("mlMsg").innerHTML = errorBox(e); }
    };
  }

  function gate(number, label, passed) {
    return '<div class="gate '+(passed?'pass':'pending')+'"><span>'+esc(number)+'</span><div><b>'+esc(label)+'</b><small>'+(passed?'ผ่านขั้นนี้แล้ว':'ยังไม่ผ่าน/ยังไม่ประเมิน')+'</small></div></div>';
  }

  async function renderModels(v) {
    if (!can("ADMIN")) throw new Error("FORBIDDEN");
    showLoading(v);
    const data = await api("/api/models");
    const models = data.models || [];

    v.innerHTML =
      '<div class="panel"><h2>Model Evaluation Registry</h2>'+
      '<div class="hint"><b>Governance gate:</b> Evaluation → Approval → Deployment แยกจากกันชัดเจน การ import ผลประเมินไม่ทำให้โมเดลใช้งานอัตโนมัติ</div>'+
      '<div class="form-grid">'+
        field("Model Version","mVersion","เช่น ACTIVA-LR-2026-01")+
        field("Model Family","mFamily","logistic_regression")+
        '<div class="field"><label>Data Provenance</label><select id="mProv"><option value="EMPIRICAL_LOCKED_GROUND_TRUTH">EMPIRICAL_LOCKED_GROUND_TRUTH</option><option value="SYNTHETIC_CI_ONLY">SYNTHETIC_CI_ONLY</option></select></div>'+
        field("Selected Metric","mMetric","validation_pr_auc")+
        field("Selected Metric Value","mMetricValue","0.0000","number")+
        '<div class="field full"><label>Evaluation JSON</label><textarea id="mEval" style="min-height:220px" placeholder=\'{"validation_metrics_by_model":{},"final_test_metrics":{},"calibration_curve":{},"permutation_importance":[]}\'></textarea></div>'+
        '<div class="field full"><label>หมายเหตุ</label><textarea id="mNotes" placeholder="ข้อจำกัด การใช้ข้อมูล และเงื่อนไขการประเมิน"></textarea></div>'+
      '</div>'+
      '<div class="actions"><button class="btn primary" id="mImport">Import Evaluation Result</button></div><div id="mMsg"></div></div>'+
      '<div class="panel"><h2>โมเดลที่ลงทะเบียน</h2>'+modelTable(models)+'</div>'+
      '<div class="panel"><h2>Offline Prediction Pipeline</h2>'+
      '<div class="hint">1) Deploy โมเดลที่ผ่าน governance → 2) ดาวน์โหลด inference features → 3) รัน predict_records.py แบบ offline → 4) นำ prediction bundle กลับมา import</div>'+
      '<div class="actions"><button class="btn secondary" id="inferDownload">ดาวน์โหลด Inference Dataset</button></div>'+
      '<div class="field" style="margin-top:14px"><label>Prediction Bundle JSON</label><input id="predictionFile" type="file" accept=".json,application/json"></div>'+
      '<div class="actions"><button class="btn primary" id="predictionImport">Import Prediction Bundle</button></div>'+
      '<div id="predictionMsg"></div></div>';

    document.getElementById("mImport").onclick = async () => {
      const msg = document.getElementById("mMsg");
      try {
        const parsed = JSON.parse(document.getElementById("mEval").value || "{}");
        const finalTest = parsed.final_test_metrics || parsed.testMetrics || null;
        const validation = parsed.validation_metrics_by_model || parsed.validationMetrics || parsed;
        const result = await api("/api/models/import-evaluation", {
          method:"POST",
          body:JSON.stringify({
            version:document.getElementById("mVersion").value.trim(),
            modelFamily:document.getElementById("mFamily").value.trim(),
            dataProvenance:document.getElementById("mProv").value,
            selectedMetric:document.getElementById("mMetric").value.trim(),
            selectedMetricValue:Number(document.getElementById("mMetricValue").value || 0),
            validationMetrics:validation,
            testMetrics:finalTest,
            calibration:parsed.calibration_curve || parsed.calibration || null,
            explainability:parsed.permutation_importance || parsed.explainability || null,
            notes:document.getElementById("mNotes").value.trim()
          })
        });
        msg.innerHTML = '<div class="alert ok">Import '+esc(result.model.version)+' แล้ว สถานะ '+esc(result.model.status)+'</div>';
        setTimeout(()=>renderModels(v),350);
      } catch (e) { msg.innerHTML = errorBox(e); }
    };

    document.querySelectorAll(".approveModel").forEach(btn => btn.onclick = async () => {
      try {
        await api("/api/models/"+encodeURIComponent(btn.dataset.id)+"/approve",{method:"POST"});
        await renderModels(v);
      } catch (e) { alert(e.message); }
    });
    document.querySelectorAll(".deployModel").forEach(btn => btn.onclick = async () => {
      if (!confirm("ยืนยัน Deploy โมเดลนี้เป็น decision-support model? Human reviewer ยังเป็นผู้ตัดสินสุดท้าย")) return;
      try {
        await api("/api/models/"+encodeURIComponent(btn.dataset.id)+"/deploy",{method:"POST"});
        await renderModels(v);
      } catch (e) { alert(e.message); }
    });

    const inferBtn = document.getElementById("inferDownload");
    if (inferBtn) inferBtn.onclick = async () => {
      const msg = document.getElementById("predictionMsg");
      try {
        const dataset = await api("/api/ml/inference-dataset");
        if (!dataset.deployedModel) {
          msg.innerHTML = '<div class="alert warn">ยังไม่มีโมเดลที่ Deploy</div>';
          return;
        }
        download(
          "activa-inference-"+dataset.deployedModel.version+".json",
          JSON.stringify(dataset,null,2),
          "application/json"
        );
        msg.innerHTML = '<div class="alert ok">ดาวน์โหลด inference dataset แล้ว '+esc(dataset.records.length)+' ระเบียน</div>';
      } catch (e) { msg.innerHTML = errorBox(e); }
    };

    const importBtn = document.getElementById("predictionImport");
    if (importBtn) importBtn.onclick = async () => {
      const msg = document.getElementById("predictionMsg");
      const file = document.getElementById("predictionFile").files?.[0];
      if (!file) {
        msg.innerHTML = '<div class="alert warn">กรุณาเลือก Prediction Bundle JSON</div>';
        return;
      }
      try {
        const payload = JSON.parse(await file.text());
        if (!payload.modelVersion || !Array.isArray(payload.predictions)) {
          throw new Error("INVALID_PREDICTION_BUNDLE");
        }
        const result = await api("/api/predictions/import-batch", {
          method:"POST",
          body:JSON.stringify({
            modelVersion:payload.modelVersion,
            predictions:payload.predictions
          })
        });
        msg.innerHTML = '<div class="alert ok">Import prediction สำเร็จ '+esc(result.importedCount)+' ระเบียน • '+esc(result.modelVersion)+'</div>';
      } catch (e) { msg.innerHTML = errorBox(e); }
    };
  }

  function modelTable(models) {
    if (!models.length) return '<div class="empty">ยังไม่มีผลประเมินโมเดลที่ลงทะเบียน</div>';
    return '<div class="table-wrap"><table><thead><tr><th>Version</th><th>Family</th><th>Provenance</th><th>Status</th><th>Metric</th><th>Test Metrics</th><th>Governance</th></tr></thead><tbody>'+
      models.map(m => {
        const tm = m.testMetrics || {};
        const metricText = [m.selectedMetric, m.selectedMetricValue].filter(x=>x!==null&&x!=="").join(": ");
        const tests = ["precision","recall_sensitivity","specificity","f1","roc_auc","pr_auc","brier_score"]
          .filter(k => tm[k] !== undefined && tm[k] !== null)
          .map(k => k+"="+Number(tm[k]).toFixed(3)).join(" • ");
        const actions = m.status==="EVALUATED"
          ? '<button class="btn mini ok approveModel" data-id="'+m.id+'">Approve</button>'
          : m.status==="APPROVED"
            ? '<button class="btn mini primary deployModel" data-id="'+m.id+'">Deploy</button>'
            : '—';
        return '<tr><td><b>'+esc(m.version)+'</b></td><td>'+esc(m.modelFamily)+'</td><td>'+esc(m.dataProvenance)+'</td><td>'+statusBadge(m.status)+'</td><td>'+esc(metricText||"—")+'</td><td>'+esc(tests||"—")+'</td><td>'+actions+'</td></tr>';
      }).join("")+'</tbody></table></div>';
  }

  async function renderXai(v) {
    if (!can("ADMIN","STAFF")) throw new Error("FORBIDDEN");
    showLoading(v);
    const data = await api("/api/xai/queue");
    const records = data.records || [];
    const model = data.deployedModel;

    if (!model) {
      v.innerHTML = '<div class="panel"><h2>AI/XAI Review</h2><div class="hint">ยังไม่มีโมเดลที่ผ่าน Approval และ Deployment ดังนั้นระบบจะไม่แสดง Risk Probability</div></div>';
      return;
    }

    v.innerHTML =
      '<div class="panel"><h2>AI/XAI Review Workspace</h2>'+
      '<div class="hint"><b>Decision support only:</b> AI จัดลำดับความเสี่ยงและแสดงเหตุผลเพื่อช่วยตรวจสอบเท่านั้น ไม่เปลี่ยนสถานะบุคลากรโดยอัตโนมัติ</div>'+
      '<p><b>Deployed Model:</b> '+esc(model.version)+' • '+esc(model.modelFamily)+' • '+statusBadge(model.status)+'</p>'+
      '<div class="table-wrap"><table><thead><tr><th>Priority</th><th>ผู้เข้าร่วม</th><th>กิจกรรม</th><th>Risk</th><th>Prediction</th><th>คำอธิบาย</th><th>Human Decision</th></tr></thead><tbody>'+
      records.map(p => {
        const r = p.attendance || {};
        const explanation = formatExplanation(p.explanation);
        const decision = r.humanReviews?.[0]?.decision || "ยังไม่ตัดสิน";
        return '<tr><td><b>#'+esc(p.priorityRank||"—")+'</b></td><td>'+esc((r.user?.employeeId||"")+" • "+(r.user?.name||""))+'</td>'+
          '<td>'+esc(r.activity?.title||r.activityId||"")+'</td>'+
          '<td><b>'+Math.round(Number(p.riskProbability)*100)+'%</b></td>'+
          '<td>'+statusBadge(p.predictedLabel)+'</td>'+
          '<td>'+explanation+'</td>'+
          '<td>'+esc(decision)+'</td></tr>';
      }).join("")+'</tbody></table></div>'+
      '<p class="muted">คำอธิบายเป็น predictive explanation ของโมเดล ไม่ใช่ข้อสรุปเชิงสาเหตุ และไม่ใช่ข้อกล่าวหาเกี่ยวกับบุคคล</p></div>';
  }

  function formatExplanation(explanation) {
    if (!explanation) return "—";
    if (Array.isArray(explanation)) {
      return explanation.slice(0,5).map(x => {
        if (typeof x === "string") return '<div>• '+esc(x)+'</div>';
        const feature = x.label || x.feature || "feature";
        const contribution = x.contribution === undefined ? "" : " ("+Number(x.contribution).toFixed(3)+")";
        return '<div>• '+esc(feature+contribution)+'</div>';
      }).join("");
    }
    if (Array.isArray(explanation.reasons)) {
      return explanation.reasons.slice(0,5).map(x => '<div>• '+esc(typeof x==="string"?x:(x.label||x.feature||JSON.stringify(x)))+'</div>').join("");
    }
    return '<code>'+esc(JSON.stringify(explanation))+'</code>';
  }

  async function renderAudit(v) {
    if (!can("ADMIN")) throw new Error("FORBIDDEN");
    showLoading(v);
    const data = await api("/api/audit");
    const logs = data.logs || [];

    const actionOptions = [...new Set(logs.map(x=>x.action).filter(Boolean))].sort();
    const actorOptions = [...new Set(logs.map(x=>x.actor?.employeeId).filter(Boolean))].sort();

    v.innerHTML =
      '<div class="panel"><div class="section-head"><div><h2>Audit Trail</h2>'+
      '<p class="muted">บันทึกว่าใครทำอะไร เมื่อไร กับรายการใด โดยไม่แก้ไขประวัติย้อนหลัง</p></div>'+
      '<span class="badge">'+esc(logs.length)+' เหตุการณ์</span></div>'+
      '<div class="audit-filters">'+
        '<div class="field"><label>ค้นหา</label><input id="auditSearch" placeholder="P001, ชื่อกิจกรรม, เหตุการณ์..."></div>'+
        '<div class="field"><label>ผู้ดำเนินการ</label><select id="auditActor"><option value="">ทั้งหมด</option>'+actorOptions.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("")+'</select></div>'+
        '<div class="field"><label>เหตุการณ์</label><select id="auditAction"><option value="">ทั้งหมด</option>'+actionOptions.map(x=>'<option value="'+esc(x)+'">'+esc(auditActionLabel(x))+'</option>').join("")+'</select></div>'+
      '</div>'+
      '<div id="auditResults"></div></div>';

    const renderResults = () => {
      const q = document.getElementById("auditSearch").value.trim().toLowerCase();
      const actor = document.getElementById("auditActor").value;
      const action = document.getElementById("auditAction").value;

      const filtered = logs.filter(x => {
        if (actor && x.actor?.employeeId !== actor) return false;
        if (action && x.action !== action) return false;
        if (!q) return true;
        const hay = [
          x.action, auditActionLabel(x.action), x.actor?.employeeId, x.actor?.name,
          x.entityType, x.entityId, x.context?.participant?.employeeId,
          x.context?.participant?.name, x.context?.activity?.title,
          JSON.stringify(x.metadata||{})
        ].join(" ").toLowerCase();
        return hay.includes(q);
      });

      document.getElementById("auditResults").innerHTML =
        (filtered.length ? auditDesktopTable(filtered) + auditMobileCards(filtered) : '<div class="empty">ไม่พบเหตุการณ์ตามตัวกรอง</div>');
    };

    ["auditSearch","auditActor","auditAction"].forEach(id=>{
      const el=document.getElementById(id);
      el.addEventListener(id==="auditSearch"?"input":"change",renderResults);
    });
    renderResults();
  }

  function auditActionLabel(code) {
    const map = {
      CHECKIN:"เช็กอิน",
      CHECKOUT:"เช็กเอาต์",
      QR_ISSUED:"สร้าง Dynamic QR",
      STAFF_VERIFIED:"เจ้าหน้าที่ยืนยัน",
      EVIDENCE_EVALUATED:"ประเมินหลักฐาน",
      HUMAN_REVIEW:"บันทึกผลการตรวจสอบโดยมนุษย์",
      MANUAL_OVERRIDE_VERIFIED:"รับรองเป็นกรณีพิเศษ",
      FINAL_DECISION_INVALIDATED:"ยกเลิกผลตัดสินเดิม",
      ATTENDANCE_VOIDED_BY_REVIEWER:"ยกเลิกรายการผิด",
      GROUND_TRUTH_LABEL:"บันทึกฉลาก Ground Truth",
      GROUND_TRUTH_ADJUDICATED:"ตัดสิน Ground Truth",
      GROUND_TRUTH_LOCKED:"ล็อก Ground Truth",
      MODEL_EVALUATION_IMPORTED:"นำเข้าผลประเมินโมเดล",
      MODEL_APPROVED:"อนุมัติโมเดล",
      MODEL_DEPLOYED:"นำโมเดลไปใช้",
      AI_PREDICTION_IMPORTED:"นำเข้าผลพยากรณ์ AI",
      AI_PREDICTION_BATCH_IMPORTED:"นำเข้าผลพยากรณ์ AI แบบชุด",
      ACTIVITY_CREATED:"สร้างกิจกรรม",
      USER_CREATED:"เพิ่มบุคลากร",
      USER_UPDATED:"แก้ไขข้อมูลบุคลากร",
      USER_STATUS_CHANGED:"เปลี่ยนสถานะบัญชี",
      USER_IMPORT:"นำเข้าบุคลากรแบบชุด",
      ACTIVITY_PERMISSION_GRANTED:"เพิ่มสิทธิ์กิจกรรม",
      ACTIVITY_PERMISSION_UPDATED:"ปรับสิทธิ์กิจกรรม",
      ACTIVITY_PERMISSION_REVOKED:"ถอนสิทธิ์กิจกรรม",
      ACTIVITY_ASSIGNMENTS_UPDATED:"ปรับผู้รับผิดชอบกิจกรรม",
      ACTIVITY_PARTICIPATION_UPDATED:"ปรับเงื่อนไขผู้เข้าร่วมกิจกรรม"
    };
    return map[code] || String(code || "ไม่ระบุ");
  }

  function auditReasonLabel(code) {
    const map = {
      SHORT_DURATION:"ระยะเวลาเข้าร่วมไม่ถึงเกณฑ์",
      MISSING_QR:"ไม่มีหลักฐาน QR",
      MISSING_IDENTITY:"ยังไม่ยืนยันตัวตน",
      MISSING_CHECKIN:"ไม่มี Check-in",
      MISSING_CHECKOUT:"ไม่มี Check-out",
      MISSING_DURATION:"ไม่มีข้อมูลระยะเวลา",
      MISSING_STAFF_VERIFICATION:"ยังไม่มีการยืนยันโดยเจ้าหน้าที่",
      MISSING_SIGNATURE:"ยังไม่มีหลักฐานลายเซ็น",
      DUPLICATE_SCAN:"พบการสแกนซ้ำ",
      TEMPORAL_CONFLICT:"ข้อมูลเวลาขัดแย้ง",
      STAFF_WITHOUT_CHECKIN:"มี Staff Verification แต่ไม่มี Check-in"
    };
    return map[code] || code;
  }

  function auditMetadataLines(x) {
    const m=x.metadata||{};
    const rows=[];
    if (m.decision) rows.push(["การตัดสินใจ", auditDecisionLabel(m.decision)]);
    if (m.reason) rows.push(["เหตุผลผู้ตรวจ", String(m.reason)]);
    if (Array.isArray(m.blockers) && m.blockers.length) rows.push(["ข้อที่ต้องตรวจ", m.blockers.map(auditReasonLabel).join(" • ")]);
    const previousFinalStatus=m.previousFinalStatus??m.previousFinal;
    if (previousFinalStatus !== undefined && previousFinalStatus !== null) rows.push(["สถานะเดิม", String(previousFinalStatus||"ยังไม่มีผลตัดสิน")]);
    if (m.finalEvidenceStatus) rows.push(["สถานะสุดท้าย", String(m.finalEvidenceStatus)]);
    if (m.systemEvidenceStatus) rows.push(["ผลตรวจหลักฐานของระบบ", String(m.systemEvidenceStatus)]);
    if (m.status) rows.push(["สถานะ", String(m.status)]);
    if (m.ruleVersion) rows.push(["กฎที่ใช้", String(m.ruleVersion)]);
    if (m.finalTarget) rows.push(["Ground Truth", String(m.finalTarget)]);
    if (m.modelVersion) rows.push(["Model", String(m.modelVersion)]);
    if (m.riskProbability !== undefined) rows.push(["Risk", Math.round(Number(m.riskProbability)*100)+"%"]);
    if (m.durationMinutes !== undefined) rows.push(["ระยะเวลา", String(m.durationMinutes)+" นาที"]);
    if (m.attendancePercentage !== undefined) rows.push(["สัดส่วนเข้าร่วม", Number(m.attendancePercentage).toFixed(1)+"%"]);
    return rows;
  }

  function auditDecisionLabel(code) {
    const map={
      VERIFY:"รับรองปกติ",
      OVERRIDE_VERIFY:"รับรองเป็นกรณีพิเศษ",
      CORRECT:"แก้ไข/ส่งกลับ",
      REQUEST_EVIDENCE:"ขอหลักฐานเพิ่ม",
      REJECT:"ไม่รับรอง"
    };
    return map[code]||String(code||"");
  }

  function auditDesktopTable(logs) {
    return '<div class="table-wrap desktop-attendance"><table><thead><tr><th>เวลา</th><th>ผู้ดำเนินการ</th><th>เหตุการณ์</th><th>บุคลากร/กิจกรรม</th><th>รายละเอียด</th></tr></thead><tbody>'+
      logs.map(x=>{
        const ctx=x.context||{};
        const meta=auditMetadataLines(x).map(([k,val])=>'<div><b>'+esc(k)+':</b> '+esc(val)+'</div>').join("");
        return '<tr><td>'+fmt(x.createdAt)+'</td>'+
          '<td>'+esc(x.actor?x.actor.employeeId+" • "+x.actor.name:"SYSTEM")+'</td>'+
          '<td><b>'+esc(auditActionLabel(x.action))+'</b><div class="audit-code">'+esc(x.action||"")+'</div></td>'+
          '<td>'+esc(ctx.participant?.employeeId||"—")+'<br>'+esc(ctx.activity?.title||x.entityType+" / "+x.entityId)+'</td>'+
          '<td>'+ (meta || '<span class="muted">ไม่มีรายละเอียดเพิ่มเติม</span>') +'</td></tr>';
      }).join("")+'</tbody></table></div>';
  }

  function auditMobileCards(logs) {
    return '<div class="audit-cards">'+logs.map(x=>{
      const ctx=x.context||{};
      const metaRows=auditMetadataLines(x);
      const summary=metaRows.length
        ? metaRows.map(([k,val])=>'<div class="audit-detail-row"><span>'+esc(k)+'</span><b>'+esc(val)+'</b></div>').join("")
        : '<div class="muted">ไม่มีรายละเอียดเพิ่มเติม</div>';
      return '<article class="audit-card">'+
        '<div class="audit-card-top"><div><div class="audit-time">'+fmt(x.createdAt)+'</div><h3>'+esc(auditActionLabel(x.action))+'</h3></div>'+
        '<span class="badge">'+esc(x.actor?.employeeId||"SYSTEM")+'</span></div>'+
        '<div class="audit-person"><b>ผู้ดำเนินการ:</b> '+esc(x.actor?x.actor.name:"ระบบ")+'</div>'+
        (ctx.participant?'<div class="audit-context"><div><small>บุคลากร</small><b>'+esc(ctx.participant.employeeId+" • "+ctx.participant.name)+'</b></div>'+
          '<div><small>กิจกรรม</small><b>'+esc(ctx.activity?.title||"—")+'</b></div></div>':'')+
        summary+
        '<details class="audit-more"><summary>ดูข้อมูลทางเทคนิค</summary>'+
          '<div><b>Action code:</b> <code>'+esc(x.action||"")+'</code></div>'+
          '<div><b>Entity:</b> <code>'+esc(x.entityType+" / "+x.entityId)+'</code></div>'+
          '<pre>'+esc(JSON.stringify(x.metadata||{},null,2))+'</pre>'+
        '</details></article>';
    }).join("")+'</div>';
  }

  
  function toCsv(rows) {
    if (!rows.length) return "";
    const headers = Object.keys(rows[0]);
    return [headers.join(",")].concat(rows.map(r => headers.map(k => {
      const raw = Array.isArray(r[k]) || (r[k] && typeof r[k] === "object") ? JSON.stringify(r[k]) : String(r[k] ?? "");
      return '"'+raw.replace(/"/g,'""')+'"';
    }).join(","))).join("\n");
  }

  function download(name, content, type) {
    const blob = new Blob([content], {type});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  async function renderResearch(v) {
    if (!can("ADMIN")) throw new Error("FORBIDDEN");
    showLoading(v);
    const data = await api("/api/research/export");
    const rows = data.records || [];
    v.innerHTML =
      '<div class="panel"><h2>Research Dataset Export</h2>'+
      '<p>ชุดข้อมูลส่งออกลดการระบุตัวบุคคลด้วย participant_hash และแยกข้อมูลปฏิบัติการออกจากชุดวิเคราะห์วิจัย</p>'+
      '<div class="grid cards">'+card("Records",rows.length)+card("De-identified",data.deidentified?"Yes":"No")+'</div>'+
      '<div class="actions"><button class="btn primary" id="csvBtn">ดาวน์โหลด CSV</button><button class="btn secondary" id="jsonBtn">ดาวน์โหลด JSON</button></div>'+
      '<div class="hint">ช่อง AI prediction/risk probability จะยังว่างจนกว่าจะล็อก Ground Truth, train/validation/test และผ่านการประเมินโมเดล</div></div>';

    document.getElementById("csvBtn").onclick = () => download("activa-research-v022.csv", toCsv(rows), "text/csv;charset=utf-8");
    document.getElementById("jsonBtn").onclick = () => download("activa-research-v022.json", JSON.stringify(rows,null,2), "application/json");
  }

  render();
})();