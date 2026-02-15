// === /herohealth/api/hub-api-guard.js ===
// HUB API Guard: probe endpoint + update HUB banner (apiBanner)
// Works with: #apiBanner #apiDot #apiTitle #apiMsg

'use strict';

import { isRemoteDisabled, disabledInfo, clearDisable } from './api-status.js';
import { probeApi } from './api-probe.js';

function el(id){ return document.getElementById(id); }

function setDot(kind){
  const d = el('apiDot');
  if(!d) return;
  d.classList.remove('ok','warn','bad');
  d.classList.add(kind);
}

function setBanner({ title, msg, kind='warn' }){
  if(el('apiTitle')) el('apiTitle').textContent = title || '';
  if(el('apiMsg')) el('apiMsg').textContent = msg || '';
  setDot(kind);
}

export async function guardApi({ uri }){
  if(!uri){
    setBanner({
      kind:'warn',
      title:'ไม่มี API URI',
      msg:'ไม่ได้ตั้งค่า endpoint — จะทำงานแบบ Offline'
    });
    return { ok:false, status:0, reason:'missing_uri' };
  }

  // If this tab already disabled remote (403/401)
  if(isRemoteDisabled()){
    const info = disabledInfo();
    setBanner({
      kind:'bad',
      title:`Offline mode (API ${info.code || 403})`,
      msg:'ระบบบล็อก endpoint ชั่วคราวในแท็บนี้ — เข้าเกมได้ปกติ, จะไม่ยิงซ้ำให้แดง'
    });
    return { ok:false, status: info.code || 403, reason:'disabled' };
  }

  setBanner({
    kind:'warn',
    title:'กำลังตรวจสอบระบบ…',
    msg:'ถ้า API ล่ม/403 หน้า HUB จะยังใช้งานได้ปกติ (เข้าเกมได้ทุกเกม)'
  });

  const r = await probeApi({ uri });

  if(r.ok){
    setBanner({
      kind:'ok',
      title:'Online',
      msg:'เชื่อมต่อ API สำเร็จ • ถ้าเป็น research/logging จะส่งข้อมูลได้'
    });
    return r;
  }

  if(r.status === 401 || r.status === 403){
    // probeApi already called disableRemote for 401/403
    setBanner({
      kind:'bad',
      title:`Offline mode (API ${r.status})`,
      msg:'ถูกปฏิเสธสิทธิ์ (Forbidden) • HUB/เกมยังเล่นได้ปกติ • logging จะถูกปิด'
    });
    return r;
  }

  setBanner({
    kind:'warn',
    title:'Offline fallback',
    msg:'API ไม่พร้อมใช้งานชั่วคราว • HUB/เกมยังเล่นได้ปกติ'
  });
  return r;
}

// helper for Retry button
export async function retryGuard({ uri }){
  // allow probe again (only clears the disable window if it had expired/was set)
  clearDisable();
  return guardApi({ uri });
}
