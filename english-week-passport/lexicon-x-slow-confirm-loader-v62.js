(function(){
  "use strict";
  const badge=document.querySelector(".brand small");
  if(badge)badge.innerHTML='<span class="test-badge">STANDALONE TEST</span> • Smart Skip V6.4';
  const script=document.createElement("script");
  script.src="./lexicon-x-smart-skip-loader-v64.js?v=20260805-skip64";
  script.async=false;
  script.onerror=()=>{
    const root=document.getElementById("screen");
    if(root)root.innerHTML='<section class="panel"><div class="intro"><h1>โหลดเกมไม่สำเร็จ</h1><p class="lead">กรุณาปิดแท็บแล้วเปิดใหม่</p></div></section>';
  };
  document.body.appendChild(script);
}());
