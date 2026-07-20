(()=>{
'use strict';
const RELEASE='20260718-HANDWASH-RESEARCH-BRIDGE-R18-TO-R26';
function load(src,key,label){
 if(document.querySelector('script[data-'+key+']'))return;
 const script=document.createElement('script');
 script.src=src;script.async=false;script.setAttribute('data-'+key,'true');
 script.onload=()=>console.info('[Handwash Research] '+label+' loaded');
 script.onerror=()=>console.error('[Handwash Research] '+label+' load failed');
 document.head.appendChild(script);
}
load('./handwash-research-delivery-r25.js?cv=20260718-HANDWASH-RESEARCH-DELIVERY-R25','handwash-research-r25','R25 receipt delivery');
load('./handwash-research-transport-r26.js?cv=20260718-HANDWASH-RESEARCH-FORM-TRANSPORT-R26','handwash-research-r26','R26 hidden-form transport');
document.documentElement.dataset.handwashResearchBridge=RELEASE;
console.info('[Handwash Research] legacy R18 bridge redirected to R25 + R26');
})();