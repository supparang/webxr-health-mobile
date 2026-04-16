import { missionDB, pickAdaptiveMissionItem } from "./lesson-data.js";
import { state, clamp } from "./lesson-state.js";
import { getAdaptiveBossHpAdjustment } from "./lesson-ai.js";

export let finalBossState = { active: false, unitId: null, hp: 0, maxHp: 0, introShown: false };

export function isUnitFinal(id) {
  return id === 5 || id === 10 || id === 15;
}

export function getFinalBossPattern(id) {
  if (id === 5) return { code: "OVERCLOCK RUSH", desc: "สปีดสูง เวลาสั้นลง แต่คอมโบได้คะแนนแรง", color: "#ff7675", timeAdjust: -8 };
  if (id === 10) return { code: "SIGNAL SCRAMBLE", desc: "ตัวเลือกถูกสลับตำแหน่งทุกครั้ง อย่าเดาทางเดิม", color: "#74b9ff", timeAdjust: -4 };
  if (id === 15) return { code: "FINAL EXAM MIX", desc: "สุ่มโจทย์ผสมจาก Interview + Remote Work + Career Path", color: "#a29bfe", timeAdjust: 0 };
  return { code: "STANDARD FINAL", desc: "ตอบถูกต่อเนื่องเพื่อล้มบอส", color: "#f1c40f", timeAdjust: 0 };
}

