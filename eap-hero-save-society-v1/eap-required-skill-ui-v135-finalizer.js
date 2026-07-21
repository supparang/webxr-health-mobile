/* EAP Hero v135 — Equal Skill Card Finalizer
   UI-only. Preserves native click handlers and does not change score, Sheet, evidence, or unlock authority.
*/
(() => {
  'use strict';
  const ID='eap-skill-dashboard-v135';
  const STYLE='eap-skill-dashboard-v135-style';
  const SKILLS=['Reading','Listening','Writing','Speaking'];
  const ICON={Reading:'📖',Listening:'🎧',Writing:'✍️',Speaking:'🎙️'};
  const REQUIRED={1:['Reading','Speaking'],2:['Reading','Writing'],3:['Reading','Writing'],4:['Reading','Listening'],5:['Reading','Speaking'],6:['Reading','Writing'],7:['Writing','Speaking'],8:['Reading','Writing'],9:['Writing','Speaking'],10:['Reading','Writing'],11:['Writing','Speaking'],12:['Reading','Writing'],13:['Listening','Writing'],14:['Writing','Speaking'],15:['Writing','Speaking']};
  const PASS=60;
  const text=v=>String(v??'').replace(/\s+/g,' ').trim();
  const visible=n=>!!(n&&n.isConnected&&n.offsetParent!==null);

  const css=`
  body.eap-v135-ready .eap-rs-summary,
  body.eap-v135-ready .eap-compact-skill-shell,
  body.eap-v135-ready .eap-premium-shell,
  body.eap-v135-ready #eap-skill-dashboard-v134,
  body.eap-v135-ready .eap-skill-score-line{display:none!important}
  #${ID}{margin:18px 0 12px;padding:18px;border:1px solid rgba(112,226,214,.42);border-radius:22px;background:linear-gradient(145deg,#102a42,#0d2035 58%,#091827);box-shadow:0 18px 46px rgba(0,0,0,.28);color:#edf8ff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  #${ID} *{box-sizing:border-box}
  .eap135-head{display:grid;grid-template-columns:minmax(0,1fr) 220px;gap:18px;align-items:center;margin-bottom:15px}
  .eap135-kicker{font-size:11px;font-weight:950;letter-spacing:.13em;text-transform:uppercase;color:#72ead5}
  .eap135-title{margin:4px 0 5px;font-size:clamp(22px,2.2vw,31px);line-height:1.1;font-weight:950;color:#fff}
  .eap135-sub{font-size:13px;line-height:1.45;color:#aec2d5;font-weight:700}
  .eap135-progress{padding:14px;border:1px solid rgba(111,232,213,.25);border-radius:16px;background:rgba(255,255,255,.055)}
  .eap135-progress-row{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;font-weight:850;color:#c9d8e5}
  .eap135-progress-row strong{font-size:23px;color:#72ead5}
  .eap135-track{height:9px;margin-top:9px;border-radius:999px;background:#253d52;overflow:hidden}.eap135-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#18bca2,#6ce9d2)}
  .eap135-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:1fr;gap:13px;align-items:stretch}
  .eap135-card{position:relative;display:grid;grid-template-columns:56px minmax(0,1fr) 116px;gap:13px;align-items:center;width:100%;min-width:0;min-height:132px;height:100%;padding:15px;border:1px solid rgba(166,195,220,.22);border-radius:18px;background:rgba(255,255,255,.055);overflow:hidden}
  .eap135-card.required{border-color:rgba(72,222,199,.72);background:linear-gradient(135deg,rgba(31,184,168,.18),rgba(255,255,255,.045))}
  .eap135-icon{width:54px;height:54px;border-radius:16px;display:grid;place-items:center;font-size:27px;background:linear-gradient(145deg,#2dc7b3,#2389d9);box-shadow:0 9px 20px rgba(0,0,0,.22)}
  .eap135-card[data-skill="Writing"] .eap135-icon{background:linear-gradient(145deg,#ffc34b,#ef7c17)}
  .eap135-card[data-skill="Listening"] .eap135-icon{background:linear-gradient(145deg,#5bc9ff,#4778e9)}
  .eap135-card[data-skill="Speaking"] .eap135-icon{background:linear-gradient(145deg,#a98aff,#7051df)}
  .eap135-body{min-width:0;display:flex;flex-direction:column;justify-content:center}
  .eap135-name-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.eap135-name{font-size:18px;font-weight:950;color:#fff}
  .eap135-badge{padding:4px 9px;border-radius:999px;font-size:10px;font-weight:950;background:#284259;color:#c9d8e6}.eap135-badge.required{background:#d9fff5;color:#087763}
  .eap135-status{min-height:34px;margin-top:6px;font-size:12px;line-height:1.4;font-weight:700;color:#acbfd0}
  .eap135-score-row{display:flex;align-items:center;gap:8px;margin-top:8px}.eap135-mini-track{height:7px;flex:1;border-radius:999px;background:#263d51;overflow:hidden}.eap135-mini-fill{height:100%;border-radius:999px;background:#66e7cf}.eap135-score{min-width:50px;text-align:right;font-size:12px;font-weight:950;color:#edf8ff}
  .eap135-action{display:flex;align-items:center;justify-content:flex-end;align-self:stretch}
  #${ID} .eap135-start{display:inline-flex!important;align-items:center!important;justify-content:center!important;width:112px!important;min-width:112px!important;max-width:112px!important;height:42px!important;min-height:42px!important;margin:0!important;padding:9px 12px!important;border:0!important;border-radius:11px!important;background:linear-gradient(135deg,#168ee8,#3558db)!important;color:#fff!important;font:900 12px/1 system-ui!important;box-shadow:0 8px 18px rgba(22,112,224,.26)!important;position:static!important;transform:none!important;white-space:nowrap!important}
  .eap135-check{position:absolute;right:9px;top:9px;width:23px;height:23px;border-radius:50%;display:grid;place-items:center;background:#20bc81;color:#fff;font-size:12px;font-weight:950}
  .eap135-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:13px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.045);font-size:11px;font-weight:800;color:#a5b7c8}.eap135-next{color:#72ead5;font-weight:950}
  body.eap-v135-ready .eap135-hidden{display:none!important}
  @media(max-width:820px){.eap135-head{grid-template-columns:1fr}.eap135-grid{grid-template-columns:1fr}.eap135-card{grid-template-columns:52px minmax(0,1fr) 110px;min-height:124px}}
  @media(max-width:560px){#${ID}{padding:14px;border-radius:18px}.eap135-card{grid-template-columns:48px minmax(0,1fr);min-height:136px;padding:13px}.eap135-icon{width:46px;height:46px;font-size:23px}.eap135-action{grid-column:1/-1}.eap135-action .eap135-start{width:100%!important;max-width:none!important}.eap135-title{font-size:23px}}
  `;

  function inject(){let s=document.getElementById(STYLE);if(!s){s=document.createElement('style');s.id=STYLE;document.head.appendChild(s);}s.textContent=css;}
  function currentSession(){
    const heads=[...document.querySelectorAll('#app h1,#app h2,#app h3,#app h4')].filter(visible);
    for(const h of heads){const m=text(h.textContent).match(/Session\s*:?[\s-]*(1[0-5]|[1-9])\b/i);if(m)return Number(m[1]);}
    const active=[...document.querySelectorAll('#app [aria-selected="true"],#app [aria-current="page"],#app .active')].filter(visible);
    for(const n of active){const m=text(n.textContent).match(/^S(1[0-5]|[1-9])\b/i);if(m)return Number(m[1]);}
    return 0;
  }
  function scores(sid){
    const out=Object.fromEntries(SKILLS.map(s=>[s,0]));
    try{const e=window.EAPTwoSkillProgressV128?.evidenceFor?.(sid)||{};SKILLS.forEach(s=>out[s]=Number(e[s]?.bestScore??e[s]?.score??e[s]??0)||0);}catch(_){ }
    try{const st=JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}');const rows=[...(Array.isArray(st.portfolio)?st.portfolio:[]),...(window.EAPLiveSheetRouteFinalizer?.records||[])];rows.forEach(r=>{const m=text(r?.sessionId||r?.session||r?.routeId).match(/S?(1[0-5]|[1-9])/i);if(!m||Number(m[1])!==sid)return;const sk=SKILLS.find(s=>text(r?.skill||r?.skillName||r?.type).toLowerCase().includes(s.toLowerCase()));if(sk)out[sk]=Math.max(out[sk],Number(r?.bestScore??r?.latestScore??r?.score??0)||0);});}catch(_){ }
    return out;
  }
  function skillNodes(){
    const nodes=[...document.querySelectorAll('#app button,#app a[href],#app [role="button"],#app .skill-btn,#app .skill-card,#app [data-skill]')]
      .filter(n=>visible(n)&&!n.closest(`#${ID}`));
    const map={};
    SKILLS.forEach(sk=>{
      const exact=nodes.filter(n=>text(n.dataset?.skill||'').toLowerCase()===sk.toLowerCase());
      const rx=new RegExp(`\\b${sk}\\b`,'i');
      const pool=exact.length?exact:nodes.filter(n=>rx.test(text(n.textContent)));
      map[sk]=pool.sort((a,b)=>text(a.textContent).length-text(b.textContent).length)[0]||null;
    });
    return map;
  }
  function commonHost(list){let n=list[0]?.parentElement;while(n&&n.id!=='app'){if(list.every(x=>n.contains(x)))return n;n=n.parentElement;}return document.getElementById('app');}
  function makeCard(sk,node,required,score){
    const passed=score>=PASS;const c=document.createElement('article');c.className=`eap135-card ${required?'required':''}`;c.dataset.skill=sk;
    c.innerHTML=`<div class="eap135-icon">${ICON[sk]}</div><div class="eap135-body"><div class="eap135-name-row"><span class="eap135-name">${sk}</span><span class="eap135-badge ${required?'required':''}">${required?'บังคับ':'เสริม'}</span></div><div class="eap135-status">${score?`${passed?'ผ่านแล้ว':'คะแนนดีที่สุด'} ${score}/100`:(required?'ยังไม่ได้ทำ · ต้องได้อย่างน้อย 60/100':'ฝึกเพิ่มได้ · ไม่ใช้ปลดล็อก')}</div><div class="eap135-score-row"><div class="eap135-mini-track"><div class="eap135-mini-fill" style="width:${Math.max(0,Math.min(100,score))}%"></div></div><span class="eap135-score">${score}/100</span></div></div><div class="eap135-action"></div>${passed?'<span class="eap135-check">✓</span>':''}`;
    node.className='eap135-start';node.removeAttribute('style');node.textContent=score?'▶ ฝึกอีกครั้ง':'▶ เริ่มฝึก';c.querySelector('.eap135-action').appendChild(node);return c;
  }
  function cleanPortfolio(){document.querySelectorAll('#app td').forEach(td=>{if(text(td.textContent)==='Invalid Date')td.textContent='—';if(/Completed legacy evidence retained after browser-storage migration\.?/i.test(text(td.textContent)))td.textContent='บันทึกผลการเรียนเดิมแล้ว';});}
  function render(){
    inject();cleanPortfolio();const sid=currentSession();if(!sid)return;
    const map=skillNodes();const list=SKILLS.map(s=>map[s]).filter(Boolean);if(list.length<4||new Set(list).size<4)return;
    const host=commonHost(list);if(!host)return;
    document.getElementById(ID)?.remove();
    const req=REQUIRED[sid]||['Reading','Writing'];const sc=scores(sid);const passed=req.filter(s=>sc[s]>=PASS).length;const avg=Math.round(req.reduce((a,s)=>a+Math.min(100,sc[s]),0)/2);
    const shell=document.createElement('section');shell.id=ID;shell.dataset.session=String(sid);
    shell.innerHTML=`<div class="eap135-head"><div><div class="eap135-kicker">Required Skill Mission</div><div class="eap135-title">Session ${sid} Skill Dashboard</div><div class="eap135-sub">ผ่าน ${req.join(' + ')} อย่างน้อยทักษะละ 60/100 เพื่อปลดล็อก Session ถัดไป</div></div><div class="eap135-progress"><div class="eap135-progress-row"><span>ความก้าวหน้าทักษะบังคับ</span><strong>${passed}/2</strong></div><div class="eap135-track"><div class="eap135-fill" style="width:${avg}%"></div></div></div></div><div class="eap135-grid"></div><div class="eap135-footer"><span>🔵 บังคับ 2 ทักษะ · ⚪ เสริมฝึกเพิ่มได้</span><span class="eap135-next">${passed===2?'✅ พร้อมไป Session ถัดไป':'⏳ ทำ Skill บังคับให้ครบ'}</span></div>`;
    const first=list[0];let anchor=first;while(anchor.parentElement&&anchor.parentElement!==host)anchor=anchor.parentElement;anchor.parentElement.insertBefore(shell,anchor);
    const grid=shell.querySelector('.eap135-grid');SKILLS.forEach(sk=>grid.appendChild(makeCard(sk,map[sk],req.includes(sk),sc[sk])));
    document.body.classList.add('eap-v135-ready');
    [...host.querySelectorAll('.eap-rs-summary,.eap-compact-skill-shell,.eap-premium-shell,#eap-skill-dashboard-v134')].forEach(n=>n.classList.add('eap135-hidden'));
    [...host.children].forEach(el=>{if(el!==shell&&!el.contains(shell)&&!shell.contains(el)){const hasSkill=SKILLS.some(sk=>new RegExp(`\\b${sk}\\b`,'i').test(text(el.textContent)));if(hasSkill)el.classList.add('eap135-hidden');}});
  }
  let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,220);};
  window.addEventListener('load',schedule);['eap:resume-synced','eap:route-changed','eap:profile-saved','eap:session-changed'].forEach(e=>window.addEventListener(e,schedule));new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});setInterval(schedule,1800);
  window.EAPRequiredSkillUIV135={render,version:'v20260721-v135-finalizer'};
})();