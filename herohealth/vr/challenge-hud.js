// === /herohealth/vr/challenge-hud.js ===
// HHA Challenge HUD — PRODUCTION (game-agnostic)
// Reads: ?chal=day:gameKey:ruleId:createdAt
// Shows: live counter + warn/danger
// API: window.HHA_CHAL.onState({misses, comboMax, goalsCleared, miniCleared, grade})

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;
  if(!DOC || WIN.__HHA_CHAL_HUD__) return;
  WIN.__HHA_CHAL_HUD__ = true;

  const qs = (k, d=null)=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; } catch { return d; } };

  function parseChalToken(tok){
    tok = String(tok||'').trim();
    if(!tok) return null;
    // expected: day:gameKey:ruleId:createdAt
    const parts = tok.split(':');
    if(parts.length < 3) return null;
    return {
      day: parts[0] || '',
      gameKey: (parts[1]||'').toLowerCase(),
      ruleId: (parts[2]||'').toLowerCase(),
      createdAt: parts[3] ? Number(parts[3]) : null
    };
  }

  // rule registry (ค่าคงที่เดียวกับ HUB)
  const RULES = {
    no_miss_5:  { type:'miss_max',  v:5,  text:'ห้ามพลาดเกิน 5' },
    combo_10:   { type:'combo_min', v:10, text:'ทำคอมโบให้ได้ 10' },
    grade_a:    { type:'grade_min', v:'A', text:'ได้เกรด A ขึ้นไป' },
    goal_2:     { type:'goal_min',  v:2,  text:'ผ่าน Goal อย่างน้อย 2' },
    mini_2:     { type:'mini_min',  v:2,  text:'ผ่าน Mini Quest อย่างน้อย 2' }
  };

  const CHAL = parseChalToken(qs('chal',''));
  const RULE = CHAL ? (RULES[CHAL.ruleId] || null) : null;

  // no challenge => no HUD
  if(!CHAL || !RULE) {
    WIN.HHA_CHAL = { active:false, onState: ()=>{} };
    return;
  }

  // ---------- UI ----------
  function ensure(){
    let el = DOC.querySelector('.hha-chal');
    if(el) return el;

    el = DOC.createElement('div');
    el.className = 'hha-chal';
    el.style.cssText = `
      position:fixed;
      top:calc(12px + env(safe-area-inset-top,0px));
      right:calc(12px + env(safe-area-inset-right,0px));
      z-index:95;
      width:min(360px, calc(100vw - 24px));
      pointer-events:none;
      font-family:system-ui,-apple-system,"Noto Sans Thai",Segoe UI,Roboto,sans-serif;
    `;

    el.innerHTML = `
      <div class="box" style="
        background:rgba(2,6,23,.72);
        border:1px solid rgba(245,158,11,.26);
        border-radius:18px;
        padding:10px 12px;
        box-shadow:0 18px 60px rgba(0,0,0,.32);
        backdrop-filter: blur(8px);
      ">
        <div class="t" style="font-weight:1100; font-size:13px;">
          ⚔️ Challenge: <span class="rule"></span>
        </div>
        <div class="s" style="margin-top:6px; font-weight:1050; font-size:14px;">
          <span class="status"></span>
        </div>
        <div class="m" style="margin-top:6px; font-weight:900; font-size:12px; color:rgba(229,231,235,.78); line-height:1.35;">
          <span class="meta"></span>
        </div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }

  const el = ensure();
  const ruleEl = el.querySelector('.rule');
  const statusEl = el.querySelector('.status');
  const metaEl = el.querySelector('.meta');

  ruleEl.textContent = RULE.text || CHAL.ruleId;
  metaEl.textContent = `ruleId=${CHAL.ruleId} • day=${CHAL.day}`;

  // ---------- state ----------
  let ST = {
    misses:0,
    comboMax:0,
    goalsCleared:0,
    miniCleared:0,
    grade:''
  };

  function gradePass(grade, need){
    const g = String(grade||'').toUpperCase();
    const n = String(need||'A').toUpperCase();
    // lower index = better
    const order = ['SSS','SS','S','A','B','C','D','E','F','-',''];
    const ig = order.indexOf(g);
    const ineed = order.indexOf(n);
    if(ig < 0 || ineed < 0) return false;
    return ig <= ineed;
  }

  function setWarnStyle(level){
    // level: ok / warn / danger / pass
    const box = el.querySelector('.box');
    if(!box) return;
    const B = {
      ok:     'rgba(245,158,11,.26)',
      warn:   'rgba(245,158,11,.45)',
      danger: 'rgba(239,68,68,.55)',
      pass:   'rgba(34,197,94,.45)'
    }[level] || 'rgba(148,163,184,.20)';
    box.style.borderColor = B;
  }

  function render(){
    let pass = false;
    let level = 'ok';
    let line = '';

    switch(RULE.type){
      case 'miss_max':{
        const remain = Math.max(0, Number(RULE.v) - Number(ST.misses||0));
        pass = (Number(ST.misses||0) <= Number(RULE.v));
        line = `Miss เหลือ ${remain} (ตอนนี้ ${ST.misses||0}/${RULE.v})`;
        if(remain <= 0) level = 'danger';
        else if(remain <= 2) level = 'warn';
        else level = 'ok';
        break;
      }
      case 'combo_min':{
        const need = Number(RULE.v)||0;
        const cur = Number(ST.comboMax||0);
        const remain = Math.max(0, need - cur);
        pass = (cur >= need);
        line = pass ? `ผ่านแล้ว! ComboMax ${cur}/${need}` : `คอมโบขาดอีก ${remain} (ComboMax ${cur}/${need})`;
        level = pass ? 'pass' : (remain <= 2 ? 'warn' : 'ok');
        break;
      }
      case 'goal_min':{
        const need = Number(RULE.v)||0;
        const cur = Number(ST.goalsCleared||0);
        const remain = Math.max(0, need - cur);
        pass = (cur >= need);
        line = pass ? `ผ่านแล้ว! Goal ${cur}/${need}` : `Goal ขาดอีก ${remain} (ตอนนี้ ${cur}/${need})`;
        level = pass ? 'pass' : (remain <= 1 ? 'warn' : 'ok');
        break;
      }
      case 'mini_min':{
        const need = Number(RULE.v)||0;
        const cur = Number(ST.miniCleared||0);
        const remain = Math.max(0, need - cur);
        pass = (cur >= need);
        line = pass ? `ผ่านแล้ว! Mini ${cur}/${need}` : `Mini ขาดอีก ${remain} (ตอนนี้ ${cur}/${need})`;
        level = pass ? 'pass' : (remain <= 1 ? 'warn' : 'ok');
        break;
      }
      case 'grade_min':{
        const need = String(RULE.v||'A');
        const cur = String(ST.grade||'').toUpperCase();
        pass = gradePass(cur, need);
        line = cur ? (pass ? `ผ่านแล้ว! Grade ${cur} (ต้อง ≥ ${need})` : `ต้องได้ Grade ≥ ${need} (ตอนนี้ ${cur})`)
                   : `ต้องได้ Grade ≥ ${need}`;
        level = pass ? 'pass' : 'ok';
        break;
      }
      default:{
        line = 'กำลังท้าทาย…';
        level = 'ok';
      }
    }

    statusEl.textContent = line;
    setWarnStyle(pass ? 'pass' : level);
  }

  function onState(patch){
    if(!patch || typeof patch !== 'object') return;
    if(patch.misses != null) ST.misses = Number(patch.misses)||0;
    if(patch.comboMax != null) ST.comboMax = Number(patch.comboMax)||0;
    if(patch.goalsCleared != null) ST.goalsCleared = Number(patch.goalsCleared)||0;
    if(patch.miniCleared != null) ST.miniCleared = Number(patch.miniCleared)||0;
    if(patch.grade != null) ST.grade = String(patch.grade||'');
    render();
  }

  // initial render
  render();

  WIN.HHA_CHAL = {
    active:true,
    token: CHAL,
    rule: RULE,
    onState
  };
})();