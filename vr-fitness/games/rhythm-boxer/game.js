/* games/rhythm-boxer/game.js
   Rhythm Boxer · game.js (Hit-Line Glow + Judge Overlay + Hit-Assist + Mouse/Touch + Speed Ramp + Safe Remove + Back-to-Hub fix)
*/
(function () {
  "use strict";

  // ==========================
  // Helpers / Globals
  // ==========================
  const byId = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const RND = () => Math.random();

  // ---- Safe remove (ป้องกัน removeChild of null) ----
  function safeRemove(el) {
    try {
      if (!el) return;
      if (el.parentNode) el.parentNode.removeChild(el);
      else if (el.remove) el.remove();
    } catch (_) {}
  }

  // ---- Paths / Hub ----
  const ASSET_BASE =
    (document.querySelector('meta[name="asset-base"]')?.content || "").replace(
      /\/+$/,
      ""
    );
  const HUB_URL = `${ASSET_BASE}/vr-fitness/`; // <- กลับ Hub ให้ถูกพาธ

  // ---- Audio SFX ----
  const SFXN = (p) => {
    const a = new Audio(p);
    a.onerror = () => console.warn("SFX not found:", p);
    return a;
  };
  const SFX = {
    hit: SFXN(`${ASSET_BASE}/assets/sfx/slash.wav`),
    perfect: SFXN(`${ASSET_BASE}/assets/sfx/perfect.wav`),
    miss: SFXN(`${ASSET_BASE}/assets/sfx/miss.wav`),
    good: SFXN(`${ASSET_BASE}/assets/sfx/laser.wav`),
    combo: SFXN(`${ASSET_BASE}/assets/sfx/combo.wav`),
    ui: SFXN(`${ASSET_BASE}/assets/sfx/success.wav`),
  };
  const lastPlay = new Map();
  function play(a, guardMs = 80) {
    try {
      const now = performance.now();
      if (lastPlay.get(a) && now - lastPlay.get(a) < guardMs) return;
      a.currentTime = 0;
      lastPlay.set(a, now);
      if (a.paused) a.play();
    } catch (_) {}
  }

  // ==========================
  // Game State
  // ==========================
  let running = false;
  let paused = false;
  let spawnTimer = null;
  let secTimer = null;

  // HUD
  let score = 0;
  let combo = 0;
  let maxCombo = 0;
  let timeLeft = 60;

  // Notes
  const notes = []; // {el, lane, speed, bornAt}
  const COLORS = ["#20ffa0", "#9bd1ff", "#ffd166", "#ff6b6b", "#a899ff"];
  let colorIndex = 0;

  // Hit line (y)
  const HIT_Y = 1.00;
  let hitLine = null;

  // Speed profile
  const SPEED_MODE = {
    beginner: { fall: 0.72, spawn: 950, rampEachSec: 0.0008, title: "Beginner" },
    standard: { fall: 0.90, spawn: 820, rampEachSec: 0.0012, title: "Standard" },
    challenge: { fall: 1.05, spawn: 700, rampEachSec: 0.0018, title: "Challenge" },
  };
  let SP = SPEED_MODE.standard;
  let speedMul = 1.0; // จะค่อย ๆ เร่งขึ้นระหว่างเล่น

  // Judge window (กว้างขึ้น + hit assist)
  const JUDGE = {
    perfect: 0.11, // เดิมแคบ → กว้างขึ้น
    good: 0.20,
    late: 0.28,
  };

  // ==========================
  // UI / Overlays
  // ==========================
  function updateHUD() {
    byId("score") && (byId("score").textContent = score);
    byId("combo") && (byId("combo").textContent = combo);
    byId("time") && (byId("time").textContent = timeLeft);
  }

  function badge(msg) {
    let el = byId("rbToast");
    if (!el) {
      el = document.createElement("div");
      el.id = "rbToast";
      Object.assign(el.style, {
        position: "fixed",
        left: "50%",
        top: "10px",
        transform: "translateX(-50%)",
        background: "rgba(10,16,24,.8)",
        color: "#e6f7ff",
        font: "700 13px system-ui",
        padding: "8px 12px",
        borderRadius: "12px",
        zIndex: "10000",
        opacity: "0",
        transition: "opacity .12s, transform .12s",
      });
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.opacity = "1";
    el.style.transform = "translateX(-50%) scale(1.03)";
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.style.opacity = "0";
      el.style.transform = "translateX(-50%) scale(1)";
    }, 900);
  }

  // ===== Judge Overlay (PERFECT / GOOD / MISS) =====
  function ensureJudgeUI() {
    let box = document.getElementById("rbJudge");
    if (box) return box;
    box = document.createElement("div");
    box.id = "rbJudge";
    Object.assign(box.style, {
      position: "fixed",
      left: "50%",
      top: "18%",
      transform: "translateX(-50%)",
      color: "#e6f7ff",
      font: "900 42px/1.0 system-ui, Arial",
      letterSpacing: "1px",
      padding: "6px 14px",
      borderRadius: "12px",
      background: "rgba(0,0,0,.25)",
      textShadow: "0 2px 8px rgba(0,0,0,.45)",
      opacity: "0",
      transition: "opacity .12s, transform .12s",
      zIndex: 10000,
      pointerEvents: "none",
    });
    document.body.appendChild(box);
    return box;
  }
  function showJudge(kind) {
    const box = ensureJudgeUI();
    let txt = "GOOD",
      col = "#9bd1ff";
    if (kind === "perfect") {
      txt = "PERFECT";
      col = "#20ffa0";
    } else if (kind === "miss") {
      txt = "MISS";
      col = "#ff5577";
    } else if (kind === "late") {
      txt = "LATE";
      col = "#ffd166";
    }
    box.textContent = txt;
    box.style.color = col;
    box.style.opacity = "1";
    box.style.transform = "translateX(-50%) scale(1.04)";
    clearTimeout(box._t);
    box._t = setTimeout(() => {
      box.style.opacity = "0";
      box.style.transform = "translateX(-50%) scale(1.0)";
    }, 420);
  }

  function showComboBadge(c) {
    if (c > 0 && c % 10 === 0) {
      const el = document.createElement("div");
      Object.assign(el.style, {
        position: "fixed",
        right: "12px",
        top: "52px",
        background: "rgba(10,16,24,.75)",
        color: "#ffd166",
        font: "800 12px system-ui",
        padding: "6px 10px",
        borderRadius: "10px",
        zIndex: 10000,
        opacity: "0",
        transform: "translateY(-6px)",
        transition: "opacity .15s, transform .15s",
      });
      el.textContent = `Combo x${Math.floor(c / 10) + 1}`;
      document.body.appendChild(el);
      requestAnimationFrame(() => {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
      });
      setTimeout(() => {
        el.style.opacity = "0";
        el.style.transform = "translateY(-6px)";
        setTimeout(() => safeRemove(el), 180);
      }, 800);
    }
  }

  // ==========================
  // Scene / Hit Line
  // ==========================
  function ensureHitLine() {
    if (hitLine && hitLine.parentNode) return hitLine;
    const arena = byId("arena");
    if (!arena) return null;
    // เส้น HIT LINE เขียวเรืองแสง
    const line = document.createElement("a-entity");
    line.setAttribute(
      "geometry",
      "primitive: box; width: 2.8; height: 0.02; depth: 0.02"
    );
    line.setAttribute(
      "material",
      "color: #20ffa0; opacity: 0.95; emissive: #20ffa0; emissiveIntensity: 0.85; transparent: true"
    );
    line.setAttribute("position", `0 ${HIT_Y} -2.2`);
    line.setAttribute(
      "animation__pulse",
      "property: scale; dir: alternate; to: 1.02 1.2 1.02; loop: true; dur: 850; easing: easeInOutSine"
    );
    arena.appendChild(line);
    hitLine = line;
    return hitLine;
  }

  // flash เส้นตอนโดน
  function flashHitLine(kind) {
    const ln = ensureHitLine();
    if (!ln) return;
    const c =
      kind === "perfect"
        ? "#20ffa0"
        : kind === "miss"
        ? "#ff5577"
        : "#9bd1ff";
    ln.setAttribute(
      "material",
      `color: ${c}; opacity: 1; emissive: ${c}; emissiveIntensity: 1.1; transparent: true`
    );
    setTimeout(() => {
      ln.setAttribute(
        "material",
        "color: #20ffa0; opacity: 0.95; emissive: #20ffa0; emissiveIntensity: 0.85; transparent: true"
      );
    }, 120);
  }

  // ==========================
  // Notes (spawn/move/hit)
  // ==========================
  function spawnNote() {
    const arena = byId("arena");
    if (!arena) return;
    // ให้น้อย → ค่อย ๆ ถี่ขึ้นตามเวลา (ใช้ speedMul)
    const laneX = (RND() * 2.6 - 1.3).toFixed(2);
    const startY = 2.2;
    const z = -2.2;

    const el = document.createElement("a-sphere");
    const color = COLORS[colorIndex++ % COLORS.length];
    el.classList.add("rb-note", "clickable");
    el.setAttribute("radius", "0.14"); // ใหญ่ขึ้น
    el.setAttribute(
      "material",
      `color: ${color}; metalness: 0.2; roughness: 0.35; emissive: ${color}; emissiveIntensity: 0.25`
    );
    el.setAttribute("position", `${laneX} ${startY} ${z}`);
    arena.appendChild(el);

    notes.push({
      el,
      lane: laneX,
      speed: SP.fall * speedMul, // ยิ่งเล่นไป speedMul จะเพิ่ม
      bornAt: performance.now(),
      judged: false,
    });
  }

  function missNote(i) {
    const n = notes[i];
    if (!n) return;
    n.judged = true;
    showJudge("miss");
    flashHitLine("miss");
    play(SFX.miss);
    combo = 0;
    updateHUD();
    safeRemove(n.el);
  }

  function applyHit(i, kind) {
    const n = notes[i];
    if (!n) return;
    n.judged = true;

    // คะแนน/คอมโบ
    if (kind === "perfect") {
      score += 30;
      play(SFX.perfect);
    } else if (kind === "good") {
      score += 18;
      play(SFX.good);
    } else {
      // late
      score += 8;
      play(SFX.hit);
    }
    combo += 1;
    if (combo > maxCombo) maxCombo = combo;
    updateHUD();
    showComboBadge(combo);

    showJudge(kind);
    flashHitLine(kind);

    // ลบโน้ต
    safeRemove(n.el);
  }

  function hitAssistPick(rayHits) {
    // หา note ที่ใกล้ HIT_Y ที่สุดภายในแนวตั้ง (ช่วยเล็ง)
    let bestIdx = -1;
    let bestDy = 1e9;
    for (let h of rayHits) {
      let obj = h.object;
      while (obj && !obj.el) obj = obj.parent;
      if (!obj || !obj.el || !obj.el.classList.contains("rb-note")) continue;
      const idx = notes.findIndex((it) => it.el === obj.el);
      if (idx < 0 || notes[idx].judged) continue;
      const pos = obj.el.object3D.getWorldPosition(new THREE.Vector3());
      const dy = Math.abs(pos.y - HIT_Y);
      if (dy < bestDy) {
        bestDy = dy;
        bestIdx = idx;
      }
    }
    return { bestIdx, bestDy };
  }

  function judgeFromDy(dy) {
    if (dy <= JUDGE.perfect) return "perfect";
    if (dy <= JUDGE.good) return "good";
    if (dy <= JUDGE.late) return "late";
    return "miss";
  }

  // ==========================
  // Game Loop / Spawner
  // ==========================
  function loopMove() {
    if (!running || paused) return;
    const now = performance.now();
    const arena = byId("arena");
    if (!arena) return;

    for (let i = notes.length - 1; i >= 0; i--) {
      const n = notes[i];
      if (!n || !n.el || n.judged) continue;
      const o = n.el.object3D.position;
      // ตกด้วย delta ~ 60fps
      // speed (เมตร/วินาที) → เร่งขึ้นจาก speedMul
      o.y -= 0.015 * n.speed;
      n.el.object3D.position.set(o.x, o.y, o.z);

      // เลยเส้น HIT มากไป → MISS
      if (o.y < HIT_Y - 0.38 && !n.judged) {
        missNote(i);
      }
    }
    requestAnimationFrame(loopMove);
  }

  function startSpawn() {
    // ห่างมาก → ถี่ขึ้น (ใช้ spawn interval / speedMul)
    const base = SP.spawn; // ms
    const interval = clamp(Math.round(base / speedMul), 420, 1300);
    clearInterval(spawnTimer);
    spawnTimer = setInterval(spawnNote, interval);
  }

  // ==========================
  // Start / Pause / End
  // ==========================
  function resetGame() {
    clearInterval(spawnTimer);
    clearInterval(secTimer);
    // ลบโน้ตทั้งหมด
    const arena = byId("arena");
    if (arena) {
      Array.from(arena.querySelectorAll(".rb-note")).forEach(safeRemove);
      safeRemove(hitLine);
      hitLine = null;
    }
    notes.length = 0;

    score = 0;
    combo = 0;
    maxCombo = 0;
    timeLeft = 60;
    speedMul = 1.0;
    updateHUD();

    const res = byId("results");
    if (res) res.style.display = "none";
  }

  function startGame() {
    if (running) return;
    running = true;
    paused = false;

    // เลือก speed mode
    const sel = byId("speedSel");
    const key = (sel && sel.value) || "standard";
    SP = SPEED_MODE[key] || SPEED_MODE.standard;

    resetGame();
    ensureHitLine();
    badge(`Start · ${SP.title}`);
    play(SFX.ui);

    // วนเวลา
    secTimer = setInterval(() => {
      if (!running || paused) return;
      timeLeft--;
      // เร่งขึ้นเล็กน้อย
      speedMul = clamp(speedMul + SP.rampEachSec, 1.0, 2.0);
      startSpawn(); // อัปเดต interval ให้สัมพันธ์กับ speed ปัจจุบัน
      updateHUD();
      if (timeLeft <= 0) endGame();
    }, 1000);

    startSpawn();
    requestAnimationFrame(loopMove);
  }

  function pauseGame() {
    if (!running) return;
    paused = !paused;
    badge(paused ? "Paused" : "Resume");
    play(SFX.ui);
    if (!paused) {
      startSpawn();
      requestAnimationFrame(loopMove);
    } else {
      clearInterval(spawnTimer);
    }
  }

  function endGame() {
    running = false;
    clearInterval(spawnTimer);
    clearInterval(secTimer);

    // แสดงผล
    const res = byId("results");
    if (res) res.style.display = "flex";
    byId("rScore") && (byId("rScore").textContent = score);
    byId("rMaxCombo") && (byId("rMaxCombo").textContent = maxCombo);
    // accuracy (แบบง่าย: สัดส่วน miss/hit จากโน้ตทั้งหมดที่เกิด)
    const total = notes.length;
    const judged = total; // เราพิจารณาว่าที่ spawn มาแล้วเป็นฐาน
    // (ถ้าอยากละเอียด: นับเฉพาะที่ตัดสินแล้ว)
    const acc = Math.max(
      0,
      Math.min(100, Math.round((score / Math.max(1, total * 30)) * 100))
    );
    byId("rAcc") && (byId("rAcc").textContent = acc + "%");
    play(SFX.ui);
  }

  // ==========================
  // Pointer Raycast (Mouse/Touch)
  // ==========================
  (function installPointer() {
    const sceneEl = document.querySelector("a-scene");
    if (!sceneEl) return;
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function pick(clientX, clientY) {
      const cam = sceneEl.camera;
      if (!cam) return [];
      mouse.x = (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;
      raycaster.setFromCamera(mouse, cam);

      const clickable = Array.from(document.querySelectorAll(".clickable"))
        .map((el) => el.object3D)
        .filter(Boolean);

      const objects = [];
      clickable.forEach((o) => o.traverse((c) => objects.push(c)));
      return raycaster.intersectObjects(objects, true);
    }

    function handlePointer(x, y) {
      if (!running || paused) return;

      const hits = pick(x, y);
      // Hit assist: เลือกโน้ตที่ “ใกล้ HIT_Y” ที่สุดจากสิ่งที่ยิงโดน
      const { bestIdx, bestDy } = hitAssistPick(hits);
      if (bestIdx < 0) {
        // ยิงไม่โดน object 3D → ลองช่วยด้วยการเช็ค “โน้ตที่อยู่ใกล้ HIT_Y ที่สุด” ทั่วทั้งสนาม
        let idx = -1,
          dist = 1e9;
        for (let i = 0; i < notes.length; i++) {
          const n = notes[i];
          if (!n || !n.el || n.judged) continue;
          const p = n.el.object3D.getWorldPosition(new THREE.Vector3());
          const dy = Math.abs(p.y - HIT_Y);
          if (dy < dist) {
            dist = dy;
            idx = i;
          }
        }
        if (idx >= 0) {
          const kind = judgeFromDy(dist);
          if (kind === "miss") {
            // ถ้าห่างเกินไปจริง ๆ ไม่ตัดสิน
            return;
          }
          applyHit(idx, kind);
        }
        return;
      }
      const pos = notes[bestIdx].el
        .object3D.getWorldPosition(new THREE.Vector3());
      const dy = Math.abs(pos.y - HIT_Y);
      const kind = judgeFromDy(dy);
      if (kind === "miss") return; // ห่างเกินไป
      applyHit(bestIdx, kind);
    }

    window.addEventListener(
      "mousedown",
      (e) => handlePointer(e.clientX, e.clientY),
      { passive: true }
    );
    window.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches && e.touches[0];
        if (!t) return;
        handlePointer(t.clientX, t.clientY);
      },
      { passive: true }
    );
  })();

  // ==========================
  // Buttons / DOM Controls
  // ==========================
  function wireButtons() {
    const startBtn = byId("startBtn");
    const pauseBtn = byId("pauseBtn");
    const backBtn = byId("backBtn");

    startBtn && startBtn.addEventListener("click", startGame, { passive: true });
    pauseBtn && pauseBtn.addEventListener("click", pauseGame, { passive: true });
    backBtn &&
      backBtn.addEventListener(
        "click",
        () => {
          window.location.href = HUB_URL; // กลับ hub ให้ถูก
        },
        { passive: true }
      );

    // ป้องกัน Enter VR ปิดบัง: จัดปุ่มให้อยู่ข้าง select (อยู่ใน html)
    const speedSel = byId("speedSel");
    if (speedSel) {
      speedSel.addEventListener(
        "change",
        () => {
          badge(`Speed: ${SPEED_MODE[speedSel.value]?.title || "Standard"}`);
          play(SFX.ui);
        },
        { passive: true }
      );
    }
  }

  // ==========================
  // Lifecycle
  // ==========================
  document.addEventListener("DOMContentLoaded", () => {
    wireButtons();
    ensureHitLine();
    updateHUD();
  });

  // กดคีย์ช่วยควบคุม
  document.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      // Space/Enter = hit assist กลางจอ
      const x = window.innerWidth / 2;
      const y = (window.innerHeight * 3) / 4;
      const ev = new MouseEvent("mousedown", { clientX: x, clientY: y });
      window.dispatchEvent(ev);
    } else if (e.key === "p" || e.key === "P") {
      pauseGame();
    } else if (e.key === "s" || e.key === "S") {
      startGame();
    }
  });

  // ปิดหน้าหน่วยความจำ
  window.addEventListener("beforeunload", () => {
    try {
      clearInterval(spawnTimer);
      clearInterval(secTimer);
    } catch (_) {}
  });
})();
