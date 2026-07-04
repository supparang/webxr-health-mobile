/* EAP Hero legacy reset compatibility loader.
   index.html already loads this file before eap-hero.js. Write the safe
   bootstrap synchronously so the core cannot read V1/V2 migration stores. */
(function(){
  'use strict';
  document.write('<script src="./eap-core-safe-boot-v7.js?v=20260704-safe-boot-v7"><\\/script>');
})();
