// === /herohealth/vr/hha-hud.js ===
// Hero Health Academy — Global HUD Binder (DOM/VR)
// ✅ Updates HUD from events:
// - hha:score      -> #hudScore #hudCombo #hudMiss
// - hha:time       -> #hudTime
// - hha:rank       -> #hudGrade
// - hha:fever      -> #hudFeverPct
// - quest:update   -> #miniLine #goalLine #miniHint
// - hha:coach      -> #coachMsg #coachImg (coach-*.png)
// - hha:plate      -> #hudGroupsHave (Plate 0/5)
// Safe if elements missing.

(function (root) {
  'use strict';

  var DOC = root.document;
  if (!DOC) return;

  function byId(id){ return DOC.getElementById(id); }
  function setText(id, v){
    var el = byId(id);
    if (!el) return;
    el.textContent = String(v);
  }

  function pickCoachImg(mood){
    mood = String(mood || 'neutral').toLowerCase();
    if (mood === 'happy') return './img/coach-happy.png';
    if (mood === 'sad') return './img/coach-sad.png';
    if (mood === 'fever' || mood === 'hot') return './img/coach-fever.png';
    return './img/coach-neutral.png';
  }

  // --- SCORE ---
  root.addEventListener('hha:score', function(ev){
    var d = (ev && ev.detail) ? ev.detail : {};
    if (d.score != null) setText('hudScore', d.score|0);
    if (d.combo != null) setText('hudCombo', d.combo|0);
    if (d.misses != null) setText('hudMiss', d.misses|0);

    // optional fields
    if (d.mode != null) setText('hudMode', d.mode);
    if (d.diff != null) setText('hudDiff', d.diff);
    if (d.perfect != null) setText('hudPerfectCount', d.perfect|0);
  });

  // --- TIME ---
  root.addEventListener('hha:time', function(ev){
    var d = (ev && ev.detail) ? ev.detail : {};
    if (d.left != null) setText('hudTime', d.left|0);
  });

  // --- RANK / GRADE ---
  root.addEventListener('hha:rank', function(ev){
    var d = (ev && ev.detail) ? ev.detail : {};
    if (d.grade != null) setText('hudGrade', d.grade);
  });

  // --- FEVER ---
  root.addEventListener('hha:fever', function(ev){
    var d = (ev && ev.detail) ? ev.detail : {};
    if (d.fever != null) setText('hudFeverPct', (d.fever|0) + '%');
  });

  // --- QUEST PANEL ---
  root.addEventListener('quest:update', function(ev){
    var d = (ev && ev.detail) ? ev.detail : {};
    if (d.miniTitle != null){
      var left = (d.miniLeftMs != null) ? (d.miniLeftMs|0) : 0;
      var sec = left ? Math.ceil(left/1000) : 0;
      var prog = (d.miniTotal != null && d.miniTotal > 0)
        ? ((d.miniNow|0) + '/' + (d.miniTotal|0))
        : '—';
      var tail = sec ? (' • ⏳ ' + sec + 's') : '';
      setText('miniLine', 'MINI: ' + String(d.miniTitle || '—') + ' • ' + prog + tail);
    }
    if (d.goalTitle != null){
      var gprog = (d.goalTotal != null && d.goalTotal > 0)
        ? ((d.goalNow|0) + '/' + (d.goalTotal|0))
        : '—';
      setText('goalLine', 'Goal: ' + String(d.goalTitle || '—') + ' • ' + gprog);
    }

    // hint (optional)
    if (d.extra && d.extra.hint){
      setText('miniHint', d.extra.hint);
    }
  });

  // --- COACH ---
  root.addEventListener('hha:coach', function(ev){
    var d = (ev && ev.detail) ? ev.detail : {};
    var msg = byId('coachMsg');
    if (msg && d.text != null) msg.textContent = String(d.text);

    var img = byId('coachImg');
    if (img && d.mood != null){
      img.src = pickCoachImg(d.mood);
    }
  });

  // ✅ NEW: PLATE have/total
  root.addEventListener('hha:plate', function(ev){
    var d = (ev && ev.detail) ? ev.detail : {};
    if (typeof d.have === 'number' && typeof d.total === 'number'){
      setText('hudGroupsHave', (d.have|0) + '/' + (d.total|0));
    }
  });

})(typeof window !== 'undefined' ? window : globalThis);