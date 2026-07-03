/* UX Quest • Boss Console Loop Guard v1
 * Prevents repeated identical boss-console rendering from re-triggering childList observers.
 */
(() => {
  'use strict';
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
