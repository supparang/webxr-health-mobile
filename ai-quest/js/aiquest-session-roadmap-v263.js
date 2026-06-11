/*
  CSAI2102 AI Quest
  PATCH v2.6.3 Session Roadmap + Boss Gate
  ------------------------------------------------------------
  Shows total course sessions, available sessions, unlock criteria,
  and boss gate cadence.
*/
(function(){
  'use strict';

  const VERSION = 'v2.6.3-roadmap-student-only';
  const STORAGE_KEY = 'CSAI2102_AIQUEST_V16_M1_GOOGLE_SHEETS';

  const ROADMAP = [
    {id:'m1', type:'session', no:'S1', title:'AI Awakening', topic:'AI / Automation / Sensor / Prediction', available:true},
    {id:'m2', type:'session', no:'S2', title:'Agent Builder', topic:'Intelligent Agent / PEAS / Environment', available:true},
    {id:'b1', type:'boss', no:'B1', title:'Rookie AI Boss', topic:'AI Overview + Agent', available:true, unlock:'ผ่าน S1 และ S2 อย่างน้อย 1 ดาว'},
    {id:'m3', type:'session', no:'S3', title:'Search Maze', topic:'BFS / DFS'},
    {id:'m4', type:'session', no:'S4', title:'Route Cost Challenge', topic:'Uniform Cost Search'},
    {id:'m5', type:'session', no:'S5', title:'A* Rescue Mission', topic:'Heuristic / A*'},
    {id:'b2', type:'boss', no:'B2', title:'Search Arena Boss', topic:'Uninformed + Informed Search', unlock:'ผ่าน S3-S5'},
    {id:'m6', type:'session', no:'S6', title:'Knowledge Base Forge', topic:'Knowledge Representation'},
    {id:'m7', type:'session', no:'S7', title:'Logic Lab', topic:'Propositional / Predicate Logic'},
    {id:'m8', type:'session', no:'S8', title:'Inference Tower', topic:'Reasoning / Inference'},
    {id:'b3', type:'boss', no:'B3', title:'Knowledge Boss', topic:'KR + Logic + Inference', unlock:'ผ่าน S6-S8'},
    {id:'m9', type:'session', no:'S9', title:'Learning Machine', topic:'Machine Learning Basics'},
    {id:'m10', type:'session', no:'S10', title:'Classifier Arena', topic:'Classification'},
    {id:'m11', type:'session', no:'S11', title:'Model Evaluation', topic:'Accuracy / Precision / Recall'},
    {id:'b4', type:'boss', no:'B4', title:'ML Boss', topic:'ML + Evaluation', unlock:'ผ่าน S9-S11'},
    {id:'m12', type:'session', no:'S12', title:'Language Agent', topic:'NLP / LLM'},
    {id:'m13', type:'session', no:'S13', title:'Vision Quest', topic:'Computer Vision'},
    {id:'m14', type:'session', no:'S14', title:'Responsible AI', topic:'Ethics / Bias / Safety'},
    {id:'m15', type:'session', no:'S15', title:'Mini Project Launch', topic:'AI Mini Project'},
    {id:'b5', type:'boss', no:'B5', title:'Final AI Boss', topic:'Integrated AI Principles', unlock:'ผ่าน S12-S15 + Reflection'}
  ];

  function qs(){ return new URLSearchParams(location.search); }
  function isTeacherMode(){
    const p = qs();
    return p.get('teacher') === '1' || p.get('admin') === '1' || p.get('dev') === '1' || p.get('mode') === 'teacher' || p.get('view') === 'teacher';
  }
  function $(selector){ return document.querySelector(selector); }
  function escapeHtml(s){
    return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function state(){
    try{
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    }catch(error){
      return {};
    }
  }
  function isPassed(st, id){
    return !!(st.completed && st.completed[id]) || !!(st.stars && Number(st.stars[id] || 0) > 0) || !!(st.bestScore && Number(st.bestScore[id] || 0) >= 60);
  }
  function isMastered(st, id){
    return !!(st.mastered && st.mastered[id]);
  }
  function stars(st, id){
    return Number(st.stars && st.stars[id] || 0);
  }
  function score(st, id){
    const value = st.bestScore && st.bestScore[id];
    return value == null ? '-' : value;
  }
  function bossUnlocked(st, bossId){
    if(bossId === 'b1') return isPassed(st, 'm1') && isPassed(st, 'm2');
    if(bossId === 'b2') return ['m3','m4','m5'].every(id => isPassed(st, id));
    if(bossId === 'b3') return ['m6','m7','m8'].every(id => isPassed(st, id));
    if(bossId === 'b4') return ['m9','m10','m11'].every(id => isPassed(st, id));
    if(bossId === 'b5') return ['m12','m13','m14','m15'].every(id => isPassed(st, id));
    return false;
  }
  function sessionUnlocked(st, id){
    if(id === 'm1') return true;
    if(id === 'm2') return isPassed(st, 'm1');
    return false;
  }
  function roadmapStatus(st, item){
    if(item.type === 'boss'){
      const open = bossUnlocked(st, item.id);
      return {
        label: open ? 'Boss Gate Open' : 'Boss Locked',
        cls: open ? 'bossOpen' : 'locked',
        detail: item.unlock || 'ผ่าน sessions ก่อนหน้า'
      };
    }

    const passed = isPassed(st, item.id);
    const mastered = isMastered(st, item.id);
    const unlocked = sessionUnlocked(st, item.id) || item.available;

    if(mastered) return {label:'Mastery', cls:'mastery', detail:`Best ${score(st, item.id)} • ${stars(st, item.id)} ดาว`};
    if(passed) return {label:'Passed', cls:'passed', detail:`Best ${score(st, item.id)} • ${stars(st, item.id)} ดาว`};
    if(unlocked) return {label:'Open', cls:'open', detail:'เปิดให้เล่นแล้ว'};
    return {label:'Locked', cls:'locked', detail:'ยังไม่เปิดใน patch นี้'};
  }

  function injectStyle(){
    if($('#aiquestRoadmapStyle')) return;

    const style = document.createElement('style');
    style.id = 'aiquestRoadmapStyle';
    style.textContent = `
      .roadmapPanel{border:1px solid rgba(56,189,248,.24);background:rgba(14,165,233,.045)}
      .roadmapTop{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:12px 0}
      .roadmapMetric{border:1px solid var(--line);background:rgba(255,255,255,.055);border-radius:16px;padding:12px}
      .roadmapMetric .num{font-size:30px;font-weight:1000}
      .roadmapMetric .label{color:var(--muted);font-weight:900}
      .bossGateBox{border:1px solid rgba(251,191,36,.38);background:rgba(251,191,36,.08);border-radius:18px;padding:14px;margin-top:12px;line-height:1.65}
      .roadmapGrid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-top:14px}
      .roadmapCard{border:1px solid var(--line);border-radius:16px;padding:12px;background:rgba(255,255,255,.045);min-height:126px;position:relative;overflow:hidden;text-align:left;color:var(--text);font:inherit;cursor:pointer;transition:.16s transform,.16s border-color,.16s box-shadow,.16s background}
      .roadmapCard:hover{transform:translateY(-2px);border-color:rgba(56,189,248,.46);box-shadow:0 14px 30px rgba(0,0,0,.18)}
      .roadmapCard.locked{cursor:not-allowed}
      .roadmapCard.locked:hover{transform:none;box-shadow:none}
      .roadmapCard.recommended:before{content:'NEXT';position:absolute;right:10px;top:10px;border:1px solid rgba(251,191,36,.55);background:rgba(251,191,36,.14);color:#fde68a;border-radius:999px;padding:4px 8px;font-size:10px;font-weight:1000}
      .roadmapClickHint{color:#bae6fd;font-size:12px;font-weight:900;margin-top:8px}
      .roadmapCard.locked .roadmapClickHint{color:#94a3b8}
      .roadmapCard.session.open{border-color:rgba(56,189,248,.34);background:rgba(56,189,248,.08)}
      .roadmapCard.session.passed{border-color:rgba(52,211,153,.38);background:rgba(52,211,153,.08)}
      .roadmapCard.session.mastery{border-color:rgba(167,139,250,.48);background:rgba(167,139,250,.10)}
      .roadmapCard.boss{border-color:rgba(251,191,36,.34);background:rgba(251,191,36,.06)}
      .roadmapCard.boss.bossOpen{border-color:rgba(251,191,36,.7);box-shadow:0 0 0 1px rgba(251,191,36,.18) inset;background:rgba(251,191,36,.13)}
      .roadmapCard.locked{opacity:.74}
      .roadmapNo{font-weight:1000;color:#bae6fd}
      .roadmapTitle{font-weight:1000;font-size:15px;margin-top:4px}
      .roadmapTopic{color:var(--muted);font-size:12px;margin-top:4px;line-height:1.35}
      .roadmapStatus{display:inline-flex;margin-top:8px;border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:5px 8px;font-size:11px;font-weight:1000}
      .roadmapStatus.mastery,.roadmapStatus.passed{color:#bbf7d0;border-color:rgba(52,211,153,.36);background:rgba(52,211,153,.10)}
      .roadmapStatus.open{color:#bae6fd;border-color:rgba(56,189,248,.36);background:rgba(56,189,248,.10)}
      .roadmapStatus.bossOpen{color:#fde68a;border-color:rgba(251,191,36,.48);background:rgba(251,191,36,.12)}
      .roadmapStatus.locked{color:#cbd5e1}
      .roadmapActions{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
      @media(max-width:1050px){.roadmapGrid{grid-template-columns:repeat(3,1fr)}.roadmapTop{grid-template-columns:repeat(2,1fr)}}
      @media(max-width:720px){.roadmapGrid{grid-template-columns:1fr}.roadmapTop{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function nextRecommendedId(st){
    if(!isPassed(st, 'm1')) return 'm1';
    if(!isPassed(st, 'm2')) return 'm2';
    if(bossUnlocked(st, 'b1')) return 'b1';
    return '';
  }

  function isClickable(st, item){
    if(item.type === 'boss') return item.available && bossUnlocked(st, item.id);
    if(item.id === 'm1' || item.id === 'm2') return sessionUnlocked(st, item.id) || item.available;
    return false;
  }

  function clickHint(st, item){
    if(item.type === 'boss'){
      return bossUnlocked(st, item.id) ? 'กดเพื่อเข้า Boss' : (item.unlock || 'ยังไม่เปิด');
    }
    if(item.id === 'm1') return isPassed(st, 'm1') ? 'กดเพื่อเล่นซ้ำ / Mastery' : 'กดเพื่อเริ่ม';
    if(item.id === 'm2') return isPassed(st, 'm2') ? 'กดเพื่อเล่นซ้ำ / Mastery' : 'กดเพื่อเริ่ม';
    return 'ยังไม่เปิดใน patch นี้';
  }

  function cardHTML(st, item){
    const status = roadmapStatus(st, item);
    const clickable = isClickable(st, item);
    const recommended = nextRecommendedId(st) === item.id;

    return `
      <button type="button" class="roadmapCard ${item.type} ${status.cls} ${recommended ? 'recommended' : ''}" data-roadmap-id="${escapeHtml(item.id)}" ${clickable ? '' : 'aria-disabled="true"'}>
        <div class="roadmapNo">${escapeHtml(item.no)} ${item.type === 'boss' ? '👾' : '🎯'}</div>
        <div class="roadmapTitle">${escapeHtml(item.title)}</div>
        <div class="roadmapTopic">${escapeHtml(item.topic || '')}</div>
        <span class="roadmapStatus ${status.cls}">${escapeHtml(status.label)}</span>
        <div class="roadmapTopic">${escapeHtml(status.detail)}</div>
        <div class="roadmapClickHint">${escapeHtml(clickHint(st, item))}</div>
      </button>
    `;
  }

  function toast(message){
    if(typeof showToast === 'function') showToast(message);
    else alert(message);
  }

  function startByRoadmapId(id){
    const st = state();
    const item = ROADMAP.find(x => x.id === id);
    if(!item) return;

    if(item.type === 'boss'){
      if(!bossUnlocked(st, id)){
        toast(item.unlock || 'Boss ยังไม่เปิด');
        return;
      }
      if(id === 'b1'){
        if(typeof startMission === 'function') startMission('b1');
        else toast('Boss engine ยังไม่พร้อม กรุณา refresh หน้า');
        return;
      }
      toast('Boss นี้ยังไม่เปิดใน patch ปัจจุบัน');
      return;
    }

    if(id === 'm1' || id === 'm2'){
      if(!sessionUnlocked(st, id) && !item.available){
        toast('ด่านนี้ยังล็อก');
        return;
      }
      if(typeof startMission === 'function') startMission(id);
      else toast('ยังไม่พบ engine เริ่มเกม กรุณา refresh หน้า');
      return;
    }

    toast('Session นี้ยังไม่เปิดใน patch ปัจจุบัน');
  }

  function render(){
    injectStyle();

    if(isTeacherMode()){
      const existing = $('#sessionRoadmapPanel');
      if(existing) existing.remove();
      return;
    }

    let anchor = $('#sessionRoadmapPanel');
    if(!anchor){
      anchor = document.createElement('section');
      anchor.className = isTeacherMode() ? 'teacherBox roadmapPanel' : 'panel roadmapPanel';
      anchor.id = 'sessionRoadmapPanel';
      anchor.style.marginTop = '16px';

      const hero = document.querySelector('#menuScreen .hero');
      if(hero) hero.insertAdjacentElement('afterend', anchor);
      else return;
    }

    const st = state();
    const totalSessions = ROADMAP.filter(x => x.type === 'session').length;
    const totalBosses = ROADMAP.filter(x => x.type === 'boss').length;
    const openSessions = ROADMAP.filter(x => x.type === 'session' && (x.available || sessionUnlocked(st, x.id))).length;
    const passedSessions = ROADMAP.filter(x => x.type === 'session' && isPassed(st, x.id)).length;
    const openBosses = ROADMAP.filter(x => x.type === 'boss' && bossUnlocked(st, x.id)).length;
    const b1Open = bossUnlocked(st, 'b1');

    const next = !isPassed(st,'m1')
      ? 'เป้าหมายถัดไป: ผ่าน Session 1'
      : !isPassed(st,'m2')
        ? 'เป้าหมายถัดไป: ผ่าน Session 2 เพื่อเปิด B1'
        : b1Open
          ? 'Boss Gate B1 เปิดแล้ว: พร้อมทำ Rookie AI Boss'
          : 'กำลังรอเปิด Boss Gate';

    anchor.innerHTML = `
      <h2>AI Quest Roadmap: 15 Sessions + Boss Gates</h2>
      <p>
        ภาพรวมเส้นทางรายวิชา แสดงว่าเปิดแล้วกี่ session, ผ่านเกณฑ์เปิดด่านใดแล้ว
        และ Boss จะเปิดหลังผ่านกลุ่ม session ตามเกณฑ์
      </p>

      <div class="roadmapTop">
        <div class="roadmapMetric"><div class="num">${openSessions}/${totalSessions}</div><div class="label">Sessions เปิดในระบบตอนนี้</div></div>
        <div class="roadmapMetric"><div class="num">${passedSessions}/${openSessions}</div><div class="label">Sessions ที่ผ่านแล้ว</div></div>
        <div class="roadmapMetric"><div class="num">${openBosses}/${totalBosses}</div><div class="label">Boss Gates ที่เปิดแล้ว</div></div>
        <div class="roadmapMetric"><div class="num">2</div><div class="label">ผ่าน 2 sessions เพื่อเปิด B1</div></div>
      </div>

      <div class="bossGateBox">
        <b>Boss Rule:</b> ช่วงเริ่มต้นให้มี <b>Rookie Boss หลังผ่าน Session 1–2</b>
        เพื่อเช็กพื้นฐาน AI Overview + Intelligent Agent ก่อนขึ้นเนื้อหากลุ่ม Search
        <br><b>Next:</b> ${escapeHtml(next)}
      </div>

      <div class="roadmapActions">
        <span class="roadmapStatus open">กดการ์ดที่เปิดแล้วเพื่อเข้าเล่น</span>
        <span class="roadmapStatus locked">การ์ดล็อกจะแสดงเงื่อนไขบนการ์ด</span>
        <span class="roadmapStatus bossOpen">Boss เปิดเมื่อผ่านเกณฑ์</span>
      </div>

      <div class="roadmapGrid">
        ${ROADMAP.map(item => cardHTML(st, item)).join('')}
      </div>
    `;
    anchor.querySelectorAll('[data-roadmap-id]').forEach(card => {
      card.onclick = () => startByRoadmapId(card.dataset.roadmapId);
    });

  }

  function boot(){
    render();
    setInterval(render, 2500);

    window.AIQuestRoadmap = {
      VERSION,
      ROADMAP,
      render,
      bossUnlocked,
      isPassed
    };

    console.log('[AIQuest] ' + VERSION + ' loaded');
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
