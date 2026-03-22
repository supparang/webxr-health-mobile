// /herohealth/bath-v2/bath.data.js

export const BATH_COPY = {
  title: 'มาอาบน้ำให้สะอาดกัน',
  sub: 'เลือกของให้ถูก ถูจุดสำคัญ ล้างฟองให้หมด และเช็ดตัวให้แห้ง',
  phaseNames: {
    ready: 'ด่าน 1 • เตรียมของ',
    scrub: 'ด่าน 2 • ถูให้สะอาด',
    rinseDry: 'ด่าน 3 • ล้างและเช็ดตัว',
    boss: 'ด่าน 4 • ทำครบทั้งลำดับ'
  },
  help: {
    ready: 'แตะของที่ต้องใช้ก่อนนะ',
    scrub: 'เลือกสบู่ แล้วถูจุดที่เรืองแสง',
    rinse: 'เลือกฝักบัว แล้วล้างฟองออกให้หมดนะ',
    dry: 'เลือกผ้าเช็ดตัว แล้วเช็ดให้แห้งนะ',
    boss: 'ทำทีละขั้นนะ หนูทำได้'
  },
  tools: {
    soap: '🧼 สบู่',
    shower: '🚿 ฝักบัว',
    towel: '🧴 ผ้าเช็ดตัว'
  }
};

export const BATH_COACH_LINES = {
  readyStart: 'แตะของที่ต้องใช้ก่อนนะ',
  readyCorrect: 'ใช่เลย อันนี้ต้องใช้',
  readyWrong: 'อันนี้ยังไม่ต้องใช้จ้า',
  scrubStart: 'เลือกสบู่ แล้วถูจุดที่เรืองแสง',
  scrubAlmost: 'อีกนิดเดียว สะอาดแล้ว',
  scrubDone: 'เยี่ยมเลย จุดนี้สะอาดแล้ว',
  rinseStart: 'ล้างฟองออกให้หมดนะ',
  rinseDone: 'ฟองหายแล้ว เก่งมาก',
  dryStart: 'เช็ดตัวให้แห้งก่อนนะ',
  dryDone: 'แห้งแล้ว พร้อมเลย',
  bossStart: 'มาทำครบทั้งลำดับกัน',
  phaseClear: 'ผ่านด่านแล้ว เยี่ยมมาก'
};

export const BATH_ITEMS = [
  { id: 'soap', label: 'สบู่', emoji: '🧼', correct: true },
  { id: 'shampoo', label: 'แชมพู', emoji: '🫧', correct: true },
  { id: 'towel', label: 'ผ้าเช็ดตัว', emoji: '🧴', correct: true },
  { id: 'clothes', label: 'เสื้อผ้าสะอาด', emoji: '👕', correct: true },

  { id: 'toy', label: 'ของเล่น', emoji: '🧸', correct: false },
  { id: 'snack', label: 'ขนม', emoji: '🍪', correct: false },
  { id: 'book', label: 'หนังสือ', emoji: '📘', correct: false },
  { id: 'shoe', label: 'รองเท้า', emoji: '👟', correct: false }
];

export const BATH_HOTSPOTS = [
  { id: 'neck',   label: 'คอ',      needMs: 1400, x: 77, y: 122, w: 28, h: 32 },
  { id: 'ear',    label: 'หลังหู',   needMs: 1400, x: 63, y: 100, w: 30, h: 30 },
  { id: 'armpit', label: 'รักแร้',   needMs: 1700, x: 52, y: 164, w: 34, h: 30 },
  { id: 'arm',    label: 'แขน',      needMs: 1200, x: 26, y: 166, w: 24, h: 62 },
  { id: 'leg',    label: 'ขา',       needMs: 1200, x: 74, y: 230, w: 32, h: 74 },
  { id: 'feet',   label: 'เท้า',      needMs: 1500, x: 74, y: 310, w: 36, h: 28 }
];

export const BATH_PHASES = [
  { id: 'ready', title: BATH_COPY.phaseNames.ready, task: 'เลือกของอาบน้ำให้ครบ' },
  { id: 'scrub', title: BATH_COPY.phaseNames.scrub, task: 'เลือกสบู่ แล้วกดค้างถูจุดสำคัญ' },
  { id: 'rinseDry', title: BATH_COPY.phaseNames.rinseDry, task: 'ล้างฟองออก แล้วเช็ดตัวให้แห้ง' },
  { id: 'boss', title: BATH_COPY.phaseNames.boss, task: 'ทำตามขั้นตอนให้ครบ' }
];

export const BATH_QUIZ = [
  {
    id: 'q1',
    text: 'หลังจากถูสบู่แล้ว ควรทำอะไรต่อ',
    choices: [
      { id: 'a', text: 'กินขนม', correct: false },
      { id: 'b', text: 'ล้างฟองออก', correct: true },
      { id: 'c', text: 'ใส่รองเท้า', correct: false }
    ]
  },
  {
    id: 'q2',
    text: 'หลังอาบน้ำเสร็จ ควรทำอะไร',
    choices: [
      { id: 'a', text: 'เช็ดตัวให้แห้ง', correct: true },
      { id: 'b', text: 'ใส่เสื้อทั้งที่ตัวยังเปียก', correct: false },
      { id: 'c', text: 'วิ่งออกไปเลย', correct: false }
    ]
  }
];

