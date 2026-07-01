/* AI Quest — S6 Gameplay Safety Bridge v4.1.10
   The previous v410 enhancement contained a syntax error and blocked the
   S6 extension at parse time. Keep the verified core S6 engine active.
*/
(() => {
  'use strict';
  const VERSION = 'v4.1.10-s6-gameplay-safety-bridge';

  function ready() {
    const hasCore = typeof window.startMission === 'function';
    window.AIQuestSearchKnowledgeGameplay = {
      version: VERSION,
      coreReady: hasCore,
      mode: 'stable-core'
    };
    console.log('[AIQuest] S6 gameplay safety bridge loaded', window.AIQuestSearchKnowledgeGameplay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ready, { once: true });
  } else {
    ready();
  }
})();