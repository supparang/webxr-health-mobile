export const HYDRATION_V2_SCENARIOS = [
  {
    id: 'school-morning',
    title: 'ก่อนเข้าเรียนตอนเช้า',
    text: 'นิดมาถึงโรงเรียนแล้วเริ่มรู้สึกคอแห้งเล็กน้อย ก่อนจะเข้าเรียนคาบแรก',
    hint: 'คิดถึงสิ่งที่ทำได้ง่ายและช่วยให้ร่างกายพร้อมเรียน',
    question: 'ตอนนี้ควรทำอะไรดีที่สุด',
    choices: [
      { id: 'sip-water', emoji: '💧', label: 'จิบน้ำก่อนเข้าเรียน', sub: 'ช่วยให้ชุ่มคอและสดชื่น', isCorrect: true },
      { id: 'wait-long', emoji: '⏳', label: 'รอจนเที่ยงค่อยดื่ม', sub: 'ช้าเกินไป', isCorrect: false },
      { id: 'sweet-drink', emoji: '🧋', label: 'ดื่มน้ำหวานแทนทันที', sub: 'ไม่ใช่ตัวเลือกที่เหมาะที่สุด', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-thirsty', emoji: '🫗', label: 'เพราะเริ่มคอแห้งและควรเติมน้ำ', isCorrect: true },
      { id: 'reason-fun', emoji: '🎉', label: 'เพราะอยากเล่นกับขวดน้ำ', isCorrect: false },
      { id: 'reason-random', emoji: '🎲', label: 'เพราะเลือกแบบเดา ๆ', isCorrect: false }
    ]
  },
  {
    id: 'after-running',
    title: 'หลังวิ่งเล่นกลางแดด',
    text: 'บอยเพิ่งวิ่งเล่นกับเพื่อนกลางแดดและมีเหงื่อออกมาก',
    hint: 'คิดถึงสิ่งที่ร่างกายต้องการหลังเสียเหงื่อ',
    question: 'ควรเลือกอะไรเหมาะที่สุด',
    choices: [
      { id: 'drink-water', emoji: '💦', label: 'พักและดื่มน้ำเปล่า', sub: 'ช่วยเติมน้ำให้ร่างกาย', isCorrect: true },
      { id: 'run-more', emoji: '🏃', label: 'วิ่งต่อทันที', sub: 'ยิ่งเหนื่อยมากขึ้น', isCorrect: false },
      { id: 'only-snack', emoji: '🍟', label: 'กินของเค็มอย่างเดียว', sub: 'ยังไม่ช่วยเติมน้ำ', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-sweat', emoji: '🌤️', label: 'เพราะร่างกายเสียเหงื่อและต้องการน้ำ', isCorrect: true },
      { id: 'reason-no-need', emoji: '🙈', label: 'เพราะไม่ต้องดื่มน้ำก็ได้', isCorrect: false },
      { id: 'reason-copy', emoji: '📋', label: 'เพราะอยากตอบเหมือนเดิมทุกข้อ', isCorrect: false }
    ]
  },
  {
    id: 'hot-classroom',
    title: 'วันที่อากาศร้อนมาก',
    text: 'วันนี้อากาศร้อนกว่าปกติ แม้อยู่ในห้องเรียนก็ยังรู้สึกร้อนง่าย',
    hint: 'คิดถึงนิสัยที่ช่วยดูแลตัวเองได้ระหว่างวัน',
    question: 'ควรทำอย่างไรดีที่สุด',
    choices: [
      { id: 'drink-often', emoji: '🫗', label: 'ดื่มน้ำเป็นระยะ', sub: 'ค่อย ๆ เติมน้ำระหว่างวัน', isCorrect: true },
      { id: 'skip-all', emoji: '🚫', label: 'ไม่ต้องดื่มน้ำเลย', sub: 'ไม่เหมาะสม', isCorrect: false },
      { id: 'only-icecream', emoji: '🍦', label: 'กินไอศกรีมอย่างเดียว', sub: 'ไม่ใช่ทางเลือกหลัก', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-hot', emoji: '☀️', label: 'เพราะอากาศร้อน ควรเติมน้ำระหว่างวัน', isCorrect: true },
      { id: 'reason-lazy', emoji: '😴', label: 'เพราะไม่อยากถือขวดน้ำ', isCorrect: false },
      { id: 'reason-rush', emoji: '💨', label: 'เพราะอยากตอบให้เสร็จเร็ว', isCorrect: false }
    ]
  },
  {
    id: 'pe-class',
    title: 'หลังคาบพละ',
    text: 'หลังคาบพละ เด็ก ๆ ทุกคนรู้สึกเหนื่อยและหายใจแรงขึ้น',
    hint: 'มองหาทางเลือกพื้นฐานที่ดีต่อร่างกาย',
    question: 'สิ่งไหนเหมาะที่สุด',
    choices: [
      { id: 'plain-water', emoji: '💧', label: 'ดื่มน้ำเปล่า', sub: 'เหมาะกับการเติมน้ำหลังออกแรง', isCorrect: true },
      { id: 'energy-drink', emoji: '⚡', label: 'ดื่มเครื่องดื่มชูกำลัง', sub: 'ไม่เหมาะกับเด็ก', isCorrect: false },
      { id: 'nothing', emoji: '🙅', label: 'ไม่ต้องดื่มอะไร', sub: 'ไม่เหมาะหลังออกแรง', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-exercise', emoji: '🏅', label: 'เพราะเพิ่งออกแรง ร่างกายต้องการน้ำ', isCorrect: true },
      { id: 'reason-tasty', emoji: '😋', label: 'เพราะอยากดื่มของหวานมากกว่า', isCorrect: false },
      { id: 'reason-ignore', emoji: '🤷', label: 'เพราะคิดว่าไม่สำคัญ', isCorrect: false }
    ]
  },
  {
    id: 'lunch-break',
    title: 'ช่วงพักกลางวัน',
    text: 'แพรวกินข้าวกลางวันเสร็จแล้ว และยังมีเรียนต่อในช่วงบ่าย',
    hint: 'คิดถึงนิสัยที่ช่วยให้พร้อมเรียนต่อ',
    question: 'ควรทำอะไรต่อ',
    choices: [
      { id: 'drink-before-class', emoji: '🥛', label: 'ดื่มน้ำเพิ่มก่อนเข้าคาบบ่าย', sub: 'ช่วยให้สดชื่นพร้อมเรียนต่อ', isCorrect: true },
      { id: 'only-soda', emoji: '🥤', label: 'ดื่มแต่น้ำอัดลม', sub: 'ไม่ใช่ตัวเลือกที่เหมาะที่สุด', isCorrect: false },
      { id: 'skip-water', emoji: '🙈', label: 'ไม่ต้องดื่มอะไรเลย', sub: 'ไม่ช่วยดูแลร่างกาย', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-afternoon', emoji: '📚', label: 'เพราะยังมีเรียนต่อ ควรเติมน้ำก่อน', isCorrect: true },
      { id: 'reason-color', emoji: '🌈', label: 'เพราะแก้วสวยที่สุด', isCorrect: false },
      { id: 'reason-friend', emoji: '👫', label: 'เพราะเพื่อนเลือกแบบนี้', isCorrect: false }
    ]
  },
  {
    id: 'outdoor-trip',
    title: 'กิจกรรมกลางแจ้ง',
    text: 'ห้องของต้นกำลังจะเดินไปทำกิจกรรมกลางแจ้งเป็นเวลานาน',
    hint: 'ลองคิดล่วงหน้าว่าควรเตรียมตัวอย่างไร',
    question: 'ควรเตรียมอะไรดีที่สุด',
    choices: [
      { id: 'carry-bottle', emoji: '🎒', label: 'พกขวดน้ำไปด้วย', sub: 'หยิบดื่มได้สะดวกเมื่อจำเป็น', isCorrect: true },
      { id: 'carry-candy', emoji: '🍬', label: 'พกลูกอมแทน', sub: 'ไม่ช่วยเติมน้ำ', isCorrect: false },
      { id: 'carry-nothing', emoji: '🫥', label: 'ไม่ต้องเตรียมอะไร', sub: 'ไม่เหมาะกับกิจกรรมกลางแจ้ง', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-ready', emoji: '✅', label: 'เพราะจะได้ดื่มน้ำได้สะดวกระหว่างกิจกรรม', isCorrect: true },
      { id: 'reason-heavy', emoji: '🪨', label: 'เพราะขวดน้ำหนักดี', isCorrect: false },
      { id: 'reason-joke', emoji: '😂', label: 'เพราะตอบเล่น ๆ', isCorrect: false }
    ]
  }
];

export const HYDRATION_V2_CONFIDENCE = [
  { id: 'low', emoji: '🤔', label: 'ไม่ค่อยมั่นใจ' },
  { id: 'mid', emoji: '🙂', label: 'มั่นใจ' },
  { id: 'high', emoji: '🌟', label: 'มั่นใจมาก' }
];