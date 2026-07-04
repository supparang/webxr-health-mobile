/* UX Quest • Boss Console Loop Guard v1.2
 * Prevents repeated identical boss-console rendering from re-triggering childList observers.
 * Preloads replay-bank and anti-guess extensions before the mission engine initializes.
 */
(() => {
  'use strict';

  const path = String(location.pathname || '').toLowerCase();
  const isBoss = /(b1-cognitive-storm|b2-flow-fortress)\.html/.test(path);
  const isMasteryRoute = /(w2-design-thinking-sprint|w3-cognitive-load-escape|b1-cognitive-storm|w4-user-insight-lab|w5-concept-forge|w6-flow-rescue|b2-flow-fortress)\.html/.test(path);
  if (isMasteryRoute && document.readyState === 'loading') {
    const bossBank = isBoss
      ? '<script data-uxq-boss-replay-bank src="./js/uxq-boss-replay-bank-v1.js?v=20260706-boss-replay-v2"></' + 'script>'
      : '';
    document.write(`${bossBank}<script data-uxq-w2b2-antiguess src="./js/uxq-w2-b2-antiguess-v1.js?v=20260706-antiguess-v1"></` + 'script>');
  }

  const proto = window.Element?.prototype;
  const descriptor = proto && Object.getOwnPropertyDescriptor(proto, 'innerHTML');
  if (!descriptor || typeof descriptor.get !== 'function' || typeof descriptor.set !== 'function') return;
  if (proto.__uxqBossConsoleGuardInstalled) return;

  Object.defineProperty(proto, '__uxqBossConsoleGuardInstalled', { value:true, configurable:true });
  Object.defineProperty(proto, 'innerHTML', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get: descriptor.get,
    set(value){
      const isBossConsole = this instanceof HTMLElement && this.classList?.contains('uxq-boss-console');
      const next = String(value == null ? '' : value);
      if (isBossConsole && this.dataset?.uxqBossConsoleHtml === next) return;
      descriptor.set.call(this, value);
      if (isBossConsole && this.dataset) this.dataset.uxqBossConsoleHtml = next;
    }
  });
})();
