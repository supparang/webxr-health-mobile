/* =========================================================
   EAP Word Quest • Progress Truth Path
   File: /herohealth/eap-word-quest/eap-word-engine-v220-progress-truth-enforcer.js
   Version: v2.2.0-PROGRESS-TRUTH-PATH-ONLY-122

   The Core controller remains the owner of scores and gates. Pass-state
   reconciliation now lives in v222. This patch renders one truthful Arc
   card only; it never writes the primary summary CTA, preventing a Recovery
   button from competing with older summary patches.
========================================================= */
(() => {
  "use strict";

  const VERSION = "v2.2.0-PROGRESS-TRUTH-PATH-ONLY-122";
  const TOTAL = 20;
  const ARCS = [
    { id:"ARC1", title:"Foundation Arc", sessions:["S1","S2","S3"], boss:"BG1" },
    { id:"ARC2", title:"Evidence Arc", sessions:["S4","S5","S6"], boss:"BG2" },
    { id:"ARC3", title:"Academic Writing Arc", sessions:["S7","S8","S9"], boss:"BG3" },
    { id:"ARC4", title:"Professional Academic Communication", sessions:["S10","S11","S12"], boss:"BG4" },
    { id:"ARC5", title:"Global Academic Communication", sessions:["S13","S14","S15"], boss:"BG5" }
  ];

  if (window.__EAP_WORD_V220_PROGRESS_TRUTH__) return;
  window.__EAP_WORD_V220_PROGRESS_TRUTH__ = true;

  const $ = (id) => document.getElementById(id);
  const norm = (value) => String(value == null ? "" : value).replace(/\s+/g," ").trim();
  const esc = (value) => norm(value).replace(/[&<>"']/g,(ch)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));

  function readJson(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch (err) { return fallback; }
  }

  function coreProgress() {
    try { return typeof window.getEapCoreProgress === "function" ? window.getEapCoreProgress() : null; }
    catch (err) { return null; }
  }

  function state() {
    const progress = coreProgress();
    return progress && progress.stateKey ? readJson(progress.stateKey,{}) || {} : {};
  }

  function passed(snapshot, id) {
    return Boolean(snapshot && snapshot.sessions && snapshot.sessions[id] && snapshot.sessions[id].passed);
  }

  function activeArc(snapshot) {
    return ARCS.find((arc) => !arc.sessions.every((id)=>passed(snapshot,id)) || !passed(snapshot,arc.boss)) || ARCS[ARCS.length - 1];
  }

  function titleFor(id) {
    try {
      if (/^BG/i.test(id) && typeof window.getEapCoreBoss === "function") return (window.getEapCoreBoss(id) || {}).title || id;
      if (typeof window.getEapCoreSession === "function") return (window.getEapCoreSession(id) || {}).title || id;
    } catch (err) {}
    return id;
  }

  function currentResult() {
    return window.EAP_V196_LAST_RESULT || window.EAP_V203_LAST_RESULT || window.EAP_V195_LAST_RESULT || window.EAP_V192_LAST_RESULT || {};
  }

  function addStyle() {
    if ($("eapV220ProgressTruthStyle")) return;
    const style = document.createElement("style");
    style.id = "eapV220ProgressTruthStyle";
    style.textContent = `
      #eapV203PathBox{display:none!important}
      #eapV220PathTruth{margin:12px 0;border:1px solid #c7d2fe;border-radius:16px;padding:12px 14px;background:#f8faff;color:#312e81;line-height:1.5;font-weight:850}
      #eapV220PathTruth b{color:#3730a3}
      #eapV220PathTruth .eap220-row{display:flex;flex-wrap:wrap;gap:7px;margin-top:8px}
      #eapV220PathTruth .eap220-chip{display:inline-flex;align-items:center;border:1px solid #c7d2fe;background:#fff;border-radius:999px;padding:5px 9px;font-size:12px;font-weight:950;color:#3730a3}
      #eapV220PathTruth .good{border-color:#bbf7d0;color:#166534}
    `;
    document.head.appendChild(style);
  }

  function render() {
    addStyle();
    const screen = $("summaryScreen");
    const root = screen && screen.classList.contains("active") ? (screen.querySelector(".summary-card") || screen) : null;
    if (!root) return;

    const snapshot = state();
    const progress = coreProgress() || { passed:0, total:TOTAL, percent:0, next:"S1" };
    const arc = activeArc(snapshot);
    const done = arc.sessions.filter((id)=>passed(snapshot,id));
    const pending = arc.sessions.filter((id)=>!passed(snapshot,id));
    const bossDone = passed(snapshot,arc.boss);
    const next = norm(progress.next || "DONE") || "DONE";
    const result = currentResult();
    const sessionId = norm(result.sessionId).toUpperCase();
    const arcLine = bossDone ? `${arc.title} ผ่าน Vocabulary Boss แล้ว` : `Arc นี้ผ่านแล้ว ${done.length}/${arc.sessions.length} Session`;
    const detail = bossDone
      ? "ระบบเปิด Arc ถัดไปแล้ว"
      : pending.length
        ? `ยังต้องผ่าน ${pending.map((id)=>`${id} · ${titleFor(id)}`).join(" และ ")} เพื่อปลดล็อก ${arc.boss} · ${titleFor(arc.boss)}`
        : `ผ่าน Session ครบแล้ว เหลือ ${arc.boss} · ${titleFor(arc.boss)} เพื่อปลดล็อก Arc ถัดไป`;

    let box = $("eapV220PathTruth");
    if (!box) {
      box = document.createElement("section");
      box.id = "eapV220PathTruth";
      const actions = root.querySelector(".summary-actions");
      if (actions) actions.insertAdjacentElement("beforebegin",box); else root.appendChild(box);
    }
    const signature = [progress.passed,progress.next,arc.id,done.join(","),bossDone,sessionId].join("|");
    if (box.dataset.eapV220Signature === signature) return;
    box.dataset.eapV220Signature = signature;
    box.innerHTML = `
      <b>เส้นทาง Vocabulary Arc</b><br>
      ${esc(arcLine)} • ความก้าวหน้ารวม ${esc(progress.passed)}/${esc(progress.total || TOTAL)} (${esc(progress.percent)}%)<br>
      ${esc(detail)}
      <div class="eap220-row">
        <span class="eap220-chip good">สถานะสะสม: ${esc(sessionId)} ${passed(snapshot,sessionId) ? "ผ่านแล้ว" : "ยังไม่ผ่าน"}</span>
        <span class="eap220-chip">ภารกิจที่ควรทำต่อ: ${next === "DONE" ? "ครบแล้ว" : `${esc(next)} · ${esc(titleFor(next))}`}</span>
      </div>`;
  }

  window.addEventListener("eap-core-run-finished",()=>[220,600,1100].forEach((delay)=>setTimeout(render,delay)));
  document.addEventListener("click",()=>[260,700].forEach((delay)=>setTimeout(render,delay)),true);
  [400,1200,2200].forEach((delay)=>setTimeout(render,delay));

  window.inspectEapV220 = () => {
    const progress = coreProgress() || {};
    const snapshot = state();
    const arc = activeArc(snapshot);
    return {version:VERSION,progress,activeArc:arc.id,passedSessions:arc.sessions.filter((id)=>passed(snapshot,id)),next:progress.next || "S1"};
  };

  console.info("[EAP Word Quest] v220 path-only runtime ready",{version:VERSION});
})();
