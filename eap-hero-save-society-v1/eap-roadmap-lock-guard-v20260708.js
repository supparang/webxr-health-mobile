/* =========================================================
   EAP Hero Roadmap Lock Guard v20260708
   V2 STRICT SEQUENTIAL
   - Locks 15-week roadmap cards/buttons directly.
   - No top overlay, no compact map, no weekly default route.
   - Only the current route is open. The next route opens after the current route passes.
   - Older routes remain open for review/replay.
========================================================= */
(function(){
'use strict';

const VERSION='v20260708-EAP-ROADMAP-LOCK-GUARD-V2-STRICT-SEQUENTIAL';
const PACK='EAP_HERO_SESSION_CONTENT_PACK';
const STATE='EAP_HERO_PROGRESS_V3';
const PASS=60;
const SKILLS=['reading','listening','writing','speaking'];
const STYLE='eapRoadmapStrictLockStyle';
const TOAST='eapRoadmapStrictLockToast';

function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function lower(v){return clean(v).toLowerCase()}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function cap(v){const s=clean(v);return s.charAt(0).toUpperCase()+s.slice(1)}
function norm(v){const raw=clean(v).toUpperCase();return /^\d+$/.test(raw)?'S'+Number(raw):raw}
function pack(){const d=window[PACK];return d&&Array.isArray(d.routes)?d:null}
function routeList(){const d=pack();if(!d)return[];const order=Array.isArray(d.routeOrder)&&d.routeOrder.length?d.routeOrder:d.routes.map(r=>r.routeId);return order.map(id=>d.routes.find(r=>norm(r.routeId)===norm(id))).filter(Boolean)}
function routeById(id){const k=norm(id);return routeList().find(r=>norm(r.routeId)===k)||null}
function routeIndex(id){return routeList().findIndex(r=>norm(r.routeId)===norm(id))}
function sessionNo(route){const m=clean(route&&route.routeId).match(/^S(\d+)$/i);return m?Number(m[1]):0}

function readState(){try{return JSON.parse(localStorage.getItem(STATE)||'{}')}catch(e){return {}}}
function entries(){const s=readState(),out=[];['portfolio','attempts','evidence','summary','records'].forEach(k=>{if(Array.isArray(s[k]))out.push.apply(out,s[k])});if(s.sessions&&typeof s.sessions==='object'){Object.keys(s.sessions).forEach(k=>{const v=s.sessions[k];if(Array.isArray(v))v.forEach(x=>out.push(Object.assign({sessionId:k},x||{})));else if(v&&typeof v==='object')Object.keys(v).forEach(sk=>{const x=v[sk];if(x&&typeof x==='object')out.push(Object.assign({sessionId:k,skill:sk},x));});});}return out}
function entryRoute(e){const r=e&&(e.routeId||e.sessionId||e.session||e.stage||'');return typeof r==='number'?'S'+r:norm(r)}
function entrySkill(e){return lower(e&&e.skill)}
function entryScore(e){return Math.max(num(e&&e.bestScore),num(e&&e.latestScore),num(e&&e.score),num(e&&e.stars)>=3?100:0)}
function entryPass(e){const raw=e&&(e.passed!==undefined?e.passed:e.pass);return raw===true||String(raw).toLowerCase()==='true'||String(raw)==='1'||entryScore(e)>=PASS}
function best(){const b={};entries().forEach(e=>{const r=entryRoute(e),s=entrySkill(e);if(!r||!s)return;const k=r+'|'+s,sc=entryScore(e),ps=entryPass(e);if(!b[k]||sc>b[k].score||ps)b[k]={score:sc,passed:ps}});return b}
function required(route){if(!route)return[];if(route.routeType==='boss_gate')return SKILLS.slice();const c=route.skillContract||{};const req=SKILLS.filter(s=>['Core','Support','Integrated'].indexOf(clean(c[s]))>=0);return req.length?req:['reading','writing']}
function routeStatus(id){const r=routeById(id);if(!r)return{routeId:norm(id),complete:false,required:[],passed:[],missing:[],scores:{}};const rid=norm(r.routeId),b=best(),req=required(r),passed=[],missing=[],scores={};req.forEach(s=>{const item=b[rid+'|'+s];scores[s]=item?item.score:0;if(item&&(item.passed||item.score>=PASS))passed.push(s);else missing.push(s)});return{routeId:rid,routeType:r.routeType,title:r.title||'',complete:missing.length===0,required:req,passed:passed,missing:missing,scores:scores}}

function storedRoute(){const q=new URLSearchParams(location.search);const url=norm(q.get('route')||q.get('session')||q.get('stage')||'');if(url)return url;const keys=['EAP_HERO_ACTIVE_ROUTE','EAP_HERO_CURRENT_ROUTE','EAP_HERO_CURRENT_SESSION','EAP_ACTIVE_SESSION'];for(const k of keys){try{const raw=clean(localStorage.getItem(k));if(raw)return norm(raw)}catch(e){}}return 'S1'}
function setActive(id){const rid=norm(id)||'S1';try{localStorage.setItem('EAP_HERO_ACTIVE_ROUTE',rid);localStorage.setItem('EAP_HERO_CURRENT_ROUTE',rid);const m=rid.match(/^S(\d+)$/i);if(m)localStorage.setItem('EAP_HERO_CURRENT_SESSION',String(Number(m[1])))}catch(e){}}
function currentIndex(){let idx=routeIndex(storedRoute());if(idx<0)idx=0;return idx}
function maxOpenIndex(){const list=routeList();if(!list.length)return 0;let idx=currentIndex();const st=routeStatus(list[idx].routeId);if(st.complete)idx=Math.min(idx+1,list.length-1);return idx}
function isUnlocked(id){const idx=routeIndex(id);return idx>=0&&idx<=maxOpenIndex()}
function reason(id){const list=routeList(),idx=routeIndex(id),max=maxOpenIndex();if(idx<0)return'ไม่พบด่านนี้';const current=list[Math.min(currentIndex(),list.length-1)];const st=routeStatus(current.routeId);if(idx>max){return st.complete?'ต้องเข้า '+norm(list[max].routeId)+' ก่อน':'ต้องผ่าน '+norm(current.routeId)+' ก่อน: '+st.missing.map(cap).join(' + ')+' ≥ 60/100'}return''}
function normalizeActiveIfTooFar(){const list=routeList();if(!list.length)return false;const cur=currentIndex(),max=maxOpenIndex();if(cur>max){setActive(list[max].routeId);return true}return false}

function addCss(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent=`
#eap-student-15week-roadmap .rm-card.eap-locked{opacity:.46!important;filter:grayscale(.28)!important;background:#f8fafc!important;border-style:dashed!important;box-shadow:none!important}
#eap-student-15week-roadmap .rm-card.eap-locked button{background:#e5e7eb!important;color:#64748b!important;cursor:not-allowed!important;pointer-events:none!important}
#eap-student-15week-roadmap .rm-card.eap-done{border-color:#99f6e4!important;box-shadow:0 0 0 2px rgba(20,184,166,.14)!important}
#eap-student-15week-roadmap .rm-card.eap-current{border-color:#10b981!important;box-shadow:0 0 0 3px rgba(16,185,129,.16)!important}
#eap-student-15week-roadmap .eap-lock-note{font-size:11px;font-weight:950;color:#9a6700;line-height:1.35;margin-top:2px}
#eap-student-15week-roadmap .eap-done-note{font-size:11px;font-weight:950;color:#087f5b;line-height:1.35;margin-top:2px}
#${TOAST}{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:999999;max-width:min(620px,calc(100vw - 28px));padding:13px 16px;border-radius:14px;background:#7c2d12;color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.25);font:800 13px Arial,'Noto Sans Thai',sans-serif;text-align:center}
`;document.head.appendChild(s)}
function toast(msg){let n=document.getElementById(TOAST);if(!n){n=document.createElement('div');n.id=TOAST;document.body.appendChild(n)}n.textContent=msg;clearTimeout(toast.t);toast.t=setTimeout(()=>{if(n&&n.parentNode)n.remove()},4200)}
function setNote(card,cls,text){let n=card.querySelector('.eap-lock-note,.eap-done-note');if(!text){if(n)n.remove();return}if(!n){n=document.createElement('div');const a=card.querySelector('.rm-actions');if(a)a.insertAdjacentElement('beforebegin',n);else card.appendChild(n)}n.className=cls;n.textContent=text}
function decorate(){addCss();normalizeActiveIfTooFar();const curIdx=currentIndex();document.querySelectorAll('[data-eap-roadmap-card]').forEach(card=>{const rid=norm(card.getAttribute('data-eap-roadmap-card')),idx=routeIndex(rid),st=routeStatus(rid),open=isUnlocked(rid),done=st.complete,current=idx===curIdx||idx===maxOpenIndex()&&!done;card.classList.toggle('eap-locked',!open);card.classList.toggle('eap-done',open&&done);card.classList.toggle('eap-current',open&&!done&&idx===maxOpenIndex());card.dataset.eapUnlocked=open?'1':'0';card.dataset.eapComplete=done?'1':'0';card.querySelectorAll('[data-eap-roadmap-route],[data-eap-roadmap-brief]').forEach(btn=>{btn.disabled=!open;btn.setAttribute('aria-disabled',open?'false':'true');btn.dataset.eapLocked=open?'0':'1'});if(!open)setNote(card,'eap-lock-note','🔒 ล็อกไว้ก่อน · '+reason(rid));else if(done)setNote(card,'eap-done-note','✓ ผ่านเกณฑ์แล้ว · ย้อนทบทวนได้');else setNote(card,'eap-lock-note','🎯 ด่านปัจจุบัน · ต้องผ่าน '+st.missing.map(cap).join(' + ')+' ≥ 60/100');});}
function clickGuard(e){const btn=e.target&&e.target.closest&&e.target.closest('[data-eap-roadmap-route],[data-eap-roadmap-brief]');if(!btn)return;const rid=norm(btn.getAttribute('data-eap-roadmap-route')||btn.getAttribute('data-eap-roadmap-brief'));if(!rid||isUnlocked(rid))return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toast('ยังเข้า '+rid+' ไม่ได้: '+reason(rid));}
let timer;function schedule(){clearTimeout(timer);timer=setTimeout(decorate,80)}
function start(){addCss();document.addEventListener('click',clickGuard,true);window.addEventListener('load',schedule);window.addEventListener('storage',schedule);new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true,characterData:true,attributes:true});schedule();setInterval(decorate,900)}
window.EAPRoadmapLockGuard={version:VERSION,routeStatus:routeStatus,isUnlocked:isUnlocked,reason:reason,refresh:decorate,maxOpenIndex:maxOpenIndex,currentIndex:currentIndex};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();