/* =========================================================
   EAP Word Quest • Recovery Truth + Progress Reconciliation
   File: /herohealth/eap-word-quest/eap-word-engine-v218-recovery-truth-summary.js
   Version: v2.1.8-RECOVERY-TRUTH-PROGRESS-RECONCILE-122
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.1.8-RECOVERY-TRUTH-PROGRESS-RECONCILE-122";
  const GROUP = "122";
  const STATE_PREFIX = "EAP_WORD_QUEST_CORE_V196_STATE";
  const PROFILE_KEY = "EAP_WORD_QUEST_PROFILE_V01";
  const LOG_KEY = "EAP_WORD_QUEST_LEARNING_LOGS_V182";
  const RECENT_WINDOW_MS = 20 * 60 * 1000;
  const VALID_IDS = new Set(["S1","S2","S3","BG1","S4","S5","S6","BG2","S7","S8","S9","BG3","S10","S11","S12","BG4","S13","S14","S15","BG5"]);

  if (window.__EAP_WORD_V218_RECOVERY_TRUTH__) return;
  window.__EAP_WORD_V218_RECOVERY_TRUTH__ = true;

  const $ = id => document.getElementById(id);
  const norm = value => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  const esc = value => norm(value).replace(/[&<>"']/g,ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const num = (value,fallback=0) => { const n=Number(value); return Number.isFinite(n)?n:fallback; };
  const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
  const isId = value => VALID_IDS.has(norm(value).toUpperCase());
  const resultNow = () => window.EAP_V203_LAST_RESULT || window.EAP_V196_LAST_RESULT || window.EAP_V195_LAST_RESULT || window.EAP_V192_LAST_RESULT || null;
  const summaryRoot = () => $("summaryScreen")?.classList.contains("active") ? ($("summaryScreen").querySelector(".summary-card") || $("summaryScreen")) : null;

  /* Low-score recovery is always a full 12-question learning round. */
  const policyBeforeLock = typeof window.getEapCoreAiPolicy === "function" ? window.getEapCoreAiPolicy : null;
  if (policyBeforeLock) {
    window.getEapCoreAiPolicy = function recoveryRoundLockedPolicy(){
      const policy = policyBeforeLock() || {};
      const mix = policy.roundMix || {};
      const lowRecovery = policy.sessionCalibrated && policy.difficulty === "A2" && Number(mix.warm) === 8 && Number(mix.core) === 4 && Number(mix.challenge) === 0;
      return lowRecovery ? Object.assign({},policy,{difficulty:"A2+",recoverySelectionFloor:"A2+",plannedRoundSize:12,recoveryRoundLocked:true,prediction:"Recovery round: rebuild key vocabulary before challenge items"}) : policy;
    };
  }

  function readJson(key,fallback){ try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fallback;}catch(err){return fallback;} }
  function writeJson(key,value){ try{localStorage.setItem(key,JSON.stringify(value));return true;}catch(err){console.warn("[EAP Word Quest] progress write failed",err);return false;} }
  function profile(){const saved=readJson(PROFILE_KEY,{})||{};return {studentId:norm(($("studentIdInput")&&$("studentIdInput").value)||saved.studentId||saved.id||"no-id")};}
  function stateKey(){const id=norm(profile().studentId||"anon").replace(/[^a-z0-9_-]/gi,"_")||"anon";return `${STATE_PREFIX}_${GROUP}_${id}`;}
  function threshold(sessionId){return sessionId==="BG5"?75:/^BG/i.test(sessionId)?70:60;}
  function normalise(source){
    const raw=source&&typeof source==="object"?source:{};const sessionId=norm(raw.sessionId).toUpperCase();const correct=Math.max(0,Math.round(num(raw.correct)));const total=Math.max(1,Math.round(num(raw.total,1)));const accuracy=clamp(Math.round(num(raw.accuracy,(correct/total)*100)),0,100);
    return {raw,sessionId,correct,total,accuracy,score:Math.max(0,Math.round(num(raw.score,raw.xp))),passed:Boolean(raw.passed||accuracy>=threshold(sessionId)),playedAt:norm(raw.playedAt||raw.endedAt||raw.at||new Date().toISOString())};
  }

  /* Reconcile only a just-finished passed run. It never turns a failed score into a pass. */
  function reconcile(source,from){
    const result=normalise(source);if(!isId(result.sessionId)||!result.passed)return {repaired:false,reason:"not_passed",result};
    const key=stateKey(),state=readJson(key,{})||{};state.version=state.version||"v1.9.6-CORE-COMPACT-PROGRESS-CONTROLLER-122";state.group=GROUP;state.coreOnly=true;state.sessions=state.sessions&&typeof state.sessions==="object"?state.sessions:{};state.recentItemIds=Array.isArray(state.recentItemIds)?state.recentItemIds.slice(0,36):[];state.weakTargets=state.weakTargets&&typeof state.weakTargets==="object"?state.weakTargets:{};state.createdAt=state.createdAt||new Date().toISOString();
    const old=state.sessions[result.sessionId]||{};const needs=!old.passed||!old.played||num(old.bestAccuracy,-1)<result.accuracy;
    if(!needs)return {repaired:false,reason:"already_synced",result};
    state.sessions[result.sessionId]={played:true,passed:true,accuracy:Math.max(result.accuracy,num(old.accuracy)),bestAccuracy:Math.max(result.accuracy,num(old.bestAccuracy,old.accuracy)),bestScore:Math.max(result.score,num(old.bestScore,old.lastScore)),lastAccuracy:result.accuracy,lastScore:result.score,totalAttempts:Math.max(1,Math.round(num(old.totalAttempts))),lastPlayed:result.playedAt};state.updatedAt=new Date().toISOString();
    const repaired=writeJson(key,state);const report={repaired,from,sessionId:result.sessionId,accuracy:result.accuracy,stateKey:key};window.EAP_WORD_V218_RECONCILE=report;return Object.assign(report,{result});
  }
  function latestRecentPass(){
    const id=profile().studentId,now=Date.now(),rows=readJson(LOG_KEY,[]);if(!Array.isArray(rows))return null;
    return rows.map(normalise).filter(row=>{const logId=norm(row.raw.studentId||row.raw.id);const age=now-new Date(row.playedAt).getTime();return row.passed&&isId(row.sessionId)&&(!logId||logId===id)&&Number.isFinite(age)&&age>=-60000&&age<=RECENT_WINDOW_MS;}).sort((a,b)=>new Date(b.playedAt)-new Date(a.playedAt))[0]||null;
  }

  function addStyle(){if($("eapV218Style"))return;const style=document.createElement("style");style.id="eapV218Style";style.textContent=`#eapV195Summary,#eapV195SummaryBox,#eapV198SummaryGuide{display:none!important}#eapV218RecoveryPlan{margin:12px 0;border:1px solid #bfdbfe;border-radius:18px;padding:14px 16px;background:linear-gradient(135deg,#eff6ff,#f8fafc);color:#1e3a8a;line-height:1.48;font-weight:800}#eapV218RecoveryPlan b{font-weight:1000;color:#1d4ed8}#eapV218RecoveryPlan .eap218-row{margin-top:7px}#eapV218RecoveryPlan .eap218-chip{display:inline-flex;align-items:center;border:1px solid #bfdbfe;background:#fff;border-radius:999px;padding:5px 9px;margin:8px 6px 0 0;font-size:12px;font-weight:950;color:#1d4ed8}#eapV218RecoveryPlan.recovery{border-color:#fed7aa;background:linear-gradient(135deg,#fff7ed,#fffbeb);color:#9a3412}#eapV218RecoveryPlan.recovery b,#eapV218RecoveryPlan.recovery .eap218-chip{color:#9a3412}#eapV218RecoveryPlan.recovery .eap218-chip{border-color:#fed7aa}`;document.head.appendChild(style);}
  function planFor(result){const acc=Math.max(0,Math.min(100,Math.round(Number(result?.accuracy)||0)));if(/^BG/i.test(norm(result?.sessionId)))return acc>=70?{kind:"ready",title:"ผ่าน Boss แล้ว",detail:"ไป Arc ถัดไปได้ และทบทวน Weak Words เฉพาะเมื่ออยากเพิ่มความแม่น",chips:["ผ่านเกณฑ์","ไป Arc ถัดไป"]}:{kind:"recovery",title:"Boss Recovery รอบถัดไป",detail:"เริ่มด้วยคำทบทวนจากสาม Session ก่อน แล้วค่อยกลับไปโจทย์บูรณาการ",chips:["ทบทวน 7","บูรณาการ 8","ท้าทาย 3"]};if(acc<45)return{kind:"recovery",title:"Recovery รอบถัดไป • A2+ Foundation",detail:"ผลรอบนี้บอกว่ายังไม่ควรเจอโจทย์ Challenge เพิ่ม ระบบจะเริ่มจากคำ/วลีพื้นฐานและบริบทสั้นก่อน",chips:["Warm-up 8","Core 4","Challenge 0"]};if(acc<60)return{kind:"recovery",title:"Recovery รอบถัดไป • A2+ → B1",detail:"ทบทวนคำหลักและใช้บริบทก่อน แล้วค่อยเพิ่มโจทย์ประยุกต์ทีละข้อ",chips:["Warm-up 6","Core 5","Challenge 1"]};if(acc<75)return{kind:"ready",title:"รอบถัดไป • B1 Context",detail:"ผ่านเกณฑ์แล้ว รอบถัดไปยังเน้นบริบทจริงเป็นหลัก ไม่เร่งความยากเกินไป",chips:["Warm-up 4","Core 6","Challenge 2"]};return{kind:"ready",title:"รอบถัดไป • B1 + Challenge",detail:"พร้อมเพิ่มโจทย์ประยุกต์เล็กน้อย โดยยังรักษาแกนคำศัพท์และบริบทของ Session นี้",chips:["Warm-up 3","Core 6","Challenge 3"]};}
  function renderSummary(){addStyle();const root=summaryRoot(),result=resultNow();if(!root||!result||!isId(result.sessionId))return;const plan=planFor(result);let box=$("eapV218RecoveryPlan");if(!box){box=document.createElement("section");box.id="eapV218RecoveryPlan";const actions=root.querySelector(".summary-actions");if(actions)actions.insertAdjacentElement("beforebegin",box);else root.appendChild(box);}const sig=[result.sessionId,result.accuracy,result.correct,result.total,plan.title].join("|");if(box.dataset.eapV218Signature===sig)return;box.dataset.eapV218Signature=sig;box.className=`eap192-summary-box ${plan.kind}`;box.innerHTML=`<b>แผนเรียนจากผลของ ${esc(result.sessionId)} รอบนี้</b><div class="eap218-row"><b>${esc(plan.title)}</b></div><div class="eap218-row">ได้ ${esc(result.correct)}/${esc(result.total)} ข้อ (${esc(result.accuracy)}%) • ${esc(plan.detail)}</div><div>${plan.chips.map(chip=>`<span class="eap218-chip">${esc(chip)}</span>`).join("")}</div>`;}

  function setUpcoming(sessionId){const sid=norm(sessionId).toUpperCase();if(!isId(sid))return;if(document.body?.dataset)document.body.dataset.sessionId=sid;const game=$("gameScreen");if(game?.dataset)game.dataset.sessionId=sid;}
  function prepareReplay(event){const button=event.target?.closest?.("button");if(!button)return;const result=resultNow();if(["replayBtn","nextMissionBtn"].includes(button.id||"")&&!result?.passed)setUpcoming(result?.sessionId);const direct=norm(button.dataset?.startSession).toUpperCase();if(isId(direct))setUpcoming(direct);}

  window.addEventListener("eap-core-run-finished",event=>{const report=reconcile(event?.detail,"event");if(report.repaired)[0,80,240].forEach(delay=>setTimeout(renderSummary,delay));[80,280,700].forEach(delay=>setTimeout(renderSummary,delay));});
  document.addEventListener("click",event=>{prepareReplay(event);[120,420,850].forEach(delay=>setTimeout(renderSummary,delay));},true);
  [220,700,1400].forEach(delay=>setTimeout(()=>{const row=latestRecentPass();if(row)reconcile(row.raw,"recent_log");renderSummary();},delay));

  window.inspectEapV218=()=>({version:VERSION,lastReconcile:window.EAP_WORD_V218_RECONCILE||null,recentPassedLog:latestRecentPass(),progress:typeof window.getEapCoreProgress==="function"?window.getEapCoreProgress():null,summaryVisible:Boolean(summaryRoot())});
  console.info("[EAP Word Quest] v218 recovery + progress reconciliation ready",{version:VERSION});
})();
