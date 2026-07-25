/* CSAI2601 UX Quest • Project + Figma Access Authority v2.1
 * Always-visible controls mounted before the visible Studio form.
 */
(() => {
  'use strict';
  const ROOT=document.getElementById('uxqCanonicalNode')||document.body;
  const PARAMS=new URLSearchParams(location.search||'');
  const NODE_ID=String(PARAMS.get('node')||PARAMS.get('id')||'W1').trim().toUpperCase();
  if(!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(NODE_ID))return;
  const IS_W1=NODE_ID==='W1',IS_BOSS=/^B[1-4]$/.test(NODE_ID);
  const FIGMA_RE=/^https:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides|make)\//i;
  const BOX_ID='uxqProjectFigmaAccessAuthority';
  const VERSION='20260722-PROJECT-FIGMA-ACCESS-AUTHORITY-V2.1';

  function identityKey(){let p={};try{p=window.UXQIdentity?.get?.()||{}}catch(_){}return `${String(p.studentId||PARAMS.get('studentId')||PARAMS.get('sid')||'anonymous').trim()}::${String(p.section||PARAMS.get('section')||'default').trim()}`}
  const masterKey=()=>`uxq.csai2601.masterFigma.authority.v21.${identityKey()}`;
  const valid=v=>FIGMA_RE.test(String(v||'').trim());
  function readMaster(){try{const v=String(localStorage.getItem(masterKey())||'').trim();return valid(v)?v:''}catch(_){return''}}
  function saveMaster(v){v=String(v||'').trim();if(!valid(v))return;try{localStorage.setItem(masterKey(),v)}catch(_){}}

  function installStyle(){if(document.getElementById('uxq-pfa-style-v21'))return;const s=document.createElement('style');s.id='uxq-pfa-style-v21';s.textContent=`
    #${BOX_ID}{display:grid!important;visibility:visible!important;opacity:1!important;gap:12px;width:min(100%,980px);margin:18px auto;padding:16px;border:1px solid rgba(110,231,255,.58);border-radius:18px;background:linear-gradient(135deg,rgba(13,53,103,.98),rgba(43,29,98,.96));box-shadow:0 18px 44px rgba(0,0,0,.3);position:relative;z-index:999;box-sizing:border-box}
    #${BOX_ID} .head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}#${BOX_ID} h3{margin:0;color:#fff;font-size:1.15rem}#${BOX_ID} p{margin:4px 0 0;color:#d7e5f8;line-height:1.5}#${BOX_ID} .badge{white-space:nowrap;padding:5px 9px;border-radius:999px;background:rgba(110,231,255,.15);color:#d8fbff;font-size:.72rem;font-weight:900}
    #${BOX_ID} .grid{display:grid;grid-template-columns:minmax(220px,.8fr) minmax(0,1.4fr);gap:12px}#${BOX_ID} .field{display:grid;gap:6px}#${BOX_ID} label{font-weight:900;color:#fff}#${BOX_ID} input{display:block!important;width:100%!important;min-height:48px!important;padding:10px 12px!important;border:1px solid rgba(181,205,255,.4)!important;border-radius:12px!important;background:#07142e!important;color:#fff!important;font:inherit!important;box-sizing:border-box!important}
    #${BOX_ID} .actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}#${BOX_ID} a{display:grid;place-items:center;min-height:46px;padding:10px 13px;border-radius:12px;text-decoration:none;font-weight:950}#${BOX_ID} .primary{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}#${BOX_ID} .secondary{border:1px solid rgba(110,231,255,.4);color:#e2eeff;background:rgba(255,255,255,.04)}#${BOX_ID} a[aria-disabled='true']{opacity:.45;pointer-events:none}
    #${BOX_ID} .status{padding:8px 10px;border-radius:10px;font-size:.8rem}#${BOX_ID} .status[data-state='ok']{color:#82efb4;background:rgba(82,224,147,.1)}#${BOX_ID} .status[data-state='bad']{color:#ffabb8;background:rgba(255,91,115,.1)}#${BOX_ID} .status[data-state='empty']{color:#ffd98a;background:rgba(255,209,102,.08)}
    @media(max-width:760px){#${BOX_ID}{margin:12px 8px;width:auto}#${BOX_ID} .head{display:block}#${BOX_ID} .badge{display:inline-block;margin-top:8px}#${BOX_ID} .grid,#${BOX_ID} .actions{grid-template-columns:1fr}}
  `;document.head.appendChild(s)}

  function visibleStudio(){
    const list=Array.from(ROOT.querySelectorAll('.artifact,section,article'));
    return list.find(el=>{
      const hasFields=!!el.querySelector('[data-studio-key],[data-studio-submit],.studio-checks');
      const rect=el.getBoundingClientRect?.();
      const visible=!!rect&&rect.width>0&&rect.height>0&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden';
      return hasFields&&visible;
    })||list.find(el=>el.querySelector('[data-studio-key],[data-studio-submit],.studio-checks'))||null;
  }

  function canonical(card){let project=card.querySelector('[data-studio-key="projectId"]'),figma=card.querySelector('[data-studio-key="figmaUrl"]');if(!project){project=document.createElement('textarea');project.hidden=true;Object.assign(project.dataset,{studioKey:'projectId',studioLabel:IS_W1?'Master Project ID':'Master Project ID เดิม',required:'1',minLength:'4',format:'text'});card.appendChild(project)}if(!figma){figma=document.createElement('textarea');figma.hidden=true;Object.assign(figma.dataset,{studioKey:'figmaUrl',studioLabel:IS_W1?'Master Figma Project URL':'Project / Evidence URL',required:'1',format:'url'});card.appendChild(figma)}return{project,figma}}
  function copy(){if(IS_W1)return{title:'สร้าง Master Figma Project ครั้งเดียว',text:'สร้าง Project หลักใน W1 แล้วใช้ Project เดิมต่อเนื่องถึง W15',button:'สร้าง Master Figma Project',badge:'W1 • CREATE'};if(IS_BOSS)return{title:`ใช้ Master Project เดิมสำหรับ ${NODE_ID} Defense`,text:'เปิด Project เดิมและเพิ่ม Defense Section โดยไม่สร้าง Project ใหม่',button:'เปิด Master Project เดิม',badge:`${NODE_ID} • DEFENSE`};return{title:`เปิด Master Project เดิมและเพิ่ม Page / Section สำหรับ ${NODE_ID}`,text:'ต่อยอด Artifact ใน Project เดิม ห้ามสร้าง Project ใหม่',button:'เปิด Master Project เดิม',badge:`${NODE_ID} • REUSE`}}

  function mount(){installStyle();const card=visibleStudio();if(!card||!card.parentNode)return;const{project,figma}=canonical(card);let box=document.getElementById(BOX_ID);if(!box){const c=copy();box=document.createElement('section');box.id=BOX_ID;box.innerHTML=`<div class="head"><div><h3>${c.title}</h3><p>${c.text}</p></div><span class="badge">${c.badge}</span></div><div class="grid"><div class="field"><label for="uxqPfaProject">${IS_W1?'Master Project ID':'Master Project ID เดิม'}</label><input id="uxqPfaProject" type="text" autocomplete="off" placeholder="${IS_W1?'เช่น UX2601-รหัสนักศึกษา':'ใช้รหัสเดียวกับ W1'}"></div><div class="field"><label for="uxqPfaUrl">${IS_W1?'Master Figma Project URL':'Project / Evidence URL'}</label><input id="uxqPfaUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://www.figma.com/design/..."></div></div><div class="actions"><a class="primary" data-open-figma target="_blank" rel="noopener noreferrer">${c.button} ↗</a><a class="secondary" data-open-current href="#" aria-disabled="true">เปิดลิงก์ที่วาง</a></div><div class="status" data-state="empty">ยังไม่ได้วางลิงก์ Figma</div>`}
    if(box.parentNode!==card.parentNode||box.nextElementSibling!==card)card.parentNode.insertBefore(box,card);
    const pi=box.querySelector('#uxqPfaProject'),ui=box.querySelector('#uxqPfaUrl'),open=box.querySelector('[data-open-figma]'),current=box.querySelector('[data-open-current]'),status=box.querySelector('.status'),remembered=readMaster();
    if(!pi.value)pi.value=String(project.value||'');if(!String(figma.value||'').trim()&&!IS_W1&&remembered)figma.value=remembered;if(!ui.value)ui.value=String(figma.value||remembered||'');open.href=IS_W1?'https://www.figma.com/files/':(remembered||'https://www.figma.com/files/');
    const syncP=()=>{project.value=pi.value;project.dispatchEvent(new Event('input',{bubbles:true}));project.dispatchEvent(new Event('change',{bubbles:true}))};
    const syncU=()=>{const v=String(ui.value||'').trim();figma.value=v;figma.dispatchEvent(new Event('input',{bubbles:true}));figma.dispatchEvent(new Event('change',{bubbles:true}));if(!v){status.dataset.state='empty';status.textContent='ยังไม่ได้วางลิงก์ Figma';current.href='#';current.setAttribute('aria-disabled','true')}else if(!valid(v)){status.dataset.state='bad';status.textContent='URL ไม่ถูกต้อง ต้องเป็นลิงก์ Figma';current.href='#';current.setAttribute('aria-disabled','true')}else{status.dataset.state='ok';status.textContent=IS_W1?'Master Figma Project พร้อมใช้ต่อเนื่อง W1–W15':'Project / Evidence URL พร้อมใช้และพร้อมส่ง';current.href=v;current.target='_blank';current.rel='noopener noreferrer';current.removeAttribute('aria-disabled');saveMaster(v);if(!IS_W1)open.href=v}};
    if(box.dataset.bound!=='1'){box.dataset.bound='1';pi.addEventListener('input',syncP);ui.addEventListener('input',syncU);current.addEventListener('click',e=>{if(current.getAttribute('aria-disabled')==='true')e.preventDefault()})}syncP();syncU();
  }

  let timer=0;const schedule=()=>{clearTimeout(timer);timer=setTimeout(mount,80)};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();new MutationObserver(schedule).observe(ROOT,{childList:true,subtree:true});['uxq-mission-resume-studio','uxq-direct-studio-confirmed','uxq-studio-production-rewrite-ready'].forEach(n=>window.addEventListener(n,schedule));window.UXQProjectFigmaAccessAuthorityV21=Object.freeze({mount,version:VERSION});
})();