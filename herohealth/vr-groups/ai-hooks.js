// === /herohealth/vr-groups/ai-hooks.js ===
// GroupsVR AI Hooks (NON-MODULE) — SAFE
// ✅ No "export" (works with <script defer>)
// ✅ window.GroupsVR.AIHooks.attach({runMode, seed, enabled})
// ✅ Emits lightweight events; default disabled (enabled=false)
// Notes: This is a hook layer (no heavy ML). Predictor is in groups-vr.html gated by ?ai=1.

(function(){
  'use strict';
  const WIN = window;
  WIN.GroupsVR = WIN.GroupsVR || {};

  const AIHooks = {
    _enabled: false,
    _runMode: 'play',
    _seed: '',
    _off: [],
    _last: {
      score: 0, combo: 0, miss: 0,
      acc: 0, grade: 'C',
      left: 0,
      groupKey: '', groupName: ''
    },

    attach(opts){
      opts = opts || {};
      this._runMode = String(opts.runMode || 'play');
      this._seed = String(opts.seed || '');
      this._enabled = !!opts.enabled && this._runMode === 'play';

      // cleanup old listeners
      this.detach();

      // If disabled: keep it quiet but not broken
      const on = (type, fn, opt)=>{
        WIN.addEventListener(type, fn, opt || { passive:true });
        this._off.push([type, fn, opt || { passive:true }]);
      };

      // Listen to gameplay signals (optional)
      on('hha:score', (ev)=>{
        const d = ev.detail || {};
        this._last.score = Number(d.score ?? this._last.score) || 0;
        this._last.combo = Number(d.combo ?? this._last.combo) || 0;
        this._last.miss  = Number(d.misses ?? this._last.miss) || 0;

        if (!this._enabled) return;
        // Hook point (future): adaptive difficulty signal
        // WIN.dispatchEvent(new CustomEvent('groups:ai_signal', { detail:{ kind:'score', ...this._last } }));
      });

      on('hha:rank', (ev)=>{
        const d = ev.detail || {};
        this._last.grade = String(d.grade ?? this._last.grade || 'C');
        this._last.acc   = Number(d.accuracy ?? this._last.acc) || 0;

        if (!this._enabled) return;
      });

      on('hha:time', (ev)=>{
        const d = ev.detail || {};
        this._last.left = Math.max(0, Math.round(Number(d.left ?? this._last.left) || 0));
        if (!this._enabled) return;
      });

      on('quest:update', (ev)=>{
        const d = ev.detail || {};
        this._last.groupKey  = String(d.groupKey  || this._last.groupKey  || '');
        this._last.groupName = String(d.groupName || this._last.groupName || '');
        if (!this._enabled) return;
      });

      // Example: consume predictor output (from groups-vr.html when ?ai=1)
      on('groups:ai_predict', (ev)=>{
        if (!this._enabled) return;
        const d = ev.detail || {};
        // Hook point (future): record AI traces / explainability
        // console.log('[AIHooks] predict', d);
      });

      // Tell the world we’re ready
      try{
        WIN.dispatchEvent(new CustomEvent('groups:aihooks_ready', {
          detail:{ enabled:this._enabled, runMode:this._runMode, seed:this._seed }
        }));
      }catch(_){}

      return { enabled: this._enabled };
    },

    detach(){
      try{
        const off = this._off || [];
        for (let i=0;i<off.length;i++){
          const it = off[i];
          WIN.removeEventListener(it[0], it[1], it[2]);
        }
      }catch(_){}
      this._off = [];
    }
  };

  WIN.GroupsVR.AIHooks = AIHooks;
})();