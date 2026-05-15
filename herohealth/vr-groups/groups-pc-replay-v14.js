// === /herohealth/vr-groups/groups-pc-replay-v14.js ===
// HeroHealth Groups PC — v1.4 Replay Motivation
// Adds PC best score, daily challenge, badge collection, next goal suggestion.

(function(){
  'use strict';

  const VERSION = 'v1.4-pc-replay-motivation-20260514';
  if(window.__HHA_GROUPS_PC_REPLAY_V14__) return;
  window.__HHA_GROUPS_PC_REPLAY_V14__ = true;

  const DOC = document;
  const WIN = window;

  const KEYS = {
    best:'HHA_GROUPS_PC_BEST_V14',
    badges:'HHA_GROUPS_PC_BADGES_V14',
    history:'HHA_GROUPS_PC_HISTORY_V14',
    dailyPrefix:'HHA_GROUPS_PC_DAILY_V14_'
  };

  const state = {
    daily:null,
    best:null,
    badges:[],
    history:[]
  };

  const $ = id => DOC.getElementById(id);

  function qs(name,fallback=''){
    try{return new URL(location.href).searchParams.get(name) || fallback;}
    catch(e){return fallback;}
  }

  function todayKey(){
    const d = new Date();
    return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
  }

  function getJson(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  }

  function setJson(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){}
  }

  function hash(str){
    let h = 2166136261;
    str = String(str || '');
    for(let i=0;i<str.length;i++){
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function dailyChallenge(){
    const pid = qs('pid','anon');
    const diff = qs('diff','normal');
    const key = todayKey();
    const seed = hash(`${key}|${pid}|groups-pc|${diff}`);

    const pool = [
      {id:'score',icon:'🏆',title:'PC Score Sprint',desc:'ทำคะแนนให้ถึงเป้าหมาย',target:diff==='challenge'?850:diff==='hard'?700:diff==='easy'?380:560,unit:'คะแนน'},
      {id:'combo',icon:'🔥',title:'Keyboard Combo',desc:'ทำคอมโบสูงสุดให้ถึงเป้า',target:diff==='challenge'?16:diff==='hard'?13:diff==='easy'?7:10,unit:'คอมโบ'},
      {id:'accuracy',icon:'🎯',title:'PC Accuracy',desc:'ทำความแม่นยำให้ถึงเป้าหมาย',target:diff==='challenge'?90:diff==='hard'?85:diff==='easy'?70:80,unit:'%'},
      {id:'mission',icon:'⭐',title:'Mission Clear',desc:'เคลียร์ภารกิจให้ได้',target:diff==='challenge'?5:diff==='hard'?4:diff==='easy'?2:3,unit:'ภารกิจ'},
      {id:'boss',icon:'👑',title:'Boss Breaker',desc:'ตอบถูกใน Boss Phase ให้ได้',target:diff==='challenge'?10:diff==='hard'?8:diff==='easy'?4:6,unit:'ครั้ง'}
    ];

    return Object.assign({}, pool[seed % pool.length], {
      date:key,
      key:`${KEYS.dailyPrefix}${key}_${pid}`,
      completed:false,
      bestProgress:0
    });
  }

  function load(){
    state.best = getJson(KEYS.best, null);
    state.badges = getJson(KEYS.badges, []);
    state.history = getJson(KEYS.history, []);

    const d = dailyChallenge();
    const saved = getJson(d.key, null);
    state.daily = saved && saved.id === d.id ? Object.assign({}, d, saved) : d;
  }

  function injectStyle(){
    if($('groups-pc-v14-style')) return;

    const s = DOC.createElement('style');
    s.id = 'groups-pc-v14-style';
    s.textContent = `
      .pc-v14-panel{
        margin:18px auto 0;
        max-width:760px;
        border-radius:30px;
        padding:16px;
        background:linear-gradient(180deg,#ffffff,#f2fbff);
        border:2px solid #d7edf7;
        box-shadow:0 16px 38px rgba(35,81,107,.10);
        text-align:left;
      }

      .pc-v14-title{
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:10px;
        font-size:20px;
        font-weight:1000;
        color:#244e68;
      }

      .pc-v14-pill{
        border-radius:999px;
        padding:6px 10px;
        background:#fff5ca;
        color:#806000;
        font-size:12px;
        font-weight:1000;
      }

      .pc-v14-text{margin-top:8px;color:#7193a8;font-size:14px;line-height:1.35;font-weight:850;}

      .pc-v14-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
        margin-top:12px;
      }

      .pc-v14-mini{
        border-radius:20px;
        padding:12px 8px;
        background:#fff;
        box-shadow:inset 0 0 0 2px #e4f2f8;
        text-align:center;
      }

      .pc-v14-mini b{display:block;font-size:26px;line-height:1;font-weight:1000;color:#244e68;}
      .pc-v14-mini span{display:block;margin-top:5px;color:#7193a8;font-size:12px;font-weight:850;}

      .pc-v14-progress{
        height:11px;
        margin-top:12px;
        border-radius:999px;
        overflow:hidden;
        background:rgba(97,187,255,.16);
      }

      .pc-v14-progress i{
        display:block;
        height:100%;
        width:0%;
        background:linear-gradient(90deg,#7ed957,#ffd966,#ff9d3f);
      }

      .pc-v14-summary{
        margin-top:12px;
        border-radius:24px;
        padding:14px;
        background:linear-gradient(180deg,#ffffff,#f5fcff);
        border:2px solid #d7edf7;
      }

      .pc-v14-summary h3{margin:0;font-size:18px;font-weight:1000;color:#244e68;}
      .pc-v14-summary p{margin:7px 0 0;color:#7193a8;font-size:14px;line-height:1.35;font-weight:850;}

      .pc-v14-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;justify-content:center;}
      .pc-v14-badge{border-radius:999px;padding:8px 11px;background:linear-gradient(135deg,#fff8d5,#ffffff);border:2px solid #ffe480;color:#6b4c00;font-size:12px;font-weight:1000;}
    `;
    DOC.head.appendChild(s);
  }

  function progress(summary){
    switch(state.daily.id){
      case 'score': return Number(summary.score || 0);
      case 'combo': return Number(summary.bestCombo || 0);
      case 'accuracy': return Number(summary.accuracy || 0);
      case 'mission': return Number(summary.missionClear || 0);
      case 'boss': return Number(summary.bossCorrect || 0);
      default: return 0;
    }
  }

  function ensureIntro(){
    const card = DOC.querySelector('.intro-card');
    if(!card || $('pcv14Intro')) return;

    const best = state.best || {};
    const d = state.daily;
    const pct = Math.max(0, Math.min(100, Number(d.bestProgress || 0) / Math.max(1, Number(d.target)) * 100));

    const panel = DOC.createElement('div');
    panel.id = 'pcv14Intro';
    panel.className = 'pc-v14-panel';
    panel.innerHTML = `
      <div class="pc-v14-title">
        <span>${d.icon} Daily PC Challenge: ${d.title}</span>
        <span class="pc-v14-pill">${d.completed ? 'สำเร็จแล้ว' : 'วันนี้'}</span>
      </div>
      <div class="pc-v14-text">${d.desc}: เป้าหมาย ${d.target}${d.unit}</div>
      <div class="pc-v14-progress"><i style="width:${pct}%"></i></div>
      <div class="pc-v14-grid">
        <div class="pc-v14-mini"><b>${best.score || 0}</b><span>Best Score</span></div>
        <div class="pc-v14-mini"><b>${best.bestCombo || 0}</b><span>Best Combo</span></div>
        <div class="pc-v14-mini"><b>${best.accuracy || 0}%</b><span>Best Accuracy</span></div>
        <div class="pc-v14-mini"><b>${state.badges.length}</b><span>Badges</span></div>
      </div>
    `;

    const actions = card.querySelector('.actions');
    card.insertBefore(panel, actions);
  }

  function nextGoal(s){
    if(Number(s.accuracy || 0) < 75) return 'รอบหน้าโฟกัสความแม่นยำให้ถึง 75% ก่อน';
    if(Number(s.bestCombo || 0) < 10) return 'รอบหน้าลองทำคอมโบ 10 ให้ได้ด้วยปุ่มเลข 1–5';
    if(Number(s.missionClear || 0) < 3) return 'รอบหน้าลองเคลียร์ Mission ให้ได้ 3 ภารกิจ';
    if(Number(s.bossCorrect || 0) < 6) return 'รอบหน้าลองทำ Boss Correct ให้ได้ 6 ครั้ง';
    if(Number(s.score || 0) < 700) return 'รอบหน้าลองทำคะแนนให้ทะลุ 700';
    return 'รอบหน้าลองเล่นระดับ Hard หรือ Challenge เพื่อปลดล็อกสถิติใหม่';
  }

  function updateBest(s){
    const old = state.best || {};
    const b = Object.assign({}, old);

    ['score','bestCombo','accuracy','correct','missionClear','bossCorrect','goldenHit','decoyDodged'].forEach(k=>{
      b[k] = Math.max(Number(old[k] || 0), Number(s[k] || 0));
    });

    b.rank = s.rank || old.rank || 'Food Rookie';
    b.updatedAt = new Date().toISOString();

    state.best = b;
    setJson(KEYS.best, b);
  }

  function mergeBadges(s){
    const set = new Set(state.badges || []);
    if(Array.isArray(s.badges)) s.badges.forEach(b=>b && set.add(String(b)));
    if(s.rank) set.add(String(s.rank));
    state.badges = Array.from(set).slice(0,90);
    setJson(KEYS.badges, state.badges);
  }

  function updateDaily(s){
    const p = progress(s);
    state.daily.bestProgress = Math.max(Number(state.daily.bestProgress || 0), p);
    if(p >= Number(state.daily.target || 1)) state.daily.completed = true;
    setJson(state.daily.key, state.daily);
  }

  function updateHistory(s){
    const row = {
      ts:s.ts || new Date().toISOString(),
      score:Number(s.score || 0),
      accuracy:Number(s.accuracy || 0),
      bestCombo:Number(s.bestCombo || 0),
      rank:s.rank || 'Food Rookie'
    };
    state.history = [row].concat(state.history || []).slice(0,12);
    setJson(KEYS.history, state.history);
  }

  function renderSummary(s){
    const card = DOC.querySelector('.summary-card');
    if(!card) return;

    let box = $('pcv14Summary');
    if(!box){
      box = DOC.createElement('div');
      box.id = 'pcv14Summary';
      box.className = 'pc-v14-summary';
      const actions = card.querySelector('.actions');
      card.insertBefore(box, actions);
    }

    const badges = state.badges.slice(0,10).map(b=>`<span class="pc-v14-badge">${escapeHtml(b)}</span>`).join('');
    const d = state.daily;
    const p = progress(s);

    box.innerHTML = `
      <h3>🚀 PC Replay Motivation</h3>
      <p>${escapeHtml(nextGoal(s))}<br>${d.icon} Daily Challenge: ${d.completed ? 'สำเร็จแล้ว!' : `ทำได้ ${p}/${d.target}${d.unit}`}</p>
      <div class="pc-v14-badges">${badges || '<span class="pc-v14-badge">ยังไม่มี Badge</span>'}</div>
    `;
  }

  function escapeHtml(str){
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function handleEnd(detail){
    setTimeout(()=>{
      let s = detail;
      try{
        if(!s){
          const raw = localStorage.getItem('HHA_GROUPS_PC_SUMMARY');
          if(raw) s = JSON.parse(raw);
        }
      }catch(e){}

      if(!s) return;

      updateBest(s);
      mergeBadges(s);
      updateDaily(s);
      updateHistory(s);
      renderSummary(s);

      try{
        const enriched = Object.assign({}, s, {
          pcReplayMotivation:{
            version:VERSION,
            best:state.best,
            daily:state.daily,
            badgeCount:state.badges.length,
            nextGoal:nextGoal(s)
          }
        });
        localStorage.setItem('HHA_GROUPS_PC_SUMMARY', JSON.stringify(enriched));
      }catch(e){}
    }, 260);
  }

  function expose(){
    WIN.HHA_GROUPS_PC_V14_REPLAY = {
      version:VERSION,
      getState:()=>({
        version:VERSION,
        best:state.best,
        daily:state.daily,
        badges:state.badges.slice(),
        history:state.history.slice()
      })
    };
  }

  function init(){
    injectStyle();
    load();
    ensureIntro();
    WIN.addEventListener('groups:end', ev=>handleEnd(ev.detail || null));
    WIN.addEventListener('hha:summary-enriched', ev=>handleEnd(ev.detail || null));
    expose();

    console.info('[Groups PC v1.4] replay motivation installed', VERSION);
  }

  if(DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();
