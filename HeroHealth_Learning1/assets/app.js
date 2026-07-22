
(() => {
  const C = window.HH_CONFIG;
  const KEY = "herohealth_platform_phase1";
  const defaultState = {
    profile: null,
    view: "student",
    stage: "pretest",
    completed: { pretest:false, hygiene:false, nutrition:false, fitness:false, posttest:false, reflection:false },
    scores: { pretest:null, hygiene:null, nutrition:null, fitness:null, posttest:null },
    group: "A",
    stationRound: 1,
    classRunning: false,
    secondsLeft: C.stationMinutes * 60
  };
  let state = load();

  function load(){
    try { return {...defaultState, ...JSON.parse(localStorage.getItem(KEY)||"{}")}; }
    catch { return structuredClone(defaultState); }
  }
  function save(){ localStorage.setItem(KEY, JSON.stringify(state)); render(); }
  function esc(s){ return String(s??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));}
  function pct(){ const keys=["pretest","hygiene","nutrition","fitness","posttest","reflection"]; return Math.round(keys.filter(k=>state.completed[k]).length/keys.length*100); }
  function nextZone(){
    const seq = C.rotation[state.group] || C.rotation.A;
    return seq.find(id=>!state.completed[id]) || null;
  }
  function routeLabel(){
    if(!state.completed.pretest) return "ทำ Pre-test";
    const z=nextZone(); if(z) return "ไป "+C.zones.find(x=>x.id===z).thai;
    if(!state.completed.posttest) return "ทำ Post-test";
    if(!state.completed.reflection) return "ทำ Reflection";
    return "รับใบประกาศ";
  }
  function go(view){ state.view=view; save(); }
  function toast(msg){
    const t=document.createElement("div");t.className="toast";t.textContent=msg;document.body.appendChild(t);
    setTimeout(()=>t.remove(),2200);
  }
  window.hh = {go,save,toast};

  function topbar(){
    return `<header class="topbar">
      <div class="brand"><div class="logo">❤</div><div>${esc(C.appName)}<div class="small muted">Phase 1 • Station-Based Learning</div></div></div>
      <nav class="nav">
        <button class="${state.view==="student"?"active":""}" onclick="hh.go('student')">นักเรียน</button>
        <button class="${state.view==="classroom"?"active":""}" onclick="hh.go('classroom')">จอห้องเรียน</button>
        <button class="${state.view==="teacher"?"active":""}" onclick="hh.go('teacher')">ครู</button>
      </nav>
      <button class="btn btn-soft" onclick="hh.go('${state.view==="teacher"?"student":"teacher"}')">${state.view==="teacher"?"โหมดนักเรียน":"Teacher"}</button>
    </header>`;
  }

  function login(){
    return `<main class="container"><section class="hero">
      <div class="card hero-card">
        <span class="badge">MISSION DAY</span>
        <h1 style="font-size:clamp(34px,6vw,62px);margin:18px 0 8px">เป็นฮีโร่สุขภาพใน 60 นาที</h1>
        <p class="muted">พิชิต 3 ฐาน ทำแบบประเมิน และรับ Hero Passport</p>
      </div>
      <form class="card" onsubmit="event.preventDefault(); window.startProfile(this)">
        <h2>เข้าสู่ภารกิจ</h2>
        <div class="field"><label>รหัสนักเรียน</label><input name="studentId" required inputmode="numeric" placeholder="เช่น 050101"></div><br>
        <div class="field"><label>ชื่อเล่น</label><input name="name" required maxlength="30" placeholder="เช่น ต้น"></div><br>
        <div class="form-row">
          <div class="field"><label>ห้อง</label><input name="section" required placeholder="ป.5/1"></div>
          <div class="field"><label>กลุ่ม</label><select name="group"><option>A</option><option>B</option><option>C</option></select></div>
        </div><br>
        <button class="btn btn-primary" style="width:100%">รับ Hero Passport</button>
        <p class="small muted" style="margin-top:12px">ต้นแบบนี้เก็บข้อมูลชั่วคราวบนอุปกรณ์เท่านั้น ยังไม่ใช่ข้อมูลทางการ</p>
      </form>
    </section></main>`;
  }
  window.startProfile = form => {
    const d=new FormData(form);
    state.profile={studentId:d.get("studentId"),name:d.get("name"),section:d.get("section")};
    state.group=d.get("group"); save(); toast("สร้าง Hero Passport แล้ว");
  };

  function student(){
    const p=state.profile;
    const nz=nextZone();
    return `<main class="container">
      <section class="hero">
        <div class="card hero-card">
          <div class="passport">
            <div class="avatar">🦸</div>
            <div><span class="badge">HERO PASSPORT</span><h1 style="margin:10px 0">${esc(p.name)}</h1>
              <p class="muted">รหัส ${esc(p.studentId)} • ${esc(p.section)} • กลุ่ม ${esc(state.group)}</p>
              <div class="progress"><span style="width:${pct()}%"></span></div><p style="margin:8px 0 0">${pct()}% ของภารกิจ</p>
            </div>
          </div>
        </div>
        <div class="card"><h2>ภารกิจถัดไป</h2><p class="muted">${routeLabel()}</p>
          ${primaryAction(nz)}
          <button class="btn btn-soft" style="margin-top:10px;width:100%" onclick="window.resetHero()">เปลี่ยนผู้เล่น</button>
        </div>
      </section>
      <h2 style="margin-top:24px">เส้นทางภารกิจ</h2>
      <section class="timeline">${timeline()}</section>
      <h2 style="margin-top:24px">ฐานเรียนรู้</h2>
      <section class="grid">${C.zones.map(zoneCard).join("")}</section>
    </main>`;
  }
  function primaryAction(nz){
    if(!state.completed.pretest) return `<button class="btn btn-light" style="width:100%" onclick="window.completeTask('pretest')">เริ่ม Pre-test</button>`;
    if(nz) return `<button class="btn btn-light" style="width:100%" onclick="window.openZone('${nz}')">เข้าฐานเรียนรู้</button>`;
    if(!state.completed.posttest) return `<button class="btn btn-light" style="width:100%" onclick="window.completeTask('posttest')">เริ่ม Post-test</button>`;
    if(!state.completed.reflection) return `<button class="btn btn-light" style="width:100%" onclick="window.completeTask('reflection')">เขียน Reflection</button>`;
    return `<button class="btn btn-light" style="width:100%" onclick="hh.toast('พร้อมสร้าง Certificate ใน Phase ถัดไป')">ดูผลสำเร็จ</button>`;
  }
  function timeline(){
    const data=[["pretest","Pre-test"],["hygiene","ฐานสุขอนามัย"],["nutrition","ฐานโภชนาการ"],["fitness","ฐานการเคลื่อนไหว"],["posttest","Post-test"],["reflection","Reflection"]];
    return data.map((x,i)=>`<div class="step ${state.completed[x[0]]?"done":""}"><div class="num">${state.completed[x[0]]?"✓":i+1}</div><div><b>${x[1]}</b><div class="small muted">${state.completed[x[0]]?"เสร็จแล้ว":"รอดำเนินการ"}</div></div><span class="badge ${state.completed[x[0]]?"ok":""}">${state.completed[x[0]]?"ผ่าน":"รอ"}</span></div>`).join("");
  }
  function zoneCard(z){
    const done=state.completed[z.id], available=state.completed.pretest && (!done);
    return `<article class="card station ${!available&&!done?"locked":""}" style="border-top:6px solid ${z.accent}">
      <div class="emoji">${z.emoji}</div><h3>${z.thai}</h3><p class="muted">${z.description}</p>
      <span class="badge ${done?"ok":available?"warn":""}">${done?"ผ่านแล้ว":available?"พร้อมเล่น":"ยังล็อก"}</span>
      <div style="margin-top:14px"><button class="btn btn-primary" ${available?"":"disabled"} onclick="window.openZone('${z.id}')">${done?"เล่นซ้ำ":"เริ่มฐาน"}</button></div>
    </article>`;
  }
  window.completeTask = id => { state.completed[id]=true; state.scores[id]=id==="reflection"?4:Math.floor(11+Math.random()*5); save(); toast("บันทึกภารกิจแล้ว"); };
  window.openZone = id => {
    const z=C.zones.find(x=>x.id===id);
    const ok=confirm(`เปิด ${z.thai}\n\nต้นแบบจะเปิด path: ${z.gameUrl}\nกด OK เพื่อจำลองผลผ่าน หรือ Cancel เพื่อไม่เปลี่ยนสถานะ`);
    if(ok){ state.completed[id]=true; state.scores[id]=Math.floor(75+Math.random()*24); save(); toast("ผ่าน "+z.thai); }
  };
  window.resetHero=()=>{ if(confirm("ออกจากผู้เล่นคนนี้และล้างข้อมูลต้นแบบ?")){state=structuredClone(defaultState);save();} };

  function classroom(){
    const seqs=Object.entries(C.rotation);
    return `<main class="container">
      <section class="card hero-card center"><span class="badge">CLASSROOM LIVE</span><h1 style="font-size:42px;margin:14px 0">HeroHealth Mission Day</h1>
      <div class="timer">${formatTime(state.secondsLeft)}</div><p class="muted">${state.classRunning?"กำลังทำภารกิจรอบที่ "+state.stationRound:"รอครูกดเริ่ม"}</p></section>
      <section class="group-board" style="margin-top:18px">${seqs.map(([g,seq])=>{
        const zid=seq[(state.stationRound-1)%3], z=C.zones.find(x=>x.id===zid);
        return `<div class="group"><span class="badge">GROUP ${g}</span><div style="font-size:42px;margin-top:12px">${z.emoji}</div><h2>${z.thai}</h2><p class="muted">รอบ ${state.stationRound} จาก 3</p></div>`;
      }).join("")}</section>
      <div class="card center" style="margin-top:18px"><p class="muted">เมื่อหมดเวลา ให้หยุดเกม ยืนยันการส่งผล และเดินไปฐานถัดไปตามลูกศรของกลุ่ม</p></div>
    </main>`;
  }
  function formatTime(s){return String(Math.floor(s/60)).padStart(2,"0")+":"+String(s%60).padStart(2,"0")}

  function teacher(){
    return `<main class="container">
      <section class="hero">
        <div class="card"><span class="badge">TEACHER CONTROL</span><h1 style="margin-top:14px">ควบคุมคาบเรียน</h1>
          <div class="timer">${formatTime(state.secondsLeft)}</div>
          <div class="actions">
            <button class="btn btn-primary" onclick="window.toggleClass()">${state.classRunning?"พักเวลา":"เริ่มรอบ"}</button>
            <button class="btn btn-soft" onclick="window.nextRound()">เปลี่ยนฐาน</button>
            <button class="btn btn-danger" onclick="window.resetTimer()">รีเซ็ตเวลา</button>
          </div>
        </div>
        <div class="card"><h2>ตั้งค่าคาบนี้</h2>
          <div class="kpis"><div class="kpi"><span class="muted">รอบ</span><b>${state.stationRound}/3</b></div><div class="kpi"><span class="muted">ฐาน</span><b>3</b></div><div class="kpi"><span class="muted">กลุ่ม</span><b>3</b></div><div class="kpi"><span class="muted">เวลา</span><b>${C.stationMinutes}</b></div></div>
          <p class="small muted" style="margin-top:14px">Phase 1 ใช้กลุ่ม A–C เป็นแม่แบบ สามารถขยายเป็น A–J ใน config ได้โดยไม่แก้ UI หลัก</p>
        </div>
      </section>
      <section class="card" style="margin-top:18px"><h2>Rotation Matrix</h2>
        <div class="group-board">${Object.entries(C.rotation).map(([g,seq])=>`<div class="group"><b>กลุ่ม ${g}</b>${seq.map((id,i)=>{const z=C.zones.find(x=>x.id===id);return `<p>${i+1}. ${z.emoji} ${z.thai}</p>`}).join("")}</div>`).join("")}</div>
      </section>
      <section class="card" style="margin-top:18px"><h2>สถานะระบบ</h2>
        <div class="timeline">
          <div class="step done"><div class="num">✓</div><div><b>Student Portal</b><div class="small muted">Login, Passport, Mission Flow</div></div><span class="badge ok">พร้อม</span></div>
          <div class="step done"><div class="num">✓</div><div><b>Classroom Screen</b><div class="small muted">Timer และ Rotation</div></div><span class="badge ok">พร้อม</span></div>
          <div class="step"><div class="num">3</div><div><b>Backend Connection</b><div class="small muted">รอผูก Google Sheet หลัง UI/Game QA</div></div><span class="badge warn">ภายหลัง</span></div>
        </div>
      </section>
    </main>`;
  }
  window.toggleClass=()=>{state.classRunning=!state.classRunning;save();}
  window.nextRound=()=>{state.stationRound=state.stationRound>=3?1:state.stationRound+1;state.secondsLeft=C.stationMinutes*60;save();}
  window.resetTimer=()=>{state.secondsLeft=C.stationMinutes*60;state.classRunning=false;save();}

  setInterval(()=>{if(state.classRunning&&state.secondsLeft>0){state.secondsLeft--;localStorage.setItem(KEY,JSON.stringify(state));render(false)}},1000);

  function render(){
    const body = !state.profile && state.view==="student" ? login() :
      state.view==="student" ? student() :
      state.view==="classroom" ? classroom() : teacher();
    document.getElementById("app").innerHTML=`<div class="shell">${topbar()}${body}</div>`;
  }
  render();
})();
