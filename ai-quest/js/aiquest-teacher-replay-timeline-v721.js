/* CSAI2102 Teacher Console — Replay Timeline v7.2.1
   Add-on for Stable Inspector v704.
   Event-driven only: no MutationObserver, no interval, no modal rebuild.
*/
(()=>{'use strict';
if(window.__AIQUEST_TEACHER_REPLAY_TIMELINE_V721__)return;
window.__AIQUEST_TEACHER_REPLAY_TIMELINE_V721__=true;
const VERSION='v7.2.1';
const MODAL='aqInspectorV704';
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const arr=v=>Array.isArray(v)?v:[];
const obj=v=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const num=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
const parse=v=>{if(v&&typeof v==='object')return v;if(typeof v==='string'){try{return JSON.parse(v)}catch(e){return {}}}return {}};
const api=()=>window.AIQUEST_TEACHER_INSPECTOR_V704||window.AIQUEST_TEACHER_INSPECTOR_V703||null;
const state=()=>api()?.state||null;
function currentGroup(){const s=state();return s?.groups?.find(g=>g.id===s.session)||s?.groups?.[0]||null}
function currentAttempt(){const s=state(),g=currentGroup();return g?.attempts?.[s?.attemptIndex||0]||g?.latest||{}}
function meta(a){const e=parse(a?.extraJson||a?.extra),raw=obj(e.raw||a?.raw),nested=parse(raw.extraJson||e.extraJson);return Object.assign({},e,nested,obj(raw.extraJson))}
function challenge(a){const x=meta(a),audit=obj(x.challengeAudit),replay=obj(x.replayAudit);return{x,audit,cards:arr(replay.cards)}}
function wrongSet(a){return new Set(arr(a?.wrongItems).map(v=>String(v)))}
function cardWrong(card,index,wrong){
  const flags=[card?.wrong,card?.isWrong,card?.correct===false,card?.wasCorrect===false,String(card?.result||'').toLowerCase()==='wrong'];
  if(flags.some(Boolean))return true;
  return wrong.has(String(card?.id))||wrong.has(String(index))||wrong.has(String(index+1));
}
function cardTime(card){
  const sec=num(card?.timeSec||card?.responseTimeSec||card?.usedTimeSec,NaN);
  if(Number.isFinite(sec)&&sec>=0)return sec;
  const ms=num(card?.responseTimeMs||card?.durationMs,NaN);
  return Number.isFinite(ms)&&ms>=0?Math.round(ms/100)/10:null;
}
function hintCount(card){return num(card?.hintUsed||card?.hints||card?.helpUsed,0)}
function retryCount(card){return num(card?.retryCount||card?.retries||card?.attempts,0)}
function enrichCards(a,c){const wrong=wrongSet(a);return c.cards.map((card,i)=>({card,index:i,wrong:cardWrong(card,i,wrong),time:cardTime(card),hints:hintCount(card),retries:retryCount(card)}))}
let filter='all',selected=-1;
function matches(row){
  if(filter==='wrong')return row.wrong;
  if(filter==='risk')return /high|critical/i.test(String(row.card?.risk||''));
  if(filter==='slow')return row.time!=null&&row.time>30;
  if(filter==='hint')return row.hints>0;
  if(filter==='retry')return row.retries>0;
  return true;
}
function badge(text,kind=''){return `<span class="aq721-badge ${kind}">${esc(text)}</span>`}
function detail(row){if(!row)return '<div class="aq721-empty">เลือกการ์ดเพื่อดูรายละเอียด</div>';const c=row.card;return `<article class="aq721-detail"><div class="aq721-detail-head"><div><small>Card ${row.index+1}</small><h3>${esc(c.concept||'ไม่ระบุ concept')}</h3></div>${badge(c.risk||'—',/critical|high/i.test(String(c.risk||''))?'danger':'')}</div><p><b>Context:</b> ${esc(c.context||'—')}</p><p><b>Trap:</b> ${esc(c.trap||'—')}</p><p><b>คำตอบที่ถูก:</b> ${esc(c.correct||'—')}</p><div><b>Distractors</b>${arr(c.distractors).length?`<ul>${arr(c.distractors).map(d=>`<li>${esc(d)}</li>`).join('')}</ul>`:'<p class="aq721-muted">ไม่มีข้อมูล</p>'}</div><p><b>Answer slot:</b> ${c.answerSlot==null?'—':num(c.answerSlot)+1}</p><p><b>เวลารายข้อ:</b> ${row.time==null?'ไม่ได้บันทึก':esc(row.time+' วินาที')}</p><p><b>Hint / Retry:</b> ${row.hints} / ${row.retries}</p><p><b>ผลรายข้อ:</b> ${row.wrong?'ควรทบทวน':'ไม่มีหลักฐานว่าตอบผิด'}</p></article>`}
function render(){
  const s=state(),host=document.getElementById('aq704Content');
  if(!s||s.tab!=='replay'||!host)return;
  const a=currentAttempt(),c=challenge(a),rows=enrichCards(a,c),shown=rows.filter(matches);
  if(selected<0||selected>=rows.length)selected=shown[0]?.index??-1;
  const selectedRow=rows.find(r=>r.index===selected)||shown[0]||null;
  const wrongN=rows.filter(r=>r.wrong).length,riskN=rows.filter(r=>/high|critical/i.test(String(r.card?.risk||''))).length;
  const timed=rows.filter(r=>r.time!=null),avgTime=timed.length?Math.round(timed.reduce((sum,r)=>sum+r.time,0)/timed.length*10)/10:null;
  const hintN=rows.reduce((sum,r)=>sum+r.hints,0),retryN=rows.reduce((sum,r)=>sum+r.retries,0);
  host.innerHTML=`<style>
  #${MODAL} .aq721-summary{display:grid;grid-template-columns:repeat(5,minmax(120px,1fr));gap:9px;margin-bottom:12px}
  #${MODAL} .aq721-stat{padding:11px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(255,255,255,.035)}
  #${MODAL} .aq721-stat small{color:#9fb2cc}#${MODAL} .aq721-stat b{display:block;font-size:22px;margin-top:3px}
  #${MODAL} .aq721-tools{display:flex;gap:7px;flex-wrap:wrap;margin:8px 0 13px}#${MODAL} .aq721-tools button.active{background:#0f4c75;border-color:#38bdf8}
  #${MODAL} .aq721-layout{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,.65fr);gap:12px;min-height:0}
  #${MODAL} .aq721-list{display:grid;gap:7px;max-height:55vh;overflow:auto;padding-right:4px}
  #${MODAL} .aq721-card{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;text-align:left;padding:10px;border:1px solid rgba(148,163,184,.2);border-radius:13px;background:rgba(255,255,255,.025)}
  #${MODAL} .aq721-card.selected{border-color:#38bdf8;background:rgba(56,189,248,.1)}#${MODAL} .aq721-card.wrong{border-left:4px solid #fb7185}
  #${MODAL} .aq721-num{font-size:18px;font-weight:900;color:#bae6fd}#${MODAL} .aq721-card small{color:#9fb2cc}
  #${MODAL} .aq721-flags{display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end}#${MODAL} .aq721-badge{display:inline-flex;border:1px solid rgba(56,189,248,.35);border-radius:999px;padding:4px 7px;font-size:11px;background:rgba(56,189,248,.08)}
  #${MODAL} .aq721-badge.danger{border-color:rgba(251,113,133,.5);color:#fecdd3;background:rgba(251,113,133,.09)}
  #${MODAL} .aq721-detail{padding:13px;border:1px solid rgba(148,163,184,.2);border-radius:14px;background:rgba(255,255,255,.025);max-height:55vh;overflow:auto}
  #${MODAL} .aq721-detail-head{display:flex;justify-content:space-between;gap:8px}.aq721-detail h3{margin:2px 0 8px}.aq721-detail p,.aq721-detail li{line-height:1.5}.aq721-muted,.aq721-empty{color:#9fb2cc}
  @media(max-width:900px){#${MODAL} .aq721-summary{grid-template-columns:1fr 1fr}#${MODAL} .aq721-layout{grid-template-columns:1fr}#${MODAL} .aq721-detail{max-height:none}}
  </style>
  <div class="aq721-summary"><div class="aq721-stat"><small>Cards</small><b>${rows.length}</b></div><div class="aq721-stat"><small>Wrong evidence</small><b>${wrongN||'—'}</b></div><div class="aq721-stat"><small>High–Critical</small><b>${riskN}</b></div><div class="aq721-stat"><small>Avg item time</small><b>${avgTime==null?'—':avgTime+'s'}</b></div><div class="aq721-stat"><small>Hints / Retries</small><b>${hintN} / ${retryN}</b></div></div>
  <p class="aq721-muted">Replay Timeline ${VERSION} • แสดงเฉพาะข้อมูลที่ถูกบันทึกจริง หากไม่มีเวลาหรือคำตอบรายข้อจะไม่ประมาณค่า</p>
  <div class="aq721-tools">${[['all','ทั้งหมด '+rows.length],['wrong','Wrong '+wrongN],['risk','High–Critical '+riskN],['slow','Slow >30s'],['hint','Hint used'],['retry','Retry']].map(([id,label])=>`<button type="button" data-v721-filter="${id}" class="${filter===id?'active':''}">${label}</button>`).join('')}</div>
  <div class="aq721-layout"><div class="aq721-list">${shown.map(row=>{const c=row.card;return `<button type="button" class="aq721-card ${row.wrong?'wrong':''} ${row.index===selected?'selected':''}" data-v721-card="${row.index}"><span class="aq721-num">${row.index+1}</span><span><b>${esc(c.concept||'—')}</b><small>${esc(c.context||'')}</small></span><span class="aq721-flags">${badge(c.risk||'—',/critical|high/i.test(String(c.risk||''))?'danger':'')}${row.time!=null?badge(row.time+'s'):''}${row.hints?badge('Hint '+row.hints):''}${row.retries?badge('Retry '+row.retries):''}</span></button>`}).join('')||'<div class="aq721-empty">ไม่มีรายการตามตัวกรองนี้</div>'}</div>${detail(selectedRow)}</div>`;
}
function schedule(){queueMicrotask(()=>{try{render()}catch(err){console.error('[AIQuest] Replay Timeline render failed',err)}})}
document.addEventListener('click',e=>{
  const modal=e.target.closest?.('#'+MODAL);if(!modal)return;
  const f=e.target.closest?.('[data-v721-filter]');if(f){e.preventDefault();e.stopPropagation();filter=f.dataset.v721Filter||'all';selected=-1;render();return}
  const card=e.target.closest?.('[data-v721-card]');if(card){e.preventDefault();e.stopPropagation();selected=num(card.dataset.v721Card,-1);render();return}
  if(e.target.closest?.('[data-tab="replay"]')){filter='all';selected=-1;schedule()}
},false);
document.addEventListener('keydown',e=>{
  const root=document.getElementById(MODAL);if(!root)return;
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName||''))return;
  const map={'1':'overview','2':'reflection','3':'replay','4':'history'};
  if(map[e.key]){e.preventDefault();root.querySelector(`[data-tab="${map[e.key]}"]`)?.click();return}
  if(e.key==='ArrowLeft'){e.preventDefault();root.querySelector('[data-action="prev"]')?.click();return}
  if(e.key==='ArrowRight'){e.preventDefault();root.querySelector('[data-action="next"]')?.click()}
},false);
console.log('[AIQuest] Replay Timeline active',VERSION);
})();