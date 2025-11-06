// … imports เหมือนเดิม …

export class GameHub{
  constructor(){
    this.scene = document.querySelector('a-scene');
    this.spawnZone = document.getElementById('spawnZone');
    this.fxLayer   = document.getElementById('fxLayer');
    this.ui = {
      hudRoot:     document.getElementById('hudRoot'),
      questPanel:  document.getElementById('questPanel'),
      tQ:          document.getElementById('tQ'),
      tMode:       document.getElementById('tMode'),
      tTime:       document.getElementById('tTime'),
      tScore:      document.getElementById('tScore'),
      tCombo:      document.getElementById('tCombo'),
      tFever:      document.getElementById('tFever'),
      feverFill:   document.getElementById('feverFill'),
      modeMenu:    document.getElementById('modeMenu'),
      startPanel:  document.getElementById('startPanel'),
      startBtn:    document.getElementById('startBtn'),
      startLbl:    document.getElementById('startLbl'),
      resultPanel: document.getElementById('resultPanel'),
      tResultBody: document.getElementById('tResultBody'),
      restartBtn:  document.getElementById('restartBtn'),
    };

    this.state='menu'; this.mode='';
    this.goal=40; this.duration=60; this.left=60;
    this.score=0; this.combo=1; this.goodHits=0; this.star=0; this.diamond=0;

    // … init systems …

    // ปุ่มเมนู
    this.ui.modeMenu.querySelectorAll('.btn').forEach(b=>{
      b.addEventListener('click', ()=>{
        this.mode = b.getAttribute('data-mode');
        this.ui.tMode.setAttribute('value','โหมด: '+this.mode.toUpperCase());
        this.ui.startPanel.setAttribute('visible', true);
        this.ui.startLbl.setAttribute('value','เริ่มโหมด '+this.mode);
      });
    });
    this.ui.startBtn.addEventListener('click', ()=>{ if(this.mode) this.startGame(); });
    this.ui.restartBtn.addEventListener('click', ()=> this.showMenu());

    document.getElementById('forceStartBtn').addEventListener('click', ()=>{
      if(!this.mode){ this.mode='goodjunk'; this.ui.tMode.setAttribute('value','โหมด: GOODJUNK'); this.ui.startPanel.setAttribute('visible', true); }
      this.startGame();
    });

    this.showMenu();
  }

  showMenu(){
    // เมนูต้องอยู่หน้าเสมอ
    this.state='menu';
    this.ui.modeMenu.setAttribute('visible', true);
    this.ui.startPanel.setAttribute('visible', !!this.mode);
    this.ui.resultPanel.setAttribute('visible', false);

    // ซ่อน Quest และรีเซ็ตข้อความ กัน “VS” ค้าง
    this.ui.questPanel.setAttribute('visible', false);
    this.ui.tQ.setAttribute('value','');

    this.ui.tMode.setAttribute('value', this.mode?('โหมด: '+this.mode.toUpperCase()):'เลือกโหมด →');
  }

  startGame(){
    // … reset คะแนน/ตัวแปร …
    this.ui.modeMenu.setAttribute('visible', false);
    this.ui.startPanel.setAttribute('visible', false);
    this.ui.resultPanel.setAttribute('visible', false);

    // แสดง Quest เฉพาะตอนเล่น
    this.ui.questPanel.setAttribute('visible', true);

    // … สุ่ม mission, start timer, spawnLoop …
  }

  // … ที่เหลือเหมือนเวอร์ชันล่าสุด …
}
