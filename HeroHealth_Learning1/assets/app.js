(() => {
  'use strict';
  const C = window.HH_CONFIG || {};
  const ROSTER = Array.isArray(window.HH_ROSTER) ? window.HH_ROSTER : [];
  const KEY = 'herohealth_learning_platform_rc2';
  const BUS_KEY = 'herohealth_classroom_control_rc2';
  const defaultCompleted = {pretest:false,hygiene:false,nutrition:false,fitness:false,posttest:false,reflection:false};
  const defaultState = {
    profile:null, pendingProfile:null, view:'student', completed:{...defaultCompleted}, scores:{},
    gameCompleted:{hygiene:{},nutrition:{},fitness:{}}, gameScores:{}, group:null,
    stationRound:1, classRunning:false, secondsLeft:(C.stationMinutes||10)*60,
    processedEventIds:[], activeMissionProfile:C.activeMissionProfile||'CLASS_60'
  };
  let state = load();

  function clone(v){return JSON.parse(JSON.stringify(v));}
  function load(){
    try{
      const raw=JSON.parse(localStorage.getItem(KEY)||'{}');
      const merged=Object.assign(clone(defaultState),raw);
      merged.completed=Object.assign({...defaultCompleted},raw.completed||{});
      merged.gameCompleted=Object.assign(clone(defaultState.gameCompleted),raw.gameCompleted||{});
      merged.processedEventIds=Array.isArray(raw.processedEventIds)?raw.processedEventIds.slice(-200):[];
      return merged;
    }catch(_){return clone(defaultState);}
  }
  function persist(renderNow=true){localStorage.setItem(KEY,JSON.stringify(state));if(renderNow)render();}
  function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));}
  function toast(msg){const n=document.createElement('div');n.className='toast';n.textContent=msg;document.body.appendChild(n);setTimeout(()=>n.remove(),2600);}
  function zone(id){return (C.zones||[]).find(z=>z.id===id);}
  function game(zoneId,gameId){return zone(zoneId)?.games?.find(g=>g.id===gameId)||null;}
  function sequence(){return (C.rotation&&C.rotation[state.group])||[];}
  function profile(){return C.missionProfiles?.[state.activeMissionProfile]||C.missionProfiles?.CLASS_60||null;}
  function requiredGameIds(zoneId){return profile()?.games?.[zoneId]||[];}
  function requiredGames(zoneId){return requiredGameIds(zoneId).map(id=>game(zoneId,id)).filter(Boolean);}
  function nextGame(zoneId){return requiredGames(zoneId).find(g=>!state.gameCompleted?.[zoneId]?.[g.id])||null;}
  function zoneDone(zoneId){const ids=requiredGameIds(zoneId);return ids.length>0&&ids.every(id=>state.gameCompleted?.[zoneId]?.[id]);}
  function syncZoneCompletion(zoneId){state.completed[zoneId]=zoneDone(zoneId);}
  function nextZone(){return sequence().find(id=>!state.completed[id])||null;}
  function progress(){const k=['pretest','hygiene','nutrition','fitness','posttest','reflection'];return Math.round(k.filter(x=>state.completed[x]).length/k.length*100);}
  function isLocked(){return C.deploymentState==='LOCKED_FOR_STUDENT_QA';}
  function formatTime(s){return `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
  function getQueryId(){const q=new URLSearchParams(location.search);return q.get('sid')||q.get('studentId')||'';}
  function normalizeId(v){return String(v||'').trim().replace(/\s+/g,'');}
  function findStudent(id){const key=normalizeId(id);return ROSTER.find(s=>normalizeId(s.studentId)===key&&s.active!==false)||null;}
  function validateProfile(s){return s&&s.studentId&&s.fullName&&s.section&&C.rotation&&C.rotation[s.group];}
  function activeGameCount(){return (C.zones||[]).reduce((sum,z)=>sum+requiredGameIds(z.id).length,0);}
  function allGameCount(){return (C.zones||[]).reduce((sum,z)=>sum+(z.games||[]).length,0);}

  function topbar(){return `<header class="topbar"><div class="brand"><div class="logo">❤</div><div>${esc(C.appName||'HeroHealth')}<div class="small muted">${esc(C.platformVersion||'')}</div></div></div><nav class="nav"><button class="${state.view==='student'?'active':''}" onclick="HH.go('student')">นักเรียน</button><button class="${state.view==='classroom'?'active':''}" onclick="HH.go('classroom')">จอห้องเรียน</button><button class="${state.view==='teacher'?'active':''}" onclick="HH.go('teacher')">ครู</button></nav><button class="btn btn-soft" onclick="HH.go('${state.view==='teacher'?'student':'teacher'}')">${state.view==='teacher'?'โหมดนักเรียน':'Teacher'}</button></header>`;}
  function lockedBanner(){return isLocked()?`<div class="card" style="border-left:6px solid #f59e0b;margin-bottom:16px"><span class="badge warn">SYSTEM QA LOCK</span><h3 style="margin:10px 0 4px">ยังไม่เปิดให้นักเรียนใช้งานจริง</h3><p class="muted" style="margin:0">กำลังตรวจ URL เกมทั้ง ${allGameCount()} เกม ระบบรับผล และรายชื่อนักเรียน</p></div>`:'';}

  function login(){const ready=ROSTER.length>0;return `<main class="container">${lockedBanner()}<section class="hero"><div class="card hero-card"><span class="badge">MISSION DAY</span><h1 style="font-size:clamp(34px,6vw,62px);margin:18px 0 8px">เป็นฮีโร่สุขภาพใน 60 นาที</h1><p class="muted">Mission Profile: ${esc(profile()?.label||state.activeMissionProfile)}</p><div class="kpis" style="margin-top:24px"><div class="kpi"><span>รายชื่อ</span><b>${ROSTER.length}</b></div><div class="kpi"><span>เกมในคาบ</span><b>${activeGameCount()}</b></div><div class="kpi"><span>เกมทั้งหมด</span><b>${allGameCount()}</b></div><div class="kpi"><span>สถานะ</span><b>${isLocked()?'QA':'OPEN'}</b></div></div></div><form class="card" onsubmit="event.preventDefault();HH.lookup(this)"><h2>เข้าสู่ภารกิจ</h2><p class="muted">กรอกรหัสนักเรียนหรือเปิดจาก QR ระบบดึงชื่อ ห้อง และกลุ่มให้อัตโนมัติ</p><div class="field"><label>รหัสนักเรียน</label><input name="studentId" required inputmode="numeric" autocomplete="off" value="${esc(getQueryId())}" placeholder="กรอกรหัสนักเรียน"></div><br><button class="btn btn-primary" style="width:100%" ${!ready?'disabled':''}>ตรวจสอบข้อมูล</button>${!ready?'<p class="small" style="color:#b91c1c;margin-top:12px">ยังไม่ได้ใส่รายชื่อนักเรียน</p>':''}</form></section></main>`;}
  function confirmProfile(){const p=state.pendingProfile;return `<main class="container">${lockedBanner()}<section class="card" style="max-width:680px;margin:auto"><span class="badge ok">พบข้อมูลนักเรียน</span><h1 style="margin:14px 0">${esc(p.fullName)}</h1><div class="kpis"><div class="kpi"><span class="muted">รหัส</span><b style="font-size:18px">${esc(p.studentId)}</b></div><div class="kpi"><span class="muted">ห้อง</span><b>${esc(p.section)}</b></div><div class="kpi"><span class="muted">กลุ่ม</span><b>${esc(p.group)}</b></div><div class="kpi"><span class="muted">ฐานแรก</span><b style="font-size:18px">${esc(zone((C.rotation[p.group]||[])[0])?.thai||'-')}</b></div></div><div class="actions" style="margin-top:20px"><button class="btn btn-primary" onclick="HH.confirmLogin()" ${isLocked()?'disabled':''}>ยืนยันและเริ่มภารกิจ</button><button class="btn btn-soft" onclick="HH.cancelLogin()">ไม่ใช่ข้อมูลของฉัน</button></div></section></main>`;}
  function nextLabel(){if(!state.completed.pretest)return'ทำ Pre-test';const zid=nextZone();if(zid){const g=nextGame(zid);return g?`${zone(zid)?.thai}: ${g.thai}`:`ไป${zone(zid)?.thai||zid}`;}if(!state.completed.posttest)return'ทำ Post-test';if(!state.completed.reflection)return'ทำ Reflection';return'รับใบประกาศ';}
  function student(){const p=state.profile,nz=nextZone();return `<main class="container">${lockedBanner()}<section class="hero"><div class="card hero-card"><div class="passport"><div class="avatar">🦸</div><div><span class="badge">HERO PASSPORT</span><h1 style="margin:10px 0">${esc(p.fullName)}</h1><p class="muted">รหัส ${esc(p.studentId)} • ${esc(p.section)} • กลุ่ม ${esc(state.group)}</p><div class="progress"><span style="width:${progress()}%"></span></div><p style="margin:8px 0 0">${progress()}% ของภารกิจ</p></div></div></div><div class="card"><h2>ภารกิจถัดไป</h2><p class="muted">${esc(nextLabel())}</p>${primaryAction(nz)}<button class="btn btn-soft" style="margin-top:10px;width:100%" onclick="HH.logout()">ออกจากผู้เล่น</button></div></section><h2 style="margin-top:24px">เส้นทางภารกิจ</h2><section class="timeline">${timeline()}</section><h2 style="margin-top:24px">ฐานเรียนรู้</h2><section class="grid">${(C.zones||[]).map(zoneCard).join('')}</section></main>`;}
  function primaryAction(nz){if(isLocked())return'<button class="btn btn-primary" style="width:100%" disabled>ระบบยังล็อกสำหรับ QA</button>';if(!state.completed.pretest)return'<button class="btn btn-light" style="width:100%" onclick="HH.openRoute(\'pretest\')">เริ่ม Pre-test</button>';if(nz)return`<button class="btn btn-light" style="width:100%" onclick="HH.openNextGame('${nz}')">เริ่มเกมถัดไป</button>`;if(!state.completed.posttest)return'<button class="btn btn-light" style="width:100%" onclick="HH.openRoute(\'posttest\')">เริ่ม Post-test</button>';if(!state.completed.reflection)return'<button class="btn btn-light" style="width:100%" onclick="HH.openRoute(\'reflection\')">ทำ Reflection</button>';return'<button class="btn btn-light" style="width:100%" onclick="HH.openRoute(\'certificate\')">ดูผลสำเร็จ</button>';}
  function timeline(){return [['pretest','Pre-test'],['hygiene','ฐานสุขอนามัย'],['nutrition','ฐานโภชนาการ'],['fitness','ฐานการเคลื่อนไหว'],['posttest','Post-test'],['reflection','Reflection']].map((x,i)=>`<div class="step ${state.completed[x[0]]?'done':''}"><div class="num">${state.completed[x[0]]?'✓':i+1}</div><div><b>${x[1]}</b><div class="small muted">${state.completed[x[0]]?'เสร็จแล้ว':'รอดำเนินการ'}</div></div><span class="badge ${state.completed[x[0]]?'ok':''}">${state.completed[x[0]]?'ผ่าน':'รอ'}</span></div>`).join('');}
  function zoneCard(z){const req=requiredGames(z.id),doneCount=req.filter(g=>state.gameCompleted?.[z.id]?.[g.id]).length,done=state.completed[z.id],current=nextZone()===z.id,available=!isLocked()&&state.completed.pretest&&current;const items=req.map(g=>`<div class="small" style="margin-top:7px">${state.gameCompleted?.[z.id]?.[g.id]?'✅':'⬜'} ${esc(g.thai)} <span class="muted">(${esc(g.status)})</span></div>`).join('');return `<article class="card station ${!available&&!done?'locked':''}" style="border-top:6px solid ${esc(z.accent)}"><div class="emoji">${z.emoji}</div><h3>${esc(z.thai)}</h3><p class="muted">${esc(z.description)}</p><span class="badge ${done?'ok':available?'warn':''}">${done?'ผ่านแล้ว':available?'ฐานปัจจุบัน':'ยังล็อก'} • ${doneCount}/${req.length}</span><div style="margin-top:12px">${items||'<span class="small muted">ยังไม่ได้กำหนดเกมใน Mission Profile</span>'}</div><div style="margin-top:14px"><button class="btn btn-primary" ${available?'':'disabled'} onclick="HH.openNextGame('${z.id}')">${doneCount?'เล่นเกมถัดไป':'เริ่มฐาน'}</button></div></article>`;}

  function classroom(){const groups=Object.entries(C.rotation||{});return `<main class="container">${lockedBanner()}<section class="card hero-card center"><span class="badge">CLASSROOM LIVE</span><h1 style="font-size:42px;margin:14px 0">HeroHealth Mission Day</h1><div class="timer">${formatTime(state.secondsLeft)}</div><p class="muted">${state.classRunning?'กำลังทำภารกิจรอบที่ '+state.stationRound:'รอครูกดเริ่ม'}</p></section><section class="group-board" style="margin-top:18px">${groups.map(([g,seq])=>{const z=zone(seq[(state.stationRound-1)%3]);return `<div class="group"><span class="badge">GROUP ${g}</span><div style="font-size:42px;margin-top:12px">${z?.emoji||'?'}</div><h2>${esc(z?.thai||'-')}</h2><p class="muted">รอบ ${state.stationRound} จาก 3</p></div>`;}).join('')}</section></main>`;}
  function teacher(){return `<main class="container"><section class="hero"><div class="card"><span class="badge">TEACHER CONTROL</span><h1 style="margin-top:14px">ควบคุมคาบเรียน</h1><div class="timer">${formatTime(state.secondsLeft)}</div><div class="actions"><button class="btn btn-primary" onclick="HH.toggleClass()">${state.classRunning?'พักเวลา':'เริ่มรอบ'}</button><button class="btn btn-soft" onclick="HH.nextRound()">เปลี่ยนฐาน</button><button class="btn btn-danger" onclick="HH.resetTimer()">รีเซ็ตเวลา</button></div></div><div class="card"><h2>Production Readiness</h2><div class="kpis"><div class="kpi"><span>Roster</span><b>${ROSTER.length}</b></div><div class="kpi"><span>Catalog</span><b>${allGameCount()}</b></div><div class="kpi"><span>Mission</span><b>${activeGameCount()}</b></div><div class="kpi"><span>Lock</span><b>${isLocked()?'ON':'OFF'}</b></div></div><p class="small muted" style="margin-top:14px">${esc(profile()?.description||'')}</p></div></section><section class="card" style="margin-top:18px"><h2>Game Catalog QA</h2><div class="grid">${(C.zones||[]).map(z=>`<div class="group"><b>${z.emoji} ${esc(z.thai)}</b>${(z.games||[]).map(g=>`<p class="small">${g.status==='provided-production'?'🟢':'🟡'} ${esc(g.thai)}<br><span class="muted">${esc(g.url)}</span></p>`).join('')}</div>`).join('')}</div></section><section class="card" style="margin-top:18px"><h2>Rotation Matrix</h2><div class="group-board">${Object.entries(C.rotation||{}).map(([g,seq])=>`<div class="group"><b>กลุ่ม ${g}</b>${seq.map((id,i)=>`<p>${i+1}. ${zone(id)?.emoji||''} ${esc(zone(id)?.thai||id)}</p>`).join('')}</div>`).join('')}</div></section></main>`;}

  function render(){let body;if(state.view==='student'&&!state.profile)body=state.pendingProfile?confirmProfile():login();else if(state.view==='student')body=student();else if(state.view==='classroom')body=classroom();else body=teacher();document.getElementById('app').innerHTML=`<div class="shell">${topbar()}${body}</div>`;}
  function receiveGameResult(event){
    if(event.origin!==location.origin)return;
    const m=event.data||{};if(m.type!=='HEROHEALTH_GAME_COMPLETE'||!m.payload)return;
    const p=m.payload;if(!state.profile||normalizeId(p.studentId)!==normalizeId(state.profile.studentId))return;
    if(!p.eventId||state.processedEventIds.includes(p.eventId)||p.passed!==true)return;
    const zid=nextZone();const expected=nextGame(zid);
    if(!zid||p.zone!==zid||!expected||p.gameId!==expected.id)return;
    state.processedEventIds.push(p.eventId);state.processedEventIds=state.processedEventIds.slice(-200);
    state.gameCompleted[zid][p.gameId]=true;state.gameScores[`${zid}:${p.gameId}`]=Number(p.score)||0;
    syncZoneCompletion(zid);persist();toast(state.completed[zid]?`ผ่าน ${zone(zid)?.thai} ครบแล้ว`:`บันทึก ${expected.thai} แล้ว`);
  }
  addEventListener('message',receiveGameResult);
  addEventListener('storage',e=>{if(e.key===BUS_KEY&&e.newValue){const x=JSON.parse(e.newValue);state.stationRound=x.stationRound;state.classRunning=x.classRunning;state.secondsLeft=x.secondsLeft;persist();}});

  window.HH={
    go(v){state.view=v;persist();},
    lookup(form){const id=normalizeId(new FormData(form).get('studentId'));const s=findStudent(id);if(!s){toast('ไม่พบรหัสนักเรียน กรุณาติดต่อครูประจำฐาน');return;}if(!validateProfile(s)){toast('ข้อมูลนักเรียนไม่สมบูรณ์ กรุณาติดต่อครู');return;}state.pendingProfile=clone(s);persist();},
    cancelLogin(){state.pendingProfile=null;persist();},
    confirmLogin(){if(isLocked()){toast('ระบบยังไม่เปิดให้นักเรียนใช้งาน');return;}state.profile=clone(state.pendingProfile);state.group=state.profile.group;state.pendingProfile=null;persist();},
    logout(){if(confirm('ออกจาก Hero Passport ของผู้เล่นนี้?')){state=clone(defaultState);persist();}},
    openNextGame(zoneId){
      if(isLocked()){toast('ระบบยังล็อกสำหรับ QA');return;}
      if(zoneId!==nextZone()){toast('ยังไม่ถึงฐานนี้');return;}
      const g=nextGame(zoneId);if(!g?.url){toast('ยังไม่ได้กำหนดเกมถัดไป');return;}
      const u=new URL(g.url,location.href);u.searchParams.set('studentId',state.profile.studentId);u.searchParams.set('section',state.profile.section);u.searchParams.set('group',state.group);u.searchParams.set('zone',zoneId);u.searchParams.set('gameId',g.id);u.searchParams.set('missionProfile',state.activeMissionProfile);u.searchParams.set('return',location.href);location.href=u.href;
    },
    openRoute(id){if(isLocked()){toast('ระบบยังล็อกสำหรับ QA');return;}const r=C.routes?.[id];if(!r||r.startsWith('#')){toast('ยังไม่ได้สร้างหน้า '+id);return;}location.href=r;},
    toggleClass(){state.classRunning=!state.classRunning;broadcast();persist();},
    nextRound(){state.stationRound=state.stationRound>=3?1:state.stationRound+1;state.secondsLeft=(C.stationMinutes||10)*60;broadcast();persist();},
    resetTimer(){state.secondsLeft=(C.stationMinutes||10)*60;state.classRunning=false;broadcast();persist();}
  };
  function broadcast(){localStorage.setItem(BUS_KEY,JSON.stringify({stationRound:state.stationRound,classRunning:state.classRunning,secondsLeft:state.secondsLeft,ts:Date.now()}));}
  setInterval(()=>{if(state.classRunning&&state.secondsLeft>0){state.secondsLeft--;localStorage.setItem(KEY,JSON.stringify(state));render();}},1000);
  render();
})();