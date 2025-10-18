(() => {
  const $  = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  // ===== I18N =====
  const I18N = {
    th:{start:"เริ่มเกม",pause:"พัก",how:"วิธีเล่น",restart:"เริ่มใหม่",
        score:"คะแนน",time:"เวลา",best:"สถิติ",mode:"โหมด",diff:"ความยาก",combo:"คอมโบ",
        modeGJ:"ดี vs ขยะ",modeGroups:"จาน 5 หมู่",modeHydra:"Hydration",modePlate:"Build Plate",
        daily:"ภารกิจประจำวัน",target:"เป้าหมาย",summary:"สรุปผล",
        howGJ:"จ้อง/คลิก อาหารที่ดี หลีกเลี่ยงขยะ รักษาคอมโบ!",
        howGroups:"ดู 'หมู่เป้าหมาย' มุมขวาบน แล้วเก็บในหมู่นั้น",
        howHydra:"เก็บน้ำเปล่า หลีกเลี่ยงน้ำหวาน สะสมสตรีคได้เวลาเพิ่ม",
        howPlate:"เก็บตามโควตา Plate (ขวาบน) ครบชุดรับโบนัส!",
        voiceOn:"เสียงพูด: เปิด", voiceOff:"เสียงพูด: ปิด", quota:"โควตาจาน",
        howTitle:"วิธีเล่น"},
    en:{start:"Start",pause:"Pause",how:"How to Play",restart:"Restart",
        score:"Score",time:"Time",best:"Best",mode:"Mode",diff:"Difficulty",combo:"Combo",
        modeGJ:"Good vs Junk",modeGroups:"Food Groups",modeHydra:"Hydration",modePlate:"Build Plate",
        daily:"Daily Mission",target:"Target",summary:"Summary",
        howGJ:"Gaze/click healthy foods; avoid junk. Keep combo!",
        howGroups:"Follow the 'Target Group' (top-right) and collect foods there.",
        howHydra:"Collect water; avoid sugary drinks. Streak adds time.",
        howPlate:"Fill the plate quota (top-right). Completing a set gives bonus!",
        voiceOn:"Voice: On", voiceOff:"Voice: Off", quota:"Plate Quota",
        howTitle:"How to Play"}
  };
  const t = (k)=> I18N[APP.lang][k];

  // ===== STATE =====
  const APP = {
    lang: localStorage.getItem("vrn_lang") || "th",
    voiceOn: JSON.parse(localStorage.getItem("vrn_voiceOn") || "true"),
    difficulty: localStorage.getItem("vrn_diff") || "Normal", // Easy | Normal | Hard
    mode: localStorage.getItem("vrn_mode") || "goodjunk",     // 4 modes
    score:0, timeLeft:60, running:false, paused:false, combo:1, comboMax:1,
    best: parseInt(localStorage.getItem("vrn_best")||"0"),
    mission: JSON.parse(localStorage.getItem("vrn_mission")||"null"),
    currentTarget:null, fever:false, protect:0, plateQuota:null
  };
  (function ensureMission(){
    const today = new Date().toISOString().slice(0,10);
    if(!APP.mission || APP.mission.date !== today){
      APP.mission = { date: today, goal: 140, achieved: false };
      localStorage.setItem("vrn_mission", JSON.stringify(APP.mission));
    }
  })();

  // ===== DATA =====
  const foods={goodjunk:[{id:"#apple",good:true},{id:"#broccoli",good:true},{id:"#water",good:true},
                         {id:"#burger",good:false},{id:"#soda",good:false},{id:"#donut",good:false}],
               groups:[{id:"#g_grains",group:"grains"},{id:"#g_protein",group:"protein"},{id:"#g_veggies",group:"veggies"},{id:"#g_fruits",group:"fruits"},{id:"#g_dairy",group:"dairy"}],
               hydration:[{id:"#water",type:"water"},{id:"#soda",type:"soda"},{id:"#donut",type:"sugar"}]};
  const targets=["grains","protein","veggies","fruits","dairy"];
  const specials=[{img:"#p_time",type:"time",weight:1},{img:"#p_fever",type:"fever",weight:1},{img:"#p_shield",type:"shield",weight:1},{img:"#p_slow",type:"slow",weight:0.8},{img:"#p_bomb",type:"bomb",weight:0.7}];
  const pickSpecial=()=>{ const bag=specials.flatMap(s=>Array(Math.round(s.weight*10)).fill(s)); return bag[Math.floor(Math.random()*bag.length)]; };

  // ===== HUD / Lang =====
  function applyLang(){
    $("#lblScore").textContent=t("score"); $("#lblTime").textContent=t("time"); $("#lblBest").textContent=t("best");
    $("#lblMode").textContent=t("mode"); $("#lblDiff").textContent=t("diff"); $("#lblCombo").textContent="x"+APP.combo;
    $("#sumTitle").textContent=t("summary");
    $("#missionTag").textContent = APP.lang==="th" ? I18N.th.daily : I18N.en.daily;
    $("#lblTarget").textContent  = APP.lang==="th" ? I18N.th.target : I18N.en.target;
    $("#lblQuota").textContent   = APP.lang==="th" ? I18N.th.quota  : I18N.en.quota;
    $("#langText").textContent   = APP.lang==="th" ? "ไทย/English" : "English/ไทย";
    $("#btnVoice").querySelector("span[data-i18n]").textContent =
      APP.voiceOn ? (APP.lang==="th" ? I18N.th.voiceOn : I18N.en.voiceOn)
                  : (APP.lang==="th" ? I18N.th.voiceOff : I18N.en.voiceOff);
    $$("[data-i18n=modeGJ]").forEach(e=>e.textContent=t("modeGJ"));
    $$("[data-i18n=modeGroups]").forEach(e=>e.textContent=t("modeGroups"));
    $$("[data-i18n=modeHydra]").forEach(e=>e.textContent=t("modeHydra"));
    $$("[data-i18n=modePlate]").forEach(e=>e.textContent=t("modePlate"));
    $$("[data-i18n=start]").forEach(e=>e.textContent=t("start"));
    $$("[data-i18n=pause]").forEach(e=>e.textContent=t("pause"));
    $$("[data-i18n=how]").forEach(e=>e.textContent=t("how"));
    $$("[data-i18n=restart]").forEach(e=>e.textContent=t("restart"));
    $("#modeName").textContent =
      APP.mode==="goodjunk"?t("modeGJ"):APP.mode==="groups"?t("modeGroups"):APP.mode==="hydration"?t("modeHydra"):t("modePlate");
  }
  function updateHUD(){
    $("#score").textContent=APP.score; $("#time").textContent=APP.timeLeft; $("#best").textContent=APP.best;
    $("#difficulty").textContent=APP.difficulty; $("#combo").textContent="x"+APP.combo;
  }

  // ===== Mode / Plate =====
  function setMode(m){
    APP.mode=m; localStorage.setItem("vrn_mode",m);
    $("#modeName").textContent=
      APP.mode==="goodjunk"?t("modeGJ"):APP.mode==="groups"?t("modeGroups"):APP.mode==="hydration"?t("modeHydra"):t("modePlate");
    const isGroups=(APP.mode==="groups"), isHydra=(APP.mode==="hydration"), isPlate=(APP.mode==="plate");
    $("#targetBox").style.display=(isGroups||isHydra)?"block":"none";
    $("#quotaBox").style.display = isPlate ? "block" : "none";
    if(isGroups){ nextTarget(); }
    if(isHydra){ APP.currentTarget="water"; $("#targetName").textContent="WATER"; }
    if(isPlate) resetPlateQuota();
  }
  function setDiff(d){ APP.difficulty=d; localStorage.setItem("vrn_diff",d); updateHUD(); }

  function resetPlateQuota(){
    const base={grains:2,veggies:2,protein:1,fruits:1,dairy:1};
    if(APP.difficulty==="Hard") base.veggies=3;
    APP.plateQuota=base; renderQuota();
  }
  function renderQuota(){ const q=APP.plateQuota; $("#quotaText").textContent=`Grains:${q.grains}  Veg:${q.veggies}  Prot:${q.protein}  Fruit:${q.fruits}  Dairy:${q.dairy}`; }
  const plateQuotaDone = () => Object.values(APP.plateQuota).every(v=>v<=0);

  // ===== Spawner (กันซ้อน/ชิด) =====
  const SPAWN_CFG={useLanes:true,minDist:0.48,maxActive:{Easy:3,Normal:4,Hard:5},scale:0.78};
  const LANE_X=[-0.80,0.00,0.80], LANE_Y=[-0.05,0.12,0.29], LANE_Z=[-0.36,0.00,0.36];
  let occupiedSlots=new Set(), slotCooldown=new Map(), ACTIVE_ENTS=new Set(), lastLane=null;
  const nowMs=()=>performance.now();
  function isAdj(r,c){ if(!lastLane) return false; const [pr,pc]=lastLane; return Math.abs(pr-r)<=1 && Math.abs(pc-c)<=1; }
  function pickLaneSlot(){
    const cand=[]; for(let r=0;r<3;r++){ for(let c=0;c<3;c++){
      const key=r+","+c, cd=slotCooldown.get(key)||0;
      const free=!occupiedSlots.has(key)&&nowMs()>cd&&!isAdj(r,c);
      cand.push({r,c,key,free});
    } }
    const free=cand.filter(x=>x.free); if(!free.length) return null;
    free.sort((a,b)=>{ const lc=lastLane?lastLane[1]:-1;
      const pa=(a.c===lc?1:0)+(isAdj(a.r,a.c)?2:0);
      const pb=(b.c===lc?1:0)+(isAdj(b.r,b.c)?2:0);
      return pa-pb;
    });
    const pick=free[Math.floor(Math.random()*Math.max(1,Math.ceil(free.length*0.6)))];
    occupiedSlots.add(pick.key); lastLane=[pick.r,pick.c];
    return {x:LANE_X[pick.c],y:LANE_Y[pick.r],z:LANE_Z[(pick.r+pick.c)%3],slotKey:pick.key};
  }
  function releaseLaneSlot(key){ if(!key) return; occupiedSlots.delete(key); slotCooldown.set(key, nowMs()+800); }

  function pickSrcAndMeta(){
    if(Math.random()<0.10){ const s=pickSpecial(); return {src:s.img, meta:{special:s.type}}; }
    if(APP.mode==="goodjunk"){
      const goodBias=APP.difficulty==="Easy"?0.70:APP.difficulty==="Hard"?0.45:0.58;
      const pool=Math.random()<goodBias?foods.goodjunk.filter(f=>f.good):foods.goodjunk.filter(f=>!f.good);
      const f=pool[Math.floor(Math.random()*pool.length)]; return {src:f.id, meta:{good:!!f.good}};
    }
    if(APP.mode==="groups"){ const f=foods.groups[Math.floor(Math.random()*foods.groups.length)]; return {src:f.id, meta:{group:f.group}}; }
    if(APP.mode==="hydration"){
      const rate=APP.difficulty==="Easy"?0.75:APP.difficulty==="Hard"?0.55:0.65;
      const pool=Math.random()<rate?foods.hydration.filter(x=>x.type==="water"):foods.hydration.filter(x=>x.type!=="water");
      const f=pool[Math.floor(Math.random()*pool.length)]; return {src:f.id, meta:{hydra:f.type}};
    }
    const f=foods.groups[Math.floor(Math.random()*foods.groups.length)]; return {src:f.id, meta:{group:f.group, plate:true}};
  }

  let SPAWN_COUNT=0, spawnerHandle=null, targetHits=0, targetHitNeed=3;
  function spawnOne(){
    const root=$("#spawnerRoot"); const maxAct=SPAWN_CFG.maxActive[APP.difficulty]||4; if(ACTIVE_ENTS.size>=maxAct) return;
    const life=APP.difficulty==="Hard"?1900:APP.difficulty==="Easy"?4200:3000; const lifeJ=Math.floor(Math.random()*500-250);
    const pick=pickSrcAndMeta(); const lane=pickLaneSlot(); if(!lane) return;
    const pos={x:lane.x,y:lane.y,z:lane.z}; const slotKey=lane.slotKey;

    const ent=document.createElement("a-image");
    ent.setAttribute("src",pick.src);
    ent.setAttribute("position",`${pos.x} ${pos.y} ${pos.z}`);
    ent.setAttribute("scale",`${SPAWN_CFG.scale} ${SPAWN_CFG.scale} ${SPAWN_CFG.scale}`);
    ent.setAttribute("class","clickable");
    ent.setAttribute("geometry","primitive: plane; width: 1; height: 1");
    ent.setAttribute("material","shader: flat; transparent: true; opacity: 0.98");
    ent.dataset.meta=JSON.stringify(pick.meta); ent.dataset.slotKey=slotKey;
    ent.setAttribute("animation__pulse",`property: scale; dir: alternate; dur: 640; loop:true; to: ${SPAWN_CFG.scale+0.07} ${SPAWN_CFG.scale+0.07} ${SPAWN_CFG.scale+0.07}`);

    const remove=()=>{ if(ent.parentNode) ent.parentNode.removeChild(ent); ACTIVE_ENTS.delete(ent); releaseLaneSlot(slotKey); };
    ent.addEventListener("click", ()=>{ handleHit(ent); remove(); });

    root.appendChild(ent); ACTIVE_ENTS.add(ent); SPAWN_COUNT++;

    setTimeout(()=>{ if(!ent.parentNode) return;
      const m=JSON.parse(ent.dataset.meta||"{}");
      if(!m.special){
        if(APP.mode==="goodjunk"){ if(m.good===false){ APP.score+=1; updateHUD(); } else { comboBreak(); } }
        else if(APP.mode==="groups"){ if(m.group===APP.currentTarget){ comboBreak(); } }
        else if(APP.mode==="hydration"){ if(m.hydra!=="water"){ APP.score+=1; updateHUD(); } }
      }
      remove();
    }, life+lifeJ);
  }

  // ===== HIT / FEEDBACK =====
  function speak(th,en){
    if(!APP.voiceOn) return;
    try{
      const u=new SpeechSynthesisUtterance(APP.lang==="th"?th:en);
      const vs=speechSynthesis.getVoices();
      if(APP.lang==="th"){ const v=vs.find(v=> v.lang && v.lang.toLowerCase().startsWith("th")); if(v) u.voice=v; }
      else { const v=vs.find(v=> v.lang && v.lang.toLowerCase().startsWith("en")); if(v) u.voice=v; }
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    }catch(_){}
  }
  function handleHit(ent){
    const meta=JSON.parse(ent.dataset.meta||"{}");
    if(meta.special){
      switch(meta.special){
        case "time": APP.timeLeft=Math.min(99,APP.timeLeft+5); speak("ได้เวลาเพิ่ม","Time +5"); break;
        case "fever": enterFever(); speak("โหมดไฟลุก!","Fever!"); break;
        case "shield": APP.protect=Math.min(1,APP.protect+1); speak("กันพลาด 1 ครั้ง","Shield up"); break;
        case "slow": { const old=APP.difficulty; APP.difficulty="Easy"; setTimeout(()=>APP.difficulty=old,2000); speak("ช้าลงชั่วคราว","Time slow"); } break;
        case "bomb": if(APP.protect>0){ APP.protect--; speak("กันพลาดไว้แล้ว","Shield saved"); } else { comboBreak(); APP.score=Math.max(0,APP.score-5); speak("คอมโบหลุด!","Combo break!"); } break;
      }
      updateHUD(); return;
    }
    let good=false, delta=0, th="", en="";
    if(APP.mode==="goodjunk"){ good=meta.good===true; delta=good?5*APP.combo:-3; if(!good) comboBreak(); }
    else if(APP.mode==="groups"){ good=meta.group===APP.currentTarget; delta=good?6*APP.combo:-2; if(good){ targetHits++; if(targetHits>=targetHitNeed){ nextTarget(); } } else comboBreak(); }
    else if(APP.mode==="hydration"){ good=meta.hydra==="water"; delta=good?4*APP.combo:-4; if(good){ if(APP.combo%3===0) APP.timeLeft=Math.min(99,APP.timeLeft+2); } else comboBreak(); th=good?"ดื่มน้ำดีมาก":"หวานไป!"; en=good?"Nice water!":"Too sugary!"; }
    else if(APP.mode==="plate"){ if(meta.group){ const g=meta.group; if(APP.plateQuota[g]>0){ good=true; APP.plateQuota[g]-=1; renderQuota(); if(plateQuotaDone()){ delta+=12; resetPlateQuota(); speak("จานครบชุด!","Plate complete!"); } } else { delta+=1; } } }
    if(APP.fever && delta>0) delta+=Math.floor(delta);
    APP.score=Math.max(0, APP.score+delta);
    if(good){ APP.combo=Math.min(5,APP.combo+1); APP.comboMax=Math.max(APP.comboMax,APP.combo); }
    if(APP.combo>=4) enterFever();
    updateHUD(); if(th||en) speak(th,en);
  }
  let feverTimer=null; function enterFever(ms=6000){ if(APP.fever) return; APP.fever=true; if(feverTimer) clearTimeout(feverTimer); feverTimer=setTimeout(()=>APP.fever=false,ms); }
  function comboBreak(){ APP.combo=1; updateHUD(); }

  // ===== Targets =====
  function nextTarget(){ targetHits=0; const pool=targets.slice(); if(APP.currentTarget){ const i=pool.indexOf(APP.currentTarget); if(i>=0) pool.splice(i,1); } APP.currentTarget=pool[Math.floor(Math.random()*pool.length)]; $("#targetName").textContent=APP.currentTarget.toUpperCase(); }

  // ===== Loop & Timer =====
  function loop(){ if(!APP.running||APP.paused) return;
    const base=APP.mode==="goodjunk"?740:APP.mode==="hydration"?700:APP.mode==="plate"?760:780;
    let rate=APP.difficulty==="Hard"?base*0.80:APP.difficulty==="Easy"?base*1.25:base; if(APP.fever) rate*=0.80;
    spawnOne(); spawnerHandle=setTimeout(loop, rate);
  }
  function timerTick(){ if(!APP.running||APP.paused) return; setTimeout(()=>{ APP.timeLeft-=1; updateHUD(); if(APP.timeLeft<=0){ endGame(); } else { timerTick(); } },1000); }

  // ===== Summary =====
  const showSummary=()=>$("#summary").classList.add("show");
  const hideSummary=()=>$("#summary").classList.remove("show");

  // ===== Lifecycle =====
  function startGame(){
    if(APP.running && !APP.paused) return;
    if(!APP.running){
      APP.score=0; APP.combo=1; APP.comboMax=1; APP.timeLeft=60; updateHUD();
      if(APP.mode==="groups") nextTarget();
      if(APP.mode==="hydration"){ APP.currentTarget="water"; $("#targetName").textContent="WATER"; }
      if(APP.mode==="plate") resetPlateQuota();
    }
    APP.running=true; APP.paused=false; hideSummary();
    document.body.classList.add("game-running"); // เปิดคลิกฉาก
    setTimeout(()=>{ if(SPAWN_COUNT===0){ try{ spawnOne(); }catch(e){} } }, 400);
    loop(); timerTick();
  }
  function pauseGame(){ if(!APP.running) return; APP.paused=!APP.paused; if(APP.paused){ clearTimeout(spawnerHandle); } else { loop(); timerTick(); } }
  function endGame(){
    APP.running=false; APP.paused=false; clearTimeout(spawnerHandle);
    if(APP.score>APP.best){ APP.best=APP.score; localStorage.setItem("vrn_best", String(APP.best)); }
    const mission=JSON.parse(localStorage.getItem("vrn_mission"));
    if(mission && !mission.achieved && APP.score>=mission.goal){ mission.achieved=true; localStorage.setItem("vrn_mission", JSON.stringify(mission)); }
    const star=APP.score>=200?3:APP.score>=140?2:1;
    $("#sumStars").textContent="★".repeat(star)+"☆".repeat(3-star);
    $("#sumBody").textContent=`Score: ${APP.score} • Combo Max: x${APP.comboMax} • Mode: ${APP.mode} • Diff: ${APP.difficulty}`;
    showSummary();
    document.body.classList.remove("game-running"); // ปิดคลิกฉาก
  }

  // ===== Scene click fallback =====
  (function(){
    const scene=document.querySelector("a-scene");
    if(!scene) return;
    scene.addEventListener("click",(evt)=>{
      const el=evt.target;
      if(el && el.classList && el.classList.contains("clickable")){
        el.dispatchEvent(new Event("click"));
      }
    });
  })();

  // ===== Init =====
  applyLang(); updateHUD(); setMode(APP.mode);

  // ===== Bind GAME_UI =====
  const REAL = {
    start: startGame, pause: pauseGame,
    restart: ()=>{ hideSummary(); APP.running=false; APP.paused=false; clearTimeout(spawnerHandle); SPAWN_COUNT=0; startGame(); },
    how: ()=>{ const html = `
      <div class="how-grid">
        <div><b>${t("modeGJ")}:</b> ${t("howGJ")}</div>
        <div><b>${t("modeGroups")}:</b> ${t("howGroups")}</div>
        <div><b>${t("modeHydra")}:</b> ${t("howHydra")}</div>
        <div><b>${t("modePlate")}:</b> ${t("howPlate")}</div>
        <div><b>Controls:</b> Mouse/Touch or VR gaze (fuse)</div>
      </div>`;
      if(typeof window.openHow==='function'){ window.openHow(html, t("howTitle")); }
    },
    setMode: (m)=>{ setMode(m); applyLang(); },
    setDiff: (d)=>{ setDiff(d); },
    toggleLang: ()=>{ APP.lang=(APP.lang==="th"?"en":"th"); localStorage.setItem("vrn_lang",APP.lang); applyLang(); },
    toggleVoice: ()=>{ APP.voiceOn=!APP.voiceOn; localStorage.setItem("vrn_voiceOn", JSON.stringify(APP.voiceOn)); applyLang(); }
  };
  if(window.GAME_UI && typeof window.GAME_UI._bind==="function") window.GAME_UI._bind(REAL);
  else window.GAME_UI=REAL;
})();
