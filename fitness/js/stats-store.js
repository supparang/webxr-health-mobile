'use strict';

export class StatsStore {
  constructor(key){
    this.key = key || 'SB_STATS';
  }

  _load(){
    try{
      const raw = localStorage.getItem(this.key);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    }catch(_){
      return [];
    }
  }

  _save(arr){
    try{
      localStorage.setItem(this.key, JSON.stringify(arr || []));
    }catch(_){}
  }

  append(summary){
    const arr = this._load();
    arr.push({ ts: Date.now(), ...(summary||{}) });
    // keep last 50
    while (arr.length > 50) arr.shift();
    this._save(arr);
  }

  list(){
    return this._load();
  }

  clear(){
    try{ localStorage.removeItem(this.key); }catch(_){}
  }
}