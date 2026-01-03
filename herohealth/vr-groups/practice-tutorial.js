// === /herohealth/vr-groups/practice-tutorial.js ===
// PACK 68: Practice Tutorial (15s) — prompts + checklist (cVR only)

(function(){
  'use strict';
  const WIN = window;
  const DOC = document;

  function qs(k, def=null){
    try{ return new URL(location.href).searchParams.get(k) ?? def; }catch{ return def; }
  }
  function isPractice(){
    const p = String(qs('practice','0')||'0');
    const view = String(qs('view','')||'').toLowerCase();
    if (!view.includes('cvr')) return false;
    return (p === '1' || Number(p)>0);
  }

  const S = { good:0, bad:0, didSwitch:false };
  function ensure(){
    let el = DOC.querySelector('.practice-hud');
    if (el) return el;
    el = DOC.createElement('div');
    el.className = 'practice-hud hidden';
    el.innerHTML = `
      <div class="ph-card">
        <div class="ph-title">🧪 PRACTICE</div>
        <div class="ph-list">
          <div class="ph-item" id="ph1">⬜ ยิงถูก 3 ครั้ง</div>
          <div class="ph-item" id="ph2">⬜ หลีกเลี่ยงขยะ (อย่าโดน)</div>
          <div class="ph-item" id="ph3">⬜ สลับหมู่ 1 ครั้ง (Power ครบ)</div>
        </div>
        <div class="ph-tip">แตะจอเพื่อยิงจากกากบาทกลางจอ</div>
      </div>
    `;
    DOC.body.appendChild(el);
    return el;
  }
  function show(){ ensure().classList.remove('hidden'); }
  function hide(){ ensure().classList.add('hidden'); }

  function setItem(id, ok){
    const el = DOC.getElementById(id);
    if (!el) return;
    const txt = el.textContent.replace('✅','⬜');
    el.textContent = ok ? txt.replace('⬜','✅') : txt;
  }
  function coach(text, mood='neutral'){
    try{ WIN.dispatchEvent(new CustomEvent('hha:coach',{detail:{text,mood}})); }catch(_){}
  }

  function boot(){
    if (!isPractice()) return;
    show();
    coach('โหมดฝึก 15 วิ: ยิงถูกให้ได้ 3 ครั้ง แล้วอย่าโดนขยะนะ!', 'neutral');

    WIN.addEventListener('hha:judge', (ev)=>{
      const k = String((ev.detail||{}).kind||'').toLowerCase();
      if (k==='good') S.good++;
      if (k==='bad' || k==='miss') S.bad++;

      setItem('ph1', S.good >= 3);
      setItem('ph2', S.bad === 0);

      if (S.good === 1) coach('ดี! ถูกแล้ว 1 ครั้ง 👍', 'happy');
      if (S.good === 3) coach('ครบ 3! ต่อไปลองสลับหมู่ด้วย Power ⚡', 'happy');
      if (S.bad === 1) coach('โดนผิด/โดนขยะแล้ว 😅 ไม่เป็นไร ฝึกต่อ!', 'sad');
    }, {passive:true});

    WIN.addEventListener('groups:progress', (ev)=>{
      const k = String((ev.detail||{}).kind||'').toLowerCase();
      if (k==='perfect_switch'){
        S.didSwitch = true;
        setItem('ph3', true);
        coach('เยี่ยม! สลับหมู่ได้แล้ว ✅ พร้อมของจริง!', 'happy');
      }
    }, {passive:true});

    WIN.addEventListener('hha:end', ()=> setTimeout(hide, 50), {passive:true});
  }

  if (DOC.readyState === 'loading') DOC.addEventListener('DOMContentLoaded', boot);
  else boot();
})();