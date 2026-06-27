/* AI Quest AR Final Route v3.9.5
   Purpose:
   - Recover from stale ?ar=hand / ?ar=agent left in the URL after returning to normal S1/S2.
   - Keep exactly one AR launch card in normal S1/S2.
   - Do NOT remove a real AR overlay while it is open.
*/
(function(){
  'use strict';

  var CARD_ID = 'aiquestArFinalCardV395';
  var timer = 0;

  function params(){ return new URLSearchParams(location.search); }

  function currentSession(){
    var p = params();
    var s = String(p.get('session') || p.get('mission') || '').toLowerCase();
    if(s === 'm1') s = 's1';
    if(s === 'm2') s = 's2';

    // When a stale AR URL remains but normal mission UI is visible,
    // identify the session from the actual normal page heading.
    var heading = document.getElementById('gameHeading');
    var text = String(heading && heading.textContent || '').toLowerCase();
    if(text.indexOf('ai awakening') >= 0 || /^1\s*:/.test(text)) return 's1';
    if(text.indexOf('agent builder') >= 0 || /^2\s*:/.test(text)) return 's2';
    return s;
  }

  function realArOpen(){
    var s1 = document.getElementById('s1ar368');
    if(s1 && s1.classList.contains('open')) return true;

    // Generic full-screen AR roots used by S2 variants.
    var roots = document.querySelectorAll(
      '#s2ar381.open, #s2ar387.open, #aiquestS2ArRoot.open, ' +
      '[data-aiquest-ar-overlay="open"], [data-aiquest-s2-ar="open"]'
    );
    return !!(roots && roots.length);
  }

  function removeStaleArRoute(){
    var p = params();
    var ar = String(p.get('ar') || '').toLowerCase();
    if(!ar || realArOpen()) return false;

    // Only sanitize after normal S1/S2 has visibly rendered.
    var s = currentSession();
    var normalUI = !!document.getElementById('gameArea') &&
      !!document.getElementById('gameHeading');
    if(!normalUI || (s !== 's1' && s !== 's2')) return false;

    p.delete('ar');
    p.delete('from');
    p.delete('replay');
    p.set('session', s);
    p.set('v', '20260627-arfinal395');
    history.replaceState(null, '', location.pathname + '?' + p.toString());
    console.log('[AIQuest AR v395] stale AR route cleared ->', s);
    return true;
  }

  function resultFor(s){
    try{
      var key = s === 's1'
        ? 'AIQUEST_S1_AR_RESULT_V368'
        : 'AIQUEST_S2_AR_RESULT_V381';
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }

  function launch(s){
    var ar = s === 's1' ? 'hand' : 'agent';
    var next = location.pathname +
      '?session=' + s +
      '&ar=' + ar +
      '&from=' + s +
      '&replay=1&v=20260627-arfinal395';
    console.log('[AIQuest AR v395] launch ->', next);
    location.assign(next);
  }

  function cardMarkup(s){
    var r = resultFor(s);
    var done = r && (r.arCompleted || r.completed);
    var total = Number(r && (r.total || r.arTotal) || 0);
    var correct = Number(r && (r.correct || r.arCorrect) || 0);
    var score = Math.round(Number(
      r && (r.arScore || r.score || r.accuracy) ||
      (total ? correct * 100 / total : 0)
    ));

    var s1 = s === 's1';
    var title = s1
      ? '✋ S1 AR Practice: AI Object Scanner'
      : '🧩 S2 AR Practice: Agent Builder';
    var desc = s1
      ? 'ใช้กล้องและมือ หรือ mouse/touch ฝึกแยก AI, Automation, Sensor และ Prediction'
      : 'ใช้กล้องและมือ หรือ mouse/touch ฝึก PEAS, percept, actuator, environment และ rational agent';

    return '<section id="' + CARD_ID + '" style="' +
      'margin:0 0 12px;padding:14px 16px;border-radius:18px;' +
      'border:1px solid rgba(125,211,252,.42);' +
      'background:linear-gradient(135deg,rgba(20,184,166,.13),rgba(139,92,246,.13));' +
      'display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap">' +
      '<div style="min-width:220px;flex:1">' +
      '<b style="font-size:16px">' + title + '</b>' +
      '<div style="margin-top:5px;color:#dbeafe;font-size:13px;line-height:1.5">' + desc + '</div>' +
      (done
        ? '<div style="margin-top:7px;color:#bbf7d0;font-weight:800;font-size:13px">✓ เล่น AR แล้ว: ' + correct + '/' + total + ' • ' + score + '%</div>'
        : '<div style="margin-top:7px;color:#fef3c7;font-weight:800;font-size:13px">กิจกรรมเสริม • ไม่กระทบคะแนน Session หลัก</div>') +
      '</div>' +
      '<button type="button" id="aiquestArFinalLaunchV395" style="' +
      'border:0;border-radius:15px;padding:12px 17px;font-weight:1000;' +
      'color:#0f172a;background:linear-gradient(135deg,#a7f3d0,#67e8f9);cursor:pointer">' +
      (done ? 'ฝึก AR อีกครั้ง' : 'เริ่ม AR Practice') +
      '</button></section>';
  }

  function inject(){
    if(realArOpen()) return;
    var p = params();
    if(p.get('ar')) return; // sanitize timer will handle stale URL first

    var s = currentSession();
    if(s !== 's1' && s !== 's2') return;

    var area = document.getElementById('gameArea');
    if(!area) return;

    var old = document.getElementById(CARD_ID);
    if(old) old.remove();

    area.insertAdjacentHTML('afterbegin', cardMarkup(s));
    var button = document.getElementById('aiquestArFinalLaunchV395');
    if(button){
      button.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        launch(s);
      }, true);
    }
  }

  function refresh(){
    clearTimeout(timer);
    timer = setTimeout(function(){
      removeStaleArRoute();
      inject();
    }, 40);
  }

  function observe(){
    var area = document.getElementById('gameArea');
    if(!area || area.__aiquestArFinalObservedV395) return;
    area.__aiquestArFinalObservedV395 = true;
    new MutationObserver(refresh).observe(area, {childList:true, subtree:false});
  }

  document.addEventListener('DOMContentLoaded', function(){
    // 1.2 sec makes this run after direct AR engines have had a chance to open.
    setTimeout(function(){
      removeStaleArRoute();
      inject();
      observe();
    }, 1200);
    setTimeout(function(){
      removeStaleArRoute();
      inject();
      observe();
    }, 1800);
  });

  window.addEventListener('popstate', function(){
    setTimeout(function(){
      removeStaleArRoute();
      inject();
      observe();
    }, 80);
  });

  console.log('[AIQuest AR v395] final route guard loaded');
})();