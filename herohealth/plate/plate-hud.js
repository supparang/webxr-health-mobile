// === /herohealth/plate/plate-hud.js ===
// Balanced Plate VR — HUD Binder (PRODUCTION)
// ✅ Safe binder: ฟัง event กลางแล้วอัปเดต HUD โดยไม่พังถ้า element บางตัวไม่มี
// ✅ รองรับ view modes: view=pc|mobile|vr|cvr  (ใส่ class ให้ body)
// ✅ Enter VR helper: fullscreen/orientation best-effort + scene.enterVR()
// ✅ Judge Toast: โชว์ข้อความสั้น ๆ (good/warn/bad)
// ✅ Quest UI: goal/mini title + count + fill + mini timer
// ✅ Coach UI: msg + mood (happy/neutral/sad/fever)

'use strict';

(function (root) {
  const doc = root.document;
  if (!doc) return;

  const qs  = (id) => doc.getElementById(id);
  const qsa = (sel) => Array.from(doc.querySelectorAll(sel));

  function setText(id, v){
    const el = qs(id);
    if (el) el.textContent = String(v ?? '');
  }
  function clamp(v, a, b){
    v = Number(v) || 0;
    return v < a ? a : (v > b ? b : v);
  }

  // -------------------- View mode (PC/Mobile/VR/cVR) --------------------
  function getParam(name, def=null){
    try{ return new URL(location.href).searchParams.get(name) ?? def; }
    catch(e){ return def; }
  }

  function detectDefaultView(){
    // ถ้ามี view=... ก็ใช้เลย (handled outside)
    const ua = (navigator.userAgent || '').toLowerCase();
    const touch = (navigator.maxTouchPoints || 0) > 0;
    const isMobile = /android|iphone|ipad|ipod/i.test(ua) || (touch && Math.min(root.innerWidth||999, root.innerHeight||999) < 900);
    return isMobile ? 'mobile' : 'pc';
  }

  function setBodyView(view){
    const b = doc.body;
    if(!b) return;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    b.classList.add(`view-${view}`);
  }

  // init view class
  (function initView(){
    const v = String(getParam('view', '') || '').toLowerCase();
    if (v === 'pc' || v === 'mobile' || v === 'vr' || v === 'cvr') setBodyView(v);
    else setBodyView(detectDefaultView());
  })();

  // -------------------- Fullscreen / Orientation helpers --------------------
  function isFs(){
    return !!(doc.fullscreenElement || doc.webkitFullscreenElement);
  }
  async function enterFs(){
    try{
      const el = doc.documentElement;
      if (isFs()) return true;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      return true;
    }catch(e){ return false; }
  }

  async function lockOrientationLandscape(){
    // best effort: บางเครื่อง/เบราว์เซอร์ล็อกไม่ได้
    try{
      if (screen?.orientation?.lock) {
        await screen.orientation.lock('landscape');
        return true;
      }
    }catch(e){}
    return false;
  }

  async function enterVR(){
    try{
      const scene = doc.querySelector('a-scene');
      if (scene && typeof scene.enterVR === 'function') {
        await enterFs();               // ช่วยให้ “Enter VR” ดูไม่งงในมือถือบางรุ่น
        await lockOrientationLandscape();
        scene.enterVR();
        return true;
      }
    }catch(e){}
    return false;
  }

  function bindEnterVrButtons(){
    // รองรับทั้ง btnEnterVR (HUD) และ btnEnterVR2 (หน้า Start)
    const b1 = qs('btnEnterVR');
    const b2 = qs('btnEnterVR2');
    if (b1) b1.addEventListener('click', enterVR, { passive:true });
    if (b2) b2.addEventListener('click', enterVR, { passive:true });

    // ถ้าเข้า VR แล้ว อยากให้ body เป็น view-vr อัตโนมัติ (optional)
    try{
      const scene = doc.querySelector('a-scene');
      if(scene){
        scene.addEventListener('enter-vr', ()=> setBodyView(getParam('view','vr') === 'cvr' ? 'cvr' : 'vr'));
        scene.addEventListener('exit-vr',  ()=> setBodyView(getParam('view', detectDefaultView())));
      }
    }catch(e){}
  }

  // -------------------- Judge Toast --------------------
  function ensureJudgeToast(){
    let el = doc.querySelector('.plate-judge-toast');
    if (el) return el;
    el = doc.createElement('div');
    el.className = 'plate-judge-toast';
    el.style.cssText = `
      position:fixed;
      left:50%;
      top:calc(10px + env(safe-area-inset-top, 0px));
      transform:translateX(-50%) translateY(-6px);
      z-index:9999;
      padding:10px 12px;
      border-radius:999px;
      border:1px solid rgba(148,163,184,.18);
      background:rgba(2,6,23,.85);
      color:rgba(229,231,235,.95);
      font: 1100 12px/1.2 system-ui,-apple-system,Segoe UI,Roboto,"Noto Sans Thai",sans-serif;
      box-shadow:0 22px 70px rgba(0,0,0,.45);
      opacity:0;
      pointer-events:none;
      transition: opacity .14s ease, transform .14s ease, filter .14s ease;
      white-space:nowrap;
      max-width:min(92vw, 720px);
      overflow:hidden;
      text-overflow:ellipsis;
    `;
    doc.body.appendChild(el);
    return el;
  }

  function showJudge(text, kind){
    const el = ensureJudgeToast();
    el.textContent = String(text || '');
    // kind: good/warn/bad/info
    const k = String(kind || 'info');
    const border =
      k === 'good' ? 'rgba(34,197,94,.30)' :
      k === 'warn' ? 'rgba(250,204,21,.30)' :
      k === 'bad'  ? 'rgba(239,68,68,.30)' :
      'rgba(148,163,184,.18)';
    const bg =
      k === 'good' ? 'rgba(34,197,94,.12)' :
      k === 'warn' ? 'rgba(250,204,21,.12)' :
      k === 'bad'  ? 'rgba(239,68,68,.12)' :
      'rgba(2,6,23,.85)';

    el.style.borderColor = border;
    el.style.background = bg;

    el.style.opacity = '1';
    el.style.transform = 'translateX(-50%) translateY(0px)';
    clearTimeout(showJudge._t);
    showJudge._t = setTimeout(()=>{
      el.style.opacity = '0';
      el.style.transform = 'translateX(-50%) translateY(-6px)';
    }, 900);
  }

  // -------------------- HUD helpers --------------------
  function gradeClass(g){
    g = String(g||'').toUpperCase();
    if (g === 'SSS' || g === 'SS' || g === 'S' || g === 'A') return 'good';
    if (g === 'B') return 'warn';
    return 'bad';
  }

  function updateFeverBar(fever){
    const ff = qs('uiFeverFill');
    if (ff) ff.style.width = `${clamp(fever, 0, 100)}%`;
  }

  function updateGoalUI(goal){
    if (!goal) return;
    setText('uiGoalTitle', goal.title ?? '—');
    setText('uiGoalCount', `${goal.cur ?? 0}/${goal.target ?? 0}`);
    const gf = qs('uiGoalFill');
    if (gf) {
      const pct = goal.target ? (Number(goal.cur||0)/Number(goal.target||1))*100 : 0;
      gf.style.width = `${clamp(pct,0,100)}%`;
    }
  }

  function updateMiniUI(mini, miniCleared, miniTotal){
    if (!mini) {
      setText('uiMiniTitle', '—');
      setText('uiMiniTime', '--');
      const mf = qs('uiMiniFill'); if (mf) mf.style.width = '0%';
      return;
    }
    setText('uiMiniTitle', mini.title ?? '—');
    // uiMiniCount (ถ้ามี) บางแบบใช้โชว์ 0/0
    if (qs('uiMiniCount')) setText('uiMiniCount', `${miniCleared ?? 0}/${miniTotal ?? Math.max(1, (miniCleared??0)+1)}`);
    if (mini.timeLeft != null) setText('uiMiniTime', `${Math.ceil(Number(mini.timeLeft)||0)}s`);

    const mf = qs('uiMiniFill');
    if (mf && mini.target) {
      // progress = 1 - timeLeft/target
      const tl = clamp(Number(mini.timeLeft||0), 0, Number(mini.target||1));
      const pct = (1 - (tl / Number(mini.target||1))) * 100;
      mf.style.width = `${clamp(pct,0,100)}%`;
    }
  }

  function updateCoachUI(msg, mood){
    if (qs('coachMsg')) setText('coachMsg', msg ?? '');
    const img = qs('coachImg');
    if (img) {
      const m = String(mood || 'neutral');
      const map = {
        happy: './img/coach-happy.png',
        neutral: './img/coach-neutral.png',
        sad: './img/coach-sad.png',
        fever: './img/coach-fever.png',
      };
      img.src = map[m] || map.neutral;
    }
  }

  // -------------------- Events wiring --------------------
  function onScore(e){
    const d = e?.detail || {};
    // ตัวเลขหลัก (กันซ้ำ: plate.safe.js ก็เซ็ตเอง แต่เราเป็น backup + class/feel)
    if (d.score != null) setText('uiScore', d.score);
    if (d.combo != null) setText('uiCombo', d.combo);
    if (d.comboMax != null) setText('uiComboMax', d.comboMax);
    if (d.miss != null) setText('uiMiss', d.miss);

    if (d.plateHave != null) setText('uiPlateHave', d.plateHave);

    const gc = d.gCount;
    if (Array.isArray(gc)) {
      if (gc[0]!=null) setText('uiG1', gc[0]);
      if (gc[1]!=null) setText('uiG2', gc[1]);
      if (gc[2]!=null) setText('uiG3', gc[2]);
      if (gc[3]!=null) setText('uiG4', gc[3]);
      if (gc[4]!=null) setText('uiG5', gc[4]);
    }

    if (d.accuracyGoodPct != null) setText('uiAcc', `${Math.round(Number(d.accuracyGoodPct)||0)}%`);
    if (d.grade != null) {
      const g = String(d.grade).toUpperCase();
      setText('uiGrade', g);
      // เพิ่ม class ให้ gradeChip (ถ้าอยากใช้สีภายหลัง)
      const chip = doc.querySelector('.gradeChip');
      if (chip) {
        chip.classList.remove('good','warn','bad');
        chip.classList.add(gradeClass(g));
      }
    }

    if (d.timeLeftSec != null) setText('uiTime', Math.ceil(Number(d.timeLeftSec)||0));
    if (d.fever != null) updateFeverBar(d.fever);
    if (d.shield != null) setText('uiShieldN', d.shield);
  }

  function onTime(e){
    const d = e?.detail || {};
    if (d.timeLeftSec != null) setText('uiTime', Math.ceil(Number(d.timeLeftSec)||0));
  }

  function onQuest(e){
    const d = e?.detail || {};
    if (d.goal) updateGoalUI(d.goal);
    if (d.mini) updateMiniUI(d.mini, d.miniCleared, d.miniTotal);
  }

  function onCoach(e){
    const d = e?.detail || {};
    updateCoachUI(d.msg, d.mood);
  }

  function onJudge(e){
    const d = e?.detail || {};
    showJudge(d.text || d.msg || '', d.kind || 'info');
  }

  function onEnd(e){
    // plate.safe.js จะ showResult เอง แต่เราทำ fallback เผื่อ
    const d = e?.detail || {};
    const s = d.summary;
    if (!s) return;

    // result overlay ids
    const backdrop = qs('resultBackdrop');
    if (backdrop && backdrop.style.display === 'none') {
      backdrop.style.display = 'grid';
    }

    setText('rMode', s.runMode || s.run || 'play');
    setText('rGrade', s.grade || 'C');
    setText('rScore', s.scoreFinal ?? 0);
    setText('rMaxCombo', s.comboMax ?? 0);
    setText('rMiss', s.misses ?? 0);
    setText('rPerfect', (s.fastHitRatePct != null ? Math.round(s.fastHitRatePct) : 0) + '%');
    setText('rGoals', `${s.goalsCleared ?? 0}/${s.goalsTotal ?? 0}`);
    setText('rMinis', `${s.miniCleared ?? 0}/${s.miniTotal ?? 0}`);

    const counts = s.plate?.counts || [];
    setText('rG1', counts[0] ?? 0);
    setText('rG2', counts[1] ?? 0);
    setText('rG3', counts[2] ?? 0);
    setText('rG4', counts[3] ?? 0);
    setText('rG5', counts[4] ?? 0);
    setText('rGTotal', s.plate?.total ?? 0);
  }

  // -------------------- Init --------------------
  function init(){
    bindEnterVrButtons();

    // listen events
    root.addEventListener('hha:score', onScore);
    root.addEventListener('hha:time', onTime);
    root.addEventListener('quest:update', onQuest);
    root.addEventListener('hha:coach', onCoach);
    root.addEventListener('hha:judge', onJudge);
    root.addEventListener('hha:end', onEnd);

    // tiny: preview params for start overlay (backup)
    try{
      const diff = getParam('diff','normal');
      const time = getParam('time','90');
      const run  = (getParam('run', getParam('runMode','play')) || 'play');
      setText('uiDiffPreview', diff);
      setText('uiTimePreview', time);
      setText('uiRunPreview', run);
    }catch(e){}
  }

  // DOM ready safe
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init, { once:true });
  else init();

})(window);