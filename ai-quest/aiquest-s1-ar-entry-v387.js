/* AI Quest S1 AR Persistent Entry Fix
   File: /ai-quest/js/aiquest-s1-ar-entry-v387.js
   Version: v3.8.7
   Purpose: Keep S1 AR Practice card visible after normal S1 game renders/re-renders.
*/
(function(){
  'use strict';

  var CARD_ID = 'aiquestS1ArEntryV387';
  var AR_PARAM = new URLSearchParams(location.search).get('ar');
  var SESSION = String(new URLSearchParams(location.search).get('session') || '').toLowerCase();

  // Do not inject into any AR page or a session other than S1.
  if (AR_PARAM || (SESSION && SESSION !== 's1' && SESSION !== 'm1')) return;

  function getSavedResult(){
    try{
      var raw = localStorage.getItem('AIQUEST_S1_AR_RESULT_V368');
      return raw ? JSON.parse(raw) : null;
    }catch(_){
      return null;
    }
  }

  function isS1Screen(){
    var heading = document.getElementById('gameHeading');
    var text = String(heading && heading.textContent || '');
    return /(^|\s)1\s*:\s*AI Awakening/i.test(text) || /AI Awakening/i.test(text);
  }

  function findHost(){
    var area = document.getElementById('gameArea');
    if(!area) return null;
    // S1 must be on-screen and Card Rush panel has already rendered.
    if(!isS1Screen()) return null;
    return area;
  }

  function buildCard(){
    var result = getSavedResult();
    var done = result && (result.arCompleted || result.completed);
    var score = done ? Math.round(Number(result.arScore || result.score || result.accuracy || 0)) : 0;
    var correct = done ? Number(result.correct || result.arCorrect || 0) : 0;
    var total = done ? Number(result.total || result.arTotal || 0) : 0;

    var wrap = document.createElement('section');
    wrap.id = CARD_ID;
    wrap.setAttribute('data-aiquest-s1-ar', 'true');
    wrap.style.cssText = [
      'margin:0 0 14px',
      'padding:14px 16px',
      'border-radius:18px',
      'border:1px solid rgba(167,139,250,.55)',
      'background:linear-gradient(135deg,rgba(124,58,237,.18),rgba(56,189,248,.13))',
      'box-shadow:0 12px 26px rgba(0,0,0,.16)',
      'position:relative',
      'z-index:8'
    ].join(';');

    wrap.innerHTML = ''
      + '<div style="display:flex;gap:14px;align-items:center;justify-content:space-between;flex-wrap:wrap">'
      + '  <div style="min-width:0">'
      + '    <div style="font-weight:1000;color:#f5f3ff;font-size:16px">📷 S1 AR Practice: AI Object Scanner</div>'
      + '    <div style="margin-top:4px;color:#dbeafe;font-size:13px;line-height:1.5">ใช้กล้องและมือ หรือ mouse/touch ฝึกแยก AI • Automation • Sensor-only • Prediction</div>'
      + '    <div style="margin-top:5px;color:#bbf7d0;font-size:12px;font-weight:900">กิจกรรมเสริม • ไม่กระทบคะแนน S1 หลัก'
      + (done ? ' • เล่นแล้ว ' + correct + '/' + total + ' = ' + score + '%' : '')
      + '    </div>'
      + '  </div>'
      + '  <button type="button" id="aiquestS1ArStartV387" style="border:0;border-radius:14px;padding:12px 16px;font-weight:1000;cursor:pointer;color:#0f172a;background:linear-gradient(135deg,#c4b5fd,#67e8f9);box-shadow:0 8px 20px rgba(56,189,248,.25)">'
      + (done ? 'ฝึก AR อีกครั้ง' : 'เริ่ม AR Practice')
      + '  </button>'
      + '</div>';

    wrap.querySelector('#aiquestS1ArStartV387').addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      var u = new URL(location.href);
      u.searchParams.set('session','s1');
      u.searchParams.set('ar','hand');
      u.searchParams.set('from','s1');
      u.searchParams.set('v','20260627-s1-entry387');
      location.assign(u.toString());
    }, true);

    return wrap;
  }

  function inject(){
    var host = findHost();
    if(!host) return;
    var old = document.getElementById(CARD_ID);
    if(old && old.parentNode === host) return;
    if(old) old.remove();

    // Insert as first visual item inside S1 game, above HUD.
    host.insertBefore(buildCard(), host.firstChild);
    console.log('[AIQuest S1 AR] persistent entry visible');
  }

  // Main game replaces #gameArea innerHTML frequently. Observe it, then restore S1 card.
  var scheduled = false;
  function schedule(){
    if(scheduled) return;
    scheduled = true;
    setTimeout(function(){
      scheduled = false;
      inject();
    }, 60);
  }

  function boot(){
    schedule();
    var area = document.getElementById('gameArea');
    if(area){
      new MutationObserver(schedule).observe(area, {childList:true, subtree:false});
    }
    new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true});
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  }else{
    boot();
  }
})();
