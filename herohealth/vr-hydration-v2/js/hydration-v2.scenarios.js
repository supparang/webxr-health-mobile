export const HYDRATION_V2_SCENARIOS = [
  {
    id: 'A-school-morning',
    form: 'A',
    family: 'schoolmorning',
    difficulty: 'easy',
    title: 'ก่อนเข้าเรียนตอนเช้า',
    text: 'นิดมาถึงโรงเรียนแล้วเริ่มรู้สึกคอแห้งเล็กน้อย ก่อนจะเข้าเรียนคาบแรก',
    hint: 'คิดถึงสิ่งที่ทำได้ง่ายและช่วยให้ร่างกายพร้อมเรียน',
    question: 'ตอนนี้ควรทำอะไรดีที่สุด',
    choices: [
      { id: 'sip-water', emoji: '💧', label: 'จิบน้ำก่อนเข้าเรียน', sub: 'ช่วยให้ชุ่มคอและพร้อมเรียน', isCorrect: true },
      { id: 'wait-later', emoji: '⏳', label: 'รอพักเที่ยงแล้วค่อยดื่ม', sub: 'รอนานเกินไป', isCorrect: false },
      { id: 'sweet-first', emoji: '🧋', label: 'ดื่มน้ำหวานแทนน้ำเปล่า', sub: 'ไม่ใช่ตัวเลือกที่เหมาะที่สุด', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-thirsty', emoji: '🫗', label: 'เริ่มคอแห้งแล้ว ควรเติมน้ำก่อนเรียน', isCorrect: true },
      { id: 'reason-no-time', emoji: '🏃', label: 'รีบเข้าเรียนเลยยังไม่ต้องดื่มก็ได้', isCorrect: false },
      { id: 'reason-any-drink', emoji: '🥤', label: 'ดื่มอะไรก็ได้เหมือนกันหมด', isCorrect: false }
    ]
  },
  {
    id: 'A-after-running',
    form: 'A',
    family: 'exercise',
    difficulty: 'easy',
    title: 'หลังวิ่งเล่นกลางแดด',
    text: 'บอยเพิ่งวิ่งเล่นกับเพื่อนกลางแดดและมีเหงื่อออกมาก',
    hint: 'คิดถึงสิ่งที่ร่างกายต้องการหลังเสียเหงื่อ',
    question: 'ควรเลือกอะไรเหมาะที่สุด',
    choices: [
      { id: 'drink-water', emoji: '💦', label: 'พักและดื่มน้ำเปล่า', sub: 'ช่วยเติมน้ำให้ร่างกาย', isCorrect: true },
      { id: 'keep-running', emoji: '🏃', label: 'วิ่งต่ออีกหน่อยค่อยดื่ม', sub: 'ยิ่งเหนื่อยมากขึ้น', isCorrect: false },
      { id: 'eat-salty', emoji: '🍟', label: 'กินของเค็มก่อนแล้วค่อยว่ากัน', sub: 'ยังไม่ช่วยเติมน้ำ', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-sweat', emoji: '🌤️', label: 'เพราะเสียเหงื่อและควรดื่มน้ำหลังออกแรง', isCorrect: true },
      { id: 'reason-not-thirsty-yet', emoji: '🙈', label: 'ถ้ายังไม่กระหายมากก็ยังไม่ต้องดื่ม', isCorrect: false },
      { id: 'reason-energy-only', emoji: '⚡', label: 'หลังวิ่งควรหาของหวานแทนน้ำ', isCorrect: false }
    ]
  },
  {
    id: 'A-lunch-break',
    form: 'A',
    family: 'lunch',
    difficulty: 'medium',
    title: 'ช่วงพักกลางวัน',
    text: 'แพรวกินข้าวกลางวันเสร็จแล้ว และยังมีเรียนต่อในช่วงบ่าย',
    hint: 'คิดถึงนิสัยที่ช่วยให้พร้อมเรียนต่อ',
    question: 'ควรทำอะไรต่อ',
    choices: [
      { id: 'drink-before-class', emoji: '🥛', label: 'ดื่มน้ำเพิ่มก่อนเข้าคาบบ่าย', sub: 'ช่วยให้สดชื่นพร้อมเรียนต่อ', isCorrect: true },
      { id: 'only-soda', emoji: '🥤', label: 'ดื่มแต่น้ำอัดลมแก้วเดียว', sub: 'ไม่ใช่ตัวเลือกที่เหมาะที่สุด', isCorrect: false },
      { id: 'skip-water', emoji: '🙈', label: 'ไม่ต้องดื่มอะไรเลย', sub: 'ไม่ช่วยดูแลร่างกาย', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-afternoon', emoji: '📚', label: 'ยังมีเรียนต่อ ควรเติมน้ำก่อนเข้าคาบบ่าย', isCorrect: true },
      { id: 'reason-food-enough', emoji: '🍚', label: 'กินข้าวแล้วจึงไม่ต้องดื่มน้ำเพิ่ม', isCorrect: false },
      { id: 'reason-save-time', emoji: '⏱️', label: 'ไม่ควรเสียเวลาดื่มน้ำก่อนเข้าเรียน', isCorrect: false }
    ]
  },
  {
    id: 'A-outdoor-trip',
    form: 'A',
    family: 'trip',
    difficulty: 'medium',
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
      { id: 'reason-ready', emoji: '✅', label: 'จะได้ดื่มน้ำได้สะดวกระหว่างกิจกรรม', isCorrect: true },
      { id: 'reason-buy-later', emoji: '🛒', label: 'ค่อยหาซื้อน้ำทีหลังเสมอก็ได้', isCorrect: false },
      { id: 'reason-short-time', emoji: '⌛', label: 'ออกไปไม่นานจึงไม่ต้องเตรียมน้ำ', isCorrect: false }
    ]
  },
  {
    id: 'A-after-lunch-water',
    form: 'A',
    family: 'afternoon',
    difficulty: 'easy',
    title: 'หลังพักเที่ยงก่อนเข้าคาบบ่าย',
    text: 'หลังพักเที่ยง เด็กคนหนึ่งกำลังจะกลับเข้าเรียนคาบบ่ายต่อทันที',
    hint: 'คิดถึงสิ่งที่ช่วยให้สดชื่นและพร้อมเรียนต่อ',
    question: 'ควรทำอะไรดีที่สุด',
    choices: [
      { id: 'sip-before-class', emoji: '💧', label: 'จิบน้ำก่อนเข้าคาบบ่าย', sub: 'ช่วยให้พร้อมเรียนต่อ', isCorrect: true },
      { id: 'wait-home', emoji: '🏠', label: 'รอกลับบ้านค่อยดื่ม', sub: 'ช้าเกินไป', isCorrect: false },
      { id: 'sweet-only', emoji: '🥤', label: 'ดื่มน้ำหวานแทนน้ำเปล่า', sub: 'ไม่ใช่ตัวเลือกหลัก', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-ready-learn', emoji: '📘', label: 'ยังมีเรียนต่อ ควรเติมน้ำก่อนเข้าคาบ', isCorrect: true },
      { id: 'reason-not-thirsty', emoji: '🙈', label: 'ถ้ายังไม่กระหายมากก็ยังไม่ต้องดื่ม', isCorrect: false },
      { id: 'reason-faster', emoji: '⏱️', label: 'ข้ามการดื่มน้ำจะได้รีบเข้าเรียนกว่า', isCorrect: false }
    ]
  },
  {
    id: 'A-school-trip-ready',
    form: 'A',
    family: 'prepare',
    difficulty: 'medium',
    title: 'เตรียมตัวก่อนออกจากห้องเรียน',
    text: 'ครูกำลังพาเด็ก ๆ ออกจากห้องไปทำกิจกรรมนอกอาคารประมาณ 1 ชั่วโมง',
    hint: 'ลองคิดว่าควรเตรียมตัวเรื่องน้ำอย่างไร',
    question: 'ควรเลือกแบบไหนดีที่สุด',
    choices: [
      { id: 'bring-water-bottle', emoji: '🎒', label: 'พกขวดน้ำติดตัวไปด้วย', sub: 'หยิบดื่มได้สะดวก', isCorrect: true },
      { id: 'bring-snack-only', emoji: '🍪', label: 'พกขนมอย่างเดียวก็พอ', sub: 'ยังไม่ช่วยเติมน้ำ', isCorrect: false },
      { id: 'prepare-nothing', emoji: '🫥', label: 'ไม่ต้องเตรียมอะไรเป็นพิเศษ', sub: 'ไม่เหมาะกับกิจกรรมนอกห้อง', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-outside-longer', emoji: '☀️', label: 'อยู่นอกห้องนานขึ้น ควรเตรียมน้ำไว้ก่อน', isCorrect: true },
      { id: 'reason-can-wait', emoji: '⌛', label: 'ค่อยรอจนกลับเข้าห้องค่อยดื่มก็ได้', isCorrect: false },
      { id: 'reason-food-enough', emoji: '🍬', label: 'มีขนมแล้วจึงไม่ต้องสนใจเรื่องน้ำ', isCorrect: false }
    ]
  },

  {
    id: 'B-hot-classroom',
    form: 'B',
    family: 'hotclass',
    difficulty: 'easy',
    title: 'วันที่อากาศร้อนมาก',
    text: 'วันนี้อากาศร้อนกว่าปกติ แม้อยู่ในห้องเรียนก็ยังรู้สึกร้อนง่าย',
    hint: 'คิดถึงนิสัยที่ช่วยดูแลตัวเองได้ระหว่างวัน',
    question: 'ควรทำอย่างไรดีที่สุด',
    choices: [
      { id: 'drink-often', emoji: '🫗', label: 'ดื่มน้ำเป็นระยะ', sub: 'ค่อย ๆ เติมน้ำระหว่างวัน', isCorrect: true },
      { id: 'skip-all', emoji: '🚫', label: 'ไม่ต้องดื่มน้ำเลย', sub: 'ไม่เหมาะสม', isCorrect: false },
      { id: 'icecream-only', emoji: '🍦', label: 'กินไอศกรีมอย่างเดียวพอ', sub: 'ไม่ใช่ทางเลือกหลัก', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-hot', emoji: '☀️', label: 'อากาศร้อน ควรเติมน้ำระหว่างวัน', isCorrect: true },
      { id: 'reason-indoor', emoji: '🏫', label: 'อยู่ในห้องเรียนจึงไม่ต้องสนใจเรื่องน้ำ', isCorrect: false },
      { id: 'reason-cold-food', emoji: '❄️', label: 'ของเย็นทุกอย่างแทนน้ำเปล่าได้', isCorrect: false }
    ]
  },
  {
    id: 'B-pe-class',
    form: 'B',
    family: 'pe',
    difficulty: 'easy',
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
      { id: 'reason-rest-enough', emoji: '🪑', label: 'แค่นั่งพักก็พอ ไม่ต้องดื่มน้ำก็ได้', isCorrect: false },
      { id: 'reason-sweet-better', emoji: '🍭', label: 'หลังพละควรเลือกของหวานแทนน้ำเปล่า', isCorrect: false }
    ]
  },
  {
    id: 'B-aircon-class',
    form: 'B',
    family: 'aircon',
    difficulty: 'medium',
    title: 'เรียนในห้องแอร์ทั้งวัน',
    text: 'วันนี้เด็ก ๆ เรียนในห้องแอร์ทั้งวัน บางคนเลยคิดว่าไม่จำเป็นต้องดื่มน้ำ',
    hint: 'ลองคิดว่าร่างกายยังต้องการน้ำไหมแม้ไม่ได้ร้อนมาก',
    question: 'ควรเลือกแบบไหน',
    choices: [
      { id: 'sip-in-aircon', emoji: '💧', label: 'จิบน้ำเป็นช่วง ๆ แม้อยู่ห้องแอร์', sub: 'ยังควรดื่มน้ำตามปกติ', isCorrect: true },
      { id: 'drink-evening-only', emoji: '🌙', label: 'รอกลับบ้านตอนเย็นค่อยดื่ม', sub: 'ช้าเกินไป', isCorrect: false },
      { id: 'replace-with-soda', emoji: '🥤', label: 'ดื่มน้ำอัดลมแทนน้ำเปล่า', sub: 'ไม่ใช่ตัวเลือกหลัก', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-still-need-water', emoji: '🧠', label: 'ถึงอยู่ห้องแอร์ ร่างกายก็ยังต้องการน้ำ', isCorrect: true },
      { id: 'reason-not-sweating', emoji: '🪶', label: 'ถ้าไม่เหงื่อออกก็ไม่จำเป็นต้องดื่มน้ำ', isCorrect: false },
      { id: 'reason-one-big-drink', emoji: '🫙', label: 'ดื่มครั้งเดียวเยอะ ๆ ตอนเย็นดีกว่า', isCorrect: false }
    ]
  },
  {
    id: 'B-assembly-sun',
    form: 'B',
    family: 'sunline',
    difficulty: 'medium',
    title: 'เข้าแถวกลางแดด',
    text: 'วันนี้ต้องเข้าแถวกลางแดดนานกว่าปกติ ก่อนขึ้นเรียนคาบเช้า',
    hint: 'ลองคิดว่าควรเตรียมตัวก่อนและหลังอยู่กลางแดดอย่างไร',
    question: 'ควรทำอะไรเหมาะที่สุด',
    choices: [
      { id: 'before-after-water', emoji: '🌤️', label: 'ดื่มน้ำก่อนหรือหลังเข้าแถวตามความเหมาะสม', sub: 'ช่วยดูแลร่างกายในวันที่ร้อน', isCorrect: true },
      { id: 'wait-headache', emoji: '🤕', label: 'รอจนเวียนหัวก่อนค่อยดื่ม', sub: 'ไม่ควรรอให้มีอาการ', isCorrect: false },
      { id: 'just-endure', emoji: '🪨', label: 'ทนไปก่อน ไม่ต้องสนใจเรื่องน้ำ', sub: 'ไม่เหมาะ', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-sun-heat', emoji: '☀️', label: 'อากาศร้อน ควรใส่ใจเรื่องน้ำมากขึ้น', isCorrect: true },
      { id: 'reason-short', emoji: '⌚', label: 'ถ้าไม่นานมากก็ไม่ต้องดื่มน้ำก็ได้', isCorrect: false },
      { id: 'reason-busy', emoji: '📣', label: 'ตอนเช้ายุ่งจึงข้ามเรื่องดื่มน้ำได้', isCorrect: false }
    ]
  },
  {
    id: 'B-sports-day',
    form: 'B',
    family: 'sports',
    difficulty: 'medium',
    title: 'วันมีกิจกรรมกีฬา',
    text: 'วันนี้โรงเรียนมีกิจกรรมกีฬาช่วงบ่าย เด็กหลายคนต้องเดินและเชียร์กลางแดด',
    hint: 'คิดถึงการดูแลตัวเองในวันที่ร้อนและใช้แรงมากขึ้น',
    question: 'ควรทำอย่างไรดีที่สุด',
    choices: [
      { id: 'drink-regularly', emoji: '🫗', label: 'ดื่มน้ำเป็นช่วง ๆ ระหว่างวัน', sub: 'ช่วยดูแลร่างกายในวันที่ใช้แรง', isCorrect: true },
      { id: 'drink-after-only', emoji: '🌙', label: 'รอให้กิจกรรมจบแล้วค่อยดื่ม', sub: 'ช้าเกินไป', isCorrect: false },
      { id: 'cold-sweet-drink', emoji: '🥤', label: 'เลือกแต่น้ำหวานเย็นแทนน้ำเปล่า', sub: 'ไม่ใช่ตัวเลือกหลัก', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-hot-active', emoji: '🏃', label: 'วันนี้ทั้งร้อนและใช้แรง ควรเติมน้ำสม่ำเสมอ', isCorrect: true },
      { id: 'reason-cheer-only', emoji: '📣', label: 'ถ้าไม่ได้วิ่งเองก็ไม่ต้องสนใจเรื่องน้ำ', isCorrect: false },
      { id: 'reason-one-time', emoji: '🫙', label: 'ดื่มครั้งเดียวเยอะ ๆ ตอนท้ายวันดีกว่า', isCorrect: false }
    ]
  },
  {
    id: 'B-hot-morning-line',
    form: 'B',
    family: 'morningheat',
    difficulty: 'easy',
    title: 'เช้าวันที่ร้อนผิดปกติ',
    text: 'เช้าวันนี้อากาศร้อนตั้งแต่ก่อนเข้าเรียน และเด็กบางคนเริ่มบ่นว่าคอแห้ง',
    hint: 'คิดถึงสิ่งที่ควรทำตั้งแต่ช่วงต้นวัน',
    question: 'ควรทำอะไรเหมาะที่สุด',
    choices: [
      { id: 'drink-early', emoji: '💧', label: 'จิบน้ำตั้งแต่ช่วงเช้า', sub: 'เริ่มดูแลร่างกายได้ทันเวลา', isCorrect: true },
      { id: 'ignore-morning', emoji: '🚫', label: 'ยังไม่ต้องดื่ม รอเที่ยงก่อน', sub: 'รอนานเกินไป', isCorrect: false },
      { id: 'ice-only', emoji: '🍦', label: 'กินของเย็นแทนน้ำเปล่า', sub: 'ไม่ใช่ทางเลือกหลัก', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-start-early', emoji: '🌤️', label: 'วันที่ร้อนควรเริ่มใส่ใจเรื่องน้ำตั้งแต่ช่วงเช้า', isCorrect: true },
      { id: 'reason-classroom-later', emoji: '🏫', label: 'เดี๋ยวเข้าเรียนในห้องแล้วจึงไม่ต้องดื่มตอนนี้', isCorrect: false },
      { id: 'reason-not-sweat-yet', emoji: '🪶', label: 'ยังไม่เหงื่อออกมากจึงยังไม่จำเป็นต้องดื่ม', isCorrect: false }
    ]
  },

  {
    id: 'C-exam-day',
    form: 'C',
    family: 'exam',
    difficulty: 'medium',
    title: 'วันสอบ',
    text: 'วันนี้มีสอบ เด็กคนหนึ่งตั้งใจอ่านหนังสือจนลืมดื่มน้ำ',
    hint: 'คิดถึงสิ่งที่ช่วยให้พร้อมและมีสมาธิ',
    question: 'ควรทำอย่างไรดีที่สุด',
    choices: [
      { id: 'water-nearby', emoji: '🧴', label: 'เตรียมน้ำไว้ใกล้ตัวและจิบเป็นระยะ', sub: 'ช่วยไม่ให้ลืมดื่มน้ำ', isCorrect: true },
      { id: 'no-water-until-finish', emoji: '🚫', label: 'งดดื่มน้ำจนสอบเสร็จ', sub: 'ไม่เหมาะ', isCorrect: false },
      { id: 'sweet-coffee', emoji: '☕', label: 'ดื่มเครื่องดื่มหวานแทนน้ำ', sub: 'ไม่ใช่ตัวเลือกหลักสำหรับเด็ก', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-focus', emoji: '📘', label: 'เพราะยังต้องใช้สมาธิ ควรวางน้ำไว้ใกล้ตัว', isCorrect: true },
      { id: 'reason-dont-waste-time', emoji: '⏱️', label: 'ไม่ควรเสียเวลากับการดื่มน้ำระหว่างวัน', isCorrect: false },
      { id: 'reason-once-enough', emoji: '🫙', label: 'ดื่มรวดเดียวตอนหลังสอบก็น่าจะพอ', isCorrect: false }
    ]
  },
  {
    id: 'C-home-day',
    form: 'C',
    family: 'home',
    difficulty: 'easy',
    title: 'วันหยุดอยู่บ้าน',
    text: 'วันหยุดอยู่บ้าน ไม่ได้ออกไปไหน เด็กบางคนเลยคิดว่าไม่ต้องดื่มน้ำมาก',
    hint: 'ลองคิดว่านิสัยที่ดีควรทำเฉพาะวันเรียนหรือทุกวัน',
    question: 'ควรเลือกแบบไหนดี',
    choices: [
      { id: 'drink-normal', emoji: '💧', label: 'ยังดื่มน้ำเป็นช่วง ๆ ตามปกติ', sub: 'นิสัยที่ดีควรทำต่อเนื่อง', isCorrect: true },
      { id: 'ignore-water', emoji: '🙈', label: 'อยู่บ้านเลยไม่ต้องสนใจเรื่องน้ำ', sub: 'ไม่เหมาะ', isCorrect: false },
      { id: 'sweet-milk-only', emoji: '🧋', label: 'ดื่มแต่นมหวานหรือชานมแทนน้ำ', sub: 'ไม่ควรแทนทั้งหมด', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-everyday', emoji: '📅', label: 'เพราะร่างกายยังต้องการน้ำทุกวัน', isCorrect: true },
      { id: 'reason-no-activity', emoji: '🛋️', label: 'ถ้าอยู่บ้านเฉย ๆ ก็ไม่จำเป็นต้องดื่มน้ำมาก', isCorrect: false },
      { id: 'reason-treat-day', emoji: '🎉', label: 'วันหยุดจึงเลือกเครื่องดื่มหวานแทนน้ำได้', isCorrect: false }
    ]
  },
  {
    id: 'C-forget-water',
    form: 'C',
    family: 'forget',
    difficulty: 'medium',
    title: 'เล่นเพลินจนลืมดื่มน้ำ',
    text: 'ตอนพักกลางวัน เด็กคนหนึ่งเล่นสนุกมากจนลืมดื่มน้ำ',
    hint: 'คิดว่าถ้าพลาดไปแล้วควรแก้อย่างไร',
    question: 'ควรทำอะไรต่อ',
    choices: [
      { id: 'recover-water', emoji: '🫗', label: 'นึกได้แล้วค่อย ๆ ดื่มน้ำและเตือนตัวเองรอบหน้า', sub: 'เป็นวิธีแก้ที่เหมาะกว่า', isCorrect: true },
      { id: 'skip-rest-day', emoji: '🚫', label: 'ไม่ต้องดื่มแล้ว ปล่อยผ่านทั้งวัน', sub: 'ไม่เหมาะ', isCorrect: false },
      { id: 'salty-snack', emoji: '🍟', label: 'กินขนมแทนน้ำ', sub: 'ไม่ช่วยเติมน้ำ', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-fix-habit', emoji: '🔁', label: 'ถ้าลืมแล้วควรรีบปรับและหาวิธีเตือนตัวเอง', isCorrect: true },
      { id: 'reason-too-late', emoji: '🌙', label: 'ลืมไปแล้วจึงไม่ต้องดื่มอีกก็ได้', isCorrect: false },
      { id: 'reason-food-first', emoji: '🍬', label: 'กินอะไรอย่างอื่นก่อนก็แทนน้ำได้', isCorrect: false }
    ]
  },
  {
    id: 'C-sweet-drink-belief',
    form: 'C',
    family: 'sweetdrink',
    difficulty: 'medium',
    title: 'คิดว่าน้ำหวานแทนน้ำเปล่าได้',
    text: 'เด็กคนหนึ่งคิดว่า ถ้าดื่มชานมหรือน้ำหวาน ก็เหมือนดื่มน้ำแล้ว',
    hint: 'ลองแยกให้ออกว่าอะไรควรเป็นเครื่องดื่มหลักระหว่างวัน',
    question: 'ควรตอบอย่างไรดีที่สุด',
    choices: [
      { id: 'water-main', emoji: '💧', label: 'น้ำเปล่าควรเป็นหลัก น้ำหวานไม่ควรแทนทั้งหมด', sub: 'เป็นแนวคิดที่ถูกต้องกว่า', isCorrect: true },
      { id: 'all-same', emoji: '🥤', label: 'ดื่มอะไรก็เหมือนกันหมด', sub: 'ไม่ถูกต้อง', isCorrect: false },
      { id: 'sweet-only', emoji: '🍭', label: 'ถ้าดื่มน้ำหวานแล้วก็ไม่ต้องดื่มน้ำเปล่าอีก', sub: 'ไม่เหมาะ', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-water-main', emoji: '✅', label: 'เพราะน้ำเปล่าควรเป็นเครื่องดื่มหลักระหว่างวัน', isCorrect: true },
      { id: 'reason-same-liquid', emoji: '🧪', label: 'เพราะทุกเครื่องดื่มเป็นของเหลวเหมือนกันหมด', isCorrect: false },
      { id: 'reason-tasty-best', emoji: '😋', label: 'เพราะอร่อยกว่าน้ำเปล่าจึงเลือกแทนได้', isCorrect: false }
    ]
  },
  {
    id: 'C-reading-day',
    form: 'C',
    family: 'study',
    difficulty: 'medium',
    title: 'วันอ่านหนังสืออยู่บ้าน',
    text: 'วันหยุด เด็กคนหนึ่งนั่งอ่านหนังสือและทำการบ้านต่อเนื่องนานหลายช่วง',
    hint: 'คิดถึงการดูแลตัวเองในวันที่ใช้สมาธินาน ๆ',
    question: 'ควรทำอย่างไรดีที่สุด',
    choices: [
      { id: 'keep-water-nearby', emoji: '🧴', label: 'วางน้ำไว้ใกล้ตัวและจิบเป็นช่วง', sub: 'ช่วยไม่ให้ลืมดื่มน้ำ', isCorrect: true },
      { id: 'finish-then-drink', emoji: '⌛', label: 'ทำงานให้เสร็จก่อนแล้วค่อยดื่ม', sub: 'รอนานเกินไป', isCorrect: false },
      { id: 'sweet-drink-main', emoji: '🧋', label: 'ดื่มแต่น้ำหวานแทนน้ำเปล่า', sub: 'ไม่ควรเป็นตัวเลือกหลัก', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-study-focus', emoji: '📚', label: 'ใช้สมาธินาน ควรวางน้ำไว้ใกล้ตัวและดื่มเป็นช่วง', isCorrect: true },
      { id: 'reason-home-ok', emoji: '🛋️', label: 'อยู่บ้านจึงไม่ต้องวางแผนเรื่องน้ำมาก', isCorrect: false },
      { id: 'reason-once-later', emoji: '🫙', label: 'ดื่มครั้งเดียวหลังทำงานเสร็จก็น่าจะพอ', isCorrect: false }
    ]
  },
  {
    id: 'C-habit-plan',
    form: 'C',
    family: 'habit',
    difficulty: 'easy',
    title: 'ฝึกนิสัยดื่มน้ำทุกวัน',
    text: 'เด็กคนหนึ่งอยากฝึกนิสัยดื่มน้ำให้ดีขึ้น แต่บางวันก็มักลืม',
    hint: 'คิดถึงวิธีที่ช่วยให้ทำได้ต่อเนื่อง',
    question: 'ควรเลือกแนวทางแบบไหนดีที่สุด',
    choices: [
      { id: 'plan-daily', emoji: '📅', label: 'ตั้งใจดื่มน้ำเป็นช่วง ๆ ทุกวัน', sub: 'ช่วยสร้างนิสัยที่ดี', isCorrect: true },
      { id: 'only-when-thirsty', emoji: '🤔', label: 'ดื่มเฉพาะตอนกระหายมาก', sub: 'ยังไม่ใช่นิสัยที่ดีที่สุด', isCorrect: false },
      { id: 'sweet-reward', emoji: '🍭', label: 'ดื่มน้ำหวานแทนน้ำเปล่าในหลายช่วง', sub: 'ไม่ควรแทนทั้งหมด', isCorrect: false }
    ],
    reasons: [
      { id: 'reason-build-habit', emoji: '✅', label: 'การดื่มเป็นช่วง ๆ ช่วยให้ทำต่อเนื่องจนเป็นนิสัย', isCorrect: true },
      { id: 'reason-thirst-signal-only', emoji: '🙈', label: 'รอให้กระหายมากก่อนแล้วค่อยดื่มก็พอ', isCorrect: false },
      { id: 'reason-tasty-easier', emoji: '😋', label: 'ถ้าอร่อยกว่าก็ควรเลือกแทนน้ำเปล่าได้เลย', isCorrect: false }
    ]
  }
];

export const HYDRATION_V2_CONFIDENCE = [
  { id: 'low', emoji: '🤔', label: 'ยังไม่ค่อยมั่นใจ' },
  { id: 'mid', emoji: '🙂', label: 'มั่นใจปานกลาง' },
  { id: 'high', emoji: '🌟', label: 'มั่นใจมาก' }
];

export function cloneHydrationScenario(item) {
  return {
    ...item,
    choices: Array.isArray(item?.choices) ? item.choices.map(x => ({ ...x })) : [],
    reasons: Array.isArray(item?.reasons) ? item.reasons.map(x => ({ ...x })) : []
  };
}

export function shuffleHydrationArray(arr = [], randomFn = Math.random) {
  const out = Array.isArray(arr) ? arr.slice() : [];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(randomFn() * (i + 1));
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

export function shuffleHydrationScenario(item, randomFn = Math.random) {
  const cloned = cloneHydrationScenario(item);
  cloned.choices = shuffleHydrationArray(cloned.choices, randomFn);
  cloned.reasons = shuffleHydrationArray(cloned.reasons, randomFn);
  return cloned;
}

export function resolveHydrationScenarioForm(stateLike = {}) {
  const explicit = String(
    stateLike.form ||
    stateLike.postForm ||
    stateLike.researchForm ||
    ''
  ).toUpperCase();

  if (explicit === 'A' || explicit === 'B' || explicit === 'C') return explicit;

  const phase = String(
    stateLike.testPhase ||
    stateLike.researchPhase ||
    stateLike.phaseTag ||
    ''
  ).toLowerCase();

  if (phase === 'pre' || phase === 'pretest') return 'A';
  if (phase === 'delayed' || phase === 'followup' || phase === 'retention') return 'C';

  return 'B';
}

export function pickHydrationScenarioBatch({
  stateLike = {},
  count = 6,
  randomFn = Math.random,
  avoidFamilies = []
} = {}) {
  const form = resolveHydrationScenarioForm(stateLike);
  const familyBan = new Set(Array.isArray(avoidFamilies) ? avoidFamilies : []);

  let pool = HYDRATION_V2_SCENARIOS.filter(
    (x) => x.form === form && !familyBan.has(x.family)
  );
  pool = shuffleHydrationArray(pool, randomFn);

  const picked = [];
  const usedFamilies = new Set();

  for (const item of pool) {
    if (usedFamilies.has(item.family)) continue;
    picked.push(shuffleHydrationScenario(item, randomFn));
    usedFamilies.add(item.family);
    if (picked.length >= count) break;
  }

  if (picked.length < count) {
    const extra = shuffleHydrationArray(
      HYDRATION_V2_SCENARIOS.filter(
        (x) => x.form === form && !picked.some((p) => p.id === x.id)
      ),
      randomFn
    );

    for (const item of extra) {
      picked.push(shuffleHydrationScenario(item, randomFn));
      if (picked.length >= count) break;
    }
  }

  return picked;
}