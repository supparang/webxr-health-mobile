/* HeroHealth Fitness Post-Game Recovery Bridge
   File: /fitness/fitness-postgame-recovery-bridge.js
   Version: v20260622-FITNESS-WARMUP-GAME-COOLDOWN-RPE-V2-STORAGE-SAFE
*/
(() => {
  "use strict";

  const PATCH = "v20260622-FITNESS-WARMUP-GAME-COOLDOWN-RPE-V2-STORAGE-SAFE";
  const q = new URLSearchParams(location.search);
  const GAME = String(q.get("game") || q.get("gameId") || "shadow-breaker").replace(/-ar$/,"");
  const CANONICAL = {
    "shadow-breaker": "/webxr-health-mobile/fitness/shadow-breaker-ar.html",
    "rhythm-boxer": "/webxr-health-mobile/fitness/rhythm-boxer-ar.html",
    "jumpduck": "/webxr-health-mobile/fitness/jumpduck-ar.html",
    "jump-duck": "/webxr-health-mobile/fitness/jumpduck-ar.html",
    "balance-hold": "/webxr-health-mobile/fitness/balance-hold-ar2.html"
  };
  const game = CANONICAL[GAME] ? GAME : "shadow-breaker";
  const gameUrl = CANONICAL[game];
  const planner = q.get("entry") === "planner" || q.get("from") === "planner" ||
    !!q.get("planId") || !!q.get("planSlot") || !!q.get("plannerReturnUrl") || q.get("plannerReturn") === "1";
  const key = `HHA_RECOVERY:${game}:${q.get("pid") || q.get("studentId") || q.get("playerId") || q.get("name") || "anon"}`;
  const get = id => document.getElementById(id);
  const hub = (() => {
    const raw = q.get("hub") || "/webxr-health-mobile/fitness/";
    try { return new URL(raw, location.href).href; } catch (_) { return "/webxr-health-mobile/fitness/"; }
  })();
  const plannerReturn = q.get("plannerReturnUrl") || q.get("plannerReturn") || hub;

  function sameContext(u) {
    ["pid","playerId","studentId","studentName","name","classId","section","diff","time","program","lang","view","sheet","gas","webapp","planId","planDay","planSlot","plannerReturnUrl","plannerReturn","plannerForceGate","hub"].forEach(k => {
      const v = q.get(k);
      if (v) u.searchParams.set(k,v);
    });
    return u;
  }

  function gate(phase) {
    const u = sameContext(new URL("/webxr-health-mobile/herohealth/warmup-gate.html", location.origin));
    u.searchParams.set("phase", phase);
    u.searchParams.set("game", game);
    u.searchParams.set("gameId", game);
    u.searchParams.set("zone", "fitness");
    u.searchParams.set("cat", "fitness");
    u.searchParams.set("entry", planner ? "planner" : "solo");
    u.searchParams.set("mode", planner ? "planner" : "solo");
    if (phase === "warmup") {
      u.searchParams.set("run", gameUrl);
      u.searchParams.set("next", gameUrl);
    } else {
      const target = planner ? plannerReturn : hub;
      u.searchParams.set("next", target);
      u.searchParams.set("cdnext", target);
      u.searchParams.set("hub", target);
      u.searchParams.set("cooldownOffered","yes");
    }
    return u.href;
  }

  function warmupDone() {
    return q.get("warmupDone") === "1" || q.get("gateWarmupDone") === "1" || q.get("phase") === "resume" ||
      sessionStorage.getItem(`HHA_WARMUP_DONE:${game}`) === "1";
  }

  function markWarmupResume() {
    if (q.get("warmupDone") === "1" || q.get("gateWarmupDone") === "1") {
      sessionStorage.setItem(`HHA_WARMUP_DONE:${game}`,"1");
    }
  }

  function injectStyles() {
    if (get("hhaRecoveryStyles")) return;
    const s = document.createElement("style");
    s.id = "hhaRecoveryStyles";
    s.textContent = `
      .hha-recovery-modal{position:fixed;inset:0;z-index:9999;display:none;place-items:center;padding:18px;background:rgba(2,6,23,.78);backdrop-filter:blur(10px)}
      .hha-recovery-modal.show{display:grid}
      .hha-recovery-card{width:min(620px,100%);max-height:92vh;overflow:auto;border:1px solid rgba(255,255,255,.18);border-radius:28px;padding:20px;background:linear-gradient(180deg,#172033,#0f172a);box-shadow:0 30px 90px rgba(0,0,0,.55);color:#fff}
      .hha-recovery-card h2{margin:0 0 6px;font-size:28px}.hha-recovery-card p{color:#cbd5e1;line-height:1.55}
      .hha-scale{display:grid;grid-template-columns:repeat(10,1fr);gap:6px;margin:12px 0 4px}.hha-scale button{min-height:42px;border-radius:12px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);font-weight:900}.hha-scale button.selected{background:linear-gradient(135deg,#38bdf8,#6366f1)}
      .hha-pain{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}.hha-pain label{display:inline-flex;gap:6px;align-items:center;padding:8px 10px;border:1px solid rgba(255,255,255,.15);border-radius:999px;background:rgba(255,255,255,.07);font-weight:800}
      .hha-recovery-actions{display:grid;gap:9px;margin-top:16px}.hha-recovery-actions button{min-height:52px;border-radius:16px;font-weight:950;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}.hha-recovery-actions .cool{background:linear-gradient(135deg,#22c55e,#38bdf8)}.hha-recovery-actions .hub{background:rgba(255,255,255,.08)}
      #cooldownBtn{background:linear-gradient(135deg,#22c55e,#38bdf8)!important}
    `;
    document.head.appendChild(s);
  }

  let rpe = null, pain = null, saved = false;
  function modal() {
    let el = get("hhaRecoveryModal");
    if (el) return el;
    injectStyles();
    el = document.createElement("section");
    el.id = "hhaRecoveryModal";
    el.className = "hha-recovery-modal";
    el.innerHTML = `<div class="hha-recovery-card" role="dialog" aria-modal="true">
      <h2>🩺 เช็กความรู้สึกหลังเล่น</h2>
      <p>เลือกระดับความเหนื่อย (RPE) และแจ้งอาการปวด/เวียนศีรษะก่อนเลือก Cooldown หรือกลับ Hub</p>
      <b>RPE ความเหนื่อย 0–10</b>
      <div class="hha-scale" id="hhaRpeScale">${Array.from({length:11},(_,i)=>`<button type="button" data-rpe="${i}">${i}</button>`).join("")}</div>
      <p id="hhaRpeHint">0 = ไม่เหนื่อย • 5 = เหนื่อยพอควร • 10 = เหนื่อยมาก</p>
      <b>มีอาการตรงไหนบ้าง</b>
      <div class="hha-pain" id="hhaPainOptions">
        ${["ไม่มี","ไหล่","แขน","ข้อมือ","หลัง","เข่า","เวียนศีรษะ"].map(x=>`<label><input type="radio" name="hhaPain" value="${x}"> ${x}</label>`).join("")}
      </div>
      <label style="display:block;margin-top:8px;font-weight:850">หมายเหตุเพิ่มเติม
        <input id="hhaPainNote" style="margin-top:7px;width:100%;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#0b1220;color:#fff;padding:10px" maxlength="180" placeholder="ไม่บังคับ">
      </label>
      <div class="hha-recovery-actions">
        <button class="cool" id="hhaGoCooldown">🧘 ทำ Cooldown 30 วินาที</button>
        <button class="hub" id="hhaGoHub">กลับ Fitness Hub</button>
      </div>
    </div>`;
    document.body.appendChild(el);
    el.querySelectorAll("[data-rpe]").forEach(b => b.addEventListener("click", () => {
      rpe = Number(b.dataset.rpe);
      el.querySelectorAll("[data-rpe]").forEach(x=>x.classList.toggle("selected",x===b));
    }));
    el.querySelectorAll("input[name=hhaPain]").forEach(i => i.addEventListener("change", () => pain=i.value));
    el.querySelector("#hhaGoCooldown").addEventListener("click", async () => {
      if (!(await saveSurvey("yes","no"))) return;
      location.href = gate("cooldown");
    });
    el.querySelector("#hhaGoHub").addEventListener("click", async () => {
      if (planner) { location.href = gate("cooldown"); return; }
      if (!(await saveSurvey("no","yes"))) return;
      location.href = hub;
    });
    return el;
  }

  async function saveSurvey(done, skipped) {
    const m = modal();
    if (rpe === null) { alert("กรุณาเลือก RPE 0–10 ก่อน"); return false; }
    if (!pain) { alert("กรุณาเลือกอาการปวด/ไม่มีอาการก่อน"); return false; }
    const note = get("hhaPainNote")?.value?.trim() || "";
    const data = {
      action:"fitnessPostSurvey",
      game, gameId:game, source:"fitness-postgame-recovery",
      timestamp:new Date().toISOString(), clientTimestamp:new Date().toISOString(),
      studentId:q.get("studentId")||q.get("sid")||q.get("pid")||q.get("playerId")||"",
      playerId:q.get("playerId")||q.get("pid")||"",
      studentName:q.get("studentName")||q.get("name")||"Hero",
      name:q.get("name")||q.get("studentName")||"Hero",
      classId:q.get("classId")||q.get("class")||q.get("group")||"",
      section:q.get("section")||q.get("sec")||q.get("group")||"",
      entryMode:planner?"planner":"solo",
      rpe, painArea:pain, painNote:note,
      dizzy:pain==="เวียนศีรษะ"?"yes":"no",
      cooldownOffered:"yes", cooldownDone:done, cooldownSkipped:skipped,
      sourceUrl:location.href
    };
    // Storage must never block the recovery flow. Some devices already have
    // localStorage full from prior game logs, so use a tiny summary and fall back
    // to sessionStorage; Sheet POST can still continue even if both fail.
    const compact = {
      game: data.game,
      timestamp: data.timestamp,
      rpe: data.rpe,
      painArea: data.painArea,
      dizzy: data.dizzy,
      cooldownDone: data.cooldownDone,
      cooldownSkipped: data.cooldownSkipped
    };
    try {
      localStorage.setItem(key, JSON.stringify(compact));
    } catch (storageErr) {
      try {
        sessionStorage.setItem(key, JSON.stringify(compact));
      } catch (_) {
        console.warn("[HHA_RECOVERY] storage unavailable; continuing without cache", storageErr);
      }
    }
    saved = true;
    const endpoint = q.get("sheet") || q.get("gas") || q.get("webapp") ||
      "https://script.google.com/macros/s/AKfycbwdwozSPj0QwEYkclrxAqjZcN2E_uSqAVqAV9ev2_0PWCW1k9riLE_LLMksschpFcNZ-A/exec";
    try {
      await fetch(endpoint,{method:"POST",mode:"no-cors",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(data)});
    } catch (_) {}
    return true;
  }

  function showSurvey() { modal().classList.add("show"); }
  function addRecoveryButtons() {
    const result = get("resultOverlay");
    if (!result || get("cooldownBtn")) return;
    const actions = result.querySelector(".bigActions");
    if (!actions) return;
    const b = document.createElement("button");
    b.id = "cooldownBtn"; b.type="button"; b.className="bigBtn";
    b.textContent = "🧘 ทำ Cooldown 30 วินาที";
    b.addEventListener("click", showSurvey);
    actions.insertBefore(b, actions.querySelector("#btnHub") || null);
    const hubBtn = get("btnHub");
    if (hubBtn) {
      hubBtn.addEventListener("click", ev => {
        if (planner || saved) return;
        ev.preventDefault(); ev.stopImmediatePropagation(); showSurvey();
      }, true);
      if (planner) hubBtn.textContent = "🧘 ทำ Cooldown AR ต่อ";
    }
  }
  function hookStart() {
    const start = get("btnStart");
    if (!start || start.dataset.hhaWarmupHook) return;
    start.dataset.hhaWarmupHook="1";
    start.addEventListener("click", ev => {
      if (planner || warmupDone()) return;
      ev.preventDefault(); ev.stopImmediatePropagation();
      sessionStorage.removeItem(`HHA_WARMUP_DONE:${game}`);
      location.href = gate("warmup");
    }, true);
  }
  function boot() {
    markWarmupResume();
    hookStart(); addRecoveryButtons();
    const observer = new MutationObserver(()=>{ hookStart(); addRecoveryButtons(); });
    observer.observe(document.body,{subtree:true,childList:true});
  }
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded",boot,{once:true}) : boot();
})();
