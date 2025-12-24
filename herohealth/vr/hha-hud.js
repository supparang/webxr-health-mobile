// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR) — FIX-ALL
// ✅ Binds once (no double listeners)
// ✅ Supports multiple ID variants (new + legacy)
// ✅ Shows: time, score, combo, miss, grade, goal, mini, groupLabel, fever/shield (if FeverUI exists)
// ✅ Handles quest:update even when questOk:false (won't look stuck)
// ✅ Handles hha:end to show end summary if elements exist

(function (root) {
  'use strict';

  const doc = root.document;
  if (!doc) return;

  if (root.__HHA_HUD_BOUND__) return;
  root.__HHA_HUD_BOUND__ = true;

  const FeverUI =
    (root.GAME_MODULES && root.GAME_MODULES.FeverUI) ||
    root.FeverUI ||
    null;

  // ---------- helpers ----------
  const $ = (sel) => doc.querySelector(sel);
  const byId = (id) => doc.getElementById(id);

  function pickId(ids){
    for (let i=0;i<ids.length;i++){
      const el = byId(ids[i]);
      if (el) return el;
    }
    return null;
  }

  function setText(el, text){
    if (!el) return;
    el.textContent = (text == null) ? '' : String(text);
  }

  function setHTML(el, html){
    if (!el) return;
    el.innerHTML = (html == null) ? '' : String(html);
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  // ---------- map HUD elements (new + legacy) ----------
  const elTime  = pickId(['hudTime','timeLeft','hhaTimeLeft']);
  const elScore = pickId(['hudScore','score','hhaScore']);
  const elCombo = pickId(['hudCombo','combo','hhaCombo']);
  const elMiss  = pickId(['hudMiss','miss','hhaMiss']);

  const elGrade = pickId(['hudGrade','grade','hhaGrade']);

  const elGroup = pickId(['hudGroupLabel','groupLabel','hhaGroupLabel']);
  const elGoal  = pickId(['hudGoal','goalText','hhaGoal']);
  const elMini  = pickId(['hudMini','miniText','hhaMini']);

  // Optional end summary (new + legacy)
  const endWrap  = pickId(['endSummary','hhaEnd','endOverlay']);
  const endScore = pickId(['endScore','end_score','hhaEndScore']);
  const endCombo = pickId(['endComboMax','end_comboMax','hhaEndComboMax']);
  const endMiss  = pickId(['endMiss','end_miss','hhaEndMiss']);
  const endGrade = pickId(['endGrade','end_grade','hhaEndGrade']);
  const endGoals = pickId(['endGoals','end_goals','hhaEndGoals']);
  const endMinis = pickId(['endMinis','end_minis','hhaEndMinis']);

  // ---------- Fever UI ensure (safe) ----------
  function ensureFever(){
    try{
      if (FeverUI && FeverUI.ensureFeverBar) FeverUI.ensureFeverBar();
    }catch{}
  }
  ensureFever();

  // ---------- state ----------
  let lastQuestKey = '';
  let lastGoalLabel = '';
  let lastMiniLabel = '';
  let lastGroupLabel = '';
  let lastGrade = '';

  function formatQuestLine(prefix, item){
    if (!item) return `${prefix}: --`;
    const prog = (item.prog == null) ? 0 : (item.prog|0);
    const tar  = (item.target == null) ? 0 : (item.target|0);
    let extra = '';
    if (item.tLeft != null){
      extra = ` <span class="mini-timer">(${item.tLeft}s)</span>`;
    }
    return `${prefix}: ${item.label} (${prog}/${tar})${extra}`;
  }

  // ---------- listeners ----------
  root.addEventListener('hha:time', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    const left = (d.left == null) ? null : (d.left|0);
    if (left != null) setText(elTime, left);
  });

  root.addEventListener('hha:score', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    if (d.score != null) setText(elScore, d.score|0);
    if (d.combo != null) setText(elCombo, d.combo|0);
    // miss naming variants
    const missVal = (d.misses != null) ? d.misses : (d.miss != null ? d.miss : null);
    if (missVal != null) setText(elMiss, missVal|0);

    // ensure fever bar exists even if loaded late
    ensureFever();

    // sync fever/shield if provided
    try{
      if (FeverUI){
        if (d.fever != null && FeverUI.setFever) FeverUI.setFever(clamp(d.fever,0,100));
        if (d.shield != null && FeverUI.setShield) FeverUI.setShield(Math.max(0, d.shield|0));
      }
    }catch{}
  });

  root.addEventListener('hha:fever', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    ensureFever();
    try{
      if (FeverUI){
        if (d.value != null && FeverUI.setFever) FeverUI.setFever(clamp(d.value,0,100));
        if (d.on != null && FeverUI.setFeverActive) FeverUI.setFeverActive(!!d.on);
        if (d.shield != null && FeverUI.setShield) FeverUI.setShield(Math.max(0, d.shield|0));
      }
    }catch{}
  });

  root.addEventListener('hha:rank', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    const g = (d.grade == null) ? '' : String(d.grade);
    if (g && g !== lastGrade){
      lastGrade = g;
      setText(elGrade, g);
    }
  });

  root.addEventListener('quest:update', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};

    // If quest missing, still show placeholders (so UI doesn't feel broken)
    const questOk = !!d.questOk;

    const groupLabel = d.groupLabel ? String(d.groupLabel) : '';
    const goal = d.goal || null;
    const mini = d.mini || null;

    const gLine = groupLabel ? ('หมู่ปัจจุบัน: ' + groupLabel) : (questOk ? 'หมู่ปัจจุบัน: --' : '⚠️ QUEST ไม่พร้อม');
    const goalLine = formatQuestLine('Goal', goal);
    const miniLine = formatQuestLine('Mini', mini);

    const key = [gLine, goalLine, miniLine].join('|');
    if (key === lastQuestKey) return;
    lastQuestKey = key;

    if (elGroup){
      if (gLine !== lastGroupLabel){
        lastGroupLabel = gLine;
        setText(elGroup, gLine);
      }
    }

    if (elGoal){
      if (goalLine !== lastGoalLabel){
        lastGoalLabel = goalLine;
        setText(elGoal, goalLine);
      }
    }

    if (elMini){
      // allow timer highlight via HTML (mini-timer span)
      if (miniLine !== lastMiniLabel){
        lastMiniLabel = miniLine;
        if (mini && mini.tLeft != null) setHTML(elMini, miniLine);
        else setText(elMini, miniLine);
      }
    }
  });

  root.addEventListener('hha:end', (ev) => {
    const d = ev && ev.detail ? ev.detail : {};
    // show end summary if exists
    if (endWrap){
      try{
        endWrap.style.display = 'flex';
      }catch{}
    }

    if (endScore && d.scoreFinal != null) setText(endScore, d.scoreFinal|0);
    if (endCombo && d.comboMax != null) setText(endCombo, d.comboMax|0);

    const missVal = (d.misses != null) ? d.misses : (d.miss != null ? d.miss : null);
    if (endMiss && missVal != null) setText(endMiss, missVal|0);

    if (endGrade && d.grade != null) setText(endGrade, String(d.grade));

    if (endGoals){
      const a = (d.goalsCleared != null) ? (d.goalsCleared|0) : 0;
      const b = (d.goalsTotal != null) ? (d.goalsTotal|0) : 0;
      setText(endGoals, `${a}/${b}`);
    }
    if (endMinis){
      const a = (d.miniCleared != null) ? (d.miniCleared|0) : 0;
      const b = (d.miniTotal != null) ? (d.miniTotal|0) : 0;
      setText(endMinis, `${a}/${b}`);
    }
  });

  // Optional: allow close end overlay by clicking background (if it exists)
  if (endWrap){
    endWrap.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t && t.closest && t.closest('button')) return;
      try{ endWrap.style.display = 'none'; }catch{}
    });
  }

  // ---------- debug ping ----------
  try{
    // helps detect "hud file loaded but no events firing"
    root.dispatchEvent(new CustomEvent('hha:hud_ready', { detail: { ok:true } }));
  }catch{}

})(window);