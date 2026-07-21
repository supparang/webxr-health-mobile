/* EAP Hero v134 — Production Required Skill Dashboard
   Visual/controller layer only. Does not change scoring, Sheet writes, evidence, or unlock authority.
*/
(() => {
  'use strict';
  const VERSION='v20260721-v134-production';
  const ID='eap-skill-dashboard-v134';
  const STYLE='eap-skill-dashboard-v134-style';
  const SKILLS=['Reading','Listening','Writing','Speaking'];
  const ICON={Reading:'📖',Listening:'🎧',Writing:'✍️',Speaking:'🎙️'};
  const REQUIRED={1:['Reading','Speaking'],2:['Reading','Writing'],3:['Reading','Writing'],4:['Reading','Listening'],5:['Reading','Speaking'],6:['Reading','Writing'],7:['Writing','Speaking'],8:['Reading','Writing'],9:['Writing','Speaking'],10:['Reading','Writing'],11:['Writing','Speaking'],12:['Reading','Writing'],13:['Listening','Writing'],14:['Writing','Speaking'],15:['Writing','Speaking']};
  const PASS=60;

  const css=`
  body.eap-v134-ready .eap-rs-summary,
  body.eap-v134-ready .eap-compact-skill-shell,
  body.eap-v134-ready .eap-premium-shell,
  body.eap-v134-ready .eap-skill-score-line{display:none!important}
  #${ID}{margin:18px 0 10px;border:1px solid rgba(111,221,220,.38);border-radius:22px;padding:18px;background:linear-gradient(145deg,#102940 0%,#102238 55%,#0b1c2e 100%);box-shadow:0 18px 44px rgba(2,12,27,.26);color:#eef8ff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
  #${ID} *{box-sizing:border-box}
  .eap134-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:center;margin-bottom:16px}
  .eap134-kicker{font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#7de9d7}
  .eap134-title{margin:4px 0 5px;font-size:clamp(22px,2.4vw,32px);line-height:1.08;font-weight:950;color:#fff}
  .eap134-sub{font-size:13px;line-height:1.45;color:#aec2d5;font-weight:650}
  .eap134-progress{min-width:210px;padding:13px 15px;border:1px solid rgba(125,233,215,.25);border-radius:16px;background:rgba(255,255,255,.055)}
  .eap134-progress-top{display:flex;justify-content:space-between;align-items:center;gap:12px;font-size:12px;font-weight:850;color:#c9d8e5}
  .eap134-progress-top strong{font-size:22px;color:#7de9d7}
  .eap134-track{height:9px;margin-top:9px;border-radius:999px;overflow:hidden;background:#263c50}
  .eap134-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#18bfa4,#65e7cf)}
  .eap134-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .eap134-card{position:relative;display:grid;grid-template-columns:54px minmax(0,1fr) auto;gap:13px;align-items:center;min-height:118px;padding:15px;border:1px solid rgba(167,194,218,.19);border-radius:17px;background:rgba(255,255,255,.055);overflow:hidden}
  .eap134-card.required{border-color:rgba(74,219,198,.62);background:linear-gradient(135deg,rgba(37,185,170,.16),rgba(255,255,255,.045))}
  .eap134-icon{width:52px;height:52px;border-radius:15px;display:grid;place-items:center;font-size:26px;background:linear-gradient(145deg,#2dc6b2,#2387d8);box-shadow:0 9px 20px rgba(0,0,0,.2)}
  .eap134-card[data-skill="Writing"] .eap134-icon{background:linear-gradient(145deg,#ffbd3d,#ee7b16)}
  .eap134-card[data-skill="Listening"] .eap134-icon{background:linear-gradient(145deg,#55c5fb,#4777e8)}
  .eap134-card[data-skill="Speaking"] .eap134-icon{background:linear-gradient(145deg,#a582ff,#6f52de)}
  .eap134-body{min-width:0}
  .eap134-name-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
  .eap134-name{font-size:18px;font-weight:950;color:#fff}
  .eap134-badge{padding:4px 8px;border-radius:999px;font-size:10px;font-weight:950;background:#254057;color:#c5d4e1}
  .eap134-badge.required{background:#d8fff4;color:#087763}
  .eap134-status{margin-top:5px;font-size:12px;font-weight:700;color:#aebfd0}
  .eap134-scoreline{display:flex;align-items:center;gap:8px;margin-top:8px}
  .eap134-mini-track{height:6px;flex:1;min-width:80px;border-radius:999px;overflow:hidden;background:#263c50}
  .eap134-mini-fill{height:100%;border-radius:999px;background:#64e5cd}
  .eap134-score{font-size:12px;font-weight:950;color:#e9f7ff;min-width:48px;text-align:right}
  .eap134-action{display:flex;align-items:center;justify-content:flex-end}
  #${ID} .eap134-start{min-width:112px;min-height:40px;padding:9px 14px!important;border:0!important;border-radius:11px!important;background:linear-gradient(135deg,#168ee8,#3558db)!important;color:#fff!important;font:900 12px/1 system-ui!important;box-shadow:0 8px 18px rgba(22,112,224,.25)!important;white-space:nowrap!important;transform:none!important;position:static!important;margin:0!important;width:auto!important;height:auto!important}
  #${ID} .eap134-start:hover{filter:brightness(1.08)}
  .eap134-check{position:absolute;top:10px;right:10px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#20bc81;color:white;font-size:12px;font-weight:950}
  .eap134-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:13px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.045);font-size:11px;font-weight:750;color:#9fb2c5}
  .eap134-next{color:#7de9d7;font-weight:900}
  body.eap-v134-ready .eap134-legacy-hidden{display:none!important}
  body.eap-v134-ready .recent-portfolio td:first-child{white-space:nowrap}
  body.eap-v134-ready .recent-portfolio td:last-child{max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  @media(max-width:760px){
    #${ID}{padding:14px;border-radius:17px}.eap134-head{grid-template-columns:1fr}.eap134-progress{min-width:0}.eap134-grid{grid-template-columns:1fr}.eap134-card{grid-template-columns:48px minmax(0,1fr);min-height:112px;padding:13px}.eap134-icon{width:46px;height:46px;font-size:23px}.eap134-action{grid-column:1/-1}.eap134-action .eap134-start{width:100%!important}.eap134-title{font-size:23px}
  }
  `;

  const text=v=>String(v??'').replace(/\s+/g,' ').trim();
  function inject(){let s=document.getElementById(STYLE);if(!s){s=document.createElement('style');s.id=STYLE;document.head.appendChild(s);}s.textContent=css;}
  function visible(n){return !!(n&&n.isConnected&&n.offsetParent!==null);}
  function session(){
    const hs=[...document.querySelectorAll('#app h1,#app h2,#app h3,#app h4')].filter(visible);
    for(const h of hs){const m=text(h.textContent).match(/Session\s*:?\s*(1[0-5]|[1-9])\b/i);if(m)return Number(m[1]);}
    const active=[...document.querySelectorAll('#app [aria-selected="true"],#app .active,#app [aria-current="page"]')].filter(visible);
    for(const n of active){const m=text(n.textContent).match(/^S(1[0-5]|[1-9])\b/i);if(m)return Number(m[1]);}
    return 0;
  }
  function scoreMap(sid){
    const out=Object.fromEntries(SKILLS.map(s=>[s,0]));
    try{const e=window.EAPTwoSkillProgressV128?.evidenceFor?.(sid)||{};SKILLS.forEach(s=>out[s]=Number(e[s]?.bestScore??e[s]?.score??e[s]??0)||0);}catch(_){}
    try{
      const st=JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}');
      const rows=[...(Array.isArray(st.portfolio)?st.portfolio:[]),...(window.EAPLiveSheetRouteFinalizer?.records||[])];
      rows.forEach(r=>{const rm=text(r?.sessionId||r?.session||r?.routeId).match(/S?(1[0-5]|[1-9])/i);if(!rm||Number(rm[1])!==sid)return;const sk=SKILLS.find(s=>text(r?.skill||r?.skillName).toLowerCase().includes(s.toLowerCase()));if(sk)out[sk]=Math.max(out[sk],Number(r?.bestScore??r?.latestScore??r?.score??0)||0);});
    }catch(_){}
    return out;
  }
  function buttons(){
    const all=[...document.querySelectorAll('#app button,#app a[href],#app [role="button"]')].filter(n=>visible(n)&&!n.closest(`#${ID}`));
    const map={};
    SKILLS.forEach(sk=>{const rx=new RegExp(`\\b${sk}\\b`,'i');map[sk]=all.filter(n=>rx.test(text(n.textContent))).sort((a,b)=>text(a.textContent).length-text(b.textContent).length)[0]||null;});
    return map;
  }
  function commonHost(list){
    let n=list[0]?.parentElement;
    while(n&&n.id!=='app'){if(list.every(b=>n.contains(b)))return n;n=n.parentElement;}
    return document.getElementById('app');
  }
  function card(sk,btn,required,score){
    const pass=score>=PASS;
    const c=document.createElement('article');c.className=`eap134-card ${required?'required':''}`;c.dataset.skill=sk;
    c.innerHTML=`<div class="eap134-icon">${ICON[sk]}</div><div class="eap134-body"><div class="eap134-name-row"><span class="eap134-name">${sk}</span><span class="eap134-badge ${required?'required':''}">${required?'บังคับ':'เสริม'}</span></div><div class="eap134-status">${score?`${pass?'ผ่านแล้ว':'คะแนนดีที่สุด'} ${score}/100`:(required?'ยังไม่ได้ทำ · ต้องได้อย่างน้อย 60/100':'ฝึกเพิ่มได้ · ไม่ใช้ปลดล็อก')}</div><div class="eap134-scoreline"><div class="eap134-mini-track"><div class="eap134-mini-fill" style="width:${Math.max(0,Math.min(100,score))}%"></div></div><span class="eap134-score">${score}/100</span></div></div><div class="eap134-action"></div>${pass?'<span class="eap134-check">✓</span>':''}`;
    btn.className='eap134-start';btn.removeAttribute('style');btn.textContent=score?'▶ ฝึกอีกครั้ง':'▶ เริ่มฝึก';c.querySelector('.eap134-action').appendChild(btn);
    return c;
  }
  function cleanPortfolio(){
    document.querySelectorAll('#app td').forEach(td=>{
      if(text(td.textContent)==='Invalid Date')td.textContent='—';
      if(/Completed legacy evidence retained after browser-storage migration\.?/i.test(text(td.textContent)))td.textContent='บันทึกผลการเรียนเดิมแล้ว';
    });
  }
  function render(){
    inject();cleanPortfolio();
    const sid=session();if(!sid)return;
    const map=buttons();const list=SKILLS.map(s=>map[s]).filter(Boolean);if(list.length<4||new Set(list).size<4)return;
    const host=commonHost(list);if(!host)return;
    document.getElementById(ID)?.remove();document.querySelectorAll('.eap-premium-shell').forEach(n=>n.remove());
    const req=REQUIRED[sid]||['Reading','Writing'];const scores=scoreMap(sid);const passed=req.filter(s=>scores[s]>=PASS).length;const avg=Math.round(req.reduce((a,s)=>a+Math.min(100,scores[s]),0)/2);
    const shell=document.createElement('section');shell.id=ID;shell.dataset.session=sid;
    shell.innerHTML=`<div class="eap134-head"><div><div class="eap134-kicker">Required Skill Mission</div><div class="eap134-title">Session ${sid} Skill Dashboard</div><div class="eap134-sub">ผ่าน ${req.join(' + ')} อย่างน้อยทักษะละ 60/100 เพื่อปลดล็อก Session ถัดไป</div></div><div class="eap134-progress"><div class="eap134-progress-top"><span>ความก้าวหน้าทักษะบังคับ</span><strong>${passed}/2</strong></div><div class="eap134-track"><div class="eap134-fill" style="width:${avg}%"></div></div></div></div><div class="eap134-grid"></div><div class="eap134-footer"><span>🔵 บังคับ 2 ทักษะ · ⚪ เสริมฝึกเพิ่มได้</span><span class="eap134-next">${passed===2?'✅ พร้อมไป Session ถัดไป':'⏳ ทำ Skill บังคับให้ครบ'}</span></div>`;
    const first=list[0];let anchor=first;while(anchor.parentElement&&anchor.parentElement!==host)anchor=anchor.parentElement;anchor.parentElement.insertBefore(shell,anchor);
    const grid=shell.querySelector('.eap134-grid');SKILLS.forEach(sk=>grid.appendChild(card(sk,map[sk],req.includes(sk),scores[sk])));
    [...host.children].forEach(el=>{if(el!==shell&&el!==anchor&&(!el.querySelector('button,a,[role="button"]')||!text(el.textContent)))el.classList.add('eap134-legacy-hidden');});
    [...host.querySelectorAll('.eap-rs-summary,.eap-compact-skill-shell')].forEach(n=>n.classList.add('eap134-legacy-hidden'));
    document.body.classList.add('eap-v134-ready');
  }
  let t=0;const schedule=()=>{clearTimeout(t);t=setTimeout(render,180);};
  window.addEventListener('load',schedule);['eap:resume-synced','eap:route-changed','eap:profile-saved','eap:session-changed'].forEach(e=>window.addEventListener(e,schedule));
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});setInterval(schedule,1700);
  window.EAPRequiredSkillUIV134={render,version:VERSION};
})();