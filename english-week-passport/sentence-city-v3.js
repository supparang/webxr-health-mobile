(function () {
  "use strict";

  const VERSION = "2026-08-06-SENTENCE-CITY-SKYLINE-V3";
  const STAGE_ID = "sentence_city";
  const cfg = window.EW_CONFIG || { cacheKeys: { identity: "ew_passport_identity_v1" } };
  const rotation = window.EW_ROTATION || null;
  const screen = document.getElementById("screen");
  const backBtn = document.getElementById("backBtn");
  const soundBtn = document.getElementById("soundBtn");
  const params = new URLSearchParams(location.search);

  const BANK = Object.freeze([
    { id:"sc01", kind:"Fill the Gap", level:"A2", visual:"💧", prompt:"Students should ___ enough water during hot weather.", tokens:["drink","repair","borrow","paint"], answer:["drink"], hint:"Use the verb that commonly goes with water." },
    { id:"sc02", kind:"Word Order", level:"A2", visual:"🔒", prompt:"Build the correct instruction.", tokens:["your password","Please","private","keep"], answer:["Please","keep","your password","private"], hint:"Begin the instruction with Please." },
    { id:"sc03", kind:"Repair", level:"A2", visual:"♻️", prompt:"Repair: We should reducing plastic waste.", tokens:["We","should","reduce","plastic waste"], answer:["We","should","reduce","plastic waste"], hint:"Use the base verb after should." },
    { id:"sc04", kind:"Fill the Gap", level:"A2", visual:"🚸", prompt:"Always ___ both sides before crossing the road.", tokens:["check","cook","collect","design"], answer:["check"], hint:"Choose the safety action before crossing." },
    { id:"sc05", kind:"Word Order", level:"A2", visual:"🏫", prompt:"Build the sentence about English Week.", tokens:["starts","English Week","on Monday"], answer:["English Week","starts","on Monday"], hint:"Start with the event." },
    { id:"sc06", kind:"Context", level:"A2", visual:"🧳", prompt:"Complete the travel instruction.", tokens:["Keep","your ticket","in a safe place"], answer:["Keep","your ticket","in a safe place"], hint:"Use an imperative sentence." },

    { id:"sc07", kind:"Fill the Gap", level:"A2+", visual:"📝", prompt:"You need to ___ the application form before Friday.", tokens:["submit","climb","mix","throw"], answer:["submit"], hint:"Choose the verb for sending a form officially." },
    { id:"sc08", kind:"Word Order", level:"A2+", visual:"🏛️", prompt:"Build the sentence about a museum tour.", tokens:["at 10 a.m.","the museum tour","will begin","The guide"], answer:["The guide","will begin","the museum tour","at 10 a.m."], hint:"Start with The guide." },
    { id:"sc09", kind:"Repair", level:"A2+", visual:"📚", prompt:"Repair: This app helps students practicing vocabulary.", tokens:["This app","helps students","practice","new vocabulary"], answer:["This app","helps students","practice","new vocabulary"], hint:"Use the base verb after helps students." },
    { id:"sc10", kind:"Fill the Gap", level:"A2+", visual:"🌦️", prompt:"The weather report will help us ___ our trip.", tokens:["plan","taste","fold","translate"], answer:["plan"], hint:"Choose the verb used before a trip." },
    { id:"sc11", kind:"Word Order", level:"A2+", visual:"💬", prompt:"Build the correct question.", tokens:["this word","Can you","in a sentence","use"], answer:["Can you","use","this word","in a sentence"], hint:"Begin with Can you." },
    { id:"sc12", kind:"Context", level:"A2+", visual:"🤝", prompt:"Build a polite request for teamwork.", tokens:["Could you","help me","with this task","please"], answer:["Could you","help me","with this task","please"], hint:"Begin with Could you." },

    { id:"sc13", kind:"Fill the Gap", level:"B1", visual:"💡", prompt:"Our team will ___ ideas before choosing the best one.", tokens:["share","melt","lock","deliver"], answer:["share"], hint:"Choose the verb used when exchanging ideas." },
    { id:"sc14", kind:"Word Order", level:"B1", visual:"🌱", prompt:"Build a sentence about environmental responsibility.", tokens:["to reduce waste","everyone","should take action"], answer:["everyone","should take action","to reduce waste"], hint:"Start with the subject everyone." },
    { id:"sc15", kind:"Repair", level:"B1", visual:"🏆", prompt:"Repair: The school will organized an English competition.", tokens:["The school","will organize","an English competition","next week"], answer:["The school","will organize","an English competition","next week"], hint:"Use the base verb after will." },
    { id:"sc16", kind:"Fill the Gap", level:"B1", visual:"🔐", prompt:"A strong password can ___ your account from unauthorized access.", tokens:["protect","invite","measure","borrow"], answer:["protect"], hint:"Choose the verb meaning keep safe." },
    { id:"sc17", kind:"Word Order", level:"B1", visual:"📊", prompt:"Build a sentence about using feedback.", tokens:["can improve","constructive feedback","your performance"], answer:["constructive feedback","can improve","your performance"], hint:"Start with constructive feedback." },
    { id:"sc18", kind:"Context", level:"B1", visual:"🧭", prompt:"Build the most logical travel recommendation.", tokens:["Before departure","check","your itinerary","carefully"], answer:["Before departure","check","your itinerary","carefully"], hint:"Place the time phrase first." },

    { id:"sc19", kind:"Fill the Gap", level:"B1+", visual:"🌍", prompt:"Communities must ___ sustainable solutions to environmental problems.", tokens:["develop","cancel","hide","separate"], answer:["develop"], hint:"Choose the verb meaning create and improve." },
    { id:"sc20", kind:"Word Order", level:"B1+", visual:"🤖", prompt:"Build a sentence expressing a condition and result.", tokens:["students can learn more effectively","is used responsibly","If technology"], answer:["If technology","is used responsibly","students can learn more effectively"], hint:"Begin with the If-clause." },
    { id:"sc21", kind:"Repair", level:"B1+", visual:"🧠", prompt:"Repair: Although the task was challenging, but the team completed it.", tokens:["Although the task was challenging","the team","completed it","successfully"], answer:["Although the task was challenging","the team","completed it","successfully"], hint:"Do not use but after Although." },
    { id:"sc22", kind:"Fill the Gap", level:"B1+", visual:"🗣️", prompt:"Clear communication helps prevent ___ during collaborative work.", tokens:["misunderstandings","destinations","ingredients","departures"], answer:["misunderstandings"], hint:"Choose the noun for incorrect understanding." },
    { id:"sc23", kind:"Word Order", level:"B1+", visual:"♻️", prompt:"Build a sentence showing cause and effect.", tokens:["because it reduces waste","Recycling is important","and saves resources"], answer:["Recycling is important","because it reduces waste","and saves resources"], hint:"State the main idea before the reason." },
    { id:"sc24", kind:"Context", level:"B1+", visual:"🎯", prompt:"Build a recommendation based on evidence.", tokens:["Based on the survey results","the school should","extend the activity","next year"], answer:["Based on the survey results","the school should","extend the activity","next year"], hint:"Begin with the evidence phrase." }
  ]);

  const KIND_QUOTA = Object.freeze({ "Fill the Gap":3, "Word Order":3, Repair:2, Context:2 });
  const LEVEL_TARGET = Object.freeze({ A2:3, "A2+":3, B1:2, "B1+":2 });
  const BUILDING_HEIGHTS = [29,41,34,48,38,55,43,60,50,65];

  function clean(value) { return String(value == null ? "" : value).trim(); }
  function h(value) {
    return clean(value).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  }
  function hash32(value) {
    const input = clean(value); let hash = 0x811c9dc5;
    for (let i=0;i<input.length;i+=1) { hash ^= input.charCodeAt(i); hash = Math.imul(hash,0x01000193); }
    return hash >>> 0;
  }
  function mix32(value) {
    let x = Number(value) >>> 0; x ^= x >>> 16; x = Math.imul(x,0x7feb352d); x ^= x >>> 15; x = Math.imul(x,0x846ca68b); x ^= x >>> 16; return x >>> 0;
  }
  function mulberry32(seed) {
    let state = Number(seed) >>> 0;
    return function () { state += 0x6d2b79f5; let value = state; value = Math.imul(value ^ value >>> 15,value|1); value ^= value + Math.imul(value ^ value >>> 7,value|61); return ((value ^ value >>> 14) >>> 0) / 4294967296; };
  }
  function fallbackAssignment(playerId) {
    const randomSeed = mix32(hash32(`${playerId}|${STAGE_ID}|${VERSION}`));
    return Object.freeze({ playerId, passportRotation:["P1","P2","P3","P4"][randomSeed%4], assessmentRotation:["R1","R2"][(randomSeed>>>8)%2], randomSeed, randomSeedHex:randomSeed.toString(16).padStart(8,"0"), assignmentVersion:"sentence-fallback-v1", assignmentLocked:true });
  }
  function readCachedIdentity() {
    try { return JSON.parse(localStorage.getItem(cfg.cacheKeys?.identity || "ew_passport_identity_v1") || "null"); }
    catch (_) { return null; }
  }
  function qaIdentity() {
    const key = "ew_sentence_city_qa_identity_v1";
    try {
      let playerId = localStorage.getItem(key);
      if (!playerId) { playerId = `QA-SC-${Math.random().toString(36).slice(2,8).toUpperCase()}`; localStorage.setItem(key,playerId); }
      return { playerId, nickname:"Mobile QA" };
    } catch (_) { return { playerId:"QA-SC-001", nickname:"Mobile QA" }; }
  }

  const cached = readCachedIdentity();
  const qa = qaIdentity();
  const identity = Object.freeze({
    playerId: clean(params.get("playerId") || params.get("pid") || cached?.playerId || qa.playerId),
    nickname: clean(params.get("nickname") || params.get("name") || cached?.nickname || cached?.fullName || qa.nickname)
  });
  const assignment = rotation?.getAssignment(identity.playerId) || fallbackAssignment(identity.playerId);

  function seedFor(suffix) { return mix32(hash32(`${assignment.randomSeed}|${assignment.passportRotation}|${STAGE_ID}|${suffix}|${VERSION}`)); }
  function order(values,suffix) {
    const output = Array.from(values || []); const random = mulberry32(seedFor(suffix));
    for (let i=output.length-1;i>0;i-=1) { const j = Math.floor(random()*(i+1)); [output[i],output[j]]=[output[j],output[i]]; }
    return output;
  }

  function selectTasks() {
    const remaining = { ...LEVEL_TARGET };
    const selected = [];
    Object.entries(KIND_QUOTA).forEach(([kind,count]) => {
      const pool = order(BANK.filter(item => item.kind === kind),`pool:${kind}`);
      for (let slot=0;slot<count;slot+=1) {
        const candidates = pool.filter(item => !selected.some(chosen => chosen.id === item.id));
        const preferred = candidates.filter(item => remaining[item.level] > 0);
        const source = preferred.length ? preferred : candidates;
        source.sort((a,b) => (remaining[b.level]||0) - (remaining[a.level]||0));
        const choice = source[0];
        if (!choice) continue;
        selected.push(choice);
        remaining[choice.level] = Math.max(0,(remaining[choice.level]||0)-1);
      }
    });
    return order(selected,"mission-order");
  }

  const missionTasks = selectTasks();
  const wordSetId = `${assignment.passportRotation}-SC-${seedFor("word-set").toString(16).padStart(8,"0")}`;
  const returnUrl = params.get("from") === "passport" ? "./index.html?resume=1" : "./game-test-hub.html?v=20260806-scv3";

  const state = {
    phase:"main", mainTasks:missionTasks, tasks:missionTasks, index:0, items:[], placed:[], selected:null,
    records:{}, events:[], missed:new Map(), firstTryCorrect:0, repairTotal:0, repairCorrect:0,
    points:0, combo:0, bestCombo:0, rushBonus:0, hintsUsed:0, speechCount:0, autoSpeechCount:0, replaySpeechCount:0,
    taskStartedAt:0, startedAt:0, dragCount:0, tapCount:0, reorderCount:0, sound:true, locked:false,
    buildStatus:Array(10).fill(""), autoSpeakTimer:0, ghost:null
  };

  function shell(content) { screen.innerHTML = `<section class="panel">${content}</section>`; }
  function goBack() { clearTimeout(state.autoSpeakTimer); window.speechSynthesis?.cancel?.(); location.href = returnUrl; }
  backBtn.addEventListener("click",goBack);
  soundBtn.addEventListener("click",() => {
    state.sound = !state.sound;
    soundBtn.textContent = state.sound ? "🔊" : "🔇";
    if (!state.sound) { clearTimeout(state.autoSpeakTimer); window.speechSynthesis?.cancel?.(); }
  });

  function intro() {
    shell(`<div class="intro"><div class="city-mark">🏙️🏗️</div><div class="series">LEXICON X CHALLENGE • GAME 3</div><h1>Sentence City</h1><h2>Skyline Builder • เมืองสร้างประโยค</h2><p class="lead">ลากบล็อกคำลงแบบแปลน จัดลำดับให้ถูกต้อง แล้วเปิดไฟตึกทั่วเมือง</p><div class="feature-row"><div class="feature"><b>🏗️</b>สร้างตึกด้วยประโยค</div><div class="feature"><b>🔊</b>ฟังโจทย์และประโยค</div><div class="feature"><b>🛠️</b>City Repair Crew</div></div><div class="notice"><strong>4 รูปแบบภารกิจ</strong><br>Fill the Gap • Word Order • Repair • Context</div><div class="mission-note">Mission Set ${assignment.passportRotation} • ${wordSetId} • CEFR A2–B1+</div><div class="actions"><button id="startBtn" class="btn primary">Start Skyline Mission</button><button id="homeBtn" class="btn secondary">Back to Test Hub</button></div></div>`);
    document.getElementById("startBtn").onclick = startGame;
    document.getElementById("homeBtn").onclick = goBack;
  }

  function startGame() {
    Object.assign(state,{
      phase:"main", tasks:state.mainTasks, index:0, items:[], placed:[], selected:null, records:{}, events:[], missed:new Map(),
      firstTryCorrect:0, repairTotal:0, repairCorrect:0, points:0, combo:0, bestCombo:0, rushBonus:0, hintsUsed:0,
      speechCount:0, autoSpeechCount:0, replaySpeechCount:0, taskStartedAt:0, startedAt:Date.now(), dragCount:0,
      tapCount:0, reorderCount:0, locked:false, buildStatus:Array(10).fill("")
    });
    renderGame();
    showTask();
  }

  function renderGame() {
    shell(`<div class="game"><div class="game-head"><span id="modeChip" class="mode-chip">BUILD</span><div class="game-title">Skyline Builder Mission</div><span class="set-chip">${h(assignment.passportRotation)} • ${h(wordSetId.slice(-6))}</span></div><div class="hud"><div class="stat"><small id="progressLabel">BUILDING</small><strong id="progressText">1 / 10</strong><div class="progress"><span id="progressFill"></span></div></div><div class="stat"><small>SCORE</small><strong id="scoreText">0</strong></div><div class="stat"><small>COMBO</small><strong id="comboText">×1</strong></div></div><div class="skyline"><div class="moon"></div><div id="crane" class="crane">🏗️</div><div id="buildings" class="buildings">${BUILDING_HEIGHTS.map((height,index)=>`<i class="building" data-building="${index}" style="--h:${height}px"></i>`).join("")}</div><div class="road"></div><div id="cityEnergy" class="city-energy">CITY ENERGY 0%</div></div><div class="play"><section id="mission" class="mission"></section></div></div>`);
  }

  function currentTask() { return state.tasks[state.index]; }
  function currentRecord() {
    const task = currentTask();
    if (!state.records[`${state.phase}:${task.id}`]) {
      state.records[`${state.phase}:${task.id}`] = { attempts:0, hintUsed:false, wrongAttempts:0 };
    }
    return state.records[`${state.phase}:${task.id}`];
  }

  function setupTask(task) {
    state.items = order(task.tokens.map((label,index)=>({ id:`${task.id}-${index}`, label })),`${state.phase}:${task.id}:tokens`);
    state.placed = Array(task.answer.length).fill(null);
    state.selected = null;
    state.taskStartedAt = performance.now();
    state.dragCount = 0;
    state.tapCount = 0;
    state.reorderCount = 0;
    state.locked = false;
  }

  function showTask() {
    if (state.index >= state.tasks.length) {
      if (state.phase === "main" && state.missed.size) return beginRepair();
      return finish();
    }
    const task = currentTask();
    setupTask(task);
    const mission = document.getElementById("mission");
    const rush = state.phase === "main" && state.index >= 5 && state.index <= 7;
    mission.innerHTML = `<div class="task-top"><span class="task-chip">${h(task.kind)}</span><span class="level-chip">CEFR ${h(task.level)}</span></div><div class="prompt"><span class="visual">${task.visual}</span><h3>${h(task.prompt)}</h3><button id="speakTask" class="speak-task" type="button" aria-label="ฟังโจทย์ซ้ำ">🔊</button></div><div id="instruction" class="instruction">ลากบล็อกคำลงช่องก่อสร้าง หรือแตะบล็อกแล้วแตะช่อง</div><div class="blueprint"><div class="blueprint-label">SENTENCE BLUEPRINT</div><div id="slots" class="slots"></div></div><div class="depot-title">WORD DEPOT</div><div id="depot" class="depot"></div><div class="action-row"><button id="checkBtn" class="btn primary">Build Sentence</button><button id="hintBtn" class="hint-btn">Hint</button></div>`;
    document.getElementById("speakTask").onclick = event => { event.stopPropagation(); speakTask(false); };
    document.getElementById("checkBtn").onclick = checkAnswer;
    document.getElementById("hintBtn").onclick = showHint;
    if (state.phase === "repair") {
      document.getElementById("instruction").textContent = `🛠️ Repair Crew • ${task.hint}`;
      document.getElementById("hintBtn").disabled = true;
    } else if (rush) {
      document.getElementById("instruction").textContent = "⚡ CITY RUSH • สร้างถูกตั้งแต่ครั้งแรกเพื่อรับ Time Bonus";
    }
    renderBoard();
    updateHud();
    clearTimeout(state.autoSpeakTimer);
    state.autoSpeakTimer = setTimeout(() => speakTask(true),300);
  }

  function renderBoard() {
    const slots = document.getElementById("slots");
    const depot = document.getElementById("depot");
    if (!slots || !depot) return;
    slots.innerHTML = state.placed.map((item,index) => `<button class="sentence-slot${item?" filled":""}${state.selected?.type==="slot"&&state.selected.index===index?" target":""}" type="button" data-slot="${index}"><span class="slot-index">${index+1}</span>${item?h(item.label):"วางคำ"}${item?`<span class="slot-remove" data-remove="${index}">×</span>`:""}</button>`).join("");
    const used = new Set(state.placed.filter(Boolean).map(item=>item.id));
    depot.innerHTML = state.items.map(item => `<button class="word-chip${used.has(item.id)?" used":""}${state.selected?.type==="depot"&&state.selected.id===item.id?" selected":""}" type="button" data-token="${h(item.id)}">${h(item.label)}</button>`).join("");

    depot.querySelectorAll(".word-chip").forEach(element => {
      const item = state.items.find(value => value.id === element.dataset.token);
      bindPointer(element,{ type:"depot", id:item.id, label:item.label });
    });
    slots.querySelectorAll(".sentence-slot").forEach(element => {
      const index = Number(element.dataset.slot);
      element.addEventListener("click",event => {
        if (event.target.closest("[data-remove]")) return;
        handleSlotTap(index);
      });
      if (state.placed[index]) bindPointer(element,{ type:"slot", index, id:state.placed[index].id, label:state.placed[index].label });
    });
    slots.querySelectorAll("[data-remove]").forEach(element => {
      element.addEventListener("click",event => { event.stopPropagation(); if (state.locked) return; state.placed[Number(element.dataset.remove)] = null; state.selected = null; state.tapCount += 1; renderBoard(); });
    });
  }

  function bindPointer(element,source) {
    let pointerId = null; let startX = 0; let startY = 0; let moved = false; let ghost = null;
    element.addEventListener("pointerdown",event => {
      if (state.locked || event.target.closest("[data-remove]")) return;
      event.preventDefault(); pointerId = event.pointerId; startX = event.clientX; startY = event.clientY; moved = false;
      element.setPointerCapture?.(pointerId);
    });
    element.addEventListener("pointermove",event => {
      if (pointerId !== event.pointerId) return;
      const distance = Math.hypot(event.clientX-startX,event.clientY-startY);
      if (!moved && distance > 7) {
        moved = true; ghost = document.createElement("div"); ghost.className = "drag-ghost"; ghost.textContent = source.label; document.body.appendChild(ghost);
      }
      if (ghost) { ghost.style.left = `${event.clientX}px`; ghost.style.top = `${event.clientY}px`; highlightSlot(event.clientX,event.clientY); }
    });
    const end = event => {
      if (pointerId !== event.pointerId) return;
      if (ghost) ghost.remove(); ghost = null; clearSlotHighlight();
      if (moved) {
        const target = slotAt(event.clientX,event.clientY);
        if (target !== null) { dropSource(source,target); state.dragCount += 1; }
      } else if (source.type === "depot") {
        state.tapCount += 1; state.selected = state.selected?.type === "depot" && state.selected.id === source.id ? null : source; renderBoard();
      }
      pointerId = null;
    };
    element.addEventListener("pointerup",end);
    element.addEventListener("pointercancel",end);
  }

  function slotAt(x,y) {
    const element = document.elementFromPoint(x,y)?.closest?.(".sentence-slot");
    return element ? Number(element.dataset.slot) : null;
  }
  function highlightSlot(x,y) {
    const index = slotAt(x,y);
    document.querySelectorAll(".sentence-slot").forEach(element => element.classList.toggle("target",Number(element.dataset.slot)===index));
  }
  function clearSlotHighlight() { document.querySelectorAll(".sentence-slot").forEach(element => element.classList.remove("target")); }

  function dropSource(source,targetIndex) {
    if (state.locked) return;
    if (source.type === "depot") {
      const item = state.items.find(value => value.id === source.id);
      if (!item) return;
      const previousIndex = state.placed.findIndex(value => value?.id === item.id);
      if (previousIndex >= 0) state.placed[previousIndex] = null;
      state.placed[targetIndex] = item;
    } else {
      const sourceIndex = Number(source.index);
      if (sourceIndex === targetIndex) return;
      [state.placed[sourceIndex],state.placed[targetIndex]] = [state.placed[targetIndex],state.placed[sourceIndex]];
      state.reorderCount += 1;
    }
    state.selected = null;
    renderBoard();
  }

  function handleSlotTap(index) {
    if (state.locked) return;
    state.tapCount += 1;
    if (state.selected?.type === "depot") return dropSource(state.selected,index);
    if (state.selected?.type === "slot") return dropSource(state.selected,index);
    const item = state.placed[index];
    state.selected = item ? { type:"slot", index, id:item.id, label:item.label } : null;
    renderBoard();
  }

  function normalize(parts) { return parts.join(" ").replace(/[?.!,]/g,"").replace(/\s+/g," ").trim().toLowerCase(); }
  function feedback(message,type="") {
    const element = document.getElementById("instruction");
    if (!element) return;
    element.className = `instruction${type?` ${type}`:""}`;
    element.innerHTML = message;
  }
  function showHint() {
    if (state.locked) return;
    const record = currentRecord();
    if (!record.hintUsed) { record.hintUsed = true; state.hintsUsed += 1; }
    feedback(`<strong>💡 Hint:</strong> ${h(currentTask().hint)}`);
    document.getElementById("hintBtn").disabled = true;
  }

  function checkAnswer() {
    if (state.locked) return;
    if (state.placed.some(item => !item)) return feedback("ยังวางบล็อกไม่ครบทุกช่อง","bad");
    const task = currentTask();
    const record = currentRecord();
    record.attempts += 1;
    const answer = state.placed.map(item=>item.label);
    const correct = normalize(answer) === normalize(task.answer);
    const decisionMs = Math.round(performance.now()-state.taskStartedAt);
    state.events.push({
      phase:state.phase,itemId:task.id,kind:task.kind,level:task.level,attempt:record.attempts,selected:answer.join(" "),
      correct,expected:task.answer.join(" "),decisionMs,dragCount:state.dragCount,tapCount:state.tapCount,reorderCount:state.reorderCount,hintUsed:record.hintUsed
    });

    if (!correct) {
      record.wrongAttempts += 1; state.combo = 0;
      if (state.phase === "main") state.missed.set(task.id,task);
      feedback("<strong>โครงสร้างยังไม่ถูกต้อง</strong> • ลองสลับบล็อกหรือใช้ Hint","bad");
      const mission = document.getElementById("mission"); mission.classList.remove("shake"); void mission.offsetWidth; mission.classList.add("shake");
      updateHud(); return;
    }

    state.locked = true;
    const firstTry = record.attempts === 1;
    let gain = state.phase === "repair" ? 60 : firstTry ? 150 + state.combo*20 : 80;
    if (state.phase === "main") {
      if (firstTry) { state.firstTryCorrect += 1; state.combo += 1; state.bestCombo = Math.max(state.bestCombo,state.combo); }
      else state.combo = 0;
      const rush = state.index >= 5 && state.index <= 7;
      if (rush && firstTry) { const bonus = Math.max(0,Math.round((20000-decisionMs)/1000)*10); gain += bonus; state.rushBonus += bonus; }
      state.buildStatus[state.index] = firstTry ? "lit" : "fixed";
    } else {
      state.repairCorrect += 1;
    }
    state.points += gain;
    feedback(`<strong>✓ Sentence complete!</strong> +${gain} • อาคารเปิดไฟแล้ว ✨`,`good`);
    floatScore(`+${gain}`);
    speakSentence(task.answer.join(" "));
    updateHud();
    setTimeout(() => { state.index += 1; showTask(); },900);
  }

  function floatScore(text) {
    const element = document.createElement("div"); element.className = "float-score"; element.textContent = text;
    element.style.left = "50%"; element.style.top = "46%"; document.body.appendChild(element); setTimeout(()=>element.remove(),850);
  }

  function speak(text,auto) {
    if (!state.sound || !window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "en-US"; utterance.rate = .84; utterance.pitch = 1;
    state.speechCount += 1; if (auto) state.autoSpeechCount += 1; else state.replaySpeechCount += 1;
    window.speechSynthesis.speak(utterance);
  }
  function speakTask(auto) { speak(currentTask()?.prompt.replace("___","blank"),auto); }
  function speakSentence(sentence) { speak(sentence,true); }

  function updateHud() {
    const total = state.phase === "main" ? 10 : state.tasks.length;
    const done = state.phase === "main" ? state.index : state.index;
    const progressText = document.getElementById("progressText");
    if (!progressText) return;
    document.getElementById("progressLabel").textContent = state.phase === "repair" ? "REPAIR" : "BUILDING";
    progressText.textContent = `${Math.min(state.index+1,total)} / ${total}`;
    document.getElementById("progressFill").style.width = `${Math.round(done/Math.max(1,total)*100)}%`;
    document.getElementById("scoreText").textContent = state.points;
    document.getElementById("comboText").textContent = `×${Math.max(1,state.combo)}`;
    const mode = document.getElementById("modeChip");
    const rush = state.phase === "main" && state.index >= 5 && state.index <= 7;
    mode.className = `mode-chip${state.phase==="repair"?" repair":rush?" rush":""}`;
    mode.textContent = state.phase === "repair" ? "REPAIR" : rush ? "RUSH" : "BUILD";
    const percent = state.phase === "main" ? Math.round(state.buildStatus.filter(Boolean).length/10*100) : 100;
    document.getElementById("cityEnergy").textContent = `CITY ENERGY ${percent}%`;
    document.getElementById("crane").style.left = `${8 + Math.min(9,state.buildStatus.filter(Boolean).length)*8.6}%`;
    document.querySelectorAll(".building").forEach((building,index) => {
      building.classList.toggle("lit",state.buildStatus[index] === "lit");
      building.classList.toggle("fixed",state.buildStatus[index] === "fixed");
    });
  }

  function beginRepair() {
    state.phase = "repair";
    state.tasks = order([...state.missed.values()],"repair-order");
    state.repairTotal = state.tasks.length;
    state.repairCorrect = 0;
    state.index = 0;
    state.combo = 0;
    showTask();
  }

  function finish() {
    clearTimeout(state.autoSpeakTimer); window.speechSynthesis?.cancel?.();
    const durationMs = Date.now()-state.startedAt;
    const first = Math.round(state.firstTryCorrect/10*100);
    const repairRate = state.repairTotal ? Math.round(state.repairCorrect/state.repairTotal*100) : 100;
    const mastery = state.repairTotal ? repairRate === 100 ? 100 : first : 100;
    const rank = first >= 90 ? "S" : first >= 80 ? "A" : first >= 70 ? "B" : "C";
    shell(`<div class="summary"><div class="series">LEXICON X CHALLENGE • GAME 3</div><div class="rank">${rank}</div><h1>Skyline Complete!</h1><h2>Sentence City • Skyline Builder</h2>${state.repairTotal?`<div class="repair-banner">CITY REPAIR CREW • ${state.repairCorrect}/${state.repairTotal}</div>`:`<div class="perfect">PERFECT SKYLINE</div>`}<div class="summary-grid"><div class="stat"><small>FIRST-TRY</small><strong>${first}%</strong></div><div class="stat"><small>FINAL MASTERY</small><strong>${mastery}%</strong></div><div class="stat"><small>SCORE</small><strong>${state.points}</strong></div><div class="stat"><small>BEST COMBO</small><strong>×${Math.max(1,state.bestCombo)}</strong></div><div class="stat"><small>RUSH BONUS</small><strong>+${state.rushBonus}</strong></div><div class="stat"><small>MISSION SET</small><strong>${h(assignment.passportRotation)}</strong></div></div><div class="learning-card"><strong>ผลการสร้างเมือง</strong><br>สร้างถูกตั้งแต่ครั้งแรก ${state.firstTryCorrect} จาก 10 อาคาร${state.repairTotal?`<br>ซ่อมประโยคที่พลาดสำเร็จ ${state.repairCorrect} จาก ${state.repairTotal} ภารกิจ`:"<br>ไม่ต้องเรียกทีมซ่อม — ยอดเยี่ยมมาก!"}<br><span style="color:#9facdb">เวลา ${Math.floor(durationMs/60000)}:${String(Math.floor(durationMs/1000)%60).padStart(2,"0")} • ฟังเสียง ${state.speechCount} ครั้ง • Set ${h(wordSetId)}</span></div><div class="notice">โหมดทดสอบ • ยังไม่ส่งผลเข้า Firebase</div><div class="summary-actions"><button id="againBtn" class="btn primary">Build Another Skyline</button><button id="doneBtn" class="btn secondary">Back to Test Hub</button></div></div>`);
    document.getElementById("againBtn").onclick = startGame;
    document.getElementById("doneBtn").onclick = goBack;
    window.SENTENCE_CITY_LAST_RESULT = Object.freeze({
      version:VERSION,playerId:identity.playerId,passportRotation:assignment.passportRotation,wordSetId,
      itemOrder:state.mainTasks.map(task=>task.id),firstTryCorrect:state.firstTryCorrect,firstTryAccuracy:first,
      finalMastery:mastery,repairTotal:state.repairTotal,repairCorrect:state.repairCorrect,score:state.points,bestCombo:state.bestCombo,
      rushBonus:state.rushBonus,hintsUsed:state.hintsUsed,autoSpeechCount:state.autoSpeechCount,replaySpeechCount:state.replaySpeechCount,
      durationMs,events:state.events
    });
  }

  window.SENTENCE_CITY = Object.freeze({ version:VERSION, identity, assignment, wordSetId, tasks:missionTasks, state });
  intro();
}());
