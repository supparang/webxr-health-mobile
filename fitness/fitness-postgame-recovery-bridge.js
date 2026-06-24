/* HeroHealth Fitness Warm-up / Recovery Bridge
   File: /fitness/fitness-postgame-recovery-bridge.js
   Version: v20260623-FITNESS-4GAME-WARMUP-ENTRY-V5-RHYTHM-DUAL-MODE
   Covers: Shadow Breaker AR, Rhythm Boxer AR, JumpDuck AR, Balance Hold AR
*/
(() => {
  "use strict";

  const q = new URLSearchParams(location.search);
  const $ = (id) => document.getElementById(id);
  const path = location.pathname.toLowerCase();

  const pathGame =
    path.includes("rhythm-boxer") ? "rhythm-boxer" :
    (path.includes("jumpduck") || path.includes("jump-duck")) ? "jump-duck" :
    path.includes("balance-hold") ? "balance-hold" :
    "shadow-breaker";

  const requested = String(q.get("game") || q.get("gameId") || pathGame).replace(/-ar$/, "");
  const CANONICAL = {
    "shadow-breaker": "/webxr-health-mobile/fitness/shadow-breaker-ar.html",
    "rhythm-boxer": "/webxr-health-mobile/fitness/rhythm-boxer-ar.html",
    "jumpduck": "/webxr-health-mobile/fitness/jumpduck-ar.html",
    "jump-duck": "/webxr-health-mobile/fitness/jumpduck-ar.html",
    "balance-hold": "/webxr-health-mobile/fitness/balance-hold-ar2.html"
  };
  const game = CANONICAL[requested] ? requested : pathGame;
  const gameUrl = CANONICAL[game] || CANONICAL["shadow-breaker"];

  const planner =
    q.get("entry") === "planner" ||
    q.get("from") === "planner" ||
    !!q.get("planId") ||
    !!q.get("planSlot") ||
    !!q.get("plannerReturnUrl") ||
    q.get("plannerReturn") === "1";

  const identity =
    q.get("pid") ||
    q.get("studentId") ||
    q.get("playerId") ||
    q.get("name") ||
    "anon";

  const warmKey = `HHA_WARMUP_DONE:${game}:${identity}`;
  const warmModeKey = `HHA_WARMUP_MODE:${game}:${identity}`;
  const surveyKey = `HHA_RECOVERY:${game}:${identity}`;

  const hub = (() => {
    try {
      return new URL(q.get("hub") || "/webxr-health-mobile/fitness/", location.href).href;
    } catch (_) {
      return "/webxr-health-mobile/fitness/";
    }
  })();

  const plannerReturn = q.get("plannerReturnUrl") || q.get("plannerReturn") || hub;

  function sameContext(u) {
    [
      "pid", "playerId", "studentId", "studentName", "name",
      "classId", "section", "diff", "time", "program", "lang",
      "view", "sheet", "gas", "webapp",
      "planId", "planDay", "planSlot",
      "plannerReturnUrl", "plannerReturn", "plannerForceGate", "hub"
    ].forEach((key) => {
      const value = q.get(key);
      if (value) u.searchParams.set(key, value);
    });
    return u;
  }

  function gate(phase, selectedMode = "") {
    const u = sameContext(
      new URL("/webxr-health-mobile/herohealth/warmup-gate.html", location.origin)
    );

    u.searchParams.set("phase", phase);
    u.searchParams.set("game", game);
    u.searchParams.set("gameId", game);
    u.searchParams.set("zone", "fitness");
    u.searchParams.set("cat", "fitness");
    u.searchParams.set("entry", planner ? "planner" : "solo");
    u.searchParams.set("mode", planner ? "planner" : "solo");

    if (selectedMode) {
      u.searchParams.set("gameMode", selectedMode);
      u.searchParams.set("rhythmMode", selectedMode);
    }

    if (phase === "warmup") {
      const returnUrl = new URL(gameUrl, location.origin);
      sameContext(returnUrl);
      returnUrl.searchParams.set("warmupDone", "1");
      if (selectedMode) {
        returnUrl.searchParams.set("gameMode", selectedMode);
        returnUrl.searchParams.set("rhythmMode", selectedMode);
      }
      u.searchParams.set("run", returnUrl.href);
      u.searchParams.set("next", returnUrl.href);
    } else {
      const target = planner ? plannerReturn : hub;
      u.searchParams.set("next", target);
      u.searchParams.set("cdnext", target);
      u.searchParams.set("hub", target);
      u.searchParams.set("cooldownOffered", "yes");
    }

    return u.href;
  }

  function warmupDone() {
    return (
      q.get("warmupDone") === "1" ||
      q.get("gateWarmupDone") === "1" ||
      q.get("phase") === "resume" ||
      sessionStorage.getItem(warmKey) === "1"
    );
  }

  function markWarmupResume() {
    const resumed =
      q.get("warmupDone") === "1" ||
      q.get("gateWarmupDone") === "1" ||
      q.get("phase") === "resume";

    if (resumed) {
      try {
        sessionStorage.setItem(warmKey, "1");
        const selected = q.get("gameMode") || q.get("rhythmMode") || "";
        if (selected) sessionStorage.setItem(warmModeKey, selected);
      } catch (_) {}
    }
  }

  function selectedRhythmMode() {
    try {
      return (
        q.get("gameMode") ||
        q.get("rhythmMode") ||
        sessionStorage.getItem(warmModeKey) ||
        ""
      );
    } catch (_) {
      return q.get("gameMode") || q.get("rhythmMode") || "";
    }
  }

  function injectStyles() {
    if ($("hhaFitnessBridgeStyle")) return;

    const style = document.createElement("style");
    style.id = "hhaFitnessBridgeStyle";
    style.textContent = `
      .hha-warmup-entry{
        margin:14px 0 0;padding:13px;border:1px solid rgba(56,189,248,.38);
        border-radius:18px;background:linear-gradient(135deg,rgba(34,197,94,.10),rgba(56,189,248,.12));
        display:grid;gap:8px;box-shadow:0 8px 22px rgba(56,189,248,.08)
      }
      .hha-warmup-entry b{font-size:14px}
      .hha-warmup-entry span{font-size:12px;line-height:1.45;opacity:.88}
      .hha-warmup-actions{display:flex;flex-wrap:wrap;gap:8px}
      .hha-warmup-btn{
        min-height:48px;border-radius:16px;border:1px solid rgba(255,255,255,.24);
        background:linear-gradient(135deg,#22c55e,#38bdf8);color:#fff;font-weight:1000;cursor:pointer;padding:10px 14px
      }
      .hha-warmup-btn.alt{background:linear-gradient(135deg,#818cf8,#38bdf8)}
      .hha-start-locked{opacity:.55;filter:saturate(.65)}
      .hha-recovery-modal{position:fixed;inset:0;z-index:9999;display:none;place-items:center;padding:18px;background:rgba(2,6,23,.78);backdrop-filter:blur(10px)}
      .hha-recovery-modal.show{display:grid}
      .hha-recovery-card{width:min(620px,100%);max-height:92vh;overflow:auto;border:1px solid rgba(255,255,255,.18);border-radius:28px;padding:20px;background:linear-gradient(180deg,#172033,#0f172a);box-shadow:0 30px 90px rgba(0,0,0,.55);color:#fff}
      .hha-scale{display:grid;grid-template-columns:repeat(11,1fr);gap:5px;margin:12px 0}
      .hha-scale button{min-height:40px;border-radius:10px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.14);color:#fff;font-weight:900}
      .hha-scale button.selected{background:linear-gradient(135deg,#38bdf8,#6366f1)}
      .hha-pain{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
      .hha-pain label{display:inline-flex;gap:6px;align-items:center;padding:8px 10px;border:1px solid rgba(255,255,255,.15);border-radius:999px;background:rgba(255,255,255,.07);font-weight:800}
      .hha-recovery-actions{display:grid;gap:9px;margin-top:16px}
      .hha-recovery-actions button{min-height:52px;border-radius:16px;font-weight:950;color:#fff;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18)}
      .hha-recovery-actions .cool,#cooldownBtn{background:linear-gradient(135deg,#22c55e,#38bdf8)!important}
    `;
    document.head.appendChild(style);
  }

  function startButtons() {
    if (game === "rhythm-boxer") {
      return [$("btnStartBody"), $("btnStartTouch")].filter(Boolean);
    }

    const ids = [
      "btnStart", "startBtn", "startGame", "startButton",
      "btnPlay", "playBtn", "btnBegin", "beginBtn"
    ];
    for (const id of ids) {
      const el = $(id);
      if (el && !el.closest("#resultOverlay")) return [el];
    }

    const fallback = [...document.querySelectorAll("button,a,[role='button']")]
      .find((el) => {
        const text = (el.textContent || "").trim().toLowerCase();
        return /(^|\s)(เริ่มเกม|เริ่มเล่น|start game|start|play)(\s|$)/.test(text) &&
          !/replay|again|กลับ|hub|menu|cooldown|warm/.test(text);
      });

    return fallback ? [fallback] : [];
  }

  function beginWarmup(mode = "") {
    try {
      sessionStorage.removeItem(warmKey);
      if (mode) sessionStorage.setItem(warmModeKey, mode);
    } catch (_) {}
    location.href = gate("warmup", mode);
  }

  function injectWarmupEntry() {
    const starts = startButtons();
    if (!starts.length || $("hhaWarmupEntry")) return;

    injectStyles();

    const done = warmupDone();
    const box = document.createElement("div");
    box.id = "hhaWarmupEntry";
    box.className = "hha-warmup-entry";

    if (game === "rhythm-boxer") {
      box.innerHTML = done
        ? `<b>✅ Warm-up AR ผ่านแล้ว</b>
           <span>พร้อมแล้ว เลือกเริ่มด้วย Body Tracking หรือ Touch/Keyboard ได้เลย</span>`
        : `<b>🔥 Warm-up AR ก่อนเริ่ม Rhythm Boxer</b>
           <span>${planner ? "แผนนี้ต้องผ่าน Warm-up ก่อนเริ่มเกม" : "เลือกโหมดที่ต้องการ แล้วผ่าน Warm-up สั้น ๆ ก่อนเริ่มเกม"}</span>
           <div class="hha-warmup-actions">
             <button type="button" class="hha-warmup-btn" data-hha-mode="body">📷 Warm-up แล้วเล่น Body Tracking AR</button>
             <button type="button" class="hha-warmup-btn alt" data-hha-mode="touch">▶ Warm-up แล้วเล่น Touch/Keyboard</button>
           </div>`;
    } else {
      box.innerHTML = done
        ? `<b>✅ Warm-up AR ผ่านแล้ว</b><span>พร้อมเริ่มเกมรอบนี้ได้เลย</span>`
        : `<b>🔥 Warm-up AR ก่อนเริ่มเกม</b>
           <span>${planner ? "แผนนี้ต้องผ่าน Warm-up ก่อนเริ่มเกม" : "เตรียมร่างกายสั้น ๆ ก่อนเล่น เพื่อเริ่มอย่างปลอดภัย"}</span>
           <div class="hha-warmup-actions">
             <button type="button" class="hha-warmup-btn" data-hha-mode="">เริ่ม Warm-up AR</button>
           </div>`;
    }

    starts[0].parentElement?.insertBefore(box, starts[0]);

    if (!done) {
      starts.forEach((button) => {
        button.classList.add("hha-start-locked");
        button.setAttribute("aria-disabled", "true");
      });

      box.querySelectorAll("[data-hha-mode]").forEach((button) => {
        button.addEventListener("click", () => beginWarmup(button.dataset.hhaMode || ""));
      });
    } else {
      starts.forEach((button) => {
        button.classList.remove("hha-start-locked");
        button.removeAttribute("aria-disabled");
      });
    }
  }

  function hookGameStart() {
    if (document.documentElement.dataset.hhaWarmupHook) return;
    document.documentElement.dataset.hhaWarmupHook = "1";

    document.addEventListener("click", (event) => {
      if (warmupDone()) return;

      const clicked = event.target?.closest?.("button,a,[role='button']");
      if (!clicked) return;

      const starts = startButtons();
      if (!starts.includes(clicked)) return;

      event.preventDefault();
      event.stopImmediatePropagation();

      const mode =
        game === "rhythm-boxer"
          ? (clicked.id === "btnStartTouch" ? "touch" : "body")
          : "";

      beginWarmup(mode);
    }, true);
  }

  let rpe = null;
  let pain = null;
  let saved = false;

  function surveyModal() {
    let modal = $("hhaRecoveryModal");
    if (modal) return modal;

    injectStyles();
    modal = document.createElement("section");
    modal.id = "hhaRecoveryModal";
    modal.className = "hha-recovery-modal";
    modal.innerHTML = `
      <div class="hha-recovery-card" role="dialog" aria-modal="true">
        <h2 style="margin:0 0 6px">🩺 เช็กความรู้สึกหลังเล่น</h2>
        <p style="color:#cbd5e1;line-height:1.55">เลือกระดับความเหนื่อยและอาการก่อนทำ Cooldown หรือกลับ Fitness Zone</p>
        <b>RPE ความเหนื่อย 0–10</b>
        <div class="hha-scale">${Array.from({ length: 11 }, (_, i) => `<button type="button" data-rpe="${i}">${i}</button>`).join("")}</div>
        <b>มีอาการตรงไหนบ้าง</b>
        <div class="hha-pain">${["ไม่มี","ไหล่","แขน","ข้อมือ","หลัง","เข่า","เวียนศีรษะ"].map((name) => `<label><input type="radio" name="hhaPain" value="${name}"> ${name}</label>`).join("")}</div>
        <label style="display:block;font-weight:850">หมายเหตุเพิ่มเติม
          <input id="hhaPainNote" maxlength="180" style="margin-top:7px;width:100%;min-height:44px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:#0b1220;color:#fff;padding:10px" placeholder="ไม่บังคับ">
        </label>
        <div class="hha-recovery-actions">
          <button class="cool" id="hhaGoCooldown">🧘 ทำ Cooldown 30 วินาที</button>
          <button id="hhaGoHub">กลับ Fitness Zone</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelectorAll("[data-rpe]").forEach((button) => {
      button.addEventListener("click", () => {
        rpe = Number(button.dataset.rpe);
        modal.querySelectorAll("[data-rpe]").forEach((item) => item.classList.toggle("selected", item === button));
      });
    });

    modal.querySelectorAll("input[name=hhaPain]").forEach((input) => {
      input.addEventListener("change", () => { pain = input.value; });
    });

    modal.querySelector("#hhaGoCooldown").addEventListener("click", async () => {
      if (await saveSurvey("yes", "no")) location.href = gate("cooldown");
    });

    modal.querySelector("#hhaGoHub").addEventListener("click", async () => {
      if (planner) {
        location.href = gate("cooldown");
        return;
      }
      if (await saveSurvey("no", "yes")) location.href = hub;
    });

    return modal;
  }

  async function saveSurvey(cooldownDone, cooldownSkipped) {
    if (rpe === null) {
      alert("กรุณาเลือก RPE 0–10 ก่อน");
      return false;
    }
    if (!pain) {
      alert("กรุณาเลือกอาการปวด/ไม่มีอาการก่อน");
      return false;
    }

    const data = {
      action: "fitnessPostSurvey",
      game,
      gameId: game,
      source: "fitness-postgame-recovery",
      timestamp: new Date().toISOString(),
      clientTimestamp: new Date().toISOString(),
      studentId: q.get("studentId") || q.get("sid") || q.get("pid") || q.get("playerId") || "",
      playerId: q.get("playerId") || q.get("pid") || "",
      studentName: q.get("studentName") || q.get("name") || "Hero",
      name: q.get("name") || q.get("studentName") || "Hero",
      classId: q.get("classId") || q.get("class") || q.get("group") || "",
      section: q.get("section") || q.get("sec") || q.get("group") || "",
      entryMode: planner ? "planner" : "solo",
      rpe,
      painArea: pain,
      painNote: $("hhaPainNote")?.value?.trim() || "",
      dizzy: pain === "เวียนศีรษะ" ? "yes" : "no",
      cooldownOffered: "yes",
      cooldownDone,
      cooldownSkipped,
      sourceUrl: location.href
    };

    try {
      localStorage.setItem(
        surveyKey,
        JSON.stringify({ game, timestamp: data.timestamp, rpe, painArea: pain, cooldownDone, cooldownSkipped })
      );
    } catch (_) {
      try { sessionStorage.setItem(surveyKey, JSON.stringify({ game, rpe, painArea: pain })); } catch (_) {}
    }

    saved = true;

    const endpoint =
      q.get("sheet") ||
      q.get("gas") ||
      q.get("webapp") ||
      "https://script.google.com/macros/s/AKfycbwdwozSPj0QwEYkclrxAqjZcN2E_uSqAVqAV9ev2_0PWCW1k9riLE_LLMksschpFcNZ-A/exec";

    try {
      await fetch(endpoint, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(data)
      });
    } catch (_) {}

    return true;
  }

  function addRecoveryButton() {
    const result =
  $("resultOverlay") ||
  $("resultView") ||
  $("gameoverScreen");
    if (!result || $("cooldownBtn")) return;

    const hubButton = $("btnHub") || $("btnMenu2") || $("btnHomeOver");

const actions =
  result.querySelector(".bigActions") ||
  result.querySelector(".row") ||
  hubButton?.parentElement ||
  null;

if (!actions) return;

    const button = document.createElement("button");
    button.id = "cooldownBtn";
    button.type = "button";
    button.className = "bigBtn btn warn";
    button.textContent = "🧘 ทำ Cooldown 30 วินาที";
    button.addEventListener("click", () => surveyModal().classList.add("show"));
    actions.insertBefore(button, actions.querySelector("#btnHub") || actions.querySelector("#btnMenu2") || null);

    const hubButton = $("btnHub") || $("btnMenu2") || $("btnHomeOver");
    if (hubButton) {
      hubButton.addEventListener("click", (event) => {
        if (planner || saved) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        surveyModal().classList.add("show");
      }, true);

      if (planner) hubButton.textContent = "🧘 ทำ Cooldown AR ต่อ";
    }
  }

  function boot() {
    markWarmupResume();
    hookGameStart();
    injectWarmupEntry();

    const observer = new MutationObserver(() => {
      injectWarmupEntry();
      addRecoveryButton();
    });

    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class"]
    });

    addRecoveryButton();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
