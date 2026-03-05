// === /herohealth/vr-bath/quiz-c.js ===
// Quiz (Bloom C) controller — PRODUCTION SAFE
// ✅ submit -> save + emit + route to next (run file or hub)
// FULL v20260304-QUIZC-NEXT

(function(){
  'use strict';

  const qs = (k,d='')=>{ try{ return new URL(location.href).searchParams.get(k) ?? d; }catch{ return d; } };
  const clamp=(v,a,b)=>Math.max(a, Math.min(b, Number(v)||0));

  const pid = (qs('pid','anon')||'anon').trim() || 'anon';
  const hub = (qs('hub','../hub.html')||'../hub.html').trim();
  const runFile = (qs('next','../vr-bath/bath.html') || '../vr-bath/bath.html').trim(); // ✅ ไปเกมต่อ
  const log = (qs('log','')||'').trim();

  // ปุ่มในภาพ: "ส่งคำตอบ", "ข้าม"
  // เราจับแบบ tolerant: id หรือ text
  function findButtonByText(text){
    const btns = Array.from(document.querySelectorAll('button, a, [role="button"], .btn'));
    return btns.find(b => (b.textContent||'').trim() === text) || null;
  }

  const btnSubmit = document.getElementById('btnSubmit') || findButtonByText('ส่งคำตอบ');
  const btnSkip   = document.getElementById('btnSkip')   || findButtonByText('ข้าม');

  // ตัวเลือก: radio input
  function getSelected(){
    const sel = document.querySelector('input[type="radio"]:checked');
    if(!sel) return null;
    // value/label
    const value = sel.value || sel.getAttribute('data-value') || '';
    let label = '';
    const lab = sel.closest('label');
    if(lab) label = (lab.textContent||'').trim();
    else{
      // fallback: next sibling text
      const p = sel.parentElement;
      if(p) label = (p.textContent||'').trim();
    }
    return { value, label };
  }

  // ✅ correct mapping (จากภาพ: ตัวเลือกที่ถูกคือเรื่องน้ำตาล/แบคทีเรียสร้างกรด)
  // ถ้าคุณมีหลายข้อ ให้ทำเป็น array; ตอนนี้ทำ 1 ข้อก่อน
  const correct = { // q1
    matchTextIncludes: ['น้ำตาล','แบคทีเรีย','กรด','คราบ']  // robust match
  };

  function isCorrect(sel){
    if(!sel) return false;
    const t = (sel.label||'') + ' ' + (sel.value||'');
    const ok = correct.matchTextIncludes.every(w => t.includes(w));
    return ok;
  }

  function emit(name, detail){
    try{ window.dispatchEvent(new CustomEvent(name, {detail})); }catch(_){}
  }

  async function flushBeacon(payload){
    if(!log) return;
    try{
      const body = payload.map(x=>JSON.stringify(x)).join('\n');
      if(navigator.sendBeacon){
        navigator.sendBeacon(log, new Blob([body], {type:'text/plain'}));
        return;
      }
      await fetch(log, { method:'POST', headers:{'content-type':'text/plain'}, body, keepalive:true });
    }catch(_){}
  }

  function buildNextUrl(){
    const u = new URL(runFile, location.href);

    // passthrough ทุก query เดิม
    const cur = new URL(location.href);
    cur.searchParams.forEach((v,k)=> u.searchParams.set(k,v));

    // ensure hub + pid
    u.searchParams.set('pid', pid);
    if(!u.searchParams.get('hub')) u.searchParams.set('hub', hub);

    // ✅ mark that C quiz done (ให้ hub/bloom gate ใช้ได้)
    u.searchParams.set('bloom', 'C');
    u.searchParams.set('quizC', '1');

    return u.toString();
  }

  async function submit(goAnyway){
    const sel = getSelected();
    if(!sel && !goAnyway){
      // กันคนกด submit โดยไม่เลือก
      toast('เลือกคำตอบก่อนนะ');
      return;
    }

    const ok = goAnyway ? null : isCorrect(sel);
    const ts = Date.now();

    // ✅ save local (standard-ish)
    try{
      const key = `HHA_QUIZ_C_LAST::${pid}`;
      localStorage.setItem(key, JSON.stringify({ ts, pid, ok, sel }));
    }catch(_){}

    // ✅ emit + optional log
    emit('hha:quiz', { game:'bath', bloom:'C', pid, ok, sel, ts });

    await flushBeacon([{
      v:1, game:'bath', type:'quiz',
      bloom:'C', ts, pid,
      ok, answer: sel ? (sel.label||sel.value||'') : '',
      href: location.href.split('#')[0]
    }]);

    // ✅ route next
    const nextUrl = buildNextUrl();
    // แสดง feedback สั้นๆ แล้วไปต่อ
    toast(goAnyway ? 'ข้ามแล้ว ไปต่อ!' : (ok ? 'ถูกต้อง! ไปต่อ' : 'ยังไม่ถูก แต่ไปต่อได้'));
    setTimeout(()=>{ location.href = nextUrl; }, 320);
  }

  // toast แบบง่าย (ถ้าไม่มี element ก็ใช้ alert)
  function toast(msg){
    const el = document.getElementById('toast') || document.querySelector('#toast');
    if(el){
      el.textContent = msg;
      el.classList.add('show');
      clearTimeout(toast._t);
      toast._t = setTimeout(()=> el.classList.remove('show'), 900);
    }else{
      // mobile fallback
      console.log('[Quiz]', msg);
    }
  }

  // bind
  if(btnSubmit){
    btnSubmit.addEventListener('click', (e)=>{ e.preventDefault(); submit(false); }, {passive:false});
    // กัน mobile tap บางรุ่น
    btnSubmit.addEventListener('touchend', (e)=>{ e.preventDefault(); submit(false); }, {passive:false});
  }
  if(btnSkip){
    btnSkip.addEventListener('click', (e)=>{ e.preventDefault(); submit(true); }, {passive:false});
    btnSkip.addEventListener('touchend', (e)=>{ e.preventDefault(); submit(true); }, {passive:false});
  }

})();