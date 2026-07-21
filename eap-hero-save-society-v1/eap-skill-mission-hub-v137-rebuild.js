/* =========================================================
   EAP Hero • Skill Mission Hub v137 Rebuild
   Single-component UI rebuild. UI only.
   Preserves original skill buttons and click handlers.
   Does not change score, unlock, evidence, Sheet, or route authority.
   ========================================================= */
(() => {
  'use strict';

  const VERSION = '20260721-EAP-SKILL-MISSION-HUB-V137-REBUILD';
  const ROOT_ID = 'eap-skill-hub-v137';
  const STYLE_ID = 'eap-skill-hub-v137-style';
  const SKILLS = ['Reading','Listening','Writing','Speaking'];
  const ICONS = {Reading:'📖',Listening:'🎧',Writing:'✍️',Speaking:'🎙️'};
  const DESCS = {
    Reading:'อ่านและจับใจความสำคัญจากข้อความ',
    Listening:'ฟังคำสำคัญ รายละเอียด และสัญญาณเชื่อมโยง',
    Writing:'เขียนคำตอบให้ชัดเจน ตรงภารกิจ และมีเหตุผล',
    Speaking:'สื่อสารใจความสำคัญอย่างชัดเจนและต่อเนื่อง'
  };
  const REQUIRED = {
    1:['Reading','Speaking'],2:['Reading','Writing'],3:['Reading','Writing'],
    4:['Reading','Listening'],5:['Reading','Speaking'],6:['Reading','Writing'],
    7:['Writing','Speaking'],8:['Reading','Writing'],9:['Writing','Speaking'],
    10:['Reading','Writing'],11:['Writing','Speaking'],12:['Reading','Writing'],
    13:['Listening','Writing'],14:['Writing','Speaking'],15:['Writing','Speaking']
  };
  const PASS = 60;

  const clean = v => String(v == null ? '' : v).replace(/\s+/g,' ').trim();
  const visible = n => !!(n && n.isConnected && n.offsetParent !== null);

  function injectStyle(){
    let s=document.getElementById(STYLE_ID);
    if(!s){s=document.createElement('style');s.id=STYLE_ID;document.head.appendChild(s);}
    s.textContent=`
      #${ROOT_ID}{margin:18px 0 16px;padding:18px;border:1px solid rgba(88,216,209,.36);border-radius:22px;background:linear-gradient(145deg,#0d2944,#0a2138 58%,#07192b);box-shadow:0 18px 42px rgba(0,0,0,.24);color:#f5fbff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
      #${ROOT_ID} *{box-sizing:border-box}
      .eap137-head{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:16px;align-items:stretch;margin-bottom:16px}
      .eap137-titlebox,.eap137-progress{border:1px solid rgba(137,187,223,.18);border-radius:16px;background:rgba(255,255,255,.045)}
      .eap137-titlebox{padding:16px 18px}
      .eap137-kicker{font-size:11px;font-weight:950;letter-spacing:.12em;text-transform:uppercase;color:#68ead4}
      .eap137-title{margin:4px 0 5px;font-size:clamp(23px,2.5vw,34px);line-height:1.08;font-weight:950;color:#fff}
      .eap137-sub{font-size:13px;line-height:1.55;font-weight:700;color:#b4c7d7}
      .eap137-progress{display:flex;flex-direction:column;justify-content:center;padding:15px 16px}
      .eap137-progress-row{display:flex;justify-content:space-between;gap:12px;align-items:center;font-size:12px;font-weight:850;color:#c8d8e5}
      .eap137-progress-row strong{font-size:24px;color:#68ead4}
      .eap137-track{height:9px;margin-top:10px;border-radius:999px;background:#263e54;overflow:hidden}
      .eap137-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#18bca2,#65e6d1)}
      .eap137-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;align-items:stretch}
      .eap137-card{position:relative;display:flex;flex-direction:column;min-width:0;min-height:228px;padding:15px;border:1px solid rgba(162,197,224,.22);border-radius:17px;background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.035));overflow:hidden}
      .eap137-card.required{border-color:rgba(70,223,199,.66);background:linear-gradient(180deg,rgba(40,170,167,.18),rgba(255,255,255,.035))}
      .eap137-top{display:flex;align-items:center;gap:10px;min-width:0}
      .eap137-icon{width:46px;height:46px;flex:0 0 46px;border-radius:14px;display:grid;place-items:center;font-size:23px;background:linear-gradient(145deg,#2fc8b4,#238bd9);box-shadow:0 8px 18px rgba(0,0,0,.2)}
      .eap137-card[data-skill="Listening"] .eap137-icon{background:linear-gradient(145deg,#53caff,#4776e8)}
      .eap137-card[data-skill="Writing"] .eap137-icon{background:linear-gradient(145deg,#ffc64d,#ee7d19)}
      .eap137-card[data-skill="Speaking"] .eap137-icon{background:linear-gradient(145deg,#aa8bff,#7051df)}
      .eap137-namewrap{min-width:0;flex:1}
      .eap137-name{font-size:18px;line-height:1.1;font-weight:950;color:#fff}
      .eap137-badge{display:inline-block;margin-top:5px;padding:4px 8px;border-radius:999px;font-size:10px;font-weight:950;background:#2b4359;color:#d4e1eb}
      .eap137-badge.required{background:#d9fff5;color:#087763}
      .eap137-desc{min-height:44px;margin:13px 0 9px;font-size:12px;line-height:1.5;font-weight:700;color:#abc0d0}
      .eap137-statusbox{margin-top:auto;padding:10px 11px;border-radius:12px;background:rgba(255,255,255,.055)}
      .eap137-status{font-size:11px;font-weight:800;color:#b8cad8}
      .eap137-scoreline{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:5px}
      .eap137-score{font-size:19px;font-weight:950;color:#fff}
      .eap137-state{padding:4px 8px;border-radius:999px;font-size:10px;font-weight:950;background:#2b4359;color:#d5e3ed}
      .eap137-state.pass{background:#d9fff5;color:#087763}
      .eap137-action{margin-top:10px}
      #${ROOT_ID} .eap137-action button,#${ROOT_ID} .eap137-action a,#${ROOT_ID} .eap137-action [role="button"]{display:flex!important;align-items:center!important;justify-content:center!important;width:100%!important;min-width:0!important;max-width:none!important;height:42px!important;min-height:42px!important;margin:0!important;padding:9px 12px!important;border:0!important;border-radius:11px!important;background:linear-gradient(135deg,#1480eb,#185bd4)!important;color:#fff!important;font:900 12px/1 system-ui!important;box-shadow:0 8px 18px rgba(20,102,221,.24)!important;position:static!important;transform:none!important;white-space:nowrap!important}
      #${ROOT_ID} .eap137-card:not(.required) .eap137-action button,#${ROOT_ID} .eap137-card:not(.required) .eap137-action a,#${ROOT_ID} .eap137-card:not(.required) .eap137-action [role="button"]{background:linear-gradient(135deg,#12aa74,#07955f)!important}
      .eap137-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:13px;padding:11px 13px;border-radius:13px;background:rgba(255,255,255,.045);font-size:11px;font-weight:800;color:#a8bac9}
      .eap137-footer strong{color:#68ead4}
      .eap137-legacy-hidden{display:none!important}
      @media(max-width:1100px){.eap137-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
      @media(max-width:720px){#${ROOT_ID}{padding:14px;border-radius:18px}.eap137-head{grid-template-columns:1fr}.eap137-grid{grid-template-columns:1fr}.eap137-card{min-height:210px}.eap137-title{font-size:25px}}
    `;
  }

  function currentSession(){
    const d=document.getElementById('eap-skill-dashboard-v135');
    const ds=Number(d?.dataset?.session||0); if(ds>=1&&ds<=15)return ds;
    const hs=[...document.querySelectorAll('#app h1,#app h2,#app h3,#app h4')].filter(visible);
    for(const h of hs){const m=clean(h.textContent).match(/Session\s*:?\s*(1[0-5]|[1-9])\b/i);if(m)return Number(m[1]);}
    const active=[...document.querySelectorAll('#app [aria-current="page"],#app [aria-selected="true"],#app .active')].filter(visible);
    for(const n of active){const m=clean(n.textContent).match(/^S(1[0-5]|[1-9])\b/i);if(m)return Number(m[1]);}
    return 0;
  }

  function skillNodes(){
    const candidates=[...document.querySelectorAll('#app button,#app a[href],#app [role="button"],#app [data-skill]')]
      .filter(n=>visible(n)&&!n.closest(`#${ROOT_ID}`));
    const out={};
    for(const sk of SKILLS){
      const exact=candidates.filter(n=>clean(n.dataset?.skill||'').toLowerCase()===sk.toLowerCase());
      const rx=new RegExp(`\\b${sk}\\b`,'i');
      const pool=exact.length?exact:candidates.filter(n=>rx.test(clean(n.textContent)));
      out[sk]=pool.sort((a,b)=>clean(a.textContent).length-clean(b.textContent).length)[0]||null;
    }
    return out;
  }

  function scores(sid){
    const out=Object.fromEntries(SKILLS.map(s=>[s,0]));
    try{
      const e=window.EAPTwoSkillProgressV128?.evidenceFor?.(sid)||{};
      SKILLS.forEach(s=>out[s]=Number(e[s]?.bestScore??e[s]?.score??e[s]??0)||0);
    }catch(_){ }
    try{
      const d=document.getElementById('eap-skill-dashboard-v135');
      d?.querySelectorAll('.eap135-card').forEach(card=>{
        const sk=SKILLS.find(s=>clean(card.dataset.skill||card.textContent).toLowerCase().includes(s.toLowerCase()));
        if(!sk)return;
        const m=clean(card.textContent).match(/(\d{1,3})\s*\/\s*100/);
        if(m)out[sk]=Math.max(out[sk],Number(m[1])||0);
      });
    }catch(_){ }
    return out;
  }

  function commonHost(nodes){
    let h=nodes[0]?.parentElement;
    while(h&&h.id!=='app'){
      if(nodes.every(n=>h.contains(n)))return h;
      h=h.parentElement;
    }
    return null;
  }

  function render(){
    injectStyle();
    const sid=currentSession(); if(!sid)return;
    const map=skillNodes();
    const nodes=SKILLS.map(s=>map[s]).filter(Boolean);
    if(nodes.length<4||new Set(nodes).size<4)return;

    const oldHost=commonHost(nodes);
    const oldDashboard=document.getElementById('eap-skill-dashboard-v135');
    document.getElementById(ROOT_ID)?.remove();

    const req=REQUIRED[sid]||['Reading','Writing'];
    const sc=scores(sid);
    const passed=req.filter(s=>sc[s]>=PASS).length;
    const avg=Math.round(req.reduce((a,s)=>a+Math.min(100,sc[s]),0)/req.length);

    const root=document.createElement('section');
    root.id=ROOT_ID;
    root.dataset.session=String(sid);
    root.innerHTML=`
      <div class="eap137-head">
        <div class="eap137-titlebox">
          <div class="eap137-kicker">Required Skill Mission</div>
          <div class="eap137-title">Session ${sid} Skill Dashboard</div>
          <div class="eap137-sub">ผ่าน ${req.join(' + ')} อย่างน้อยทักษะละ 60/100 เพื่อปลดล็อก Session ถัดไป</div>
        </div>
        <div class="eap137-progress">
          <div class="eap137-progress-row"><span>ความก้าวหน้าทักษะบังคับ</span><strong>${passed}/${req.length}</strong></div>
          <div class="eap137-track"><div class="eap137-fill" style="width:${avg}%"></div></div>
        </div>
      </div>
      <div class="eap137-grid"></div>
      <div class="eap137-footer"><span>🔵 ทักษะบังคับ ${req.length} ทักษะ · ⚪ ทักษะเสริมฝึกเพิ่มได้</span><strong>${passed===req.length?'✅ พร้อมไป Session ถัดไป':'⏳ ทำ Skill บังคับให้ครบ'}</strong></div>`;

    const grid=root.querySelector('.eap137-grid');
    for(const sk of SKILLS){
      const node=map[sk];
      const required=req.includes(sk);
      const score=Math.max(0,Math.min(100,Number(sc[sk])||0));
      const pass=score>=PASS;
      const card=document.createElement('article');
      card.className=`eap137-card ${required?'required':''}`;
      card.dataset.skill=sk;
      card.innerHTML=`
        <div class="eap137-top"><div class="eap137-icon">${ICONS[sk]}</div><div class="eap137-namewrap"><div class="eap137-name">${sk}</div><span class="eap137-badge ${required?'required':''}">${required?'บังคับ':'เสริม'}</span></div></div>
        <div class="eap137-desc">${DESCS[sk]}</div>
        <div class="eap137-statusbox"><div class="eap137-status">คะแนนล่าสุด</div><div class="eap137-scoreline"><span class="eap137-score">${score}/100</span><span class="eap137-state ${pass?'pass':''}">${score?pass?'ผ่านแล้ว':'กำลังฝึก':'ยังไม่ได้ทำ'}</span></div></div>
        <div class="eap137-action"></div>`;
      node.removeAttribute('style');
      node.textContent=score?'▶ ฝึกอีกครั้ง':'▶ เข้าเล่น';
      card.querySelector('.eap137-action').appendChild(node);
      grid.appendChild(card);
    }

    const anchor=oldDashboard||oldHost;
    if(anchor?.parentElement)anchor.parentElement.insertBefore(root,anchor);
    else document.getElementById('app')?.appendChild(root);

    if(oldDashboard&&oldDashboard!==root)oldDashboard.classList.add('eap137-legacy-hidden');
    if(oldHost&&oldHost!==root&&!root.contains(oldHost))oldHost.classList.add('eap137-legacy-hidden');
    document.querySelectorAll('#app .eap-rs-summary,#app .eap-compact-skill-shell,#app .eap-premium-shell,#app #eap-skill-dashboard-v134').forEach(n=>n.classList.add('eap137-legacy-hidden'));
    document.documentElement.dataset.eapSkillHubVersion=VERSION;
  }

  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,80);};
  new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
  window.addEventListener('load',()=>{render();setTimeout(render,450);setTimeout(render,1200);});
  document.addEventListener('click',e=>{if(e.target.closest(`#${ROOT_ID},[aria-current="page"],.active`)){setTimeout(render,120);setTimeout(render,600);}},true);
  render();
  window.EAPSkillMissionHubV137={version:VERSION,render};
})();