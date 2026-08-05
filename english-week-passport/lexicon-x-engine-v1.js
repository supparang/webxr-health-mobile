(function(){
  "use strict";
  const engine=document.createElement("script");
  engine.src="./lexicon-x-engine-v5.js?v=20260805-buttons7-core";
  engine.async=false;
  engine.onerror=()=>{
    const screen=document.getElementById("screen");
    if(screen)screen.innerHTML='<section class="panel"><div class="intro"><h1>โหลด LEXICON X ไม่สำเร็จ</h1><p class="lead">กรุณาปิดแท็บแล้วเปิดใหม่</p></div></section>';
  };
  engine.onload=()=>{
    const polish=document.createElement("script");
    polish.src="./lexicon-x-polish-v7.js?v=20260805-buttons7";
    polish.async=false;
    polish.onerror=()=>console.warn("LEXICON X polish v7 failed; core game remains available");
    document.body.appendChild(polish);
  };
  document.body.appendChild(engine);
}());
