(function(){
  "use strict";
  const version="2026-08-12-CATEGORY-FOREST-V5-SPEECH-HARD-GATE-V2";
  [
    "./category-forest-v5-part1.js?v=20260805-category-prod5",
    "./category-forest-v5-part2.js?v=20260805-category-prod5",
    "./category-forest-v5-part3.js?v=20260805-category-prod5",
    "./category-forest-v5-part4.js?v=20260805-category-prod5",
    "./category-forest-speech-transition-guard-v1.js?v=20260812-speech-hard-gate-v2-audible-tail"
  ].forEach(src=>{const script=document.createElement("script");script.src=src;script.async=false;document.body.appendChild(script)});
  window.CATEGORY_FOREST_V5_LOADER=Object.freeze({version});
}());