/* EAP Hero Sequential Unlock Gate v20260708
   Open one route at a time: S1 first, then next route after required skills pass.
*/
(function(){
'use strict';
const VERSION='v20260708-EAP-SEQUENTIAL-UNLOCK-GATE-V1';
const PACK='EAP_HERO_SESSION_CONTENT_PACK';
const STATE='EAP_HERO_PROGRESS_V3';
const PASS=60;
const SKILLS=['reading','listening','writing','speaking'];
const PANEL='eapSeqUnlockPanel';
const TOAST='eapSeqUnlockToast';
const STYLE='eapSeqUnlockStyle';

function clean(v){return String(v==null?'':v).replace(/\s+/g,' ').trim()}
function low(v){return clean(v).toLowerCase()}
function num(v){const n=Number(v);return Number.isFinite(n)?n:0}
function data(){const d=window[PACK];return d&&Array.isArray(d.routes)?d:null}
function order(){const d=data();return d&&Array.isArray(d.routeOrder)?d.routeOrder.slice():[]}
function norm(v){const r=clean(v).toUpperCase();return /^\d+$/.test(r)?'S'+Number(r):r}
function route(id){const d=data(), k=norm(id);return d&&d.routes.find(r=>norm(r.routeId)===k)||null}
function state(){try{return JSON.parse(localStorage.getItem(STATE)||'{}')}catch(e){return {}}}
function entries(){const s=state(), out=[];['portfolio','attempts','evidence','summary','records'].forEach(k=>Array.isArray(s[k])&&out.push(...s[k]));if(s.sessions&&typeof s.sessions==='object'){Object.keys(s.sessions).forEach(k=>{const v=s.sessions[k];if(Array.isArray(v)) out.push(...v.map(x=>Object.assign({sessionId:k},x||{})));else if(v&&typeof v==='object') Object.keys(v).forEach(sk=>{const x=v[sk];if(x&&typeof x==='object') out.push(Object.assign({sessionId:k,skill:sk},x));});});}return out}
function eRoute(e){const r=e&&(e.routeId||e.sessionId||e.session||e.stage||'');return typeof r==='number'?'S'+r:norm(r)}
function eSkill(e){return low(e&&e.skill)}
function eScore(e){return Math.max(num(e&&e.bestScore),num(e&&e.latestScore),num(e&&e.score))}
function ePass(e){const raw=e&&(e.passed!==undefined?e.passed:e.pass);return raw===true||String(raw).toLowerCase()==='true'||String(raw)==='1'||eScore(e)>=PASS}
function best(){const b={};entries().forEach(e=>{const r=eRoute(e), s=eSkill(e);if(!r||!s)return;const k=r+'|'+s, sc=eScore(e), ps=ePass(e);if(!b[k]||sc>b[k].score||ps)b[k]={score:sc,passed:ps,entry:e};});return b}
function req(r){if(!r)return[];if(r.routeType==='boss_gate')return SKILLS.slice();const c=r.skillContract||{};const a=SKILLS.filter(s=>['Core','Support','Integrated'].includes(clean(c[s])));return a.length?a:['reading','writing']}
function status(id){const r=route(id), rid=norm(id);if(!r)return{routeId:rid,complete:false,missing:[]};const b=best(), required=req(r), pass=[], miss=[], scores={};required.forEach(s=>{const x=b[norm(r.routeId)+'|'+s];scores[s]=x?x.score:0;if(x&&(x.passed||x.score>=PASS))pass.push(s);else miss.push(s)});return{routeId:norm(r.routeId),routeType:r.routeType,title:r.title||'',required:required,passed:pass,missing:miss,scores:scores,complete:miss.length===0}}
function firstOpenIndex(){const o=order();for(let i=0;i<o.length;i++)if(!status(o[i]).complete)return i;return o.length}
function unlocked(id){const o=order(), i=o.indexOf(norm(id));if(i<0)return false;if(i===0)return true;return i<=firstOpenIndex()}
function reason(id){const o=order(), idx=o.indexOf(norm(id));if(idx<0)return'ไม่พบ route นี้';for(let i=0;i<idx;i++){const st=status(o[i]);if(!st.complete)return'ต้องผ่าน '+st.routeId+' ก่อน: '+st.missing.map(cap).join(' + ')+' ให้ได้อย่างน้อย 60/100'}return''}
function cap(s){return clean(s).charAt(0).toUpperCase()+clean(s).slice(1)}
function routeFromText(t){const x=clean(t);let m=x.match(/\b(B[1-5])\b/i);if(m)return m[1].toUpperCase();m=x.match(/\bS(1[0-5]|[1-9])\b/i);if(m)return'S'+Number(m[1]);m=x.match(/Session\s*(1[0-5]|[1-9])\b/i);if(m)return'S'+Number(m[1]);m=x.match(/Week\s*(1[0-5]|[1-9])\b/i);if(m)return'S'+Number(m[1]);const d=data();if(d){const lt=x.toLowerCase();for(const r of d.routes){if(r.title&&lt.includes(String(r.title).toLowerCase()))return norm(r.routeId)}}return''}
function addCss(){if(document.getElementById(STYLE))return;const s=document.createElement('style');s.id=STYLE;s.textContent='.eap-route-locked{opacity:.48;filter:grayscale(.25);cursor:not-allowed!important}.eap-route-locked:after{content:" 🔒 ต้องผ่านด่านก่อน";display:inline-block;margin-left:6px;padding:3px 7px;border-radius:999px;background:#fff4d8;color:#9a6700;font:800 11px Arial,"Noto Sans Thai",sans-serif}.eap-route-unlocked:after{content:" ✓ เปิดแล้ว";display:inline-block;margin-left:6px;padding:3px 7px;border-radius:999px;background:#e7f8ef;color:#087f5b;font:800 11px Arial,"Noto Sans Thai",sans-serif}#'+PANEL+'{margin:10px 0 14px;padding:12px 14px;border:1px solid #cfe0ee;border-radius:14px;background:#f8fbff;color:#102033;font:13px Arial,"Noto Sans Thai",sans-serif}#'+PANEL+' strong{font-weight:900}#'+PANEL+' .small{color:#5d7088;font-size:12px;margin-top:4px}#'+TOAST+'{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:999999;max-width:min(620px,calc(100vw - 28px));padding:13px 16px;border-radius:14px;background:#7c2d12;color:#fff;box-shadow:0 14px 35px rgba(0,0,0,.25);font:800 13px Arial,"Noto Sans Thai",sans-serif;text-align:center}';document.head.appendChild(s)}
function toast(msg){let n=document.getElementById(TOAST);if(!n){n=document.createElement('div');n.id=TOAST;document.body.appendChild(n)}n.textContent=msg;clearTimeout(toast.t);toast.t=setTimeout(()=>{if(n&&n.parentNode)n.remove()},4200)}
function panel(){const app=document.getElementById('app'),o=order();if(!app||!o.length)return;const idx=Math.min(firstOpenIndex(),o.length-1), cur=o[idx], st=status(cur);let p=document.getElementById(PANEL);if(!p){p=document.createElement('section');p.id=PANEL;(app.querySelector('.session-path-panel')||app.querySelector('section.panel')||app.querySelector('section')||app).insertAdjacentElement('afterbegin',p)}const miss=st.complete?'ครบแล้ว':st.missing.map(cap).join(' + ');p.innerHTML='<strong>ระบบปลดล็อกทีละด่าน:</strong> ด่านปัจจุบัน '+cur+' · ผ่านแล้ว '+Math.max(0,idx)+'/'+o.length+'<div class="small">Session ปกติผ่าน Core + Support ≥ 60/100 · Boss Gate ผ่านหลักฐานครบทุก integrated skill</div><div class="small">ยังต้องทำ: '+miss+'</div>'}
function decorate(){addCss();panel();document.querySelectorAll('#app button,#app a,#app [role="button"]').forEach(n=>{const t=clean(n.textContent||n.getAttribute('aria-label')||'');if(!/(\bS\d+\b|\bB[1-5]\b|Session\s*\d+|Week\s*\d+)/i.test(t))return;const r=routeFromText(t);if(!r||order().indexOf(r)<0)return;const lock=!unlocked(r);n.classList.toggle('eap-route-locked',lock);n.classList.toggle('eap-route-unlocked',!lock);n.dataset.eapRouteId=r;n.dataset.eapLocked=lock?'1':'0';if(lock)n.setAttribute('aria-disabled','true');else n.removeAttribute('aria-disabled')})}
function click(e){const n=e.target&&e.target.closest&&e.target.closest('#app button,#app a,#app [role="button"]');if(!n)return;const r=n.dataset.eapRouteId||routeFromText(n.textContent||n.getAttribute('aria-label')||'');if(!r||order().indexOf(r)<0)return;if(!unlocked(r)){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();toast('ล็อกไว้ก่อน: '+reason(r))}}
let timer;function sched(){clearTimeout(timer);timer=setTimeout(decorate,120)}
function start(){addCss();document.addEventListener('click',click,true);window.addEventListener('load',sched);window.addEventListener('storage',sched);new MutationObserver(sched).observe(document.documentElement,{childList:true,subtree:true,characterData:true});sched()}
window.EAPSequentialUnlockGate={version:VERSION,routeStatus:status,isUnlocked:unlocked,nextLockedReason:reason,firstIncompleteRoute:function(){const o=order();return o[Math.min(firstOpenIndex(),o.length-1)]||''},refresh:decorate};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();