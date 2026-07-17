/* =========================================================
   HeroHealth Food Groups Launcher • Additive Camera AR Card
   PATCH: v20260717-groups-camera-ar-additive-r1
   Keeps every existing launcher mode and route intact.
========================================================= */
(function(){
  'use strict';

  var PATCH_ID = 'v20260717-groups-camera-ar-additive-r1';
  if (window.__HHA_GROUPS_CAMERA_AR_ADDITIVE_R1__) return;
  window.__HHA_GROUPS_CAMERA_AR_ADDITIVE_R1__ = true;

  var q = new URLSearchParams(location.search);

  function copyParams(url){
    [
      'pid','name','studentId','studentName','section','classSection',
      'studyId','conditionGroup','api','log','teacher','debug','seed',
      'diff','time','view'
    ].forEach(function(k){
      var v = q.get(k);
      if (v !== null && v !== '') url.searchParams.set(k, v);
    });

    url.searchParams.set('pid', q.get('pid') || q.get('studentId') || 'anon');
    url.searchParams.set('name', q.get('name') || q.get('studentName') || 'Hero');
    url.searchParams.set('zone', 'nutrition');
    url.searchParams.set('game', 'groups');
    url.searchParams.set('gameId', 'groups');
    url.searchParams.set('hub', new URL('./nutrition-zone.html', location.href).toString());
    return url;
  }

  function buildWarmupUrl(){
    var game = copyParams(new URL('./groups-ar.html', location.href));
    var zone = copyParams(new URL('./nutrition-zone.html', location.href));
    var gate = copyParams(new URL('./groups-ar-gate.html', location.href));

    gate.searchParams.set('phase', 'warmup');
    gate.searchParams.set('next', game.toString());
    gate.searchParams.set('back', zone.toString());
    gate.searchParams.set('entry', 'groups-vr-camera-ar-card');
    return gate.toString();
  }

  function buildCheckUrl(){
    var u = copyParams(new URL('./vr-groups/groups-ar-check-v2.html', location.href));
    u.searchParams.set('entry', 'groups-vr-device-check');
    return u.toString();
  }

  function buildTeacherUrl(){
    return copyParams(new URL('./groups-ar-teacher.html', location.href)).toString();
  }

  function addStyle(){
    if (document.getElementById('hhaGroupsArAdditiveStyle')) return;
    var style = document.createElement('style');
    style.id = 'hhaGroupsArAdditiveStyle';
    style.textContent = [
      '.hhaGroupsArSection{background:rgba(255,255,255,.84);border:3px solid rgba(126,217,87,.7);border-radius:36px;box-shadow:0 18px 50px rgba(37,89,121,.14);padding:clamp(18px,2.8vw,28px);margin:22px 0}',
      '.hhaGroupsArHead{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:16px}',
      '.hhaGroupsArHead h2{margin:0;font-size:clamp(28px,4vw,48px);color:#214f64}',
      '.hhaGroupsArHead p{margin:6px 0 0;color:#6f8fa1;font-weight:850}',
      '.hhaGroupsArBadge{padding:7px 12px;border-radius:999px;background:#efffea;color:#2f7a31;border:2px solid rgba(126,217,87,.65);font-weight:1000;white-space:nowrap}',
      '.hhaGroupsArGrid{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(240px,.6fr);gap:14px}',
      '.hhaGroupsArCard{border:3px solid #72d68a;border-radius:28px;background:linear-gradient(135deg,#efffea,#eef8ff);padding:18px;display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:15px;align-items:center}',
      '.hhaGroupsArIcon{width:82px;height:82px;border-radius:26px;display:grid;place-items:center;font-size:44px;background:linear-gradient(135deg,#d8ffe1,#73e099)}',
      '.hhaGroupsArCard h3{margin:0;color:#214f64;font-size:clamp(24px,3vw,36px)}',
      '.hhaGroupsArCard p{margin:6px 0 0;color:#58798a;font-weight:850;line-height:1.4}',
      '.hhaGroupsArFlow{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}',
      '.hhaGroupsArFlow span{padding:5px 9px;border-radius:999px;background:#fff;color:#34708e;border:1px solid #bfe7f9;font-size:12px;font-weight:950}',
      '.hhaGroupsArActions{display:flex;flex-direction:column;gap:8px}',
      '.hhaGroupsArBtn{border:0;border-radius:999px;min-height:52px;padding:11px 18px;font:1000 17px system-ui,-apple-system,"Segoe UI",sans-serif;cursor:pointer;white-space:nowrap}',
      '.hhaGroupsArBtn.primary{background:linear-gradient(135deg,#7ed957,#52c94b);color:#173d22;box-shadow:0 12px 26px rgba(82,201,75,.22)}',
      '.hhaGroupsArBtn.soft{background:#eef8ff;color:#214f64;border:2px solid #d6edf7}',
      '.hhaGroupsArAside{border:2px solid #d6edf7;border-radius:26px;padding:16px;background:rgba(255,255,255,.9);display:grid;gap:9px;align-content:center}',
      '.hhaGroupsArAside b{font-size:19px;color:#214f64}',
      '.hhaGroupsArAside span{color:#6f8fa1;font-weight:820;line-height:1.45}',
      '@media(max-width:850px){.hhaGroupsArGrid,.hhaGroupsArCard{grid-template-columns:1fr}.hhaGroupsArActions{flex-direction:row;flex-wrap:wrap}.hhaGroupsArBtn{flex:1}.hhaGroupsArHead{display:block}.hhaGroupsArBadge{display:inline-flex;margin-top:10px}}',
      '@media(max-width:540px){.hhaGroupsArActions{display:grid}.hhaGroupsArBtn{width:100%}}'
    ].join('');
    document.head.appendChild(style);
  }

  function createSection(){
    if (document.getElementById('hhaGroupsArAdditiveSection')) return;

    var page = document.querySelector('.page') || document.body;
    var hero = page.querySelector('.hero');
    var section = document.createElement('section');
    section.id = 'hhaGroupsArAdditiveSection';
    section.className = 'hhaGroupsArSection';
    section.innerHTML = '' +
      '<div class="hhaGroupsArHead">' +
        '<div><h2>✨ เลือกประสบการณ์ Camera AR</h2>' +
        '<p>เส้นทางใหม่สำหรับกล้องหน้าและ Hand Tracking โดยโหมดเดิมทั้งหมดด้านล่างยังอยู่ครบ</p></div>' +
        '<span class="hhaGroupsArBadge">แนะนำสำหรับ AR</span>' +
      '</div>' +
      '<div class="hhaGroupsArGrid">' +
        '<article class="hhaGroupsArCard">' +
          '<div class="hhaGroupsArIcon">📷</div>' +
          '<div><h3>Food Groups Camera AR</h3>' +
          '<p>ใช้มือ Pinch & Drop จำแนกอาหาร 5 หมู่ ผ่าน Reason Check, Retry Rescue และ Boss 3 Phase</p>' +
          '<div class="hhaGroupsArFlow"><span>Warmup AR-lite</span><span>Game AR</span><span>Cooldown AR-lite</span><span>Touch Fallback</span></div></div>' +
          '<div class="hhaGroupsArActions">' +
            '<button class="hhaGroupsArBtn primary" id="hhaGroupsArStart">📷 เริ่ม Camera AR</button>' +
            '<button class="hhaGroupsArBtn soft" id="hhaGroupsArCheck">🧪 Device Check</button>' +
          '</div>' +
        '</article>' +
        '<aside class="hhaGroupsArAside"><b>🎮 Classic modes ยังอยู่ครบ</b>' +
          '<span>Solo, Race, Battle, Duet, Coop รวมทั้ง PC, Mobile และ Cardboard ใช้ส่วนเดิมด้านล่างได้ตามปกติ</span>' +
          '<button class="hhaGroupsArBtn soft" id="hhaGroupsArTeacher">📊 Teacher View</button>' +
        '</aside>' +
      '</div>';

    if (hero && hero.nextSibling) page.insertBefore(section, hero.nextSibling);
    else if (hero) page.appendChild(section);
    else page.insertBefore(section, page.firstChild);

    document.getElementById('hhaGroupsArStart').onclick = function(){
      location.assign(buildWarmupUrl());
    };
    document.getElementById('hhaGroupsArCheck').onclick = function(){
      location.assign(buildCheckUrl());
    };
    document.getElementById('hhaGroupsArTeacher').onclick = function(){
      location.assign(buildTeacherUrl());
    };
  }

  function boot(){
    addStyle();
    createSection();
    console.info('[Groups Camera AR Additive]', PATCH_ID, {
      warmup: buildWarmupUrl(),
      check: buildCheckUrl()
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, {once:true});
  } else {
    boot();
  }
})();
