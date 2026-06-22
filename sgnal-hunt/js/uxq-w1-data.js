// === /sgnal-hunt/js/uxq-w1-data.js ===
// UX Quest • W1 UX Detective
// CSAI2601 • Year 2
// 36-case replay bank
//
// Skill families:
// 1) Entry & Navigation
// 2) Information Label
// 3) CTA & Action Clarity
// 4) Feedback & System Status
// 5) Information Priority
// 6) Confirmation & Predictability

(function () {
  'use strict';

  const ABC = ['A', 'B', 'C'];

  const AREA_ORDERS = [
    ['correct', 'noise1', 'noise2'],
    ['noise1', 'correct', 'noise2'],
    ['noise1', 'noise2', 'correct'],
    ['noise2', 'correct', 'noise1'],
    ['correct', 'noise2', 'noise1'],
    ['noise2', 'noise1', 'correct']
  ];

  const RESULT_METRICS = [
    {
      before: { success: 42, time: '2:18', confidence: 38 },
      after: { success: 87, time: '0:46', confidence: 84 }
    },
    {
      before: { success: 48, time: '2:42', confidence: 31 },
      after: { success: 92, time: '0:58', confidence: 92 }
    },
    {
      before: { success: 51, time: '3:05', confidence: 46 },
      after: { success: 90, time: '0:51', confidence: 86 }
    },
    {
      before: { success: 55, time: '1:37', confidence: 44 },
      after: { success: 91, time: '0:39', confidence: 89 }
    },
    {
      before: { success: 46, time: '2:56', confidence: 40 },
      after: { success: 92, time: '0:54', confidence: 91 }
    },
    {
      before: { success: 50, time: '2:21', confidence: 43 },
      after: { success: 89, time: '0:48', confidence: 87 }
    }
  ];

  function rotate(list, offset) {
    const safeOffset = offset % list.length;
    return [
      ...list.slice(safeOffset),
      ...list.slice(0, safeOffset)
    ];
  }

  function makeAreas(correct, noise1, noise2, offset) {
    const map = {
      correct: {
        id: 'target',
        ...correct
      },
      noise1: {
        id: 'noise-1',
        ...noise1
      },
      noise2: {
        id: 'noise-2',
        ...noise2
      }
    };

    const orderedKeys = AREA_ORDERS[offset % AREA_ORDERS.length];

    return orderedKeys.map((key, index) => ({
      ...map[key],
      label: ABC[index]
    }));
  }

  function getMetrics(offset) {
    return RESULT_METRICS[offset % RESULT_METRICS.length];
  }

  function optionsWithRotation(options, offset) {
    return rotate(options, offset % options.length);
  }

  function makeBaseCase(config) {
    const {
      id,
      skill,
      title,
      service,
      goal,
      quote,
      persona,
      heading,
      subheading,
      target,
      noise1,
      noise2,
      diagnosis,
      fixes,
      explain,
      resultText,
      offset
    } = config;

    return {
      id,
      skill,
      title,
      service,
      goal,
      quote,
      persona,

      suspectId: 'target',

      screen: {
        heading,
        subheading,
        areas: makeAreas(target, noise1, noise2, offset)
      },

      diagnosis: {
        prompt: diagnosis.prompt,
        principle: diagnosis.principle,
        options: optionsWithRotation(diagnosis.options, offset)
      },

      fixes: optionsWithRotation(fixes, offset + 1),

      result: {
        text: resultText,
        ...getMetrics(offset)
      },

      explain: {
        prompt: explain.prompt,
        choices: optionsWithRotation(explain.choices, offset + 2),
        correct: explain.correct
      }
    };
  }

  function entryCase(config, offset) {
    return makeBaseCase({
      ...config,
      skill: 'entry-navigation',

      target: {
        name: 'เมนูบริการหลายหมวด',
        detail: config.menuItems
      },

      noise1: {
        name: 'ข่าวและประกาศ',
        detail: 'ข่าวประชาสัมพันธ์ กิจกรรม และกำหนดการทั่วไป'
      },

      noise2: {
        name: 'บัญชีผู้ใช้',
        detail: 'ชื่อผู้ใช้ รหัสนักศึกษา และการตั้งค่าบัญชี'
      },

      diagnosis: {
        prompt: `เหตุใดผู้ใช้จึงเริ่ม ${config.action} ได้ยากที่สุด?`,
        principle: 'ผู้ใช้ควรมองเห็นจุดเริ่มต้นของงานสำคัญอย่างชัดเจน',
        options: [
          {
            id: 'entry-correct',
            correct: true,
            text: `เมนูมีหลายทางเลือก แต่ยังไม่ชี้ชัดว่าผู้ใช้ควรเริ่ม "${config.action}" จากจุดใด`
          },
          {
            id: 'entry-color',
            correct: false,
            text: 'หน้าเว็บควรใช้สีมากขึ้น เพื่อให้ดูน่าสนใจและมีชีวิตชีวา'
          },
          {
            id: 'entry-profile',
            correct: false,
            text: 'ผู้ใช้ควรเห็นข้อมูลบัญชีของตนเองก่อนเริ่มทุกงานเสมอ'
          }
        ]
      },

      fixes: [
        {
          id: 'entry-fix-correct',
          correct: true,
          text: `เพิ่มปุ่มเริ่มต้น "${config.action}" ให้เด่นด้านบน และจัดเมนูรองเป็นหมวดบริการ`
        },
        {
          id: 'entry-fix-more-menu',
          correct: false,
          text: 'เพิ่มเมนูทุกหน่วยงานลงในหน้าแรก เพื่อให้ผู้ใช้มีตัวเลือกมากขึ้น'
        },
        {
          id: 'entry-fix-banner',
          correct: false,
          text: 'เพิ่ม Banner ขนาดใหญ่หลายภาพ เพื่อให้หน้าแรกดูน่าสนใจขึ้น'
        }
      ],

      resultText: `เมื่อผู้ใช้เห็นจุดเริ่มต้น "${config.action}" ชัดเจน เขาสามารถเริ่มงานได้ทันทีโดยไม่ต้องอ่านทุกเมนู`,

      explain: {
        prompt: 'ผลลัพธ์ใดสะท้อนว่า Design Fix นี้ช่วยผู้ใช้ทำเป้าหมายได้ดีขึ้นจริง?',
        choices: [
          'ผู้ใช้เริ่มต้นงานได้เร็วขึ้น',
          `ผู้ใช้หาเส้นทาง "${config.action}" ได้ง่ายขึ้น`,
          'หน้าเว็บมีองค์ประกอบมากขึ้น',
          'เมนูมีจำนวนรายการเพิ่มขึ้น'
        ],
        correct: [
          'ผู้ใช้เริ่มต้นงานได้เร็วขึ้น',
          `ผู้ใช้หาเส้นทาง "${config.action}" ได้ง่ายขึ้น`
        ]
      },

      offset
    });
  }

  function labelCase(config, offset) {
    return makeBaseCase({
      ...config,
      skill: 'information-label',

      target: {
        name: `ปุ่ม "${config.unclearLabel}"`,
        detail: `คำบนปุ่มไม่บอกชัดว่าผู้ใช้จะ ${config.expectedAction}`
      },

      noise1: {
        name: 'ข้อความเงื่อนไข',
        detail: 'รายละเอียด ระเบียบ และข้อกำหนดการใช้บริการ'
      },

      noise2: {
        name: 'ช่องทางติดต่อ',
        detail: 'ข้อมูลติดต่อเจ้าหน้าที่และคำถามที่พบบ่อย'
      },

      diagnosis: {
        prompt: `อะไรทำให้ผู้ใช้ไม่มั่นใจว่าปุ่ม "${config.unclearLabel}" จะทำอะไรต่อ?`,
        principle: 'คำบนปุ่มควรบอกการกระทำและผลลัพธ์ให้เข้าใจได้ทันที',
        options: [
          {
            id: 'label-correct',
            correct: true,
            text: `คำว่า "${config.unclearLabel}" กว้างเกินไป ผู้ใช้จึงคาดเดาไม่ได้ว่ากดแล้วจะ ${config.expectedAction}`
          },
          {
            id: 'label-more-text',
            correct: false,
            text: 'ข้อความเงื่อนไขควรยาวขึ้น เพื่อให้ผู้ใช้รู้ว่าระบบจริงจัง'
          },
          {
            id: 'label-contact',
            correct: false,
            text: 'ควรวางข้อมูลติดต่อเจ้าหน้าที่ไว้บนสุดของทุกหน้าเสมอ'
          }
        ]
      },

      fixes: [
        {
          id: 'label-fix-correct',
          correct: true,
          text: `เปลี่ยนคำบนปุ่มเป็น "${config.clearLabel}" เพื่อบอกการกระทำแก่ผู้ใช้โดยตรง`
        },
        {
          id: 'label-fix-icon',
          correct: false,
          text: 'ตัดคำบนปุ่มออก แล้วใช้ไอคอนอย่างเดียวเพื่อให้หน้าจอดูสะอาดขึ้น'
        },
        {
          id: 'label-fix-long',
          correct: false,
          text: 'เปลี่ยนคำบนปุ่มให้ยาวและเป็นทางการมากขึ้น แม้ผู้ใช้ต้องอ่านนานกว่าเดิม'
        }
      ],

      resultText: `เมื่อปุ่มบอกชัดว่า "${config.clearLabel}" ผู้ใช้คาดเดาผลลัพธ์ของการกดได้ก่อนตัดสินใจ`,

      explain: {
        prompt: 'เหตุใดการตั้งชื่อปุ่มให้ชัดจึงช่วยให้ผู้ใช้ทำงานสำเร็จ?',
        choices: [
          'ผู้ใช้คาดเดาผลลัพธ์หลังการกดได้',
          'ผู้ใช้ตัดสินใจเลือกการกระทำได้มั่นใจขึ้น',
          'ผู้ใช้เห็นปุ่มจำนวนมากขึ้น',
          'ผู้ใช้ต้องอ่านข้อความเงื่อนไขมากขึ้น'
        ],
        correct: [
          'ผู้ใช้คาดเดาผลลัพธ์หลังการกดได้',
          'ผู้ใช้ตัดสินใจเลือกการกระทำได้มั่นใจขึ้น'
        ]
      },

      offset
    });
  }

  function ctaCase(config, offset) {
    return makeBaseCase({
      ...config,
      skill: 'cta-action-clarity',

      target: {
        name: `ปุ่มหลัก "${config.currentLabel}"`,
        detail: `ปุ่มหลักดูคล้ายปุ่มรอง อยู่ไกลจากงานที่ผู้ใช้กำลังทำ และไม่เด่นพอ`
      },

      noise1: {
        name: 'ข้อความอธิบายบริการ',
        detail: 'คำอธิบายขั้นตอนและข้อมูลทั่วไปของบริการ'
      },

      noise2: {
        name: 'ศูนย์ช่วยเหลือ',
        detail: 'คำถามที่พบบ่อยและช่องทางติดต่อเจ้าหน้าที่'
      },

      diagnosis: {
        prompt: `อะไรทำให้ผู้ใช้ไม่กล้ากด "${config.currentLabel}" เพื่อ ${config.action}?`,
        principle: 'การกระทำหลักควรเด่น ชัด และสัมพันธ์กับงานที่ผู้ใช้กำลังทำ',
        options: [
          {
            id: 'cta-correct',
            correct: true,
            text: `ปุ่มหลักไม่สื่อความหมายและไม่โดดเด่นพอ ผู้ใช้จึงไม่รู้ว่ากดแล้วจะ ${config.action}`
          },
          {
            id: 'cta-text',
            correct: false,
            text: 'คำอธิบายบริการควรยาวขึ้น เพื่อให้ผู้ใช้ใช้เวลาอ่านก่อนกดปุ่ม'
          },
          {
            id: 'cta-help',
            correct: false,
            text: 'ควรเพิ่มเมนูช่วยเหลือหลายตำแหน่ง เพื่อให้ผู้ใช้เห็นตัวเลือกมากขึ้น'
          }
        ]
      },

      fixes: [
        {
          id: 'cta-fix-correct',
          correct: true,
          text: `ใช้ปุ่มหลัก "${config.clearLabel}" วางใกล้งานที่ทำ และแยกจากปุ่มรองอย่างชัดเจน`
        },
        {
          id: 'cta-fix-animation',
          correct: false,
          text: 'เพิ่มแอนิเมชันให้ทุกปุ่มเคลื่อนไหวพร้อมกัน เพื่อดึงสายตาผู้ใช้'
        },
        {
          id: 'cta-fix-many',
          correct: false,
          text: 'เพิ่มปุ่มหลายปุ่ม เช่น ยืนยัน ดำเนินการ บันทึก ต่อไป เพื่อให้ผู้ใช้เลือกเอง'
        }
      ],

      resultText: `เมื่อปุ่มหลักเด่นและชื่อปุ่มบอกว่า "${config.clearLabel}" ผู้ใช้กล้าตัดสินใจทำงานต่อมากขึ้น`,

      explain: {
        prompt: 'ผลลัพธ์ใดบอกว่าปุ่มหลักใหม่ช่วยผู้ใช้ได้จริง?',
        choices: [
          'ผู้ใช้แยกปุ่มหลักกับปุ่มรองได้ง่ายขึ้น',
          `ผู้ใช้เข้าใจว่ากดแล้วจะ ${config.action}`,
          'ผู้ใช้เห็นปุ่มเพิ่มขึ้น',
          'ผู้ใช้ใช้เวลาตกแต่งหน้าจอนานขึ้น'
        ],
        correct: [
          'ผู้ใช้แยกปุ่มหลักกับปุ่มรองได้ง่ายขึ้น',
          `ผู้ใช้เข้าใจว่ากดแล้วจะ ${config.action}`
        ]
      },

      offset
    });
  }

  function feedbackCase(config, offset) {
    return makeBaseCase({
      ...config,
      skill: 'feedback-system-status',

      target: {
        name: 'หน้าจอหลังผู้ใช้กดส่ง',
        detail: `ไม่มีสถานะกำลังดำเนินการ ไม่มีข้อความยืนยัน และผู้ใช้ไม่รู้ว่าต้อง ${config.nextStep}`
      },

      noise1: {
        name: 'พื้นที่แนบข้อมูล',
        detail: 'ช่องสำหรับแนบเอกสารหรือรายละเอียดเพิ่มเติม'
      },

      noise2: {
        name: 'คำถามที่พบบ่อย',
        detail: 'ข้อมูลทั่วไปเกี่ยวกับขั้นตอนและเงื่อนไขบริการ'
      },

      diagnosis: {
        prompt: 'อะไรคือปัญหาหลักที่ทำให้ผู้ใช้ไม่มั่นใจว่าระบบดำเนินการสำเร็จหรือไม่?',
        principle: 'ระบบควรบอกสถานะของการทำงานให้ผู้ใช้เข้าใจได้',
        options: [
          {
            id: 'feedback-correct',
            correct: true,
            text: 'ระบบไม่แสดงสถานะหรือผลลัพธ์หลังผู้ใช้กดส่ง จึงไม่รู้ว่าควรรอ ทำซ้ำ หรือทำอะไรต่อ'
          },
          {
            id: 'feedback-upload',
            correct: false,
            text: 'ผู้ใช้ควรแนบไฟล์หรือข้อมูลเพิ่มเติมให้มากขึ้นก่อนส่งทุกครั้ง'
          },
          {
            id: 'feedback-faq',
            correct: false,
            text: 'ควรเพิ่มคำถามที่พบบ่อยให้มีจำนวนมากกว่าเดิม'
          }
        ]
      },

      fixes: [
        {
          id: 'feedback-fix-correct',
          correct: true,
          text: `แสดงสถานะกำลังดำเนินการ ตามด้วยข้อความยืนยัน พร้อมข้อมูลว่า "${config.nextStep}"`
        },
        {
          id: 'feedback-fix-color',
          correct: false,
          text: 'เปลี่ยนพื้นหลังหน้าเว็บเป็นสีใหม่ทันทีหลังผู้ใช้กดส่ง'
        },
        {
          id: 'feedback-fix-popup',
          correct: false,
          text: 'แสดง Pop-up ขนาดใหญ่ที่ปิดไม่ได้ แต่ไม่บอกว่าระบบกำลังทำอะไร'
        }
      ],

      resultText: 'ผู้ใช้เห็นว่าระบบกำลังทำงาน รู้ว่าการกระทำสำเร็จ และรู้ว่าต้องทำอะไรต่อไป',

      explain: {
        prompt: 'หลังเพิ่มสถานะและข้อความยืนยัน ผู้ใช้ได้รับประโยชน์อะไรจริง?',
        choices: [
          'ผู้ใช้รู้ว่าระบบรับคำสั่งแล้ว',
          `ผู้ใช้รู้ว่าต้อง ${config.nextStep}`,
          'ผู้ใช้เห็นข้อความบนจอมากขึ้น',
          'ผู้ใช้ต้องกดส่งซ้ำหลายครั้งขึ้น'
        ],
        correct: [
          'ผู้ใช้รู้ว่าระบบรับคำสั่งแล้ว',
          `ผู้ใช้รู้ว่าต้อง ${config.nextStep}`
        ]
      },

      offset
    });
  }

  function priorityCase(config, offset) {
    return makeBaseCase({
      ...config,
      skill: 'information-priority',

      target: {
        name: config.urgentItem,
        detail: `ข้อมูลสำคัญถูกวางไว้ท้ายหน้า หลัง ${config.secondaryContent}`
      },

      noise1: {
        name: 'การ์ดโปรไฟล์ผู้ใช้',
        detail: 'ชื่อ รูปโปรไฟล์ และข้อความต้อนรับผู้ใช้'
      },

      noise2: {
        name: 'ข่าวชุมชนและกิจกรรม',
        detail: 'ข่าวประชาสัมพันธ์และข้อความจากผู้ใช้คนอื่น'
      },

      diagnosis: {
        prompt: `เหตุใดผู้ใช้จึงพลาด "${config.urgentItem}" แม้ข้อมูลอยู่ในหน้าเดียวกัน?`,
        principle: 'ข้อมูลที่สำคัญต่อเป้าหมายผู้ใช้ต้องถูกจัดลำดับให้มองเห็นก่อน',
        options: [
          {
            id: 'priority-correct',
            correct: true,
            text: 'ข้อมูลที่ผู้ใช้ต้องใช้เร่งด่วนถูกวางไว้เป็นเรื่องรอง จึงไม่เด่นเมื่อเทียบกับข้อมูลสำคัญน้อยกว่า'
          },
          {
            id: 'priority-profile',
            correct: false,
            text: 'การ์ดโปรไฟล์ผู้ใช้ควรมีรูปใหญ่ขึ้น เพื่อให้หน้าจอดูน่าสนใจ'
          },
          {
            id: 'priority-chat',
            correct: false,
            text: 'ข่าวชุมชนควรมีสีสันและข้อความมากขึ้น เพื่อให้ผู้ใช้หยุดอ่าน'
          }
        ]
      },

      fixes: [
        {
          id: 'priority-fix-correct',
          correct: true,
          text: `ย้าย "${config.urgentItem}" ขึ้นส่วนบนของหน้า และแยกเป็นข้อมูลเร่งด่วนที่ผู้ใช้เห็นทันที`
        },
        {
          id: 'priority-fix-decor',
          correct: false,
          text: 'เพิ่มพื้นหลังตกแต่งให้ข่าวชุมชน เพื่อให้หน้า Dashboard ดูสนุกขึ้น'
        },
        {
          id: 'priority-fix-more-news',
          correct: false,
          text: 'เพิ่มข่าวประชาสัมพันธ์อีกหลายรายการในส่วนบนของหน้า'
        }
      ],

      resultText: 'เมื่อข้อมูลเร่งด่วนปรากฏก่อน ผู้ใช้สามารถตัดสินใจและทำงานสำคัญได้ทันเวลา',

      explain: {
        prompt: 'การจัดลำดับข้อมูลใหม่ช่วยผู้ใช้ตามเป้าหมายอย่างไร?',
        choices: [
          'ผู้ใช้เห็นงานที่ต้องทำก่อนเรื่องรอง',
          'ผู้ใช้ตัดสินใจจัดการงานสำคัญได้เร็วขึ้น',
          'ผู้ใช้มีข่าวประชาสัมพันธ์ให้อ่านมากขึ้น',
          'ผู้ใช้ใช้เวลากับข้อมูลรองมากขึ้น'
        ],
        correct: [
          'ผู้ใช้เห็นงานที่ต้องทำก่อนเรื่องรอง',
          'ผู้ใช้ตัดสินใจจัดการงานสำคัญได้เร็วขึ้น'
        ]
      },

      offset
    });
  }

  function confirmationCase(config, offset) {
    return makeBaseCase({
      ...config,
      skill: 'confirmation-predictability',

      target: {
        name: config.selectionArea,
        detail: `ผู้ใช้เลือกข้อมูลแล้ว แต่ระบบยังไม่สรุปว่า "${config.summaryText}" ก่อนยืนยัน`
      },

      noise1: {
        name: config.noiseOneName,
        detail: config.noiseOneDetail
      },

      noise2: {
        name: 'ข้อมูลติดต่อเจ้าหน้าที่',
        detail: 'เบอร์โทร อีเมล และเวลาทำการ'
      },

      diagnosis: {
        prompt: `อะไรทำให้ผู้ใช้ไม่มั่นใจว่าจะ ${config.finalAction} ได้ถูกต้อง?`,
        principle: 'ก่อนยืนยันงานสำคัญ ระบบควรทำให้ผู้ใช้เห็นสิ่งที่จะเกิดขึ้นอย่างชัดเจน',
        options: [
          {
            id: 'confirmation-correct',
            correct: true,
            text: `ระบบยังไม่สรุป "${config.summaryText}" ให้ผู้ใช้ตรวจสอบก่อนยืนยัน`
          },
          {
            id: 'confirmation-images',
            correct: false,
            text: 'รายการควรมีรูปภาพขนาดใหญ่ขึ้นทุกส่วน เพื่อให้ผู้ใช้เลื่อนดูนานขึ้น'
          },
          {
            id: 'confirmation-contact',
            correct: false,
            text: 'ควรย้ายข้อมูลติดต่อเจ้าหน้าที่ไว้ด้านบนสุดของหน้าทุกครั้ง'
          }
        ]
      },

      fixes: [
        {
          id: 'confirmation-fix-correct',
          correct: true,
          text: `เพิ่ม Summary ก่อนยืนยัน เพื่อให้ผู้ใช้ตรวจสอบ "${config.summaryText}" แล้วค่อยกด "${config.confirmLabel}"`
        },
        {
          id: 'confirmation-fix-more-list',
          correct: false,
          text: 'เพิ่มรายการตัวเลือกให้ยาวขึ้น เพื่อให้ผู้ใช้เลื่อนดูข้อมูลมากกว่าเดิม'
        },
        {
          id: 'confirmation-fix-banner',
          correct: false,
          text: 'เพิ่ม Banner ประชาสัมพันธ์ไว้เหนือส่วนที่ผู้ใช้กำลังเลือก'
        }
      ],

      resultText: 'ผู้ใช้ตรวจสอบสิ่งที่เลือกได้ก่อนยืนยัน จึงลดความผิดพลาดและมั่นใจว่าการทำรายการถูกต้อง',

      explain: {
        prompt: 'เหตุใด Summary ก่อนยืนยันจึงช่วยให้ผู้ใช้ทำงานสำเร็จมากขึ้น?',
        choices: [
          'ผู้ใช้ตรวจสอบรายละเอียดสำคัญก่อนยืนยันได้',
          `ผู้ใช้รู้ว่าระบบกำลังจะ ${config.finalAction} อะไรให้ตนเอง`,
          'ผู้ใช้เห็นรูปภาพจำนวนมากขึ้น',
          'ผู้ใช้ต้องเลื่อนหน้าจอนานขึ้น'
        ],
        correct: [
          'ผู้ใช้ตรวจสอบรายละเอียดสำคัญก่อนยืนยันได้',
          `ผู้ใช้รู้ว่าระบบกำลังจะ ${config.finalAction} อะไรให้ตนเอง`
        ]
      },

      offset
    });
  }

  const ENTRY_CASES = [
    {
      id: 'entry-help-center',
      service: 'Smart Campus Help Center',
      title: 'เริ่มต้นไม่ถูก',
      goal: 'นักศึกษาต้องการเริ่มส่งคำร้องขอเอกสารออนไลน์ให้สำเร็จ',
      quote: 'ฉันเข้าหน้านี้แล้ว แต่ไม่รู้เลยว่าต้องเริ่มจากเมนูไหน',
      persona: 'พลอย • นักศึกษาปี 2 • ใช้ระบบครั้งแรก',
      heading: 'Smart Campus Help Center',
      subheading: 'เลือกบริการที่ต้องการ หรือค้นหาข้อมูลเพิ่มเติมจากเมนูด้านล่าง',
      action: 'ขอเอกสาร',
      menuItems: [
        'ขอเอกสาร',
        'บริการทุน',
        'กิจกรรม',
        'กองทุน',
        'แบบฟอร์ม',
        'ติดต่อเจ้าหน้าที่',
        'คำถามที่พบบ่อย'
      ]
    },
    {
      id: 'entry-scholarship',
      service: 'Scholarship Portal',
      title: 'หาเส้นทางสมัครทุนไม่เจอ',
      goal: 'นักศึกษาต้องการเริ่มยื่นสมัครทุนการศึกษาให้ทันกำหนด',
      quote: 'ฉันเห็นข่าวทุนหลายอัน แต่ไม่รู้ว่าต้องกดสมัครตรงไหน',
      persona: 'โม • นักศึกษาปี 2 • เพิ่งสมัครทุนครั้งแรก',
      heading: 'Scholarship Portal',
      subheading: 'ข่าวสาร ทุนการศึกษา และบริการสนับสนุนนักศึกษา',
      action: 'ยื่นสมัครทุน',
      menuItems: [
        'ทุนเรียนดี',
        'ทุนกิจกรรม',
        'ทุนฉุกเฉิน',
        'ประกาศผล',
        'ระเบียบทุน',
        'ดาวน์โหลดแบบฟอร์ม',
        'ติดต่อกองพัฒนานักศึกษา'
      ]
    },
    {
      id: 'entry-repair-report',
      service: 'Campus Repair Service',
      title: 'แจ้งซ่อมไม่รู้เริ่มตรงไหน',
      goal: 'นักศึกษาต้องการแจ้งซ่อมเครื่องฉายภาพในห้องเรียน',
      quote: 'ห้องเรียนใช้โปรเจกเตอร์ไม่ได้ แต่หน้าเว็บมีเมนูเต็มไปหมด',
      persona: 'ต้น • นักศึกษาปี 2 • ต้องใช้ห้องเรียนภายในวันนี้',
      heading: 'Campus Repair Service',
      subheading: 'บริการแจ้งซ่อมอาคาร ห้องเรียน และอุปกรณ์มหาวิทยาลัย',
      action: 'แจ้งซ่อมอุปกรณ์',
      menuItems: [
        'อาคารสถานที่',
        'ระบบไฟฟ้า',
        'เครื่องปรับอากาศ',
        'อุปกรณ์ห้องเรียน',
        'ติดตามงานซ่อม',
        'คู่มือใช้งาน',
        'ติดต่อช่าง'
      ]
    },
    {
      id: 'entry-event-registration',
      service: 'Campus Activity Hub',
      title: 'สมัครกิจกรรมไม่รู้ทางเข้า',
      goal: 'นักศึกษาต้องการลงทะเบียนเข้าร่วมกิจกรรมเสริมหลักสูตร',
      quote: 'ฉันเห็นโปสเตอร์กิจกรรม แต่หาเมนูลงทะเบียนไม่เจอ',
      persona: 'เจน • นักศึกษาปี 2 • ต้องสะสมชั่วโมงกิจกรรม',
      heading: 'Campus Activity Hub',
      subheading: 'รวมกิจกรรม ข่าวชมรม และการสะสมชั่วโมงกิจกรรม',
      action: 'ลงทะเบียนกิจกรรม',
      menuItems: [
        'กิจกรรมวันนี้',
        'กิจกรรมชมรม',
        'ประวัติชั่วโมง',
        'ข่าวประชาสัมพันธ์',
        'แกลเลอรี',
        'แบบประเมิน',
        'ติดต่อผู้จัด'
      ]
    },
    {
      id: 'entry-library-resource',
      service: 'Library Digital Resources',
      title: 'เข้าใช้ฐานข้อมูลไม่เจอ',
      goal: 'นักศึกษาต้องการเข้าใช้ฐานข้อมูลบทความเพื่อทำรายงาน',
      quote: 'มีชื่อฐานข้อมูลเต็มหน้าไปหมด แต่ไม่รู้ต้องเริ่มค้นจากอะไร',
      persona: 'ภพ • นักศึกษาปี 2 • ทำรายงานกลุ่มครั้งแรก',
      heading: 'Library Digital Resources',
      subheading: 'ฐานข้อมูล หนังสืออิเล็กทรอนิกส์ และบริการห้องสมุด',
      action: 'ค้นหาบทความ',
      menuItems: [
        'ฐานข้อมูลไทย',
        'ฐานข้อมูลต่างประเทศ',
        'E-book',
        'วารสาร',
        'คู่มืออ้างอิง',
        'อบรมการค้นข้อมูล',
        'ติดต่อบรรณารักษ์'
      ]
    },
    {
      id: 'entry-internship',
      service: 'Internship Preparation Portal',
      title: 'เริ่มเตรียมฝึกงานไม่ถูก',
      goal: 'นักศึกษาต้องการเริ่มส่งข้อมูลความประสงค์ฝึกงาน',
      quote: 'หน้าเว็บมีทั้งข่าว บริษัท เอกสาร และประกาศ จนไม่รู้ว่าต้องเริ่มทำอะไร',
      persona: 'ไอซ์ • นักศึกษาปี 2 • เริ่มวางแผนฝึกงานล่วงหน้า',
      heading: 'Internship Preparation Portal',
      subheading: 'ข้อมูลสถานประกอบการ เอกสาร และขั้นตอนเตรียมฝึกงาน',
      action: 'ส่งความประสงค์ฝึกงาน',
      menuItems: [
        'บริษัทแนะนำ',
        'เอกสารฝึกงาน',
        'ประกาศรับสมัคร',
        'กำหนดการ',
        'ประสบการณ์รุ่นพี่',
        'คำถามที่พบบ่อย',
        'ติดต่ออาจารย์นิเทศ'
      ]
    }
  ];

  const LABEL_CASES = [
    {
      id: 'label-document-request',
      service: 'Document Request Form',
      title: 'คำบนปุ่มไม่บอกผลลัพธ์',
      goal: 'นักศึกษาต้องการส่งคำร้องขอใบรับรองการเป็นนักศึกษา',
      quote: 'ฉันไม่แน่ใจว่า “ดำเนินการ” คือส่งคำร้องจริง หรือแค่ไปหน้าถัดไป',
      persona: 'ก้อง • นักศึกษาปี 2 • ใช้มือถือระหว่างเดินไปเรียน',
      heading: 'แบบฟอร์มขอเอกสาร',
      subheading: 'กรอกข้อมูลให้ครบถ้วนก่อนทำรายการในขั้นตอนถัดไป',
      unclearLabel: 'ดำเนินการ',
      expectedAction: 'ส่งคำร้องขอเอกสาร',
      clearLabel: 'ส่งคำร้องขอเอกสาร'
    },
    {
      id: 'label-tuition-payment',
      service: 'Tuition Payment Portal',
      title: 'ไปต่อคือไปไหน?',
      goal: 'นักศึกษาต้องการชำระค่าธรรมเนียมการศึกษาออนไลน์',
      quote: 'ฉันเลือกยอดเงินแล้ว แต่ปุ่ม “ไปต่อ” ไม่บอกเลยว่าจะชำระเงินจริงหรือไม่',
      persona: 'เมย์ • นักศึกษาปี 2 • ชำระค่าธรรมเนียมครั้งแรก',
      heading: 'Tuition Payment Portal',
      subheading: 'ตรวจสอบยอดค้างชำระและเลือกช่องทางการชำระเงิน',
      unclearLabel: 'ไปต่อ',
      expectedAction: 'เข้าสู่ขั้นตอนชำระเงิน',
      clearLabel: 'ไปชำระเงิน'
    },
    {
      id: 'label-leave-request',
      service: 'Leave Request System',
      title: 'จัดการคำร้องคืออะไร?',
      goal: 'นักศึกษาต้องการส่งคำร้องขอลากิจให้เรียบร้อย',
      quote: 'ปุ่มเขียนว่า “จัดการคำร้อง” แต่ฉันไม่รู้ว่ามันจะส่งคำร้องหรือแก้ข้อมูล',
      persona: 'บีม • นักศึกษาปี 2 • ต้องยื่นคำร้องก่อนเข้าเรียน',
      heading: 'Leave Request System',
      subheading: 'สร้าง ตรวจสอบ และติดตามคำร้องลาของนักศึกษา',
      unclearLabel: 'จัดการคำร้อง',
      expectedAction: 'ส่งคำร้องลา',
      clearLabel: 'ส่งคำร้องลา'
    },
    {
      id: 'label-course-registration',
      service: 'Course Registration',
      title: 'ทำต่อแต่ไม่รู้ทำอะไร',
      goal: 'นักศึกษาต้องการยืนยันรายวิชาที่เลือกลงทะเบียน',
      quote: 'ฉันเลือกวิชาแล้ว แต่ปุ่ม “ทำต่อ” ไม่ได้บอกว่ามันจะยืนยันวิชาหรือเปล่า',
      persona: 'นนท์ • นักศึกษาปี 2 • ลงทะเบียนเรียนด้วยตนเอง',
      heading: 'Course Registration',
      subheading: 'ตรวจสอบรายวิชาที่เลือกก่อนยืนยันการลงทะเบียน',
      unclearLabel: 'ทำต่อ',
      expectedAction: 'ยืนยันการลงทะเบียนรายวิชา',
      clearLabel: 'ยืนยันการลงทะเบียน'
    },
    {
      id: 'label-project-submission',
      service: 'Group Project Submission',
      title: 'ยืนยันอะไร?',
      goal: 'นักศึกษาต้องการส่งไฟล์งานกลุ่มให้ผู้สอน',
      quote: 'ปุ่ม “ยืนยัน” ทำให้ฉันกลัว เพราะไม่รู้ว่ากดแล้วส่งงานเลยหรือยังแก้ไฟล์ได้',
      persona: 'ฟ้า • นักศึกษาปี 2 • ส่งงานกลุ่มก่อนหมดเขต',
      heading: 'Group Project Submission',
      subheading: 'อัปโหลดไฟล์และยืนยันการส่งงานกลุ่ม',
      unclearLabel: 'ยืนยัน',
      expectedAction: 'ส่งไฟล์งานกลุ่ม',
      clearLabel: 'ส่งงานกลุ่ม'
    },
    {
      id: 'label-dorm-repair',
      service: 'Dormitory Repair Request',
      title: 'ส่งเรื่องไม่ชัดว่าจบหรือยัง',
      goal: 'นักศึกษาต้องการแจ้งซ่อมอุปกรณ์ในหอพัก',
      quote: 'ปุ่ม “ส่งเรื่อง” ฟังเหมือนแจ้งเฉย ๆ ไม่รู้ว่าจะเปิดใบงานซ่อมให้จริงไหม',
      persona: 'อาร์ต • นักศึกษาปี 2 • อยู่หอพักมหาวิทยาลัย',
      heading: 'Dormitory Repair Request',
      subheading: 'แจ้งปัญหาห้องพักและติดตามสถานะงานซ่อม',
      unclearLabel: 'ส่งเรื่อง',
      expectedAction: 'เปิดคำร้องแจ้งซ่อม',
      clearLabel: 'ส่งคำร้องแจ้งซ่อม'
    }
  ];

  const CTA_CASES = [
    {
      id: 'cta-document-form',
      service: 'Document Request Form',
      title: 'ปุ่มหลักไม่เด่น',
      goal: 'นักศึกษาต้องการส่งคำร้องขอเอกสารหลังกรอกฟอร์มครบ',
      quote: 'ฉันไม่แน่ใจว่าปุ่มนี้ส่งคำร้องจริง หรือแค่บันทึกร่างไว้',
      persona: 'ก้อง • นักศึกษาปี 2 • ใช้มือถือระหว่างเดินไปเรียน',
      heading: 'แบบฟอร์มขอเอกสาร',
      subheading: 'กรอกข้อมูลให้ครบถ้วนก่อนดำเนินการในขั้นตอนถัดไป',
      currentLabel: 'ดำเนินการ',
      action: 'ส่งคำร้องขอเอกสาร',
      clearLabel: 'ส่งคำร้องขอเอกสาร'
    },
    {
      id: 'cta-room-booking',
      service: 'Study Room Booking',
      title: 'จองห้องแต่หา ปุ่มยืนยันไม่เจอ',
      goal: 'นักศึกษาต้องการจองห้องอ่านหนังสือสำหรับทำงานกลุ่ม',
      quote: 'ฉันเลือกห้องและเวลาแล้ว แต่ปุ่มยืนยันเล็กมากจนเกือบไม่เห็น',
      persona: 'กลุ่มนักศึกษาปี 2 • ต้องจองห้องภายในวันนี้',
      heading: 'Study Room Booking',
      subheading: 'เลือกห้อง วันที่ และช่วงเวลาที่ต้องการใช้งาน',
      currentLabel: 'เลือกต่อ',
      action: 'ยืนยันการจองห้อง',
      clearLabel: 'ยืนยันการจองห้อง'
    },
    {
      id: 'cta-repair-urgent',
      service: 'Urgent Repair Service',
      title: 'แจ้งเหตุเร่งด่วนแต่ปุ่มเหมือนปุ่มรอง',
      goal: 'นักศึกษาต้องการแจ้งอุปกรณ์ห้องเรียนชำรุดอย่างเร่งด่วน',
      quote: 'ปุ่มแจ้งเหตุเร่งด่วนกับปุ่มบันทึกร่างหน้าตาเหมือนกันจนไม่กล้ากด',
      persona: 'ต้น • นักศึกษาปี 2 • อยู่หน้าห้องเรียนที่ใช้งานไม่ได้',
      heading: 'Urgent Repair Service',
      subheading: 'แจ้งปัญหาอุปกรณ์และห้องเรียนเพื่อให้เจ้าหน้าที่ดำเนินการ',
      currentLabel: 'ดำเนินการ',
      action: 'ส่งแจ้งเหตุเร่งด่วน',
      clearLabel: 'ส่งแจ้งเหตุเร่งด่วน'
    },
    {
      id: 'cta-event-register',
      service: 'Campus Event Registration',
      title: 'สมัครกิจกรรมแต่ปุ่มดูไม่ใช่จุดจบ',
      goal: 'นักศึกษาต้องการลงทะเบียนร่วมกิจกรรมเสริมหลักสูตร',
      quote: 'ปุ่ม “เสร็จสิ้น” อยู่ล่างสุดและดูเหมือนปุ่มปิดหน้า ไม่เหมือนปุ่มสมัครกิจกรรม',
      persona: 'เจน • นักศึกษาปี 2 • ต้องสะสมชั่วโมงกิจกรรม',
      heading: 'Campus Event Registration',
      subheading: 'ตรวจสอบรายละเอียดกิจกรรมก่อนลงทะเบียนเข้าร่วม',
      currentLabel: 'เสร็จสิ้น',
      action: 'ลงทะเบียนกิจกรรม',
      clearLabel: 'ลงทะเบียนเข้าร่วมกิจกรรม'
    },
    {
      id: 'cta-group-upload',
      service: 'Group Work Upload',
      title: 'บันทึกไม่เท่ากับส่งงาน',
      goal: 'นักศึกษาต้องการส่งงานกลุ่มให้ผู้สอนตรวจ',
      quote: 'ฉันเห็นปุ่ม “บันทึก” แต่ไม่รู้ว่าอาจารย์จะเห็นไฟล์แล้วหรือยัง',
      persona: 'ฟ้า • นักศึกษาปี 2 • ส่งงานก่อนหมดเขต',
      heading: 'Group Work Upload',
      subheading: 'อัปโหลดไฟล์งานกลุ่มและส่งให้ผู้สอนตรวจ',
      currentLabel: 'บันทึก',
      action: 'ส่งงานให้ผู้สอน',
      clearLabel: 'ส่งงานให้ผู้สอน'
    },
    {
      id: 'cta-advisor-appointment',
      service: 'Advisor Appointment',
      title: 'นัดอาจารย์แต่ปุ่มต่อไปไม่ชัด',
      goal: 'นักศึกษาต้องการยืนยันเวลานัดหมายอาจารย์ที่ปรึกษา',
      quote: 'ฉันเลือกเวลานัดแล้ว แต่ปุ่ม “ต่อไป” ไม่บอกว่าจะยืนยันหรือแค่กลับไปเลือกเวลาใหม่',
      persona: 'ไนซ์ • นักศึกษาปี 2 • นัดปรึกษาเรื่องการเรียน',
      heading: 'Advisor Appointment',
      subheading: 'เลือกวัน เวลา และหัวข้อที่ต้องการเข้าพบอาจารย์',
      currentLabel: 'ต่อไป',
      action: 'ยืนยันเวลานัดหมาย',
      clearLabel: 'ยืนยันเวลานัดหมาย'
    }
  ];

  const FEEDBACK_CASES = [
    {
      id: 'feedback-document',
      service: 'Document Request Tracking',
      title: 'ส่งแล้วหรือยัง?',
      goal: 'นักศึกษาต้องการรู้ว่าระบบได้รับคำร้องและต้องทำอะไรต่อ',
      quote: 'ฉันกดส่งแล้วหน้าจอเงียบมาก เลยกดซ้ำไปสามครั้ง',
      persona: 'มีน • นักศึกษาปี 2 • กำลังรีบส่งเอกสารก่อนหมดเขต',
      heading: 'ส่งคำร้องขอเอกสาร',
      subheading: 'กรุณาตรวจสอบข้อมูลก่อนส่งคำร้องเข้าสู่ระบบ',
      nextStep: 'ใช้เลขติดตามเพื่อตรวจสอบสถานะ'
    },
    {
      id: 'feedback-payment',
      service: 'Tuition Payment',
      title: 'ชำระเงินแล้วไม่รู้ว่าระบบรับหรือยัง',
      goal: 'นักศึกษาต้องการยืนยันว่าการชำระค่าธรรมเนียมสำเร็จ',
      quote: 'ฉันกดจ่ายเงินแล้วกลับมาหน้าเดิม เลยไม่รู้ว่าต้องจ่ายใหม่หรือรอ',
      persona: 'เมย์ • นักศึกษาปี 2 • ชำระค่าธรรมเนียมใกล้วันสุดท้าย',
      heading: 'Tuition Payment',
      subheading: 'ตรวจสอบยอดค้างชำระและข้อมูลการชำระเงิน',
      nextStep: 'เก็บใบเสร็จและตรวจสอบสถานะการชำระ'
    },
    {
      id: 'feedback-course-registration',
      service: 'Course Registration',
      title: 'ลงทะเบียนสำเร็จหรือยัง?',
      goal: 'นักศึกษาต้องการทราบว่ารายวิชาถูกบันทึกในตารางเรียนแล้วหรือไม่',
      quote: 'ฉันกดลงทะเบียนแล้ว แต่ไม่มีอะไรเปลี่ยนบนหน้าจอเลย',
      persona: 'นนท์ • นักศึกษาปี 2 • ลงทะเบียนรายวิชาด้วยตนเอง',
      heading: 'Course Registration',
      subheading: 'เลือกและยืนยันรายวิชาที่ต้องการลงทะเบียน',
      nextStep: 'ตรวจสอบตารางเรียนและสถานะรายวิชา'
    },
    {
      id: 'feedback-repair',
      service: 'Repair Request Tracking',
      title: 'แจ้งซ่อมแล้วใครรับเรื่อง?',
      goal: 'นักศึกษาต้องการทราบว่างานซ่อมถูกเปิดและส่งต่อเจ้าหน้าที่แล้วหรือไม่',
      quote: 'ฉันแจ้งเครื่องปรับอากาศเสีย แต่ไม่มีเลขงานหรือสถานะให้ดู',
      persona: 'อาร์ต • นักศึกษาปี 2 • อยู่หอพักมหาวิทยาลัย',
      heading: 'Repair Request Tracking',
      subheading: 'แจ้งปัญหาและติดตามการดำเนินงานของเจ้าหน้าที่',
      nextStep: 'ติดตามเลขงานซ่อมและเวลาที่คาดว่าจะดำเนินการ'
    },
    {
      id: 'feedback-activity',
      service: 'Activity Registration',
      title: 'สมัครกิจกรรมแล้วมีชื่อหรือไม่?',
      goal: 'นักศึกษาต้องการทราบว่าตนเองได้สิทธิ์เข้าร่วมกิจกรรมแล้วหรือไม่',
      quote: 'ฉันกดสมัคร แต่ไม่รู้ว่าระบบรับชื่อหรือที่เต็มไปแล้ว',
      persona: 'เจน • นักศึกษาปี 2 • ต้องการสะสมชั่วโมงกิจกรรม',
      heading: 'Activity Registration',
      subheading: 'เลือกกิจกรรมและลงทะเบียนเข้าร่วม',
      nextStep: 'ตรวจสอบสถานะการสมัครและรายละเอียดกิจกรรม'
    },
    {
      id: 'feedback-assignment',
      service: 'Assignment Submission',
      title: 'ส่งไฟล์แล้วหรือยัง?',
      goal: 'นักศึกษาต้องการมั่นใจว่าอาจารย์ได้รับไฟล์งานแล้ว',
      quote: 'ฉันอัปโหลดไฟล์เสร็จ แต่ไม่เห็นชื่อไฟล์หรือเวลาในการส่งเลย',
      persona: 'ฟ้า • นักศึกษาปี 2 • ส่งงานกลุ่มก่อนหมดเขต',
      heading: 'Assignment Submission',
      subheading: 'อัปโหลดไฟล์และยืนยันการส่งงาน',
      nextStep: 'ตรวจสอบชื่อไฟล์ เวลา และสถานะการส่งงาน'
    }
  ];

  const PRIORITY_CASES = [
    {
      id: 'priority-scholarship',
      service: 'Student Service Dashboard',
      title: 'กำหนดสมัครทุนถูกกลืนหาย',
      goal: 'นักศึกษาต้องการเห็นกำหนดส่งเอกสารทุนที่ใกล้ที่สุด',
      quote: 'ฉันเพิ่งเห็นวันสุดท้ายตอนสายไปแล้ว เพราะมันอยู่ล่างสุดของหน้า',
      persona: 'นนท์ • นักศึกษาปี 2 • กำลังเตรียมเอกสารสมัครทุน',
      heading: 'Student Service Dashboard',
      subheading: 'รวมข่าวสาร เอกสาร กิจกรรม และบริการสำหรับนักศึกษา',
      urgentItem: 'กำหนดส่งเอกสารสมัครทุน',
      secondaryContent: 'ข่าวประชาสัมพันธ์และกิจกรรมทั่วไป'
    },
    {
      id: 'priority-payment',
      service: 'Tuition Dashboard',
      title: 'วันสุดท้ายชำระเงินไม่เด่น',
      goal: 'นักศึกษาต้องการเห็นกำหนดชำระค่าธรรมเนียมก่อนถูกปรับ',
      quote: 'ข่าวกิจกรรมเต็มหน้า แต่วันชำระเงินกลับอยู่ล่างสุดจนฉันเกือบพลาด',
      persona: 'เมย์ • นักศึกษาปี 2 • ตรวจสอบยอดชำระด้วยมือถือ',
      heading: 'Tuition Dashboard',
      subheading: 'ข้อมูลยอดชำระ ใบเสร็จ ข่าวสาร และบริการการเงิน',
      urgentItem: 'กำหนดชำระค่าธรรมเนียม',
      secondaryContent: 'ข่าวกิจกรรมและบทความประชาสัมพันธ์'
    },
    {
      id: 'priority-class-cancel',
      service: 'Class Announcement Board',
      title: 'ประกาศย้ายห้องเรียนหาไม่เจอ',
      goal: 'นักศึกษาต้องการรู้ว่าคาบเรียนวันนี้ย้ายห้องหรือไม่',
      quote: 'ฉันเห็นโพสต์เก่าเยอะมาก แต่ประกาศย้ายห้องอยู่ท้ายสุด',
      persona: 'บีม • นักศึกษาปี 2 • กำลังเดินไปเรียน',
      heading: 'Class Announcement Board',
      subheading: 'ข่าวรายวิชา ประกาศอาจารย์ และข้อมูลการเรียน',
      urgentItem: 'ประกาศย้ายห้องเรียนวันนี้',
      secondaryContent: 'ประกาศเก่าและเนื้อหาทั่วไปของรายวิชา'
    },
    {
      id: 'priority-project-deadline',
      service: 'Project Workspace',
      title: 'กำหนดส่งงานกลุ่มไม่เด่น',
      goal: 'นักศึกษาต้องการเห็นสิ่งที่ทีมต้องส่งก่อนถึงกำหนด',
      quote: 'ฉันเห็นแชตกับไฟล์เต็มไปหมด แต่ไม่เห็นว่าต้องส่งงานคืนนี้',
      persona: 'กลุ่ม CSAI ปี 2 • ทำโครงงานร่วมกัน',
      heading: 'Project Workspace',
      subheading: 'งานกลุ่ม ไฟล์สนทนา และความคืบหน้าโครงงาน',
      urgentItem: 'กำหนดส่งงานกลุ่มคืนนี้',
      secondaryContent: 'ข้อความแชตและไฟล์ที่อัปโหลดก่อนหน้า'
    },
    {
      id: 'priority-medical',
      service: 'Campus Health Appointment',
      title: 'เวลานัดพบแพทย์อยู่ท้ายหน้า',
      goal: 'นักศึกษาต้องการเห็นเวลานัดตรวจสุขภาพที่ใกล้ที่สุด',
      quote: 'ฉันเกือบพลาดนัดเพราะหน้าแรกโชว์บทความสุขภาพก่อนข้อมูลนัดของฉัน',
      persona: 'ภพ • นักศึกษาปี 2 • มีนัดตรวจในวันเดียวกัน',
      heading: 'Campus Health Appointment',
      subheading: 'นัดหมาย ตรวจสอบประวัติ และข้อมูลบริการสุขภาพ',
      urgentItem: 'เวลานัดตรวจสุขภาพวันนี้',
      secondaryContent: 'บทความสุขภาพและข่าวกิจกรรมรณรงค์'
    },
    {
      id: 'priority-registration',
      service: 'Registration Dashboard',
      title: 'กำหนดเปิดลงทะเบียนถูกซ่อน',
      goal: 'นักศึกษาต้องการรู้ว่าเมื่อใดจึงเริ่มลงทะเบียนรายวิชาได้',
      quote: 'ฉันเข้ามาดูทุกวัน แต่ข่าวเด่นหลายอันบังวันเปิดลงทะเบียนไว้หมด',
      persona: 'ไอซ์ • นักศึกษาปี 2 • วางแผนตารางเรียนเทอมหน้า',
      heading: 'Registration Dashboard',
      subheading: 'ข้อมูลการลงทะเบียน รายวิชา และประกาศการศึกษา',
      urgentItem: 'กำหนดเปิดลงทะเบียนรายวิชา',
      secondaryContent: 'ข่าวประชาสัมพันธ์และคำแนะนำทั่วไป'
    }
  ];

  const CONFIRMATION_CASES = [
    {
      id: 'confirmation-room',
      service: 'Room Booking',
      title: 'Transfer Challenge: จองห้องอ่านหนังสือ',
      goal: 'นักศึกษาต้องการจองห้องอ่านหนังสือสำหรับทำงานกลุ่มในวันพรุ่งนี้',
      quote: 'ฉันเลือกวันกับเวลาแล้ว แต่ไม่แน่ใจว่าระบบจองห้องให้จริงหรือยัง',
      persona: 'กลุ่มนักศึกษาปี 2 • ต้องจองห้องก่อนเริ่มทำโครงงาน',
      heading: 'Room Booking',
      subheading: 'เลือกห้อง วันที่ และช่วงเวลาที่ต้องการใช้งาน',
      selectionArea: 'ส่วนเลือกวันและเวลา',
      summaryText: 'ชื่อห้อง วันที่ และเวลาที่เลือก',
      finalAction: 'จอง',
      confirmLabel: 'ยืนยันการจอง',
      noiseOneName: 'รายการห้องอ่านหนังสือ',
      noiseOneDetail: 'ชื่อห้อง ความจุ และอุปกรณ์ที่มีในห้อง'
    },
    {
      id: 'confirmation-drop-course',
      service: 'Course Adjustment',
      title: 'ถอนรายวิชาแต่กลัวกดผิด',
      goal: 'นักศึกษาต้องการถอนรายวิชาหนึ่งรายวิชาอย่างถูกต้อง',
      quote: 'ฉันกลัวว่ากดแล้วจะถอนผิดวิชา เพราะหน้าจอไม่สรุปอะไรให้ดูก่อน',
      persona: 'โม • นักศึกษาปี 2 • ปรับแผนการเรียน',
      heading: 'Course Adjustment',
      subheading: 'ตรวจสอบและยืนยันการเพิ่มหรือถอนรายวิชา',
      selectionArea: 'รายการรายวิชาที่เลือก',
      summaryText: 'รหัสวิชา ชื่อวิชา และผลของการถอนรายวิชา',
      finalAction: 'ถอน',
      confirmLabel: 'ยืนยันการถอนรายวิชา',
      noiseOneName: 'รายวิชาแนะนำ',
      noiseOneDetail: 'รายการวิชาที่อาจสนใจในภาคเรียนถัดไป'
    },
    {
      id: 'confirmation-payment',
      service: 'Payment Confirmation',
      title: 'ยอดชำระไม่ถูกสรุปก่อนจ่าย',
      goal: 'นักศึกษาต้องการตรวจสอบยอดเงินก่อนยืนยันการชำระ',
      quote: 'ฉันกลัวว่าระบบจะตัดเงินผิดยอด เพราะไม่มีหน้าสรุปก่อนจ่าย',
      persona: 'เมย์ • นักศึกษาปี 2 • ชำระค่าธรรมเนียมออนไลน์',
      heading: 'Payment Confirmation',
      subheading: 'เลือกช่องทางชำระเงินและตรวจสอบข้อมูลก่อนยืนยัน',
      selectionArea: 'ส่วนเลือกยอดเงินและช่องทางชำระ',
      summaryText: 'ยอดเงิน ค่าธรรมเนียม และช่องทางชำระ',
      finalAction: 'ชำระ',
      confirmLabel: 'ยืนยันการชำระเงิน',
      noiseOneName: 'ประวัติใบเสร็จ',
      noiseOneDetail: 'รายการชำระเงินในภาคการศึกษาก่อนหน้า'
    },
    {
      id: 'confirmation-project',
      service: 'Project Submission',
      title: 'ส่งงานกลุ่มโดยไม่เห็นสรุปไฟล์',
      goal: 'นักศึกษาต้องการส่งไฟล์งานกลุ่มให้ถูกเวอร์ชัน',
      quote: 'มีไฟล์หลายชื่อ ฉันไม่แน่ใจว่าไฟล์ที่กำลังส่งคือฉบับสุดท้ายจริงหรือไม่',
      persona: 'ฟ้า • นักศึกษาปี 2 • ส่งงานร่วมกับเพื่อนอีก 4 คน',
      heading: 'Project Submission',
      subheading: 'เลือกไฟล์และยืนยันการส่งงานกลุ่ม',
      selectionArea: 'ส่วนเลือกไฟล์งาน',
      summaryText: 'ชื่อไฟล์ ขนาดไฟล์ เวลาส่ง และชื่อสมาชิกกลุ่ม',
      finalAction: 'ส่ง',
      confirmLabel: 'ยืนยันการส่งงาน',
      noiseOneName: 'ไฟล์เก่าของกลุ่ม',
      noiseOneDetail: 'เอกสารและไฟล์ฉบับร่างที่เคยอัปโหลด'
    },
    {
      id: 'confirmation-advisor',
      service: 'Advisor Appointment',
      title: 'นัดอาจารย์แต่ไม่เห็นสรุปเวลา',
      goal: 'นักศึกษาต้องการยืนยันวันและเวลานัดหมายอาจารย์',
      quote: 'ฉันเลือกเวลาหลายรอบจนไม่แน่ใจว่าสุดท้ายกำลังจะจองช่วงไหน',
      persona: 'ไนซ์ • นักศึกษาปี 2 • ต้องการปรึกษาแผนการเรียน',
      heading: 'Advisor Appointment',
      subheading: 'เลือกวัน เวลา และหัวข้อที่ต้องการเข้าพบอาจารย์',
      selectionArea: 'ส่วนเลือกวันและเวลา',
      summaryText: 'วัน เวลา อาจารย์ และหัวข้อที่นัดหมาย',
      finalAction: 'นัด',
      confirmLabel: 'ยืนยันเวลานัดหมาย',
      noiseOneName: 'ประวัติการนัด',
      noiseOneDetail: 'ข้อมูลการนัดพบอาจารย์ในอดีต'
    },
    {
      id: 'confirmation-event',
      service: 'Event Registration',
      title: 'สมัครกิจกรรมแต่ไม่เห็นข้อมูลสุดท้าย',
      goal: 'นักศึกษาต้องการยืนยันการสมัครกิจกรรมให้ถูกวันและรอบ',
      quote: 'กิจกรรมมีหลายรอบ ฉันกลัวกดสมัครผิดวันเพราะไม่มีหน้าสรุปก่อนยืนยัน',
      persona: 'เจน • นักศึกษาปี 2 • ต้องสะสมชั่วโมงกิจกรรม',
      heading: 'Event Registration',
      subheading: 'เลือกกิจกรรม วันที่ และรอบเวลาที่ต้องการเข้าร่วม',
      selectionArea: 'ส่วนเลือกกิจกรรมและรอบเวลา',
      summaryText: 'ชื่อกิจกรรม วันที่ รอบเวลา และจำนวนชั่วโมงกิจกรรม',
      finalAction: 'สมัคร',
      confirmLabel: 'ยืนยันการสมัครกิจกรรม',
      noiseOneName: 'กิจกรรมที่เคยเข้าร่วม',
      noiseOneDetail: 'ประวัติชั่วโมงกิจกรรมและใบประกาศเดิม'
    }
  ];

  const CASE_BANK = [
    ...ENTRY_CASES.map((config, index) => entryCase(config, index)),
    ...LABEL_CASES.map((config, index) => labelCase(config, index + 6)),
    ...CTA_CASES.map((config, index) => ctaCase(config, index + 12)),
    ...FEEDBACK_CASES.map((config, index) => feedbackCase(config, index + 18)),
    ...PRIORITY_CASES.map((config, index) => priorityCase(config, index + 24)),
    ...CONFIRMATION_CASES.map((config, index) => confirmationCase(config, index + 30))
  ];

  const FIRST_RUN_IDS = [
    'entry-help-center',
    'cta-document-form',
    'feedback-document',
    'priority-scholarship',
    'confirmation-room'
  ];

  const CASE_BY_ID = new Map(
    CASE_BANK.map((caseItem) => [caseItem.id, caseItem])
  );

  window.UXQ_W1_CASE_BANK = CASE_BANK;

  window.UXQ_W1_FIRST_RUN = FIRST_RUN_IDS
    .map((id) => CASE_BY_ID.get(id))
    .filter(Boolean);

  // รองรับ uxq-w1.js เวอร์ชันปัจจุบัน
  // ไฟล์ uxq-w1.js ฉบับถัดไปจะสุ่ม Replay Round จาก CASE_BANK
  window.UXQ_W1_CASES = window.UXQ_W1_FIRST_RUN;
})();