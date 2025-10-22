export class SFX {
  constructor({enabled=true, poolSize=4}={}) {
    this.enabled = enabled;
    this.poolSize = poolSize;
    this._unlocked = false;
    this._pools = new Map(); // id -> [HTMLAudioElement...]
  }

  setEnabled(on){ this.enabled = !!on; }

  _ensurePool(id){
    if(this._pools.has(id)) return this._pools.get(id);
    const base = document.getElementById(id);
    if(!base) return null;
    base.muted = !this.enabled;
    base.volume = 1.0;
    base.preload = 'auto';
    base.setAttribute('playsinline','');

    const pool = [base];
    for(let i=1;i<this.poolSize;i++){
      const a = base.cloneNode(true);
      a.id = `${id}__${i}`;
      a.style.display='none';
      a.muted = !this.enabled;
      a.volume = 1.0;
      base.parentNode.appendChild(a);
      pool.push(a);
    }
    this._pools.set(id, pool);
    return pool;
  }

  async unlock(){
    if(this._unlocked) return;
    this._unlocked = true;
    for(const [_, pool] of this._pools.entries()){
      for(const a of pool){
        try{
          a.muted = !this.enabled ? true : false;
          a.volume = this.enabled ? 1.0 : 0.0;
          a.currentTime = 0;
          // iOS/Safari: play->pause เพื่อปลดล็อก
          await a.play().then(()=>a.pause()).catch(()=>{});
        }catch{}
      }
    }
  }

  async play(id, {volume=1.0, rewind=true}={}){
    if(!this.enabled) return;
    const pool = this._ensurePool(id);
    if(!pool || !pool.length) return;

    let a = pool.find(x => x.paused) || pool[0];
    try{
      a.muted = false;
      a.volume = volume;
      if(rewind) a.currentTime = 0;
      const p = a.play();
      if(p?.catch) await p.catch(()=>{});
    }catch{}
  }
}
