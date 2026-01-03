/* === /herohealth/vr-groups/end-cinematic.js ===
PACK 30: End Cinematic — PRODUCTION
✅ Count-up stats on end overlay
✅ Rank praise line + small confetti (Particles optional)
✅ Adds class fx-end-cine for CSS
*/

(function(root){
  'use strict';
  const DOC = root.document;
  if (!DOC) return;

  const NS = root.GroupsVR = root.GroupsVR || {};
  const NOW = ()=> (root.performance && performance.now) ? performance.now() : Date.now();

  function fxLevel(){
    try{
      const L = (NS.FXPerf && NS.FXPerf.getLevel) ? NS.FXPerf.getLevel() : Number(DOC.body.dataset.fxLevel||3);
      return Number(L)||3;
    }catch{ return 3; }
  }
  function allow(min){ return fxLevel() >= (min||1); }

  function hasParticles(){
    const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
    return !!P;
  }
  function celebrate(){
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      if (P && typeof P.celebrate==='function') P.celebrate();
    }catch(_){}
  }
  function burst(x,y,n=18){
    try{
      const P = root.Particles || (root.GAME_MODULES && root.GAME_MODULES.Particles);
      if (P && typeof P.burst==='function') P.burst(x,y,n);
    }catch(_){}
  }

  function qsSel(id){
    return DOC.getElementById(id) || DOC.querySelector('#'+id);
  }

  function praise(grade, acc){
    grade = String(grade||'C').toUpperCase();
    acc = Number(acc||0);
    if (grade==='SSS') return `🔥 โคตรโหด! ระดับตำนาน (ACC ${acc}%)`;
    if (grade==='SS')  return `⚡ สายฟ้า! โหดจัด (ACC ${acc}%)`;
    if (grade==='S')   return `✨ เทพมาก! คุมเกมได้ (ACC ${acc}%)`;
    if (grade==='A')   return `✅ แน่นมาก! อีกนิดถึง S`;
    if (grade==='B')   return `👍 ดีเลย! ลองคุมคอมโบเพิ่ม`;
    return `🙂 เริ่มได้ดี! โฟกัสยิงให้ถูกหมู่`;
  }

  function countUp(el, from, to, ms){
    from = Number(from)||0;
    to   = Number(to)||0;
    ms   = Math.max(220, Number(ms)||520);

    const t0 = NOW();
    const diff = to - from;

    function frame(){
      const t = NOW();
      const p = Math.min(1, (t - t0)/ms);
      // easeOutCubic
      const e = 1 - Math.pow(1-p, 3);
      const v = from + diff * e;
      el.textContent = String(Math.round(v));
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = String(to|0);
    }
    requestAnimationFrame(frame);
  }

  function countUpPct(el, to, ms){
    to = Number(to)||0;
    ms = Math.max(240, Number(ms)||560);
    const t0 = NOW();
    function frame(){
      const t = NOW();
      const p = Math.min(1, (t - t0)/ms);
      const e = 1 - Math.pow(1-p, 3);
      const v = to * e;
      el.textContent = String(Math.round(v)) + '%';
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = String(to|0) + '%';
    }
    requestAnimationFrame(frame);
  }

  root.addEventListener('hha:end', (ev)=>{
    if (!allow(1)) return;

    const d = ev.detail||{};
    DOC.body.classList.add('fx-end-cine');
    setTimeout(()=>DOC.body.classList.remove('fx-end-cine'), 1100);

    // Overlay elements exist in groups-vr.html
    const endLine = qsSel('endLine');
    const endScore= qsSel('endScore');
    const endRank = qsSel('endRank');
    const endAcc  = qsSel('endAcc');
    const endMiss = qsSel('endMiss');

    const grade = String(d.grade||'C');
    const acc   = Number(d.accuracyGoodPct ?? 0);
    const score = Number(d.scoreFinal ?? 0);
    const miss  = Number(d.misses ?? 0);

    if (endLine) endLine.textContent = praise(grade, acc);
    if (endRank) endRank.textContent = grade;

    if (endScore) countUp(endScore, 0, score, 720);
    if (endMiss)  countUp(endMiss,  0, miss,  520);
    if (endAcc)   countUpPct(endAcc, acc, 680);

    // celebration
    const x = (root.innerWidth||360)*0.5;
    const y = (root.innerHeight||640)*0.28;
    if (hasParticles()){
      if (grade==='SSS') { burst(x,y,34); celebrate(); }
      else if (grade==='SS') { burst(x,y,26); celebrate(); }
      else if (grade==='S') { burst(x,y,22); }
      else { burst(x,y,16); }
    }

    try{
      if (grade==='SSS') navigator.vibrate && navigator.vibrate([18,18,18,18]);
      else if (grade==='SS') navigator.vibrate && navigator.vibrate([16,26,16]);
      else navigator.vibrate && navigator.vibrate(14);
    }catch(_){}
  }, {passive:true});

})(typeof window!=='undefined' ? window : globalThis);