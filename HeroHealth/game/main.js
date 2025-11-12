// === /HeroHealth/game/main.js (2025-11-13 STABLE) ===
// - ใช้กับไฟล์โหมด .safe.js เท่านั้น เช่น goodjunk.safe.js
// - ปรับปรุงให้โหลดโหมดจาก ../modes/ เสมอ
// - แสดงคะแนน / คอมโบ / เวลา บน HUD แบบเรียลไทม์
// - ปิด pointer events เมื่อจบเกม
// - ปุ่ม "กลับ Hub" จะลิงก์ไปยัง hub.html

console.log("[main] Hero Health VR booting...");

(async function() {
  const params = new URLSearchParams(location.search);
  const MODE = (params.get("mode") || "goodjunk").toLowerCase();
  const DIFF = (params.get("diff") || "normal").toLowerCase();
  const AUTO = params.get("autostart") === "1";

  // HUD elements
  const elScore = document.getElementById("hudScore");
  const elCombo = document.getElementById("hudCombo");
  const elFever = document.getElementById("feverBarDock");

  let score = 0, combo = 0, maxCombo = 0, misses = 0;
  let questsCleared = 0, questsTotal = 0;
  let duration = 60;

  // --------------------- Loader ---------------------
  async function loadModeModule(mode) {
    const base = new URL('.', import.meta.url);
    const url = new URL(`../modes/${mode}.safe.js`, base);
    url.searchParams.set("v", Date.now().toString());
    console.log("[main] Importing mode:", url.href);
    try {
      const mod = await import(url.href);
      if (mod?.boot) return mod;
      if (mod?.default?.boot) return mod.default;
      throw new Error("Missing boot() in mode module");
    } catch (e) {
      console.error("[main] Failed to import mode:", e);
      alert(`เริ่มเกมไม่สำเร็จ: โหลดโหมดไม่ได้\n${url.pathname}`);
      throw e;
    }
  }

  // --------------------- Game State ---------------------
  function updateHUD() {
    if (elScore) elScore.textContent = score.toLocaleString();
    if (elCombo) elCombo.textContent = combo;
  }

  function resetCombo() {
    combo = 0;
    if (elCombo) elCombo.textContent = 0;
  }

  function addScore(delta) {
    score += delta;
    combo++;
    maxCombo = Math.max(maxCombo, combo);
    updateHUD();
  }

  function onMiss() {
    misses++;
    resetCombo();
  }

  function onTime(evt) {
    const sec = evt.detail.sec;
    const bar = elFever?.querySelector("progress") || createTimerBar();
    bar.value = duration - sec;
  }

  function createTimerBar() {
    const bar = document.createElement("progress");
    bar.max = duration;
    bar.value = 0;
    bar.style.width = "100%";
    bar.style.height = "8px";
    bar.style.borderRadius = "6px";
    bar.style.background = "#1e293b";
    bar.style.accentColor = "#3b82f6";
    elFever.appendChild(bar);
    return bar;
  }

  // --------------------- End & Result ---------------------
  function showResult() {
    const old = document.getElementById("resultOverlay");
    if (old) old.remove();
    const o = document.createElement("div");
    o.id = "resultOverlay";
    o.innerHTML = `
      <div class="card">
        <h2>สรุปผล: ${MODE} (${DIFF})</h2>
        <div class="stats">
          <div>คะแนนรวม: <b>${score.toLocaleString()}</b></div>
          <div>คอมโบสูงสุด: <b>${maxCombo}</b></div>
          <div>พลาด: <b>${misses}</b></div>
          <div>เป้าหมาย: <b>${score >= 500 ? 'ถึงเป้า 🎯' : 'ไม่ถึง (-)'}</b></div>
          <div>เวลา: <b>${duration}s</b></div>
        </div>
        <div class="questBadge">Mini Quests ${questsCleared}/${questsTotal}</div>
        <div class="btns">
          <button id="btnRetry">เล่นอีกครั้ง</button>
          <button id="btnHub">กลับ Hub</button>
        </div>
      </div>
    `;
    document.body.appendChild(o);

    o.querySelector("#btnRetry").onclick = () => location.reload();
    o.querySelector("#btnHub").onclick = () =>
      (location.href = "./hub.html");

    const st = document.createElement("style");
    st.textContent = `
      #resultOverlay{position:fixed;inset:0;background:rgba(0,0,0,.8);
        display:flex;align-items:center;justify-content:center;z-index:999;}
      #resultOverlay .card{background:#0f172a;color:#fff;border-radius:16px;
        padding:24px;min-width:280px;text-align:center;box-shadow:0 0 20px #000a;}
      .stats{margin:8px 0;line-height:1.6;}
      .btns{margin-top:16px;display:flex;gap:12px;justify-content:center;}
      .btns button{padding:8px 16px;border:none;border-radius:8px;cursor:pointer;font-weight:600;}
      #btnRetry{background:#22c55e;color:#fff;}
      #btnHub{background:#3b82f6;color:#fff;}
      .questBadge{margin-top:10px;padding:4px 8px;border:2px solid #64748b;border-radius:8px;
        font-weight:700;color:#f87171;background:#1e293b;}
    `;
    document.head.appendChild(st);
  }

  // --------------------- Boot ---------------------
  async function start() {
    console.log("[main] Starting mode:", MODE);
    const mod = await loadModeModule(MODE);
    const controller = await mod.boot({
      duration,
      difficulty: DIFF,
      onExpire: onMiss,
      judge: (ch, info) => ({ good: info.isGood, scoreDelta: info.isGood ? 10 : -5 })
    });

    window.addEventListener("hha:score", (e) => addScore(e.detail.delta));
    window.addEventListener("hha:expired", (e) => onMiss(e.detail));
    window.addEventListener("hha:time", onTime);
    window.addEventListener("hha:end", showResult);

    controller.start();
  }

  if (AUTO) start();
})();