function shuffleArray(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function remixChoiceMission(mission) {
  if (!mission || !Array.isArray(mission.choices) || !mission.answer) return mission;
  const letters = ["A", "B", "C"];
  const parsed = mission.choices.map((choice, idx) => {
    const stripped = typeof choice === "string" ? choice.replace(/^[A-C]:\s*/, "") : String(choice || "");
    return { originalLetter: letters[idx], text: stripped };
  });
  const correctEntry = parsed.find(item => item.originalLetter === mission.answer) || parsed[0];
  const shuffled = shuffleArray(parsed);
  mission.choices = shuffled.map((item, idx) => `${letters[idx]}: ${item.text}`);
  const newCorrectIndex = shuffled.findIndex(item => item.text === correctEntry.text);
  mission.answer = letters[Math.max(0, newCorrectIndex)];
  return mission;
}

function buildMixedFinalMission(mode, aiState) {
  const sourceIds = [13, 14, 15];
  const chosenId = sourceIds[Math.floor(Math.random() * sourceIds.length)];
  const chosenGroup = missionDB.find(m => m.id === chosenId);
  if (!chosenGroup) return null;
  const chosenItem = pickAdaptiveMissionItem(chosenId, mode, aiState);
  if (!chosenItem) return null;
  return { ...chosenItem, id: 15, type: chosenItem.type || chosenGroup.type, title: `Final Mix • ${chosenGroup.title}`, _mixedSourceId: chosenGroup.id };
}

export function prepareMissionForBossPattern(missionGroup, aiState) {
  let prepared = missionGroup.id === 15
    ? buildMixedFinalMission(state.gameDifficulty, aiState)
    : pickAdaptiveMissionItem(missionGroup.id, state.gameDifficulty, aiState);
  if (!prepared) return null;
  prepared = { ...prepared };
  if (missionGroup.id === 10) prepared = remixChoiceMission(prepared);
  prepared.id = missionGroup.id;
  prepared.type = prepared.type || missionGroup.type;
  prepared.title = prepared.title || missionGroup.title;
  const pattern = getFinalBossPattern(missionGroup.id);
  prepared._bossPattern = pattern.code;
  prepared._bossPatternDesc = pattern.desc;
  prepared._bossPatternColor = pattern.color;
  prepared._bossTimeAdjust = pattern.timeAdjust;
  return prepared;
}

export function applyUnitTheme(id) {
  const chip = document.getElementById("unit-theme-chip");
  const panel = document.getElementById("ui-container");
  const bossTitle = document.getElementById("boss-phase-title");
  const bossSub = document.getElementById("boss-phase-sub");
  const pattern = getFinalBossPattern(id);
  if (!chip || !panel || !bossTitle || !bossSub) return;
  if (isUnitFinal(id)) {
    chip.style.display = "block";
    chip.textContent = pattern.code;
    chip.style.borderColor = pattern.color;
    chip.style.color = pattern.color;
    panel.style.boxShadow = `0 0 26px ${pattern.color}55`;
    bossTitle.textContent = `👑 ${pattern.code}`;
    bossSub.textContent = pattern.desc;
  } else {
    chip.style.display = "none";
    panel.style.boxShadow = "0 0 20px rgba(0, 229, 255, 0.4)";
    bossTitle.textContent = "👑 FINAL BOSS PHASE";
    bossSub.textContent = "ตอบถูกหลายครั้งเพื่อล้มบอสประจำยูนิต";
  }
}

export function getFinalBossMaxHp(id) {
  if (!isUnitFinal(id)) return 0;
  let hp = state.gameDifficulty === "easy" ? 2 : (state.gameDifficulty === "hard" ? 4 : 3);
  hp += getAdaptiveBossHpAdjustment();
  return clamp(hp, 1, 5);
}

export function ensureFinalBossState(id) {
  if (!isUnitFinal(id)) {
    finalBossState = { active: false, unitId: null, hp: 0, maxHp: 0, introShown: false };
    return;
  }
  if (!finalBossState.active || finalBossState.unitId !== id || finalBossState.hp <= 0) {
    const maxHp = getFinalBossMaxHp(id);
    finalBossState = { active: true, unitId: id, hp: maxHp, maxHp, introShown: false };
  }
}

export function resetFinalBossState() {
  finalBossState = { active: false, unitId: null, hp: 0, maxHp: 0, introShown: false };
  renderFinalBossUI();
}

export function showBossCinematic(title, sub, ms = 1400) {
  const wrap = document.getElementById("boss-cinematic");
  const titleEl = document.getElementById("boss-cinematic-title");
  const subEl = document.getElementById("boss-cinematic-sub");
  if (!wrap || !titleEl || !subEl) return;
  titleEl.textContent = title;
  subEl.textContent = sub;
  wrap.classList.add("show");
  clearTimeout(showBossCinematic._timer);
  showBossCinematic._timer = setTimeout(() => wrap.classList.remove("show"), ms);
}

export function triggerImpactFlash(kind = "hit") {
  const flash = document.getElementById("impact-flash");
  const bossUi = document.getElementById("boss-phase-ui");
  if (!flash) return;
  flash.classList.remove("impact-hit", "impact-clear");
  if (bossUi) bossUi.classList.remove("boss-ui-pulse");
  void flash.offsetWidth;
  flash.classList.add(kind === "clear" ? "impact-clear" : "impact-hit");
  if (bossUi) bossUi.classList.add("boss-ui-pulse");
  setTimeout(() => {
    flash.classList.remove("impact-hit", "impact-clear");
    if (bossUi) bossUi.classList.remove("boss-ui-pulse");
  }, kind === "clear" ? 760 : 460);
}

export function animateBossActor(mode = "intro") {
  const boss = document.getElementById("hackerBoss");
  if (!boss) return;
  boss.removeAttribute("animation__scale");
  boss.removeAttribute("animation__colorPulse");
  if (mode === "intro") {
    boss.setAttribute("animation__scale", "property: scale; from: 0.7 0.7 0.7; to: 1.12 1.12 1.12; dur: 650; dir: alternate; loop: 1; easing: easeOutElastic");
  } else if (mode === "hit") {
    boss.setAttribute("animation__scale", "property: scale; from: 1 1 1; to: 1.22 1.22 1.22; dur: 180; dir: alternate; loop: 1; easing: easeOutQuad");
  } else if (mode === "clear") {
    boss.setAttribute("animation__scale", "property: scale; from: 1 1 1; to: 1.55 1.55 1.55; dur: 320; easing: easeOutQuad");
    boss.setAttribute("animation__colorPulse", "property: visible; to: false; delay: 260; dur: 20");
  }
}

export function maybeShowFinalBossIntro(id, playBossIntroSfx) {
  if (!finalBossState.active || !isUnitFinal(id) || finalBossState.introShown || finalBossState.hp !== finalBossState.maxHp) return;
  finalBossState.introShown = true;
  if (playBossIntroSfx) playBossIntroSfx();
  triggerImpactFlash("clear");
  animateBossActor("intro");
  const pattern = getFinalBossPattern(id);
  showBossCinematic(`UNIT ${id} FINAL BOSS`, `${pattern.code} — ${pattern.desc}`, 1700);
}

export function renderFinalBossUI() {
  const wrap = document.getElementById("boss-phase-ui");
  const fill = document.getElementById("boss-bar-fill");
  const hpText = document.getElementById("boss-hp-text");
  const sub = document.getElementById("boss-phase-sub");
  if (!wrap || !fill || !hpText || !sub) return;
  if (finalBossState.active && finalBossState.hp > 0) {
    wrap.style.display = "block";
    const ratio = Math.max(0, Math.min(1, finalBossState.hp / finalBossState.maxHp));
    fill.style.width = `${Math.round(ratio * 100)}%`;
    const pattern = getFinalBossPattern(finalBossState.unitId);
    hpText.innerText = `BOSS HP: ${finalBossState.hp} / ${finalBossState.maxHp}`;
    sub.innerText = `${pattern.code} — ${pattern.desc}`;
  } else {
    wrap.style.display = "none";
  }
}
