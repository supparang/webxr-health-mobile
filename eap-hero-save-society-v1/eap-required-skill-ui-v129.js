/* EAP Hero v129 — Robust Required / Optional Skill UI
   - Shows required/optional status for S1–S15 on every visible Skill Hub.
   - Exactly two required skills per Session; pass mark 60/100.
   - Uses Sheet-restored portfolio/state only for display; does not change score, pass, unlock, or evidence.
*/
(() => {
  'use strict';

  const PASS_MARK = 60;
  const ALL = ['Reading', 'Writing', 'Listening', 'Speaking'];
  const REQUIRED = {
    1:['Reading','Speaking'], 2:['Reading','Writing'], 3:['Reading','Writing'],
    4:['Reading','Listening'], 5:['Reading','Speaking'], 6:['Reading','Writing'],
    7:['Writing','Speaking'], 8:['Reading','Writing'], 9:['Writing','Speaking'],
    10:['Reading','Writing'], 11:['Writing','Speaking'], 12:['Reading','Writing'],
    13:['Listening','Writing'], 14:['Writing','Speaking'], 15:['Writing','Speaking']
  };

  const css = `
  .eap-rs-summary{margin:14px 0;padding:14px 16px;border:2px solid #59d7cf;border-radius:16px;background:linear-gradient(135deg,#e8fffb,#eef8ff);color:#102033;box-shadow:0 8px 22px rgba(8,75,110,.12)}
  .eap-rs-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap}
  .eap-rs-head h3{margin:0;font-size:17px}.eap-rs-head p{margin:4px 0 0;font-size:12px;color:#53657d;font-weight:700}
  .eap-rs-count{padding:6px 10px;border-radius:999px;background:#12375a;color:#fff;font-size:12px;font-weight:900}
  .eap-rs-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:10px}
  .eap-rs-chip{padding:9px 11px;border-radius:11px;font-size:13px;font-weight:900}
  .eap-rs-chip.pass{background:#dff8ea;color:#08784f}.eap-rs-chip.todo{background:#fff0d7;color:#9a5700}
  .eap-rs-optional{margin-top:9px;padding:8px 10px;border-radius:10px;background:#edf2f7;color:#52657c;font-size:12px;font-weight:800}
  .eap-rs-required{outline:3px solid rgba(11,132,255,.28)!important;box-shadow:0 8px 18px rgba(11,132,255,.14)!important}
  .eap-rs-badge{display:inline-flex!important;margin-left:7px!important;padding:4px 8px!important;border-radius:999px!important;font-size:10px!important;line-height:1!important;font-weight:950!important;white-space:nowrap!important;vertical-align:middle!important}
  .eap-rs-badge.required{background:#0b84ff!important;color:#fff!important}.eap-rs-badge.optional{background:#e7edf3!important;color:#52657c!important;border:1px solid #cbd6e0!important}
  .eap-rs-score{display:block;margin-top:5px;font-size:11px;font-weight:900}.eap-rs-score.pass{color:#08784f}.eap-rs-score.todo{color:#9a5700}.eap-rs-score.optional{color:#607085}
  @media(max-width:720px){.eap-rs-grid{grid-template-columns:1fr}.eap-rs-badge{display:flex!important;width:max-content;margin:5px auto 0!important}}
  `;

  function ensureCss(){
    if (document.getElementById('eap-rs-style-v129')) return;
    const s=document.createElement('style'); s.id='eap-rs-style-v129'; s.textContent=css; document.head.appendChild(s);
  }
  function txt(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function sidFrom(v){
    const m=txt(v).toUpperCase().match(/(?:SESSION\s*:?\s*|\bS)0?(1[0-5]|[1-9])\b/);
    return m?Number(m[1]):0;
  }
  function currentSid(){
    const candidates=[
      window.EAPLiveSheetRouteFinalizer?.currentRoute,
      window.EAPHero?.state?.currentCloudRoute,
      window.EAPHero?.state?.currentRoute,
      window.EAPHero?.state?.currentSession,
      document.querySelector('[aria-current="page"],.active,[aria-selected="true"]')?.textContent,
      ...Array.from(document.querySelectorAll('h1,h2,h3')).map(n=>n.textContent)
    ];
    for(const v of candidates){const n=sidFrom(v); if(n)return n;}
    return 0;
  }
  function normSkill(v){const l=txt(v).toLowerCase(); return ALL.find(s=>l.includes(s.toLowerCase()))||'';}
  function readState(){try{return JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}');}catch(_){return {};}}
  function bestScores(sid){
    const best={Reading:0,Writing:0,Listening:0,Speaking:0};
    const s=readState();
    const sources=[];
    if(Array.isArray(s.portfolio))sources.push(...s.portfolio);
    if(Array.isArray(window.EAPLiveSheetRouteFinalizer?.records))sources.push(...window.EAPLiveSheetRouteFinalizer.records);
    sources.forEach(r=>{
      const rs=sidFrom(r?.session||r?.sessionId||r?.routeId||r?.sessionCode);
      const sk=normSkill(r?.skill||r?.skillName||r?.evidenceType||r?.taskId||r?.type);
      if(rs!==sid||!sk)return;
      const n=Number(r?.bestScore??r?.latestScore??r?.score??0); if(Number.isFinite(n))best[sk]=Math.max(best[sk],n);
    });
    const maps=[s.sessionProgress,s.routeStatus];
    maps.forEach(map=>{
      if(!map||typeof map!=='object')return;
      ['S'+sid,'s'+sid,String(sid)].forEach(k=>{
        const row=map[k]; if(!row)return;
        const scores=row.scores||{}; ALL.forEach(sk=>{const n=Number(scores[sk]||0); if(Number.isFinite(n))best[sk]=Math.max(best[sk],n);});
      });
    });
    return best;
  }
  function visibleSkillNodes(){
    const all=Array.from(document.querySelectorAll('#app button,#app a,#app [role="button"],#app .skill-btn,#app .skill-card'));
    const out={};
    ALL.forEach(sk=>{
      out[sk]=all.find(n=>n.offsetParent!==null && new RegExp('\\b'+sk+'\\b','i').test(txt(n.textContent)))||null;
    });
    return out;
  }
  function hubRoot(nodes){
    const list=Object.values(nodes).filter(Boolean); if(list.length<4)return null;
    let p=list[0];
    while(p&&p.id!=='app'){
      if(list.every(n=>p.contains(n)))return p;
      p=p.parentElement;
    }
    return null;
  }
  function render(){
    ensureCss();
    const sid=currentSid(); if(!sid)return;
    const nodes=visibleSkillNodes();
    if(Object.values(nodes).filter(Boolean).length<4)return;
    const root=hubRoot(nodes); if(!root)return;
    const req=REQUIRED[sid]||['Reading','Writing'];
    const optional=ALL.filter(s=>!req.includes(s));
    const best=bestScores(sid); const done=req.filter(s=>best[s]>=PASS_MARK).length;

    document.querySelectorAll('.eap-rs-summary').forEach(n=>n.remove());
    const first=nodes[ALL.find(s=>nodes[s])];
    let anchor=first;
    while(anchor.parentElement&&anchor.parentElement!==root)anchor=anchor.parentElement;
    const chips=req.map(sk=>`<div class="eap-rs-chip ${best[sk]>=PASS_MARK?'pass':'todo'}">${best[sk]>=PASS_MARK?'✓':'○'} ${sk} · ${best[sk]?best[sk]+'/100':'ยังไม่ทำ'}</div>`).join('');
    anchor.insertAdjacentHTML('beforebegin',`<section class="eap-rs-summary" data-session="${sid}"><div class="eap-rs-head"><div><h3>🎯 Skill บังคับของ Session ${sid}</h3><p>ต้องผ่านครบ 2 ทักษะ ทักษะละอย่างน้อย 60/100 · เล่นซ้ำได้และเก็บคะแนนดีที่สุด</p></div><div class="eap-rs-count">ผ่าน ${done}/2</div></div><div class="eap-rs-grid">${chips}</div><div class="eap-rs-optional">◇ Skill เสริม: ${optional.join(' · ')} — ฝึกได้ แต่ไม่ใช้ปลดล็อก Session ถัดไป</div></section>`);

    ALL.forEach(sk=>{
      const n=nodes[sk]; if(!n)return;
      const isReq=req.includes(sk); n.classList.toggle('eap-rs-required',isReq);
      let badge=n.querySelector('.eap-rs-badge');
      if(!badge){badge=document.createElement('span'); badge.className='eap-rs-badge'; n.appendChild(badge);}
      badge.className='eap-rs-badge '+(isReq?'required':'optional'); badge.textContent=isReq?'บังคับ':'เสริม';
      let line=n.parentElement?.querySelector(`.eap-rs-score[data-skill="${sk}"]`);
      if(!line){line=document.createElement('span'); line.className='eap-rs-score'; line.dataset.skill=sk; n.insertAdjacentElement('afterend',line);}
      if(isReq){const pass=best[sk]>=PASS_MARK; line.className='eap-rs-score '+(pass?'pass':'todo'); line.textContent=pass?`✓ ผ่านแล้ว ${best[sk]}/100 · เล่นซ้ำได้`:`○ ต้องผ่านอย่างน้อย 60/100${best[sk]?` · ตอนนี้ ${best[sk]}/100`:''}`;}
      else{line.className='eap-rs-score optional'; line.textContent=best[sk]>=PASS_MARK?`◇ Skill เสริม ${best[sk]}/100 · ไม่ใช้ปลดล็อก`:'◇ ฝึกเพิ่มได้ · ไม่ใช้ปลดล็อก';}
    });
  }

  let t=0; const schedule=()=>{clearTimeout(t);t=setTimeout(render,100);};
  window.addEventListener('load',schedule);
  ['eap:resume-synced','eap:route-changed','eap:profile-saved'].forEach(e=>window.addEventListener(e,schedule));
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(render,1200);
  window.EAPRequiredSkillUIV129={render,requiredSkills:sid=>REQUIRED[sid]||[],version:'v20260715-v129'};
})();