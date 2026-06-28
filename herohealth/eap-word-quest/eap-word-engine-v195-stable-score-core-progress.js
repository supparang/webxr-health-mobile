/* =========================================================
   EAP Word Quest • Core Summary + Arc Path Guide
   File: /herohealth/eap-word-quest/eap-word-engine-v195-stable-score-core-progress.js
   Runtime Version: v2.0.3-SUMMARY-ARC-PATH-DEDUPE-122

   Fix:
   - Keep one Arc Path card only; remove v202 duplicate cards.
   - Preserve Core XP, Combo, Weak Words and pass truth.
   - Explain in Thai when a replay is lower than an already-passed best run.
========================================================= */

(() => {
  "use strict";

  const VERSION = "v2.0.3-SUMMARY-ARC-PATH-DEDUPE-122";
  const BOSS_IDS = new Set(["BG1","BG2","BG3","BG4","BG5"]);
  const ARCS = [
    { id:"ARC1", title:"Foundation Arc", sessions:["S1","S2","S3"], boss:"BG1" },
    { id:"ARC2", title:"Evidence Arc", sessions:["S4","S5","S6"], boss:"BG2" },
    { id:"ARC3", title:"Academic Writing Arc", sessions:["S7","S8","S9"], boss:"BG3" },
    { id:"ARC4", title:"Professional Academic Communication", sessions:["S10","S11","S12"], boss:"BG4" },
    { id:"ARC5", title:"Global Academic Communication", sessions:["S13","S14","S15"], boss:"BG5" }
  ];

  if (window.__EAP_WORD_V203_SUMMARY_PATH__) return;
  window.__EAP_WORD_V203_SUMMARY_PATH__ = true;

  const $ = id => document.getElementById(id);
  const norm = value => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  const num = (value,fallback=0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));

  function threshold(sessionId){
    if(sessionId === "BG5") return 75;
    return BOSS_IDS.has(norm(sessionId)) ? 70 : 60;
  }

  function markLogger(){
    const logger = window.logEapWordQuestResult;
    if(typeof logger !== "function") return false;
    ["__eapV190Wrapped","__eapV195Wrapped","__eapV193Wrapped","__eapV194Wrapped"].forEach(key => logger[key] = true);
    logger.__eapV203Marked = true;
    return true;
  }

  function sourceResult(){
    return window.EAP_V196_LAST_RESULT ||
      window.EAP_V195_LAST_RESULT ||
      window.EAP_V192_LAST_RESULT ||
      window.EAP_V203_LAST_RESULT ||
      null;
  }

  function normalizeResult(input){
    const source = input && typeof input === "object" ? input : {};
    const correct = Math.max(0,num(source.correct));
    const total = Math.max(1,num(source.total,1));
    const accuracy = clamp(Math.round(num(source.accuracy,(correct / total) * 100)),0,100);
    const sessionId = norm(source.sessionId) || "S1";
    const maxCombo = correct > 0 ? Math.max(1,num(source.maxCombo)) : 0;
    const passed = Boolean(source.passed || accuracy >= threshold(sessionId));
    const storedXp = Math.max(0,num(source.score),num(source.xp));
    const base = Math.max(storedXp,correct * 60);
    const comboBonus = maxCombo >= 2 ? Math.min(90,(maxCombo - 1) * 15 + (maxCombo >= 4 ? 20 : 0)) : 0;
    const passBonus = passed ? (BOSS_IDS.has(sessionId) ? 220 : 140) : 0;
    const noHintBonus = passed && Math.max(num(source.hintUsed),num(source.hintsUsed)) === 0 ? 30 : 0;
    const perfectBonus = accuracy === 100 ? (BOSS_IDS.has(sessionId) ? 160 : 100) : 0;
    const xp = storedXp > 0 ? storedXp : base + comboBonus + passBonus + noHintBonus + perfectBonus;
    return Object.assign({},source,{ correct,total,accuracy,sessionId,maxCombo,passed,xp,score:xp,rewardBreakdown:{base,xp} });
  }

  function summaryRoot(){
    const screen = $("summaryScreen");
    if(screen && screen.classList.contains("active")) return screen.querySelector(".summary-card") || screen;
    return null;
  }

  function setStat(root,label,value){
    const wanted = norm(label).toLowerCase();
    Array.from(root.querySelectorAll(".summary-stat,.stat,.mini")).forEach(card => {
      if(!norm(card.textContent).toLowerCase().includes(wanted)) return;
      const node = card.querySelector("b,strong,.value");
      if(node) node.textContent = String(value);
    });
  }

  function injectStyle(){
    if($("eapV203Style")) return;
    const style = document.createElement("style");
    style.id = "eapV203Style";
    style.textContent = `
      #eapV203RewardBox,#eapV203PathBox{margin:12px 0;border-radius:16px;padding:12px 14px;line-height:1.5;font-weight:850}
      #eapV203RewardBox{border:1px solid #bbf7d0;background:linear-gradient(135deg,#ecfdf5,#eff6ff);color:#14532d}
      #eapV203PathBox{border:1px solid #c7d2fe;background:#f8faff;color:#312e81}
      #eapV203RewardBox b{color:#166534} #eapV203PathBox b{color:#3730a3}
      .eap203-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      .eap203-chip{display:inline-flex;align-items:center;border:1px solid #c7d2fe;background:#fff;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:950;color:#3730a3}
      .eap203-chip.good{border-color:#bbf7d0;color:#166534}
    `;
    document.head.appendChild(style);
  }

  function sessionTitle(sessionId){
    if(BOSS_IDS.has(sessionId) && typeof window.getEapCoreBoss === "function"){
      const boss = window.getEapCoreBoss(sessionId);
      if(boss && boss.title) return boss.title;
    }
    if(typeof window.getEapCoreSession === "function"){
      const session = window.getEapCoreSession(sessionId);
      if(session && session.title) return session.title;
    }
    return sessionId;
  }

  function stateSnapshot(){
    try{
      const snapshot = typeof window.inspectEapV196 === "function" ? window.inspectEapV196() : null;
      return snapshot && snapshot.sessions ? snapshot.sessions : {};
    }catch(err){
      return {};
    }
  }

  function isPassed(state,sessionId){
    return Boolean(state && state[sessionId] && state[sessionId].passed);
  }

  function progressSnapshot(){
    const state = stateSnapshot();
    const progress = typeof window.getEapCoreProgress === "function"
      ? window.getEapCoreProgress()
      : {passed:0,total:20,percent:0,next:"S1"};
    const arc = ARCS.find(item => !item.sessions.every(id => isPassed(state,id)) || !isPassed(state,item.boss)) || ARCS[ARCS.length - 1];
    return {
      state,
      progress,
      arc,
      passedSessions: arc.sessions.filter(id => isPassed(state,id)),
      pendingSessions: arc.sessions.filter(id => !isPassed(state,id)),
      bossPassed: isPassed(state,arc.boss)
    };
  }

  function getOrCreate(root,id,className){
    let node = root.querySelector(`#${id}`);
    if(!node){
      node = document.createElement("div");
      node.id = id;
      node.className = className;
      const actions = root.querySelector(".summary-actions");
      if(actions) actions.insertAdjacentElement("beforebegin",node);
      else root.appendChild(node);
    }
    return node;
  }

  function removeOldDuplicatePathBoxes(root){
    Array.from(root.querySelectorAll("#eapV202PathBox,#eapV195SummaryBox")).forEach(node => node.remove());
    const current = Array.from(root.querySelectorAll("#eapV203PathBox"));
    current.slice(1).forEach(node => node.remove());
  }

  function renderPath(root,result){
    const info = progressSnapshot();
    removeOldDuplicatePathBoxes(root);
    const next = info.progress.next || "DONE";
    const nextTitle = next === "DONE" ? "ครบทุกภารกิจแล้ว" : sessionTitle(next);
    const missing = info.pendingSessions.map(id => `${id} · ${sessionTitle(id)}`);
    const arcLine = info.bossPassed
      ? `${info.arc.title} ผ่าน Vocabulary Boss แล้ว`
      : `Arc นี้ผ่านแล้ว ${info.passedSessions.length}/${info.arc.sessions.length} Session`;
    const unlockLine = info.bossPassed
      ? "ระบบเปิด Arc ถัดไปแล้ว"
      : missing.length
        ? `ยังต้องผ่าน ${missing.join(" และ ")} เพื่อปลดล็อก ${info.arc.boss} · ${sessionTitle(info.arc.boss)}`
        : `ผ่าน Session ครบแล้ว เหลือ ${info.arc.boss} · ${sessionTitle(info.arc.boss)} เพื่อปลดล็อก Arc ถัดไป`;
    const retainedPass = !result.passed && isPassed(info.state,result.sessionId)
      ? `<br><span>หมายเหตุ: รอบล่าสุดยังไม่ผ่าน แต่สิทธิ์ผ่าน ${result.sessionId} จากรอบก่อนยังคงอยู่</span>`
      : "";

    const box = getOrCreate(root,"eapV203PathBox","eap192-summary-box");
    box.innerHTML = `
      <b>เส้นทาง Vocabulary Arc</b><br>
      ${arcLine} • ความก้าวหน้ารวม ${info.progress.passed}/${info.progress.total} (${info.progress.percent}%)<br>
      ${unlockLine}${retainedPass}
      <div class="eap203-row">
        <span class="eap203-chip good">สถานะสะสม: ${isPassed(info.state,result.sessionId) ? `${result.sessionId} ผ่านแล้ว` : `${result.sessionId} ยังไม่ผ่าน`}</span>
        <span class="eap203-chip">ภารกิจที่ควรทำต่อ: ${next === "DONE" ? "ครบแล้ว" : `${next} · ${nextTitle}`}</span>
      </div>`;

    const nextButton = $("nextMissionBtn");
    if(nextButton){
      nextButton.textContent = next === "DONE" ? "สรุปผลการเรียน" : `ไปทำ ${next} ต่อ`;
      nextButton.title = next === "DONE" ? "ครบทุก Vocabulary Mission แล้ว" : `${next} · ${nextTitle}`;
    }
  }

  function renderSummary(){
    const root = summaryRoot();
    const raw = sourceResult();
    if(!root || !raw) return;
    const result = normalizeResult(raw);
    window.EAP_V203_LAST_RESULT = result;
    if(window.EAP_V196_LAST_RESULT) Object.assign(window.EAP_V196_LAST_RESULT,result);
    if(window.EAP_V195_LAST_RESULT) Object.assign(window.EAP_V195_LAST_RESULT,result);

    setStat(root,"XP",result.xp);
    setStat(root,"Score",result.xp);
    setStat(root,"Max Combo",result.maxCombo);
    setStat(root,"Combo",result.maxCombo);

    const title = $("summaryTitle");
    const subtitle = $("summarySubtitle");
    if(title) title.textContent = result.passed ? `${result.sessionId} ผ่านแล้ว!` : `${result.sessionId} ฝึกเพิ่มอีกนิด`;
    if(subtitle) subtitle.textContent = `${sessionTitle(result.sessionId)} • ${result.accuracy}% • เกณฑ์ผ่าน ${threshold(result.sessionId)}%`;

    const reward = getOrCreate(root,"eapV203RewardBox","eap192-summary-box");
    const need = Math.ceil(result.total * threshold(result.sessionId) / 100);
    const outcome = result.passed
      ? `ผ่านเกณฑ์ ${threshold(result.sessionId)}% แล้ว พร้อมสะสมความก้าวหน้าใน Arc ต่อไป`
      : `ยังต้องตอบถูกอย่างน้อย ${need}/${result.total} ข้อเพื่อผ่าน ลองใช้ AI Help และทบทวน Weak Words ก่อนเล่นซ้ำ`;
    reward.innerHTML = `
      <b>🎯 XP รอบนี้: ${result.xp}</b><br>
      ได้ ${result.correct}/${result.total} ข้อ • Accuracy ${result.accuracy}% • ${outcome}
      <div class="eap203-row">
        <span class="eap203-chip good">Base ${Math.max(result.correct * 60,result.rewardBreakdown.base || 0)}</span>
        <span class="eap203-chip good">Max Combo ${result.maxCombo}</span>
        <span class="eap203-chip good">Pass ${result.passed ? "✓" : "–"}</span>
      </div>`;

    renderPath(root,result);
  }

  function hideAnswerLeak(){
    const tags = $("questionTags");
    if(!tags) return;
    Array.from(tags.querySelectorAll("span")).forEach(tag => {
      if(/^Target\s*:/i.test(norm(tag.textContent))){
        tag.textContent = "Mission target";
        tag.title = "คำศัพท์เป้าหมายจะเฉลยผ่าน feedback หลังตอบ";
      }
    });
  }

  function tick(){
    markLogger();
    hideAnswerLeak();
    renderSummary();
  }

  window.addEventListener("eap-core-run-finished",event => {
    if(event && event.detail){
      window.EAP_V203_LAST_RESULT = normalizeResult(event.detail);
      Object.assign(event.detail,window.EAP_V203_LAST_RESULT);
    }
    [0,100,300,700].forEach(delay => setTimeout(tick,delay));
  });

  document.addEventListener("click",event => {
    const watched = event.target && event.target.closest
      ? event.target.closest("#choicesEl .eap192-choice,#nextBtn,#replayBtn,#nextMissionBtn")
      : null;
    if(watched) [80,240,560].forEach(delay => setTimeout(tick,delay));
  },true);

  injectStyle();
  [0,150,500,1000].forEach(delay => setTimeout(tick,delay));
  setInterval(tick,1200);

  window.inspectEapV203 = () => ({
    version:VERSION,
    result:sourceResult() ? normalizeResult(sourceResult()) : null,
    loggerMarked:markLogger(),
    pathBoxes:document.querySelectorAll("#eapV203PathBox").length,
    legacyPathBoxes:document.querySelectorAll("#eapV202PathBox,#eapV195SummaryBox").length,
    summaryVisible:Boolean(summaryRoot())
  });

  console.info("[EAP Word Quest] v203 summary path dedupe ready",{version:VERSION,loggerMarked:markLogger()});
})();
