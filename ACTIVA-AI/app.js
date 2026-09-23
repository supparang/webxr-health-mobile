(function(){
  "use strict";
  var KEY="activa_ai_v01_state";
  var session=null, activeView="dashboard", qrTimer=null;

  function uid(prefix){return prefix+"_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,8);}
  function nowISO(){return new Date().toISOString();}
  function fmt(dt){if(!dt)return "-";return new Date(dt).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"});}
  function escapeHtml(v){return String(v==null?"":v).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"})[c];});}
  function hashText(s){var h=2166136261;for(var i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return (h>>>0).toString(16);}
  function defaultState(){
    var eventId="EVT-DEMO-001";
    return {
      users:[
        {id:"ADM001",name:"ผู้ดูแลระบบตัวอย่าง",role:"ADMIN"},
        {id:"ORG001",name:"ผู้จัดกิจกรรมตัวอย่าง",role:"ORGANIZER"},
        {id:"STF001",name:"เจ้าหน้าที่ตรวจสอบตัวอย่าง",role:"STAFF"},
        {id:"P001",name:"ผู้เข้าร่วมตัวอย่าง 1",role:"PARTICIPANT"},
        {id:"P002",name:"ผู้เข้าร่วมตัวอย่าง 2",role:"PARTICIPANT"},
        {id:"P003",name:"ผู้เข้าร่วมตัวอย่าง 3",role:"PARTICIPANT"}
      ],
      activities:[
        {id:eventId,title:"อบรมการใช้ AI อย่างรับผิดชอบ",category:"พัฒนาบุคลากร",date:new Date().toISOString().slice(0,10),start:"09:00",end:"16:00",location:"ห้องประชุมคณะ",organizer:"ORG001",
         policy:{qr:true,identity:true,checkin:true,checkout:true,duration:true,staff:true,signature:false,minDurationRatio:0.75},
         qr:null}
      ],
      attendance:[],
      reviews:[],
      audit:[],
      settings:{qrTtlSeconds:45}
    };
  }
  function load(){try{var x=JSON.parse(localStorage.getItem(KEY)||"null");return x&&x.users?x:defaultState();}catch(e){return defaultState();}}
  function save(){localStorage.setItem(KEY,JSON.stringify(state));}
  function audit(action,entity,meta){
    state.audit.unshift({id:uid("AUD"),at:nowISO(),actor:session?session.id:"SYSTEM",action:action,entity:entity,meta:meta||""});
    state.audit=state.audit.slice(0,300);save();
  }
  var state=load();

  function app(){return document.getElementById("app");}
  function setView(v){activeView=v;render();}
  function roleLabel(r){return ({ADMIN:"ผู้ดูแลระบบ",ORGANIZER:"ผู้จัดกิจกรรม",STAFF:"เจ้าหน้าที่ตรวจสอบ",PARTICIPANT:"ผู้เข้าร่วม"})[r]||r;}
  function getUser(id){return state.users.find(function(u){return u.id===id;});}
  function getActivity(id){return state.activities.find(function(a){return a.id===id;});}

  function render(){
    clearInterval(qrTimer);qrTimer=null;
    if(!session){renderLogin();return;}
    app().innerHTML='<div class="shell">'+sidebar()+ '<main class="main"><div class="topbar"><div><div class="kicker">ACTIVA-AI • RESEARCH PROTOTYPE V0.1</div><h1>'+viewTitle()+'</h1></div><div><span class="badge">'+escapeHtml(session.name)+' • '+roleLabel(session.role)+'</span></div></div><div id="view"></div></main></div>';
    document.querySelectorAll("[data-view]").forEach(function(b){b.addEventListener("click",function(){setView(b.getAttribute("data-view"));});});
    document.getElementById("logout").addEventListener("click",function(){audit("LOGOUT","SESSION","");session=null;render();});
    var v=document.getElementById("view");
    if(activeView==="dashboard") renderDashboard(v);
    if(activeView==="activities") renderActivities(v);
    if(activeView==="qr") renderQr(v);
    if(activeView==="attendance") renderAttendance(v);
    if(activeView==="evidence") renderEvidence(v);
    if(activeView==="review") renderReview(v);
    if(activeView==="audit") renderAudit(v);
    if(activeView==="research") renderResearch(v);
  }

  function viewTitle(){return ({dashboard:"ภาพรวม",activities:"กิจกรรมและนโยบายหลักฐาน",qr:"Dynamic QR",attendance:"Check-in / Check-out",evidence:"Evidence Matrix",review:"Human Review",audit:"Audit Trail",research:"Research Export"})[activeView]||"ACTIVA-AI";}
  function sidebar(){
    var nav=[["dashboard","ภาพรวม"],["activities","กิจกรรม"],["qr","Dynamic QR"],["attendance","เข้า–ออก"],["evidence","หลักฐาน"],["review","ตรวจสอบ"],["audit","Audit Trail"],["research","ข้อมูลวิจัย"]];
    return '<aside class="sidebar"><div class="brand">ACTIVA-AI<small>Trusted Participation Verification</small></div><div class="nav">'+nav.map(function(n){return '<button data-view="'+n[0]+'" class="'+(activeView===n[0]?'active':'')+'">'+n[1]+'</button>';}).join("")+'<button id="logout">ออกจากระบบ</button></div><div class="version">V0.1 • Rule-based research prototype</div></aside>';
  }

  function renderLogin(){
    app().innerHTML='<div class="login-wrap"><div class="login-card"><div class="kicker">ACTIVA-AI</div><h1>เข้าสู่ระบบ</h1><p>ต้นแบบระบบตรวจสอบหลักฐานการเข้าร่วมกิจกรรมแบบหลายแหล่ง</p><div class="demo-box"><b>บัญชีทดลอง</b><br>ADM001 = ผู้ดูแลระบบ<br>ORG001 = ผู้จัดกิจกรรม<br>STF001 = เจ้าหน้าที่ตรวจสอบ<br>P001 = ผู้เข้าร่วม</div><div class="field"><label>รหัสบุคลากร</label><input id="loginId" value="ADM001"></div><div class="field" style="margin-top:10px"><label>รหัสผ่าน</label><input id="loginPw" type="password" value="demo"></div><div class="actions"><button class="btn primary" id="loginBtn">เข้าสู่ระบบ</button><button class="btn secondary" id="resetBtn">ล้างข้อมูลทดลอง</button></div><div id="loginMsg"></div></div></div>';
    document.getElementById("loginBtn").onclick=function(){
      var id=document.getElementById("loginId").value.trim().toUpperCase();
      var u=getUser(id);
      if(!u){document.getElementById("loginMsg").innerHTML='<div class="alert bad">ไม่พบรหัสบุคลากรตัวอย่าง</div>';return;}
      session=u;activeView="dashboard";audit("LOGIN","SESSION","demo-login");render();
    };
    document.getElementById("resetBtn").onclick=function(){localStorage.removeItem(KEY);state=defaultState();document.getElementById("loginMsg").innerHTML='<div class="alert ok">ล้างข้อมูลทดลองแล้ว</div>';};
  }

  function summary(){
    var att=state.attendance;
    return {
      activities:state.activities.length,
      records:att.length,
      verified:att.filter(function(r){return r.finalStatus==="VERIFIED";}).length,
      review:att.filter(function(r){return evidenceStatus(r).status==="REVIEW_REQUIRED";}).length,
      incomplete:att.filter(function(r){return evidenceStatus(r).status==="INCOMPLETE";}).length
    };
  }
  function renderDashboard(v){
    var s=summary();
    v.innerHTML='<div class="grid cards">'+
      card("กิจกรรม",s.activities)+card("รายการเข้าร่วม",s.records)+card("รับรองแล้ว",s.verified)+card("ต้องตรวจสอบ",s.review)+card("หลักฐานไม่ครบ",s.incomplete)+
      '</div><div class="panel"><h2>เส้นทางการตรวจสอบ</h2><div class="hint">Dynamic QR → ยืนยันตัวตน → Check-in → Check-out/ระยะเวลา → เจ้าหน้าที่ยืนยัน → ตรวจความสอดคล้อง → Human Review → Verified Participation</div><p class="muted">V0.1 ใช้กฎตรวจสอบและข้อมูลใน localStorage เพื่อการสาธิต ยังไม่ใช่ระบบผลิตจริงและยังไม่ใช้โมเดล AI ในการให้คะแนนความเสี่ยง</p></div>';
  }
  function card(label,n){return '<div class="card"><div class="label">'+label+'</div><div class="n">'+n+'</div></div>';}

  function renderActivities(v){
    v.innerHTML='<div class="panel"><h2>สร้างกิจกรรม</h2><div class="form-grid">'+
      fld("ชื่อกิจกรรม","aTitle","เช่น อบรมการใช้ AI")+
      '<div class="field"><label>ประเภทกิจกรรม</label><select id="aCat"><option>พัฒนาบุคลากร</option><option>ประชุม</option><option>บริการวิชาการ</option><option>วิจัย</option><option>ประกันคุณภาพ</option></select></div>'+
      fld("วันที่","aDate","", "date", new Date().toISOString().slice(0,10))+
      fld("สถานที่","aLoc","ห้องประชุม")+
      fld("เวลาเริ่ม","aStart","", "time","09:00")+
      fld("เวลาสิ้นสุด","aEnd","", "time","16:00")+
      '</div><h3>นโยบายหลักฐานของกิจกรรม</h3><div class="policy" id="policyBox">'+
      check("pQr","QR กิจกรรม",true)+check("pId","ยืนยันตัวตน",true)+check("pIn","Check-in",true)+check("pOut","Check-out",true)+check("pDur","ระยะเวลา",true)+check("pStaff","เจ้าหน้าที่ยืนยัน",true)+check("pSig","ลายเซ็น",false)+
      '<div class="field"><label>สัดส่วนเวลาขั้นต่ำ</label><input id="pRatio" type="number" min="0" max="1" step=".05" value=".75"></div></div><div class="actions"><button class="btn primary" id="createAct">บันทึกกิจกรรม</button></div><div id="actMsg"></div></div>'+
      '<div class="panel"><h2>กิจกรรมทั้งหมด</h2>'+activitiesTable()+'</div>';
    document.getElementById("createAct").onclick=function(){
      var title=document.getElementById("aTitle").value.trim();
      if(!title){document.getElementById("actMsg").innerHTML='<div class="alert bad">กรุณาระบุชื่อกิจกรรม</div>';return;}
      var a={id:uid("EVT"),title:title,category:document.getElementById("aCat").value,date:document.getElementById("aDate").value,start:document.getElementById("aStart").value,end:document.getElementById("aEnd").value,location:document.getElementById("aLoc").value,organizer:session.id,policy:{qr:ck("pQr"),identity:ck("pId"),checkin:ck("pIn"),checkout:ck("pOut"),duration:ck("pDur"),staff:ck("pStaff"),signature:ck("pSig"),minDurationRatio:Number(document.getElementById("pRatio").value||.75)},qr:null};
      state.activities.unshift(a);audit("ACTIVITY_CREATED",a.id,a.title);renderActivities(v);
    };
  }
  function fld(label,id,ph,type,val){return '<div class="field"><label>'+label+'</label><input id="'+id+'" type="'+(type||"text")+'" placeholder="'+(ph||"")+'" value="'+(val||"")+'"></div>';}
  function check(id,label,on){return '<label class="check"><input type="checkbox" id="'+id+'" '+(on?'checked':'')+'> '+label+'</label>';}
  function ck(id){return document.getElementById(id).checked;}
  function activitiesTable(){
    return '<div class="table-wrap"><table><thead><tr><th>กิจกรรม</th><th>วัน/เวลา</th><th>สถานที่</th><th>นโยบายหลักฐาน</th></tr></thead><tbody>'+state.activities.map(function(a){
      var req=Object.keys(a.policy).filter(function(k){return typeof a.policy[k]==="boolean"&&a.policy[k];}).join(", ");
      return '<tr><td><b>'+escapeHtml(a.title)+'</b><br><span class="muted">'+escapeHtml(a.category)+' • '+a.id+'</span></td><td>'+escapeHtml(a.date)+' '+escapeHtml(a.start)+'–'+escapeHtml(a.end)+'</td><td>'+escapeHtml(a.location)+'</td><td>'+escapeHtml(req)+'</td></tr>';
    }).join("")+'</tbody></table></div>';
  }

  function issueToken(activity){
    var ttl=state.settings.qrTtlSeconds||45, issued=Date.now(), expires=issued+ttl*1000, nonce=Math.random().toString(36).slice(2,10);
    var raw=[activity.id,issued,expires,nonce].join("|");
    activity.qr={token:raw+"|"+hashText(raw+"|ACTIVA-DEMO"),issuedAt:new Date(issued).toISOString(),expiresAt:new Date(expires).toISOString(),nonce:nonce};
    save();return activity.qr;
  }
  function renderQr(v){
    var opts=state.activities.map(function(a){return '<option value="'+a.id+'">'+escapeHtml(a.title)+'</option>';}).join("");
    v.innerHTML='<div class="panel"><h2>Dynamic Event QR</h2><div class="field"><label>เลือกกิจกรรม</label><select id="qrAct">'+opts+'</select></div><div class="actions"><button class="btn primary" id="newQr">สร้าง/หมุน QR ใหม่</button></div><div id="qrArea"></div><div class="hint">QR รุ่นต้นแบบหมุนทุก '+state.settings.qrTtlSeconds+' วินาที และไม่บรรจุข้อมูลส่วนบุคคล ใช้ event_id + issued_at + expires_at + nonce + signature จำลอง</div></div>';
    function show(){
      var a=getActivity(document.getElementById("qrAct").value);if(!a)return;
      if(!a.qr||new Date(a.qr.expiresAt).getTime()<=Date.now()) issueToken(a);
      var remain=Math.max(0,Math.ceil((new Date(a.qr.expiresAt).getTime()-Date.now())/1000));
      document.getElementById("qrArea").innerHTML='<div class="qrbox" style="margin-top:18px"><div id="qrcode" class="qr"></div><div><b>'+escapeHtml(a.title)+'</b><p>หมดอายุใน <b>'+remain+'</b> วินาที</p><div class="token">'+escapeHtml(a.qr.token)+'</div></div></div>';
      if(window.QRCode){new QRCode(document.getElementById("qrcode"),{text:a.qr.token,width:166,height:166});}
      if(remain===0){issueToken(a);}
    }
    document.getElementById("newQr").onclick=function(){var a=getActivity(document.getElementById("qrAct").value);issueToken(a);audit("QR_ROTATED",a.id,"manual");show();};
    document.getElementById("qrAct").onchange=show;show();qrTimer=setInterval(show,1000);
  }

  function renderAttendance(v){
    var acts=state.activities.map(function(a){return '<option value="'+a.id+'">'+escapeHtml(a.title)+'</option>';}).join("");
    var parts=state.users.filter(function(u){return u.role==="PARTICIPANT";}).map(function(u){return '<option value="'+u.id+'">'+escapeHtml(u.id+" • "+u.name)+'</option>';}).join("");
    v.innerHTML='<div class="split"><div class="panel"><h2>Check-in</h2><div class="field"><label>กิจกรรม</label><select id="ciAct">'+acts+'</select></div><div class="field" style="margin-top:10px"><label>ผู้เข้าร่วม</label><select id="ciUser">'+parts+'</select></div><div class="field" style="margin-top:10px"><label>Dynamic QR Token</label><textarea id="ciToken" placeholder="วาง token จากหน้า Dynamic QR"></textarea></div><div class="actions"><button class="btn primary" id="ciBtn">ยืนยัน Check-in</button></div><div id="ciMsg"></div></div>'+
      '<div class="panel"><h2>Check-out / Staff Verification</h2><div class="field"><label>รายการที่ Check-in แล้ว</label><select id="coRecord">'+recordOptions()+'</select></div><div class="actions"><button class="btn secondary" id="coBtn">Check-out</button><button class="btn ok" id="staffBtn">เจ้าหน้าที่ยืนยัน</button></div><div id="coMsg"></div></div></div>'+
      '<div class="panel"><h2>รายการเข้า–ออกล่าสุด</h2>'+attendanceTable()+'</div>';
    document.getElementById("ciBtn").onclick=function(){
      var a=getActivity(document.getElementById("ciAct").value), uidv=document.getElementById("ciUser").value, token=document.getElementById("ciToken").value.trim();
      if(!a.qr){document.getElementById("ciMsg").innerHTML='<div class="alert warn">ยังไม่มี QR ของกิจกรรมนี้</div>';return;}
      var valid=token===a.qr.token && new Date(a.qr.expiresAt).getTime()>Date.now();
      if(!valid){document.getElementById("ciMsg").innerHTML='<div class="alert bad">QR ไม่ถูกต้องหรือหมดอายุ</div>';audit("CHECKIN_REJECTED",a.id,uidv);return;}
      var existing=state.attendance.find(function(r){return r.activityId===a.id&&r.userId===uidv&&!r.checkoutAt;});
      if(existing){document.getElementById("ciMsg").innerHTML='<div class="alert warn">มี Check-in ที่ยังไม่ Check-out อยู่แล้ว</div>';return;}
      var r={id:uid("ATT"),activityId:a.id,userId:uidv,qrValid:true,identityVerified:true,checkinAt:nowISO(),checkoutAt:null,staffVerified:false,signatureVerified:false,scanAttempts:1,finalStatus:null,humanDecision:null,humanReason:""};
      state.attendance.unshift(r);audit("CHECKIN",r.id,a.id+"|"+uidv);renderAttendance(v);
    };
    document.getElementById("coBtn").onclick=function(){var r=findSelectedRecord("coRecord");if(!r)return;r.checkoutAt=nowISO();audit("CHECKOUT",r.id,"");renderAttendance(v);};
    document.getElementById("staffBtn").onclick=function(){var r=findSelectedRecord("coRecord");if(!r)return;r.staffVerified=true;r.staffVerifiedAt=nowISO();r.staffVerifiedBy=session.id;audit("STAFF_VERIFIED",r.id,session.id);renderAttendance(v);};
  }
  function recordOptions(){return state.attendance.map(function(r){var u=getUser(r.userId),a=getActivity(r.activityId);return '<option value="'+r.id+'">'+escapeHtml((u?u.id:r.userId)+" • "+(a?a.title:r.activityId))+'</option>';}).join("");}
  function findSelectedRecord(id){var el=document.getElementById(id);return el?state.attendance.find(function(r){return r.id===el.value;}):null;}
  function durationRatio(r){
    var a=getActivity(r.activityId);if(!a||!r.checkinAt||!r.checkoutAt)return null;
    var total=(new Date(a.date+"T"+a.end).getTime()-new Date(a.date+"T"+a.start).getTime())/60000;
    var actual=(new Date(r.checkoutAt)-new Date(r.checkinAt))/60000;
    return total>0?Math.max(0,Math.min(1,actual/total)):null;
  }
  function attendanceTable(){
    return '<div class="table-wrap"><table><thead><tr><th>ผู้เข้าร่วม</th><th>กิจกรรม</th><th>เข้า</th><th>ออก</th><th>Staff</th><th>สถานะหลักฐาน</th></tr></thead><tbody>'+state.attendance.map(function(r){var u=getUser(r.userId),a=getActivity(r.activityId),e=evidenceStatus(r);return '<tr><td>'+escapeHtml(u?u.id+" • "+u.name:r.userId)+'</td><td>'+escapeHtml(a?a.title:r.activityId)+'</td><td>'+fmt(r.checkinAt)+'</td><td>'+fmt(r.checkoutAt)+'</td><td>'+(r.staffVerified?"✓":"—")+'</td><td>'+statusBadge(e.status)+'</td></tr>';}).join("")+'</tbody></table></div>';
  }

  function evidenceStatus(r){
    var a=getActivity(r.activityId);if(!a)return {status:"REVIEW_REQUIRED",missing:["activity"],reasons:["ไม่พบกิจกรรม"]};
    var p=a.policy, missing=[], reasons=[];
    if(p.qr&&!r.qrValid)missing.push("QR");
    if(p.identity&&!r.identityVerified)missing.push("Identity");
    if(p.checkin&&!r.checkinAt)missing.push("Check-in");
    if(p.checkout&&!r.checkoutAt)missing.push("Check-out");
    if(p.staff&&!r.staffVerified)missing.push("Staff Verification");
    if(p.signature&&!r.signatureVerified)missing.push("Signature");
    var ratio=durationRatio(r);
    if(p.duration&&r.checkoutAt&&ratio!=null&&ratio<p.minDurationRatio)reasons.push("ระยะเวลาต่ำกว่าเกณฑ์ "+Math.round(p.minDurationRatio*100)+"%");
    if(r.staffVerified&&!r.checkinAt)reasons.push("เจ้าหน้าที่ยืนยันแต่ไม่มี Check-in");
    if(r.finalStatus==="VERIFIED")return {status:"VERIFIED",missing:missing,reasons:reasons,ratio:ratio};
    if(missing.length)return {status:"INCOMPLETE",missing:missing,reasons:reasons,ratio:ratio};
    if(reasons.length)return {status:"REVIEW_REQUIRED",missing:missing,reasons:reasons,ratio:ratio};
    return {status:"COMPLETE",missing:[],reasons:[],ratio:ratio};
  }
  function statusBadge(s){var cls=s==="VERIFIED"||s==="COMPLETE"?"s-ok":s==="INCOMPLETE"?"s-warn":s==="REVIEW_REQUIRED"?"s-bad":"s-info";return '<span class="status '+cls+'">'+s+'</span>';}

  function renderEvidence(v){
    v.innerHTML='<div class="panel"><h2>Evidence Matrix</h2><p class="muted">แยก Attendance Status ออกจาก Evidence Status เพื่อไม่ให้ “มีรายการสแกน” เท่ากับ “ได้รับการรับรองแล้ว”</p><div class="table-wrap"><table><thead><tr><th>บุคลากร</th><th>QR</th><th>ตัวตน</th><th>เข้า</th><th>ออก</th><th>ระยะเวลา</th><th>Staff</th><th>Evidence Status</th></tr></thead><tbody>'+state.attendance.map(function(r){var u=getUser(r.userId),e=evidenceStatus(r),ratio=e.ratio==null?"—":Math.round(e.ratio*100)+"%";return '<tr><td>'+escapeHtml(u?u.id:u)+'</td><td>'+(r.qrValid?"✓":"✕")+'</td><td>'+(r.identityVerified?"✓":"✕")+'</td><td>'+(r.checkinAt?"✓":"✕")+'</td><td>'+(r.checkoutAt?"✓":"✕")+'</td><td>'+ratio+'</td><td>'+(r.staffVerified?"✓":"✕")+'</td><td>'+statusBadge(e.status)+'<br><span class="muted">'+escapeHtml([].concat(e.missing||[],e.reasons||[]).join(" • "))+'</span></td></tr>';}).join("")+'</tbody></table></div></div>';
  }

  function renderReview(v){
    var rows=state.attendance.map(function(r){var u=getUser(r.userId),a=getActivity(r.activityId),e=evidenceStatus(r);return '<tr><td>'+escapeHtml(u?u.id+" • "+u.name:r.userId)+'</td><td>'+escapeHtml(a?a.title:r.activityId)+'</td><td>'+statusBadge(e.status)+'</td><td>'+escapeHtml([].concat(e.missing||[],e.reasons||[]).join(" • ")||"ไม่มีข้อผิดปกติจากกฎ")+'</td><td><button class="btn secondary reviewBtn" data-id="'+r.id+'">เปิดตรวจสอบ</button></td></tr>';}).join("");
    v.innerHTML='<div class="panel"><h2>Human Review Center</h2><div class="hint">ระบบช่วยชี้รายการที่ควรตรวจสอบ แต่การตัดสินใจสุดท้ายเป็นของผู้ตรวจสอบที่ได้รับมอบหมาย</div><div class="table-wrap"><table><thead><tr><th>ผู้เข้าร่วม</th><th>กิจกรรม</th><th>สถานะ</th><th>เหตุผลจากกฎ</th><th></th></tr></thead><tbody>'+rows+'</tbody></table></div></div><div id="reviewDetail"></div>';
    document.querySelectorAll(".reviewBtn").forEach(function(b){b.onclick=function(){showReviewDetail(b.getAttribute("data-id"));};});
  }
  function showReviewDetail(id){
    var r=state.attendance.find(function(x){return x.id===id;});if(!r)return;
    var u=getUser(r.userId),a=getActivity(r.activityId),e=evidenceStatus(r);
    var tl=[["QR / Identity",r.qrValid&&r.identityVerified?"ผ่าน":"ไม่ครบ"],["Check-in",fmt(r.checkinAt)],["Check-out",fmt(r.checkoutAt)],["Staff Verification",r.staffVerified?fmt(r.staffVerifiedAt):"ไม่มี"]];
    document.getElementById("reviewDetail").innerHTML='<div class="panel"><h2>ตรวจสอบรายการ '+escapeHtml(id)+'</h2><p><b>'+escapeHtml(u?u.name:r.userId)+'</b> • '+escapeHtml(a?a.title:r.activityId)+'</p><div class="timeline">'+tl.map(function(x){return '<div><b>'+x[0]+'</b> — '+escapeHtml(x[1])+'</div>';}).join("")+'</div><p><b>เหตุผล:</b> '+escapeHtml([].concat(e.missing||[],e.reasons||[]).join(" • ")||"ไม่พบข้อผิดปกติจากกฎ")+'</p><div class="field"><label>เหตุผลการตัดสินใจของผู้ตรวจสอบ</label><textarea id="reviewReason">'+escapeHtml(r.humanReason||"")+'</textarea></div><div class="actions"><button class="btn ok" id="rvVerify">รับรอง</button><button class="btn warn" id="rvEvidence">ขอหลักฐานเพิ่ม</button><button class="btn bad" id="rvReject">ไม่รับรอง</button></div></div>';
    function decide(dec,status){r.humanDecision=dec;r.humanReason=document.getElementById("reviewReason").value.trim();r.finalStatus=status;audit("HUMAN_REVIEW",r.id,dec+"|"+r.humanReason);renderReview(document.getElementById("view"));}
    document.getElementById("rvVerify").onclick=function(){decide("VERIFY","VERIFIED");};
    document.getElementById("rvEvidence").onclick=function(){decide("REQUEST_EVIDENCE","REVIEW_REQUIRED");};
    document.getElementById("rvReject").onclick=function(){decide("REJECT","REJECTED");};
  }

  function renderAudit(v){
    v.innerHTML='<div class="panel"><h2>Audit Trail</h2><div class="table-wrap"><table><thead><tr><th>เวลา</th><th>ผู้กระทำ</th><th>เหตุการณ์</th><th>Entity</th><th>รายละเอียด</th></tr></thead><tbody>'+state.audit.map(function(x){return '<tr><td>'+fmt(x.at)+'</td><td>'+escapeHtml(x.actor)+'</td><td>'+escapeHtml(x.action)+'</td><td>'+escapeHtml(x.entity)+'</td><td>'+escapeHtml(x.meta)+'</td></tr>';}).join("")+'</tbody></table></div></div>';
  }

  function researchRows(){
    return state.attendance.map(function(r){var a=getActivity(r.activityId),e=evidenceStatus(r),ratio=e.ratio;return {
      record_id:r.id,participant_hash:hashText(r.userId+"|research-salt-demo"),event_id:r.activityId,activity_type:a?a.category:"",
      qr_valid:r.qrValid?1:0,identity_verified:r.identityVerified?1:0,checkin_time:r.checkinAt||"",checkout_time:r.checkoutAt||"",
      duration_ratio:ratio==null?"":ratio.toFixed(4),staff_verified:r.staffVerified?1:0,signature_verified:r.signatureVerified?1:0,
      missing_evidence_count:(e.missing||[]).length,evidence_mismatch_count:(e.reasons||[]).length,consistency_status:e.status,
      human_decision:r.humanDecision||"",final_status:r.finalStatus||e.status
    };});
  }
  function renderResearch(v){
    v.innerHTML='<div class="panel"><h2>Research Dataset Export</h2><p>ส่งออกข้อมูลแบบลดการระบุตัวบุคคลสำหรับการวิเคราะห์วิจัย โดยใช้ participant_hash แทนรหัสบุคลากรในชุดส่งออก</p><div class="actions"><button class="btn primary" id="csvBtn">ดาวน์โหลด CSV</button><button class="btn secondary" id="jsonBtn">ดาวน์โหลด JSON</button></div><div class="hint">V0.1 ยังไม่สร้าง ground truth หรือ AI prediction อัตโนมัติ ช่องดังกล่าวจะเพิ่มใน V0.2 หลังล็อก codebook และกระบวนการ adjudication</div></div>';
    document.getElementById("csvBtn").onclick=function(){var rows=researchRows();download("activa-research.csv",toCsv(rows),"text/csv;charset=utf-8");audit("RESEARCH_EXPORT","CSV",rows.length+" rows");};
    document.getElementById("jsonBtn").onclick=function(){var rows=researchRows();download("activa-research.json",JSON.stringify(rows,null,2),"application/json");audit("RESEARCH_EXPORT","JSON",rows.length+" rows");};
  }
  function toCsv(rows){if(!rows.length)return "";var h=Object.keys(rows[0]);return [h.join(",")].concat(rows.map(function(r){return h.map(function(k){var s=String(r[k]==null?"":r[k]).replace(/"/g,'""');return '"'+s+'"';}).join(",");})).join("\n");}
  function download(name,content,type){var b=new Blob([content],{type:type}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;a.click();setTimeout(function(){URL.revokeObjectURL(u);},500);}

  render();
})();