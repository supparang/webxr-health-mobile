(function(){
  "use strict";
  const script=document.createElement("script");
  script.src="./lexicon-x-engine-v5.js?v=20260804-playable5";
  script.async=false;
  script.onerror=()=>{
    const screen=document.getElementById("screen");
    if(screen)screen.innerHTML='<section class="panel"><div class="intro"><h1>โหลด LEXICON X ไม่สำเร็จ</h1><p class="lead">กรุณาปิดแท็บแล้วเปิดใหม่</p></div></section>';
  };
  document.body.appendChild(script);
}());