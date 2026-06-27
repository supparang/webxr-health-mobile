/* AI Quest AR Stabilizer v3.8.8
   Fixes:
   1) S1/S2 AR cards are re-injected after the normal mission re-renders.
   2) Correct route: S1 -> ar=hand, S2 -> ar=agent.
   3) On a direct AR route, remove session= after AR engines load so the
      normal deep-link boot cannot overwrite the AR overlay after ~300ms.
*/
(function(){
  'use strict';

  var q = new URLSearchParams(location.search);
  var directAr = String(q.get('ar') || '').toLowerCase();
  var directSession = String(q.get('session') || '').toLowerCase();
  var from = String(q.get('from') || '').toLowerCase();

  // Let the relevant AR engine see session/ar first, then prevent index.html's
  // normal deep-session boot from rendering over the AR layer.
  if ((directSession === 's1' && directAr === 'hand') ||
      (directSession === 's2' && directAr === 'agent')) {
    window.setTimeout(function(){
      try{
        var p = new URLSearchParams(location.search);
        if (!p.get('ar')) return;
        p.delete('session');
        p.set('arSession', directSession);
        history.replaceState(null, '', location.pathname + '?' + p.toString());
        console.log('[AIQuest AR v388] direct route protected', directSession, directAr);
      }catch(e){}
    }, 25);
  }

  function sessionId(){
    var p = new URLSearchParams(location.search);
    var s = String(p.get('session') || p.get('mission') || '').toLowerCase();
    if (s === 'm1') s = 's1';
    if (s === 'm2') s = 's2';
    return s;
  }

  function resultFor(s){
    try{
      var key = s === 's1' ? 'AIQUEST_S1_AR_RESULT_V368' : 'AIQUEST_S2_AR_RESULT_V381';
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  function cardMarkup(s){
    var r = resultFor(s);
    var done = r && (r.arCompleted || r.completed);
    var total = Number(r && (r.total || r.arTotal) || 0);
    var correct = Number(r && (r.correct || r.arCorrect) || 0);
    var pct = Math.round(Number(r && (r.score || r.arScore || r.accuracy) || (total ? correct * 100 / total : 0)));
    var isS1 = s === 's1';
    var title = isS1 ? 'S1 AR Practice: AI Object Scanner' : 'S2 AR Practice: Agent Builder';
    var text = isS1
      ? 'ใช้กล้องและมือ หรือ mouse/touch ฝึกแยก AI, Automation, Sensor และ Prediction'
      : 'ใช้กล้องและมือ หรือ mouse/touch ฝึก PEAS, percept, actuator, environment และ rational agent';
    return '<section id="aiquestArStableCardV388" style="margin:0 0 12px;padding:14px 16px;border-radius:18px;border:1px solid rgba(125,211,252,.42);background:linear-gradient(135deg,rgba(20,184,166,.13),rgba(139,92,246,.13));display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap">'
      + '<div style="min-width:220px;flex:1"><b style="font-size:16px">✋ ' + title + '</b>'
      + '<div style="margin-top:5px;color:#dbeafe;font-size:13px;line-height:1.5">' + text + '</div>'
      + (done ? '<div style="margin-top:7px;color:#bbf7d0;font-weight:800;font-size:13px">✓ เล่น AR แล้ว: ' + correct + '/' + total + ' • ' + pct + '%</div>' : '<div style="margin-top:7px;color:#fef3c7;font-weight:800;font-size:13px">กิจกรรมเสริม • ไม่กระทบคะแนน ' + (isS1 ? 'S1' : 'S2') + ' หลัก</div>')
      + '</div>'
      + '<button type="button" id="aiquestArStableLaunchV388" style="border:0;border-radius:15px;padding:12px 17px;font-weight:1000;color:#0f172a;background:linear-gradient(135deg,#a7f3d0,#67e8f9);cursor:pointer">'
      + (done ? 'ฝึก AR อีกครั้ง' : 'เริ่ม AR Practice') + '</button></section>';
  }

  function inject(){
    if (directAr) return;
    var s = sessionId();
    if (s !== 's1' && s !== 's2') return;
    var area = document.getElementById('gameArea');
    if (!area) return;
    var old = document.getElementById('aiquestArStableCardV388');
    if (old) old.remove();
    area.insertAdjacentHTML('afterbegin', cardMarkup(s));
    var b = document.getElementById('aiquestArStableLaunchV388');
    if (b) {
      b.addEventListener('click', function(ev){
        ev.preventDefault();
        ev.stopPropagation();
        var ar = s === 's1' ? 'hand' : 'agent';
        var next = location.pathname + '?session=' + s + '&ar=' + ar + '&from=' + s + '&v=20260627-arstable388';
        console.log('[AIQuest AR v388] launch', next);
        location.assign(next);
      }, true);
    }
  }

  function keepInjected(){
    inject();
    var area = document.getElementById('gameArea');
    if (!area || area.__aiquestArV388Observed) return;
    area.__aiquestArV388Observed = true;
    var timer = 0;
    new MutationObserver(function(){
      clearTimeout(timer);
      timer = setTimeout(inject, 0);
    }).observe(area, {childList:true, subtree:false});
  }

  document.addEventListener('DOMContentLoaded', function(){
    window.setTimeout(keepInjected, 80);
    window.setTimeout(keepInjected, 420);
    window.setTimeout(keepInjected, 800);
  });
  window.addEventListener('popstate', function(){ setTimeout(keepInjected, 50); });
  console.log('[AIQuest AR v388] stabilizer loaded');
})();