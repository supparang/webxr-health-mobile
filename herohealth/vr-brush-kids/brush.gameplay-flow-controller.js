/* =========================================================
 * HeroHealth Brush Kids
 * /herohealth/vr-brush-kids/brush.gameplay-flow-controller.js
 * PATCH v20260515-P52-BRUSH-KIDS-GAMEPLAY-FLOW-CONTROLLER
 *
 * Purpose:
 * - คุม flow ทั้งเกมให้ชัด:
 *   prep → brush → mini-event → boss → summary
 * - กัน summary/target/boss โผล่ผิดจังหวะ
 * - ทำให้ UI title/lead/coach สอดคล้องกับ stage
 * - ไม่ override logic หลักของ brush.js แรงเกินไป
 * ========================================================= */

(function(){
  'use strict';

  const WIN = window;
  const DOC = document;
  const PATCH_ID = 'v20260515-P52-BRUSH-KIDS-GAMEPLAY-FLOW-CONTROLLER';

  const STAGES = {
    PREP: 'prep',
    BRUSH: 'brush',
    MINI: 'mini-event',
    BOSS: 'boss',
    SUMMARY: 'summary'
  };

  let currentStage = '';
  let lastStageAt = 0;
  let manualStage = '';

  function $(id){
    return DOC.getElementById(id);
  }

  function text(root){
    try{
      const r = root || DOC.body || DOC.documentElement;
      return r.innerText || r.textContent || '';
    }catch(_){
      return '';
    }
  }

  function qs(){
    try{ return new URLSearchParams(WIN.location.search || ''); }
    catch(_){ return new URLSearchParams(); }
  }

  function param(k, fallback){
    const p = qs();
    const v = p.get(k);
    return v === null || v === '' ? fallback : v;
  }

  function safeNum(v, fallback){
    const n = Number(v);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function numFromText(s, fallback){
    const m = String(s || '').match(/-?\d+(?:\.\d+)?/);
    if(!m) return fallback || 0;
    return safeNum(m[0], fallback || 0);
  }

  function visible(el){
    if(!el) return false;
    if(el.hidden) return false;

    try{
      const cs = WIN.getComputedStyle(el);
      if(cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0'){
        return false;
      }
    }catch(_){}

    return true;
  }

  function isSummaryOpen(){
    const modal = $('summaryModal');
    return visible(modal);
  }

  function getTopMetrics(){
    return {
      score: numFromText(text($('scoreText')), 0),
      combo: numFromText(text($('comboText')), 0),
      clean: numFromText(text($('cleanText')), 0),
      plaque: numFromText(text($('threatText')), 100),
      zoneText: text($('zoneText')) || '0/6',
      zoneDone: (() => {
        const raw = text($('zoneText')) || '0/6';
        const m = raw.match(/(\d+)\s*\/\s*(\d+)/);
        return m ? safeNum(m[1], 0) : 0;
      })(),
      zoneTotal: (() => {
        const raw = text($('zoneText')) || '0/6';
        const m = raw.match(/(\d+)\s*\/\s*(\d+)/);
        return m ? safeNum(m[2], 6) : 6;
      })(),
      time: numFromText(text($('timeText')), safeNum(param('time', 90), 90))
    };
  }

  function sceneId(){
    const stage = $('sceneStage');
    if(!stage) return '';

    return String(
      stage.getAttribute('data-scene') ||
      stage.dataset.scene ||
      ''
    ).toLowerCase();
  }

  function hasPrepMarkers(){
    const body = text();

    if(/เตรียมแปรงสีฟัน|ใส่ยาสีฟัน|พร้อมแปรงฟัน|พร้อมแล้ว ไปเล่นจริง|ลายยาสีฟัน|ยังไม่ได้ใส่ยาสีฟัน/i.test(body)){
      return true;
    }

    const btnStart = $('btnStart');
    if(visible(btnStart) && /เริ่มแปรงฟัน|พร้อม/i.test(text(btnStart))){
      const m = getTopMetrics();
      if(m.score <= 0 && m.combo <= 0 && m.clean <= 0 && m.zoneDone <= 0){
        return true;
      }
    }

    return false;
  }

  function hasMiniMarkers(){
    const body = text();

    if(/Scan Mission|Mini Mission|Monster Hunt|Combo Rush|Gumline Care|Slow Brush/i.test(body)){
      return true;
    }

    const scanLayer = $('scanTargetLayer');
    if(scanLayer && scanLayer.children && scanLayer.children.length > 0 && visible(scanLayer)){
      return true;
    }

    return false;
  }

  function hasBossMarkers(){
    const body = text();

    if(/Boss Break|Boss Battle|Cavity King|Boss Hits|Shield/i.test(body)){
      return true;
    }

    const bossLayer = $('bossVisualLayer');
    const weakLayer = $('bossWeakPointLayer');
    const bossCore = $('bossCore');

    if(visible(bossLayer) || visible(weakLayer) || visible(bossCore)){
      return true;
    }

    return sceneId().includes('boss');
  }

  function hasBrushMarkers(){
    const m = getTopMetrics();

    if(m.score > 0 || m.combo > 0 || m.clean > 0 || m.zoneDone > 0){
      return true;
    }

    const body = text();
    if(/แปรงโซน|กำลังแปรง|ลากแปรง|เลือกโซน/i.test(body)){
      return true;
    }

    return sceneId().includes('brush') || sceneId().includes('play');
  }

  function detectStage(){
    if(isSummaryOpen()) return STAGES.SUMMARY;

    /*
     * Manual stage ใช้ชั่วคราวหลังปุ่มเริ่ม/เหตุการณ์ dispatch
     * แต่ไม่ให้ล็อกตลอดไปเกิน 4 วินาที
     */
    if(manualStage && Date.now() - lastStageAt < 4000){
      if(manualStage !== STAGES.SUMMARY) return manualStage;
    }

    const run = String(param('run', '')).toLowerCase();
    const phase = String(param('phase', '')).toLowerCase();
    const stageParam = String(param('stage', '')).toLowerCase();

    if(phase === 'cooldown' || phase === 'warmup') return STAGES.PREP;

    if(stageParam === 'prep' || stageParam === 'howto' || stageParam === 'practice'){
      return STAGES.PREP;
    }

    if(run === 'menu' || run === 'prep' || run === 'howto'){
      return STAGES.PREP;
    }

    if(hasPrepMarkers()) return STAGES.PREP;
    if(hasBossMarkers()) return STAGES.BOSS;
    if(hasMiniMarkers()) return STAGES.MINI;
    if(hasBrushMarkers()) return STAGES.BRUSH;

    return STAGES.PREP;
  }

  function stageLabel(stage){
    switch(stage){
      case STAGES.PREP: return 'เตรียมแปรงสีฟัน';
      case STAGES.BRUSH: return 'แปรงฟันให้ครบทุกโซน';
      case STAGES.MINI: return 'ภารกิจพิเศษ';
      case STAGES.BOSS: return 'สู้บอสฟันผุ';
      case STAGES.SUMMARY: return 'ผลการแปรงฟันของฉัน';
      default: return 'Brush Hero Kids';
    }
  }

  function stageLead(stage){
    switch(stage){
      case STAGES.PREP:
        return 'ใส่ยาสีฟันให้พอดีก่อนเริ่มแปรงฟัน';
      case STAGES.BRUSH:
        return 'เลือกโซน แล้วลากแปรงบนฟันเพื่อทำความสะอาดคราบ';
      case STAGES.MINI:
        return 'ทำภารกิจสั้น ๆ ด้วยการใช้แปรงโดนเป้าพิเศษ';
      case STAGES.BOSS:
        return 'ใช้แปรงกำจัดจุดอ่อนบอส คราบ และมอนสเตอร์';
      case STAGES.SUMMARY:
        return 'ดูผลลัพธ์ แล้วเลือกเล่นใหม่ ทำ Cooldown หรือกลับ Hygiene Zone';
      default:
        return 'ดู Clean Teeth, Plaque, Combo และคำแนะนำ';
    }
  }

  function coachLine(stage){
    const m = getTopMetrics();

    switch(stage){
      case STAGES.PREP:
        return 'แตะหรือใส่ยาสีฟันให้พอดี แล้วกดเริ่มแปรงฟัน';
      case STAGES.BRUSH:
        return m.zoneDone > 0
          ? `ดีมาก! ทำได้ ${m.zoneDone}/${m.zoneTotal} โซนแล้ว ลองเก็บโซนต่อไป`
          : 'เลือกโซนก่อน แล้วลากแปรงช้า ๆ ให้ตรงจุด';
      case STAGES.MINI:
        return 'ใช้แปรงโดนเป้าพิเศษ แต่ยังต้องแปรงฟันเป็นหลักนะ';
      case STAGES.BOSS:
        return 'เล็งแปรงไปที่จุดอ่อนบอส และอย่าลืมกัน Cavity Storm';
      case STAGES.SUMMARY:
        return 'จบเกมแล้ว เลือกใส่ยาสีฟันใหม่ หรือทำ Cooldown';
      default:
        return 'พร้อมช่วยแนะนำการแปรงฟัน';
    }
  }

  function ensureStyle(){
    if($('hha-gameplay-flow-style')) return;

    const style = DOC.createElement('style');
    style.id = 'hha-gameplay-flow-style';
    style.textContent = `
      html[data-brush-flow-stage],
      body[data-brush-flow-stage]{
        --hha-flow-ready:1;
      }

      body[data-brush-flow-stage="prep"] #bossVisualLayer,
      body[data-brush-flow-stage="prep"] #bossWeakPointLayer,
      body[data-brush-flow-stage="prep"] #scanTargetLayer,
      body[data-brush-flow-stage="prep"] #fxLayer,
      body[data-brush-flow-stage="prep"] #scorePopupLayer{
        pointer-events:none !important;
      }

      body[data-brush-flow-stage="prep"] #bossVisualLayer,
      body[data-brush-flow-stage="prep"] #bossWeakPointLayer{
        opacity:0 !important;
      }

      body[data-brush-flow-stage="summary"] #brushInputLayer,
      body[data-brush-flow-stage="summary"] #scanTargetLayer,
      body[data-brush-flow-stage="summary"] #bossWeakPointLayer{
        pointer-events:none !important;
      }

      body[data-brush-flow-stage="brush"] [data-ring-zone],
      body[data-brush-flow-stage="mini-event"] [data-ring-zone],
      body[data-brush-flow-stage="boss"] [data-ring-zone]{
        pointer-events:auto;
      }

      body[data-brush-flow-stage="prep"] #sceneBadge::after{
        content:" • Prep";
      }

      body[data-brush-flow-stage="brush"] #sceneBadge::after{
        content:" • Brush";
      }

      body[data-brush-flow-stage="mini-event"] #sceneBadge::after{
        content:" • Mini";
      }

      body[data-brush-flow-stage="boss"] #sceneBadge::after{
        content:" • Boss";
      }

      body[data-brush-flow-stage="summary"] #sceneBadge::after{
        content:" • Summary";
      }

      .hha-flow-stage-chip{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        min-height:30px;
        padding:6px 10px;
        border-radius:999px;
        border:2px solid #bdf4ff;
        background:#ecfeff;
        color:#0f766e;
        font-size:12px;
        font-weight:1000;
      }

      body[data-brush-flow-stage="boss"] .hha-flow-stage-chip{
        background:#fff7ed;
        border-color:#fed7aa;
        color:#9a3412;
      }

      body[data-brush-flow-stage="summary"] .hha-flow-stage-chip{
        background:#f0fdf4;
        border-color:#bbf7d0;
        color:#166534;
      }
    `;
    DOC.head.appendChild(style);
  }

  function ensureFlowChip(){
    const row = DOC.querySelector('.badgeRow');
    if(!row) return null;

    let chip = $('hhaFlowStageChip');
    if(!chip){
      chip = DOC.createElement('span');
      chip.id = 'hhaFlowStageChip';
      chip.className = 'hha-flow-stage-chip';
      row.appendChild(chip);
    }

    return chip;
  }

  function setTextSafe(id, value){
    const el = $(id);
    if(el && value) el.textContent = value;
  }

  function setStage(stage, source){
    if(!stage) return;

    const now = Date.now();
    const changed = stage !== currentStage;

    currentStage = stage;
    lastStageAt = now;

    DOC.documentElement.setAttribute('data-brush-flow-stage', stage);
    if(DOC.body) DOC.body.setAttribute('data-brush-flow-stage', stage);

    const stageNode = $('sceneStage');
    if(stageNode){
      stageNode.setAttribute('data-flow-stage', stage);
    }

    const chip = ensureFlowChip();
    if(chip){
      chip.textContent = stageLabel(stage);
    }

    setTextSafe('sceneText', stage);
    setTextSafe('stageTitle', stageLabel(stage));
    setTextSafe('stageLead', stageLead(stage));

    const coach = $('coachLine');
    if(coach){
      coach.textContent = coachLine(stage);
    }

    if(changed){
      try{
        WIN.dispatchEvent(new CustomEvent('hha:brush-flow-stage-change', {
          detail:{
            patch: PATCH_ID,
            stage,
            previous: currentStage,
            source: source || 'detect',
            metrics: getTopMetrics()
          }
        }));
      }catch(_){}
    }

    try{
      WIN.HHA_BRUSH_GAMEPLAY_FLOW_STATE = {
        patch: PATCH_ID,
        stage,
        source: source || 'detect',
        metrics: getTopMetrics(),
        at: new Date().toISOString()
      };
    }catch(_){}
  }

  function refresh(){
    ensureStyle();
    const stage = detectStage();
    setStage(stage, 'refresh');
  }

  function setManualStage(stage, source){
    manualStage = stage;
    lastStageAt = Date.now();
    setStage(stage, source || 'manual');
  }

  function bindStartButton(){
    const btnStart = $('btnStart');
    if(!btnStart || btnStart.__hhaFlowStartBound) return;

    btnStart.__hhaFlowStartBound = true;

    btnStart.addEventListener('click', function(){
      /*
       * ไม่ preventDefault เพราะให้ brush.js ทำงานเดิม
       */
      setManualStage(STAGES.BRUSH, 'btnStart');
    }, false);
  }

  function bindReplayButtons(){
    Array.from(DOC.querySelectorAll('button,a,[role="button"]')).forEach((el) => {
      if(el.__hhaFlowReplayBound) return;

      const label = String(el.textContent || '').trim();
      if(!/เล่นอีกครั้ง|ใส่ยาสีฟันใหม่|Replay|ลองใหม่/i.test(label)) return;

      el.__hhaFlowReplayBound = true;
      el.addEventListener('click', function(){
        setManualStage(STAGES.PREP, 'replay');
      }, false);
    });
  }

  function bindGameEvents(){
    WIN.addEventListener('hha:brush-zone-selected', function(){
      if(currentStage !== STAGES.SUMMARY && currentStage !== STAGES.BOSS){
        setManualStage(STAGES.BRUSH, 'zone-selected');
      }
    }, true);

    WIN.addEventListener('hha:brush-boss-gate', function(){
      if(!isSummaryOpen()){
        setManualStage(STAGES.BOSS, 'boss-gate');
      }
    }, true);

    WIN.addEventListener('hha:brush-summary-final', function(){
      setManualStage(STAGES.SUMMARY, 'summary-final');
    }, true);

    WIN.addEventListener('hha:brush-summary-modal-compact-fix', function(){
      setManualStage(STAGES.SUMMARY, 'summary-modal');
    }, true);
  }

  function cleanupWrongStageArtifacts(){
    const stage = currentStage || detectStage();

    /*
     * Prep: ห้ามมีของว่อน/boss result/summary injected
     */
    if(stage === STAGES.PREP){
      [
        '#hha-brush-compact-override-card',
        '#hha-brush-compact-override-actions',
        '#hha-brush-boss-gate-card',
        '#hha-boss-compact-card'
      ].forEach(sel => {
        try{
          DOC.querySelectorAll(sel).forEach(el => el.remove());
        }catch(_){}
      });
    }

    /*
     * Summary: ห้ามรับ input แปรงต่อ
     */
    if(stage === STAGES.SUMMARY){
      const input = $('brushInputLayer');
      if(input){
        input.classList.remove('is-active');
        input.classList.add('is-idle');
      }
    }
  }

  function observe(){
    let timer = null;

    const run = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        refresh();
        cleanupWrongStageArtifacts();
        bindStartButton();
        bindReplayButtons();
      }, 100);
    };

    try{
      const mo = new MutationObserver(run);
      mo.observe(DOC.body || DOC.documentElement, {
        childList:true,
        subtree:true,
        attributes:true,
        characterData:true
      });
    }catch(_){}

    setTimeout(run, 80);
    setTimeout(run, 350);
    setTimeout(run, 900);
    setTimeout(run, 1600);
    setTimeout(run, 2800);
  }

  function expose(){
    WIN.HHA_BRUSH_GAMEPLAY_FLOW = {
      patch: PATCH_ID,
      stages: STAGES,
      refresh,
      detectStage,
      setStage: setManualStage,
      state(){
        return {
          patch: PATCH_ID,
          stage: currentStage,
          metrics: getTopMetrics(),
          scene: sceneId(),
          manualStage,
          at: new Date(lastStageAt || Date.now()).toISOString()
        };
      }
    };
  }

  function boot(){
    expose();
    ensureStyle();
    bindStartButton();
    bindReplayButtons();
    bindGameEvents();
    refresh();
    observe();
  }

  if(DOC.readyState === 'loading'){
    DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  }else{
    boot();
  }

})();
