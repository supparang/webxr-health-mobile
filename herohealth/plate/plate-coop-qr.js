/* === /herohealth/plate/plate-coop-qr.js ===
   HeroHealth Plate Coop QR Helper
   PATCH v20260321-PLATE-COOP-QR
*/
'use strict';

function esc(s=''){
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function normalizeUrl(url=''){
  try{
    return new URL(String(url || ''), location.href).toString();
  }catch(_){
    return '';
  }
}

export function clearRoomQr(mount){
  if(!mount) return;
  mount.innerHTML = `
    <div style="text-align:center;display:grid;gap:8px;">
      <div style="font-weight:1000;">QR code จะแสดงตรงนี้เมื่อสร้างห้องแล้ว</div>
      <div style="font-size:12px;opacity:.8;">สแกนจากอีกเครื่องเพื่อ join room</div>
    </div>
  `;
}

export function renderRoomQr(mount, joinUrl, opts = {}){
  if(!mount) return;

  const url = normalizeUrl(joinUrl);
  if(!url){
    clearRoomQr(mount);
    return;
  }

  const size = Math.max(160, Math.min(320, Number(opts.size || 220)));
  const label = String(opts.label || 'Scan to Join');

  // ใช้บริการ QR image แบบง่ายสำหรับ prototype
  const qrSrc =
    `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(url)}`;

  mount.innerHTML = `
    <div style="display:grid;gap:10px;justify-items:center;text-align:center;">
      <img
        src="${esc(qrSrc)}"
        alt="Room QR"
        width="${size}"
        height="${size}"
        style="display:block;width:${size}px;height:${size}px;border-radius:12px;background:#fff;padding:10px;"
        loading="eager"
        referrerpolicy="no-referrer"
      />
      <div style="font-weight:1000;">${esc(label)}</div>
      <div style="font-size:12px;line-height:1.5;opacity:.82;word-break:break-all;">
        ${esc(url)}
      </div>
    </div>
  `;
}

export function updateJoinUrlText(el, joinUrl){
  if(!el) return;
  const url = normalizeUrl(joinUrl);
  el.textContent = url ? `join url: ${url}` : 'join url: -';
}