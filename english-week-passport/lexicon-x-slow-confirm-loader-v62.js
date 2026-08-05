(function(){
  "use strict";
  const VERSION="2026-08-05-LEXICON-X-SLOW-CONFIRM-V6.2";
  const SOURCE="./lexicon-x-engine-v6.js?v=20260805-gated61-source";
  fetch(SOURCE,{cache:"no-store"})
    .then(r=>{if(!r.ok)throw new Error(`ENGINE_HTTP_${r.status}`);return r.text();})
    .then(source=>{
      const checks=[
        'const VERSION="2026-08-05-LEXICON-X-FUN-V6.1-GESTURE-GATED";',
        'S.dwellAt=S.canOpen?performance.now()+180:0;',
        'const pct=Math.min(100,(now-S.dwellAt)/430*100);'
      ];
      if(!checks.every(x=>source.includes(x)))throw new Error("SLOW_CONFIRM_PATCH_POINT_NOT_FOUND");
      source=source
        .replace(checks[0],`const VERSION="${VERSION}";`)
        .replace(checks[1],'S.dwellAt=S.canOpen?performance.now()+350:0;')
        .replace(checks[2],'const pct=Math.min(100,(now-S.dwellAt)/900*100);')
        .replace('เลือกใบใหม่ทาง${text} • หยุดเพื่อเปิด','เลือกใบใหม่ทาง${text} • หยุดยืนยันประมาณ 1 วินาที')
        .replace('SWIPE TO MOVE • STOP TO OPEN','SWIPE TO MOVE • HOLD TO CONFIRM');
      (0,eval)(`${source}\n//# sourceURL=lexicon-x-engine-v62-slow-confirm.js`);
      window.EW_LEXICON_X_SLOW_CONFIRM=Object.freeze({version:VERSION,settleMs:350,openingMs:900,cancelOnMove:true});
    })
    .catch(error=>{
      console.error("LEXICON X Slow Confirm loader failed",error);
      const root=document.getElementById("screen");
      if(root)root.innerHTML='<section class="panel"><div class="intro"><h1>โหลดเกมไม่สำเร็จ</h1><p class="lead">กรุณาปิดแท็บแล้วเปิดใหม่</p></div></section>';
    });
}());
