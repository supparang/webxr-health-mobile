// vr-groups/logger-cloud.js
(function (ns) {
  'use strict';

  const CloudLogger = {
    endpoint: 'https://script.google.com/macros/s/AKfycbzEW94iBXISShedudnv-vE0k0_gDkiGtU8r2yatyr_sj4l8dRDhgxgjU6rGyyv0Yh7p/exec',
    projectTag: 'HeroHealth-GroupsVR',

    init(opts) {
      opts = opts || {};
      this.endpoint = (opts.endpoint || '').trim();
      if (opts.projectTag) this.projectTag = opts.projectTag;
    },

    send(session, events) {
      if (!this.endpoint || !window.fetch) return;
      const payload = {
        projectTag: this.projectTag,
        session: session || {},
        events: events || []
      };

      try {
        fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } catch (e) {
        // ไม่ต้องทำอะไร ป้องกันเกมพัง
        // console.warn('CloudLogger error', e);
      }
    }
  };

  ns.foodGroupsCloudLogger = CloudLogger;
})(window.GAME_MODULES || (window.GAME_MODULES = {}));