/* =========================
   Replayable layer
   ========================= */

export const BATH_MISSIONS = [
  {
    id: 'sweat-spots',
    title: 'ภารกิจล้างจุดเหงื่อออกง่าย',
    subtitle: 'เน้นจุดที่เหงื่อออกง่ายและควรถูให้สะอาด'
  },
  {
    id: 'foam-hunt',
    title: 'ภารกิจล่าฟองสบู่',
    subtitle: 'ล้างฟองออกให้หมด แล้วเช็ดตัวให้แห้ง'
  },
  {
    id: 'bath-helper',
    title: 'ภารกิจผู้ช่วยอาบน้ำ',
    subtitle: 'เลือกของให้ถูก แล้วทำครบทุกขั้นตอน'
  },
  {
    id: 'clean-step',
    title: 'ภารกิจจำลำดับอาบน้ำ',
    subtitle: 'จำให้ได้ว่า เลือก ถู ล้าง และเช็ด'
  }
];

export const BATH_BADGES = [
  { id: 'bath-star', label: 'Bath Star 🛁' },
  { id: 'foam-finder', label: 'Foam Finder 🫧' },
  { id: 'dry-body-star', label: 'Dry Body Star ✨' },
  { id: 'soap-smart', label: 'Soap Smart Kid 🧼' },
  { id: 'clean-step-master', label: 'Clean Step Master 🌟' }
];

export const BATH_READY_CORRECT_IDS = ['soap', 'shampoo', 'towel', 'clothes'];

export const BATH_READY_WRONG_POOL = ['toy', 'snack', 'book', 'shoe'];

export const BATH_SCRUB_POOL = [
  'neck',
  'ear',
  'armpit',
  'arm',
  'leg',
  'feet'
];

export const BATH_BOSS_TEMPLATES = [
  {
    id: 'classic',
    steps: [
      { type: 'selectTool', tool: 'soap', text: 'เลือกสบู่' },
      { type: 'scrub', hotspot: 'TARGET', text: 'ถูจุดสำคัญให้สะอาด' },
      { type: 'selectTool', tool: 'shower', text: 'เลือกฝักบัว' },
      { type: 'rinse', hotspot: 'TARGET', text: 'ล้างฟองออก' },
      { type: 'selectTool', tool: 'towel', text: 'เลือกผ้าเช็ดตัว' },
      { type: 'dry', hotspot: 'TARGET', text: 'เช็ดให้แห้ง' }
    ]
  },
  {
    id: 'quick-clean',
    steps: [
      { type: 'selectTool', tool: 'soap', text: 'เลือกสบู่' },
      { type: 'scrub', hotspot: 'TARGET', text: 'ถูให้สะอาด' },
      { type: 'selectTool', tool: 'towel', text: 'อันนี้ยังไม่ใช้ทันทีนะ' },
      { type: 'selectTool', tool: 'shower', text: 'ตอนนี้เลือกฝักบัว' },
      { type: 'rinse', hotspot: 'TARGET', text: 'ล้างฟองให้หมด' },
      { type: 'selectTool', tool: 'towel', text: 'ตอนนี้เลือกผ้าเช็ดตัว' },
      { type: 'dry', hotspot: 'TARGET', text: 'เช็ดตัวให้แห้ง' }
    ]
  },
  {
    id: 'memory-order',
    steps: [
      { type: 'selectTool', tool: 'soap', text: 'อะไรควรใช้ก่อน' },
      { type: 'scrub', hotspot: 'TARGET', text: 'ถูจุดนี้ให้สะอาด' },
      { type: 'selectTool', tool: 'shower', text: 'หลังถูแล้วควรใช้อะไร' },
      { type: 'rinse', hotspot: 'TARGET', text: 'ล้างออกให้หมด' },
      { type: 'selectTool', tool: 'towel', text: 'ขั้นสุดท้ายใช้อะไร' },
      { type: 'dry', hotspot: 'TARGET', text: 'เช็ดให้แห้ง' }
    ]
  }
];

export const BATH_COACH_VARIANTS = {
  readyStart: [
    'แตะของที่ต้องใช้ก่อนนะ',
    'เลือกของอาบน้ำให้ครบเลย',
    'มาหาของที่ต้องใช้กัน'
  ],
  scrubStart: [
    'เลือกสบู่ แล้วถูจุดที่เรืองแสง',
    'เริ่มถูจุดสำคัญกันเลย',
    'จุดสีเหลืองต้องถูให้สะอาดนะ'
  ],
  rinseStart: [
    'ล้างฟองออกให้หมดนะ',
    'ตอนนี้ล้างฟองกัน',
    'มีฟองอยู่ ต้องล้างออกก่อน'
  ],
  dryStart: [
    'เช็ดตัวให้แห้งก่อนนะ',
    'ตอนนี้ใช้ผ้าเช็ดตัวได้เลย',
    'แห้งแล้วจะสบายตัวกว่า'
  ]
};