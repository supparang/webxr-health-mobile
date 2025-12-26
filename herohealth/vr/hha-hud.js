// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (LATEST)
// ✅ Number ticker (เลขวิ่ง) for score/combo/miss/time
// ✅ Quest panel binding (quest:update)
// ✅ Coach binding (hha:coach) + mood image swap
// ✅ Fever/Shield (hha:fever)
// ✅ End summary freeze (hha:end)

(function(root){
  'use strict';
  const doc = root.document;
  if (!doc) return;

  function $(id){ return doc.getElementById(id); }
  function clamp(v,min,max){ v=Number(v)||0; return v<min?min:(v>max?max:v); }

  // ---- number ticker ----
  const tickers = new Map();

  function animateNumber(el, to, ms=220){
    if (!el) return;
    to = Number(to)||0;
    const key = el.id || (Math.random()+'');
    const from = Number(el.textContent)||0;

    const start = performance.now();
    const dur = clamp(ms, 120, 650);

    tickers.set(key, { el, from, to, start, dur });

    function step(t){
      const st = tickers.get(key);
      if (!st) return;
      const p = clamp((t - st.start) / st.dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = Math.round(st.from + (st.to - st.from) * eased);
      st.el.textContent = String(v);
      if (p >= 1) { tickers.delete(key); return; }
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---- Coach moods -> images ----
  const COACH_IMG = {
    neutral: './img/coach-neutral.png',
    happy:   './img/coach-happy.png',
    sad:     './img/coach-sad.png',
    fever:   './img/coach-fever.png'
  };

  function setCoach(text, mood){
    const img = $('hha-coach-img');
    const box = $('hha-coach-text');
    if (box && text) box.textContent = String(text);

    const m = (mood && COACH_IMG[mood]) ? mood : 'neutral';
    if (img) img.src = COACH_IMG[m];
  }

  // ---- Quest ----
  function setQuest(d){
    const t = $('hha-quest-title');
    const s = $('hha-quest-sub');
    const gc = $('hha-goal-count');
    const mc = $('hha-mini-count');

    const mt = $('hha-mini-title');
    const ms = $('hha-mini-sub');
    const mb = $('hha-mini-box');

    if (t) t.textContent = (d.goalTitle || 'GOAL');
    if (s) s.textContent = (d.goalDesc || '—');

    if (gc) gc.textContent = `${d.goalsCleared||0}/${d.goalsTotal||0}`;
    if (mc) mc.textContent = `MINI ${(d.minisCleared||0)}/${(d.miniTotal||0)}`;

    const hasMini = !!(d.miniTitle || d.miniDesc);
    if (mb) mb.style.display = hasMini ? '' : 'none';

    if (mt) mt.textContent = d.miniTitle || 'MINI';
    if (ms){
      const sec = (d.miniSecLeft != null) ? ` • ⏱️ ${d.miniSecLeft}s` : '';
      ms.textContent = (d.miniDesc || '—') + sec;
    }
  }

  // ---- Score ----
  function onScore(e){
    const d = e && e.detail ? e.detail : {};
    animateNumber($('hha-score'), d.scoreFinal ?? d.score ?? 0);
    animateNumber($('hha-combo'), d.combo ?? 0);
    animateNumber($('hha-miss'),  d.misses ?? d.miss ?? 0);

    // water zone/pct if passed (optional)
    if (typeof d.waterPct === 'number' && root.WaterUI && root.WaterUI.set){
      const z = d.waterZone || (root.WaterUI.zoneFrom ? root.WaterUI.zoneFrom(d.waterPct) : '');
      root.WaterUI.set(d.waterPct, z);
    }

    // fever/shield (optional)
    if (typeof d.feverPct === 'number' && root.FeverUI && root.FeverUI.set){
      root.FeverUI.set(d.feverPct/100);
    }
    if (typeof d.shield === 'boolean' && root.FeverUI && root.FeverUI.setShield){
      root.FeverUI.setShield(d.shield);
    }
  }

  function onTime(e){
    const d = e && e.detail ? e.detail : {};
    if (typeof d.sec === 'number'){
      animateNumber($('hha-time'), d.sec, 180);
    }
  }

  function onCoach(e){
    const d = e && e.detail ? e.detail : {};
    setCoach(d.text || '', d.mood || 'neutral');
  }

  function onFever(e){
    const d = e && e.detail ? e.detail : {};
    if (typeof d.pct === 'number' && root.FeverUI && root.FeverUI.set){
      root.FeverUI.set(d.pct/100);
    }
    if (typeof d.shield === 'boolean' && root.FeverUI && root.FeverUI.setShield){
      root.FeverUI.setShield(d.shield);
    }
  }

  function onQuestUpdate(e){
    const d = e && e.detail ? e.detail : {};
    setQuest(d);
  }

  function onEnd(e){
    const d = e && e.detail ? e.detail : {};
    // freeze final numbers
    const score = d.scoreFinal ?? 0;
    const combo = d.comboMax ?? 0;
    const miss  = d.misses ?? 0;

    animateNumber($('hha-score'), score, 280);
    animateNumber($('hha-combo'), combo, 280);
    animateNumber($('hha-miss'),  miss, 280);

    // also stamp via particles if available
    try{
      if (root.Particles && root.Particles.stamp){
        root.Particles.stamp(`RANK ${d.rank || ''}`.trim());
      }
    }catch{}
  }

  root.addEventListener('hha:score', onScore);
  root.addEventListener('hha:time', onTime);
  root.addEventListener('hha:coach', onCoach);
  root.addEventListener('hha:fever', onFever);
  root.addEventListener('quest:update', onQuestUpdate);
  root.addEventListener('hha:end', onEnd);

})(typeof window !== 'undefined' ? window : globalThis);