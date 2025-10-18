
(() => {
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const i18n = {
    th: {
      start:"เริ่มเกม", pause:"พัก", how:"วิธีเล่น", restart:"เริ่มใหม่",
      score:"คะแนน", time:"เวลา", best:"สถิติ", mode:"โหมด", diff:"ความยาก", combo:"คอมโบ",
      modeGJ:"ดี vs ขยะ", modeGroups:"จาน 5 หมู่", daily:"ภารกิจประจำวัน",
      howGJ:"จ้อง/แตะ อาหารที่ดี (ผลไม้ ผัก น้ำ) หลีกเลี่ยงอาหารขยะ (เบอร์เกอร์ โซดา โดนัท) เก็บคอมโบเพื่อคะแนนสูง!",
      howGroups:"ดู 'หมู่เป้าหมาย' มุมขวาบน แล้วจ้อง/แตะอาหารที่อยู่ในหมู่นั้นเพื่อเก็บคะแนน!",
      tipsGood:"เยี่ยม! เลือกอาหารที่ดีมาก",
      tipsBad:"อาหารนี้ไม่ดีต่อสุขภาพ",
      target:"เป้าหมาย", summary:"สรุปผล", tipCombo:"ทิป: รักษาคอมโบเพื่อคะแนนทวีคูณ!",
      stars1:"ฝึกอีกนิด ⭐", stars2:"เก่งมาก ⭐⭐", stars3:"สุดยอด ⭐⭐⭐",
      langSetTH:"เปลี่ยนภาษาเป็นไทยแล้ว", langSetEN:"Language set to English",
      voiceOn:"เสียงพูด: เปิด", voiceOff:"เสียงพูด: ปิด"
    },
    en: {
      start:"Start", pause:"Pause", how:"How to Play", restart:"Restart",
      score:"Score", time:"Time", best:"Best", mode:"Mode", diff:"Difficulty", combo:"Combo",
      modeGJ:"Good vs Junk", modeGroups:"Food Groups Plate", daily:"Daily Mission",
      howGJ:"Gaze/tap healthy foods (fruits, veggies, water). Avoid junk (burger, soda, donut). Keep combo for higher scores!",
      howGroups:"Check 'Target Group' (top-right) then gaze/tap foods from that group to score!",
      tipsGood:"Great pick!", tipsBad:"Not healthy!",
      target:"Target", summary:"Summary", tipCombo:"Tip: Maintain combo to multiply your score!",
      stars1:"Keep practicing ⭐", stars2:"Nice job ⭐⭐", stars3:"Fantastic ⭐⭐⭐",
      langSetTH:"Language set to Thai", langSetEN:"Language set to English",
      voiceOn:"Voice: On", voiceOff:"Voice: Off"
    }
  };

  const APP = {
    lang: localStorage.getItem("vrn_lang") || "th",
    voiceOn: JSON.parse(localStorage.getItem("vrn_voiceOn") || "true"),
    difficulty: localStorage.getItem("vrn_diff") || "Normal",
    mode: localStorage.getItem("vrn_mode") || "goodjunk",
    score: 0, timeLeft: 60, running:false, paused:false,
    combo:1, comboMax:1, best: parseInt(localStorage.getItem("vrn_best")||"0"),
    mission: JSON.parse(localStorage.getItem("vrn_mission") || "null"),
    currentTarget: null
  };

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
      {id:"#water", good:true, label:"water"},
      {id:"#burger", good:false, label:"burger"},
      {id:"#soda", good:false, label:"soda"},
      {id:"#donut", good:false, label:"donut"}
    ],
    groups: [
      {id:"#g_grains", group:"grains"},
      {id:"#g_protein", group:"protein"},
      {id:"#g_veggies", group:"veggies"},
      {id:"#g_fruits", group:"fruits"},
      {id:"#g_dairy", group:"dairy"}
    ]
  };

  const targets = ["grains","protein","veggies","fruits","dairy"];

  function t(k){ return i18n[APP.lang][k]; }

  function applyLang(){
    $("#lblScore").textContent = t("score");
    $("#lblTime").textContent = t("time");
    $("#lblBest").textContent = t("best");
    $("#lblMode").textContent = t("mode");
    $("#lblDiff").textContent = t("diff");
    $("#lblCombo").textContent = t("combo");
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
    $("#btnVoice").querySelector("span[data-i18n]").textContent = APP.voiceOn ? (APP.lang==="th" ? i18n.th.voiceOn : i18n.en.voiceOn) : (APP.lang==="th" ? i18n.th.voiceOff : i18n.en.voiceOff);
    $("#modeName").textContent = APP.mode==="goodjunk" ? (APP.lang==="th"?i18n.th.modeGJ:i18n.en.modeGJ) : (APP.lang==="th"?i18n.th.modeGroups:i18n.en.modeGroups);
  }

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
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
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
    $("#modeName").textContent = APP.mode==="goodjunk" ? (APP.lang==="th"?i18n.th.modeGJ:i18n.en.modeGJ) : (APP.lang==="th"?i18n.th.modeGroups:i18n.en.modeGroups);
    const showTarget = (APP.mode==="groups");
    $("#targetBox").style.display = showTarget ? "block" : "none";
    if(showTarget && !APP.currentTarget){
      nextTarget();
    }
  }

  function setDiff(d){
    APP.difficulty = d; localStorage.setItem("vrn_diff", d);
    updateHUD();
  }

  function rand(min,max){ return Math.random()*(max-min)+min; }

  function spawnOne(){
    const root = $("#spawnerRoot");
    const y = rand(-0.4,0.4), x = rand(-1.0,1.0), z = rand(-1.0,1.0);
    const life = APP.difficulty==="Hard" ? 2000 : APP.difficulty==="Easy" ? 4200 : 3000;
    let src, meta={};

    if(APP.mode==="goodjunk"){
      const goodBias = APP.difficulty==="Easy" ? 0.7 : APP.difficulty==="Hard" ? 0.45 : 0.58;
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
    ent.setAttribute("scale","0.62 0.62 0.62");
    ent.setAttribute("class","clickable");
    ent.setAttribute("opacity","0.95");
    ent.dataset.meta = JSON.stringify(meta);
    ent.setAttribute("animation__pulse","property: scale; dir: alternate; dur: 550; loop:true; to: 0.68 0.68 0.68");

    const remove = ()=> ent.parentNode && ent.parentNode.removeChild(ent);

    ent.addEventListener("click", ()=>{
      handleHit(ent);
      remove();
    });
    ent.addEventListener("mouseenter", ()=> ent.setAttribute("opacity","1.0"));
    ent.addEventListener("mouseleave", ()=> ent.setAttribute("opacity","0.85"));

    root.appendChild(ent);

    setTimeout(()=>{
      if(ent.parentNode){
        const meta = JSON.parse(ent.dataset.meta||"{}");
        if(APP.mode==="goodjunk"){
          if(meta.good===false){
            APP.score += 1; // avoidance bonus
            updateHUD();
          } else {
            comboBreak();
          }
        } else {
          if(meta.group===APP.currentTarget){
            comboBreak();
          }
        }
        remove();
      }
    }, life);
  }

  function handleHit(ent){
    const meta = JSON.parse(ent.dataset.meta||"{}");
    let good = false, delta=0;

    if(APP.mode==="goodjunk"){
      good = meta.good===true;
      delta = good ? 5*APP.combo : -3;
      if(!good) comboBreak();
    } else {
      good = meta.group === APP.currentTarget;
      delta = good ? 6*APP.combo : -2;
      if(good){
        targetHits++;
        if(targetHits>=targetHitNeed){ nextTarget(); }
      } else {
        comboBreak();
      }
    }

    APP.score = Math.max(0, APP.score + delta);
    if(good){
      APP.combo = Math.min(5, APP.combo + 1);
      APP.comboMax = Math.max(APP.comboMax, APP.combo);
    }
    updateHUD();

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

  function comboBreak(){
    APP.combo = 1; updateHUD();
  }

  function nextTarget(){
    targetHits = 0;
    targetHitNeed = 3;
    const pool = targets.slice();
    if(APP.currentTarget){
      const idx = pool.indexOf(APP.currentTarget);
      if(idx>=0) pool.splice(idx,1);
    }
    APP.currentTarget = pool[Math.floor(Math.random()*pool.length)];
    $("#targetName").textContent = APP.currentTarget.toUpperCase();
    speak(APP.lang==="th" ? ("เป้าหมาย: "+translateGroup(APP.currentTarget,"th")) : ("Target: "+translateGroup(APP.currentTarget,"en")));
  }

  function translateGroup(g, lang="th"){
    const map = {
      grains: {th:"ธัญพืช", en:"Grains"},
      protein:{th:"โปรตีน", en:"Protein"},
      veggies:{th:"ผัก", en:"Veggies"},
      fruits: {th:"ผลไม้", en:"Fruits"},
      dairy:  {th:"นม/นมถั่วเหลือง", en:"Dairy"}
    };
    return map[g] ? map[g][lang] : g;
  }

  function timerTick(){
    if(!APP.running || APP.paused) return;
    setTimeout(()=>{
      APP.timeLeft -= 1;
      updateHUD();
      if(APP.timeLeft<=0){
        endGame();
      } else {
        timerTick();
      }
    }, 1000);
  }

  let spawnerHandle = null, targetHits=0, targetHitNeed=3;

  function loop(){
    if(!APP.running || APP.paused) return;
    const baseRate = APP.mode==="goodjunk" ? 580 : 640;
    const rate = APP.difficulty==="Hard" ? baseRate*0.65 : APP.difficulty==="Easy" ? baseRate*1.25 : baseRate;
    spawnOne();
    spawnerHandle = setTimeout(loop, rate);
  }

  function startGame(){
    if(APP.running && !APP.paused) return;
    if(!APP.running){
      APP.score = 0; APP.combo=1; APP.comboMax=1; APP.timeLeft = 60; updateHUD();
      if(APP.mode==="groups"){ nextTarget(); }
      speak(APP.lang==="th" ? "เริ่มเกม!" : "Start!");
    } else {
      speak(APP.lang==="th" ? "เล่นต่อ" : "Resume");
    }
    APP.running = true; APP.paused=false;
    $("#summary").style.display = "none";
    loop(); timerTick();
  }

  function pauseGame(){
    if(!APP.running) return;
    APP.paused = !APP.paused;
    if(APP.paused){
      clearTimeout(spawnerHandle);
      speak(APP.lang==="th" ? "พักเกม" : "Paused");
    } else {
      speak(APP.lang==="th" ? "เล่นต่อ" : "Resume");
      loop(); timerTick();
    }
  }

  function endGame(){
    APP.running=false; APP.paused=false; clearTimeout(spawnerHandle);
    if(APP.score>APP.best){ APP.best = APP.score; localStorage.setItem("vrn_best", String(APP.best)); }

    const mission = JSON.parse(localStorage.getItem("vrn_mission"));
    if(mission && !mission.achieved && APP.score>=mission.goal){
      mission.achieved = true; localStorage.setItem("vrn_mission", JSON.stringify(mission));
    }

    const star = APP.score>=180 ? 3 : APP.score>=120 ? 2 : 1;
    $("#sumStars").textContent = "★".repeat(star) + "☆".repeat(3-star);
    $("#sumBody").textContent = `Score: ${APP.score} • Combo Max: x${APP.comboMax} • Mode: ${APP.mode} • Diff: ${APP.difficulty}`;
    $("#summary").style.display = "flex";
    speak(APP.lang==="th" ? `จบเกม คะแนน ${APP.score}` : `Finished, score ${APP.score}`);
  }

  $("#btnStart").addEventListener("click", startGame);
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
    speak(APP.lang==="th" ? i18n.th.langSetTH : i18n.en.langSetEN);
  });
  $("#btnVoice").addEventListener("click", ()=>{
    APP.voiceOn = !APP.voiceOn;
    localStorage.setItem("vrn_voiceOn", JSON.stringify(APP.voiceOn));
    applyLang();
    if(APP.voiceOn) speak(APP.lang==="th"? i18n.th.voiceOn : i18n.en.voiceOn);
  });

  $$("#modeBar .tag").forEach(tag=> tag.addEventListener("click", ()=> { setMode(tag.getAttribute("data-mode")); applyLang(); }));
  $$("#diffBar .tag").forEach(tag=> tag.addEventListener("click", ()=> setDiff(tag.getAttribute("data-diff"))));

  applyLang(); updateHUD(); setMode(APP.mode); setDiff(APP.difficulty);
  window.APP_VR_NUTRITION = APP;
})();
