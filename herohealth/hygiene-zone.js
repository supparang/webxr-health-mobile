import { createZoneLauncher } from './zone-launcher-core.js';

createZoneLauncher({
  zoneId: 'hygiene',
  zoneTitle: 'Hygiene Zone',
  zoneLabel: 'Hygiene Zone',
  storageKey: 'HH_HYGIENE_LAST_GAME_V1',
  emptySearchText: 'ไม่พบเกมที่ตรงคำค้น ลองพิมพ์ bath, brush, handwash, mask, clean หรือ germ',
  games: [
    {
      id: 'bath',
      title: 'Bath',
      subtitle: 'อาบน้ำให้ครบขั้นตอนแบบสนุกและเข้าใจง่าย',
      icon: '🛁',
      color: 'c-blue',
      tags: ['bath', 'routine', 'clean body'],
      launcherPath: './bath-vr.html'
    },
    {
      id: 'brush',
      title: 'Brush',
      subtitle: 'แปรงฟันให้ถูกวิธีผ่านภารกิจสั้น ๆ',
      icon: '🪥',
      color: 'c-pink',
      tags: ['brush', 'teeth', 'routine'],
      launcherPath: './brush-vr.html'
    },
    {
      id: 'handwash',
      title: 'Handwash',
      subtitle: 'ล้างมือให้ครบขั้นตอนก่อนกินหรือหลังสัมผัสสิ่งสกปรก',
      icon: '🫧',
      color: 'c-green',
      tags: ['handwash', 'soap', 'clean hands'],
      launcherPath: './handwash-v2.html'
    },
    {
      id: 'clean-objects',
      title: 'Clean Objects',
      subtitle: 'ทำความสะอาดของใช้และเก็บขยะให้เป็นระเบียบ',
      icon: '🧽',
      color: 'c-orange',
      tags: ['clean objects', 'spray', 'wipe'],
      launcherPath: './clean-objects-kids.html'
    },
    {
      id: 'mask-cough',
      title: 'Mask & Cough',
      subtitle: 'ใส่หน้ากาก ปิดปากเวลาไอ และทิ้งทิชชูอย่างถูกต้อง',
      icon: '😷',
      color: 'c-purple',
      tags: ['mask', 'cough', 'safe'],
      launcherPath: './maskcough-v2.html'
    },
    {
      id: 'germ-detective',
      title: 'Germ Detective',
      subtitle: 'ค้นหา ตรวจ และกำจัดจุดเสี่ยงเชื้อโรคในห้อง',
      icon: '🦠',
      color: 'c-teal',
      tags: ['germ', 'detective', 'investigate'],
      launcherPath: './germ-detective.html'
    }
  ]
});