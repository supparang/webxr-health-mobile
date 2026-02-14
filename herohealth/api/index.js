// === /herohealth/api/index.js ===
// Hub API utilities (403-safe)
// Exposes:
//   window.HHA_API_STATUS (toast + status setter)
//   window.HHA_API.initHub({ endpoint, dom })
//
// This file is ESM (module). Import it once in hub.boot.js.

'use strict';

import { createStatus } from './api-status.js';
import { probe } from './api-probe.js';
import { createSafeClient } from './apolloClient.safe.js';

(function initGlobals(){
  const W = window;

  // status UI controller (lazy created)
  let statusCtrl = null;

  function ensureStatus(dom){
    if(statusCtrl) return statusCtrl;
    statusCtrl = createStatus(dom || {});
    return statusCtrl;
  }

  // public status
  W.HHA_API_STATUS = {
    set(state, title, msg){
      try{ ensureStatus().set(state, title, msg); }catch{}
    },
    ok(title, msg){ try{ ensureStatus().ok(title, msg); }catch{} },
    warn(title, msg){ try{ ensureStatus().warn(title, msg); }catch{} },
    bad(title, msg){ try{ ensureStatus().bad(title, msg); }catch{} },
    toast(msg, ms){ try{ ensureStatus().toast(msg, ms); }catch{} }
  };

  // public hub init
  W.HHA_API = W.HHA_API || {};

  /**
   * initHub({ endpoint, dom:{dotId,titleId,msgId,retryId}, timeoutMs })
   * - probe endpoint and update banner
   * - bind retry click
   * - also prepares a "safe client" at window.HHA_API.client
   */
  W.HHA_API.initHub = function initHub(opts={}){
    const endpoint = String(opts.endpoint || '').trim();
    const dom = opts.dom || {};
    const timeoutMs = Number(opts.timeoutMs || 5500);

    const ui = ensureStatus(dom);
    ui.warn('กำลังตรวจสอบระบบ…', 'กำลัง ping API แบบสั้น ๆ (ถ้า 403 จะใช้โหมดออฟไลน์)');

    // Create client early (safe)
    try{
      W.HHA_API.client = createSafeClient({
        endpoint,
        preferApollo: false, // safest default
        onStatus: ({state,title,msg})=> ui.set(state, title, msg)
      });
    }catch(_){
      W.HHA_API.client = null;
    }

    async function runProbe(){
      ui.warn('กำลังตรวจสอบระบบ…', 'กำลัง ping API แบบสั้น ๆ (ถ้า 403 จะใช้โหมดออฟไลน์)');
      const r = await probe(endpoint, { timeoutMs });

      if(r.ok){
        ui.ok('ออนไลน์ ✅', `API ตอบกลับปกติ (${r.elapsedMs}ms)`);
      }else if(r.status === 403){
        ui.bad('403 Forbidden ⚠️', 'API ปฏิเสธสิทธิ์/Origin แต่ Hub ยังเข้าเกมได้ปกติ — แนะนำแก้ CORS/Authorizer');
      }else if(r.hint === 'timeout'){
        ui.bad('Timeout ⏱️', 'API ตอบช้า/ไม่ตอบ • Hub เข้าเกมได้ปกติ');
      }else if(r.hint === 'network'){
        ui.bad('ออฟไลน์/เชื่อมต่อไม่ได้', 'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจเครือข่าย/CORS');
      }else if(r.status){
        ui.warn(`API ตอบ ${r.status}`, 'Hub เข้าเกมได้ปกติ • ถ้าต้องใช้ API ให้ตรวจ route/headers');
      }else{
        ui.warn('ตรวจสอบไม่สำเร็จ', 'Hub เข้าเกมได้ปกติ • ตรวจ endpoint/route');
      }
    }

    // bind retry
    const retryEl = ui.el.retryEl;
    if(retryEl){
      // avoid double bind by cloning
      try{
        const n = retryEl.cloneNode(true);
        retryEl.parentNode.replaceChild(n, retryEl);
        n.addEventListener('click', (e)=>{
          e.preventDefault();
          runProbe();
        });
      }catch(_){}
    }

    // initial
    runProbe();
  };

})();