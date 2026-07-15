/* EAP Hero v132 — Premium Full-width Skill Hub UI
   - Builds the Session skill hub as a responsive full-width dashboard.
   - Uses the visible Session heading as the route source so S4 cannot show Session 1 status.
   - Reuses the four existing native skill buttons and preserves their click handlers.
   - Visual-only: does not change score, pass/fail, unlock, Sheet, evidence, or route authority.
*/
(() => {
  'use strict';

  const PASS_MARK = 60;
  const ALL = ['Reading','Writing','Listening','Speaking'];
  const ICON = {Reading:'📖',Writing:'✍️',Listening:'🎧',Speaking:'🎙️'};
  const REQUIRED = {
    1:['Reading','Speaking'],2:['Reading','Writing'],3:['Reading','Writing'],
    4:['Reading','Listening'],5:['Reading','Speaking'],6:['Reading','Writing'],
    7:['Writing','Speaking'],8:['Reading','Writing'],9:['Writing','Speaking'],
    10:['Reading','Writing'],11:['Writing','Speaking'],12:['Reading','Writing'],
    13:['Listening','Writing'],14:['Writing','Speaking'],15:['Writing','Speaking']
  };

  const css = `
    .eap-rs-summary,.eap-rs-score,.eap-skill-score-line{display:none!important}
    .eap-premium-shell{width:100%!important;max-width:none!important;margin:18px 0 8px!important;clear:both!important;display:block!important}
    .eap-premium-summary{display:grid!important;grid-template-columns:minmax(0,1.8fr) minmax(210px,.7fr) minmax(240px,.8fr)!important;align-items:stretch!important;border:1px solid #d9e5ef!important;border-radius:18px!important;background:linear-gradient(135deg,#f8fbff 0%,#fff 58%,#f0fbf7 100%)!important;box-shadow:0 12px 30px rgba(16,32,51,.08)!important;overflow:hidden!important;margin-bottom:14px!important;color:#102033!important}
    .eap-premium-summary > div{padding:18px 20px!important;min-width:0!important}
    .eap-premium-summary > div+div{border-left:1px solid #e1e8ef!important}
    .eap-premium-title-wrap{display:flex!important;align-items:center!important;gap:14px!important}
    .eap-premium-shield{width:52px!important;height:58px!important;flex:0 0 auto!important;border-radius:16px 16px 22px 22px!important;display:grid!important;place-items:center!important;font-size:27px!important;background:linear-gradient(145deg,#43d1b2,#0d8ee7)!important;color:#fff!important;box-shadow:0 10px 22px rgba(13,142,231,.22)!important}
    .eap-premium-title{font-size:18px!important;line-height:1.25!important;font-weight:950!important;color:#102033!important}
    .eap-premium-title-badge{display:inline-flex!important;margin-left:8px!important;padding:4px 9px!important;border-radius:999px!important;background:#dff7e9!important;color:#0a7a4c!important;font-size:11px!important;font-weight:900!important;vertical-align:middle!important}
    .eap-premium-help{margin-top:6px!important;font-size:12px!important;line-height:1.45!important;color:#53657d!important;font-weight:700!important}
    .eap-premium-progress-label{font-size:11px!important;font-weight:850!important;color:#66778a!important;margin-bottom:4px!important}
    .eap-premium-progress-score{font-size:25px!important;line-height:1!important;font-weight:950!important;color:#087c4d!important}
    .eap-premium-track{height:9px!important;border-radius:999px!important;background:#e1e7ed!important;margin-top:10px!important;overflow:hidden!important}
    .eap-premium-fill{height:100%!important;border-radius:999px!important;background:linear-gradient(90deg,#16a36a,#07934c)!important;transition:width .25s ease!important}
    .eap-premium-ready{display:flex!important;flex-direction:column!important;justify-content:center!important;gap:9px!important;background:rgba(224,248,237,.72)!important}
    .eap-premium-ready-line{font-size:12px!important;font-weight:850!important;color:#31604f!important}
    .eap-premium-ready-line strong{color:#087c4d!important}

    .eap-premium-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important;width:100%!important;margin:0!important;padding:0!important;align-items:stretch!important}
    .eap-premium-card{position:relative!important;display:grid!important;grid-template-columns:74px minmax(0,1fr)!important;gap:16px!important;align-items:center!important;min-width:0!important;min-height:164px!important;width:100%!important;margin:0!important;padding:20px!important;border-radius:18px!important;background:#fff!important;box-shadow:0 10px 24px rgba(16,32,51,.07)!important;overflow:hidden!important;transform:none!important;inset:auto!important;text-align:left!important}
    .eap-premium-card.required{border:1.5px solid #80cfe5!important}
    .eap-premium-card.optional{border:1.5px solid #cad9e8!important}
    .eap-premium-card[data-skill="Reading"]{background:linear-gradient(135deg,#efffff,#f7fffc)!important}
    .eap-premium-card[data-skill="Writing"]{background:linear-gradient(135deg,#fffaf1,#fffdf8)!important;border-color:#f0c977!important}
    .eap-premium-card[data-skill="Listening"]{background:linear-gradient(135deg,#f3f9ff,#fbfdff)!important;border-color:#a9cee9!important}
    .eap-premium-card[data-skill="Speaking"]{background:linear-gradient(135deg,#f7f3ff,#fcfaff)!important;border-color:#c7b3f1!important}
    .eap-premium-icon{width:66px!important;height:66px!important;border-radius:50%!important;display:grid!important;place-items:center!important;font-size:32px!important;box-shadow:0 8px 18px rgba(16,32,51,.14)!important;background:linear-gradient(145deg,#48dbc0,#1fa4df)!important}
    [data-skill="Writing"] .eap-premium-icon{background:linear-gradient(145deg,#ffc62c,#ff9e00)!important}
    [data-skill="Listening"] .eap-premium-icon{background:linear-gradient(145deg,#57bdf5,#2f78dc)!important}
    [data-skill="Speaking"] .eap-premium-icon{background:linear-gradient(145deg,#8177ec,#6147d7)!important}
    .eap-premium-body{min-width:0!important;display:flex!important;flex-direction:column!important;gap:7px!important}
    .eap-premium-head{display:flex!important;align-items:center!important;gap:9px!important;flex-wrap:wrap!important}
    .eap-premium-name{font-size:19px!important;line-height:1.15!important;font-weight:950!important;color:#102033!important}
    .eap-premium-kind{display:inline-flex!important;padding:4px 9px!important;border-radius:999px!important;font-size:10px!important;line-height:1!important;font-weight:950!important;background:#147ce5!important;color:#fff!important}
    .eap-premium-kind.optional{background:#e8edf2!important;color:#52657c!important}
    .eap-premium-status{font-size:12px!important;line-height:1.35!important;font-weight:750!important;color:#53657d!important}
    .eap-premium-score-row{display:flex!important;align-items:center!important;gap:10px!important}
    .eap-premium-score-track{height:8px!important;flex:1!important;border-radius:999px!important;background:#dfe5eb!important;overflow:hidden!important}
    .eap-premium-score-fill{height:100%!important;border-radius:999px!important;background:#0c934f!important}
    [data-skill="Writing"] .eap-premium-score-fill{background:#f09a00!important}
    [data-skill="Listening"] .eap-premium-score-fill{background:#347fd9!important}
    [data-skill="Speaking"] .eap-premium-score-fill{background:#6c50d9!important}
    .eap-premium-score{min-width:58px!important;text-align:right!important;font-size:15px!important;font-weight:950!important;color:#087c4d!important}
    [data-skill="Writing"] .eap-premium-score{color:#e98900!important}
    [data-skill="Listening"] .eap-premium-score{color:#2b73cf!important}
    [data-skill="Speaking"] .eap-premium-score{color:#6046ce!important}
    .eap-premium-actions{display:flex!important;gap:10px!important;flex-wrap:wrap!important;margin-top:2px!important}
    .eap-premium-start,.eap-premium-stats{min-height:38px!important;border-radius:9px!important;padding:9px 18px!important;font-size:12px!important;font-weight:900!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}
    .eap-premium-start{background:linear-gradient(135deg,#176ee8,#2859d7)!important;color:#fff!important;border:0!important;box-shadow:0 7px 16px rgba(31,102,224,.2)!important}
    .eap-premium-stats{background:rgba(255,255,255,.72)!important;color:#53657d!important;border:1px solid #ccd8e4!important}
    .eap-premium-check{position:absolute!important;right:16px!important;top:15px!important;width:23px!important;height:23px!important;border-radius:50%!important;display:grid!important;place-items:center!important;background:#07874c!important;color:#fff!important;font-size:13px!important;font-weight:950!important}
    .eap-premium-legend{display:flex!important;align-items:center!important;gap:18px!important;flex-wrap:wrap!important;margin-top:11px!important;padding:9px 13px!important;border-radius:12px!important;background:#f4f7fa!important;color:#607085!important;font-size:11px!important;font-weight:800!important}

    @media(max-width:980px){.eap-premium-summary{grid-template-columns:1fr 220px!important}.eap-premium-ready{grid-column:1/-1!important;border-left:0!important;border-top:1px solid #e1e8ef!important}.eap-premium-grid{grid-template-columns:1fr!important}}
    @media(max-width:640px){.eap-premium-summary{grid-template-columns:1fr!important}.eap-premium-summary>div+div{border-left:0!important;border-top:1px solid #e1e8ef!important}.eap-premium-card{grid-template-columns:58px minmax(0,1fr)!important;padding:15px!important;min-height:150px!important}.eap-premium-icon{width:54px!important;height:54px!important;font-size:27px!important}.eap-premium-name{font-size:17px!important}.eap-premium-actions{display:grid!important;grid-template-columns:1fr 1fr!important}.eap-premium-start,.eap-premium-stats{padding:9px 10px!important}}
  `;

  function text(v){return String(v==null?'':v).replace(/\s+/g,' ').trim();}
  function injectCss(){let s=document.getElementById('eap-premium-skill-ui-v132');if(!s){s=document.createElement('style');s.id='eap-premium-skill-ui-v132';document.head.appendChild(s);}s.textContent=css;}
  function parseSession(v){const m=text(v).match(/(?:Session\s*:?[\s-]*|\bS)0?(1[0-5]|[1-9])\b/i);return m?Number(m[1]):0;}
  function currentSession(){
    const headings=[...document.querySelectorAll('#app h1,#app h2,#app h3')].filter(n=>n.offsetParent!==null);
    for(const h of headings){const n=parseSession(h.textContent);if(n)return n;}
    const active=[...document.querySelectorAll('#app [aria-current="page"],#app .active,#app [aria-selected="true"]')].filter(n=>n.offsetParent!==null);
    for(const a of active){const n=parseSession(a.textContent);if(n)return n;}
    for(const v of [window.EAPHero?.state?.currentRoute,window.EAPHero?.state?.currentSession,window.EAPLiveSheetRouteFinalizer?.currentRoute]){const n=parseSession(v);if(n)return n;}
    return 0;
  }
  function findButtons(){
    const app=document.getElementById('app');if(!app)return{};
    const nodes=[...app.querySelectorAll('button,a,[role="button"],.skill-btn,.skill-card')].filter(n=>n.offsetParent!==null&&!n.closest('.eap-premium-shell'));
    const out={};
    ALL.forEach(skill=>{const rx=new RegExp(`\\b${skill}\\b`,'i');out[skill]=nodes.filter(n=>rx.test(text(n.textContent))).sort((a,b)=>text(a.textContent).length-text(b.textContent).length)[0]||null;});
    return out;
  }
  function scoreMap(sid){
    try{if(window.EAPTwoSkillProgressV128?.evidenceFor)return window.EAPTwoSkillProgressV128.evidenceFor(sid)||{};}catch(_){}
    const best=Object.fromEntries(ALL.map(s=>[s,0]));
    try{
      const state=JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}');
      const rows=[...(Array.isArray(state.portfolio)?state.portfolio:[]),...(window.EAPLiveSheetRouteFinalizer?.records||[])];
      rows.forEach(r=>{const rs=parseSession(r?.session||r?.sessionId||r?.routeId||r?.sessionCode);const sk=ALL.find(s=>text(r?.skill||r?.skillName||r?.type).toLowerCase().includes(s.toLowerCase()));if(rs===sid&&sk){const n=Number(r?.bestScore??r?.latestScore??r?.score??0)||0;best[sk]=Math.max(best[sk],n);}});
    }catch(_){}
    return best;
  }
  function nearestHost(buttons){
    let root=buttons[0]?.parentElement;
    while(root&&root.id!=='app'){if(buttons.every(b=>root.contains(b)))return root;root=root.parentElement;}
    return buttons[0]?.parentElement||document.getElementById('app');
  }
  function buildCard(skill,button,required,score){
    const passed=score>=PASS_MARK;
    const card=document.createElement('article');
    card.className=`eap-premium-card ${required?'required':'optional'}`;card.dataset.skill=skill;
    card.innerHTML=`<div class="eap-premium-icon">${ICON[skill]}</div><div class="eap-premium-body"><div class="eap-premium-head"><span class="eap-premium-name">${skill}</span><span class="eap-premium-kind ${required?'':'optional'}">${required?'บังคับ':'เสริม'}</span></div><div class="eap-premium-status">${score?`${passed?'ผ่านแล้ว':'ฝึกแล้ว'} ${score}/100 · ${passed?'ผ่านแล้ว':'คะแนนดีที่สุด'}`:(required?'ยังไม่ทำ · ต้องผ่านอย่างน้อย 60/100':'ฝึกเพิ่มได้ · ไม่ใช้ปลดล็อก')}</div><div class="eap-premium-score-row"><div class="eap-premium-score-track"><div class="eap-premium-score-fill" style="width:${Math.max(0,Math.min(100,score))}%"></div></div><div class="eap-premium-score">${score}/100</div></div><div class="eap-premium-actions"></div></div>${passed?'<span class="eap-premium-check">✓</span>':''}`;
    const actions=card.querySelector('.eap-premium-actions');
    button.className='eap-premium-start';button.removeAttribute('style');
    [...button.querySelectorAll('.eap-rs-badge,.eap-skill-type-badge,.eap-skill-compact-meta')].forEach(n=>n.remove());
    if(!/เริ่ม|ฝึก|เล่น|start/i.test(text(button.textContent)))button.textContent='▶ เริ่มฝึก';
    actions.appendChild(button);
    const stats=document.createElement('span');stats.className='eap-premium-stats';stats.textContent='📊 ดูสถิติ';actions.appendChild(stats);
    return card;
  }
  function render(){
    injectCss();const sid=currentSession();if(!sid)return;
    let shell=document.querySelector('.eap-premium-shell');
    if(shell&&Number(shell.dataset.session)!==sid)shell.remove();
    const map=findButtons();const buttons=ALL.map(s=>map[s]).filter(Boolean);if(buttons.length<4||new Set(buttons).size<4)return;
    const req=REQUIRED[sid]||['Reading','Writing'];const scores=scoreMap(sid);const passed=req.filter(s=>Number(scores[s]||0)>=PASS_MARK).length;
    document.querySelectorAll('.eap-compact-skill-shell,.eap-rs-summary,.eap-rs-score,.eap-skill-score-line').forEach(n=>n.remove());
    shell=document.createElement('section');shell.className='eap-premium-shell';shell.dataset.session=String(sid);
    const avg=Math.round(req.reduce((sum,s)=>sum+Math.min(100,Number(scores[s]||0)),0)/req.length);
    shell.innerHTML=`<div class="eap-premium-summary"><div class="eap-premium-title-wrap"><div class="eap-premium-shield">★</div><div><div class="eap-premium-title">Skill บังคับของ Session ${sid}<span class="eap-premium-title-badge">Required</span></div><div class="eap-premium-help">ต้องผ่านครบ 2 ทักษะ ทักษะละอย่างน้อย 60/100 เพื่อไป Session ถัดไป</div></div></div><div><div class="eap-premium-progress-label">ความก้าวหน้ารวม</div><div class="eap-premium-progress-score">${avg}/100</div><div class="eap-premium-track"><div class="eap-premium-fill" style="width:${avg}%"></div></div></div><div class="eap-premium-ready"><div class="eap-premium-ready-line">✅ ผ่านแล้ว <strong>${passed}/2 ทักษะ</strong></div><div class="eap-premium-ready-line">${passed===2?`✅ พร้อมไป Session ${sid+1<=15?sid+1:'ถัดไป'} 🎉`:'⏳ ทำ Skill บังคับให้ครบ'}</div></div></div><div class="eap-premium-grid"></div><div class="eap-premium-legend"><span>🔵 บังคับ</span><span>⚪ เสริม</span><span>✅ บังคับ 2 ทักษะเพื่อปลดล็อก</span><span>💡 คะแนนจะบันทึกเข้าสู่ระบบอัตโนมัติ</span></div>`;
    const host=nearestHost(buttons);const first=buttons[0];let anchor=first;while(anchor.parentElement&&anchor.parentElement!==host)anchor=anchor.parentElement;anchor.parentElement.insertBefore(shell,anchor);
    const grid=shell.querySelector('.eap-premium-grid');ALL.forEach(skill=>grid.appendChild(buildCard(skill,map[skill],req.includes(skill),Number(scores[skill]||0))));
    [...host.children].forEach(el=>{if(el!==shell&&!text(el.textContent)&&!el.querySelector('button,a,[role="button"]'))el.style.display='none';});
  }
  let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,140);};
  window.addEventListener('load',schedule);['eap:resume-synced','eap:route-changed','eap:profile-saved'].forEach(e=>window.addEventListener(e,schedule));new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});setInterval(schedule,1600);
  window.EAPRequiredSkillUICompactV132={render,version:'v20260715-v132-premium'};
})();