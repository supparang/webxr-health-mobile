(function(){
  "use strict";
  const badge=document.querySelector(".brand small");
  if(badge)badge.innerHTML='<span class="test-badge">STANDALONE TEST</span> • V7.4 Player-Round Shuffle';
  function fail(){const root=document.getElementById("screen");if(root)root.innerHTML='<section class="panel"><div class="intro"><h1>โหลดเกมไม่สำเร็จ</h1><p class="lead">กรุณาปิดแท็บแล้วเปิดใหม่</p></div></section>';}
  function load(src,onload){const script=document.createElement("script");script.src=src;script.async=false;script.onload=onload||null;script.onerror=fail;document.body.appendChild(script);}
  load("./lexicon-x-v7-core.js?v=20260805-v74",function(){load("./lexicon-x-v7-navigation.js?v=20260805-v74");});
}());
