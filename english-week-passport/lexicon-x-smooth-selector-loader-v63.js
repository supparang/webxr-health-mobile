(function(){
  "use strict";
  const VERSION="2026-08-05-LEXICON-X-SMOOTH-SELECTOR-V6.3";
  const SOURCE="./lexicon-x-engine-v6.js?v=20260805-gated61-source";
  const style=document.createElement("style");
  style.textContent=`
    .card.target{border-color:#2b536b!important;box-shadow:none!important}
    .card.target:not(.flipped):not(.matched)::before{display:none!important}
    #selectionGlider{position:absolute;left:0;top:0;z-index:12;pointer-events:none;border:3px solid #ffe36e;border-radius:13px;box-shadow:0 0 0 3px rgba(255,227,110,.22),0 0 22px rgba(255,227,110,.30);will-change:transform,width,height;transform:translate3d(0,0,0)}
    #selectionGlider::before{content:"SELECTED";position:absolute;top:4px;left:50%;transform:translateX(-50%);padding:2px 6px;border-radius:999px;background:#ffe36e;color:#12293c;font-size:.48rem;font-weight:950;letter-spacing:.06em;white-space:nowrap}
    #selectionGlider.moving::before{content:"MOVING";background:#70e7ff}
    #selectionGlider.opening-now{border-color:#70e7ff;box-shadow:0 0 0 3px rgba(112,231,255,.22),0 0 24px rgba(112,231,255,.34)}
  `;
  document.head.appendChild(style);

  fetch(SOURCE,{cache:"no-store"})
    .then(r=>{if(!r.ok)throw new Error(`ENGINE_HTTP_${r.status}`);return r.text();})
    .then(source=>{
      const checks=[
        'const VERSION="2026-08-05-LEXICON-X-FUN-V6.1-GESTURE-GATED";',
        'lastTiltAt:0,audio:null};',
        '<div id="grid" class="grid">${S.deck.map',
        'function cardAt(i){return document.querySelector(`.card[data-index="${i}"]`);}',
        'S.dwellAt=S.canOpen?performance.now()+180:0;',
        'const pct=Math.min(100,(now-S.dwellAt)/430*100);'
      ];
      if(!checks.every(x=>source.includes(x)))throw new Error("SMOOTH_SELECTOR_PATCH_POINT_NOT_FOUND");

      source=source
        .replace(checks[0],`const VERSION="${VERSION}";`)
        .replace(checks[1],'lastTiltAt:0,audio:null,motion:null};')
        .replace('lastTiltAt:0});','lastTiltAt:0,motion:null});')
        .replace(checks[2],'<div id="grid" class="grid"><div id="selectionGlider" aria-hidden="true"></div>${S.deck.map')
        .replace(
          checks[3],
          `${checks[3]}\nfunction glider(){return document.getElementById("selectionGlider");}\nfunction cardBox(i){const card=cardAt(i),grid=document.getElementById("grid");if(!card||!grid)return null;return{x:card.offsetLeft,y:card.offsetTop,w:card.offsetWidth,h:card.offsetHeight};}\nfunction drawGlider(box){const g=glider();if(!g||!box)return;g.style.width=box.w+"px";g.style.height=box.h+"px";g.style.transform=\`translate3d(\${box.x}px,\${box.y}px,0)\`;}`
        )
        .replace(
          'grid.addEventListener("pointercancel",()=>S.swipe=null,{passive:true});',
          'grid.addEventListener("pointercancel",()=>S.swipe=null,{passive:true});requestAnimationFrame(()=>drawGlider(cardBox(0)));'
        )
        .replace(
`  document.querySelectorAll(".card.target").forEach(el=>el.classList.remove("target"));
  clearOpening();
  S.current=next;
  const el=cardAt(next);el?.classList.add("target");
  const card=S.deck[next];
  S.canOpen=Boolean(card&&!card.flipped&&!card.matched);
  S.dwellAt=S.canOpen?performance.now()+180:0;
  const text={left:"ซ้าย",right:"ขวา",up:"ขึ้น",down:"ลง"}[dir];
  setInstruction(S.canOpen?\`เลือกใบใหม่ทาง\${text} • หยุดเพื่อเปิด\`:\`ใบนี้เปิดแล้ว • ปัดต่อไปหาใบอื่น\`);
  vibrate(10);tone(300,.045,"triangle",.02);`,
`  clearOpening();S.canOpen=false;S.dwellAt=0;
  const from=S.current,fromBox=cardBox(from),toBox=cardBox(next);
  S.motion={from,to:next,fromBox,toBox,start:performance.now(),duration:360,source,dir};
  glider()?.classList.add("moving");
  const text={left:"ซ้าย",right:"ขวา",up:"ขึ้น",down:"ลง"}[dir];
  setInstruction(\`กำลังเลื่อนไปทาง\${text} • \${source}\`);
  vibrate(10);tone(300,.045,"triangle",.02);`
        )
        .replace(
`function loop(now){
  if(!document.getElementById("grid"))return;
  const el=cardAt(S.current),card=S.deck[S.current];`,
`function loop(now){
  if(!document.getElementById("grid"))return;
  if(S.motion){
    const m=S.motion,t=Math.min(1,(now-m.start)/m.duration),e=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    const box={x:m.fromBox.x+(m.toBox.x-m.fromBox.x)*e,y:m.fromBox.y+(m.toBox.y-m.fromBox.y)*e,w:m.fromBox.w+(m.toBox.w-m.fromBox.w)*e,h:m.fromBox.h+(m.toBox.h-m.fromBox.h)*e};
    drawGlider(box);
    if(t>=1){
      document.querySelectorAll(".card.target").forEach(el=>el.classList.remove("target"));
      S.current=m.to;const el=cardAt(S.current);el?.classList.add("target");
      const card=S.deck[S.current];S.canOpen=Boolean(card&&!card.flipped&&!card.matched);
      S.dwellAt=S.canOpen?now+350:0;S.motion=null;glider()?.classList.remove("moving");
      setInstruction(S.canOpen?"ถึงการ์ดแล้ว • หยุดยืนยันก่อนเปิด":"ใบนี้เปิดแล้ว • ปัดต่อไปหาใบอื่น");
    }
    S.raf=requestAnimationFrame(loop);return;
  }
  const el=cardAt(S.current),card=S.deck[S.current];`
        )
        .replace(checks[5],'const pct=Math.min(100,(now-S.dwellAt)/900*100);')
        .replace('el.classList.add("opening");','el.classList.add("opening");glider()?.classList.add("opening-now");')
        .replace('S.canOpen=false;S.dwellAt=0;clearOpening();','S.canOpen=false;S.dwellAt=0;clearOpening();glider()?.classList.remove("opening-now");')
        .replace('SWIPE TO MOVE • STOP TO OPEN','SWIPE TO MOVE • SMOOTH SELECT • HOLD TO OPEN');

      (0,eval)(`${source}\n//# sourceURL=lexicon-x-engine-v63-smooth-selector.js`);
      window.EW_LEXICON_X_SMOOTH_SELECTOR=Object.freeze({version:VERSION,moveMs:360,settleMs:350,openingMs:900});
    })
    .catch(error=>{
      console.error("LEXICON X Smooth Selector loader failed",error);
      const root=document.getElementById("screen");
      if(root)root.innerHTML='<section class="panel"><div class="intro"><h1>โหลดเกมไม่สำเร็จ</h1><p class="lead">กรุณาปิดแท็บแล้วเปิดใหม่</p></div></section>';
    });
}());
