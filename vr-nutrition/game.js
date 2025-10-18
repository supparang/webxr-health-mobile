(() => {
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ==== I18N ====
  const i18n = {
    th: {
      start:"เริ่มเกม", pause:"พัก", how:"วิธีเล่น", restart:"เริ่มใหม่",
      score:"คะแนน", time:"เวลา", best:"สถิติ", mode:"โหมด", diff:"ความยาก", combo:"คอมโบ",
      modeGJ:"ดี vs ขยะ", modeGroups:"จาน 5 หมู่", modeHydra:"Hydration", modePlate:"Build Plate",
      daily:"ภารกิจประจำวัน", target:"เป้าหมาย", summary:"สรุปผล",
      howGJ:"จ้อง/คลิก อาหารที่ดี (ผลไม้ ผัก น้ำ) หลีกเลี่ยงขยะ (เบอร์เกอร์ โซดา โดนัท) รักษาคอมโบ!",
      howGroups:"ดู 'หมู่เป้าหมาย' มุมขวาบน แล้วเก็บอาหารที่อยู่ในหมู่นั้น",
      howHydra:"เก็บ 💧 น้ำเปล่า! หลีกเลี่ยงโซดา/ขนมหวาน เก็บต่อเนื่องได้เวลาบวก",
      howPlate:"เก็บอาหารตามโควตาให้ครบจาน (ดูกรอบ Plate Quota ขวาบน) ครบชุดรับโบนัส!",
      voiceOn:"เสียงพูด: เปิด", voiceOff:"เสียงพูด: ปิด",
      quota:"โควตาจาน"
    },
    en: {
      start:"Start", pause:"Pause", how:"How to Play", restart:"Restart",
      score:"Score", time:"Time", best:"Best", mode:"Mode", diff:"Difficulty", combo:"Combo",
      modeGJ:"Good vs Junk", modeGroups:"Food Groups", modeHydra:"Hydration", modePlate:"Build Plate",
      daily:"Daily Mission", target:"Target", summary:"Summary",
      howGJ:"Gaze/click healthy foods; avoid junk. Keep your combo!",
      howGroups:"Follow the 'Target Group' (top-right) and collect foods from that group.",
      howHydra:"Collect 💧 water! Avoid soda/sugary snacks. Streak adds extra time.",
      howPlate:"Collect foods to fill the plate quota (see top-right). Completing a set gives bonus!",
      voiceOn:"Voice: On", voiceOff:"Voice: Off",
      quota:"Plate Quota"
    }
  };

  // ==== STATE ====
  const APP = {
    lang: localStorage.getItem("vrn_lang") || "th",
    voiceOn: JSON.parse(localStorage.getItem("vrn_voiceOn") || "true"),
    difficulty: localStorage.getItem("vrn_diff") || "Normal",
    mode: localStorage.getItem("vrn_mode") || "goodjunk", // goodjunk | groups | hydration | plate
    score: 0, timeLeft: 60, running:false, paused:false,
    combo:1, comboMax:1, best: parseInt(localStorage.getItem("vrn_best")||"0"),
    mission: JSON.parse(localStorage.getItem("vrn_mission") || "null"),
    currentTarget: null, // groups/hydration ใช้
    fever: false, protect: 0,
    plateQuota: null // โหมด plate ใช้
  };

  // Mission (รายวัน)
  (function ensureMission(){
    const today = new Date().toISOString().slice(0,10);
    if(!APP.mission || APP.mission.date !== today){
      APP.mission = { date: today, goal: 140, achieved: false };
      localStorage.setItem("vrn_mission", JSON.stringify(APP.mission));
    }
  })();

  // ==== DATA ====
  const foods = {
    goodjunk: [
      {id:"#apple", good:true}, {id:"#broccoli", good:true}, {id:"#water",  good:true},
      {id:"#burger", good:false}, {id:"#soda",   good:false}, {id:"#donut",  good:false}
    ],
    groups: [
      {id:"#g_grains",  group:"grains"}, {id:"#g_protein", group:"protein"},
      {id:"#g_veggies", group:"veggies"}, {id:"#g_fruits",  group:"fruits"},
      {id:"#g_dairy",   group:"dairy"}
    ],
    hydration: [
      {id:"#water", type:"water"}, {id:"#soda", type:"soda"}, {id:"#donut", type:"sugar"}
    ]
  };
  const targets = ["grains","protein","veggies","fruits","dairy"];

  const specials = [
    {img:"#p_time",   type:"time",   weight:1},
    {img:"#p_fever",  type:"fever",  weight:1},
    {img:"#p_shield", type:"shield", weight:1},
    {img:"#p_slow",   type:"slow",   weight:0.8},
    {img:"#p_bomb",   type:"bomb",   weight:0.7},
  ];
  function pickSpecial(){
    const bag = specials.flatMap(s => Array(Math.round(s.weight*10)).fill(s));
    return bag[Math.floor(Math.random()*bag.length)];
  }

  // ==== SPAWN CONFIG (กันซ้อน+เว้นระยะ) ====
  const SPAWN_CFG = {
    useLanes: true,
    minDist: 0.48,
    maxActive: { Easy: 3, Normal: 4, Hard: 5 },
    scale: 0.78
  };
  const LANE_X = [-0.80, 0.00, 0.80];
  const LANE_Y = [-0.05, 0.12, 0.29];
  const LANE_Z = [-0.36, 0.00, 0.36];

  let occupiedSlots = new Set();
  let slotCooldown = new Map();
  let ACTIVE_ENTS = new Set();
  let lastLane = null;

  // ==== UTILS ====
  function t(k){ return i18n[APP.lang][k]; }
  function rand(min,max){ return Math.random()*(max-min)+min; }
  function speak(thMsg, enMsg){
    if(!APP.voiceOn) return;
    const u = new SpeechSynthesisUtterance(APP.lang==="th"? thMsg : enMsg);
    const voices = speechSynthesis.getVoices();
    if(APP.lang==="th"){ const th = voices.find(v=> v.lang && v.lang.toLowerCase().startsWith("th")); if(th) u.voice = th; }
    else { const en = voices.find(v=> v.lang && v.lang.toLowerCase().startsWith("en")); if(en) u.voice = en; }
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function applyLang(){
    $("#lblScore").textContent = t("score");
    $("#lblTime").textContent = t("time");
    $("#lblBest").textContent = t("best");
    $("#lblMode").textContent = t("mode");
    $("#lblDiff").textContent = t("diff");
    $("#lblCombo").textContent = "x"+APP.combo;
    $("#sumTitle").textContent = t("summary");
    $("#sumTips").textContent = APP.lang==="th" ? "VR: จ้องไอเท็มจนวงแหวนครบเพื่อเลือก" : "VR: Gaze until ring completes to select";
    $$("[data-i18n=modeGJ]").forEach(el=> el.textContent = t("modeGJ"));
    $$("[data-i18n=modeGroups]").forEach(el=> el.textContent = t("modeGroups"));
    $$("[data-i18n=modeHydra]").forEach(el=> el.textContent = t("modeHydra"));
    $$("[data-i18n=modePlate]").forEach(el=> el.textContent = t("modePlate"));
    $$("[data-i18n=start]").forEach(el=> el.textContent = t("start"));
    $$("[data-i18n=pause]").forEach(el=> el.textContent = t("pause"));
    $$("[data-i18n=how]").forEach(el=> el.textContent = t("how"));
    $$("[data-i18n=restart]").forEach(el=> el.textContent = t("restart"));
    $("#missionTag").textContent = APP.lang==="th" ? i18n.th.daily : i18n.en.daily;
    $("#lblTarget").textContent = APP.lang==="th" ? i18n.th.target : i18n.en.target;
    $("#lblQuota").textContent  = APP.lang==="th" ? i18n.th.quota  : i18n.en.quota;
    $("#langText").textContent = (APP.lang==="th" ? "ไทย/English" : "English/ไทย");
    $("#btnVoice").querySelector("span[data-i18n]").textContent =
      APP.voiceOn ? (APP.lang==="th" ? i18n.th.voiceOn : i18n.en.voiceOn)
                  : (APP.lang==="th" ? i18n.th.voiceOff : i18n.en.voiceOff);
    $("#modeName").textContent =
      APP.mode==="goodjunk"  ? t("modeGJ") :
      APP.mode==="groups"    ? t("modeGroups") :
      APP.mode==="hydration" ? t("modeHydra") : t("modePlate");
  }
  function updateHUD(){
    $("#score").textContent = APP.score;
    $("#time").textContent = APP.timeLeft;
    $("#best").textContent = APP.best;
    $("#difficulty").textContent = APP.difficulty;
    $("#combo").textContent = "x"+APP.combo;
  }

  // ==== MODE CONTROL ====
  function setMode(m){
    APP.mode = m; localStorage.setItem("vrn_mode", m);
    $("#modeName").textContent =
      APP.mode==="goodjunk"  ? t("modeGJ") :
      APP.mode==="groups"    ? t("modeGroups") :
      APP.mode==="hydration" ? t("modeHydra") : t("modePlate");

    // แสดง/ซ่อนกล่องเป้าหมาย/โควตาตามโหมด
    const isGroups = (APP.mode==="groups");
    const isHydra  = (APP.mode==="hydration");
    const isPlate  = (APP.mode==="plate");
    $("#targetBox").style.display = (isGroups || isHydra) ? "block" : "none";
    $("#quotaBox").style.display  = isPlate ? "block" : "none";

    if(isGroups && !APP.currentTarget) nextTarget();
    if(isHydra) { APP.currentTarget = "water"; $("#targetName").textContent = "WATER"; }
    if(isPlate) resetPlateQuota();
  }
  function setDiff(d){ APP.difficulty = d; localStorage.setItem("vrn_diff", d); updateHUD(); }

  // ==== PLATE QUOTA ====
  function resetPlateQuota(){
    // โควตาพื้นฐานสำหรับ ป.5
    const base = { grains:2, veggies:2, protein:1, fruits:1, dairy:1 };
    // ความยากมีผลเล็กน้อย
    if(APP.difficulty==="Hard"){ base.veggies=3; }
    APP.plateQuota = base;
    renderQuota();
  }
  function renderQuota(){
    const q = APP.plateQuota;
    const text = `Grains:${q.grains}  Veg:${q.veggies}  Prot:${q.protein}  Fruit:${q.fruits}  Dairy:${q.dairy}`;
    $("#quotaText").textContent = text;
  }
  function plateQuotaDone(){
    return Object.values(APP.plateQuota).every(v=> v<=0);
  }

  // ==== TITLE UI ====
  function hideTitleUI(){ ["titlePanel","titleText","subtitleText"].forEach(id=>{ const e=document.getElementById(id); if(e) e && e.setAttribute("visible","false"); }); }

  // ==== Emoji MENU ====
  function clearEmojiMenu(){ const root = $("#emojiMenuRoot"); while(root && root.firstChild) root.removeChild(root.firstChild); }
  function showEmojiMenu(){
    clearEmojiMenu();
    const root = $("#emojiMenuRoot"); if(!root) return;
    const items = [
      {emoji:"🥗", label: t("modeGJ"),     action:()=>{ setMode("goodjunk"); }},
      {emoji:"🍽️",label: t("modeGroups"), action:()=>{ setMode("groups"); }},
      {emoji:"💧", label: t("modeHydra"),  action:()=>{ setMode("hydration"); }},
      {emoji:"🍱", label: t("modePlate"),  action:()=>{ setMode("plate"); }},
      {emoji:"▶️", label: APP.lang==="th"?"เริ่ม!":"Start!", action:()=>{ clearEmojiMenu(); startGame(); }}
    ];
    const radius = 0.95;
    items.forEach((it, i)=>{
      const angle = (i / items.length) * Math.PI * 2 - Math.PI/2;
      const x = Math.cos(angle)*radius, y = Math.sin(angle)*radius;
      const e = document.createElement("a-entity");
      e.setAttribute("position", `${x} ${y} 0`);
      e.setAttribute("class","clickable");
      e.setAttribute("animation__bob","property: position; dir: alternate; dur: 1200; loop:true; to: "+`${x} ${y+0.06} 0`);
      e.setAttribute("text", `value: ${it.emoji}\n${it.label}; align:center; width: 2.8; color:#0ff`);
      e.addEventListener("click", ()=> it.action());
      root.appendChild(e);
    });
  }

  // ==== FEVER ====
  let feverTimer = null;
  function enterFever(durationMs=6000){
    if(APP.fever) return;
    APP.fever = true;
    if(feverTimer) clearTimeout(feverTimer);
    feverTimer = setTimeout(()=>{ APP.fever=false; }, durationMs);
  }

  // ==== NON-OVERLAP POSITION ====
  function nowMs(){ return performance.now(); }
  function isAdjacencyBlocked(r, c){
    if(!lastLane) return false;
    const [pr, pc] = lastLane;
    return Math.abs(pr - r) <= 1 && Math.abs(pc - c) <= 1;
  }
  function pickLaneSlot(){
    const candidates = [];
    for(let r=0;r<3;r++){
      for(let c=0;c<3;c++){
        const key = r+","+c;
        const cd  = slotCooldown.get(key) || 0;
        const free = !occupiedSlots.has(key) && nowMs() > cd && !isAdjacencyBlocked(r,c);
        candidates.push({r,c,key,free});
      }
    }
    const freeList = candidates.filter(x=>x.free);
    if(freeList.length===0) return null;

    freeList.sort((a,b)=>{
      const lastC = lastLane ? lastLane[1] : -1;
      const pa = (a.c===lastC?1:0) + (isAdjacencyBlocked(a.r,a.c)?2:0);
      const pb = (b.c===lastC?1:0) + (isAdjacencyBlocked(b.r,b.c)?2:0);
      return pa - pb;
    });

    const pick = freeList[Math.floor(Math.random()*Math.max(1, Math.ceil(freeList.length*0.6)))];
    occupiedSlots.add(pick.key);
    lastLane = [pick.r, pick.c];
    return {
      x: LANE_X[pick.c],
      y: LANE_Y[pick.r],
      z: LANE_Z[(pick.r + pick.c) % 3],
      slotKey: pick.key
    };
  }
  function releaseLaneSlot(key){
    if(!key) return;
    occupiedSlots.delete(key);
    slotCooldown.set(key, nowMs() + 800);
  }
  function findNonOverlapPosition(){
    for(let i=0;i<20;i++){
      const pos = { x: rand(-0.80, 0.80), y: rand(-0.05, 0.29), z: rand(-0.36, 0.36) };
      let ok = true;
      ACTIVE_ENTS.forEach(ent=>{
        if(!ok) return;
        const p = ent.getAttribute("position");
        const dx = p.x - pos.x, dy = p.y - pos.y, dz = p.z - pos.z;
        const d2 = dx*dx + dy*dy + dz*dz;
        ok = d2 >= (SPAWN_CFG.minDist*SPAWN_CFG.minDist);
      });
      if(ok) return {...pos};
    }
    return null;
  }

  // ==== SPAWNER ====
  let SPAWN_COUNT = 0, spawnerHandle = null, targetHits=0, targetHitNeed=3;
  function pickSrcAndMeta(){
    // 10% พิเศษทุกโหมด
    if(Math.random() < 0.10){
      const s = pickSpecial(); return {src: s.img, meta: {special: s.type}, pool:"special"};
    }
    if(APP.mode==="goodjunk"){
      const goodBias = APP.difficulty==="Easy" ? 0.70 : APP.difficulty==="Hard" ? 0.45 : 0.58;
      const pool = Math.random()<goodBias ? foods.goodjunk.filter(f=>f.good) : foods.goodjunk.filter(f=>!f.good);
      const f = pool[Math.floor(Math.random()*pool.length)];
      return {src:f.id, meta:{good: !!f.good}, pool:"gj"};
    }
    if(APP.mode==="groups"){
      const f = foods.groups[Math.floor(Math.random()*foods.groups.length)];
      return {src:f.id, meta:{group:f.group}, pool:"group"};
    }
    if(APP.mode==="hydration"){
      // เน้นน้ำมากกว่าโซดา ขึ้นกับความยาก
      const waterRate = APP.difficulty==="Easy" ? 0.75 : APP.difficulty==="Hard" ? 0.55 : 0.65;
      const pool = Math.random()<waterRate ? foods.hydration.filter(x=>x.type==="water")
                                           : foods.hydration.filter(x=>x.type!=="water");
      const f = pool[Math.floor(Math.random()*pool.length)];
      return {src:f.id, meta:{hydra: f.type}, pool:"hydra"};
    }
    // plate → ใช้กลุ่มอาหารเท่านั้น (ไม่มี junk)
    const f = foods.groups[Math.floor(Math.random()*foods.groups.length)];
    return {src:f.id, meta:{group:f.group, plate:true}, pool:"plate"};
  }
  function spawnOne(){
    const root = $("#spawnerRoot");
    const maxAct = SPAWN_CFG.maxActive[APP.difficulty] || 4;
    if(ACTIVE_ENTS.size >= maxAct) return;

    const life = APP.difficulty==="Hard" ? 1900 : APP.difficulty==="Easy" ? 4200 : 3000;
    const lifeJitter = Math.floor(rand(-250, 250));

    const pick = pickSrcAndMeta();
    // เลือกตำแหน่ง
    let pos, slotKey=null;
    if(SPAWN_CFG.useLanes){
      const lane = pickLaneSlot(); if(!lane) return;
      pos = { x: lane.x, y: lane.y, z: lane.z }; slotKey = lane.slotKey;
    } else {
      const p = findNonOverlapPosition(); if(!p) return; pos = p;
    }

    // เอนทิตี
    const ent = document.createElement("a-image");
    ent.setAttribute("src", pick.src);
    ent.setAttribute("position", `${pos.x} ${pos.y} ${pos.z}`);
    ent.setAttribute("scale", `${SPAWN_CFG.scale} ${SPAWN_CFG.scale} ${SPAWN_CFG.scale}`);
    ent.setAttribute("class","clickable");
    ent.setAttribute("geometry","primitive: plane; width: 1; height: 1");
    ent.setAttribute("material","shader: flat; transparent: true; opacity: 0.98");
    ent.dataset.meta = JSON.stringify(pick.meta);
    if(slotKey) ent.dataset.slotKey = slotKey;
    ent.setAttribute("animation__pulse",`property: scale; dir: alternate; dur: 640; loop:true; to: ${SPAWN_CFG.scale+0.07} ${SPAWN_CFG.scale+0.07} ${SPAWN_CFG.scale+0.07}`);

    const remove = ()=> {
      if(ent.parentNode) ent.parentNode.removeChild(ent);
      ACTIVE_ENTS.delete(ent);
      if(ent.dataset.slotKey) releaseLaneSlot(ent.dataset.slotKey);
    };
    ent.addEventListener("click", ()=>{ handleHit(ent); remove(); });

    root.appendChild(ent);
    ACTIVE_ENTS.add(ent);
    SPAWN_COUNT++;

    // หมดอายุ (พลาด)
    setTimeout(()=>{
      if(!ent.parentNode) return;
      const m = JSON.parse(ent.dataset.meta||"{}");
      // การพลาด: แล้วแต่โหมด
      if(!m.special){
        if(APP.mode==="goodjunk"){ if(m.good===false){ APP.score += 1; updateHUD(); } else { comboBreak(); } }
        else if(APP.mode==="groups"){ if(m.group===APP.currentTarget){ comboBreak(); } }
        else if(APP.mode==="hydration"){ if(m.hydra==="soda"||m.hydra==="sugar"){ APP.score += 1; updateHUD(); } else { /*พลาดน้ำ = เสียโอกาส*/ } }
        else if(APP.mode==="plate"){ /*พลาดเฉย ๆ ไม่มีโทษ*/ }
      }
      remove();
    }, life + lifeJitter);
  }

  // ==== HIT LOGIC ====
  function handleHit(ent){
    const meta = JSON.parse(ent.dataset.meta||"{}");

    // Specials
    if(meta.special){
      switch(meta.special){
        case "time":   APP.timeLeft = Math.min(99, APP.timeLeft + 5); speak("ได้เวลาเพิ่ม","Time +5"); break;
        case "fever":  enterFever(); speak("โหมดไฟลุก!","Fever!"); break;
        case "shield": APP.protect = Math.min(1, APP.protect+1); speak("กันพลาด 1 ครั้ง","Shield up"); break;
        case "slow":   { const old = APP.difficulty; APP.difficulty = "Easy"; setTimeout(()=> APP.difficulty = old, 2000); speak("ช้าลงชั่วคราว","Time slow"); } break;
        case "bomb":   if(APP.protect>0){ APP.protect--; speak("กันพลาดไว้แล้ว","Shield saved"); } else { comboBreak(); APP.score = Math.max(0, APP.score - 5); speak("คอมโบหลุด!","Combo break!"); } break;
      }
      updateHUD(); return;
    }

    let good=false, delta=0, sayTh="", sayEn="";
    if(APP.mode==="goodjunk"){
      good = meta.good===true;
      delta = good ? 5*APP.combo : -3;
      if(!good) comboBreak();
    }
    else if(APP.mode==="groups"){
      good = meta.group === APP.currentTarget;
      delta = good ? 6*APP.combo : -2;
      if(good){ targetHits++; if(targetHits>=targetHitNeed){ nextTarget(); } } else comboBreak();
    }
    else if(APP.mode==="hydration"){
      good = meta.hydra==="water";
      delta = good ? 4*APP.combo : -4;
      if(good){
        // สะสมสตรีค → +เวลาเล็กน้อยทุก 3 น้ำ
        if(APP.combo % 3 === 0) { APP.timeLeft = Math.min(99, APP.timeLeft + 2); }
      } else { comboBreak(); }
      sayTh = good? "ดื่มน้ำดีมาก": "หวานไป!";
      sayEn = good? "Nice water!": "Too sugary!";
    }
    else if(APP.mode==="plate"){
      if(meta.group){
        const g = meta.group;
        if(APP.plateQuota[g] > 0){
          good = true;
          APP.plateQuota[g] -= 1;
          renderQuota();
          if(plateQuotaDone()){
            delta += 12;            // โบนัสครบชุด
            resetPlateQuota();      // ออเดอร์ใหม่
            speak("จานครบชุด!","Plate complete!");
          }
        } else {
          // เก็บเกินโควตากลุ่มนั้น → นับนิดหน่อย
          delta += 1;
        }
      }
    }

    if(APP.fever && delta > 0) delta += Math.floor(delta); // x2-ish
    APP.score = Math.max(0, APP.score + delta);
    if(good){ APP.combo = Math.min(5, APP.combo + 1); APP.comboMax = Math.max(APP.comboMax, APP.combo); }
    if(APP.combo >= 4) enterFever();
    updateHUD();
    if(sayTh || sayEn) speak(sayTh, sayEn);
  }
  function comboBreak(){ APP.combo = 1; updateHUD(); }

  // ==== TARGETS (groups / hydration) ====
  function nextTarget(){
    targetHits = 0;
    const pool = targets.slice();
    if(APP.currentTarget){ const i = pool.indexOf(APP.currentTarget); if(i>=0) pool.splice(i,1); }
    APP.currentTarget = pool[Math.floor(Math.random()*pool.length)];
    $("#targetName").textContent = APP.currentTarget.toUpperCase();
  }

  // ==== LOOP & TIMER ====
  function loop(){
    if(!APP.running || APP.paused) return;
    const baseRate = APP.mode==="goodjunk" ? 740 : APP.mode==="hydration" ? 700 : APP.mode==="plate" ? 760 : 780;
    let rate = APP.difficulty==="Hard" ? baseRate*0.80 : APP.difficulty==="Easy" ? baseRate*1.25 : baseRate;
    if(APP.fever) rate *= 0.80;
    spawnOne();
    spawnerHandle = setTimeout(loop, rate);
  }
  function timerTick(){
    if(!APP.running || APP.paused) return;
    setTimeout(()=>{ APP.timeLeft -= 1; updateHUD(); if(APP.timeLeft<=0){ endGame(); } else { timerTick(); } }, 1000);
  }

  // ==== GAME LIFECYCLE ====
  function startGame(){
    if(APP.running && !APP.paused) return;
    if(!APP.running){
      APP.score = 0; APP.combo=1; APP.comboMax=1; APP.timeLeft = 60; updateHUD();
      if(APP.mode==="groups")   { nextTarget(); }
      if(APP.mode==="hydration"){ APP.currentTarget="water"; $("#targetName").textContent="WATER"; }
      if(APP.mode==="plate")    { resetPlateQuota(); }
    }
    APP.running = true; APP.paused=false;
    $("#summary").style.display = "none";
    hideTitleUI();
    setTimeout(()=>{ if(SPAWN_COUNT===0) { try{ spawnOne(); }catch(e){} } }, 1200);
    loop(); timerTick();
  }
  function pauseGame(){
    if(!APP.running) return;
    APP.paused = !APP.paused;
    if(APP.paused){ clearTimeout(spawnerHandle); }
    else { loop(); timerTick(); }
  }
  function endGame(){
    APP.running=false; APP.paused=false; clearTimeout(spawnerHandle);
    if(APP.score>APP.best){ APP.best = APP.score; localStorage.setItem("vrn_best", String(APP.best)); }
    const mission = JSON.parse(localStorage.getItem("vrn_mission"));
    if(mission && !mission.achieved && APP.score>=mission.goal){ mission.achieved = true; localStorage.setItem("vrn_mission", JSON.stringify(mission)); }
    const star = APP.score>=200 ? 3 : APP.score>=140 ? 2 : 1;
    $("#sumStars").textContent = "★".repeat(star) + "☆".repeat(3-star);
    $("#sumBody").textContent = `Score: ${APP.score} • Combo Max: x${APP.comboMax} • Mode: ${APP.mode} • Diff: ${APP.difficulty}`;
    $("#summary").style.display = "flex";
    showEmojiMenu();
  }

  // ==== BIND UI (ปลอดภัย) ====
  (function bindUiSafe(){
    const bind = ()=>{
      const map = [
        ["#btnStart",   ()=>{ clearEmojiMenu(); startGame(); }],
        ["#btnPause",   ()=>{ pauseGame(); }],
        ["#btnRestart", ()=>{ $("#summary").style.display = "none"; APP.running=false; APP.paused=false; clearTimeout(spawnerHandle); startGame(); }],
        ["#btnHow",     ()=>{ alert(
          APP.mode==="goodjunk"  ? t("howGJ") :
          APP.mode==="groups"    ? t("howGroups") :
          APP.mode==="hydration" ? t("howHydra") : t("howPlate")
        ); }],
        ["#btnLang",    ()=>{ APP.lang = (APP.lang==="th" ? "en" : "th"); localStorage.setItem("vrn_lang", APP.lang); applyLang(); }],
        ["#btnVoice",   ()=>{ APP.voiceOn=!APP.voiceOn; localStorage.setItem("vrn_voiceOn", JSON.stringify(APP.voiceOn)); applyLang(); }]
      ];
      map.forEach(([sel, fn])=>{
        const el = document.querySelector(sel);
        if(el && !el.__bound){ el.addEventListener("click", (ev)=>{ ev.stopPropagation(); fn(); }); el.__bound = true; }
      });
      document.querySelectorAll("#modeBar .tag").forEach(tag=>{
        if(tag.__bound) return;
        tag.addEventListener("click", (ev)=>{ ev.stopPropagation(); setMode(tag.getAttribute("data-mode")); applyLang(); });
        tag.__bound = true;
      });
      document.querySelectorAll("#diffBar .tag").forEach(tag=>{
        if(tag.__bound) return;
        tag.addEventListener("click", (ev)=>{ ev.stopPropagation(); setDiff(tag.getAttribute("data-diff")); });
        tag.__bound = true;
      });
    };
    bind(); let tries=0; const tmr=setInterval(()=>{ tries++; bind(); if(tries>10) clearInterval(tmr); }, 300);
  })();

  // ==== Scene click fallback (ในฉากเท่านั้น) ====
  (function bindSceneClick(){
    const scene = document.querySelector("a-scene");
    if(!scene) return;
    scene.addEventListener("click", (evt)=>{
      const el = evt.target;
      try{
        if(el && el.classList && el.classList.contains("clickable")){
          handleHit(el);
          el.parentNode && el.parentNode.removeChild(el);
        }
      }catch(_){}
    });
  })();

  // ==== Mouse Laser line (โชว์เส้น ไม่จับคลิก) ====
  (function setupLaserLine(){
    const scene=document.querySelector("a-scene"), camEl=$("#playerCam"), mouseRig=$("#mouseRig"), laser=$("#mouseLaser");
    if(!scene || !camEl || !mouseRig || !laser) return;
    const THREE_NS=window.THREE || (window.AFRAME && AFRAME.THREE);
    function updateLine(){
      try{
        if(scene.is && scene.is("vr-mode")){ laser.setAttribute("visible","false"); return; }
        const rc=mouseRig.components && mouseRig.components.raycaster; if(!rc) return;
        rc.refreshObjects(); const hit=rc.intersections && rc.intersections[0];
        if(THREE_NS && hit && hit.point){ const start=new THREE_NS.Vector3(); camEl.object3D.getWorldPosition(start); const end=hit.point.clone();
          laser.setAttribute("line",`start: ${start.x} ${start.y} ${start.z}; end: ${end.x} ${end.y} ${end.z}; color: #0ff`); laser.setAttribute("visible","true"); }
        else { laser.setAttribute("visible","false"); }
      }catch(e){ laser.setAttribute("visible","false"); }
    }
    scene.addEventListener("loaded", ()=> scene.addEventListener("mousemove", updateLine));
    const iv=setInterval(updateLine, 120);
    scene.addEventListener("enter-vr", ()=> laser.setAttribute("visible","false"));
    scene.addEventListener("exit-vr",  ()=> laser.setAttribute("visible","false"));
    window.addEventListener("beforeunload", ()=> clearInterval(iv));
  })();

  // ==== INIT ====
  let spawnerHandle=null, targetHits=0, targetHitNeed=3; // ประกาศร่วมที่ใช้ในหลายฟังก์ชัน
  applyLang(); updateHUD(); setMode(APP.mode); setDiff(APP.difficulty); showEmojiMenu();
  window.APP_VR_NUTRITION = APP;
})();
