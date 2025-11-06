
// Hero Health VR - GameHub (minimal orchestrator)
export class GameHub{
  constructor(){
    this.mode = null;
    this.running = false;
    this.spawnHost = document.getElementById('spawnZone');
    this.questPanel = document.getElementById('questPanel');
    this.hudRoot = document.getElementById('hudRoot');
    this._bindPause();
    this._showBoot();
  }
  _showBoot(){
    const box = document.getElementById('bootStatus');
    if(box) box.firstElementChild.innerHTML = '<strong>Status:</strong> Hub ready';
  }
  _bindPause(){
    window.addEventListener('hha:pause', ()=>{
      if(this.current && this.current.pause) try{ this.current.pause(); }catch{}
    });
    window.addEventListener('hha:resume', ()=>{
      if(this.current && this.current.resume) try{ this.current.resume(); }catch{}
    });
  }
  selectMode(mode){
    this.mode = mode;
    const heads = this.hudRoot.querySelectorAll('a-entity[troika-text]');
    if(heads && heads.length){
      heads[0].setAttribute('troika-text','value', 'โหมด: ' + mode);
    }
    const startLbl = document.getElementById('startLbl');
    if(startLbl) startLbl.setAttribute('troika-text','value','เริ่ม: ' + (mode||'-').toUpperCase());
    const startPanel = document.getElementById('startPanel');
    if(startPanel) startPanel.setAttribute('visible', true);
  }
  async startGame(){
    if(this.running) return;
    this.running = true;
    const menu = document.getElementById('modeMenu');
    if(menu) menu.setAttribute('visible', false);
    const startPanel = document.getElementById('startPanel');
    if(startPanel) startPanel.setAttribute('visible', false);
    const qp = document.getElementById('questPanel');
    if(qp){
      qp.setAttribute('visible', true);
      const tQ = document.getElementById('tQ');
      if(tQ) tQ.setAttribute('troika-text','value','สุ่มมิชชั่น 3 อย่าง / เก็บแต้มให้ถึงเป้า!');
    }
    const mode = this.mode || 'goodjunk';
    const map = {
      'goodjunk':'./modes/goodjunk.safe.js',
      'groups':'./modes/groups.js',
      'hydration':'./modes/hydration.js',
      'plate':'./modes/plate.js'
    };
    const url = map[mode] || map['goodjunk'];
    try{
      const mod = await import(url + '?v=' + Date.now());
      if(mod && typeof mod.boot === 'function'){
        const api = await mod.boot({host:this.spawnHost, duration:60, difficulty:'normal'});
        this.current = api||{};
      }else{
        throw new Error('Mode has no boot()');
      }
    }catch(e){
      console.warn('Mode import failed, falling back inline', e);
      if(window.inlineGoodJunkBoot){
        window.inlineGoodJunkBoot({host:this.spawnHost, duration:60, difficulty:'normal'});
      }
    }
  }
}
