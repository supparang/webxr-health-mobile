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

/*
  พิกัดใหม่ใช้ ax / ay = anchor x/y ภายในกล่อง avatar
  avatar ปัจจุบันกว้าง 200 สูง 290
*/
export const BATH_HOTSPOTS = [
  { id: 'neck',   label: 'คอ',      needMs: 1400, ax: 86, ay: 74,  w: 28, h: 20 },
  { id: 'ear',    label: 'หลังหู',   needMs: 1400, ax: 58, ay: 38,  w: 22, h: 22 },
  { id: 'armpit', label: 'รักแร้',   needMs: 1700, ax: 48, ay: 118, w: 28, h: 24 },
  { id: 'arm',    label: 'แขน',      needMs: 1200, ax: 16, ay: 116, w: 24, h: 56 },
  { id: 'leg',    label: 'ขา',       needMs: 1200, ax: 76, ay: 186, w: 28, h: 70 },
  { id: 'feet',   label: 'เท้า',      needMs: 1500, ax: 72, ay: 262, w: 40, h: 20 }
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

export const BATH_READY_CORRECT_IDS = ['soap', 'shampoo', 'towel', 'clothes'];
export const BATH_READY_WRONG_POOL = ['toy', 'snack', 'book', 'shoe'];
export const BATH_SCRUB_POOL = ['neck', 'ear', 'armpit', 'arm', 'leg', 'feet'];

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

export const BATH_MISSIONS_50 = [
  { id:'m01-ready-basic-4', family:'ready', title:'เลือกของอาบน้ำ 4 ชิ้น', subtitle:'เลือกของที่ใช้ตอนอาบน้ำให้ครบ', phaseFocus:'ready', difficulty:'easy', tags:['ready','selection','core'], config:{ readyCorrectIds:['soap','shampoo','towel','clothes'], readyWrongCount:2 }, bonusText:'เลือกของผิดไม่เกิน 1 ชิ้น' },
  { id:'m02-ready-remove-wrong', family:'ready', title:'แยกของที่ไม่เกี่ยวออก', subtitle:'หาของที่ไม่ใช่ของอาบน้ำให้เจอ', phaseFocus:'ready', difficulty:'easy', tags:['ready','selection'], config:{ readyCorrectIds:['soap','shampoo','towel','clothes'], readyWrongCount:3 }, bonusText:'แตะของถูกครบต่อเนื่อง' },
  { id:'m03-ready-time', family:'ready', title:'เลือกของให้ทันเวลา', subtitle:'เลือกของอาบน้ำให้ครบก่อนเวลา', phaseFocus:'ready', difficulty:'medium', tags:['ready','timed'], config:{ readyCorrectIds:['soap','shampoo','towel','clothes'], readyWrongCount:4, timeLimitSec:12 }, bonusText:'เหลือเวลาอย่างน้อย 3 วินาที' },
  { id:'m04-ready-many-decoys', family:'ready', title:'ของหลอกเยอะขึ้น', subtitle:'เลือกของอาบน้ำจากของหลอกหลายชิ้น', phaseFocus:'ready', difficulty:'medium', tags:['ready','decoy'], config:{ readyCorrectIds:['soap','shampoo','towel','clothes'], readyWrongCount:4 }, bonusText:'ของผิดต้องไม่เกิน 1 ชิ้น' },
  { id:'m05-ready-low-error', family:'ready', title:'เลือกให้แม่น', subtitle:'เลือกของอาบน้ำโดยพลาดให้น้อยที่สุด', phaseFocus:'ready', difficulty:'medium', tags:['ready','accuracy'], config:{ readyCorrectIds:['soap','shampoo','towel','clothes'], readyWrongCount:3, maxWrong:1 }, bonusText:'ผ่านแบบไม่แตะของผิดเลย' },
  { id:'m06-ready-after-bath', family:'ready', title:'ของที่ใช้หลังอาบน้ำ', subtitle:'เลือกของที่ใช้หลังอาบน้ำให้ถูก', phaseFocus:'ready', difficulty:'easy', tags:['ready','post-bath'], config:{ readyCorrectIds:['towel','clothes'], readyWrongCount:4 }, bonusText:'เลือกครบอย่างรวดเร็ว' },
  { id:'m07-ready-toy-vs-bath', family:'ready', title:'ของเล่นหรือของอาบน้ำ', subtitle:'แยกของเล่นกับของอาบน้ำให้ถูก', phaseFocus:'ready', difficulty:'easy', tags:['ready','compare'], config:{ readyCorrectIds:['soap','shampoo','towel'], readyWrongIds:['toy','book','shoe'] }, bonusText:'แตะถูกต่อเนื่อง 3 ครั้ง' },
  { id:'m08-ready-food-vs-bath', family:'ready', title:'ของกินหรือของอาบน้ำ', subtitle:'แยกของกินกับของอาบน้ำให้ถูก', phaseFocus:'ready', difficulty:'easy', tags:['ready','compare'], config:{ readyCorrectIds:['soap','shampoo','towel'], readyWrongIds:['snack','book','shoe'] }, bonusText:'ไม่แตะของกินเลย' },

  { id:'m09-scrub-neck', family:'scrub', title:'ถูคอให้สะอาด', subtitle:'คอเป็นจุดสำคัญที่ควรถูให้สะอาด', phaseFocus:'scrub', difficulty:'easy', tags:['scrub','single-target'], config:{ scrubHotspotIds:['neck'] }, bonusText:'ถูจบในครั้งเดียว' },
  { id:'m10-scrub-ear', family:'scrub', title:'ถูหลังหูให้สะอาด', subtitle:'หลังหูเป็นจุดที่คราบซ่อนอยู่ได้', phaseFocus:'scrub', difficulty:'easy', tags:['scrub','single-target'], config:{ scrubHotspotIds:['ear'] }, bonusText:'ถูครบโดยไม่ปล่อยกลางคัน' },
  { id:'m11-scrub-armpit', family:'scrub', title:'ถูรักแร้ให้สะอาด', subtitle:'รักแร้เป็นจุดเหงื่อออกง่าย', phaseFocus:'scrub', difficulty:'easy', tags:['scrub','single-target'], config:{ scrubHotspotIds:['armpit'] }, bonusText:'ถูให้ครบภายในเวลา' },
  { id:'m12-scrub-feet', family:'scrub', title:'ถูเท้าให้สะอาด', subtitle:'เท้าก็ต้องล้างและถูให้สะอาด', phaseFocus:'scrub', difficulty:'easy', tags:['scrub','single-target'], config:{ scrubHotspotIds:['feet'] }, bonusText:'ทำให้ครบในครั้งเดียว' },
  { id:'m13-scrub-neck-ear', family:'scrub', title:'คอกับหลังหู', subtitle:'ถูคอและหลังหูให้ครบ', phaseFocus:'scrub', difficulty:'easy', tags:['scrub','multi-target'], config:{ scrubHotspotIds:['neck','ear'] }, bonusText:'ไม่สลับจุดผิด' },
  { id:'m14-scrub-armpit-feet', family:'scrub', title:'รักแร้กับเท้า', subtitle:'ถูรักแร้และเท้าให้สะอาด', phaseFocus:'scrub', difficulty:'medium', tags:['scrub','multi-target'], config:{ scrubHotspotIds:['armpit','feet'] }, bonusText:'ทำครบอย่างต่อเนื่อง' },
  { id:'m15-scrub-3-points', family:'scrub', title:'3 จุดสำคัญ', subtitle:'ถู 3 จุดสำคัญให้ครบ', phaseFocus:'scrub', difficulty:'medium', tags:['scrub','multi-target'], config:{ scrubHotspotIds:['neck','armpit','feet'] }, bonusText:'ไม่เกิน 1 hint' },
  { id:'m16-scrub-4-points', family:'scrub', title:'4 จุดสำคัญ', subtitle:'ถูจุดสำคัญ 4 จุดให้ครบ', phaseFocus:'scrub', difficulty:'medium', tags:['scrub','multi-target'], config:{ scrubHotspotIds:['neck','ear','armpit','feet'] }, bonusText:'ทำครบก่อนเวลาที่กำหนด' },
  { id:'m17-scrub-sweat-zones', family:'scrub', title:'จุดเหงื่อออกง่าย', subtitle:'ถูจุดที่เหงื่อออกง่ายให้สะอาด', phaseFocus:'scrub', difficulty:'medium', tags:['scrub','theme'], config:{ scrubHotspotIds:['neck','armpit','feet'] }, bonusText:'ไม่ปล่อยเมาส์/นิ้วกลางจุด' },
  { id:'m18-scrub-random-4', family:'scrub', title:'จุดสำคัญแบบสุ่ม', subtitle:'เกมจะสุ่มจุดให้ถูในรอบนี้', phaseFocus:'scrub', difficulty:'medium', tags:['scrub','random'], config:{ scrubRandomCount:4 }, bonusText:'ทำครบโดยใช้ hint ไม่เกิน 1 ครั้ง' },

  { id:'m19-rinse-neck', family:'rinse', title:'ล้างฟองที่คอ', subtitle:'ล้างฟองออกจากคอให้หมด', phaseFocus:'rinse', difficulty:'easy', tags:['rinse','single-target'], config:{ scrubHotspotIds:['neck'] }, bonusText:'ล้างหมดในครั้งเดียว' },
  { id:'m20-rinse-armpit', family:'rinse', title:'ล้างฟองที่รักแร้', subtitle:'รักแร้ยังมีฟองอยู่ ล้างออกให้หมด', phaseFocus:'rinse', difficulty:'easy', tags:['rinse','single-target'], config:{ scrubHotspotIds:['armpit'] }, bonusText:'ล้างครบอย่างรวดเร็ว' },
  { id:'m21-rinse-feet', family:'rinse', title:'ล้างฟองที่เท้า', subtitle:'ล้างฟองที่เท้าให้หมด', phaseFocus:'rinse', difficulty:'easy', tags:['rinse','single-target'], config:{ scrubHotspotIds:['feet'] }, bonusText:'ฟองต้องหายหมด' },
  { id:'m22-rinse-2-points', family:'rinse', title:'ล้างฟอง 2 จุด', subtitle:'ล้างฟองให้ครบ 2 จุด', phaseFocus:'rinse', difficulty:'easy', tags:['rinse','multi-target'], config:{ scrubHotspotIds:['neck','feet'] }, bonusText:'ล้างครบโดยไม่ย้อนจุด' },
  { id:'m23-rinse-3-points', family:'rinse', title:'ล้างฟอง 3 จุด', subtitle:'ล้างฟองที่เหลือให้ครบ 3 จุด', phaseFocus:'rinse', difficulty:'medium', tags:['rinse','multi-target'], config:{ scrubHotspotIds:['neck','armpit','feet'] }, bonusText:'จบโดยใช้เวลาน้อย' },
  { id:'m24-rinse-foam-hunt', family:'rinse', title:'ล่าฟองสบู่', subtitle:'หาจุดที่ยังมีฟองแล้วล้างออกให้หมด', phaseFocus:'rinse', difficulty:'medium', tags:['rinse','hunt'], config:{ scrubRandomCount:4 }, bonusText:'ล้างฟองครบทุกจุด' },
  { id:'m25-rinse-find-foam', family:'rinse', title:'หาฟองให้เจอ', subtitle:'ดูให้ดีว่าจุดไหนยังมีฟองอยู่', phaseFocus:'rinse', difficulty:'medium', tags:['rinse','observation'], config:{ scrubHotspotIds:['ear','armpit','feet'] }, bonusText:'ไม่ล้างจุดที่ไม่มีฟอง' },
  { id:'m26-rinse-timed', family:'rinse', title:'ล้างฟองให้ทันเวลา', subtitle:'ล้างฟองทั้งหมดก่อนเวลา', phaseFocus:'rinse', difficulty:'hard', tags:['rinse','timed'], config:{ scrubHotspotIds:['neck','ear','armpit','feet'], timeLimitSec:12 }, bonusText:'เหลือเวลาอย่างน้อย 2 วินาที' },

  { id:'m27-dry-neck', family:'dry', title:'เช็ดคอให้แห้ง', subtitle:'เช็ดคอหลังล้างเสร็จ', phaseFocus:'dry', difficulty:'easy', tags:['dry','single-target'], config:{ scrubHotspotIds:['neck'] }, bonusText:'เช็ดครบในครั้งเดียว' },
  { id:'m28-dry-armpit', family:'dry', title:'เช็ดรักแร้ให้แห้ง', subtitle:'เช็ดรักแร้หลังล้างเสร็จ', phaseFocus:'dry', difficulty:'easy', tags:['dry','single-target'], config:{ scrubHotspotIds:['armpit'] }, bonusText:'ทำครบโดยไม่ผิดลำดับ' },
  { id:'m29-dry-feet', family:'dry', title:'เช็ดเท้าให้แห้ง', subtitle:'เช็ดเท้าให้แห้งหลังล้างฟอง', phaseFocus:'dry', difficulty:'easy', tags:['dry','single-target'], config:{ scrubHotspotIds:['feet'] }, bonusText:'เช็ดครบเร็ว ๆ' },
  { id:'m30-dry-2-points', family:'dry', title:'เช็ดตัว 2 จุด', subtitle:'เช็ดตัว 2 จุดหลังล้างเสร็จ', phaseFocus:'dry', difficulty:'easy', tags:['dry','multi-target'], config:{ scrubHotspotIds:['neck','feet'] }, bonusText:'จบโดยไม่พลาดจุด' },
  { id:'m31-dry-3-points', family:'dry', title:'เช็ดตัว 3 จุด', subtitle:'เช็ดตัวหลังล้างเสร็จให้ครบ 3 จุด', phaseFocus:'dry', difficulty:'medium', tags:['dry','multi-target'], config:{ scrubHotspotIds:['neck','armpit','feet'] }, bonusText:'ใช้ hint ไม่เกิน 1 ครั้ง' },
  { id:'m32-dry-all-selected', family:'dry', title:'เช็ดทุกจุดที่ล้างแล้ว', subtitle:'เช็ดตัวให้แห้งครบทุกจุดในรอบนี้', phaseFocus:'dry', difficulty:'medium', tags:['dry','completion'], config:{ scrubRandomCount:4 }, bonusText:'เช็ดครบทุกจุดอย่างต่อเนื่อง' },
  { id:'m33-dry-find-wet', family:'dry', title:'หาจุดที่ยังเปียก', subtitle:'ดูให้ดีว่าจุดไหนยังเปียกอยู่', phaseFocus:'dry', difficulty:'medium', tags:['dry','observation'], config:{ scrubHotspotIds:['ear','armpit','feet'] }, bonusText:'ไม่แตะจุดที่แห้งแล้ว' },
  { id:'m34-dry-before-clothes', family:'dry', title:'เช็ดก่อนใส่เสื้อผ้า', subtitle:'เช็ดตัวให้แห้งก่อนใส่เสื้อผ้าสะอาด', phaseFocus:'dry', difficulty:'medium', tags:['dry','post-bath'], config:{ scrubHotspotIds:['neck','ear','armpit','feet'] }, bonusText:'จำขั้นตอนสุดท้ายให้ถูก' },

  { id:'m35-memory-first-step', family:'memory', title:'ขั้นตอนแรกคืออะไร', subtitle:'เลือกขั้นตอนแรกให้ถูก', phaseFocus:'memory', difficulty:'easy', tags:['memory','sequence'], config:{ memoryPrompt:'first-step', expectedSequence:['ready','scrub','rinse','dry'] }, bonusText:'ตอบได้ทันที' },
  { id:'m36-memory-after-soap', family:'memory', title:'หลังถูสบู่แล้วทำอะไรต่อ', subtitle:'เลือกขั้นตอนถัดไปหลังถูสบู่', phaseFocus:'memory', difficulty:'easy', tags:['memory','sequence'], config:{ memoryPrompt:'after-soap', expectedSequence:['scrub','rinse'] }, bonusText:'ตอบถูกโดยไม่ต้อง hint' },
  { id:'m37-memory-last-step', family:'memory', title:'ขั้นตอนสุดท้ายคืออะไร', subtitle:'เลือกขั้นตอนสุดท้ายให้ถูก', phaseFocus:'memory', difficulty:'easy', tags:['memory','sequence'], config:{ memoryPrompt:'last-step', expectedSequence:['dry'] }, bonusText:'ตอบเร็ว ๆ' },
  { id:'m38-memory-order-3', family:'memory', title:'เรียง 3 ขั้นตอน', subtitle:'เรียง 3 ขั้นตอนอาบน้ำให้ถูก', phaseFocus:'memory', difficulty:'medium', tags:['memory','sequence'], config:{ memoryPrompt:'order-3', expectedSequence:['ready','scrub','rinse'] }, bonusText:'เรียงถูกครั้งเดียว' },
  { id:'m39-memory-order-4', family:'memory', title:'เรียง 4 ขั้นตอน', subtitle:'เรียงลำดับอาบน้ำให้ครบ 4 ขั้น', phaseFocus:'memory', difficulty:'medium', tags:['memory','sequence'], config:{ memoryPrompt:'order-4', expectedSequence:['ready','scrub','rinse','dry'] }, bonusText:'ตอบถูกทั้งชุด' },
  { id:'m40-memory-core-chant', family:'memory', title:'เลือก–ถู–ล้าง–เช็ด', subtitle:'จำคำหลักของการอาบน้ำให้ได้', phaseFocus:'memory', difficulty:'easy', tags:['memory','core'], config:{ memoryPrompt:'core-chant', expectedSequence:['ready','scrub','rinse','dry'] }, bonusText:'พูดตามในใจแล้วตอบ' },
  { id:'m41-memory-find-wrong-step', family:'memory', title:'ขั้นตอนไหนผิด', subtitle:'ดูภาพแล้วหาว่าขั้นตอนไหนผิด', phaseFocus:'memory', difficulty:'medium', tags:['memory','analysis'], config:{ memoryPrompt:'find-wrong-step', expectedSequence:['ready','scrub','rinse','dry'] }, bonusText:'ดูให้ดีแล้วค่อยตอบ' },
  { id:'m42-memory-fill-missing', family:'memory', title:'เติมขั้นตอนที่หายไป', subtitle:'เลือกขั้นตอนที่หายไปในลำดับ', phaseFocus:'memory', difficulty:'medium', tags:['memory','sequence'], config:{ memoryPrompt:'fill-missing', expectedSequence:['ready','scrub','rinse','dry'] }, bonusText:'ตอบให้ครบในครั้งเดียว' },

  { id:'m43-boss-quick-bath', family:'boss', title:'Quick Bath', subtitle:'ทำครบ 4 ขั้นแบบสั้น', phaseFocus:'boss', difficulty:'medium', tags:['boss','mixed'], config:{ scrubHotspotIds:['armpit'], bossTemplateId:'classic' }, bonusText:'ทำครบแบบไม่พลาด' },
  { id:'m44-boss-foam-hunt', family:'boss', title:'Foam Hunt Boss', subtitle:'ถูแล้วล้างฟองให้หมด', phaseFocus:'boss', difficulty:'medium', tags:['boss','foam'], config:{ scrubHotspotIds:['neck','armpit','feet'], bossTemplateId:'classic' }, bonusText:'ล้างฟองครบทุกจุด' },
  { id:'m45-boss-dry-finish', family:'boss', title:'Dry Finish Boss', subtitle:'ล้างครบแล้วเช็ดให้แห้ง', phaseFocus:'boss', difficulty:'medium', tags:['boss','dry'], config:{ scrubHotspotIds:['ear','armpit','feet'], bossTemplateId:'classic' }, bonusText:'เช็ดครบโดยไม่ย้อนขั้น' },
  { id:'m46-boss-spot-clean', family:'boss', title:'Spot Clean Boss', subtitle:'เกมสุ่ม 3 จุดสำคัญให้ทำครบ', phaseFocus:'boss', difficulty:'medium', tags:['boss','spot'], config:{ scrubRandomCount:3, bossTemplateId:'classic' }, bonusText:'ทำครบทุกจุดที่สุ่ม' },
  { id:'m47-boss-memory', family:'boss', title:'Memory Boss', subtitle:'จำลำดับแล้วลงมือทำให้ถูก', phaseFocus:'boss', difficulty:'hard', tags:['boss','memory'], config:{ scrubHotspotIds:['neck','feet'], bossTemplateId:'memory-order' }, bonusText:'จำลำดับได้โดยไม่ต้องช่วย' },
  { id:'m48-boss-tool-accuracy', family:'boss', title:'Tool Boss', subtitle:'เลือกอุปกรณ์ผิดไม่ได้เกิน 1 ครั้ง', phaseFocus:'boss', difficulty:'hard', tags:['boss','accuracy'], config:{ scrubHotspotIds:['armpit'], bossTemplateId:'quick-clean', maxWrong:1 }, bonusText:'ผ่านแบบไม่เลือกผิดเลย' },
  { id:'m49-boss-timed', family:'boss', title:'Time Boss', subtitle:'ทำครบทุกขั้นก่อนเวลา', phaseFocus:'boss', difficulty:'hard', tags:['boss','timed'], config:{ scrubHotspotIds:['neck','armpit','feet'], bossTemplateId:'classic', timeLimitSec:18 }, bonusText:'เหลือเวลาอย่างน้อย 3 วินาที' },
  { id:'m50-boss-bath-hero', family:'boss', title:'Bath Hero Boss', subtitle:'เลือก–ถู–ล้าง–เช็ด ครบทั้งรอบ', phaseFocus:'boss', difficulty:'hard', tags:['boss','full-run'], config:{ scrubHotspotIds:['neck','ear','armpit','feet'], bossTemplateId:'classic' }, bonusText:'ผ่านแบบเป็นฮีโร่อาบน้ำ' }
];

export const BATH_REWARDS_20 = [
  { id:'r01-star-1', type:'star', label:'ดาวดวงแรก ⭐', description:'ผ่าน mission แรกสำเร็จ', unlock:{ kind:'missions_completed', value:1 } },
  { id:'r02-star-5', type:'star', label:'ดาวสะสม 5 ⭐', description:'สะสมดาวครบ 5 ดวง', unlock:{ kind:'stars_total', value:5 } },
  { id:'r03-star-10', type:'star', label:'ดาวสะสม 10 ⭐', description:'สะสมดาวครบ 10 ดวง', unlock:{ kind:'stars_total', value:10 } },
  { id:'r04-star-20', type:'star', label:'ดาวสะสม 20 ⭐', description:'สะสมดาวครบ 20 ดวง', unlock:{ kind:'stars_total', value:20 } },
  { id:'r05-star-30', type:'star', label:'ดาวสะสม 30 ⭐', description:'สะสมดาวครบ 30 ดวง', unlock:{ kind:'stars_total', value:30 } },

  { id:'r06-badge-bath-star', type:'badge', label:'Bath Star 🛁', description:'ผ่าน mission อาบน้ำสำเร็จหลายครั้ง', unlock:{ kind:'missions_completed', value:3 } },
  { id:'r07-badge-foam-finder', type:'badge', label:'Foam Finder 🫧', description:'ล้างฟองครบหลายรอบ', unlock:{ kind:'family_completed', family:'rinse', value:5 } },
  { id:'r08-badge-dry-body-star', type:'badge', label:'Dry Body Star ✨', description:'เช็ดตัวแห้งครบหลายครั้ง', unlock:{ kind:'family_completed', family:'dry', value:5 } },
  { id:'r09-badge-soap-smart', type:'badge', label:'Soap Smart Kid 🧼', description:'เลือกสบู่และอุปกรณ์ได้ถูกต้อง', unlock:{ kind:'family_completed', family:'ready', value:5 } },
  { id:'r10-badge-clean-step-master', type:'badge', label:'Clean Step Master 🌟', description:'ผ่าน mission ต่างกันครบ 10 แบบ', unlock:{ kind:'unique_missions_completed', value:10 } },
  { id:'r11-badge-quick-bath-hero', type:'badge', label:'Quick Bath Hero ⚡', description:'ผ่านภารกิจแบบเร็วหลายครั้ง', unlock:{ kind:'timed_missions_completed', value:3 } },
  { id:'r12-badge-spot-clean-pro', type:'badge', label:'Spot Clean Pro 🎯', description:'ทำจุดสำคัญได้แม่นยำ', unlock:{ kind:'family_completed', family:'scrub', value:6 } },

  { id:'r13-sticker-soap', type:'sticker', label:'สติกเกอร์สบู่', description:'ปลดล็อกสติกเกอร์สบู่', unlock:{ kind:'missions_completed', value:2 } },
  { id:'r14-sticker-foam', type:'sticker', label:'สติกเกอร์ฟองสบู่', description:'ปลดล็อกสติกเกอร์ฟองสบู่', unlock:{ kind:'family_completed', family:'rinse', value:3 } },
  { id:'r15-sticker-shower', type:'sticker', label:'สติกเกอร์ฝักบัว', description:'ปลดล็อกสติกเกอร์ฝักบัว', unlock:{ kind:'missions_completed', value:5 } },
  { id:'r16-sticker-towel', type:'sticker', label:'สติกเกอร์ผ้าเช็ดตัว', description:'ปลดล็อกสติกเกอร์ผ้าเช็ดตัว', unlock:{ kind:'family_completed', family:'dry', value:3 } },
  { id:'r17-sticker-hero', type:'sticker', label:'สติกเกอร์ฮีโร่อาบน้ำ', description:'ปลดล็อกสติกเกอร์ฮีโร่อาบน้ำ', unlock:{ kind:'unique_missions_completed', value:15 } },

  { id:'r18-title-bath-helper', type:'title', label:'Bath Helper', description:'เล่นครบ 3 วัน', unlock:{ kind:'daily_streak', value:3 } },
  { id:'r19-title-hygiene-hero', type:'title', label:'Hygiene Hero', description:'เล่นครบ 7 วันต่อเนื่อง', unlock:{ kind:'daily_streak', value:7 } },
  { id:'r20-title-bath-master', type:'title', label:'Bath Master', description:'ผ่าน mission ต่างกันครบ 20 แบบ', unlock:{ kind:'unique_missions_completed', value:20 } }
];