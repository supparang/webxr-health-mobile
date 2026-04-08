// === /herohealth/fitness-zone.js ===
// PATCH v20260408-fitness-zone-config
import { createZonePage } from './zone-core.js';

createZonePage({
  zoneKey: 'fitness',
  zoneLabel: 'Fitness',
  zoneEmoji: '🏃',
  heroTitle: 'Fitness Zone',
  defaultCoachLine: 'เริ่มจากเกมที่ขยับง่ายก่อน แล้วค่อยไปเกมเร็วหรือเกมที่ต้องใช้สมาธิมากขึ้นนะ',
  storagePrefix: 'HHA_FITNESS',
  games: [
    {
      key: 'jumpduck',
      title: 'Jump & Duck',
      emoji: '🦆',
      kicker: 'เริ่มง่าย',
      sub: 'กระโดดและก้มหลบตามจังหวะให้ทัน',
      desc: 'เหมาะสำหรับเริ่มต้น ฝึกการตอบสนองและขยับร่างกายอย่างสนุก',
      tags: ['เริ่มง่าย', 'ขยับตัว', 'รีแอ็กชัน'],
      filters: ['all', 'easy'],
      accent: 'plate',
      path: './jump-duck-vr.html',
      game: 'jumpduck',
      gameId: 'jumpduck',
      theme: 'jumpduck',
      aliases: ['jumpduck', 'jump', 'duck', 'กระโดด', 'ก้ม']
    },
    {
      key: 'rhythmboxer',
      title: 'Rhythm Boxer',
      emoji: '🥊',
      kicker: 'สนุกท้าทาย',
      sub: 'ชกตามจังหวะและเก็บคอมโบ',
      desc: 'ฝึกการจับจังหวะ ความเร็ว และความแม่นแบบเกมแอ็กชัน',
      tags: ['ท้าทาย', 'จังหวะ', 'คอมโบ'],
      filters: ['all', 'fun'],
      accent: 'goodjunk',
      path: './rhythm-boxer-vr.html',
      game: 'rhythmboxer',
      gameId: 'rhythmboxer',
      theme: 'rhythmboxer',
      aliases: ['rhythm', 'boxer', 'rhythmboxer', 'ชก']
    },
    {
      key: 'balancehold',
      title: 'Balance Hold',
      emoji: '🧘',
      kicker: 'ฝึกสมาธิ',
      sub: 'ฝึกทรงตัวให้มั่นคงและนิ่งขึ้น',
      desc: 'ช่วยฝึกการทรงตัว การควบคุมร่างกาย และสมาธิในแบบที่เข้าใจง่าย',
      tags: ['สมดุล', 'โฟกัส', 'ควบคุมตัว'],
      filters: ['all', 'easy'],
      accent: 'groups',
      path: './balance-hold-vr.html',
      game: 'balancehold',
      gameId: 'balancehold',
      theme: 'balancehold',
      aliases: ['balance', 'hold', 'balancehold', 'ทรงตัว']
    },
    {
      key: 'shadowbreaker',
      title: 'Shadow Breaker',
      emoji: '⚡',
      kicker: 'เร็วและมันส์',
      sub: 'ตีเป้า หลบแรงกดดัน และผ่านด่าน',
      desc: 'เหมาะกับเด็กที่อยากเล่นเกมแอ็กชัน ฝึกความเร็วและการตัดสินใจ',
      tags: ['เร็ว', 'แอ็กชัน', 'บอส'],
      filters: ['all', 'fun', 'quick'],
      accent: 'hydration',
      path: './shadow-breaker-vr.html',
      game: 'shadowbreaker',
      gameId: 'shadowbreaker',
      theme: 'shadowbreaker',
      aliases: ['shadow', 'breaker', 'shadowbreaker']
    },
    {
      key: 'fitnessplanner',
      title: 'Fitness Planner',
      emoji: '🗓️',
      kicker: 'วางแผนง่าย',
      sub: 'จัดตารางออกกำลังกายให้สมดุล',
      desc: 'เหมาะสำหรับเด็กที่อยากฝึกคิดและวางแผนกิจกรรมสุขภาพแบบง่าย ๆ',
      tags: ['วางแผน', 'สุขภาพ', 'เล่นสั้น'],
      filters: ['all', 'quick'],
      accent: 'plate',
      path: './fitness-planner.html',
      game: 'fitnessplanner',
      gameId: 'fitnessplanner',
      theme: 'fitnessplanner',
      aliases: ['planner', 'fitnessplanner', 'plan']
    }
  ]
});