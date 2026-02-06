// === /fitness/js/stats-store.js ===
// Minimal state store (for UI binding)
// ✅ Export: StatsStore

'use strict';

export class StatsStore {
  constructor(){
    this.s = {};
    this.listeners = new Set();
  }

  set(patch = {}){
    Object.assign(this.s, patch||{});
    for (const fn of this.listeners) {
      try{ fn(this.s); }catch(e){ console.warn(e); }
    }
  }

  get(){ return this.s; }

  on(fn){
    if (typeof fn === 'function') this.listeners.add(fn);
    return ()=> this.listeners.delete(fn);
  }
}