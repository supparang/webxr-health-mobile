// Hygiene Rhythm — 4 Games (V4 Complete)
// เพิ่ม Tap/Hold/Swipe, Weekly Missions, Chain-3, Summary, Badges, LocalStorage
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();

function init(){
  const $=sel=>document.querySelector(sel);
  const scene=$("#scene"), hud=$("#hud");
  const btnStart=$("#btnStart"), btnReset=$("#btnReset");
  const selTask=$("#task"), selDiff=$("#difficulty"), selBpm=$("#bpm"), selTrain=$("#training");
  const calib=$("#calib"), calibVal=$("#calibVal");
  const THAI_FONT = $("#thaiFont")?.getAttribute("src");

  // ---------- Text helper ----------
  function label3D(value, opts={}){
    const e=document.createElement('a-entity');
    const {color="#e2e8f0", fontSize=0.18, maxWidth=5, x=0, y=0, z=0.06, align="center"} = opts;
    e.setAttribute('troika-text',`value:${value}; font:${THAI_FONT}; color:${color}; fontSize:${fontSize}; maxWidth:${maxWidth}; align:${align}`.replace(/\s+/g,' '));
    e.setAttribute('position',`${x} ${y} ${z}`); e.setAttribute('material','shader: standard; roughness:1; metalness:0');
    return e;
  }
  function toast(text,color){ const t=label3D(text,{color,fontSize:0.2,y:0.95}); uiRoot.appendChild(t); setTimeout(()=>t.remove(),600); }

  // ---------- Audio (metronome) ----------
  let actx=null,gain=null;
  function ensureAudio(){ if(actx) return; const AC=window.AudioContext||window.webkitAudioContext; if(!AC) return; actx=new AC(); gain=actx.createGain(); gain.gain.value=0.12; gain.connect(actx.destination); }
  function click(){ if(!actx) return; const o=actx.createOscillator(), g=actx.createGain(); o.type="square"; o.frequency.value=880; o.connect(g); g.connect(gain);
    const t=actx.currentTime; g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.22,t+0.005); g.gain.exponentialRampToValueAtTime(0.0001,t+0.05); o.start(t); o.stop(t+0.06); }
  ["pointerdown","touchend","click","keydown"].forEach(ev=>window.addEventListener(ev,()=>ensureAudio(),{once:true,capture:true}));

  // ---------- Scene roots ----------
  const uiRoot = (()=>{
    let el=document.getElementById("root");
    if(!el){ el=document.createElement('a-entity'); el.setAttribute('id','root'); el.setAttribute('position','0 1.25 -3'); scene.appendChild(el); }
    return el;
  })();

  // ---------- Difficulty / timing ----------
  const DIFF = { easy:{hit:0.18, secs:70}, normal:{hit:0.14, secs:85}, hard:{hit:0.10, secs:100} };
  let beatSec = 60 / parseInt(selBpm?.value||"96",10);

  // ---------- 4 Tasks ----------
  const TASKS = {
    bathe: { name:"อาบน้ำ", emojis:["#em-shower","#em-soap","#em-scrub","#em-towel"], goalText:"ชำระร่างกายครบส่วนใน 1 รอบ",
      init:(s)=>{ s.goalHits=36; }, onHit:(s)=>{ s.goalHits--; }, pass:(s)=> s.goalHits<=0 },
    oral:  { name:"ช่องปากและฟัน", emojis:["#em-brush","#em-tooth","#em-brush","#em-tooth","#em-dent"], goalText:"แปรงฟัน 2 นาที + ตี 'ตรวจฟัน' ≥1",
      init:(s)=>{ s.duration=120; s.dentOK=false; }, onNoteSpawn:(s,n)=>{ if(Math.random()<0.10){ n.setAttribute('material','src:#em-dent; shader:flat; opacity:0.98; transparent:true'); n.__isDent=true; } }, onHit:(s,n)=>{ if(n?.__isDent) s.dentOK=true; }, pass:(s)=> s.elapsed>=120 && s.dentOK },
    hands: { name:"ล้างมือ", seq:["#em-water","#em-soap","#em-foam","#em-hands","#em-nail","#em-water","#em-dry"], emojis:["#em-water","#em-soap","#em-foam","#em-hands","#em-nail","#em-water","#em-dry"], goalText:"ทำครบ 7 ขั้น ≥1 รอบ",
      init:(s)=>{ s.stepIndex=0; s.stepDone=0; }, onHit:(s)=>{ s.stepIndex=(s.stepIndex+1)%7; if(s.stepIndex===0) s.stepDone++; }, pass:(s)=> s.stepDone>=1 },
    nails: { name:"ดูแลเล็บ", emojis:["#em-clip","#em-clean","#em-nail"], goalText:"ตัด/ทำความสะอาดเล็บ ≥12 ครั้ง",
      init:(s)=>{ s.trimLeft=12; }, onHit:(s)=>{ s.trimLeft--; }, pass:(s)=> s.trimLeft<=0 },
  };

  // ---------- Lanes (3 pads) ----------
  const laneX = [-0.8, 0, 0.8];
  const lanePads = [];
  function buildLanePads(){
    lanePads.splice(0).forEach(p=>p?.remove?.());
    for(let i=0;i<3;i++){
      const pad=document.createElement('a-entity');
      pad.classList.add('clickable'); pad.dataset.lane=i;
      pad.setAttribute('geometry','primitive: plane; width: 0.68; height: 0.42');
      pad.setAttribute('material','color:#0f172a; opacity:0.95; shader:flat');
      pad.setAttribute('position',`${laneX[i]} -0.62 0.06`);
      const t=label3D(i===0?"A\nLEFT":i===1?"S\nCENTER":"D\nRIGHT",{fontSize:0.14,y:0,z:0.01,color:"#93c5fd"});
      pad.appendChild(t);

      // Touch swipe detection (mobile)
      let startX=null, endX=null;
      pad.addEventListener('touchstart',e=>{ startX = e.changedTouches[0].clientX; },{passive:true});
      pad.addEventListener('touchend',e=>{
        endX = e.changedTouches[0].clientX;
        const dx = (endX - startX);
        if(Math.abs(dx)>40){ judgeHit(i, dx<0?-1:1); } else { judgeHit(i,null); }
      },{passive:true});

      // Click/Pointer (desktop/VR)
      pad.addEventListener('click',()=>judgeHit(i,null));
      pad.addEventListener('pointerup',()=>judgeHit(i,null));
      uiRoot.appendChild(pad);
      lanePads.push(pad);
    }
  }

  // ---------- Fever Gauge ----------
  let feverGauge=null;
  function buildFeverUI(){
    if(feverGauge) feverGauge.remove();
    feverGauge=document.createElement('a-entity');
    feverGauge.setAttribute('geometry','primitive: plane; width: 2.2; height: 0.06');
    feverGauge.setAttribute('material','color:#1e293b; opacity:0.95; shader:flat');
    feverGauge.setAttribute('position','0 0.9 0.05');
    const fill=document.createElement('a-entity');
    fill.setAttribute('geometry','primitive: plane; width: 0.01; height: 0.06');
    fill.setAttribute('material','color:#7dfcc6; opacity:0.96; shader:flat');
    fill.setAttribute('position','-1.1 0 0.01');
    feverGauge.__fill=fill; feverGauge.appendChild(fill);
    const label=label3D("FEVER",{fontSize:0.14,y:0.1,color:"#cbd5e1"}); feverGauge.appendChild(label);
    uiRoot.appendChild(feverGauge);
  }
  function setFeverFill(ratio){
    if(!feverGauge) return;
    const w = Math.max(0.01, Math.min(2.2*ratio, 2.2));
    feverGauge.__fill.setAttribute('geometry',`primitive: plane; width:${w}; height:0.06`);
    feverGauge.__fill.setAttribute('position',`${-1.1 + w/2} 0 0.01`);
  }

  // ---------- Summary Panel ----------
  let summaryPanel=null;
  function showSummary(pass, acc){
    if(summaryPanel) summaryPanel.remove();
    summaryPanel=document.createElement('a-entity');
    summaryPanel.setAttribute('geometry','primitive: plane; width: 2.2; height: 1.2');
    summaryPanel.setAttribute('material','color:#0b1220; opacity:0.96; shader:flat');
    summaryPanel.setAttribute('position','0 0.2 0.08');
    const title=label3D(pass?"ภารกิจสำเร็จ! ✅":"ยังไม่ผ่าน ❌",{fontSize:0.24,y:0.48,color:pass?"#7dfcc6":"#fecaca"});
    const stats=label3D(
      `คะแนน: ${state.score}\nคอมโบสูงสุด: ${state.best}\nความแม่นยำ: ${acc}%\nมัลติเพลายเออร์: x${state.multiplier}${state.feverOn?" (Fever)":""}\nแบดจ์ที่ปลดล็อก: ${unlockBadges().join(", ")||"-"}`,
      {fontSize:0.16,y:0.08,color:"#e2e8f0"}
    );
    summaryPanel.appendChild(title); summaryPanel.appendChild(stats);

    const btnNext=document.createElement('a-entity');
    btnNext.classList.add('clickable');
    btnNext.setAttribute('geometry','primitive: plane; width: 0.9; height: 0.28');
    btnNext.setAttribute('material','color:#93c5fd; opacity:0.96; shader:flat');
    btnNext.setAttribute('position','-0.55 -0.4 0.01');
    btnNext.appendChild(label3D("Continue (Chain-3)",{fontSize:0.16,color:"#06223a"}));
    btnNext.addEventListener('click',()=>{ summaryPanel.remove(); nextChain(); });

    const btnClose=document.createElement('a-entity');
    btnClose.classList.add('clickable');
    btnClose.setAttribute('geometry','primitive: plane; width: 0.9; height: 0.28');
    btnClose.setAttribute('material','color:#7dfcc6; opacity:0.96; shader:flat');
    btnClose.setAttribute('position','0.55 -0.4 0.01');
    btnClose.appendChild(label3D("Finish",{fontSize:0.16,color:"#053b2a"}));
    btnClose.addEventListener('click',()=>summaryPanel.remove());

    summaryPanel.appendChild(btnNext); summaryPanel.appendChild(btnClose);
    uiRoot.appendChild(summaryPanel);
  }

  // ---------- Missions / Badges (localStorage) ----------
  const LS_KEY="hygieneRhythmV4_profile";
  function loadProfile(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)||"{}"); }catch(e){ return {}; } }
  function saveProfile(p){ try{ localStorage.setItem(LS_KEY, JSON.stringify(p)); }catch(e){} }

  function weekKey(){
    const d=new Date(); const firstMonday= new Date(d); // simple week key: ISO week yyyy-Wxx
    const yyyy=d.getUTCFullYear(); const oneJan = new Date(Date.UTC(yyyy,0,1));
    const days=Math.floor((d - oneJan)/86400000)+1;
    const week = Math.ceil((days + (oneJan.getUTCDay()+6)%7)/7);
    return `${yyyy}-W${week}`;
  }

  const MISSIONS = [
    {id:"perfect30", text:"เก็บ Perfect ≥ 30", check:(s)=>s.perfectCount>=30, reward:50},
    {id:"fever2",    text:"เปิด Fever ≥ 2 ครั้ง", check:(s)=>s.feverCount>=2,  reward:30},
    {id:"hands2",    text:"ล้างมือครบ 7 ขั้น ≥ 2 รอบ", check:(s)=> (s.taskKey==="hands" && s.stepDone>=2), reward:20},
  ];
  function initWeek(p){
    const wk=weekKey(); if(p.weekKey!==wk){ p.weekKey=wk; p.weekProg={}; MISSIONS.forEach(m=>p.weekProg[m.id]=false); p.coins=(p.coins||0); }
    if(!p.badges) p.badges=[];
    if(!p.chain){ p.chain={active:false, index:0, path:[]}; }
  }

  function applyMissionsEnd(state){
    const p = loadProfile(); initWeek(p);
    let coins=0;
    MISSIONS.forEach(m=>{
      if(!p.weekProg[m.id] && m.check(state)){ p.weekProg[m.id]=true; coins+=m.reward; }
    });
    if(coins>0){ p.coins = (p.coins||0) + coins; toast(`รับเหรียญ +${coins}`, "#7dfcc6"); }
    saveProfile(p);
  }

  function unlockBadges(){
    const p = loadProfile(); initWeek(p);
    const acc = state.accTotal? Math.round(state.accHit/state.accTotal*100):0;
    const newly=[];
    function award(id){ if(!p.badges.includes(id)){ p.badges.push(id); newly.push(id); } }
    if(state.best>=50) award("Combo 50");
    if(acc>=90) award("Accuracy 90%");
    if(state.feverSeenMax>=3) award("Fever x3");
    saveProfile(p);
    return newly;
  }

  // Chain-3 (เล่น 3 ด่านต่อเนื่อง): สลับ task ตามพรีเซ็ต
  const CHAIN_PATH = ["bathe","hands","oral"];
  function startChain(){
    const p=loadProfile(); initWeek(p);
    p.chain={active:true, index:0, path:CHAIN_PATH}; saveProfile(p);
    selTask.value = p.chain.path[0]; applyTask(); toast("Chain-3 เริ่ม!", "#93c5fd");
    start();
  }
  function nextChain(){
    const p=loadProfile(); initWeek(p);
    if(!p.chain.active) return;
    p.chain.index++;
    if(p.chain.index>=p.chain.path.length){
      p.chain={active:false,index:0,path:[]}; saveProfile(p);
      toast("Chain-3 จบครบ 3 ด่าน! 🎖️","#7dfcc6");
      return;
    }
    selTask.value = p.chain.path[p.chain.index]; saveProfile(p); applyTask(); start();
  }

  // ---------- State ----------
  const state={
    running:false, raf:0, t0:0, elapsed:0,
    score:0, combo:0, best:0, accHit:0, accTotal:0,
    perfectCount:0, feverCount:0, feverSeenMax:0,
    hitWindow:DIFF.easy.hit, duration:DIFF.easy.secs,
    calibrationMs:0, taskKey: selTask?.value || "bathe",
    fever:0, feverOn:false, feverEnd:0, multiplier:1,
    trainOn: (selTrain?.value||"on")==="on",
  };
  let notes=[]; // {el, t, z, lane, judged, type:'tap'|'hold'|'swipe', holdEnd?, dir?(-1/1), __isDent?}
  let nextBeat=0;

  // ---------- Settings ----------
  function applyDiff(){ const d=DIFF[selDiff.value]||DIFF.easy; state.hitWindow=d.hit; state.duration=d.secs; }
  function applyBPM(){ beatSec = 60 / parseInt(selBpm.value||"96",10); }
  function applyTask(){ state.taskKey = selTask.value; (TASKS[state.taskKey]?.init||(()=>{}))(state); }
  function applyCalib(){ state.calibrationMs = parseInt(calib.value||"0",10); calibVal.textContent = state.calibrationMs; }
  function setHUD(msg=""){
    const T=TASKS[state.taskKey], name=T?.name||state.taskKey;
    const acc = state.accTotal? Math.round(state.accHit/state.accTotal*100):0;
    let extra="";
    if(state.taskKey==="bathe") extra=`เหลือ ${Math.max(0,state.goalHits)} จังหวะ`;
    if(state.taskKey==="oral")  extra=`ตรวจฟัน: ${state.dentOK?"✅":"—"}`;
    if(state.taskKey==="hands") extra=`รอบ 7 ขั้น: ${state.stepDone||0}`;
    if(state.taskKey==="nails") extra=`เหลือ ${Math.max(0,state.trimLeft)} ครั้ง`;
    hud.textContent = `Hygiene Rhythm • ${name}\nscore=${state.score} combo=${state.combo} best=${state.best} acc=${acc}% x${state.multiplier} ${state.feverOn?"• FEVER":""}\nเวลา ${Math.max(0,Math.ceil(state.duration - state.elapsed))}s\n${T?.goalText||""}\n${extra}\n${msg}`;
  }

  // ---------- Notes generator (Tap/Hold/Swipe) ----------
  const laneXPos = [-0.8,0,0.8];
  function randomLane(){ return (Math.random()*3)|0; }
  function noteMat(src){ return `src:${src}; shader:flat; opacity:0.98; transparent:true`; }

  function spawnTap(lane, aheadSec=1.6, srcOverride=null){
    const n=document.createElement('a-entity');
    n.classList.add('note'); n.setAttribute('geometry','primitive: plane; width:0.6; height:0.6');
    const T=TASKS[state.taskKey]; let src = srcOverride || T.emojis[(Math.random()*T.emojis.length)|0];
    if(state.taskKey==="hands"){ const idx=(state.stepIndex||0)%7; src=T.seq[idx]; }
    n.setAttribute('material',noteMat(src));
    n.object3D.position.set(laneXPos[lane],0,2.8); uiRoot.appendChild(n);
    if(T.onNoteSpawn) T.onNoteSpawn(state, n);
    const obj={el:n, lane, t:state.elapsed+aheadSec, z:2.8, judged:false, type:'tap', __isDent:n.__isDent};
    notes.push(obj); return obj;
  }

  function spawnHold(lane, beatsLen=2, aheadSec=1.8){
    const T=TASKS[state.taskKey]; let src = (state.taskKey==="hands")?T.seq[(state.stepIndex||0)%7]:T.emojis[(Math.random()*T.emojis.length)|0];
    const head=document.createElement('a-entity');
    head.classList.add('note'); head.setAttribute('geometry','primitive: plane; width:0.6; height:0.6');
    head.setAttribute('material',noteMat(src)); head.object3D.position.set(laneXPos[lane],0,2.8); uiRoot.appendChild(head);
    // body bar
    const body=document.createElement('a-entity');
    body.setAttribute('geometry','primitive: plane; width:0.18; height:1.2'); body.setAttribute('material','color:#93c5fd; opacity:0.65; shader:flat');
    body.object3D.position.set(laneXPos[lane],0,2.2); uiRoot.appendChild(body);
    const tStart = state.elapsed + aheadSec;
    const holdDur = beatsLen*beatSec;
    const obj={el:head, lane, t:tStart, z:2.8, judged:false, type:'hold', holdEnd:tStart+holdDur, bar:body};
    notes.push(obj); return obj;
  }

  function spawnSwipe(lane, dir= (Math.random()<0.5?-1:1), aheadSec=1.6){
    const T=TASKS[state.taskKey]; let src = (state.taskKey==="hands")?T.seq[(state.stepIndex||0)%7]:T.emojis[(Math.random()*T.emojis.length)|0];
    const n=document.createElement('a-entity');
    n.classList.add('note'); n.setAttribute('geometry','primitive: plane; width:0.6; height:0.6');
    n.setAttribute('material',noteMat(src));
    // add arrow label
    const arrow = label3D(dir<0?"⬅️":"➡️",{fontSize:0.28,y:-0.45,color:"#fde68a"});
    n.appendChild(arrow);
    n.object3D.position.set(laneXPos[lane],0,2.8); uiRoot.appendChild(n);
    const obj={el:n, lane, t:state.elapsed+aheadSec, z:2.8, judged:false, type:'swipe', dir};
    notes.push(obj); return obj;
  }

  // ---------- Section pattern ----------
  let sections=[], sectionPtr=0, sectionEndAt=0;
  function makeSections(){
    const mainBeats = Math.max(8, Math.floor((state.duration/beatSec)-24));
    return [
      {name:"Intro", beats:12, density:0.35},
      {name:"Main",  beats:mainBeats, density: state.trainOn ? 0.45 : 0.65},
      {name:"Boss",  beats:12, density:0.9}
    ];
  }

  function spawnBeat(){
    // สุ่มชนิดโน้ตตามช่วง
    const sec = sections[Math.min(sectionPtr-1, sections.length-1)] || sections[0];
    const r = Math.random();
    const lane = randomLane();
    if(r < Math.min(0.15, sec.density*0.2)){
      spawnHold(lane, (Math.random()<0.5?2:3));
    }else if(r < Math.min(0.35, sec.density*0.4)){
      spawnSwipe(lane, Math.random()<0.5?-1:1);
    }else{
      // single/double/triple
      const p=Math.random();
      if(p<0.6) spawnTap(lane);
      else if(p<0.9){ const l2=(lane+1+((Math.random()*2)|0))%3; spawnTap(lane); spawnTap(l2); }
      else{ spawnTap(0); spawnTap(1); spawnTap(2); }
    }
    click();
  }

  function stepSection(){
    if(sectionPtr>=sections.length) return;
    const sec = sections[sectionPtr];
    for(let i=0;i<sec.beats;i++){ spawnBeat(); nextBeat += beatSec; }
    sectionEndAt = state.elapsed + sec.beats*beatSec;
    sectionPtr++;
  }

  // ---------- Fever / Multiplier / Adaptive ----------
  function addFever(v){ state.fever = Math.max(0, Math.min(100, state.fever + v)); setFeverFill(state.fever/100); if(state.fever>state.feverSeenMax) state.feverSeenMax=state.fever; }
  function triggerFever(){ if(state.feverOn||state.fever<100) return; state.feverOn=true; state.feverEnd = state.elapsed + 7; state.multiplier = Math.min(4, state.multiplier+1); state.fever=0; setFeverFill(0); state.feverCount++; toast("FEVER!! ✨","#7dfcc6"); }
  function updateFever(){ if(state.feverOn && state.elapsed>=state.feverEnd){ state.feverOn=false; toast("Fever End","#cbd5e1"); } }
  function updateMultiplier(){ if(state.combo>=40) state.multiplier=4; else if(state.combo>=20) state.multiplier=3; else if(state.combo>=10) state.multiplier=2; else state.multiplier=1; }

  // ---------- Judge (รวม Tap/Hold/Swipe) ----------
  const keyToLane=(k)=>k==='a'||k==='arrowleft'?0:k==='s'||k==='arrowup'?1:k==='d'||k==='arrowright'?2:null;
  let lastDirKey=0; // -1 left, +1 right, 0 none (สำหรับ swipe)
  window.addEventListener('keydown',e=>{ const k=(e.key||'').toLowerCase(); if(k==='arrowleft'||k==='a') lastDirKey=-1; if(k==='arrowright'||k==='d') lastDirKey=+1; });
  window.addEventListener('keyup',()=>{ setTimeout(()=>lastDirKey=0,150); });

  let holdState = { lane:null, active:false, begin:0, targetEnd:0 };
  function beginHold(lane){ holdState={lane, active:true, begin:state.elapsed, targetEnd:0}; }
  function endHold(){ holdState.active=false; holdState.lane=null; }

  function judgeHit(lane, swipeDirByTouch=null){
    const target = state.elapsed + (state.calibrationMs/1000);
    // เลือกโน้ตในเลนเดียวกัน ที่ใกล้เวลา
    let best=null, bestErr=999;
    for(const it of notes){
      if(it.judged || it.lane!==lane) continue;
      const err=Math.abs(it.t - target);
      if(err<bestErr){ best=it; bestErr=err; }
    }
    state.accTotal++;
    if(!best || bestErr>state.hitWindow){
      state.combo=0; updateMultiplier(); toast("Miss","#fecaca"); addFever(-8); state.hitWindow=Math.min(DIFF.easy.hit, state.hitWindow+0.01);
      return;
    }

    if(best.type==='tap'){
      hitScored(best, bestErr, 1.0);
      if(best.__isDent) TASKS[state.taskKey]?.onHit?.(state, best);
      best.judged=true; best.el.setAttribute("visible","false");
    }
    else if(best.type==='swipe'){
      const needDir = best.dir; // -1 / +1
      const gotDir = swipeDirByTouch ?? (lastDirKey||0);
      if(gotDir===needDir){
        hitScored(best, bestErr, 1.1); // เล็กน้อยโบนัส
        best.judged=true; best.el.setAttribute("visible","false");
      }else{
        state.combo=0; updateMultiplier(); toast("Wrong Direction","#fecaca"); addFever(-6);
      }
    }
    else if(best.type==='hold'){
      // เริ่มนับถือคีย์/ทัชค้าง
      beginHold(lane);
      holdState.targetEnd = best.holdEnd;
      best.__holding=true;
      // ให้คะแนนเมื่อปล่อยครบเวลา (ใน loop จะเช็ค)
      // ตีหัว hold ให้หาย
      best.el.setAttribute("visible","false");
    }
  }

  function hitScored(note, err, baseMul=1){
    const isPerfect = err<=state.hitWindow*0.35;
    const base = isPerfect? 300:150;
    const gain = Math.round(base * (state.feverOn?1.5:1) * state.multiplier * baseMul);
    state.score += gain;
    toast((isPerfect?"Perfect ":"Good ")+`+${gain}`, isPerfect?"#7dfcc6":"#a7f3d0");
    state.combo++; updateMultiplier();
    if(isPerfect){ state.perfectCount++; if(state.hitWindow>0.08) state.hitWindow -= 0.002; addFever(6); } else addFever(3);
    state.accHit++; state.best=Math.max(state.best,state.combo);
    TASKS[state.taskKey]?.onHit?.(state, note);
    if(state.fever>=100 && !state.feverOn) triggerFever();
  }

  // ---------- Flow ----------
  function start(){
    ensureAudio(); // reset
    notes.forEach(n=>{ n.el?.remove(); n.bar?.remove(); }); notes.length=0;
    state.running=true; state.score=0; state.combo=0; state.best=0; state.accHit=0; state.accTotal=0;
    state.perfectCount=0; state.fever=0; state.feverOn=false; state.feverEnd=0; state.feverCount=0; state.feverSeenMax=0; state.multiplier=1;
    state.trainOn = (selTrain?.value||"on")==="on";
    (TASKS[state.taskKey]?.init||(()=>{}))(state);
    buildLanePads(); buildFeverUI(); setFeverFill(0);
    state.t0=performance.now()/1000; state.elapsed=0; nextBeat=0;
    sections = makeSections(); sectionPtr=0; sectionEndAt=0; stepSection();
    setHUD("เริ่ม!");
    loop();
  }

  function reset(){
    state.running=false; cancelAnimationFrame(state.raf);
    notes.forEach(n=>{ n.el?.remove(); n.bar?.remove(); }); notes.length=0;
    endHold();
    setHUD("รีเซ็ตแล้ว");
  }

  function end(){
    state.running=false; cancelAnimationFrame(state.raf);
    const pass=(TASKS[state.taskKey]?.pass||(()=>false))(state);
    const acc = state.accTotal? Math.round(state.accHit/state.accTotal*100):0;
    applyMissionsEnd(state);
    showSummary(pass, acc);
    setHUD(`จบเกม • ${pass?"ผ่าน":"ไม่ผ่าน"}`);
  }

  // ---------- Main loop ----------
  function loop(){
    if(!state.running) return;
    const now=performance.now()/1000; state.elapsed=now-state.t0;

    // Section scheduling
    if(state.elapsed>=sectionEndAt) stepSection();

    // Move + miss + hold check
    const speedZ = 1.6;
    for(const it of notes){
      if(it.judged) continue;
      const dt = it.t - (state.elapsed + (state.calibrationMs/1000));
      it.z = Math.max(0, dt*speedZ);
      it.el.object3D.position.set(laneXPos[it.lane],0,it.z);
      // bar follow (hold)
      if(it.type==='hold' && it.bar){
        // ยืด bar ตามส่วนเวลาคงเหลือ
        const len = Math.max(0, (it.holdEnd - (state.elapsed + (state.calibrationMs/1000))) * speedZ);
        it.bar.object3D.position.set(laneXPos[it.lane],0, Math.max(0.3, len/2));
        it.bar.setAttribute('geometry',`primitive: plane; width:0.18; height:${Math.max(0.001,len)}`);
      }

      // auto miss (ก่อนถึงแล้วไม่ตี)
      if(dt<-state.hitWindow && !it.judged && it.type!=='hold'){
        it.judged=true; it.el.setAttribute("visible","false");
        state.combo=0; updateMultiplier(); toast("Miss","#fecaca"); addFever(-8);
        state.hitWindow=Math.min(DIFF.easy.hit, state.hitWindow+0.008);
      }
    }

    // HOLD completion: ถ้าถือค้างจนถึงเวลาเป้าหมาย
    if(holdState.active){
      if(state.elapsed >= holdState.targetEnd - (state.calibrationMs/1000)){
        // หาน๊อต hold ที่ยังไม่ judged ในเลนเดียวกันแล้วปิด
        for(const it of notes){
          if(!it.judged && it.type==='hold' && it.lane===holdState.lane && state.elapsed>=it.holdEnd - (state.calibrationMs/1000)){
            it.judged=true; it.el.setAttribute('visible','false'); it.bar?.setAttribute('visible','false');
            hitScored(it, 0.0, 1.25); // โบนัสเล็กน้อย
          }
        }
        endHold();
      }
    }

    updateFever();
    setHUD();
    if(state.elapsed>=state.duration) return end();
    state.raf=requestAnimationFrame(loop);
  }

  // ---------- Input ----------
  function keyLane(e){
    const k=(e.key||"").toLowerCase();
    if(k==='a'||k==='arrowleft') return 0;
    if(k==='s'||k==='arrowup')   return 1;
    if(k==='d'||k==='arrowright')return 2;
    return null;
  }
  window.addEventListener('keydown',(e)=>{
    const ln=keyLane(e);
    if(ln!==null){ judgeHit(ln,null); }
    if((e.key||'').toLowerCase()==='s' && !state.running) start();
    if((e.key||'').toLowerCase()==='r') reset();
  });
  // Mouse down = เริ่ม hold, Mouse up = ปล่อย (สำหรับเลนกลางโดยประมาณ)
  // (ผู้เล่นจะกดที่ pad ในฉาก ซึ่งเราผูกไว้แล้วใน buildLanePads ผ่าน click/pointer/touch)

  // ---------- Settings binding ----------
  btnStart?.addEventListener('click', ()=>!state.running&&start());
  btnReset?.addEventListener('click', reset);
  selDiff?.addEventListener('change', ()=>{ applyDiff(); setHUD("ตั้งค่าโหมดแล้ว"); });
  selBpm?.addEventListener('change',  ()=>{ applyBPM(); setHUD("ตั้งค่า BPM แล้ว"); });
  selTask?.addEventListener('change', ()=>{ applyTask(); setHUD("สลับเกมแล้ว"); });
  selTrain?.addEventListener('change',()=>{ state.trainOn=(selTrain.value==="on"); setHUD("สลับ Training แล้ว"); });
  calib?.addEventListener('input', ()=>applyCalib());

  // ---------- Boot ----------
  // เพิ่มปุ่มเริ่ม Chain-3 ในฉาก (เล็ก ๆ ด้านบนซ้าย)
  (function addChainButton(){
    const btn=document.createElement('a-entity');
    btn.classList.add('clickable');
    btn.setAttribute('geometry','primitive: plane; width: 0.9; height: 0.28');
    btn.setAttribute('material','color:#fde68a; opacity:0.95; shader:flat');
    btn.setAttribute('position','-0.9 1.05 0.06');
    btn.appendChild(label3D("Start Chain-3",{fontSize:0.14,color:"#422006"}));
    btn.addEventListener('click', startChain);
    uiRoot.appendChild(btn);
  })();

  applyDiff(); applyBPM(); applyTask(); applyCalib();
  buildLanePads(); buildFeverUI(); setFeverFill(0);
  setHUD("พร้อมเริ่ม • A/S/D เลน ซ้าย/กลาง/ขวา • แตะ/จ้องแป้นก็ได้ • Hold/Swipe เข้ามาแล้ว!");
}
