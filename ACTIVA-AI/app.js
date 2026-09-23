(function () {
  "use strict";

  const SESSION_KEY = "activa_ai_v022_session";
  let session = readSession();
  let activeView = "dashboard";
  let qrTimer = null;
  let qrState = null;

  const app = () => document.getElementById("app");
  const esc = (v) => String(v == null ? "" : v).replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  })[c]);
  const fmt = (dt) => !dt ? "—" : new Date(dt).toLocaleString("th-TH", { dateStyle:"short", timeStyle:"short" });
  const roleLabel = (r) => ({ADMIN:"ผู้ดูแลระบบ",ORGANIZER:"ผู้จัดกิจกรรม",STAFF:"เจ้าหน้าที่ตรวจสอบ",PARTICIPANT:"ผู้เข้าร่วม"})[r] || r;
  const can = (...roles) => session && roles.includes(session.role);

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); }
    catch { return null; }
  }

  function saveSession() {
    if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SESSION_KEY);
  }

  async function api(path, options = {}, actorOverride = null) {
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    const actor = actorOverride || session?.employeeId;
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

  function setView(view) {
    activeView = view;
    render();
  }

  function viewTitle() {
    return ({
      dashboard:"ภาพรวม",
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
      research:"Research Export"
    })[activeView] || "ACTIVA-AI";
  }

  function navItems() {
    const out = [["dashboard","ภาพรวม"],["attendance","เข้า–ออก"],["evidence","หลักฐาน"]];
    if (can("ADMIN","ORGANIZER")) out.splice(1, 0, ["activities","กิจกรรม"], ["qr","Dynamic QR"]);
    if (can("ADMIN","STAFF")) out.push(["review","ตรวจสอบ"],["groundtruth","Ground Truth"],["xai","AI/XAI Review"]);
    if (can("ADMIN")) out.push(["readiness","AI Readiness"],["models","Model Evaluation"],["audit","Audit Trail"],["research","ข้อมูลวิจัย"]);
    return out;
  }

  function shell() {
    const nav = navItems().map(([key,label]) =>
      '<button data-view="'+key+'" class="'+(activeView===key?"active":"")+'">'+label+'</button>'
    ).join("");

    return '<div class="shell">'+
      '<aside class="sidebar">'+
        '<div class="brand">ACTIVA-AI<small>Trusted Participation Verification</small></div>'+
        '<div class="nav">'+nav+'<button id="logout">ออกจากระบบ</button></div>'+
        '<div class="version">V0.3.2 • Ground Truth + ML readiness</div>'+
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
    return '<div class="alert bad"><b>เกิดข้อผิดพลาด:</b> '+esc(error?.message || error)+
      '<br><span class="muted">ตรวจว่า PostgreSQL และ ACTIVA-AI server กำลังทำงานอยู่</span></div>';
  }

  async function render() {
    clearInterval(qrTimer);
    qrTimer = null;
    if (!session) return renderLogin();

    app().innerHTML = shell();
    document.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => setView(b.dataset.view));
    document.getElementById("logout").onclick = () => { session = null; saveSession(); activeView = "dashboard"; render(); };

    const conn = document.getElementById("conn");
    api("/api/health", {}, session.employeeId)
      .then((d) => { conn.textContent = d.database === "connected" ? "ฐานข้อมูลพร้อม" : "ฐานข้อมูลมีปัญหา"; conn.className = "badge"; })
      .catch(() => { conn.textContent = "ออฟไลน์"; conn.className = "badge danger"; });

    const v = document.getElementById("view");
    try {
      if (activeView === "dashboard") await renderDashboard(v);
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
      else if (activeView === "research") await renderResearch(v);
    } catch (error) {
      v.innerHTML = '<div class="panel">'+errorBox(error)+'</div>';
    }
  }

  function renderLogin() {
    app().innerHTML =
      '<div class="login-wrap"><div class="login-card">'+
      '<div class="kicker">ACTIVA-AI V0.3.2</div><h1>เข้าสู่ระบบ</h1>'+
      '<p>Prototype นี้ใช้ฐานข้อมูล PostgreSQL และ API เป็นแหล่งข้อมูลหลัก</p>'+
      '<div class="demo-box"><b>บัญชีทดลองหลังรัน seed</b><br>ADM001 = ผู้ดูแลระบบ<br>ORG001 = ผู้จัดกิจกรรม<br>STF001 = เจ้าหน้าที่ตรวจสอบ<br>P001 = ผู้เข้าร่วม</div>'+
      '<div class="field"><label>รหัสบุคลากร</label><input id="loginId" value="ADM001"></div>'+
      '<div class="field" style="margin-top:10px"><label>รหัสผ่าน</label><input id="loginPw" type="password" value="demo" disabled></div>'+
      '<div class="actions"><button class="btn primary" id="loginBtn">เข้าสู่ระบบทดลอง</button></div>'+
      '<div class="hint">V0.2.2 ตรวจผู้ใช้จากฐานข้อมูลแล้ว แต่ยังไม่ใช่ระบบรหัสผ่าน/SSO จริง ช่องรหัสผ่านจึงปิดไว้เพื่อไม่สร้างความเข้าใจผิด</div>'+
      '<div id="loginMsg"></div></div></div>';

    document.getElementById("loginBtn").onclick = async () => {
      const id = document.getElementById("loginId").value.trim().toUpperCase();
      const msg = document.getElementById("loginMsg");
      if (!id) return msg.innerHTML = '<div class="alert bad">กรุณาระบุรหัสบุคลากร</div>';
      msg.innerHTML = '<div class="alert">กำลังตรวจสอบบัญชี…</div>';
      try {
        const data = await api("/api/me", {}, id);
        session = data.user;
        saveSession();
        activeView = "dashboard";
        render();
      } catch (error) {
        msg.innerHTML = errorBox(error);
      }
    };
  }

  function card(label, value) {
    return '<div class="card"><div class="label">'+esc(label)+'</div><div class="n">'+esc(value)+'</div></div>';
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
      card("ต้องตรวจสอบ", s.reviewRequiredCount)+
      card("หลักฐานไม่ครบ", s.incompleteCount)+
      '</div>'+
      '<div class="panel"><h2>เส้นทางการตรวจสอบ</h2>'+
      '<span class="status s-info">'+scopeText+'</span>'+
      '<div class="hint">Dynamic QR → ยืนยันตัวตน → Check-in → Check-out/ระยะเวลา → เจ้าหน้าที่ยืนยัน → ตรวจความสอดคล้อง → Human Review → Verified Participation</div>'+
      '<p class="muted">ผลจาก Evidence Engine ในระยะนี้เป็นกฎตรวจสอบ (rule-based) ไม่ใช่ค่าความน่าจะเป็นจาก AI</p></div>';
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

  async function renderActivities(v) {
    if (!can("ADMIN","ORGANIZER")) throw new Error("FORBIDDEN");
    showLoading(v);
    const activities = await loadActivities();
    v.innerHTML =
      '<div class="panel"><h2>สร้างกิจกรรม</h2><div class="form-grid">'+
      field("ชื่อกิจกรรม","aTitle","เช่น อบรมการใช้ AI")+
      '<div class="field"><label>ประเภทกิจกรรม</label><select id="aCat"><option>พัฒนาบุคลากร</option><option>ประชุม</option><option>บริการวิชาการ</option><option>วิจัย</option><option>ประกันคุณภาพ</option></select></div>'+
      field("วันที่","aDate","","date",new Date().toISOString().slice(0,10))+
      field("สถานที่","aLoc","ห้องประชุม")+
      field("เวลาเริ่ม","aStart","","time","09:00")+
      field("เวลาสิ้นสุด","aEnd","","time","16:00")+
      '</div><h3>นโยบายหลักฐานของกิจกรรม</h3><div class="policy">'+
      check("pQr","QR กิจกรรม",true)+check("pId","ยืนยันตัวตน",true)+
      check("pIn","Check-in",true)+check("pOut","Check-out",true)+
      check("pDur","ระยะเวลา",true)+check("pStaff","เจ้าหน้าที่ยืนยัน",true)+
      check("pSig","ลายเซ็น",false)+
      '<div class="field"><label>สัดส่วนเวลาขั้นต่ำ</label><input id="pRatio" type="number" min="0" max="1" step=".05" value=".75"></div>'+
      '</div><div class="actions"><button class="btn primary" id="createAct">บันทึกกิจกรรม</button></div><div id="actMsg"></div></div>'+
      '<div class="panel"><h2>กิจกรรมทั้งหมด</h2>'+activitiesTable(activities)+'</div>';

    document.getElementById("createAct").onclick = async () => {
      const msg = document.getElementById("actMsg");
      const title = document.getElementById("aTitle").value.trim();
      if (!title) return msg.innerHTML = '<div class="alert bad">กรุณาระบุชื่อกิจกรรม</div>';
      const date = document.getElementById("aDate").value;
      const start = document.getElementById("aStart").value;
      const end = document.getElementById("aEnd").value;
      try {
        await api("/api/activities", {
          method:"POST",
          body:JSON.stringify({
            title,
            category:document.getElementById("aCat").value,
            location:document.getElementById("aLoc").value || "ไม่ระบุ",
            startAt:new Date(date+"T"+start).toISOString(),
            endAt:new Date(date+"T"+end).toISOString(),
            policy:{
              qrRequired:checked("pQr"),identityRequired:checked("pId"),checkinRequired:checked("pIn"),
              checkoutRequired:checked("pOut"),durationRequired:checked("pDur"),staffRequired:checked("pStaff"),
              signatureRequired:checked("pSig"),minDurationRatio:Number(document.getElementById("pRatio").value || .75)
            }
          })
        });
        msg.innerHTML = '<div class="alert ok">บันทึกกิจกรรมแล้ว</div>';
        setTimeout(() => renderActivities(v), 300);
      } catch (error) { msg.innerHTML = errorBox(error); }
    };
  }

  function activitiesTable(items) {
    if (!items.length) return '<div class="empty">ยังไม่มีกิจกรรม</div>';
    return '<div class="table-wrap"><table><thead><tr><th>กิจกรรม</th><th>วัน/เวลา</th><th>สถานที่</th><th>Evidence Policy</th></tr></thead><tbody>'+
      items.map(a => '<tr><td><b>'+esc(a.title)+'</b><br><span class="muted">'+esc(a.category)+' • '+esc(a.id)+'</span></td>'+
      '<td>'+fmt(a.startAt)+'<br>ถึง '+fmt(a.endAt)+'</td><td>'+esc(a.location)+'</td><td>'+esc(policyText(a.policy))+'</td></tr>').join("")+
      '</tbody></table></div>';
  }

  async function renderQr(v) {
    if (!can("ADMIN","ORGANIZER")) throw new Error("FORBIDDEN");
    showLoading(v);
    const activities = await loadActivities();
    if (!activities.length) return v.innerHTML = '<div class="panel"><div class="empty">ยังไม่มีกิจกรรมสำหรับสร้าง QR</div></div>';

    v.innerHTML =
      '<div class="panel"><h2>Dynamic Event QR</h2>'+
      '<div class="field"><label>เลือกกิจกรรม</label><select id="qrAct">'+activities.map(a => '<option value="'+a.id+'">'+esc(a.title)+'</option>').join("")+'</select></div>'+
      '<div class="actions"><button class="btn primary" id="newQr">สร้าง/หมุน QR ใหม่</button></div>'+
      '<div id="qrArea"></div>'+
      '<div class="hint">Token ถูกลงลายมือชื่อที่ฝั่งเซิร์ฟเวอร์ด้วย HMAC-SHA256 มี nonce และวันหมดอายุ และไม่บรรจุข้อมูลส่วนบุคคลของผู้เข้าร่วม</div></div>';

    async function issue() {
      const activityId = document.getElementById("qrAct").value;
      qrState = await api("/api/activities/"+encodeURIComponent(activityId)+"/qr", {method:"POST"});
      draw();
    }

    function draw() {
      if (!qrState) return;
      const remain = Math.max(0, Math.ceil((new Date(qrState.expiresAt).getTime()-Date.now())/1000));
      const area = document.getElementById("qrArea");
      if (!area) return;
      area.innerHTML =
        '<div class="qrbox" style="margin-top:18px"><div id="qrcode" class="qr"></div><div>'+
        '<p>หมดอายุใน <b>'+remain+'</b> วินาที</p><div class="token">'+esc(qrState.token)+'</div></div></div>';
      if (window.QRCode) new QRCode(document.getElementById("qrcode"), {text:qrState.token,width:166,height:166});
    }

    document.getElementById("newQr").onclick = () => issue().catch((e) => {
      document.getElementById("qrArea").innerHTML = errorBox(e);
    });
    document.getElementById("qrAct").onchange = () => { qrState = null; document.getElementById("qrArea").innerHTML = ""; };
    await issue();
    qrTimer = setInterval(async () => {
      if (!qrState) return;
      if (new Date(qrState.expiresAt).getTime() <= Date.now()) {
        try { await issue(); } catch {}
      } else draw();
    }, 1000);
  }

  async function loadUsers() {
    if (can("PARTICIPANT")) return [session];
    const data = await api("/api/users");
    return data.users || [];
  }

  async function loadAttendance() {
    return (await api("/api/attendance")).attendance || [];
  }

  function statusBadge(status) {
    const s = status || "NOT_EVALUATED";
    const cls = ["VERIFIED","COMPLETE","CONSISTENT"].includes(s) ? "s-ok" :
      ["INCOMPLETE"].includes(s) ? "s-warn" :
      ["REVIEW_REQUIRED","REJECTED","INCONSISTENT"].includes(s) ? "s-bad" : "s-info";
    return '<span class="status '+cls+'">'+esc(s)+'</span>';
  }

  function evidenceStatusOf(r) {
    return r.finalEvidenceStatus || r.consistencyResult?.status || "NOT_EVALUATED";
  }

  function attendanceTable(rows, actionButtons) {
    if (!rows.length) return '<div class="empty">ยังไม่มีรายการเข้าร่วม</div>';
    return '<div class="table-wrap"><table><thead><tr><th>ผู้เข้าร่วม</th><th>กิจกรรม</th><th>เข้า</th><th>ออก</th><th>เวลา</th><th>Staff</th><th>Evidence</th>'+(actionButtons?'<th>คำสั่ง</th>':'')+'</tr></thead><tbody>'+
      rows.map(r => {
        const user = r.user || {};
        const a = r.activity || {};
        const buttons = actionButtons ? '<td><button class="btn mini secondary evalBtn" data-id="'+r.id+'">ประเมิน</button></td>' : '';
        return '<tr><td>'+esc((user.employeeId||"")+" • "+(user.name||""))+'</td><td>'+esc(a.title||r.activityId)+'</td>'+
          '<td>'+fmt(r.checkinAt)+'</td><td>'+fmt(r.checkoutAt)+'</td><td>'+(r.attendancePercentage==null?"—":Number(r.attendancePercentage).toFixed(1)+"%")+'</td>'+
          '<td>'+(r.staffVerification?"✓":"—")+'</td><td>'+statusBadge(evidenceStatusOf(r))+'</td>'+buttons+'</tr>';
      }).join("")+'</tbody></table></div>';
  }

  async function renderAttendance(v) {
    showLoading(v);
    const [activities, users, rows] = await Promise.all([loadActivities(), loadUsers(), loadAttendance()]);
    const participants = users.filter(u => u.role === "PARTICIPANT");
    v.innerHTML =
      '<div class="split"><div class="panel"><h2>Check-in</h2>'+
      '<div class="field"><label>กิจกรรม</label><select id="ciAct">'+activities.map(a => '<option value="'+a.id+'">'+esc(a.title)+'</option>').join("")+'</select></div>'+
      '<div class="field" style="margin-top:10px"><label>ผู้เข้าร่วม</label><select id="ciUser">'+participants.map(u => '<option value="'+esc(u.employeeId)+'">'+esc(u.employeeId+" • "+u.name)+'</option>').join("")+'</select></div>'+
      '<div class="field" style="margin-top:10px"><label>Dynamic QR Token</label><textarea id="ciToken" placeholder="สแกนหรือวาง token จาก Dynamic QR"></textarea></div>'+
      '<div class="actions"><button class="btn primary" id="ciBtn">ยืนยัน Check-in</button></div><div id="ciMsg"></div></div>'+
      '<div class="panel"><h2>Check-out / Staff Verification</h2>'+
      '<div class="field"><label>รายการเข้าร่วม</label><select id="coRecord">'+rows.map(r => '<option value="'+r.id+'">'+esc((r.user?.employeeId||"")+" • "+(r.activity?.title||""))+'</option>').join("")+'</select></div>'+
      '<div class="actions"><button class="btn secondary" id="coBtn">Check-out</button>'+
      (can("ADMIN","ORGANIZER","STAFF")?'<button class="btn ok" id="staffBtn">เจ้าหน้าที่ยืนยัน</button>':'')+
      '</div><div id="coMsg"></div></div></div>'+
      '<div class="panel"><h2>รายการเข้า–ออกล่าสุด</h2>'+attendanceTable(rows, can("ADMIN","ORGANIZER","STAFF"))+'</div>';

    document.getElementById("ciBtn").onclick = async () => {
      const msg = document.getElementById("ciMsg");
      try {
        const result = await api("/api/attendance/checkin", {
          method:"POST",
          body:JSON.stringify({
            userId:document.getElementById("ciUser").value,
            token:document.getElementById("ciToken").value.trim()
          })
        });
        msg.innerHTML = '<div class="alert ok">Check-in สำเร็จ: '+esc(result.attendance.id)+'</div>';
        setTimeout(() => renderAttendance(v), 350);
      } catch (e) { msg.innerHTML = errorBox(e); }
    };

    document.getElementById("coBtn").onclick = async () => {
      const id = document.getElementById("coRecord").value;
      const msg = document.getElementById("coMsg");
      if (!id) return msg.innerHTML = '<div class="alert warn">ยังไม่มีรายการสำหรับ Check-out</div>';
      try {
        await api("/api/attendance/"+encodeURIComponent(id)+"/checkout", {method:"POST"});
        msg.innerHTML = '<div class="alert ok">Check-out สำเร็จ</div>';
        setTimeout(() => renderAttendance(v), 350);
      } catch (e) { msg.innerHTML = errorBox(e); }
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

    document.querySelectorAll(".evalBtn").forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      try { await api("/api/evidence/"+encodeURIComponent(btn.dataset.id)+"/evaluate", {method:"POST"}); await renderAttendance(v); }
      catch (e) { btn.disabled = false; alert(e.message); }
    });
  }

  async function renderEvidence(v) {
    showLoading(v);
    const rows = await loadAttendance();
    v.innerHTML =
      '<div class="panel"><div class="section-head"><div><h2>Evidence Matrix</h2><p class="muted">สถานะการเข้า–ออกและสถานะหลักฐานเป็นคนละเรื่องกัน</p></div>'+
      (can("ADMIN","ORGANIZER","STAFF")?'<button class="btn primary" id="evalAll">ประเมินหลักฐานทั้งหมดที่มองเห็น</button>':'')+
      '</div>'+
      '<div class="table-wrap"><table><thead><tr><th>บุคลากร</th><th>QR</th><th>ตัวตน</th><th>เข้า</th><th>ออก</th><th>ระยะเวลา</th><th>Staff</th><th>Evidence Status</th><th>เหตุผล</th></tr></thead><tbody>'+
      rows.map(r => {
        const c = r.consistencyResult;
        const reasons = [].concat(c?.missingCodes || [], c?.reasonCodes || []);
        return '<tr><td>'+esc((r.user?.employeeId||"")+" • "+(r.user?.name||""))+'</td>'+
          '<td>'+(r.qrValid?"✓":"✕")+'</td><td>'+(r.identityVerified?"✓":"✕")+'</td><td>'+(r.checkinAt?"✓":"✕")+'</td><td>'+(r.checkoutAt?"✓":"✕")+'</td>'+
          '<td>'+(c?.durationRatio==null?"—":Math.round(Number(c.durationRatio)*100)+"%")+'</td><td>'+(r.staffVerification?"✓":"✕")+'</td>'+
          '<td>'+statusBadge(evidenceStatusOf(r))+'</td><td>'+esc(reasons.join(" • ") || "—")+'</td></tr>';
      }).join("")+'</tbody></table></div></div>';

    const evalAll = document.getElementById("evalAll");
    if (evalAll) evalAll.onclick = async () => {
      evalAll.disabled = true;
      evalAll.textContent = "กำลังประเมิน…";
      for (const r of rows) {
        try { await api("/api/evidence/"+encodeURIComponent(r.id)+"/evaluate", {method:"POST"}); } catch {}
      }
      await renderEvidence(v);
    };
  }

  async function renderReview(v) {
    if (!can("ADMIN","STAFF")) throw new Error("FORBIDDEN");
    showLoading(v);
    const rows = await loadAttendance();
    v.innerHTML =
      '<div class="panel"><h2>Human Review Center</h2><div class="hint">ระบบแสดงเหตุผลจากหลักฐานเพื่อสนับสนุนการตรวจสอบ แต่ผู้ตรวจสอบเป็นผู้ตัดสินใจสุดท้าย</div>'+
      '<div class="table-wrap"><table><thead><tr><th>ผู้เข้าร่วม</th><th>กิจกรรม</th><th>Evidence</th><th>เหตุผล</th><th></th></tr></thead><tbody>'+
      rows.map(r => {
        const c = r.consistencyResult;
        const reasons = [].concat(c?.missingCodes || [], c?.reasonCodes || []);
        return '<tr><td>'+esc((r.user?.employeeId||"")+" • "+(r.user?.name||""))+'</td><td>'+esc(r.activity?.title||"")+'</td>'+
          '<td>'+statusBadge(evidenceStatusOf(r))+'</td><td>'+esc(reasons.join(" • ") || "—")+'</td>'+
          '<td><button class="btn secondary mini rvOpen" data-id="'+r.id+'">เปิดตรวจสอบ</button></td></tr>';
      }).join("")+'</tbody></table></div></div><div id="reviewDetail"></div>';

    document.querySelectorAll(".rvOpen").forEach(btn => btn.onclick = () => showReviewDetail(btn.dataset.id, rows));
  }

  function showReviewDetail(id, rows) {
    const r = rows.find(x => x.id === id);
    if (!r) return;
    const c = r.consistencyResult;
    const reasons = [].concat(c?.missingCodes || [], c?.reasonCodes || []);
    const box = document.getElementById("reviewDetail");
    const started = new Date().toISOString();
    box.innerHTML =
      '<div class="panel"><h2>ตรวจสอบรายการ</h2><p><b>'+esc(r.user?.name||"")+'</b> • '+esc(r.activity?.title||"")+'</p>'+
      '<div class="timeline"><div><b>Check-in</b> — '+fmt(r.checkinAt)+'</div><div><b>Check-out</b> — '+fmt(r.checkoutAt)+'</div>'+
      '<div><b>Staff Verification</b> — '+(r.staffVerification?fmt(r.staffVerification.verifiedAt):"ไม่มี")+'</div>'+
      '<div><b>Evidence Engine</b> — '+esc(reasons.join(" • ") || "ไม่พบข้อผิดปกติจากกฎ")+'</div></div>'+
      '<div class="field" style="margin-top:14px"><label>เหตุผลการตัดสินใจ</label><textarea id="rvReason"></textarea></div>'+
      '<div class="actions"><button class="btn ok" data-dec="VERIFY">รับรอง</button><button class="btn secondary" data-dec="CORRECT">แก้ไข/ส่งกลับ</button>'+
      '<button class="btn warn" data-dec="REQUEST_EVIDENCE">ขอหลักฐานเพิ่ม</button><button class="btn bad" data-dec="REJECT">ไม่รับรอง</button></div><div id="rvMsg"></div></div>';

    box.querySelectorAll("[data-dec]").forEach(btn => btn.onclick = async () => {
      const seconds = Math.max(1, Math.round((Date.now() - new Date(started).getTime()) / 1000));
      try {
        await api("/api/reviews/"+encodeURIComponent(id), {
          method:"POST",
          body:JSON.stringify({
            decision:btn.dataset.dec,
            reason:document.getElementById("rvReason").value.trim(),
            reviewStartedAt:started,
            reviewDurationSeconds:seconds
          })
        });
        document.getElementById("rvMsg").innerHTML = '<div class="alert ok">บันทึกผลการตรวจสอบแล้ว</div>';
        setTimeout(() => renderReview(document.getElementById("view")), 350);
      } catch (e) { document.getElementById("rvMsg").innerHTML = errorBox(e); }
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
      '<div class="panel"><h2>โมเดลที่ลงทะเบียน</h2>'+modelTable(models)+'</div>';

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
      '<div class="table-wrap"><table><thead><tr><th>ผู้เข้าร่วม</th><th>กิจกรรม</th><th>Risk</th><th>Prediction</th><th>คำอธิบาย</th><th>Human Decision</th></tr></thead><tbody>'+
      records.map(p => {
        const r = p.attendance || {};
        const explanation = formatExplanation(p.explanation);
        const decision = r.humanReviews?.[0]?.decision || "ยังไม่ตัดสิน";
        return '<tr><td>'+esc((r.user?.employeeId||"")+" • "+(r.user?.name||""))+'</td>'+
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
    v.innerHTML = '<div class="panel"><h2>Audit Trail</h2><div class="table-wrap"><table><thead><tr><th>เวลา</th><th>ผู้กระทำ</th><th>เหตุการณ์</th><th>Entity</th><th>รายละเอียด</th></tr></thead><tbody>'+
      logs.map(x => '<tr><td>'+fmt(x.createdAt)+'</td><td>'+esc(x.actor ? x.actor.employeeId+" • "+x.actor.name : "SYSTEM")+'</td><td>'+esc(x.action)+'</td><td>'+esc(x.entityType+" / "+x.entityId)+'</td><td><code>'+esc(JSON.stringify(x.metadata||{}))+'</code></td></tr>').join("")+
      '</tbody></table></div></div>';
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