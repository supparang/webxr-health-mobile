(()=>{
'use strict';
const RELEASE='20260718-HANDWASH-RESEARCH-BRIDGE-R18-TO-R25';
if(document.querySelector('script[data-handwash-research-r25]'))return;
const script=document.createElement('script');
script.src='./handwash-research-delivery-r25.js?cv=20260718-HANDWASH-RESEARCH-DELIVERY-R25';
script.async=false;
script.dataset.handwashResearchR25='true';
script.onload=()=>console.info('[Handwash Research] R25 receipt-confirmed delivery loaded');
script.onerror=()=>console.error('[Handwash Research] R25 delivery load failed');
document.head.appendChild(script);
document.documentElement.dataset.handwashResearchBridge=RELEASE;
console.info('[Handwash Research] legacy R18 bridge redirected to R25');
})();