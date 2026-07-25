/* CSAI2601 UX Quest • Project/Figma/Evidence Authority v3
 * Canonical binding for W1-W15 + B1-B4.
 * Never reads arbitrary Studio textareas. Only projectId, figmaUrl, evidenceUrl.
 */
(() => {
  'use strict';

  const ROOT = document.getElementById('uxqCanonicalNode') || document.body;
  const P = new URLSearchParams(location.search || '');
  const NODE = String(P.get('node') || P.get('id') || 'W1').trim().toUpperCase();
  if (!/^(W(?:[1-9]|1[0-5])|B[1-4])$/.test(NODE)) return;

  const IS_W1 = NODE === 'W1';
  const IS_BOSS = /^B/.test(NODE);
  const FIGMA_RE = /^https:\/\/(?:www\.)?figma\.com\/(?:design|file|proto|board|slides|make)\//i;
  const HTTP_RE = /^https:\/\//i;
  const VERSION = '20260725-PROJECT-FIGMA-EVIDENCE-V3';

  function identity() {
    let profile = {};
    try { profile = window.UXQIdentity?.get?.() || {}; } catch (_) {}
    return {
      studentId:String(profile.studentId || P.get('studentId') || P.get('sid') || '').trim(),
      section:String(profile.section || P.get('section') || '').trim()
    };
  }
  function keys() {
    const id = identity();
    const suffix = `${id.studentId || 'anonymous'}::${id.section || 'default'}`;
    return {
      project:`uxq.csai2601.masterProject.v3.${suffix}`,
      figma:`uxq.csai2601.masterFigma.v3.${suffix}`
    };
  }
  function read(key) { try { return String(localStorage.getItem(key) || '').trim(); } catch (_) { return ''; } }
  function write(key,value) { try { localStorage.setItem(key,String(value || '').trim()); } catch (_) {} }

  function visibleStudio() {
    const list = Array.from(ROOT.querySelectorAll('.artifact'));
    return list.find(card => {
      const css = getComputedStyle(card);
      const visible = css.display !== 'none' && css.visibility !== 'hidden' && card.getClientRects().length > 0;
      const real = card.querySelector('[data-studio-submit],[data-save-artifact],[data-studio-key]');
      return visible && real;
    }) || null;
  }

  function ensureCanonical(card,key,label,format='text',required='0') {
    let field = card.querySelector(`[data-studio-key="${key}"]`);
    if (!field) {
      field = document.createElement('textarea');
      field.hidden = true;
      field.dataset.studioKey = key;
      card.appendChild(field);
    }
    field.dataset.studioLabel = label;
    field.dataset.format = format;
    field.dataset.required = required;
    field.dataset.minLength = '0';
    return field;
  }

  function cleanCanonical(field,type) {
    const value = String(field.value || '').trim();
    if (!value) return '';
    if (type === 'figma' && !FIGMA_RE.test(value)) { field.value=''; return ''; }
    if (type === 'project' && (value.length > 80 || HTTP_RE.test(value) || /หลักฐาน|ผู้ใช้|friction|task/i.test(value))) { field.value=''; return ''; }
    if (type === 'evidence' && value && !HTTP_RE.test(value)) { field.value=''; return ''; }
    return String(field.value || '').trim();
  }

  function installStyle() {
    if (document.getElementById('uxq-pfe-v3-style')) return;
    const s=document.createElement('style');
    s.id='uxq-pfe-v3-style';
    s.textContent=`
      #uxqProjectFigmaEvidenceV3{display:grid!important;gap:14px;width:min(100%,1040px);margin:18px auto;padding:18px;box-sizing:border-box;border:1px solid rgba(110,231,255,.58);border-radius:20px;background:linear-gradient(135deg,rgba(11,50,96,.98),rgba(44,29,104,.96));box-shadow:0 18px 44px rgba(0,0,0,.28);position:relative;z-index:120}
      .uxq-pfe__head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start}.uxq-pfe__head h2{margin:0;font-size:1.15rem}.uxq-pfe__head p{margin:5px 0 0;color:#d4e4fa;line-height:1.5}.uxq-pfe__badge{padding:5px 9px;border-radius:999px;background:rgba(110,231,255,.14);font-weight:900;font-size:.72rem;white-space:nowrap}
      .uxq-pfe__fields{display:grid;grid-template-columns:minmax(220px,.75fr) minmax(0,1.25fr) minmax(0,1fr);gap:10px}.uxq-pfe__field{display:grid;gap:6px}.uxq-pfe__field label{font-weight:900}.uxq-pfe__field input{width:100%;min-height:48px;padding:10px 12px;box-sizing:border-box;border:1px solid rgba(181,205,255,.38);border-radius:12px;background:#07142e;color:#fff;font:inherit}
      .uxq-pfe__actions{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.uxq-pfe__btn{display:grid;place-items:center;min-height:46px;padding:10px 12px;border-radius:12px;text-decoration:none;font-weight:950}.uxq-pfe__btn.primary{background:linear-gradient(90deg,#6ee7ff,#79eda5);color:#071124}.uxq-pfe__btn.secondary{border:1px solid rgba(110,231,255,.38);color:#eef7ff;background:rgba(255,255,255,.04)}.uxq-pfe__btn[aria-disabled='true']{opacity:.45;pointer-events:none}
      .uxq-pfe__status{padding:9px 11px;border-radius:11px;font-size:.8rem}.uxq-pfe__status[data-state='ok']{color:#8ff0bb;background:rgba(82,224,147,.1)}.uxq-pfe__status[data-state='bad']{color:#ffb0bd;background:rgba(255,91,115,.1)}.uxq-pfe__status[data-state='empty']{color:#ffdc91;background:rgba(255,209,102,.08)}
      @media(max-width:900px){.uxq-pfe__fields{grid-template-columns:1fr 1fr}.uxq-pfe__field:last-child{grid-column:1/-1}}@media(max-width:650px){#uxqProjectFigmaEvidenceV3{margin:12px 8px;width:auto;padding:14px}.uxq-pfe__head{display:block}.uxq-pfe__badge{display:inline-block;margin-top:8px}.uxq-pfe__fields,.uxq-pfe__actions{grid-template-columns:1fr}.uxq-pfe__field:last-child{grid-column:auto}}
    `;
    document.head.appendChild(s);
  }

  function mount() {
    installStyle();
    const card = visibleStudio();
    if (!card || !card.parentNode) return;

    const project = ensureCanonical(card,'projectId',IS_W1?'Master Project ID':'Master Project ID เดิม','text','1');
    const figma = ensureCanonical(card,'figmaUrl',IS_W1?'Master Figma Project URL':'Project / Evidence URL','url','1');
    const evidence = ensureCanonical(card,'evidenceUrl','Evidence URL','url','0');

    const k=keys();
    let projectValue=cleanCanonical(project,'project') || read(k.project);
    let figmaValue=cleanCanonical(figma,'figma') || read(k.figma);
    let evidenceValue=cleanCanonical(evidence,'evidence');
    if (IS_W1 && !projectValue) {
      const id=identity().studentId;
      projectValue=id?`UX2601-${id}`:'';
    }

    let box=document.getElementById('uxqProjectFigmaEvidenceV3');
    if (!box) {
      box=document.createElement('section');
      box.id='uxqProjectFigmaEvidenceV3';
      const title=IS_W1?'สร้าง Master Figma Project ครั้งเดียว':IS_BOSS?`ใช้ Master Project เดิมสำหรับ ${NODE} Defense`:`ใช้ Master Project เดิมต่อใน ${NODE}`;
      const desc=IS_W1?'สร้าง Project หลักใน W1 แล้วใช้ Project เดิมต่อเนื่องถึง W15':'เปิด Project เดิม เพิ่ม Page/Section ของสัปดาห์นี้ และเชื่อมหลักฐานที่เกี่ยวข้อง';
      box.innerHTML=`<div class="uxq-pfe__head"><div><h2>${title}</h2><p>${desc}</p></div><span class="uxq-pfe__badge">${NODE} • ${IS_W1?'CREATE':IS_BOSS?'DEFENSE':'REUSE'}</span></div><div class="uxq-pfe__fields"><div class="uxq-pfe__field"><label>Master Project ID</label><input data-pfe-project type="text" autocomplete="off" placeholder="UX2601-รหัสนักศึกษา"></div><div class="uxq-pfe__field"><label>${IS_W1?'Master Figma Project URL':'Project / Evidence URL'}</label><input data-pfe-figma type="url" inputmode="url" autocomplete="off" placeholder="https://www.figma.com/design/..."></div><div class="uxq-pfe__field"><label>Evidence URL <small>(ถ้ามี)</small></label><input data-pfe-evidence type="url" inputmode="url" autocomplete="off" placeholder="https://..."></div></div><div class="uxq-pfe__actions"><a class="uxq-pfe__btn primary" data-pfe-create target="_blank" rel="noopener noreferrer">${IS_W1?'สร้าง Master Figma Project':'เปิด Master Project เดิม'} ↗</a><a class="uxq-pfe__btn secondary" data-pfe-open-figma href="#" aria-disabled="true">เปิด Figma ที่วาง</a><a class="uxq-pfe__btn secondary" data-pfe-open-evidence href="#" aria-disabled="true">เปิด Evidence</a></div><div class="uxq-pfe__status" data-state="empty">กรอก Project ID และวางลิงก์ Figma</div>`;
    }
    if (box.parentNode !== card.parentNode || box.nextElementSibling !== card) card.parentNode.insertBefore(box,card);

    const pIn=box.querySelector('[data-pfe-project]');
    const fIn=box.querySelector('[data-pfe-figma]');
    const eIn=box.querySelector('[data-pfe-evidence]');
    const create=box.querySelector('[data-pfe-create]');
    const openF=box.querySelector('[data-pfe-open-figma]');
    const openE=box.querySelector('[data-pfe-open-evidence]');
    const status=box.querySelector('.uxq-pfe__status');

    pIn.value=projectValue;
    fIn.value=figmaValue;
    eIn.value=evidenceValue;

    const sync=()=>{
      project.value=String(pIn.value||'').trim();
      figma.value=String(fIn.value||'').trim();
      evidence.value=String(eIn.value||'').trim();
      [project,figma,evidence].forEach(x=>{x.dispatchEvent(new Event('input',{bubbles:true}));x.dispatchEvent(new Event('change',{bubbles:true}));});
      if(project.value)write(k.project,project.value);
      if(FIGMA_RE.test(figma.value))write(k.figma,figma.value);
      create.href=IS_W1?'https://www.figma.com/files/':(FIGMA_RE.test(figma.value)?figma.value:read(k.figma)||'https://www.figma.com/files/');
      const fOk=FIGMA_RE.test(figma.value),eOk=!evidence.value||HTTP_RE.test(evidence.value);
      openF.href=fOk?figma.value:'#';openF.setAttribute('aria-disabled',fOk?'false':'true');
      openE.href=evidence.value&&eOk?evidence.value:'#';openE.setAttribute('aria-disabled',evidence.value&&eOk?'false':'true');
      if(!project.value||!figma.value){status.dataset.state='empty';status.textContent='กรอก Project ID และวางลิงก์ Figma';}
      else if(!fOk){status.dataset.state='bad';status.textContent='Figma URL ไม่ถูกต้อง ต้องเป็นลิงก์ figma.com';}
      else if(!eOk){status.dataset.state='bad';status.textContent='Evidence URL ไม่ถูกต้อง';}
      else{status.dataset.state='ok';status.textContent='Project, Figma และหลักฐานพร้อมใช้งาน';}
    };
    if(box.dataset.bound!=='1'){
      box.dataset.bound='1';
      [pIn,fIn,eIn].forEach(input=>input.addEventListener('input',sync));
      [openF,openE].forEach(link=>link.addEventListener('click',ev=>{if(link.getAttribute('aria-disabled')==='true')ev.preventDefault();}));
    }
    sync();
  }

  let timer=0;
  const schedule=()=>{clearTimeout(timer);timer=setTimeout(mount,80);};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
  new MutationObserver(schedule).observe(ROOT,{childList:true,subtree:true});
  ['uxq-mission-resume-studio','uxq-direct-studio-confirmed','uxq-studio-production-rewrite-ready'].forEach(name=>window.addEventListener(name,schedule));
  window.UXQProjectFigmaEvidenceAuthorityV3=Object.freeze({mount,version:VERSION});
})();