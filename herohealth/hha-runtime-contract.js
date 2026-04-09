(function (W) {
  'use strict';

  if (W.HHARuntimeContract) return;

  W.HHARuntimeContract = {
    create: function () {
      return {
        flush: async function(){},
        engineReady: async function(){},
        roundStarted: async function(){},
        scoreUpdated: async function(){},
        summary: async function(){}
      };
    }
  };
})(window);