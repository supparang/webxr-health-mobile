(function(){
  "use strict";
  const version="2026-08-05-CATEGORY-FOREST-V5-LOADER";
  [
    "./category-forest-v5-part1.js?v=20260805-category-prod5",
    "./category-forest-v5-part2.js?v=20260805-category-prod5",
    "./category-forest-v5-part3.js?v=20260805-category-prod5",
    "./category-forest-v5-part4.js?v=20260805-category-prod5"
  ].forEach(src=>{const script=document.createElement("script");script.src=src;script.async=false;document.body.appendChild(script)});
  window.CATEGORY_FOREST_V5_LOADER=Object.freeze({version});
}());
