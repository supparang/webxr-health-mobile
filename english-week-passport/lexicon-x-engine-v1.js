(function(){
  "use strict";
  const engine=document.createElement("script");
  engine.src="./lexicon-x-engine-v6.js?v=20260805-fun6";
  engine.async=false;
  engine.onerror=()=>{
    const screen=document.getElementById("screen");
    if(screen)screen.innerHTML='<section class="panel"><div class="intro"><h1>โหลด LEXICON X ไม่สำเร็จ</h1><p class="lead">กรุณาปิดแท็บแล้วเปิดใหม่</p></div></section>';
  };
  document.body.appendChild(engine);
}());
