// === /herohealth/vr-goodjunk/goodjunk-vr.boot.js ===
// GoodJunkVR Boot — HHA Standard

'use strict';

import { boot as goodjunkBoot } from './goodjunk.safe.js';
import { attachTouchLook } from './touch-look-goodjunk.js';

function qp(name, fallback = null){
  try{
    const u = new URL(location.href);
    const v = u.searchParams.get(name);
    return (v == null || v === '') ? fallback : v;
  }catch(_){ return fallback; }
}

function toInt(v, d){ v = Number(v); return Number.isFinite(v) ? (v|0) : d; }
function toStr(v, d){ v = String(v ?? '').trim(); return v ? v : d; }

function buildContext(){
  const keys = [
    'projectTag','studyId','phase','conditionGroup','sessionOrder','blockLabel','siteCode',
    'schoolYear','semester','studentKey','schoolCode','schoolName','classRoom','studentNo',
    'nickName','gender','age','gradeLevel','heightCm','weightKg','bmi','bmiGroup',
    'vrExperience','gameFrequency','handedness','visionIssue','healthDetail','consentParent',
    'gameVersion'
  ];
  const ctx = {};
  for (const k of keys){
    const v = qp(k, null);
    if (v != null) ctx[k] = v;
  }
  ctx.projectTag = ctx.projectTag || 'GoodJunkVR';
  ctx.gameVersion = ctx.gameVersion || 'goodjunk-vr.2025-12-28';
  return ctx;
}

function showStartOverlay(metaText){
  const overlay = document.getElementById('startOverlay');
  const btn = document.getElementById('btnStart');
  const meta = document.getElementById('startMeta');
  if (meta) meta.textContent = metaText || '—';
  if (!overlay || !btn) return Promise.resolve();

  overlay.style.display = 'flex';
  return new Promise((resolve) => {
    btn.onclick = () => {
      overlay.style.display = 'none';
      resolve();
    };
  });
}

function setHudMeta(text){
  const el = document.getElementById('hudMeta');
  if (el) el.textContent = text;
}

(async function main(){
  const diff = toStr(qp('diff', 'normal'), 'normal').toLowerCase();
  const time = toInt(qp('time', '80'), 80);
  const run = toStr(qp('run', 'play'), 'play').toLowerCase();
  const endPolicy = toStr(qp('end', 'time'), 'time').toLowerCase();
  const challenge = toStr(qp('challenge', 'rush'), 'rush').toLowerCase();

  const seed = qp('seed', null);
  const sessionId = qp('sessionId', null) || qp('sid', null);

  const ctx = buildContext();

  setHudMeta(`diff=${diff} • run=${run} • end=${endPolicy} • ${challenge}`);

  // ✅ Touch/Mouse look -> world shift (DO NOT move crosshair; only shift layer/ring/laser)
  const look = attachTouchLook({
    stage: '#gj-stage',
    layer: '#gj-layer',
    ring:  '#atk-ring',
    laser: '#atk-laser',

    // feel: นุ่ม ๆ แต่ไม่หน่วงเกิน (เหมาะ ป.5)
    maxShiftPx: 170,
    gain: 0.24,        // ความไวตอนลาก
    friction: 0.86,    // หน่วง
    spring: 0.18,      // เด้งกลับกลาง

    // gyro: auto เฉพาะมือถือ (override ด้วย ?gyro=1|0)
    // enableGyro: undefined
  });

  // optional: กดปุ่มยิงค้าง/ยิงถี่ ๆ ไม่ควรทำให้โลกไหล (ป้องกันซ้ำซ้อน)
  // ถ้าต้องการรีเซ็นเตอร์จาก UI เพิ่มเองทีหลัง: look.recenter(true);

  const metaText =
    `diff=${diff} • run=${run} • time=${time}s • end=${endPolicy} • ${challenge}` +
    (seed ? ` • seed=${seed}` : '');

  await showStartOverlay(metaText);

  // boot engine
  goodjunkBoot({
    diff,
    time,
    run,
    endPolicy,
    challenge,
    seed,
    sessionId,
    context: ctx,
    layerEl: document.getElementById('gj-layer'),
    shootEl: document.getElementById('btnShoot'),
    safeMargins: { top: 128, bottom: 170, left: 26, right: 26 }
  });
})();
