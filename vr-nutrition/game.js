
(() => {
  const $  = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // I18N
  const i18n = {
    th: { start:"เริ่มเกม", pause:"พัก", how:"วิธีเล่น", restart:"เริ่มใหม่",
      score:"คะแนน", time:"เวลา", best:"สถิติ", mode:"โหมด", diff:"ความยาก", combo:"คอมโบ",
      modeGJ:"ดี vs ขยะ", modeGroups:"จาน 5 หมู่", daily:"ภารกิจประจำวัน",
      howGJ:"จ้อง/แตะ อาหารที่ดี (ผลไม้ ผัก น้ำ) หลีกเลี่ยงอาหารขยะ (เบอร์เกอร์ โซดา โดนัท) เก็บคอมโบเพื่อคะแนนสูง!",
      howGroups:"ดู 'หมู่เป้าหมาย' มุมขวาบน แล้วจ้อง/แตะอาหารที่อยู่ในหมู่นั้นเพื่อเก็บคะแนน!",
      tipsGood:"เยี่ยม! เลือกอาหารที่ดีมาก", tipsBad:"อาหารนี้ไม่ดีต่อสุขภาพ",
      target:"เป้าหมาย", summary:"สรุปผล",
      langSetTH:"เปลี่ยนภาษาเป็นไทยแล้ว", langSetEN:"Language set to English",
      voiceOn:"เสียงพูด: เปิด", voiceOff:"เสียงพูด: ปิด"
    },
    en: { start:"Start", pause:"Pause", how:"How to Play", restart:"Restart",
      score:"Score", time:"Time", best:"Best", mode:"Mode", diff:"Difficulty", combo:"Combo",
      modeGJ:"Good vs Junk", modeGroups:"Food Groups Plate", daily:"Daily Mission",
      howGJ:"Gaze/tap healthy foods (fruits, veggies, water). Avoid junk (burger, soda, donut). Keep combo for higher scores!",
      howGroups:"Check 'Target Group' (top-right) then gaze/tap foods from that group to score!",
      tipsGood:"Great pick!", tipsBad:"Not healthy!",
      target:"Target", summary:"Summary",
      langSetTH:"Language set to Thai", langSetEN:"Language set to English",
      voiceOn:"Voice: On", voiceOff:"Voice: Off"
    }
  };

  // STATE
  const APP = {
    lang: localStorage.getItem("vrn_lang") || "th",
    voiceOn: JSON.parse(localStorage.getItem("vrn_voiceOn") || "true"),
    difficulty: localStorage.getItem("vrn_diff") || "Normal",
    mode: localStorage.getItem("vrn_mode") || "goodjunk",
    score: 0, timeLeft: 60, running:false, paused:false,
    combo:1, comboMax:1, best: parseInt(localStorage.getItem("vrn_best")||"0"),
    mission: JSON.parse(localStorage.getItem("vrn_mission") || "null"),
    currentTarget: null,
    fever: false, protect: 0
  };

  // Mission
  (function ensureMission(){
    const today = new Date().toISOString().slice(0,10);
    if(!APP.mission || APP.mission.date !== today){
      APP.mission = { date: today, goal: 120, achieved: false };
      localStorage.setItem("vrn_mission", JSON.stringify(APP.mission));
    }
  })();

  const foods = {
    goodjunk: [
      {id:"#apple", good:true, label:"apple"},
      {id:"#broccoli", good:true, label:"veggies"},
      {id:"#water",  good:true, label:"water"},
      {id:"#burger", good:false, label:"burger"},
      {id:"#soda",   good:false, label:"soda"},
      {id:"#donut",  good:false, label:"donut"}
    ],
    groups: [
      {id:"#g_grains",  group:"grains"},
      {id:"#g_protein", group:"protein"},
      {id:"#g_veggies", group:"veggies"},
      {id:"#g_fruits",  group:"fruits"},
      {id:"#g_dairy",   group:"dairy"}
    ]
  };
  const targets = ["grains","protein","veggies","fruits","dairy"];

  // Power-ups
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

  // UTIL
  function t(k){ return i18n[APP.lang][k]; }
  function rand(min,max){ return Math.random()*(max-min)+min; }
  function speak(thMsg, enMsg){
    if(!APP.voiceOn) return;
    const u = new SpeechSynthesisUtterance(APP.lang==="th"? thMsg : enMsg);
    const voices = speechSynthesis.getVoices();
    if(APP.lang==="th"){
      const th = voices.find(v=> v.lang && v.lang.toLowerCase().startsWith("th"));
      if(th) u.voice = th;
    } else {
      const en = voices.find(v=> v.lang && v.lang.toLowerCase().startsWith("en"));
      if(en) u.voice = en;
    }
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }
  function applyLang(){
    $("#lblScore").textContent = t("score");
    $("#lblTime").textContent = t("time");
    $("#lblBest").textContent = t("best");
    $("#lblMode").textContent = t("mode");
    $("#lblDiff").textContent = t("diff");
    $("#lblCombo").textContent = "Combo" in i18n[APP.lang] ? t("combo") : "Combo";
    $("#sumTitle").textContent = t("summary");
    $("#sumTips").textContent = APP.lang==="th" ? "ทิป: เก็บอาหารที่ดีต่อสุขภาพเพื่อคอมโบ!" : "Tip: Collect healthy to keep combo!";
    $$("[data-i18n=modeGJ]").forEach(el=> el.textContent = t("modeGJ"));
    $$("[data-i18n=modeGroups]").forEach(el=> el.textContent = t("modeGroups"));
    $$("[data-i18n=start]").forEach(el=> el.textContent = t("start"));
    $$("[data-i18n=pause]").forEach(el=> el.textContent = t("pause"));
    $$("[data-i18n=how]").forEach(el=> el.textContent = t("how"));
    $$("[data-i18n=restart]").forEach(el=> el.textContent = t("restart"));
    $("#missionTag").textContent = APP.lang==="th" ? i18n.th.daily : i18n.en.daily;
    $("#lblTarget").textContent = APP.lang==="th" ? i18n.th.target : i18n.en.target;
    $("#langText").textContent = (APP.lang==="th" ? "ไทย/English" : "English/ไทย");
    $("#btnVoice").querySelector("span[data-i18n]").textContent =
      APP.voiceOn ? (APP.lang==="th" ? i18n.th.voiceOn : i18n.en.voiceOn)
                  : (APP.lang==="th" ? i18n.th.voiceOff : i18n.en.voiceOff);
    $("#modeName").textContent =
      APP.mode==="goodjunk" ? (APP.lang==="th"?i18n.th.modeGJ:i18n.en.modeGJ)
                            : (APP.lang==="th"?i18n.th.modeGroups:i18n.en.modeGroups);
  }
  function updateHUD(){
    $("#score").textContent = APP.score;
    $("#time").textContent = APP.timeLeft;
    $("#best").textContent = APP.best;
    $("#difficulty").textContent = APP.difficulty;
    $("#combo").textContent = "x"+APP.combo;
  }
  function setMode(m){
    APP.mode = m; localStorage.setItem("vrn_mode", m);
    $("#modeName").textContent =
      APP.mode==="goodjunk" ? (APP.lang==="th"?i18n.th.modeGJ:i18n.en.modeGJ)
                            : (APP.lang==="th"?i18n.th.modeGroups:i18n.en.modeGroups);
    const showTarget = (APP.mode==="groups");
    $("#targetBox").style.display = showTarget ? "block" : "none";
    if(showTarget && !APP.currentTarget){ nextTarget(); }
  }
  function setDiff(d){ APP.difficulty = d; localStorage.setItem("vrn_diff", d); updateHUD(); }
  function hideTitleUI(){ ["titlePanel","titleText","subtitleText"].forEach(id=>{ const e = document.getElementById(id); if(e) e.setAttribute("visible","false"); }); }
  function showEmojiMenu(){
    clearEmojiMenu();
    const root = document.getElementById("emojiMenuRoot");
    if(!root) return;
    const items = [
      {emoji:"🥗", label: APP.lang==="th"?"ดีvsขยะ":"Good/Junk", action:()=>{ setMode("goodjunk"); }},
      {emoji:"🍽️",label: APP.lang==="th"?"จาน5หมู่":"5 Groups", action:()=>{ setMode("groups"); }},
      {emoji:"🐢", label:"Easy",   action:()=>{ setDiff("Easy"); }},
      {emoji:"⚖️", label:"Normal", action:()=>{ setDiff("Normal"); }},
      {emoji:"🔥", label:"Hard",   action:()=>{ setDiff("Hard"); }},
      {emoji:"▶️", label: APP.lang==="th"?"เริ่ม!":"Start!", action:()=>{ clearEmojiMenu(); startGame(); }}
    ];
    const radius = 0.9;
    items.forEach((it, i)=>{
      const angle = (i / items.length) * Math.PI * 2 - Math.PI/2;
      const x = Math.cos(angle)*radius, y = Math.sin(angle)*radius;
      const e = document.createElement("a-entity");
      e.setAttribute("position", `${x} ${y} 0`);
      e.setAttribute("class","clickable");
      e.setAttribute("animation__bob","property: position; dir: alternate; dur: 1200; loop:true; to: "+`${x} ${y+0.06} 0`);
      e.setAttribute("text", `value: ${it.emoji}\n${it.label}; align:center; width: 2.6; color:#0ff`);
      e.addEventListener("click", ()=> it.action());
      root.appendChild(e);
    });
  }
  function clearEmojiMenu(){
    const root = document.getElementById("emojiMenuRoot");
    while(root && root.firstChild) root.removeChild(root.firstChild);
  }

  // Fever
  let feverTimer = null;
  function enterFever(durationMs=6000){
    if(APP.fever) return;
    APP.fever = true;
    if(feverTimer) clearTimeout(feverTimer);
    feverTimer = setTimeout(()=>{ APP.fever=false; }, durationMs);
  }

  let SPAWN_COUNT = 0;
  // Spawner
  function spawnOne(){
    const root = $("#spawnerRoot");
    const y = rand(-0.20, 0.25), x = rand(-0.85, 0.85), z = rand(-0.40, 0.40);
    const life = APP.difficulty==="Hard" ? 2000 : APP.difficulty==="Easy" ? 4200 : 3000;

    let src = null, meta = {};
    if(Math.random() < 0.12){
      const s = pickSpecial(); meta.special = s.type; src = s.img;
    } else if(APP.mode==="goodjunk"){
      const goodBias = APP.difficulty==="Easy" ? 0.70 : APP.difficulty==="Hard" ? 0.45 : 0.58;
      const pool = Math.random()<goodBias ? foods.goodjunk.filter(f=>f.good) : foods.goodjunk.filter(f=>!f.good);
      const f = pool[Math.floor(Math.random()*pool.length)];
      src = f.id; meta.good = !!f.good;
    } else {
      const f = foods.groups[Math.floor(Math.random()*foods.groups.length)];
      src = f.id; meta.group = f.group;
    }

    const ent = document.createElement("a-image");
    ent.setAttribute("src", src);
    ent.setAttribute("position", `${x} ${y} ${z}`);
    ent.setAttribute("scale","0.78 0.78 0.78");
    ent.setAttribute("class","clickable");
    ent.setAttribute("material","shader: flat; transparent: true; opacity: 0.98");
    ent.dataset.meta = JSON.stringify(meta);
    ent.setAttribute("animation__pulse","property: scale; dir: alternate; dur: 550; loop:true; to: 0.86 0.86 0.86");

    const remove = ()=> ent.parentNode && ent.parentNode.removeChild(ent);
    ent.addEventListener("click", ()=>{ handleHit(ent); remove(); });
    ent.addEventListener("mouseenter", ()=> ent.setAttribute("opacity","1.0"));
    ent.addEventListener("mouseleave", ()=> ent.setAttribute("opacity","0.88"));

    root.appendChild(ent);
    SPAWN_COUNT++;

    setTimeout(()=>{
      if(ent.parentNode){
        const m = JSON.parse(ent.dataset.meta||"{}");
        if(!m.special){
          if(APP.mode==="goodjunk"){
            if(m.good===false){ APP.score += 1; updateHUD(); }
            else { comboBreak(); }
          } else {
            if(m.group===APP.currentTarget){ comboBreak(); }
          }
        }
        remove();
      }
    }, life);
  }

  function handleHit(ent){
    const meta = JSON.parse(ent.dataset.meta||"{}");

    // Specials
    if(meta.special){
      switch(meta.special){
        case "time":   APP.timeLeft = Math.min(99, APP.timeLeft + 5); speak("ได้เวลาเพิ่ม","Time +5"); break;
        case "fever":  enterFever(); speak("โหมดไฟลุก!","Fever!"); break;
        case "shield": APP.protect = Math.min(1, APP.protect+1); speak("กันพลาด 1 ครั้ง","Shield up"); break;
        case "slow":
          const oldDiff = APP.difficulty; APP.difficulty = "Easy";
          setTimeout(()=>{ APP.difficulty = oldDiff; }, 2000);
          speak("ช้าลงชั่วคราว","Time slow");
          break;
        case "bomb":
          if(APP.protect>0){ APP.protect--; speak("กันพลาดไว้แล้ว","Shield saved"); }
          else { comboBreak(); APP.score = Math.max(0, APP.score - 5); speak("คอมโบหลุด!","Combo break!"); }
          break;
      }
      updateHUD(); return;
    }

    // Foods
    let good = false, delta = 0;
    if(APP.mode==="goodjunk"){
      good = meta.good===true;
      delta = good ? 5*APP.combo : -3;
      if(!good) comboBreak();
    } else {
      good = meta.group === APP.currentTarget;
      delta = good ? 6*APP.combo : -2;
      if(good){ targetHits++; if(targetHits>=targetHitNeed){ nextTarget(); } }
      else comboBreak();
    }

    if(APP.fever && delta > 0) delta += Math.floor(delta); // ~x2
    APP.score = Math.max(0, APP.score + delta);
    if(good){ APP.combo = Math.min(5, APP.combo + 1); APP.comboMax = Math.max(APP.comboMax, APP.combo); }
    if(APP.combo >= 4) enterFever();
    updateHUD();

    // Floating feedback
    const fb = document.createElement("a-entity");
    const txt = good ? (APP.lang==="th" ? `ดีมาก! +${delta}` : `Nice! +${delta}`) : (APP.lang==="th" ? `พลาด ${delta}` : `Miss ${delta}`);
    fb.setAttribute("text", `value: ${txt}; align: center; width: 2.8; color: ${good?"#0f8":"#f55"}`);
    const p = ent.getAttribute("position");
    fb.setAttribute("position", `${p.x} ${p.y+0.2} ${p.z}`);
    fb.setAttribute("animation__rise","property: position; to: "+`${p.x} ${p.y+0.7} ${p.z}`+"; dur: 700; easing: easeOutCubic");
    fb.setAttribute("animation__fade","property: opacity; to: 0; dur: 700; easing: linear");
    document.querySelector("a-scene").appendChild(fb);
    setTimeout(()=> fb.parentNode && fb.parentNode.removeChild(fb), 750);

    speak(good ? i18n.th.tipsGood : i18n.th.tipsBad, good ? i18n.en.tipsGood : i18n.en.tipsBad);
  }

  function comboBreak(){ APP.combo = 1; updateHUD(); }

  let spawnerHandle = null, targetHits=0, targetHitNeed=3;
  function nextTarget(){
    targetHits = 0;
    const pool = targets.slice();
    if(APP.currentTarget){ const i = pool.indexOf(APP.currentTarget); if(i>=0) pool.splice(i,1); }
    APP.currentTarget = pool[Math.floor(Math.random()*pool.length)];
    $("#targetName").textContent = APP.currentTarget.toUpperCase();
  }
  function loop(){
    if(!APP.running || APP.paused) return;
    const baseRate = APP.mode==="goodjunk" ? 580 : 640;
    let rate = APP.difficulty==="Hard" ? baseRate*0.65 : APP.difficulty==="Easy" ? baseRate*1.25 : baseRate;
    if(APP.fever) rate *= 0.65;
    spawnOne();
    spawnerHandle = setTimeout(loop, rate);
  }
  function timerTick(){
    if(!APP.running || APP.paused) return;
    setTimeout(()=>{ APP.timeLeft -= 1; updateHUD(); if(APP.timeLeft<=0){ endGame(); } else { timerTick(); } }, 1000);
  }

  function startGame(){
    // safety: ensure first spawns appear even if loop timing stalls
    setTimeout(()=>{ if(SPAWN_COUNT===0){ try{ spawnOne(); }catch(e){} } }, 1200);

    if(APP.running && !APP.paused) return;
    if(!APP.running){
      APP.score = 0; APP.combo=1; APP.comboMax=1; APP.timeLeft = 60; updateHUD();
      if(APP.mode==="groups"){ nextTarget(); }
    }
    APP.running = true; APP.paused=false;
    $("#summary").style.display = "none";
    hideTitleUI();
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

    const star = APP.score>=180 ? 3 : APP.score>=120 ? 2 : 1;
    $("#sumStars").textContent = "★".repeat(star) + "☆".repeat(3-star);
    $("#sumBody").textContent = `Score: ${APP.score} • Combo Max: x${APP.comboMax} • Mode: ${APP.mode} • Diff: ${APP.difficulty}`;
    $("#summary").style.display = "flex";
    showEmojiMenu();
  }

  // BINDINGS
  $("#btnStart").addEventListener("click", ()=>{ try{ clearEmojiMenu(); }catch(e){}; startGame(); });
  $("#btnPause").addEventListener("click", pauseGame);
  $("#btnHow").addEventListener("click", ()=>{
    alert(APP.mode==="goodjunk" ? (APP.lang==="th"? i18n.th.howGJ : i18n.en.howGJ)
                                : (APP.lang==="th"? i18n.th.howGroups : i18n.en.howGroups));
  });
  $("#btnRestart").addEventListener("click", ()=>{
    $("#summary").style.display = "none";
    APP.running=false; APP.paused=false; clearTimeout(spawnerHandle);
    startGame();
  });
  $("#btnLang").addEventListener("click", ()=>{
    APP.lang = (APP.lang==="th" ? "en" : "th");
    localStorage.setItem("vrn_lang", APP.lang);
    applyLang();
  });
  $("#btnVoice").addEventListener("click", ()=>{
    APP.voiceOn = !APP.voiceOn;
    localStorage.setItem("vrn_voiceOn", JSON.stringify(APP.voiceOn));
    applyLang();
  });
  $$("#modeBar .tag").forEach(tag=> tag.addEventListener("click", ()=>{ setMode(tag.getAttribute("data-mode")); applyLang(); }));
  $$("#diffBar .tag").forEach(tag=> tag.addEventListener("click", ()=> setDiff(tag.getAttribute("data-diff"))));

  // INIT
  function showTitleUI(){ ["titlePanel","titleText","subtitleText"].forEach(id=>{ const e = document.getElementById(id); if(e) e.setAttribute("visible","true"); }); }
  function translateGroup(g, lang="th"){ return g; } // placeholder
  applyLang(); updateHUD(); setMode(APP.mode); setDiff(APP.difficulty);
  showEmojiMenu();
  window.APP_VR_NUTRITION = APP;
})();

  // Keyboard quick start (spacebar)
  window.addEventListener('keydown', (e)=>{
    if(e.code==='Space' && !APP.running){
      try{ clearEmojiMenu(); }catch(_){}
      startGame();
    }
  });
