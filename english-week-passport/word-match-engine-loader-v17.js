(function(){
  "use strict";
  const ENGINE_URL="./word-match-snap-v4.js?v=20260804-glide20-engine";
  const CONTROLLER_URL="./word-match-easy-glide-v20.js?v=20260804-glide20";

  function loadController(){
    const script=document.createElement("script");
    script.src=CONTROLLER_URL;
    script.async=false;
    script.onerror=()=>{
      const root=document.getElementById("memoryRoot");
      if(root) root.innerHTML='<section class="intro-card"><h1>โหลดตัวควบคุมไม่สำเร็จ</h1><p class="lead">กรุณาปิดแท็บแล้วเปิดใหม่</p></section>';
    };
    document.body.appendChild(script);
  }

  fetch(ENGINE_URL,{cache:"no-store"})
    .then(response=>{
      if(!response.ok) throw new Error(`ENGINE_HTTP_${response.status}`);
      return response.text();
    })
    .then(source=>{
      const needle="function flipCard(cardId) {";
      if(!source.includes(needle)) throw new Error("FLIP_EXPORT_POINT_NOT_FOUND");
      const patched=source.replace(
        needle,
        "window.EW_WORD_MATCH_OPEN_CARD = function(cardId){ return flipCard(cardId); };\n\n  function flipCard(cardId) {"
      );
      (0,eval)(`${patched}\n//# sourceURL=word-match-snap-v4-exported-glide20.js`);
      loadController();
    })
    .catch(error=>{
      console.error("Word Match engine loader Easy Glide V20",error);
      const root=document.getElementById("memoryRoot");
      if(root) root.innerHTML='<section class="intro-card"><h1>เริ่มเกมไม่สำเร็จ</h1><p class="lead">ไม่สามารถโหลด Engine ได้ กรุณาปิดแท็บแล้วเปิดใหม่</p></section>';
    });
}());
