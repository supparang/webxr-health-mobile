/* =========================================================
   EAP Hero Roadmap Lock Guard v20260708
   V8 CLOUD SESSIONPROGRESS + HIDE FUTURE DETAILS
   - ONE rule for roadmap + session grid.
   - routeOrder includes S1-S15 and B1-B5.
   - Unlock trusts Cloud/Sheet verified records first.
   - Also trusts serverResume/sessionProgress written by the Cloud Resume API.
   - Future locked sessions may have old test records, but their score cards
     are hidden until the route is actually unlocked.
   - IMPORTANT: never decorates/disables active mission/question UI.
========================================================= */
(function(){
'use strict';

const VERSION='v20260708-EAP-ROADMAP-LOCK-GUARD-V8-HIDE-FUTURE-LOCKED-PROGRESS';
const PACK='EAP_HERO_SESSION_CONTENT_PACK';
const STATE='EAP_HERO_PROGRESS_V3';
const PASS=60;
const SKILLS=['reading','listening','writing','speaking'];
const STYLE='eapUnifiedSeqLockStyleV8HideFutureProgress';
const TOAST='eapUnifiedSeqLockToastV8HideFutureProgress';

function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function lower(v){return clean(v).toLowerCase()}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function cap(v){const s=clean(v);return s.charAt(0).toUpperCase()+s.slice(1)}
function norm(v){const raw=clean(v).toUpperCase();return /^\d+$/.test(raw)?'S'+Number(raw):raw}
function pack(){const d=window[PACK];return d&&Array.isArray(d.routes)?d:null}
function routeList(){const d=pack();if(!d)return[];const order=Array.isArray(d.routeOrder)&&d.routeOrder.length?d.routeOrder:d.routes.map(r=>r.routeId);return order.map(id=>d.routes.find(r=>norm(r.routeId)===norm(id))).filter(Boolean)}
function routeIndex(id){return routeList().findIndex(r=>norm(r.routeId)===norm(id))}
function readState(){try{return JSON.parse(localStorage.getItem(STATE)||'{}')}catch(e){return {}}}
function isCloudState(s){s=s||readState();return !!(s.serverResume&&(s.serverResume.cloudFirst===true||num(s.serverResume.recordCount)>0||clean(s.serverResume.resumeKey)))||s.cloudResumeStatus==='ok'||clean(s.currentCloudRoute)}
function cloudTrusted(e){return !!(e&&(e.cloudVerified===true||e.serverVerified===true||e.restoredFromSheet===true||e.sheetConfirmed===true||clean(e.resumeSource).indexOf('server')>=0||clean(e.resumeSource).indexOf('cloud')>=0||clean(e.sourceSheet))) }
function addCloudSessionProgress(out,s){if(!isCloudState(s)||!s.sessionProgress||typeof s.sessionProgress!=='object')return;Object.keys(s.sessionProgress).forEach(routeKey=>{const st=s.sessionProgress[routeKey];const rid=norm(st&&st.routeId||routeKey);if(!rid||!routeById(rid))return;const scores=st.scores||{};Object.keys(scores).forEach(sk=>{const score=num(scores[sk]);out.push({routeId:rid,sessionId:rid,skill:sk,score:score,bestScore:score,passed:score>=PASS,cloudVerified:true,serverVerified:true,restoredFromSheet:true,resumeSource:'server_sessionProgress'});});if(st.complete===true&&Array.isArray(st.required)){st.required.forEach(sk=>{if(scores[sk]==null)out.push({routeId:rid,sessionId:rid,skill:sk,score:100,bestScore:100,passed:true,cloudVerified:true,serverVerified:true,restoredFromSheet:true,resumeSource:'server_completedSessions'});});}})}
function entries(){const s=readState(),out=[];['portfolio','attempts','evidence','summary','records'].forEach(k=>{if(Array.isArray(s[k]))out.push.apply(out,s[k])});if(s.sessions&&typeof s.sessions==='object'){Object.keys(s.sessions).forEach(k=>{const v=s.sessions[k];if(Array.isArray(v))v.forEach(x=>out.push(Object.assign({sessionId:k},x||{})));else if(v&&typeof v==='object')Object.keys(v).forEach(sk=>{const x=v[sk];if(x&&typeof x==='object')out.push(Object.assign({sessionId:k,skill:sk},x));});});}addCloudSessionProgress(out,s);return out.filter(cloudTrusted)}
function routeById(id){const rid=norm(id);return routeList().find(r=>norm(r.routeId)===rid)||null}
function entryRoute(e){const r=e&&(e.routeId||e.sessionId||e.session||e.stage||'');return typeof r==='number'?'S'+r:norm(r)}
function entrySkill(e){return lower(e&&e.skill)}
function entryScore(e){return Math.max(num(e&&e.bestScore),num(e&&e.latestScore),num(e&&e.score),num(e&&e.stars)>=3?100:0)}
function entryPass(e){const raw=e&&(e.passed!==undefined?e.passed:e.pass);return raw===true||String(raw).toLowerCase()==='true'||String(raw)==='1'||entryScore(e)>=PASS}
function best(){const b={};entries().forEach(e=>{const r=entryRoute(e),s=entrySkill(e);if(!r||!s)return;const k=r+'|'+s,sc=entryScore(e),ps=entryPass(e);if(!b[k]||sc>b[k].score||ps)b[k]={score:sc,passed:ps}});return b}
function required(route){if(!route)return[];if(route.routeType==='boss_gate')return SKILLS.slice();const c=route.skillContract||{};const req=SKILLS.filter(s=>['Core','Support','Integrated'].indexOf(clean(c[s]))>=0);return req.length?req:['reading','writing']}
function completedByCloudState(rid){const s=readState();if(!isCloudState(s))return false;const r=norm(rid),n=(r.match(/^S(\d+)$/)||[])[1];const c=s.completedSessions||{};return c[r]===true||(n&&c[n]===true)}
function routeStatus(id){const list=routeList();const r=list.find(x=>norm(x.routeId)===norm(id));if(!r)return{routeId:norm(id),complete:false,required:[],passed:[],missing:[],scores:{}};const rid=norm(r.routeId),b=best(),req=required(r),passed=[],missing=[],scores={};req.forEach(s=>{const item=b[rid+'|'+s];scores[s]=item?item.score:0;if(item&&(item.passed||item.score>=PASS))passed.push(s);else missing.push(s)});if(missing.length&&completedByCloudState(rid)){missing.splice(0,missing.length);req.forEach(s=>{if(passed.indexOf(s)<0)passed.push(s);if(!scores[s])scores[s]=100});}return{routeId:rid,routeType:r.routeType,title:r.title||'',complete:missing.length===0,required:req,passed:passed,missing:missing,scores:scores}}
function firstIncompleteIndex(){const list=routeList();for(let i=0;i<list.length;i++){if(!routeStatus(list[i].routeId).complete)return i}return Math.max(0,list.length-1)}
function maxOpenIndex(){return firstIncompleteIndex()}
function isUnlocked(id){const idx=routeIndex(id);return idx>=0&&idx<=maxOpenIndex()}
function currentRoute(){const s=readState(),list=routeList();if(isCloudState(s)&&s.currentCloudRoute){const r=routeById(s.currentCloudRoute);if(r)return r}return list[maxOpenIndex()]||list[0]||null}
function blockerFor(id){const idx=routeIndex(id),list=routeList();if(idx<0)return null;for(let i=0;i<idx;i++){const st=routeStatus(list[i].routeId);if(!st.complete)return st}return null}
function reason(id){const block=blockerFor(id);if(!block)return'';return 'ต้องมีผลที่ยืนยันบน Cloud/Sheet ของ '+block.routeId+' ก่อน: '+block.missing.map(cap).join(' + ')+' ≥ 60/100'}
function setActive(id){const rid=norm(id)||'S1';try{localStorage.setItem('EAP_HERO_ACTIVE_ROUTE',rid);localStorage.setItem('EAP_HERO_CURRENT_ROUTE',rid);const m=rid.match(/^S(\d+)$/i);if(m)localStorage.setItem('EAP_HERO_CURRENT_SESSION',String(Number(m[1])))}catch(e){}}
function normalizeStoredIfLocked(){const keys=['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE','EAP_HERO_CURRENT_SESSION','EAP_ACTIVE_SESSION'];for(const k of keys){try{const raw=clean(localStorage.getItem(k));if(raw&&!isUnlocked(norm(raw))){const cur=currentRoute();if(cur)setActive(cur.routeId);return true}}catch(e){}}return false}
function isActiveMissionArea(node){return !!(node&&node.closest&&node.closest('.battle-layout,.challenge-card,.choices,.question,.context,.feedback,.boss-brief,.boss-taunt'))}
function addCss(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`
#eap-student-15week-roadmap .rm-card.eap-locked,.session-tile.eap-session-unified-locked,.session-card.eap-session-unified-locked,.checkpoint-card.eap-session-unified-locked{opacity:.42!important;filter:grayscale(.35)!important;background:#f8fafc!important;border-style:dashed!important;box-shadow:none!important}
#eap-student-15week-roadmap .rm-card.eap-locked button,.session-tile.eap-session-unified-locked button,.session-card.eap-session-unified-locked button,.checkpoint-card.eap-session-unified-locked button{background:#e5e7eb!important;color:#64748b!important;cursor:not-allowed!important;pointer-events:none!important}
#eap-student-15week-roadmap .rm-card.eap-done,.session-tile.eap-session-unified-done,.session-card.eap-session-unified-done,.checkpoint-card.eap-session-unified-done{border-color:#99f6e4!important;box-shadow:0 0 0 2px rgba(20,184,166,.14)!important}
#eap-student-15week-roadmap .rm-card.eap-current,.session-tile.eap-session-unified-current,.session-card.eap-session-unified-current,.checkpoint-card.eap-session-unified-current{border-color:#10b981!important;box-shadow:0 0 0 3px rgba(16,185,129,.16)!important}
[data-eap-locked-progress-detail="1"]{display:none!important}
.battle-layout.eap-session-unified-locked,.challenge-card.eap-session-unified-locked{opacity:1!important;filter:none!important;pointer-events:auto!important;background:inherit!important;border-style:solid!important}
.battle-layout.eap-session-unified-locked button,.challenge-card.eap-session-unified-locked button{pointer-events:auto!important;cursor:pointer!important}
.eap-lock-note,.eap-done-note{display:none!important}
#${TOAST}{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:999999;max-width:min(680px,calc(100vw - 28px));padding:13px 16px;border-radius:14px;background:#7c2d12;color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.25);font:800 13px Arial,'Noto Sans Thai',sans-serif;text-align:center}
`;document.head.appendChild(s)}
function toast(msg){let n=document.getElementById(TOAST);if(!n){n=document.createElement('div');n.id=TOAST;document.body.appendChild(n)}n.textContent=msg;clearTimeout(toast.t);toast.t=setTimeout(()=>{if(n&&n.parentNode)n.remove()},5200)}
function removeOldNotes(root){(root||document).querySelectorAll('.eap-lock-note,.eap-done-note,.rm-lock-note,.rm-done-note').forEach(n=>n.remove())}
function restoreLockedDetails(card){card.querySelectorAll('[data-eap-locked-progress-detail="1"]').forEach(n=>{n.removeAttribute('data-eap-locked-progress-detail');n.removeAttribute('aria-hidden')})}
function hideFutureProgressDetails(card,open){restoreLockedDetails(card);if(open)return;Array.from(card.querySelectorAll('div,section,article,p')).forEach(node=>{if(node===card||isActiveMissionArea(node))return;const t=clean(node.textContent||'');if(!t||t.length>360)return;if(/Session Passed|Session not passed yet|avg\s*\d+|Reading\s+\d+\/60|Writing\s+\d+\/60|Listening\s+\d+\/60|Speaking\s+\d+\/60/i.test(t)){node.setAttribute('data-eap-locked-progress-detail','1');node.setAttribute('aria-hidden','true')}})}
function decorateRoadmap(){document.querySelectorAll('[data-eap-roadmap-card]').forEach(card=>{removeOldNotes(card);const rid=norm(card.getAttribute('data-eap-roadmap-card')),idx=routeIndex(rid),st=routeStatus(rid),open=isUnlocked(rid),done=st.complete,current=idx===maxOpenIndex()&&!done;card.classList.toggle('eap-locked',!open);card.classList.toggle('eap-done',open&&done);card.classList.toggle('eap-current',current);card.dataset.eapUnlocked=open?'1':'0';card.dataset.eapComplete=done?'1':'0';card.querySelectorAll('[data-eap-roadmap-route],[data-eap-roadmap-brief]').forEach(btn=>{btn.disabled=!open;btn.setAttribute('aria-disabled',open?'false':'true');btn.dataset.eapLocked=open?'0':'1'});});}
function findSessionCards(){const found=[];const seen=new Set();document.querySelectorAll('#app .session-tile,#app .session-card,#app .checkpoint-card').forEach(card=>{if(isActiveMissionArea(card))return;const t=clean(card.textContent||'');const m=t.match(/SESSION\s+(1[0-5]|[1-9])\b/i);if(!m)return;if(seen.has(card))return;seen.add(card);found.push({card:card,routeId:'S'+Number(m[1])});});return found}
function clearAccidentalMissionLocks(){document.querySelectorAll('.battle-layout.eap-session-unified-locked,.challenge-card.eap-session-unified-locked,.choices.eap-session-unified-locked').forEach(node=>{node.classList.remove('eap-session-unified-locked','eap-session-unified-done','eap-session-unified-current');node.removeAttribute('data-eap-unlocked')});document.querySelectorAll('.battle-layout button,.challenge-card button,.choices button').forEach(btn=>{if(btn.dataset&&btn.dataset.eapLocked==='1'){btn.disabled=false;btn.setAttribute('aria-disabled','false');btn.dataset.eapLocked='0'}})}
function decorateSessionGrid(){clearAccidentalMissionLocks();findSessionCards().forEach(item=>{const card=item.card,rid=item.routeId,idx=routeIndex(rid);if(idx<0)return;removeOldNotes(card);const st=routeStatus(rid),open=isUnlocked(rid),done=st.complete,current=idx===maxOpenIndex()&&!done;hideFutureProgressDetails(card,open);card.classList.toggle('eap-session-unified-locked',!open);card.classList.toggle('eap-session-unified-done',open&&done);card.classList.toggle('eap-session-unified-current',current);card.dataset.eapUnlocked=open?'1':'0';card.querySelectorAll('button,a,[role="button"]').forEach(btn=>{btn.disabled=!open;btn.setAttribute('aria-disabled',open?'false':'true');btn.dataset.eapLocked=open?'0':'1'});});}
function decorate(){addCss();removeOldNotes(document);normalizeStoredIfLocked();decorateRoadmap();decorateSessionGrid();}
function routeFromButton(btn){if(isActiveMissionArea(btn))return'';const explicit=btn.getAttribute('data-eap-roadmap-route')||btn.getAttribute('data-eap-roadmap-brief')||'';if(explicit)return norm(explicit);const card=btn.closest('[data-eap-roadmap-card]');if(card)return norm(card.getAttribute('data-eap-roadmap-card'));const locked=btn.closest('.session-tile.eap-session-unified-locked,.session-card.eap-session-unified-locked,.checkpoint-card.eap-session-unified-locked');if(locked){const t=clean(locked.textContent||'');const m=t.match(/SESSION\s+(1[0-5]|[1-9])/i);if(m)return'S'+Number(m[1])}return''}
function clickGuard(e){const btn=e.target&&e.target.closest&&e.target.closest('button,a,[role="button"]');if(!btn||isActiveMissionArea(btn))return;const rid=routeFromButton(btn);if(!rid||isUnlocked(rid))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toast('ยังเข้า '+rid+' ไม่ได้: '+reason(rid));}
let timer;function schedule(){clearTimeout(timer);timer=setTimeout(decorate,80)}
function start(){addCss();document.addEventListener('click',clickGuard,true);window.addEventListener('load',schedule);window.addEventListener('storage',schedule);window.addEventListener('eap:resume-synced',schedule);new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true});schedule();setInterval(decorate,900)}
window.EAPRoadmapLockGuard={version:VERSION,cloudVerifiedOnly:true,cloudSessionProgressSafe:true,hideFutureLockedProgress:true,activeMissionSafe:true,routeStatus:routeStatus,isUnlocked:isUnlocked,reason:reason,refresh:decorate,maxOpenIndex:maxOpenIndex,firstIncompleteIndex:firstIncompleteIndex,currentRoute:currentRoute};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();