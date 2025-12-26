// === /herohealth/vr-groups/groups-ui.js ===
// UI Binder: HUD score/time/power/group/rank + lock ring + stun/banner + start/end
(function(){
  'use strict';
  const doc = document;
  if (!doc) return;

  const $ = (id)=>doc.getElementById(id);

  // --- Lock ring ensure ---
  function ensureLockRing(){
    let ring = doc.querySelector('.lock-ring');
    if (ring) return ring;

    ring = doc.createElement('div');
    ring.className = 'lock-ring';
    ring.style.display = 'none';
    ring.innerHTML = `
      <div class="lock-core"></div>
      <div class="lock-prog"></div>
      <div class="lock-charge"></div>
    `;
    doc.body.appendChild(ring);
    return ring;
  }

  const ring = ensureLockRing();

  // --- HUD bindings ---
  function setText(id, v){
    const el = $(id);
    if (el) el.textContent = String(v);
  }

  // power bar update
  function setPower(charge, threshold){
    const c = Math.max(0, charge|0);
    const t = Math.max(1, threshold|0);
    setText('hud-powerText', `${c}/${t}`);
    const fill = $('hud-powerFill');
    if (fill){
      const p = Math.max(0, Math.min(1, c/t));
      fill.style.width = Math.round(p*100) + '%';
      fill.classList.add('pulse');
      setTimeout(()=>{ try{ fill.classList.remove('pulse'); }catch(_){ } }, 180);
    }
  }

  window.addEventListener('hha:score', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    setText('hud-score', d.score ?? 0);
    setText('hud-combo', d.combo ?? 0);
    setText('hud-miss', d.misses ?? 0);
    setText('hud-comboMax', d.comboMax ?? 0);
  }, { passive:true });

  window.addEventListener('hha:time', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    // engine emits {left}
    const left = (d.left != null) ? d.left : (d.sec != null ? d.sec : 0);
    setText('hud-time', left);
    if (left <= 10) doc.documentElement.classList.add('panic');
    else doc.documentElement.classList.remove('panic');
  }, { passive:true });

  window.addEventListener('hha:rank', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (d.grade) setText('hud-grade', d.grade);
    if (typeof d.accuracy === 'number') setText('hud-acc', `${d.accuracy|0}%`);
    if (typeof d.questsPct === 'number') setText('hud-quests', `${d.questsPct|0}%`);
  }, { passive:true });

  window.addEventListener('groups:group_change', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const label = d.label || 'หมู่ ?';
    setText('hud-group', label);

    // banner pop
    const b = $('fg-banner');
    const bt = $('fg-bannerText');
    if (b && bt){
      bt.textContent = label;
      b.style.display = '';
      b.classList.remove('pop');
      void b.offsetWidth;
      b.classList.add('pop');
      setTimeout(()=>{ try{ b.style.display='none'; }catch(_){ } }, 900);
    }
  }, { passive:true });

  window.addEventListener('groups:power', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    setPower(d.charge, d.threshold);
  }, { passive:true });

  window.addEventListener('groups:stun', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const on = !!d.on;
    const ms = d.ms|0;
    const o = $('fg-stun');
    if (o){
      o.style.display = on ? '' : 'none';
      o.classList.toggle('pop', on);
      if (on){
        setTimeout(()=>{ try{ o.style.display='none'; }catch(_){ } }, Math.max(200, ms));
      }
    }
  }, { passive:true });

  // lock ring follows groups:lock
  window.addEventListener('groups:lock', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    if (!d.on){
      ring.style.display = 'none';
      return;
    }
    ring.style.display = '';
    const x = (d.x != null) ? d.x : (window.innerWidth/2);
    const y = (d.y != null) ? d.y : (window.innerHeight/2);
    ring.style.left = x + 'px';
    ring.style.top  = y + 'px';

    ring.style.setProperty('--p', String(Math.max(0, Math.min(1, d.prog||0))));
    ring.style.setProperty('--c', String(Math.max(0, Math.min(1, d.charge||0))));
  }, { passive:true });

  // --- Start / End controls ---
  function qsParam(name, fallback){
    const u = new URL(location.href);
    return u.searchParams.get(name) ?? fallback;
  }

  function startGame(){
    const layer = $('fg-layer');
    if (!layer) return;

    const diff = String(qsParam('diff', 'normal')).toLowerCase();
    const time = parseInt(qsParam('time', '90'), 10) || 90;
    const runMode = String(qsParam('run', 'play')).toLowerCase();
    const seed = qsParam('seed', '');

    const eng = window.GroupsVR && window.GroupsVR.GameEngine;
    if (!eng) {
      alert('GameEngine ยังไม่พร้อม (GroupsVR.GameEngine not found)');
      return;
    }

    eng.setLayerEl(layer);
    eng.setTimeLeft(time);

    $('startOverlay').style.display = 'none';
    $('endOverlay').style.display = 'none';

    // show note for debug
    const note = $('startNote');
    if (note) note.textContent = `diff=${diff} | time=${time} | run=${runMode}${seed?` | seed=${seed}`:''}`;

    eng.start(diff, { runMode, seed });
  }

  function resetAll(){
    location.href = location.pathname + location.search;
  }

  $('btnPlay')?.addEventListener('click', startGame);
  $('btnReplay')?.addEventListener('click', startGame);
  $('btnReset')?.addEventListener('click', resetAll);

  $('btnVR')?.addEventListener('click', ()=>{
    const scene = doc.querySelector('a-scene');
    if (scene && scene.enterVR) scene.enterVR();
  });

  $('btnCloseEnd')?.addEventListener('click', ()=>{
    $('endOverlay').style.display = 'none';
    $('startOverlay').style.display = '';
  });

  window.addEventListener('hha:end', (ev)=>{
    const d = (ev && ev.detail) ? ev.detail : {};
    const body = $('endBody');
    if (body){
      body.innerHTML = `
        เหตุผลจบเกม: <b>${String(d.reason || 'end')}</b><br/>
        คะแนน: <b>${d.scoreFinal ?? 0}</b><br/>
        ความแม่น: <b>${d.accuracy ?? 0}%</b><br/>
        คอมโบสูงสุด: <b>${d.comboMax ?? 0}</b><br/>
        Miss: <b>${d.misses ?? 0}</b><br/>
        เกรด: <b style="font-size:22px">${String(d.grade||'C')}</b>
      `;
    }
    $('endOverlay').style.display = '';
  }, { passive:true });

})();