// ./game/core/sfx.js
export class SFX {
  constructor({enabled=true, poolSize=4}={}){
    this.enabled = enabled;
    this.poolSize = poolSize;
    this._unlocked = false;
    this._pools = new Map(); // id -> [HTMLAudioElement...]
  }

  _ensurePool(id){
    if(this._pools.has(id)) return this._pools.get(id);
    const base = document.getElementById(id);
    if(!base) return null;
    const pool = [base];
    for(let i=1;i<this.poolSize;i++){
      const clone = base.cloneNode(true);
      // ป้องกันชน id ซ้ำ
      clone.id = `${id}__${i}`;
      // ติด dom เพื่อให้ preload ทำงานครบ
      clone.style.display='none';
      base.parentNode.appendChild(clone);
      pool.push(clone);
    }
    this._pools.set(id, pool);
    return pool;
    }

  // เรียกตอนมี gesture ครั้งแรก (click/touch/keydown)
  async unlock(){
    if(this._unlocked) return;
    this._unlocked = true;
    for(const [id, pool] of this._pools.entries()){
      for(const a of pool){
        try{
          a.muted = false;
          a.volume = 1.0;
          // iOS บางเวอร์ชันต้อง "play->pause" เพื่อปลดล็อก
          await a.play().then(()=>a.pause()).catch(()=>{});
          a.currentTime = 0;
        }catch{}
      }
    }
  }

  async play(id, {volume=1.0, rewind=true}={}){
    if(!this.enabled) return;
    const pool = this._ensurePool(id);
    if(!pool || !pool.length) return;

    // หาแทร็กที่ว่าง (paused) ถ้าไม่มี ให้หยิบตัวแรกแล้วรีเซ็ต
    let a = pool.find(x => x.paused);
    if(!a) a = pool[0];

    try{
      a.muted = false;
      a.volume = volume;
      if(rewind) a.currentTime = 0;
      const p = a.play();
      if(p && typeof p.then === 'function'){
        await p.catch(err=>{
          // ถ้าโดนบล็อกเพราะยังไม่ unlock ให้เงียบไว้
          // แล้วค่อย unlock ตอน gesture
          // console.warn('[SFX] play blocked:', err);
        });
      }
    }catch(e){
      // console.warn('[SFX] play error:', e);
    }
  }

  setEnabled(on){ this.enabled = !!on; }
}
