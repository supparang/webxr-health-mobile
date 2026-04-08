// === /herohealth/hygiene-zone.js ===
// PATCH v20260408-hygiene-zone-config
import { createZonePage } from './zone-core.js';

createZonePage({
  zoneKey: 'hygiene',
  zoneLabel: 'Hygiene',
  zoneEmoji: '🫧',
  heroTitle: 'Hygiene Zone',
  defaultCoachLine: 'เริ่มจากเกมที่ง่ายก่อน แล้วค่อยไปเกมสืบสวนหรือเกมที่ท้าทายขึ้นนะ',
  storagePrefix: 'HHA_HYGIENE',
  games: [
    {
      key: 'handwash',
      title: 'Handwash',
      emoji: '🧼',
      kicker: 'เริ่มง่าย',
      sub: 'ฝึกล้างมือให้ถูกขั้นตอน',
      desc: 'เรียนรู้การล้างมือให้สะอาดแบบเข้าใจง่าย เหมาะสำหรับเริ่มเล่นในโซนนี้',
      tags: ['เริ่มง่าย', 'สุขอนามัย', 'ทำตามขั้นตอน'],
      filters: ['all', 'easy'],
      accent: 'plate',
      path: './handwash-vr.html',
      game: 'handwash',
      gameId: 'handwash',
      theme: 'handwash',
      aliases: ['handwash', 'wash', 'ล้างมือ']
    },
    {
      key: 'brush',
      title: 'Brush',
      emoji: '🪥',
      kicker: 'ฝึกประจำวัน',
      sub: 'ฝึกแปรงฟันให้ครบและถูกวิธี',
      desc: 'ช่วยให้จำขั้นตอนการแปรงฟันและดูแลช่องปากได้ดีขึ้น',
      tags: ['ประจำวัน', 'ดูแลฟัน', 'ฝึกจำ'],
      filters: ['all', 'easy'],
      accent: 'groups',
      path: './brush-vr-kids.html',
      game: 'brush',
      gameId: 'brush',
      theme: 'brush',
      aliases: ['brush', 'แปรงฟัน']
    },
    {
      key: 'germ',
      title: 'Germ Detective',
      emoji: '🦠',
      kicker: 'สนุกท้าทาย',
      sub: 'สืบหาเชื้อโรคในฉากต่าง ๆ',
      desc: 'ฝึกสังเกต คิด และเลือกการป้องกันเชื้อโรคให้เหมาะสม',
      tags: ['ท้าทาย', 'สืบสวน', 'สังเกต'],
      filters: ['all', 'fun'],
      accent: 'goodjunk',
      path: './germ-detective-v2.html',
      game: 'germ',
      gameId: 'germ',
      theme: 'germ',
      aliases: ['germ', 'detective', 'เชื้อโรค']
    },
    {
      key: 'maskcough',
      title: 'Mask & Cough',
      emoji: '😷',
      kicker: 'เล่นสั้น',
      sub: 'ฝึกป้องกันการไอจามและใส่หน้ากาก',
      desc: 'ช่วยให้เข้าใจมารยาทการไอจามและการป้องกันตนเองในชีวิตประจำวัน',
      tags: ['เล่นสั้น', 'ป้องกัน', 'สุขภาพ'],
      filters: ['all', 'quick'],
      accent: 'hydration',
      path: './maskcough-v2.html',
      game: 'maskcough',
      gameId: 'maskcough',
      theme: 'maskcough',
      aliases: ['mask', 'cough', 'maskcough', 'หน้ากาก', 'ไอจาม']
    }
  ]
});