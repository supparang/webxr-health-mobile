/*
  CSAI2102 AI Quest
  v1.8.1 — Canonical Gate & Support Runtime
  ------------------------------------------------------------
  Restores the runtime referenced by index.html and results.html.
  It reports the canonical path without bypassing graded mission gates.
*/
(function(){
  'use strict';

  const VERSION = 'v1.8.1-canonical-gate-support';
  const PROGRESS_KEY = 'CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';
  const PRACTICE_KEY = 'CSAI2102_AIQUEST_PRACTICE_MODE_V18';
  const REMEDIAL_KEY = 'CSAI2102_AIQUEST_REMEDIAL_RECORD_V18';
  const FLOW = [
    {id:'m1', no:'S1', label:'AI Awakening', required:[]},
    {id:'m2', no:'S2', label:'Agent Builder', required:['m1']},
    {id:'m3', no:'S3', label:'Search Maze', required:['m2']},
    {id:'b1', no:'B1', label:'Foundation Boss Gate', required:['m1','m2','m3']},
    {id:'m4', no:'S4', label:'Route Cost Challenge', required:['b1']},
    {id:'m5', no:'S5', label:'A* Rescue Mission', required:['m4']},
    {id:'m6', no:'S6', label:'Knowledge Base Forge', required:['m5']},
    {id:'b2', no:'B2', label:'Applied AI Boss Gate', required:['m4','m5','m6']}
  ];

  function readJson(key, fallback){
    try{
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value == null ? fallback : value;
    }catch(error){
      return fallback;
    }
  }

  function writeJson(key, value){
    try{
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    }catch(error){
      return false;
    }
  }

  function progress(){
    const value = readJson(PROGRESS_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function passed(state, id){
    const source = state || progress();
    return !!(
      (source.completed && source.completed[id]) ||
      (source.stars && Number(source.stars[id] || 0) > 0) ||
      (source.mastered && source.mastered[id]) ||
      (source.bestScore && Number(source.bestScore[id] || 0) >= 60)
    );
  }

  function unlocked(state, id){
    const item = FLOW.find(row => row.id === id);
    if(!item) return false;
    return item.required.every(requiredId => passed(state, requiredId));
  }

  function nextStage(state){
    const source = state || progress();
    return FLOW.find(item => !passed(source, item.id)) || FLOW[FLOW.length - 1];
  }

  function isPracticeMode(){
    return readJson(PRACTICE_KEY, false) === true;
  }

  function setPracticeMode(enabled){
    return writeJson(PRACTICE_KEY, !!enabled);
  }

  function readRemedial(){
    const value = readJson(REMEDIAL_KEY, {});
    return value && typeof value === 'object' ? value : {};
  }

  function markRemedialPassed(missionId, selfScore){
    const records = readRemedial();
    const id = String(missionId || 'm1').toLowerCase();
    records[id] = {
      completed:true,
      selfScore:Math.max(0, Math.min(100, Number(selfScore || 0))),
      completedAt:new Date().toISOString(),
      note:'Remedial completion is learning support only; it does not replace the graded mission or Boss Gate.'
    };
    writeJson(REMEDIAL_KEY, records);
    return records[id];
  }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'
    }[character]));
  }

  function stageStatus(state, records, item){
    if(passed(state, item.id)) return {label:'ผ่านแล้ว', cls:'ok', detail:'มีผลการเล่นอย่างน้อย 1 ดาว'};
    if(unlocked(state, item.id)) return {label:'พร้อมเริ่ม', cls:'open', detail:'พร้อมทำภารกิจตามลำดับ'};
    const remedial = records[item.id];
    if(remedial && remedial.completed){
      return {label:'ทบทวนแล้ว', cls:'support', detail:'ยังต้องผ่านภารกิจหลักเพื่อปลดล็อก'};
    }
    const missing = item.required.filter(id => !passed(state, id));
    return {label:'ล็อก', cls:'locked', detail:'รอผ่าน ' + missing.map(id => (FLOW.find(row => row.id === id) || {no:id}).no).join(', ')};
  }

  function injectStyle(){
    if(document.getElementById('aiquestGateSupportStyle')) return;
    const style = document.createElement('style');
    style.id = 'aiquestGateSupportStyle';
    style.textContent = `
      .aqGateRule{margin:0 0 12px;padding:11px 12px;border:1px solid rgba(56,189,248,.28);border-radius:15px;background:rgba(56,189,248,.07);color:#dbeafe;line-height:1.55}
      .aqGateGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
      .aqGateItem{padding:10px;border:1px solid rgba(255,255,255,.12);border-radius:14px;background:rgba(255,255,255,.04);line-height:1.4}
      .aqGateItem b{display:block;color:#e0f2fe}.aqGateItem small{color:#a8b3c7}.aqGateItem.ok{border-color:rgba(52,211,153,.35)}.aqGateItem.open{border-color:rgba(56,189,248,.42)}.aqGateItem.support{border-color:rgba(251,191,36,.40)}.aqGateItem.locked{opacity:.68}
      .aqGateMeta{margin-top:10px;font-size:12px;color:#a8b3c7}@media(max-width:620px){.aqGateGrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function renderGatePanel(host){
    if(!host) return;
    injectStyle();
    const state = progress();
    const records = readRemedial();
    const next = nextStage(state);
    host.innerHTML = `
      <div class="aqGateRule"><b>เส้นทางมาตรฐาน:</b> S1 → S2 → S3 → B1 → S4 → S5 → S6 → B2<br>Boss B1 ประเมิน S1–S3 และ Boss B2 ประเมิน S4–S6</div>
      <div class="aqGateGrid">
        ${FLOW.map(item => {
          const status = stageStatus(state, records, item);
          return `<div class="aqGateItem ${status.cls}"><b>${escapeHtml(item.no)} · ${escapeHtml(item.label)}</b><small>${escapeHtml(status.label)} — ${escapeHtml(status.detail)}</small></div>`;
        }).join('')}
      </div>
      <div class="aqGateMeta">เป้าหมายถัดไป: <b>${escapeHtml(next.no)} ${escapeHtml(next.label)}</b> · Practice Mode: ${isPracticeMode() ? 'ON' : 'OFF'} · การทบทวนไม่แทนผลประเมินหลัก</div>
    `;
  }

  window.AIQuestGateSupport = {
    VERSION,
    FLOW:FLOW.slice(),
    passed,
    isUnlocked:unlocked,
    nextStage,
    isPracticeMode,
    setPracticeMode,
    markRemedialPassed,
    renderGatePanel
  };

  console.log('[AIQuest] ' + VERSION + ' loaded');
})();
