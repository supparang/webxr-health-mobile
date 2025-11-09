// === vr/coach.js (auto-init coach bubble, listens to HHA events) ===
(function(){
  var bubble, hideTimer=null, lastCombo=0, lastQuestText='';
  function el(tag, cls){ var x=document.createElement(tag); if(cls) x.className=cls; return x; }
  function ensureUI(){
    if (bubble) return bubble;
    var css = document.getElementById('coach-style');
    if(!css){
      css = el('style'); css.id='coach-style';
      css.textContent =
        '#coachBubble{position:fixed;left:50%;top:80px;transform:translateX(-50%);z-index:950;' +
        'max-width:min(84vw,720px);background:#0b1222cc;border:1px solid #3b4a66;color:#e8eefc;' +
        'padding:10px 14px;border-radius:12px;box-shadow:0 12px 30px #0008;font:700 14px/1.4 system-ui,-apple-system,Segoe UI,Roboto,Thonburi,sans-serif;' +
        'backdrop-filter:blur(6px);opacity:0;pointer-events:none;transition:opacity .18s ease;}';
      document.head.appendChild(css);
    }
    bubble = document.getElementById('coachBubble');
    if(!bubble){ bubble = el('div'); bubble.id='coachBubble'; document.body.appendChild(bubble); }
    return bubble;
  }
  function show(text, ms){
    var b = ensureUI();
    b.textContent = String(text||'');
    b.style.opacity = '1';
    if(hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(function(){ b.style.opacity='0'; }, Math.max(800, ms||1500));
  }

  // public hook (optional manual use)
  window.coachSay = function(txt, ms){ try{ show(txt, ms); }catch(e){} };

  // helpers
  function onScore(e){
    var d = e && e.detail ? e.detail : {};
    var combo = Number(d.combo||0);
    var delta = Number(d.delta||0);
    if (combo>=1 && (combo===5 || combo===10 || combo===15)){
      show('สุดยอด! คอมโบ x'+combo+' ไปต่อเลย! 🔥', 1600);
    }
    if (delta>0 && combo===1) show('เปิดคอมโบแล้ว! เก็บต่อเนื่องให้ได้!', 1300);
    lastCombo = combo;
  }
  function onMiss(){
    lastCombo = 0;
    show('ไม่เป็นไร! โฟกัสใหม่ อีกครั้ง! 💪', 1200);
  }
  function onFever(e){
    var st = e && e.detail && e.detail.state ? e.detail.state : 'change';
    if (st==='start') show('FEVER มาแล้ว! เก็บแต้มคูณให้สุด! ⚡', 1800);
    if (st==='end')   show('เฟดหมดแล้ว — ตั้งคอมโบใหม่ลุยต่อ!', 1400);
  }
  function onQuest(e){
    var text = e && e.detail && e.detail.text ? e.detail.text : '';
    if (text && text!==lastQuestText){
      lastQuestText = text;
      show(text, 1800);
    }
  }
  function onEnd(e){
    var d = e && e.detail ? e.detail : {};
    var score = Number(d.score||0);
    var reason = d.reason||'done';
    var txt = (reason==='win') ? 'เยี่ยมมาก! จบเกม — คะแนน ' + score
            : (reason==='timeout') ? 'หมดเวลา! คะแนน ' + score + ' ครั้งหน้าเอาใหม่!'
            : 'จบเกมแล้ว! คะแนน ' + score;
    show(txt, 2000);
  }

  // wire events once
  window.addEventListener('hha:score', onScore);
  window.addEventListener('hha:miss',  onMiss);
  window.addEventListener('hha:fever', onFever);
  window.addEventListener('hha:quest', onQuest);
  window.addEventListener('hha:end',   onEnd);

  // optional custom say
  window.addEventListener('coach:say', function(e){
    var t = e && e.detail && e.detail.text ? e.detail.text : '';
    if (t) show(t, e.detail.ms||1500);
  });

  // first hint
  setTimeout(function(){ show('แตะ/คลิกที่เป้าเพื่อเก็บแต้ม เริ่มเลย!', 1800); }, 900);
})();
