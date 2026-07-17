(()=>{'use strict';
const KEY='HHA_GROUPS_AR_PENDING_QUEUE_V1',SENT='HHA_GROUPS_AR_SENT_ATTEMPTS_V1';
const q=new URLSearchParams(location.search),api=q.get('api')||'';
const delivery=document.getElementById('delivery');
function load(k,d){try{return JSON.parse(localStorage.getItem(k)||JSON.stringify(d))}catch(_){return d}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(_){}}
function queued(){return load(KEY,[])}
function sent(){return new Set(load(SENT,[]))}
function markSent(id){const a=[...sent(),id].slice(-300);save(SENT,a)}
function enqueue(r){if(!r||!r.attemptId)return;const s=sent();if(s.has(r.attemptId))return;const a=queued();if(!a.some(x=>x.attemptId===r.attemptId))a.push(r);save(KEY,a.slice(-30))}
async function post(r){if(!api)throw new Error('missing api');await fetch(api,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(r),cache:'no-store',keepalive:true});}
async function flush(){const a=queued();if(!a.length)return;delivery&&(delivery.textContent='กำลังส่งผลเข้า Google Sheet...');const left=[];for(const r of a){try{await post(r);markSent(r.attemptId)}catch(_){left.push(r)}}save(KEY,left);if(delivery)delivery.textContent=left.length?'เครือข่ายไม่พร้อม • เก็บผลไว้รอส่งอัตโนมัติ':'✅ ส่งผลเข้า Google Sheet แล้ว';}
function capture(){const r=load('HHA_GROUPS_AR_LAST_RESULT',null);if(r){enqueue(r);flush()}}
const mo=new MutationObserver(()=>{const s=document.getElementById('summary');if(s&&!s.classList.contains('hidden'))setTimeout(capture,100)});mo.observe(document.documentElement,{subtree:true,attributes:true,attributeFilter:['class']});
window.addEventListener('online',flush);window.addEventListener('pageshow',flush);setTimeout(flush,800);
})();