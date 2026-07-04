/* EAP Hero legacy reset compatibility loader.
   Safe Boot v8 removes only corrupt legacy entries and preserves
   player-scoped verified progress restored from Sheet. */
(function(){
  'use strict';
  var src = './eap-core-safe-boot-v7.js?v=20260704-safe-boot-v8-preserve-resume';
  document.write('<script src="' + src + '"><' + '/script>');
})();
