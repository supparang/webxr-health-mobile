/* EAP Required Skill Hub v2.0 Production Rewrite
   UI/controller only. Sheet, score, evidence and unlock authority remain unchanged.
*/
(() => {
  'use strict';
  const VERSION='v2.0.0-20260722';
  const ROOT_ID='eap-skill-hub-v2';
  const STYLE_ID='eap-skill-hub-v2-style';
  const SKILLS=['Reading','Listening','Writing','Speaking'];
  const ICON={Reading:'📖',Listening:'🎧',Writing:'✍️',Speaking:'🎙️'};
  const DESC={Reading:'อ่านและจับใจความสำคัญ',Listening:'ฟังและเข้าใจใจความสำคัญ',Writing:'เขียนสื่อสารอย่างมีโครงสร้าง',Speaking:'พูดสื่อสารอย่างมั่นใจ'};
  const REQUIRED={1:['Reading','Speaking'],2:['Reading','Writing'],3:['Reading','Writing'],4:['Reading','Listening'],5:['Reading','Speaking'],6:['Reading','Writing'],7:['Writing','Speaking'],8:['Reading','Writing'],9:['Writing','Speaking'],10:['Reading','Writing'],11:['Writing','Speaking'],12:['Reading','Writing'],13:['Listening','Writing'],14:['Writing','Speaking'],15:['Writing','Speaking']};
  const PASS=60;
  const text=v=>String(v??'').replace(/\s+/g,' ').trim();
  const visible=n=>!!(n&&n.isConnected&&n.offsetParent!==null);
  const esc=s=>text(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const css=`
  body.eap-hub-v2-ready .eap-rs-summary,
  body.eap-hub-v2-ready .eap-compact-skill-shell,
  body.eap-hub-v2-ready .eap-premium-shell,
  body.eap-hub-v2-ready #eap-skill-dashboard-v134,
  body.eap-hub-v2-ready #eap-skill-hub-v135,
  body.eap-hub-v2-ready #eap-skill-mission-hub-v137,
  body.eap-hub-v2-ready .eap-skill-score-line{display:none!important}
  #${ROOT_ID}{--bg:#071a2b;--panel:#0b2237;--line:#24445f;--muted:#9fb5c8;--green:#45d25f;--blue:#2196f3;--cyan:#26e2d4;color:#f5fbff;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:18px 0 12px;padding:16px;border:1px solid #24445f;border-radius:22px;background:linear-gradient(145deg,#071a2b,#0a2135);box-shadow:0 18px 45px rgba(0,0,0,.28)}
  #${ROOT_ID} *{box-sizing:border-box}
  .eap2-layout{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:16px}
  .eap2-main,.eap2-side{min-width:0}
  .eap2-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(230px,360px);gap:18px;align-items:center;padding:8px 4px 16px;border-bottom:1px solid rgba(126,164,192,.18)}
  .eap2-title-row{display:flex;gap:13px;align-items:center}
  .eap2-shield{width:54px;height:62px;display:grid;place-items:center;flex:0 0 auto;border:2px solid #7ba1c4;border-radius:14px 14px 22px 22px;background:linear-gradient(160deg,#193b5c,#0c2034);font-size:25px;font-weight:950}
  .eap2-title{font-size:clamp(23px,2.2vw,32px);font-weight:950;line-height:1.1;color:#fff}
  .eap2-meta{margin-top:7px;color:var(--muted);font-size:13px;font-weight:650}.eap2-meta b{color:#3ee0cf}
  .eap2-goal{font-size:13px;font-weight:850;color:#eef8ff;margin-bottom:8px}.eap2-goal strong{color:#ffd84c}
  .eap2-progress-row{display:flex;align-items:center;gap:10px}.eap2-track{height:10px;flex:1;border-radius:999px;overflow:hidden;background:#1c3449}.eap2-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#4bd647,#25e1cf)}.eap2-percent{min-width:44px;text-align:right;font-weight:950}
  .eap2-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));grid-auto-rows:1fr;gap:12px;margin-top:14px}
  .eap2-card{position:relative;display:grid;grid-template-rows:auto 1fr auto auto;min-height:216px;padding:18px;border:1px solid #2469a7;border-radius:17px;background:linear-gradient(145deg,rgba(18,53,82,.94),rgba(7,27,45,.98));overflow:hidden}
  .eap2-card.required{border-color:#2fbf4a;box-shadow:inset 0 0 0 1px rgba(57,212,81,.14)}
  .eap2-ribbon{position:absolute;left:0;top:0;padding:6px 13px;border-radius:0 0 10px 0;background:#0a4f91;color:#51b7ff;font-size:11px;font-weight:950}.eap2-card.required .eap2-ribbon{background:#124c24;color:#56e96e}
  .eap2-head{display:grid;grid-template-columns:76px minmax(0,1fr) auto;gap:14px;align-items:center;margin-top:18px}
  .eap2-icon{width:72px;height:72px;display:grid;place-items:center;border:1px solid #177fd0;border-radius:50%;background:radial-gradient(circle at 35% 30%,#163f68,#08233e);font-size:35px}.required .eap2-icon{border-color:#248f3d;background:radial-gradient(circle at 35% 30%,#18522a,#092c19)}
  .eap2-name{font-size:22px;font-weight:950}.eap2-desc{margin-top:5px;color:#c0d0de;font-size:13px;font-weight:650}.eap2-state{align-self:start;padding:7px 11px;border:1px solid #435a6e;border-radius:999px;color:#bac8d4;font-size:11px;font-weight:900;white-space:nowrap}.eap2-state.pass{border-color:#278b3e;color:#50e568;background:rgba(31,119,48,.18)}
  .eap2-score{align-self:end;margin:14px 0 8px;text-align:center;font-size:22px;font-weight:950;color:#249dff}.required .eap2-score{color:#50dd5a}
  .eap2-mini{height:7px;border-radius:999px;overflow:hidden;background:#1e394f}.eap2-mini>i{display:block;height:100%;border-radius:999px;background:#248de8}.required .eap2-mini>i{background:#43cf4f}
  .eap2-action{margin-top:13px}.eap2-action button,.eap2-action a,.eap2-action [role="button"]{display:flex!important;width:100%!important;min-height:42px!important;align-items:center!important;justify-content:center!important;margin:0!important;padding:10px 14px!important;border:1px solid #2585d9!important;border-radius:10px!important;background:linear-gradient(135deg,#174f8c,#145ca8)!important;color:#fff!important;font:900 14px/1 system-ui!important;position:static!important;transform:none!important;box-shadow:none!important}.required .eap2-action button,.required .eap2-action a,.required .eap2-action [role="button"]{border-color:#278e3d!important;background:linear-gradient(135deg,#177528,#238f32)!important}
  .eap2-legend{display:flex;gap:18px;flex-wrap:wrap;margin-top:13px;padding:10px 12px;border-top:1px solid rgba(126,164,192,.18);color:#c2d0dc;font-size:11px;font-weight:700}.eap2-dot{display:inline-block;width:10px;height:10px;margin-right:6px;border-radius:50%;background:#48d65a}.eap2-dot.blue{background:#2196f3}
  .eap2-side{display:flex;flex-direction:column;gap:12px}.eap2-box{padding:16px;border:1px solid #24445f;border-radius:16px;background:linear-gradient(145deg,#0c2439,#081a2b)}.eap2-box h3{margin:0 0 12px;font-size:13px;letter-spacing:.02em}.eap2-donut{width:108px;height:108px;margin:4px auto 12px;border-radius:50%;display:grid;place-items:center;background:conic-gradient(#4ad34e var(--p),#173248 0);position:relative}.eap2-donut:after{content:"";position:absolute;inset:15px;border-radius:50%;background:#0a2033}.eap2-donut strong{position:relative;z-index:1;font-size:24px}.eap2-stats{display:grid;gap:8px;font-size:12px}.eap2-stat{display:flex;justify-content:space-between;color:#d6e2ec}.eap2-contract{display:grid;gap:9px}.eap2-contract div{display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#d8e4ed}.eap2-contract b{color:#55dd68}.eap2-contract .supp b{color:#3ba7ff}.eap2-info{display:grid;grid-template-columns:92px 1fr;gap:8px;font-size:12px;color:#d8e4ed}.eap2-info span:nth-child(odd){color:#9bb0c2}
  .eap2-portfolio{margin-top:14px;padding:14px;border:1px solid #24445f;border-radius:16px;background:#081c2e}.eap2-portfolio h3{margin:0 0 10px;font-size:14px}.eap2-portfolio table{width:100%;border-collapse:collapse;font-size:12px}.eap2-portfolio th,.eap2-portfolio td{padding:9px 10px;border-bottom:1px solid rgba(126,164,192,.15);text-align:left}.eap2-portfolio th{color:#a9bfd0;background:rgba(255,255,255,.035)}
  @media(max-width:1050px){.eap2-layout{grid-template-columns:1fr}.eap2-side{display:grid;grid-template-columns:repeat(3,minmax(0,1fr))}}
  @media(max-width:760px){#${ROOT_ID}{padding:12px;border-radius:16px}.eap2-hero{grid-template-columns:1fr}.eap2-grid{grid-template-columns:1fr}.eap2-side{grid-template-columns:1fr}.eap2-card{min-height:202px}.eap2-head{grid-template-columns:60px minmax(0,1fr)}.eap2-icon{width:58px;height:58px;font-size:29px}.eap2-state{grid-column:1/-1;justify-self:start}.eap2-title{font-size:23px}.eap2-portfolio{overflow:auto}.eap2-portfolio table{min-width:650px}}
  `;

  function inject(){let s=document.getElementById(STYLE_ID);if(!s){s=document.createElement('style');s.id=STYLE_ID;document.head.appendChild(s);}s.textContent=css;}
  function session(){
    const hs=[...document.querySelectorAll('#app h1,#app h2,#app h3,#app h4')].filter(visible);
    for(const h of hs){const m=text(h.textContent).match(/Session\s*:?[\s-]*(1[0-5]|[1-9])\b/i);if(m)return Number(m[1]);}
    const active=[...document.querySelectorAll('#app [aria-selected="true"],#app .active,#app [aria-current="page"]')].filter(visible);
    for(const n of active){const m=text(n.textContent).match(/^S(1[0-5]|[1-9])\b/i);if(m)return Number(m[1]);}
    return 0;
  }
  function sessionInfo(sid){
    const h=[...document.querySelectorAll('#app h1,#app h2,#app h3')].find(n=>visible(n)&&new RegExp(`Session\\s*:?\\s*${sid}\\b`,'i').test(text(n.textContent)));
    const title=h?text(h.textContent).replace(/^Session\s*:?\s*\d+\s*[:\-]?\s*/i,''):`Session ${sid}`;
    const area=h?.parentElement?.innerText||document.getElementById('app')?.innerText||'';
    const boss=(area.match(/Boss\s*:\s*([^\n·|]+)/i)||[])[1]?.trim()||'—';
    const topic=(area.match(/Topic\s*:\s*([^\n·|]+)/i)||[])[1]?.trim()||title;
    return {title,boss,topic};
  }
  function scores(sid){
    const out=Object.fromEntries(SKILLS.map(s=>[s,0]));
    try{const e=window.EAPTwoSkillProgressV128?.evidenceFor?.(sid)||{};SKILLS.forEach(s=>out[s]=Number(e[s]?.bestScore??e[s]?.score??e[s]??0)||0);}catch(_){ }
    try{const st=JSON.parse(localStorage.getItem('EAP_HERO_PROGRESS_V3')||'{}');const rows=[...(Array.isArray(st.portfolio)?st.portfolio:[]),...(window.EAPLiveSheetRouteFinalizer?.records||[])];rows.forEach(r=>{const m=text(r?.sessionId||r?.session||r?.routeId).match(/S?(1[0-5]|[1-9])/i);if(!m||Number(m[1])!==sid)return;const sk=SKILLS.find(s=>text(r?.skill||r?.skillName).toLowerCase().includes(s.toLowerCase()));if(sk)out[sk]=Math.max(out[sk],Number(r?.bestScore??r?.latestScore??r?.score??0)||0);});}catch(_){ }
    return out;
  }
  function findButtons(){
    const all=[...document.querySelectorAll('#app button,#app a[href],#app [role="button"],#app .skill-btn,#app .skill-card')].filter(n=>visible(n)&&!n.closest(`#${ROOT_ID}`));
    const map={};SKILLS.forEach(sk=>{const rx=new RegExp(`\\b${sk}\\b`,'i');map[sk]=all.filter(n=>rx.test(text(n.textContent))).sort((a,b)=>text(a.textContent).length-text(b.textContent).length)[0]||null;});return map;
  }
  function commonHost(nodes){let n=nodes[0]?.parentElement;while(n&&n.id!=='app'){if(nodes.every(x=>n.contains(x)))return n;n=n.parentElement;}return document.getElementById('app');}
  function portfolioRows(){
    const rows=[];document.querySelectorAll('#app table tbody tr').forEach(tr=>{const td=[...tr.querySelectorAll('td')].map(x=>text(x.textContent));if(td.length>=4)rows.push(td.slice(0,5));});return rows.slice(0,6);
  }
  function buildCard(skill,button,required,score){
    const pass=score>=PASS;const c=document.createElement('article');c.className=`eap2-card ${required?'required':''}`;
    c.innerHTML=`<div class="eap2-ribbon">${required?'บังคับ (Required)':'เสริม (Supplementary)'}</div><div class="eap2-head"><div class="eap2-icon">${ICON[skill]}</div><div><div class="eap2-name">${skill}</div><div class="eap2-desc">${DESC[skill]}</div></div><div class="eap2-state ${pass?'pass':''}">${pass?'ผ่านแล้ว ✓':'ยังไม่ได้ทำ'}</div></div><div class="eap2-score">${score} / 100</div><div class="eap2-mini"><i style="width:${Math.max(0,Math.min(100,score))}%"></i></div><div class="eap2-action"></div>`;
    const actual=button.matches('button,a,[role="button"]')?button:(button.querySelector('button,a,[role="button"]')||button);
    actual.removeAttribute('style');actual.textContent=score?'▶ ฝึกอีกครั้ง':'▶ เริ่มฝึก';c.querySelector('.eap2-action').appendChild(actual);return c;
  }
  function render(){
    inject();const sid=session();if(!sid)return;const map=findButtons();const btns=SKILLS.map(s=>map[s]).filter(Boolean);if(btns.length<4||new Set(btns).size<4)return;
    const host=commonHost(btns);if(!host)return;document.getElementById(ROOT_ID)?.remove();
    const req=REQUIRED[sid]||['Reading','Writing'];const sc=scores(sid);const passed=req.filter(s=>sc[s]>=PASS).length;const avg=Math.round(req.reduce((a,s)=>a+Math.min(100,sc[s]),0)/req.length);const info=sessionInfo(sid);const oldRows=portfolioRows();
    const root=document.createElement('section');root.id=ROOT_ID;root.dataset.session=String(sid);
    root.innerHTML=`<div class="eap2-layout"><main class="eap2-main"><section class="eap2-hero"><div class="eap2-title-row"><div class="eap2-shield">${sid}</div><div><div class="eap2-title">Session ${sid} : ${esc(info.title)}</div><div class="eap2-meta"><b>Boss:</b> ${esc(info.boss)} &nbsp; · &nbsp; <b>Topic:</b> ${esc(info.topic)}</div></div></div><div><div class="eap2-goal"><strong>★</strong> ต้องผ่านอย่างน้อย 2/2 Skills (Required)</div><div class="eap2-progress-row"><div class="eap2-track"><div class="eap2-fill" style="width:${avg}%"></div></div><div class="eap2-percent">${avg}%</div></div></div></section><section class="eap2-grid"></section><div class="eap2-legend"><span><i class="eap2-dot"></i><b>บังคับ</b> = ต้องผ่านเพื่อปลดล็อก Session ถัดไป</span><span><i class="eap2-dot blue"></i><b>เสริม</b> = ฝึกเพิ่มเพื่อเพิ่มทักษะและคะแนน</span></div><section class="eap2-portfolio"><h3>RECENT PORTFOLIO</h3><table><thead><tr><th>วันที่/เวลา (ICT)</th><th>Session</th><th>Skill</th><th>Score</th><th>Output</th></tr></thead><tbody>${oldRows.length?oldRows.map(r=>`<tr>${[0,1,2,3,4].map(i=>`<td>${esc(r[i]||'—')}</td>`).join('')}</tr>`).join(''):'<tr><td colspan="5">ยังไม่มีผลงานล่าสุด</td></tr>'}</tbody></table></section></main><aside class="eap2-side"><section class="eap2-box"><h3>SESSION ${sid} PROGRESS</h3><div class="eap2-donut" style="--p:${avg}%"><strong>${avg}%</strong></div><div class="eap2-stats"><div class="eap2-stat"><span>ผ่านแล้ว</span><b>${passed}</b></div><div class="eap2-stat"><span>กำลังทำ</span><b>${req.filter(s=>sc[s]>0&&sc[s]<PASS).length}</b></div><div class="eap2-stat"><span>ยังไม่ได้ทำ</span><b>${SKILLS.filter(s=>!sc[s]).length}</b></div></div></section><section class="eap2-box"><h3>SKILL CONTRACT</h3><div class="eap2-contract"><div><b>บังคับ (ต้องผ่าน)</b><span></span></div>${req.map(s=>`<div><span>› ${s}</span><span>${sc[s]>=PASS?'✅':'○'}</span></div>`).join('')}<div class="supp"><b>เสริม (ฝึกเพิ่มเติม)</b><span></span></div>${SKILLS.filter(s=>!req.includes(s)).map(s=>`<div><span>› ${s}</span><span>${sc[s]>=PASS?'✅':'○'}</span></div>`).join('')}</div></section><section class="eap2-box"><h3>SESSION INFO</h3><div class="eap2-info"><span>หัวข้อ</span><span>${esc(info.topic)}</span><span>บอส</span><span>${esc(info.boss)}</span><span>เงื่อนไขผ่าน</span><span>ผ่าน Skill บังคับ 2/2</span><span>ปลดล็อกเมื่อผ่าน</span><span>🔒 Session ${Math.min(15,sid+1)}</span></div></section></aside></div>`;
    const grid=root.querySelector('.eap2-grid');SKILLS.forEach(sk=>grid.appendChild(buildCard(sk,map[sk],req.includes(sk),sc[sk])));
    let anchor=btns[0];while(anchor.parentElement&&anchor.parentElement!==host)anchor=anchor.parentElement;anchor.parentElement.insertBefore(root,anchor);
    [...host.children].forEach(el=>{if(el!==root)el.style.display='none';});
    bodyReady();
  }
  function bodyReady(){document.body.classList.add('eap-hub-v2-ready');}
  let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(render,180);};
  window.addEventListener('load',schedule);['eap:resume-synced','eap:route-changed','eap:profile-saved','eap:session-changed','eap:skill-result'].forEach(e=>window.addEventListener(e,schedule));new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});setInterval(schedule,1800);
  window.EAPRequiredSkillHubV2={render,version:VERSION};
})();