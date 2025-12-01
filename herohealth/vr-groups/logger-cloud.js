// vr-groups/logger-cloud.js
// ส่งข้อมูลเกม Food Groups VR ขึ้น Google Apps Script แบบ "GoodJunk style"
// payload:
//   {
//     projectTag: 'HeroHealth-GroupsVR',
//     sessions: [ { ... } ],
//     events:   [ { ... } ]
//   }

(function (ns) {
  'use strict';

  let CONFIG = {
    endpoint: '',
    projectTag: 'HeroHealth-GroupsVR',
    debug: false
  };

  // ---------- init จาก groups-vr.html ----------
  // ตัวอย่างการเรียก:
  // GAME_MODULES.foodGroupsCloudLogger.init({
  //   endpoint: 'https://script.google.com/macros/s/XXXXX/exec',
  //   projectTag: 'HeroHealth-GroupsVR',
  //   debug: true
  // });
  function init(opts) {
    opts = opts || {};
    CONFIG.endpoint  = (opts.endpoint || '').trim();
    CONFIG.projectTag = opts.projectTag || CONFIG.projectTag;
    CONFIG.debug      = !!opts.debug;

    if (!CONFIG.endpoint) {
      console.warn('[GroupsVR CloudLogger] no endpoint configured');
      return;
    }

    if (CONFIG.debug) {
      console.log('[GroupsVR CloudLogger] init', CONFIG);
    }
  }

  // ---------- helper: สร้าง payload รวม ----------
  function buildPayload(rawSession, rawEvents) {
    return {
      projectTag: CONFIG.projectTag,
      sessions: rawSession ? [ rawSession ] : [],
      events: Array.isArray(rawEvents) ? rawEvents : []
    };
  }

  // ---------- พยายามส่งด้วย sendBeacon ก่อน ----------
  function trySendBeacon(payload) {
    if (!navigator.sendBeacon) return false;
    try {
      const blob = new Blob([JSON.stringify(payload)], {
        type: 'text/plain;charset=utf-8'
      });
      const ok = navigator.sendBeacon(CONFIG.endpoint, blob);
      if (CONFIG.debug) {
        console.log('[GroupsVR CloudLogger] sendBeacon', ok, payload);
      }
      return ok;
    } catch (err) {
      if (CONFIG.debug) {
        console.warn('[GroupsVR CloudLogger] sendBeacon error', err);
      }
      return false;
    }
  }

  // ---------- main: เรียกจาก GameEngine.endGame() ----------
  async function send(rawSession, rawEvents) {
    if (!CONFIG.endpoint) {
      if (CONFIG.debug) console.warn('[GroupsVR CloudLogger] no endpoint');
      return;
    }

    const payload = buildPayload(rawSession, rawEvents || []);

    if (CONFIG.debug) {
      console.log('[GroupsVR CloudLogger] send payload', payload);
    }

    // 1) ลองใช้ sendBeacon ก่อน (ดีสำหรับตอนปิดแท็บ)
    if (trySendBeacon(payload)) return;

    // 2) ถ้าไม่ได้ ค่อย fallback เป็น fetch
    try {
      await fetch(CONFIG.endpoint, {
        method: 'POST',
        // ใช้ no-cors ให้ยิงออกได้ง่ายบน mobile/VR
        mode: 'no-cors',
        keepalive: true,
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });
      if (CONFIG.debug) {
        console.log('[GroupsVR CloudLogger] sent payload via fetch');
      }
    } catch (err) {
      if (CONFIG.debug) {
        console.error('[GroupsVR CloudLogger] fetch error', err);
      }
    }
  }

  // export เข้า namespace กลาง
  ns.foodGroupsCloudLogger = {
    init,
    send
  };

})(window.GAME_MODULES || (window.GAME_MODULES = {}));
