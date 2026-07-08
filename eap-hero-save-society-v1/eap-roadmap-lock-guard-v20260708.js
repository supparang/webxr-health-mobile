/* =========================================================
   EAP Hero Roadmap Lock Guard v20260708
   V4 SILENT STUDENT UI
   - Uses ONE rule for 15-week roadmap and session grid cards.
   - Unlock is based on routeOrder from the beginning, including Boss Gates.
   - S1 opens first. The first incomplete route is open. Later routes are locked.
   - Prior completed routes remain open for review/replay.
   - Student UI is silent: no repeated pass/diagnostic text is injected.
   - No compact map, no top overlay, no weekly default route.
========================================================= */
(function(){
'use strict';

const VERSION='v20260708-EAP-ROADMAP-LOCK-GUARD-V4-SILENT-STUDENT-UI';
const PACK='EAP_HERO_SESSION_CONTENT_PACK';
const STATE='EAP_HERO_PROGRESS_V3';
const PASS=60;
const SKILLS=['reading','listening','writing','speaking'];
const STYLE='eapUnifiedSeqLockStyleV4';
const TOAST='eapUnifiedSeqLockToastV4';

function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function lower(v){return clean(v).toLowerCase()}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function cap(v){const s=clean(v);return s.charAt(0).toUpperCase()+s.slice(1)}
function norm(v){const raw=clean(v).toUpperCase();return /^\d+$/.test(raw)?'S'+Number(raw):raw}
function pack(){const d=window[PACK];return d&&Array.isArray(d.routes)?d:null}
function routeList(){const d=pack();if(!d)return[];const order=Array.isArray(d.routeOrder)&&d.routeOrder.length?d.routeOrder:d.routes.map(r=>r.routeId);return order.map(id=>d.routes.find(r=>norm(r.routeId)===norm(id))).filter(Boolean)}
function routeIndex(id){return routeList().findIndex(r=>norm(r.routeId)===norm(id))}

function readState(){try{return JSON.parse(localStorage.getItem(STATE)||'{}')}catch(e){return {}}}
function entries(){const s=readState(),out=[];['portfolio','attempts','evidence','summary','records'].forEach(k=>{if(Array.isArray(s[k]))out.push.apply(out,s[k])});if(s.sessions&&typeof s.sessions==='object'){Object.keys(s.sessions).forEach(k=>{const v=s.sessions[k];if(Array.isArray(v))v.forEach(x=>out.push(Object.assign({sessionId:k},x||{})));else if(v&&typeof v==='object')Object.keys(v).forEach(sk=>{const x=v[sk];if(x&&typeof x==='object')out.push(Object.assign({sessionId:k,skill:sk},x));});});}return out}
function entryRoute(e){const r=e&&(e.routeId||e.sessionId||e.session||e.stage||'');return typeof r==='number'?'S'+r:norm(r)}
function entrySkill(e){return lower(e&&e.skill)}
function entryScore(e){return Math.max(num(e&&e.bestScore),num(e&&e.latestScore),num(e&&e.score),num(e&&e.stars)>=3?100:0)}
function entryPass(e){const raw=e&&(e.passed!==undefined?e.passed:e.pass);return raw===true||String(raw).toLowerCase()==='true'||String(raw)==='1'||entryScore(e)>=PASS}
function best(){const b={};entries().forEach(e=>{const r=entryRoute(e),s=entrySkill(e);if(!r||!s)return;const k=r+'|'+s,sc=entryScore(e),ps=entryPass(e);if(!b[k]||sc>b[k].score||ps)b[k]={score:sc,passed:ps}});return b}
function required(route){if(!route)return[];if(route.routeType==='boss_gate')return SKILLS.slice();const c=route.skillContract||{};const req=SKILLS.filter(s=>['Core','Support','Integrated'].indexOf(clean(c[s]))>=0);return req.length?req:['reading','writing']}
function routeStatus(id){const list=routeList();const r=list.find(x=>norm(x.routeId)===norm(id));if(!r)return{routeId:norm(id),complete:false,required:[],passed:[],missing:[],scores:{}};const rid=norm(r.routeId),b=best(),req=required(r),passed=[],missing=[],scores={};req.forEach(s=>{const item=b[rid+'|'+s];scores[s]=item?item.score:0;if(item&&(item.passed||item.score>=PASS))passed.push(s);else missing.push(s)});return{routeId:rid,routeType:r.routeType,title:r.title||'',complete:missing.length===0,required:req,passed:passed,missing:missing,scores:scores}}

function firstIncompleteIndex(){const list=routeList();for(let i=0;i<list.length;i++){if(!routeStatus(list[i].routeId).complete)return i}return Math.max(0,list.length-1)}
function maxOpenIndex(){return firstIncompleteIndex()}
function isUnlocked(id){const idx=routeIndex(id);return idx>=0&&idx<=maxOpenIndex()}
function currentRoute(){const list=routeList();return list[maxOpenIndex()]||list[0]||null}
function blockerFor(id){const idx=routeIndex(id),list=routeList();if(idx<0)return null;for(let i=0;i<idx;i++){const st=routeStatus(list[i].routeId);if(!st.complete)return st}return null}
function reason(id){const block=blockerFor(id);if(!block)return'';return 'ต้องผ่าน '+block.routeId+' ก่อน: '+block.missing.map(cap).join(' + ')+' ≥ 60/100'}
function setActive(id){const rid=norm(id)||'S1';try{localStorage.setItem('EAP_HERO_ACTIVE_ROUTE',rid);localStorage.setItem('EAP_HERO_CURRENT_ROUTE',rid);const m=rid.match(/^S(\d+)$/i);if(m)localStorage.setItem('EAP_HERO_CURRENT_SESSION',String(Number(m[1])))}catch(e){}}
function normalizeStoredIfLocked(){const keys=['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE','EAP_HERO_CURRENT_SESSION','EAP_ACTIVE_SESSION'];for(const k of keys){try{const raw=clean(localStorage.getItem(k));if(raw&&!isUnlocked(norm(raw))){const cur=currentRoute();if(cur)setActive(cur.routeId);return true}}catch(e){}}return false}

function addCss(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`
#eap-student-15week-roadmap .rm-card.eap-locked,.eap-session-unified-locked{opacity:.42!important;filter:grayscale(.35)!important;background:#f8fafc!important;border-style:dashed!important;box-shadow:none!important}
#eap-student-15week-roadmap .rm-card.eap-locked button,.eap-session-unified-locked button{background:#e5e7eb!important;color:#64748b!important;cursor:not-allowed!important;pointer-events:none!important}
#eap-student-15week-roadmap .rm-card.eap-done,.eap-session-unified-done{border-color:#99f6e4!important;box-shadow:0 0 0 2px rgba(20,184,166,.14)!important}
#eap-student-15week-roadmap .rm-card.eap-current,.eap-session-unified-current{border-color:#10b981!important;box-shadow:0 0 0 3px rgba(16,185,129,.16)!important}
.eap-lock-note,.eap-done-note{display:none!important}
#${TOAST}{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:999999;max-width:min(620px,calc(100vw - 28px));padding:13px 16px;border-radius:14px;background:#7c2d12;color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.25);font:800 13px Arial,'Noto Sans Thai',sans-serif;text-align:center}
`;document.head.appendChild(s)}
function toast(msg){let n=document.getElementById(TOAST);if(!n){n=document.createElement('div');n.id=TOAST;document.body.appendChild(n)}n.textContent=msg;clearTimeout(toast.t);toast.t=setTimeout(()=>{if(n&&n.parentNode)n.remove()},4200)}
function removeOldNotes(root){(root||document).querySelectorAll('.eap-lock-note,.eap-done-note,.rm-lock-note,.rm-done-note').forEach(n=>n.remove())}

function decorateRoadmap(){document.querySelectorAll('[data-eap-roadmap-card]').forEach(card=>{removeOldNotes(card);const rid=norm(card.getAttribute('data-eap-roadmap-card')),idx=routeIndex(rid),st=routeStatus(rid),open=isUnlocked(rid),done=st.complete,current=idx===maxOpenIndex()&&!done;card.classList.toggle('eap-locked',!open);card.classList.toggle('eap-done',open&&done);card.classList.toggle('eap-current',current);card.dataset.eapUnlocked=open?'1':'0';card.dataset.eapComplete=done?'1':'0';card.querySelectorAll('[data-eap-roadmap-route],[data-eap-roadmap-brief]').forEach(btn=>{btn.disabled=!open;btn.setAttribute('aria-disabled',open?'false':'true');btn.dataset.eapLocked=open?'0':'1'});});}
function findSessionCards(){const found=[];const seen=new Set();document.querySelectorAll('#app *').forEach(el=>{const t=clean(el.textContent||'');const m=t.match(/^SESSION\s+(1[0-5]|[1-9])\b/i);if(!m)return;let card=el.closest('article,section,[class*="card"],[class*="session"],div');for(let i=0;i<4&&card&&card.parentElement;i++){const txt=clean(card.textContent||'');if(txt.length>60&&txt.length<800&&/Session\s+\d+/i.test(txt))break;card=card.parentElement.closest('article,section,[class*="card"],[class*="session"],div')||card.parentElement;}if(!card||seen.has(card))return;seen.add(card);found.push({card:card,routeId:'S'+Number(m[1])});});return found}
function decorateSessionGrid(){findSessionCards().forEach(item=>{const card=item.card,rid=item.routeId,idx=routeIndex(rid);if(idx<0)return;removeOldNotes(card);const st=routeStatus(rid),open=isUnlocked(rid),done=st.complete,current=idx===maxOpenIndex()&&!done;card.classList.toggle('eap-session-unified-locked',!open);card.classList.toggle('eap-session-unified-done',open&&done);card.classList.toggle('eap-session-unified-current',current);card.dataset.eapUnlocked=open?'1':'0';card.querySelectorAll('button,a,[role="button"]').forEach(btn=>{btn.disabled=!open;btn.setAttribute('aria-disabled',open?'false':'true');btn.dataset.eapLocked=open?'0':'1'});});}
function decorate(){addCss();removeOldNotes(document);normalizeStoredIfLocked();decorateRoadmap();decorateSessionGrid();}
function routeFromButton(btn){const explicit=btn.getAttribute('data-eap-roadmap-route')||btn.getAttribute('data-eap-roadmap-brief')||'';if(explicit)return norm(explicit);const card=btn.closest('[data-eap-roadmap-card]');if(card)return norm(card.getAttribute('data-eap-roadmap-card'));const locked=btn.closest('.eap-session-unified-locked');if(locked){const t=clean(locked.textContent||'');const m=t.match(/SESSION\s+(1[0-5]|[1-9])/i);if(m)return'S'+Number(m[1])}return''}
function clickGuard(e){const btn=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!btn)return;const rid=routeFromButton(btn);if(!rid||isUnlocked(rid))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toast('ยังเข้า '+rid+' ไม่ได้: '+reason(rid));}
let timer;function schedule(){clearTimeout(timer);timer=setTimeout(decorate,80)}
function start(){addCss();document.addEventListener('click',clickGuard,true);window.addEventListener('load',schedule);window.addEventListener('storage',schedule);new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true});schedule();setInterval(decorate,900)}
window.EAPRoadmapLockGuard={version:VERSION,routeStatus:routeStatus,isUnlocked:isUnlocked,reason:reason,refresh:decorate,maxOpenIndex:maxOpenIndex,firstIncompleteIndex:firstIncompleteIndex,currentRoute:currentRoute};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();