/* === /herohealth/vr-groups/groups-vr.boot.js ===
GroupsVR Boot — PRODUCTION
✅ Auto-detect view: pc/mobile/vr/cvr (no override)
✅ Wire UI for events from groups.safe.js (B)
✅ Practice 15s in cVR then auto start real run
✅ End overlay + Back HUB + Restart
*/

(function(){
  'use strict';

  const ROOT = window;
  const DOC = document;

  const $ = (id)=>DOC.getElementById(id);

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }
    catch{ return def; }
  }

  function toInt(v, def){
    v = Number(v);
    return Number.isFinite(v) ? (v|0) : (def|0);
  }

  function clamp(v,a,b){ v=Number(v)||0; return v<a?a:(v>b?b:v); }

  function isCoarsePointer(){
    try{ return matchMedia('(pointer: coarse)').matches; } catch(_) { return false; }
  }

  function detectView(){
    // DO NOT rely on ?view override
    const isMobile = isCoarsePointer() || Math.min(screen.width, screen.height) <= 820;

    // If user explicitly enters VR, CSS can switch to view-vr via body class in VR-UI (optional)
    // For cVR (cardboard split) we detect by URL hint ONLY if "cvr=1" (safe toggle), not "view="
    const cvr = qs('cvr','0') === '1';
    if (cvr) return 'cvr';

    return isMobile ? 'mobile' : 'pc';
  }

  function setBodyView(view){
    const b = DOC.body;
    b.classList.remove('view-pc','view-mobile','view-vr','view-cvr');
    if (view === 'cvr') b.classList.add('view-cvr');
    else if (view === 'vr') b.classList.add('view-vr');
    else if (view === 'pc') b.classList.add('view-pc');
    else b.classList.add('view-mobile');
  }

  function setCoachMood(mood){
    const img = $('coachImg');
    if (!img) return;
    const m = String(mood||'neutral');
    const map = {
      happy: '../img/coach-happy.png',
      neutral: '../img/coach-neutral.png',
      sad: '../img/coach-sad.png',
      fever: '../img/coach-fever.png'
    };
    img.src = map[m] || map.neutral;
  }

  function showEnd(summary){
    const ov = $('endOverlay');
    if (!ov) return;
    ov.classList.remove('hidden');
    ov.setAttribute('aria-hidden','false');

    $('endScore').textContent = String(summary.scoreFinal ?? 0);
    $('endRank').textContent  = String(summary.grade ?? '—');
    $('endAcc').textContent   = String(summary.accuracyGoodPct ?? 0) + '%';

    $('endMiss').textContent     = String(summary.misses ?? 0);
    $('endMissAim').textContent  = String(summary.missAim ?? 0);
    $('endMissMist').textContent = String(summary.missMistake ?? 0);

    const r = String(summary.reason||'end');
    $('endSub').textContent = (r === 'all-goals') ? 'ผ่านครบทุก GOAL! 🎉'
                        : (r === 'time') ? 'หมดเวลา!'
                        : (r === 'practice') ? 'จบฝึก'
                        : 'จบเกม';

    try{
      if (ROOT.Particles && ROOT.Particles.celebrate){
        ROOT.Particles.celebrate();
      }
    }catch(_){}
  }

  function hideEnd(){
    const ov = $('endOverlay');
    if (!ov) return;
    ov.classList.add('hidden');
    ov.setAttribute('aria-hidden','true');
  }

  function startEngine(runMode){
    const eng = ROOT.GroupsVR && ROOT.GroupsVR.GameEngine;
    if (!eng) return;

    const diff = String(qs('diff','normal')||'normal').toLowerCase();
    const time = clamp(toInt(qs('time', 90), 90), 5, 180);
    const seed = String(qs('seed', Date.now()));

    const playLayer = $('playLayer');
    if (playLayer) eng.setLayerEl(playLayer);

    hideEnd();

    eng.start(diff, {
      runMode: runMode || String(qs('run','play')||'play'),
      time,
      seed
    });
  }

  function boot(){
    const view = detectView();
    setBodyView(view);

    // buttons
    const hub = qs('hub', '../hub.html');
    const btnBack = $('btnBack');
    const btnRestart = $('btnRestart');

    if (btnBack){
      btnBack.addEventListener('click', ()=>{
        try{ location.href = hub; }catch(_){}
      }, { passive:true });
    }
    if (btnRestart){
      btnRestart.addEventListener('click', ()=>{
        startEngine('play');
      }, { passive:true });
    }

    // Event wires
    ROOT.addEventListener('hha:time', (e)=>{
      const left = e?.detail?.left;
      if ($('hudTime')) $('hudTime').textContent = (left != null) ? String(left) : '—';
    });

    ROOT.addEventListener('hha:score', (e)=>{
      const d = e?.detail || {};
      if ($('hudScore')) $('hudScore').textContent = String(d.score ?? 0);
      if ($('hudCombo')) $('hudCombo').textContent = String(d.combo ?? 0);
      if ($('hudMiss'))  $('hudMiss').textContent  = String(d.misses ?? 0);
    });

    ROOT.addEventListener('hha:rank', (e)=>{
      const d = e?.detail || {};
      if ($('hudRank')) $('hudRank').textContent = String(d.grade ?? '—');
      if ($('hudAcc'))  $('hudAcc').textContent  = String(d.accuracy ?? 0) + '%';
    });

    ROOT.addEventListener('quest:update', (e)=>{
      const d = e?.detail || {};
      if ($('goalTitle')) $('goalTitle').textContent = String(d.goalTitle ?? '—');
      if ($('goalNow'))   $('goalNow').textContent   = String(d.goalNow ?? 0);
      if ($('goalTotal')) $('goalTotal').textContent = String(d.goalTotal ?? 0);
      if ($('goalFill'))  $('goalFill').style.width  = String(d.goalPct ?? 0) + '%';
      if ($('goalSub'))   $('goalSub').textContent   =
        `GOAL ${toInt(d.goalIndex,0)+1}/${toInt(d.goalsTotal,0)} • หมู่: ${String(d.groupName||'—')}`;

      if ($('miniTitle')) $('miniTitle').textContent = String(d.miniTitle ?? '—');
      if ($('miniNow'))   $('miniNow').textContent   = String(d.miniNow ?? 0);
      if ($('miniTotal')) $('miniTotal').textContent = String(d.miniTotal ?? 0);
      if ($('miniFill'))  $('miniFill').style.width  = String(d.miniPct ?? 0) + '%';

      const tLeft = toInt(d.miniTimeLeftSec, 0);
      if ($('miniTimer')) $('miniTimer').textContent = (tLeft>0) ? `• ⏱️ ${tLeft}s` : '';

      const urgent = (tLeft>0 && tLeft<=3);
      DOC.body.classList.toggle('mini-urgent', urgent);
      if ($('miniSub')) $('miniSub').textContent =
        `MINI ผ่าน ${toInt(d.miniCountCleared,0)}/${toInt(d.miniCountTotal,0)} รอบ`;
    });

    ROOT.addEventListener('groups:power', (e)=>{
      const d = e?.detail || {};
      const now = toInt(d.charge,0);
      const thr = Math.max(1, toInt(d.threshold,1));
      if ($('powerNow')) $('powerNow').textContent = String(now);
      if ($('powerThr')) $('powerThr').textContent = String(thr);
      if ($('powerFill')) $('powerFill').style.width = String(clamp((now/thr)*100,0,100)) + '%';
    });

    ROOT.addEventListener('hha:coach', (e)=>{
      const d = e?.detail || {};
      if ($('coachText')) $('coachText').textContent = String(d.text || '');
      setCoachMood(d.mood || 'neutral');
    });

    ROOT.addEventListener('hha:end', (e)=>{
      const d = e?.detail || {};
      const reason = String(d.reason||'end');

      // practice mode: auto start real run (play)
      if (reason === 'practice'){
        hideEnd();
        setTimeout(()=>startEngine('play'), 420);
        return;
      }

      showEnd(d);
    });

    // start
    const run = String(qs('run','play')||'play').toLowerCase();

    // cVR: do 15s practice first (unless runMode already practice/research)
    const isCVR = DOC.body.classList.contains('view-cvr');
    if (isCVR && run === 'play'){
      // practice uses same seed/time (engine handles practice end)
      startEngine('practice');
    } else {
      startEngine(run);
    }
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

})();