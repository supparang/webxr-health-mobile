/* === /herohealth/vr-groups/effects-pack.js ===
Effects Pack — PRODUCTION (lightweight)
✅ pulse(cls, ms)
✅ judgeText(text, kind, x, y) -> uses hha:judge event (Particles can listen)
*/

(function(root){
  'use strict';
  const NS = root.GroupsVR = root.GroupsVR || {};
  const DOC = root.document;

  function pulse(cls, ms){
    if (!DOC || !DOC.body) return;
    try{
      DOC.body.classList.add(cls);
      setTimeout(()=>{ try{ DOC.body.classList.remove(cls); }catch(_){} }, ms||200);
    }catch(_){}
  }

  function judgeText(text, kind='good', x=null, y=null){
    try{
      root.dispatchEvent(new CustomEvent('hha:judge', { detail:{ kind, text, x, y } }));
    }catch(_){}
  }

  // Optional: if Particles present, we can mirror judge events to pop text
  function attachParticlesMirror(){
    root.addEventListener('hha:judge', (ev)=>{
      try{
        const d = ev.detail||{};
        const P = root.Particles;
        if (!P || !P.popText) return;
        if (!isFinite(d.x) || !isFinite(d.y)) return;
        P.popText(d.x, d.y, String(d.text||''), d.kind||'');
      }catch(_){}
    }, { passive:true });
  }

  NS.Effects = { pulse, judgeText, attachParticlesMirror };

  // auto attach mirror
  attachParticlesMirror();

})(typeof window !== 'undefined' ? window : globalThis);