// === /herohealth/api/index.js ===
// HeroHealth API Hub — all-in-one helper
// ✅ Central config + probe + status + apollo client safe
// Requires:
//   - ./api-status.js (sets window.HHA_API_STATUS)
//   - ./apolloClient.safe.js (exports getApolloClient)

'use strict';

import { getApolloClient } from './apolloClient.safe.js';

const WIN = window;

function normUrl(u){
  try { return String(u || '').trim(); } catch { return ''; }
}

function getEndpoint(){
  // priority: runtime override -> window -> default
  const ep = normUrl(WIN.HHA_API_ENDPOINT || '');
  return ep || 'https://sfd8q2ch3k.execute-api.us-east-2.amazonaws.com/'; // default (คุณเปลี่ยนได้)
}

function setStatus(s){
  try{
    if(WIN.HHA_API_STATUS && typeof WIN.HHA_API_STATUS.set === 'function'){
      WIN.HHA_API_STATUS.set(s);
    }else{
      WIN.dispatchEvent(new CustomEvent('hha:api-status', { detail: s }));
    }
  }catch(_){}
}

// ---- Probe API (403-safe) ----
// NOTE: หาก endpoint จริงคือ /graphql ให้ส่ง opts.path='/graphql'
export async function probe({ endpoint, path='', timeoutMs=3500 } = {}){
  const base = normUrl(endpoint) || getEndpoint();
  const url = path ? new URL(path, base).toString() : base;

  const ctrl = new AbortController();
  const t = setTimeout(()=> ctrl.abort(), Math.max(800, timeoutMs|0));

  setStatus({
    level:'warn',
    title:'กำลังตรวจสอบระบบ…',
    msg:'กำลัง ping API แบบสั้น ๆ (ถ้า 403 จะใช้โหมดออฟไลน์)',
    detail:`endpoint: ${url}`,
    endpoint: url,
    ts: Date.now()
  });

  try{
    const res = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'content-type':'application/json' },
      body: JSON.stringify({ ping:true, ts: Date.now() }),
      signal: ctrl.signal
    });

    if(res.status === 200){
      setStatus({
        level:'ok',
        title:'ออนไลน์ ✅',
        msg:'API ตอบกลับปกติ (Hub ใช้งานเต็มรูปแบบ)',
        detail:`endpoint: ${url}`,
        endpoint: url,
        ts: Date.now()
      });
      return { ok:true, status:200, endpoint:url };
    }

    if(res.status === 403){
      setStatus({
        level:'bad',
        title:'403 Forbidden ⚠️',
        msg:'API ปฏิเสธสิทธิ์/Origin แต่ Hub/เกมยังเข้าได้ปกติ',
        detail:[
          `endpoint: ${url}`,
          `status: 403`,
          `hint: ตรวจ CORS/Authorizer/IAM`,
          `ควร allow Origin: https://supparang.github.io`,
        ].join('\n'),
        endpoint: url,
        ts: Date.now()
      });
      return { ok:false, status:403, endpoint:url };
    }

    setStatus({
      level:'warn',
      title:`API ตอบ ${res.status}`,
      msg:'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจ route/headers',
      detail:`endpoint: ${url}\nstatus: ${res.status}`,
      endpoint: url,
      ts: Date.now()
    });
    return { ok:false, status:res.status, endpoint:url };

  }catch(err){
    const aborted = (err?.name === 'AbortError');
    setStatus({
      level:'bad',
      title: aborted ? 'Timeout / ออฟไลน์' : 'ออฟไลน์/เชื่อมต่อไม่ได้',
      msg:'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจเครือข่าย/CORS',
      detail:`endpoint: ${url}\nerror: ${String(err?.message || err)}`,
      endpoint: url,
      ts: Date.now()
    });
    return { ok:false, status:0, endpoint:url, error: err };
  }finally{
    clearTimeout(t);
  }
}

// ---- Apollo client getter ----
export function getClient({ endpoint, headers } = {}){
  const ep = normUrl(endpoint) || getEndpoint();
  return getApolloClient({ endpoint: ep, headers: headers || {} });
}

// ---- Banner binder shortcut ----
export function bindHubBanner({ dotEl, titleEl, msgEl, detailEl, retryEl, onRetry } = {}){
  if(WIN.HHA_API_STATUS?.bindBanner){
    return WIN.HHA_API_STATUS.bindBanner({
      dotEl, titleEl, msgEl, detailEl, retryEl,
      onRetry: onRetry || (()=> probe({}))
    });
  }
  // fallback: no-op
  return ()=>{};
}

// ---- Utility: expose endpoint for debugging ----
export function getConfig(){
  return { endpoint: getEndpoint() };
}