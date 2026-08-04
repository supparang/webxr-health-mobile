(function () {
  "use strict";

  const cfg = window.EW_CONFIG;
  const api = window.EW_AUTHORITY;
  const rotation = window.EW_ROTATION;
  const root = document.getElementById("memoryRoot");
  const loading = document.getElementById("memoryLoading");
  const loadingText = document.getElementById("memoryLoadingText");
  const VERSION = "2026-08-04-WORD-MATCH-STATIC-TILT-SNAP-V4";

  const PAIR_BANK = Object.freeze([
    {id:"wm01",word:"journey",meaning:"การเดินทาง",emoji:"🧳",level:"A2"},
    {id:"wm02",word:"healthy",meaning:"มีสุขภาพดี",emoji:"🥗",level:"A2"},
    {id:"wm03",word:"device",meaning:"อุปกรณ์",emoji:"📱",level:"A2"},
    {id:"wm04",word:"schedule",meaning:"กำหนดการ",emoji:"🗓️",level:"A2"},
    {id:"wm05",word:"passport",meaning:"หนังสือเดินทาง",emoji:"🛂",level:"A2"},
    {id:"wm06",word:"exercise",meaning:"การออกกำลังกาย",emoji:"🏃",level:"A2"},
    {id:"wm07",word:"environment",meaning:"สิ่งแวดล้อม",emoji:"🌱",level:"A2+"},
    {id:"wm08",word:"volunteer",meaning:"อาสาสมัคร",emoji:"🙋",level:"A2+"},
    {id:"wm09",word:"protect",meaning:"ปกป้อง",emoji:"🛡️",level:"A2+"},
    {id:"wm10",word:"community",meaning:"ชุมชน",emoji:"🏘️",level:"A2+"},
    {id:"wm11",word:"destination",meaning:"จุดหมายปลายทาง",emoji:"📍",level:"A2+"},
    {id:"wm12",word:"improve",meaning:"พัฒนาให้ดีขึ้น",emoji:"📈",level:"A2+"},
    {id:"wm13",word:"opportunity",meaning:"โอกาส",emoji:"🚪",level:"B1"},
    {id:"wm14",word:"confident",meaning:"มั่นใจ",emoji:"💪",level:"B1"},
    {id:"wm15",word:"reliable",meaning:"น่าเชื่อถือ",emoji:"✅",level:"B1"},
    {id:"wm16",word:"feedback",meaning:"ข้อมูลป้อนกลับ",emoji:"📊",level:"B1"},
    {id:"wm17",word:"pollution",meaning:"มลพิษ",emoji:"🌫️",level:"B1"},
    {id:"wm18",word:"interview",meaning:"การสัมภาษณ์",emoji:"🧑‍💼",level:"B1"},
    {id:"wm19",word:"achievement",meaning:"ความสำเร็จ",emoji:"🏆",level:"B1+"},
    {id:"wm20",word:"responsibility",meaning:"ความรับผิดชอบ",emoji:"🧭",level:"B1+"},
    {id:"wm21",word:"sustainable",meaning:"ยั่งยืน",emoji:"♻️",level:"B1+"},
    {id:"wm22",word:"collaboration",meaning:"การทำงานร่วมกัน",emoji:"🤝",level:"B1+"},
    {id:"wm23",word:"recommendation",meaning:"ข้อเสนอแนะ",emoji:"💡",level:"B1+"},
    {id:"wm24",word:"communication",meaning:"การสื่อสาร",emoji:"💬",level:"B1+"}
  ]);

  const state = {
    identity:null,
    authority:null,
    assignment:null,
    selectedPairs:[],
    deck:[],
    first:null,
    second:null,
    locked:false,
    matched:0,
    mistakes:0,
    flips:0,
    combo:0,
    bestCombo:0,
    points:0,
    startedAt:0,
    pairStats:{},
    timer:0,
    pending:null,
    tilt:{
      permissionRequested:false,
      sensorSeen:false,
      calibrated:false,
      calibrating:false,
      calibrationStartedAt:0,
      calibrationGamma:0,
      calibrationBeta:0,
      calibrationCount:0,
      baselineGamma:0,
      baselineBeta:0,
      targetX:0,
      targetY:0,
      smoothX:0,
      smoothY:0,
      armed:false,
      neutralSince:0,
      focusedId:"",
      confirmAfterMove:false,
      dwellStart:0,
      cooldownUntil:0,
      raf:0,
      missingTimer:0
    }
  };

  const ENTER_DEG = 8.5;
  const RELEASE_DEG = 4.2;
  const CALIBRATION_MS = 650;
  const NEUTRAL_ARM_MS = 170;
  const DWELL_MS = 760;
  const MOVE_COOLDOWN_MS = 250;

  const h = value => String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function readIdentity() {
    try { return JSON.parse(localStorage.getItem(cfg.cacheKeys.identity) || "null"); }
    catch (_) { return null; }
  }

  function showLoading(message) {
    loadingText.textContent = message || "กำลังโหลดข้อมูล…";
    loading.hidden = false;
  }

  function hideLoading() {
    loading.hidden = true;
  }

  function localDemoAuthority(playerId) {
    try {
      const db = JSON.parse(localStorage.getItem(cfg.cacheKeys.demoDb) || "{}") || {};
      const record = db[playerId];
      return record ? JSON.parse(JSON.stringify(record)) : null;
    } catch (_) {
      return null;
    }
  }

  function timeout(ms, code) {
    return new Promise((_, reject) => setTimeout(() => reject(new Error(code)), ms));
  }

  async function resumeAuthority() {
    try {
      return await Promise.race([
        api.resume(state.identity.playerId, state.identity.nickname),
        timeout(Math.min(Number(cfg.requestTimeoutMs || 12000), 5000), "RESUME_TIMEOUT")
      ]);
    } catch (error) {
      if (!api.endpointReady?.()) {
        const local = localDemoAuthority(state.identity.playerId);
        if (local) return local;
      }
      throw error;
    }
  }

  function shell(content) {
    return `<div class="memory-shell">
      <header class="memory-top">
        <button id="backBtn" class="icon-btn" type="button" aria-label="กลับ Passport">←</button>
        <div class="title"><strong>🧩 Word Match Village</strong><small>${h(state.assignment?.passportRotation || "P?")} • Tilt Snap • A2–B1+</small></div>
        <button id="exitBtn" class="icon-btn" type="button" aria-label="ออกจากเกม">🗺️</button>
      </header>${content}</div>`;
  }

  function stopAll() {
    if (state.timer) clearInterval(state.timer);
    state.timer = 0;
    if (state.tilt.raf) cancelAnimationFrame(state.tilt.raf);
    state.tilt.raf = 0;
    if (state.tilt.missingTimer) clearTimeout(state.tilt.missingTimer);
    state.tilt.missingTimer = 0;
    window.removeEventListener("deviceorientation", onOrientation, true);
  }

  function goPassport() {
    stopAll();
    location.href = "./index.html?resume=memory&v=20260804-memory4";
  }

  function wireNav() {
    document.getElementById("backBtn")?.addEventListener("click", goPassport);
    document.getElementById("exitBtn")?.addEventListener("click", goPassport);
  }

  function renderNeedLogin() {
    root.innerHTML = shell(`<section class="intro-card"><div class="hero">🔐</div><h1>กรุณาเข้าสู่ระบบก่อน</h1><p class="lead">เปิดเกมจาก English Week Passport เพื่อโหลดรหัสผู้เล่นและชุด Rotation</p><div class="action-grid"><button id="loginBtn" class="btn primary">กลับหน้า Login</button></div></section>`);
    wireNav();
    document.getElementById("loginBtn").onclick = goPassport;
  }

  function renderLocked() {
    root.innerHTML = shell(`<section class="intro-card"><div class="hero">🔒</div><h1>ด่านนี้ยังไม่ปลดล็อก</h1><p class="lead">ต้องทำ Pre-Challenge ให้ครบก่อนจึงจะเริ่ม Word Match Village ได้</p><div class="action-grid"><button id="lockedBtn" class="btn primary">กลับ English Passport</button></div></section>`);
    wireNav();
    document.getElementById("lockedBtn").onclick = goPassport;
  }

  function renderIntro(message) {
    root.innerHTML = shell(`<section class="intro-card">
      <div class="hero">📱</div><h1>Tilt Snap Memory</h1>
      <p class="lead">เอียงมือถือเพื่อเลื่อน Focus ทีละใบ คืนเครื่องสู่กลาง แล้วค้างเพื่อเปิด จับคู่คำอังกฤษกับความหมายไทยให้ครบ 6 คู่</p>
      ${message ? `<div class="notice error">${h(message)}</div>` : ""}
      <div class="notice"><strong>วิธีบังคับ:</strong> เอียงสั้น ๆ 1 ครั้ง = เลื่อน 1 ใบ • คืนเครื่องกลาง = ยืนยัน • ไม่มีการแตะการ์ดแทน</div>
      <div class="notice"><strong>เกณฑ์ผ่าน:</strong> จับคู่ครบและได้ Mastery อย่างน้อย 70%</div>
      <div class="action-grid"><button id="startBtn" class="btn primary">เริ่ม Tilt Snap Memory</button><button id="introBackBtn" class="btn secondary">กลับ Passport</button></div>
    </section>`);
    wireNav();
    document.getElementById("startBtn").onclick = startGame;
    document.getElementById("introBackBtn").onclick = goPassport;
  }

  function choosePairs() {
    const pool = rotation
      ? rotation.balancedSample(PAIR_BANK, 12, "word_match:pool", item => item.level)
      : PAIR_BANK.slice(0, 12);
    return rotation
      ? rotation.balancedSample(pool, 6, "word_match:play", item => item.level)
      : pool.slice(0, 6);
  }

  function ordered(values, stage, suffix) {
    if (rotation) return rotation.order(values, stage, suffix);
    return values.slice().sort(() => Math.random() - 0.5);
  }

  async function requestMotionPermission() {
    state.tilt.permissionRequested = true;
    beginCalibration();
    if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
      const result = await DeviceOrientationEvent.requestPermission();
      if (result !== "granted") throw new Error("MOTION_PERMISSION_DENIED");
    }
  }

  function beginCalibration() {
    Object.assign(state.tilt, {
      sensorSeen:false,
      calibrated:false,
      calibrating:true,
      calibrationStartedAt:performance.now(),
      calibrationGamma:0,
      calibrationBeta:0,
      calibrationCount:0,
      baselineGamma:0,
      baselineBeta:0,
      targetX:0,
      targetY:0,
      smoothX:0,
      smoothY:0,
      armed:false,
      neutralSince:0,
      focusedId:"",
      confirmAfterMove:false,
      dwellStart:0,
      cooldownUntil:0
    });
  }

  async function startGame() {
    try {
      await requestMotionPermission();
    } catch (error) {
      return renderIntro("ไม่สามารถเปิด Motion Sensor ได้ กรุณาอนุญาตการเคลื่อนไหวและโหลดใหม่");
    }

    state.selectedPairs = choosePairs();
    const cards = state.selectedPairs.flatMap(pair => [
      {cardId:`${pair.id}-word`,pairId:pair.id,side:"word",label:pair.word,emoji:pair.emoji,level:pair.level,matched:false,flipped:false},
      {cardId:`${pair.id}-meaning`,pairId:pair.id,side:"meaning",label:pair.meaning,emoji:pair.emoji,level:pair.level,matched:false,flipped:false}
    ]);
    state.deck = ordered(cards, "word_match", "deck");
    state.first = null;
    state.second = null;
    state.locked = false;
    state.matched = 0;
    state.mistakes = 0;
    state.flips = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.points = 0;
    state.startedAt = Date.now();
    state.pairStats = Object.fromEntries(state.selectedPairs.map(pair => [pair.id,{attempts:0,matchedAtMs:null,level:pair.level}]));
    state.pending = null;
    renderBoard();
    window.addEventListener("deviceorientation", onOrientation, true);
    state.timer = setInterval(updateElapsed, 1000);
    state.tilt.missingTimer = setTimeout(() => {
      if (!state.tilt.sensorSeen && document.getElementById("memoryGrid")) renderSensorError();
    }, 6500);
    tiltLoop();
  }

  function cardHtml(card) {
    return `<button class="memory-card" type="button" data-card-id="${h(card.cardId)}" tabindex="-1" aria-label="${h(card.level)} vocabulary card">
      <span class="memory-card-inner"><span class="memory-face memory-back">EW</span><span class="memory-face memory-front ${card.side}">${card.side === "word" ? `<span>${h(card.emoji)}<br>${h(card.label)}<small style="display:block;margin-top:4px">${h(card.level)}</small></span>` : h(card.label)}</span></span>
    </button>`;
  }

  function renderBoard() {
    root.innerHTML = shell(`<section class="hud">
      <div class="hud-box"><small>ความก้าวหน้า</small><strong id="matchCount">0 / 6 คู่</strong><div class="progress-line"><span id="matchProgress" style="width:0%"></span></div></div>
      <div class="hud-box"><small>เปิดผิด</small><strong id="mistakeCount">0</strong></div>
      <div class="hud-box"><small>เวลา</small><strong id="elapsed">0:00</strong></div>
    </section><section class="panel game-panel"><p class="instruction">เอียงหนึ่งครั้งเลื่อนหนึ่งใบ • คืนเครื่องสู่กลาง • ค้างเพื่อเปิด</p><div id="memoryGrid" class="memory-grid">${state.deck.map(cardHtml).join("")}</div><div id="memoryFeedback" class="feedback">ถือเครื่องนิ่งเพื่อปรับศูนย์</div></section>`);
    wireNav();
    ensureGuide();
    updateHud();
  }

  function ensureGuide() {
    let guide = document.getElementById("ewTiltGuide");
    if (!guide) {
      guide = document.createElement("div");
      guide.id = "ewTiltGuide";
      guide.innerHTML = '<span>◀ ▲ ▼ ▶</span><strong id="ewTiltGuideText">ถือเครื่องนิ่งเพื่อปรับศูนย์</strong>';
      document.body.appendChild(guide);
    }
  }

  function guide(message, mode) {
    ensureGuide();
    const host = document.getElementById("ewTiltGuide");
    const text = document.getElementById("ewTiltGuideText");
    if (host) host.dataset.mode = mode || "";
    if (text) text.textContent = message;
  }

  function onOrientation(event) {
    if (!Number.isFinite(event.gamma) || !Number.isFinite(event.beta)) return;
    const tilt = state.tilt;
    tilt.sensorSeen = true;
    if (!tilt.calibrated) {
      tilt.calibrationGamma += event.gamma;
      tilt.calibrationBeta += event.beta;
      tilt.calibrationCount += 1;
      if (performance.now() - tilt.calibrationStartedAt >= CALIBRATION_MS && tilt.calibrationCount >= 4) {
        tilt.baselineGamma = tilt.calibrationGamma / tilt.calibrationCount;
        tilt.baselineBeta = tilt.calibrationBeta / tilt.calibrationCount;
        tilt.calibrated = true;
        tilt.calibrating = false;
        tilt.neutralSince = performance.now();
      }
      return;
    }
    tilt.targetX = Math.max(-24, Math.min(24, event.gamma - tilt.baselineGamma));
    tilt.targetY = Math.max(-22, Math.min(22, event.beta - tilt.baselineBeta));
  }

  function selectableCards() {
    return Array.from(document.querySelectorAll(".memory-card:not(.matched):not(.flipped):not([disabled])")).filter(card => card.getBoundingClientRect().width > 20);
  }

  function cardCenter(card) {
    const rect = card.getBoundingClientRect();
    return {x:rect.left + rect.width/2,y:rect.top + rect.height/2,rect};
  }

  function currentCard(cards) {
    return cards.find(card => card.dataset.cardId === state.tilt.focusedId) || null;
  }

  function defaultCard(cards) {
    const cx = innerWidth/2;
    const cy = innerHeight*.52;
    return cards.slice().sort((a,b) => {
      const ac = cardCenter(a), bc = cardCenter(b);
      return Math.hypot(ac.x-cx,ac.y-cy)-Math.hypot(bc.x-cx,bc.y-cy);
    })[0] || null;
  }

  function directionalCard(cards,current,direction) {
    if (!current) return defaultCard(cards);
    const origin = cardCenter(current);
    return cards.filter(card => card !== current).map(card => {
      const center = cardCenter(card);
      const dx = center.x-origin.x, dy = center.y-origin.y;
      let valid=false, forward=0, cross=0;
      if(direction==="left"){valid=dx<-12;forward=-dx;cross=Math.abs(dy);}
      if(direction==="right"){valid=dx>12;forward=dx;cross=Math.abs(dy);}
      if(direction==="up"){valid=dy<-12;forward=-dy;cross=Math.abs(dx);}
      if(direction==="down"){valid=dy>12;forward=dy;cross=Math.abs(dx);}
      return {card,valid,score:forward+cross*1.65};
    }).filter(item=>item.valid).sort((a,b)=>a.score-b.score)[0]?.card || null;
  }

  function focusCard(card,moved) {
    document.querySelectorAll(".memory-card.ew-tilt-focus").forEach(item=>item.classList.remove("ew-tilt-focus"));
    if(!card){state.tilt.focusedId="";return;}
    card.classList.add("ew-tilt-focus");
    state.tilt.focusedId=card.dataset.cardId;
    state.tilt.dwellStart=0;
    if(moved){
      state.tilt.confirmAfterMove=true;
      state.tilt.armed=false;
      navigator.vibrate?.(18);
      const rect=card.getBoundingClientRect();
      if(rect.top<86||rect.bottom>innerHeight-82) card.scrollIntoView({behavior:"smooth",block:"center"});
    }
  }

  function tiltDirection() {
    const x=state.tilt.smoothX,y=state.tilt.smoothY;
    if(Math.abs(x)<ENTER_DEG&&Math.abs(y)<ENTER_DEG)return "";
    if(Math.abs(x)>=Math.abs(y)*1.08)return x<0?"left":"right";
    return y<0?"up":"down";
  }

  function tiltLoop() {
    const tilt=state.tilt;
    tilt.smoothX+=(tilt.targetX-tilt.smoothX)*.24;
    tilt.smoothY+=(tilt.targetY-tilt.smoothY)*.24;
    const cards=selectableCards();
    if(!cards.length){tilt.raf=requestAnimationFrame(tiltLoop);return;}
    let focused=currentCard(cards);
    if(!focused){focused=defaultCard(cards);focusCard(focused,false);}else focused.classList.add("ew-tilt-focus");
    const now=performance.now();
    if(!tilt.sensorSeen){guide("กำลังรอ Motion Sensor","waiting");tilt.raf=requestAnimationFrame(tiltLoop);return;}
    if(!tilt.calibrated){guide(`ถือเครื่องนิ่งเพื่อปรับศูนย์ ${Math.min(100,Math.round((now-tilt.calibrationStartedAt)/CALIBRATION_MS*100))}%`,"calibrating");tilt.raf=requestAnimationFrame(tiltLoop);return;}

    const neutral=Math.abs(tilt.smoothX)<=RELEASE_DEG&&Math.abs(tilt.smoothY)<=RELEASE_DEG;
    if(neutral){
      if(!tilt.neutralSince)tilt.neutralSince=now;
      if(now-tilt.neutralSince>=NEUTRAL_ARM_MS)tilt.armed=true;
      if(tilt.confirmAfterMove&&tilt.armed&&now>=tilt.cooldownUntil){
        if(!tilt.dwellStart)tilt.dwellStart=now;
        const pct=Math.min(100,Math.round((now-tilt.dwellStart)/DWELL_MS*100));
        guide(`ค้างกลางเพื่อเปิด ${pct}%`,"dwell");
        if(pct>=100){
          tilt.cooldownUntil=now+MOVE_COOLDOWN_MS;
          tilt.confirmAfterMove=false;
          tilt.dwellStart=0;
          flipCard(focused.dataset.cardId);
          tilt.focusedId="";
        }
      }else if(!tilt.confirmAfterMove){
        guide("เอียงไปยังการ์ดถัดไป","ready");
      }
    }else{
      tilt.neutralSince=0;
      tilt.dwellStart=0;
      const direction=tiltDirection();
      if(direction&&tilt.armed&&now>=tilt.cooldownUntil){
        const next=directionalCard(cards,focused,direction);
        tilt.cooldownUntil=now+MOVE_COOLDOWN_MS;
        if(next)focusCard(next,true);
        else{tilt.armed=false;navigator.vibrate?.([15,40,15]);guide("ถึงขอบกระดานแล้ว คืนเครื่องสู่กลาง","edge");}
      }else if(!tilt.armed){guide("คืนเครื่องสู่กลางก่อนสั่งครั้งใหม่","return");}
    }
    tilt.raf=requestAnimationFrame(tiltLoop);
  }

  function flipCard(cardId) {
    if(state.locked)return;
    const card=state.deck.find(item=>item.cardId===cardId);
    if(!card||card.matched||card.flipped)return;
    card.flipped=true;
    state.flips+=1;
    document.querySelector(`[data-card-id="${CSS.escape(cardId)}"]`)?.classList.add("flipped");
    if(!state.first){state.first=card;setFeedback("เลือกการ์ดอีกใบเพื่อจับคู่","");return;}
    state.second=card;
    state.locked=true;
    state.pairStats[state.first.pairId].attempts+=1;
    evaluatePair();
  }

  function evaluatePair() {
    const first=state.first,second=state.second;
    const matched=first.pairId===second.pairId&&first.side!==second.side;
    if(matched){
      first.matched=second.matched=true;
      state.matched+=1;
      state.combo+=1;
      state.bestCombo=Math.max(state.bestCombo,state.combo);
      state.points+=150+Math.min(150,state.combo*20);
      state.pairStats[first.pairId].matchedAtMs=Date.now()-state.startedAt;
      [first,second].forEach(card=>{const el=document.querySelector(`[data-card-id="${CSS.escape(card.cardId)}"]`);if(el){el.classList.add("matched");el.disabled=true;}});
      setFeedback(`จับคู่ถูกต้อง! Combo ×${state.combo} 🌟`,"good");
      resetTurn(650,true);
    }else{
      state.mistakes+=1;
      state.combo=0;
      [first,second].forEach(card=>document.querySelector(`[data-card-id="${CSS.escape(card.cardId)}"]`)?.classList.add("wrong"));
      setFeedback("ยังไม่ใช่คู่เดียวกัน จำตำแหน่งแล้วลองใหม่","bad");
      resetTurn(900,false);
    }
    updateHud();
  }

  function resetTurn(delay,matched) {
    setTimeout(()=>{
      const first=state.first,second=state.second;
      if(!matched){
        [first,second].forEach(card=>{card.flipped=false;document.querySelector(`[data-card-id="${CSS.escape(card.cardId)}"]`)?.classList.remove("flipped","wrong");});
      }
      state.first=state.second=null;
      state.locked=false;
      state.tilt.focusedId="";
      state.tilt.confirmAfterMove=false;
      state.tilt.dwellStart=0;
      if(state.matched>=6)finishGame();
    },delay);
  }

  function setFeedback(message,className) {
    const el=document.getElementById("memoryFeedback");
    if(!el)return;
    el.className=`feedback${className?` ${className}`:""}`;
    el.textContent=message;
  }

  function updateHud() {
    document.getElementById("matchCount")?.replaceChildren(document.createTextNode(`${state.matched} / 6 คู่`));
    const progress=document.getElementById("matchProgress");if(progress)progress.style.width=`${Math.round(state.matched/6*100)}%`;
    document.getElementById("mistakeCount")?.replaceChildren(document.createTextNode(String(state.mistakes)));
  }

  function updateElapsed() {
    const el=document.getElementById("elapsed");if(!el||!state.startedAt)return;
    const seconds=Math.floor((Date.now()-state.startedAt)/1000);
    el.textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`;
  }

  function masteryScore() {
    return Math.max(0,10-Math.floor(state.mistakes/2));
  }

  function buildPayload() {
    return {
      playerId:state.identity.playerId,
      nickname:state.authority?.profile?.nickname||state.authority?.profile?.fullName||state.identity.nickname,
      stageId:"word_match",
      score:masteryScore(),
      total:10,
      durationMs:Date.now()-state.startedAt,
      clientPoints:state.points,
      inputMode:"tilt-snap-only",
      gameVersion:VERSION,
      answers:Object.entries(state.pairStats).map(([pairId,stat])=>({itemId:pairId,correct:true,attempts:stat.attempts,matchedAtMs:stat.matchedAtMs,level:stat.level,inputMode:"tilt-snap-only"})),
      gameMetrics:{matchedPairs:state.matched,mistakes:state.mistakes,flips:state.flips,bestCombo:state.bestCombo,pairIds:state.selectedPairs.map(pair=>pair.id),levels:state.selectedPairs.map(pair=>pair.level),controlPolicy:"one-tilt-one-snap-neutral-dwell"}
    };
  }

  async function finishGame() {
    stopAll();
    state.pending=buildPayload();
    showLoading("กำลังบันทึกผล Word Match…");
    try{
      const receipt=await Promise.race([api.submitGame(state.pending),timeout(Math.min(Number(cfg.requestTimeoutMs||12000),7000),"SUBMIT_TIMEOUT")]);
      if(!receipt?.ok||!receipt.authority)throw new Error(receipt?.error||"RECEIPT_MISSING");
      state.authority=receipt.authority;
      renderResult(receipt);
    }catch(error){renderSubmitError(error);}finally{hideLoading();}
  }

  function renderResult(receipt) {
    const score=masteryScore();
    const accuracy=score*10;
    const passed=Boolean(receipt.passed);
    root.innerHTML=shell(`<section class="result-card"><div class="hero">${passed?"🌟":"💪"}</div><h1>${passed?"ผ่าน Tilt Snap Memory!":"ยังไม่ผ่านภารกิจ"}</h1><p class="lead">${passed?"ระบบยืนยันผลและปลดล็อก Category Forest แล้ว":"ลองใหม่เพื่อรักษา Mastery อย่างน้อย 70%"}</p><div class="result-ring" style="--angle:${accuracy*3.6}deg"><div><strong>${accuracy}%</strong><small>Mastery</small></div></div><div class="metrics"><div class="metric"><strong>${state.matched}/6</strong><small>คู่สำเร็จ</small></div><div class="metric"><strong>${state.mistakes}</strong><small>เปิดผิด</small></div><div class="metric"><strong>${state.bestCombo}</strong><small>Best Combo</small></div></div><div class="notice ok">Receipt: ${h(receipt.receiptId||"SERVER-OK")}</div><div class="action-grid ${passed?"":"two"}">${passed?"":'<button id="retryBtn" class="btn secondary">เล่นใหม่</button>'}<button id="resultBackBtn" class="btn primary">กลับ Passport</button></div></section>`);
    wireNav();
    document.getElementById("retryBtn")?.addEventListener("click",startGame);
    document.getElementById("resultBackBtn").onclick=goPassport;
  }

  function renderSubmitError(error) {
    root.innerHTML=shell(`<section class="result-card"><div class="hero">📡</div><h1>ยังยืนยันผลไม่ได้</h1><p class="lead">ระบบจะไม่ปลดล็อกด่านถัดไปจนกว่าจะได้รับ Receipt</p><div class="notice error">${h(error?.message||error)}</div><div class="action-grid"><button id="retrySubmitBtn" class="btn primary">ลองส่งผลอีกครั้ง</button><button id="submitBackBtn" class="btn secondary">กลับ Passport</button></div></section>`);
    wireNav();
    document.getElementById("retrySubmitBtn").onclick=finishGame;
    document.getElementById("submitBackBtn").onclick=goPassport;
  }

  function renderSensorError() {
    stopAll();
    root.innerHTML=shell(`<section class="result-card"><div class="hero">📱</div><h1>ยังไม่พบ Motion Sensor</h1><p class="lead">ด่านนี้ใช้ Tilt Snap เท่านั้น กรุณาเปิดการอนุญาต Motion Sensor แล้วเริ่มใหม่</p><div class="notice">Chrome Android: โหลดหน้าใหม่แล้วกด “เริ่ม Tilt Snap Memory” อีกครั้ง โดยถือเครื่องนิ่งระหว่างปรับศูนย์</div><div class="action-grid"><button id="sensorReload" class="btn primary">โหลดใหม่</button><button id="sensorBack" class="btn secondary">กลับ Passport</button></div></section>`);
    wireNav();
    document.getElementById("sensorReload").onclick=()=>location.reload();
    document.getElementById("sensorBack").onclick=goPassport;
  }

  function renderLoadError(error) {
    root.innerHTML=shell(`<section class="result-card"><div class="hero">⚠️</div><h1>โหลด Word Match ไม่สำเร็จ</h1><div class="notice error">${h(error?.message||error)}</div><div class="action-grid"><button id="reloadBtn" class="btn primary">ลองโหลดอีกครั้ง</button><button id="loadBackBtn" class="btn secondary">กลับ Passport</button></div></section>`);
    wireNav();
    document.getElementById("reloadBtn").onclick=()=>location.reload();
    document.getElementById("loadBackBtn").onclick=goPassport;
  }

  async function initialize() {
    state.identity=readIdentity();
    state.assignment=rotation?.getAssignment(state.identity?.playerId)||null;
    if(!state.identity?.playerId){hideLoading();return renderNeedLogin();}
    showLoading("กำลังตรวจสถานะ Word Match Village…");
    try{
      state.authority=await resumeAuthority();
      if(!state.authority?.ok)throw new Error(state.authority?.error||"RESUME_FAILED");
      if(!state.authority.progress?.unlocked?.includes("word_match"))return renderLocked();
      renderIntro();
    }catch(error){renderLoadError(error);}finally{hideLoading();}
  }

  const style=document.createElement("style");
  style.textContent=`
    .memory-card{pointer-events:none!important}
    .memory-card.ew-tilt-focus{outline:4px solid #facc15!important;outline-offset:4px;filter:brightness(1.12);transform:translateY(-3px) scale(1.025)}
    #ewTiltGuide{position:fixed;z-index:9999;left:50%;bottom:max(12px,env(safe-area-inset-bottom));transform:translateX(-50%);display:flex;align-items:center;gap:10px;width:min(94vw,620px);padding:10px 15px;border-radius:999px;background:rgba(7,24,39,.94);color:white;box-shadow:0 12px 30px rgba(0,0,0,.28);font-size:.78rem;font-weight:900;text-align:center;pointer-events:none}
    #ewTiltGuide span{color:#facc15;letter-spacing:.18em;white-space:nowrap}#ewTiltGuide strong{flex:1}
    #ewTiltGuide[data-mode="dwell"]{background:rgba(15,92,72,.95)}#ewTiltGuide[data-mode="return"]{background:rgba(105,65,15,.95)}
  `;
  document.head.appendChild(style);
  window.addEventListener("pagehide",stopAll);
  window.addEventListener("beforeunload",stopAll);
  initialize();
}());