/*
  CSAI2102 AI Quest
  v3.6.2 Canonical Course Flow
  ------------------------------------------------------------
  Canonical sequence:
  S1 -> S2 -> S3 -> B1 -> S4 -> S5 -> S6 -> B2

  This module is intentionally the single runtime source of truth for:
  - roadmap presentation
  - mission unlock rules
  - Continue / next-step navigation
  - student-facing progress wording
*/
(function(){
  'use strict';

  const VERSION = 'v3.6.2-canonical-flow-continue-intercept';
  const STORAGE_KEY = 'CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';

  const FLOW = [
    {
      id:'m1', no:'S1', type:'session',
      title:'AI Awakening',
      topic:'AI / Automation / Sensor / Prediction',
      division:'Division 1: AI Foundations',
      unlock:'เริ่มได้ทันที'
    },
    {
      id:'m2', no:'S2', type:'session',
      title:'Agent Builder',
      topic:'Intelligent Agent / PEAS / Environment',
      division:'Division 1: AI Foundations',
      unlock:'ผ่าน S1'
    },
    {
      id:'m3', no:'S3', type:'session',
      title:'Search Maze',
      topic:'State Space / BFS / DFS / Goal Test',
      division:'Division 1: AI Foundations',
      unlock:'ผ่าน S2'
    },
    {
      id:'b1', no:'B1', type:'boss',
      title:'Foundation Boss Gate',
      topic:'AI / Agent / Search Foundations',
      division:'Boss Gate 1',
      unlock:'ผ่าน S1–S3'
    },
    {
      id:'m4', no:'S4', type:'session',
      title:'Route Cost Challenge',
      topic:'Uniform Cost Search / Weighted Graph / Priority Queue',
      division:'Division 2: Search & Knowledge',
      unlock:'ผ่าน B1'
    },
    {
      id:'m5', no:'S5', type:'session',
      title:'A* Rescue Mission',
      topic:'A* Search / Heuristic / f(n)=g(n)+h(n)',
      division:'Division 2: Search & Knowledge',
      unlock:'ผ่าน S4'
    },
    {
      id:'m6', no:'S6', type:'session',
      title:'Knowledge Base Forge',
      topic:'Knowledge Representation / Facts / Rules / Inference',
      division:'Division 2: Search & Knowledge',
      unlock:'ผ่าน S5'
    },
    {
      id:'b2', no:'B2', type:'boss',
      title:'Applied AI Boss Gate',
      topic:'Cost Search / A* / Knowledge Representation',
      division:'Boss Gate 2',
      unlock:'ผ่าน S4–S6'
    }
  ];

  const FLOW_IDS = new Set(FLOW.map(item => item.id));
  const FLOW_BY_ID = Object.fromEntries(FLOW.map(item => [item.id, item]));

  function $(selector){ return document.querySelector(selector); }

  function escapeHtml(value){
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;'
    }[ch]));
  }

  function readState(){
    try{
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    }catch(error){
      return {};
    }
  }

  function passed(state, id){
    const st = state || readState();
    return !!(
      (st.completed && st.completed[id]) ||
      (st.stars && Number(st.stars[id] || 0) > 0) ||
      (st.mastered && st.mastered[id]) ||
      (st.bestScore && Number(st.bestScore[id] || 0) >= 60)
    );
  }

  function mastered(state, id){
    const st = state || readState();
    return !!(st.mastered && st.mastered[id]);
  }

  function stars(state, id){
    const st = state || readState();
    return Number(st.stars && st.stars[id] || 0);
  }

  function bestScore(state, id){
    const st = state || readState();
    const value = st.bestScore && st.bestScore[id];
    return value == null || value === '' ? '-' : Number(value);
  }

  function courseUnlocked(id, inputState){
    const st = inputState || readState();
    if(id === 'm1') return true;
    if(id === 'm2') return passed(st, 'm1');
    if(id === 'm3') return passed(st, 'm2');
    if(id === 'b1') return ['m1','m2','m3'].every(key => passed(st, key));
    if(id === 'm4') return passed(st, 'b1');
    if(id === 'm5') return passed(st, 'm4');
    if(id === 'm6') return passed(st, 'm5');
    if(id === 'b2') return ['m4','m5','m6'].every(key => passed(st, key));
    return false;
  }

  function nextId(inputState){
    const st = inputState || readState();
    for(const item of FLOW){
      if(!passed(st, item.id)) return item.id;
    }
    return 'b2';
  }

  function showToast(message){
    try{
      if(typeof window.showToast === 'function'){
        window.showToast(message);
        return;
      }
    }catch(error){}
    console.log('[AIQuest]', message);
  }

  function profileIsReady(){
    try{
      return !(window.AIQuestStorage && typeof window.AIQuestStorage.isProfileReady === 'function') || window.AIQuestStorage.isProfileReady();
    }catch(error){
      return false;
    }
  }

  function launchNextMission(){
    const item = FLOW_BY_ID[nextId(readState())];
    if(!item) return false;

    if(!profileIsReady()){
      document.getElementById('profilePanel')?.scrollIntoView({behavior:'smooth', block:'center'});
      showToast('กรุณากรอก Student Profile ก่อนเริ่มเล่น');
      return false;
    }

    if(!courseUnlocked(item.id)){
      showToast(item.no + ' ยังล็อก: ' + item.unlock);
      return false;
    }

    if(typeof window.startMission === 'function'){
      window.startMission(item.id);
      return true;
    }

    showToast('ไม่พบ engine เริ่มเกม กรุณารีเฟรชหน้า');
    return false;
  }

  function patchCoreGateFunctions(){
    const currentUnlock = window.isUnlocked;
    if(typeof currentUnlock === 'function' && !currentUnlock.__aiquestCanonicalFlowV362){
      const legacyUnlock = currentUnlock;
      const patchedUnlock = function(stage){
        if(stage && FLOW_IDS.has(stage.id)) return courseUnlocked(stage.id);
        return legacyUnlock(stage);
      };
      patchedUnlock.__aiquestCanonicalFlowV362 = true;
      patchedUnlock.__legacyUnlock = legacyUnlock;
      window.isUnlocked = patchedUnlock;
    }

    const currentStart = window.startMission;
    if(typeof currentStart === 'function' && !currentStart.__aiquestCanonicalFlowV362){
      const legacyStart = currentStart;
      const patchedStart = function(id){
        if(FLOW_IDS.has(id) && !courseUnlocked(id)){
          const item = FLOW_BY_ID[id];
          showToast((item ? item.no : String(id).toUpperCase()) + ' ยังล็อก: ' + (item ? item.unlock : 'ผ่านด่านก่อนหน้า'));
          return false;
        }
        return legacyStart.apply(this, arguments);
      };
      patchedStart.__aiquestCanonicalFlowV362 = true;
      patchedStart.__legacyStart = legacyStart;
      window.startMission = patchedStart;
    }
  }

  function statusFor(state, item){
    const isPassed = passed(state, item.id);
    const isMastered = mastered(state, item.id);
    const isOpen = courseUnlocked(item.id, state);

    if(isMastered) return {label:'Mastery', cls:'mastery', detail:`Best ${bestScore(state, item.id)} • ${stars(state, item.id)} ดาว`};
    if(isPassed) return {label:'Passed', cls:'passed', detail:`Best ${bestScore(state, item.id)} • ${stars(state, item.id)} ดาว`};
    if(isOpen) return {label:item.type === 'boss' ? 'Boss Gate Open' : 'Open', cls:'open', detail:'พร้อมเริ่มภารกิจ'};
    return {label:'Locked', cls:'locked', detail:item.unlock};
  }

  function injectStyle(){
    if(document.getElementById('aiquestCanonicalFlowStyle')) return;
    const style = document.createElement('style');
    style.id = 'aiquestCanonicalFlowStyle';
    style.textContent = `
      #missionMap.aiquestCanonicalMap{display:block!important}
      #aiquestNativeTopBar{display:none!important}
      .aiqFlowRule{margin:0 0 14px;padding:13px 14px;border:1px solid rgba(56,189,248,.30);border-radius:18px;background:rgba(56,189,248,.07);line-height:1.65;color:#dbeafe}
      .aiqFlowRule b{color:#fef3c7}
      .aiqFlowDivision{margin:18px 0 9px;color:#dbeafe;font-weight:1000;display:flex;align-items:center;gap:9px}
      .aiqFlowDivision:before{content:'';width:10px;height:10px;border-radius:50%;background:linear-gradient(135deg,#38bdf8,#a78bfa);box-shadow:0 0 0 5px rgba(56,189,248,.08)}
      .aiqFlowGrid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
      .aiqFlowCard{min-height:158px;padding:13px;border:1px solid var(--line);border-radius:20px;background:linear-gradient(180deg,rgba(30,45,74,.95),rgba(17,28,50,.92));color:var(--text);text-align:left;display:flex;flex-direction:column;gap:7px;transition:.16s transform,.16s border-color,.16s opacity}
      .aiqFlowCard:hover:not(:disabled){transform:translateY(-2px);border-color:rgba(56,189,248,.58)}
      .aiqFlowCard:disabled{opacity:.52;cursor:not-allowed}
      .aiqFlowCard.boss{background:linear-gradient(180deg,rgba(88,28,135,.76),rgba(17,28,50,.94));border-color:rgba(167,139,250,.38)}
      .aiqFlowCard.passed{border-color:rgba(52,211,153,.42)}
      .aiqFlowCard.mastery{border-color:rgba(251,191,36,.74);box-shadow:0 0 0 1px rgba(251,191,36,.12) inset}
      .aiqFlowTop{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
      .aiqFlowNo{font-weight:1000;color:#bae6fd}
      .aiqFlowBadge{font-size:11px;font-weight:1000;border:1px solid rgba(255,255,255,.15);border-radius:999px;padding:4px 7px;background:rgba(255,255,255,.08);white-space:nowrap}
      .aiqFlowTitle{font-weight:1000;font-size:15px;line-height:1.2}
      .aiqFlowTopic{font-size:12px;line-height:1.42;color:var(--muted)}
      .aiqFlowDetail{font-size:11px;color:#dbeafe;margin-top:auto;line-height:1.35}
      .aiqFlowNext{margin:14px 0 4px;padding:10px 12px;border-radius:14px;border:1px solid rgba(251,191,36,.28);background:rgba(251,191,36,.08);color:#fef3c7;font-weight:900;line-height:1.5}
      .aiqProgressGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
      .aiqProgressCard{border:1px solid var(--line);border-radius:13px;padding:9px;background:rgba(255,255,255,.045);font-size:12px;line-height:1.45}
      .aiqProgressCard b{color:#dbeafe}
      @media(max-width:1050px){.aiqFlowGrid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:620px){.aiqFlowGrid,.aiqProgressGrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function flowCardHtml(state, item){
    const status = statusFor(state, item);
    const open = courseUnlocked(item.id, state) || passed(state, item.id);
    return `
      <button type="button" class="aiqFlowCard ${item.type === 'boss' ? 'boss' : ''} ${status.cls}" data-aiq-flow-id="${item.id}" ${open ? '' : 'disabled'}>
        <div class="aiqFlowTop">
          <span class="aiqFlowNo">${item.type === 'boss' ? '👾 ' : '🎯 '}${item.no}</span>
          <span class="aiqFlowBadge">${escapeHtml(status.label)}</span>
        </div>
        <div class="aiqFlowTitle">${escapeHtml(item.title)}</div>
        <div class="aiqFlowTopic">${escapeHtml(item.topic)}</div>
        <div class="aiqFlowDetail">${escapeHtml(status.detail)}</div>
      </button>
    `;
  }

  function renderCanonicalMissionMap(){
    const map = document.getElementById('missionMap');
    if(!map) return;

    const state = readState();
    const groups = [
      {label:'Division 1: AI Foundations', ids:['m1','m2','m3']},
      {label:'Boss Gate 1', ids:['b1']},
      {label:'Division 2: Search & Knowledge', ids:['m4','m5','m6']},
      {label:'Boss Gate 2', ids:['b2']}
    ];
    const next = FLOW_BY_ID[nextId(state)];

    map.classList.add('aiquestCanonicalMap');
    map.dataset.aiquestCanonicalFlow = VERSION;
    map.innerHTML = `
      <div class="aiqFlowRule">
        <b>Canonical Progress Rule:</b> S1 → S2 → S3 → B1 → S4 → S5 → S6 → B2
        <br>Boss B1 เปิดเมื่อผ่าน S1–S3 และ Boss B2 เปิดเมื่อผ่าน S4–S6
      </div>
      ${groups.map(group => `
        <div class="aiqFlowDivision">${escapeHtml(group.label)}</div>
        <div class="aiqFlowGrid">${group.ids.map(id => flowCardHtml(state, FLOW_BY_ID[id])).join('')}</div>
      `).join('')}
      <div class="aiqFlowNext">เป้าหมายถัดไป: ${escapeHtml(next.no)} ${escapeHtml(next.title)} — ${escapeHtml(next.unlock)}</div>
    `;

    map.querySelectorAll('[data-aiq-flow-id]').forEach(card => {
      card.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        const id = card.dataset.aiqFlowId;
        if(!profileIsReady()){
          document.getElementById('profilePanel')?.scrollIntoView({behavior:'smooth', block:'center'});
          showToast('กรุณากรอก Student Profile ก่อนเริ่มเล่น');
          return;
        }
        if(!courseUnlocked(id) && !passed(readState(), id)){
          showToast(FLOW_BY_ID[id].no + ' ยังล็อก: ' + FLOW_BY_ID[id].unlock);
          return;
        }
        if(typeof window.startMission === 'function') window.startMission(id);
        else showToast('ไม่พบ engine เริ่มเกม กรุณารีเฟรชหน้า');
      });
    });
  }

  function repairStartPanel(){
    const panel = document.getElementById('studentStartPanel');
    if(panel){
      const lead = panel.querySelector('p');
      if(lead){
        lead.innerHTML = '<b>Session 1–6 + Boss B1/B2</b> เปิดตามลำดับ: S1 → S2 → S3 → B1 → S4 → S5 → S6 → B2';
      }
    }

    const continueButton = document.getElementById('studentStartSession2');
    if(continueButton){
      continueButton.textContent = 'ไปด่านถัดไป';
      continueButton.onclick = function(event){
        event.preventDefault();
        launchNextMission();
      };
    }
  }

  function renderStudentFlowStatus(){
    const box = document.getElementById('studentProgressBox');
    if(!box) return;

    let profile = {};
    try{
      profile = window.AIQuestStorage ? window.AIQuestStorage.getProfile() : {};
    }catch(error){}

    const state = readState();
    const next = FLOW_BY_ID[nextId(state)];
    box.dataset.aiquestCanonicalFlow = VERSION;
    box.innerHTML = `
      <b>Student:</b> ${escapeHtml(profile.studentId || '-')} • ${escapeHtml(profile.studentName || '-')} • ${escapeHtml(profile.section || '-')}
      <br><b>เส้นทางมาตรฐาน:</b> S1 → S2 → S3 → B1 → S4 → S5 → S6 → B2
      <br><b>เป้าหมายถัดไป:</b> ${escapeHtml(next.no)} ${escapeHtml(next.title)}
      <div class="aiqProgressGrid">
        ${FLOW.map(item => {
          const status = statusFor(state, item);
          return `<div class="aiqProgressCard ${status.cls}"><b>${item.no}: ${escapeHtml(item.title)}</b><br>${escapeHtml(status.label)} • ${escapeHtml(status.detail)}</div>`;
        }).join('')}
      </div>
    `;
  }

  function repairQuickNavigation(){
    const legacyBar = document.getElementById('aiquestNativeTopBar');
    if(legacyBar) legacyBar.remove();

    const quickButton = document.getElementById('btnSession2Top');
    if(!quickButton) return;

    const state = readState();
    const item = FLOW_BY_ID[nextId(state)];
    quickButton.textContent = item ? `${item.no}: ${item.title}` : 'Continue';
    quickButton.title = item ? `ไป ${item.no} ตามลำดับรายวิชา` : 'ไปด่านถัดไป';

    if(!quickButton.__aiquestCanonicalFlowCaptureV362){
      quickButton.__aiquestCanonicalFlowCaptureV362 = true;
      quickButton.addEventListener('click', function(event){
        event.preventDefault();
        event.stopImmediatePropagation();
        launchNextMission();
      }, true);
    }

    quickButton.onclick = function(event){
      event.preventDefault();
      launchNextMission();
    };
  }

  function repairLegacyDetailText(){
    const panel = document.getElementById('detailPanel');
    if(!panel) return;
    const html = panel.innerHTML;
    const repaired = html
      .replace(/Boss Gate หลังผ่าน Session 1–2/g, 'Boss Gate หลังผ่าน Session 1–3')
      .replace(/ผ่าน S1 และ S2 อย่างน้อย 1 ดาว/g, 'ผ่าน S1, S2 และ S3 อย่างน้อย 1 ดาว')
      .replace(/Boss Gate หลังผ่าน Session 3–5/g, 'Boss Gate หลังผ่าน Session 4–6')
      .replace(/ผ่าน S3, S4, S5/g, 'ผ่าน S4, S5, S6');
    if(repaired !== html) panel.innerHTML = repaired;
  }

  function maintain(){
    patchCoreGateFunctions();
    injectStyle();
    renderCanonicalMissionMap();
    repairStartPanel();
    renderStudentFlowStatus();
    repairQuickNavigation();
    repairLegacyDetailText();
  }

  function boot(){
    maintain();
    setInterval(maintain, 900);

    window.AIQuestRoadmap = {
      VERSION,
      FLOW,
      render:maintain,
      isPassed:passed,
      isUnlocked:courseUnlocked,
      nextId,
      launchNextMission
    };

    console.log('[AIQuest] ' + VERSION + ' loaded');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
