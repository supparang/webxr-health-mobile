export const HYDRATION_V2_CONFIG = {
  GAME_ID: 'hydration-v2',
  TITLE: 'Hydration Hero v2',
  VERSION: '20260322-v2-start',
  ZONE: 'nutrition',

  ROUNDS: 6,
  POINTS_ANSWER: 10,
  POINTS_REASON: 5,
  POINTS_CONFIDENCE_BONUS: 2,
  FEEDBACK_MS: 900,

  STORAGE_KEYS: {
    LAST_SUMMARY: 'HHA_LAST_SUMMARY',
    SUMMARY_HISTORY: 'HHA_SUMMARY_HISTORY',
    EVENT_QUEUE: 'HHA_HYDRATION_V2_EVENT_QUEUE'
  },

  COPY: {
    coachIntro: 'ลองดูสถานการณ์ให้ดี แล้วค่อยเลือกคำตอบนะ',
    coachReason: 'ต่อไปเลือกเหตุผลที่ตรงกับความคิดของเรา',
    coachConfidence: 'เก่งมาก ตอนนี้บอกว่ามั่นใจแค่ไหน',
    coachCorrect: 'ดีมาก! คิดได้เหมาะกับสถานการณ์เลย',
    coachWrong: 'ไม่เป็นไร ข้อนี้เอาไว้จำไว้ใช้ครั้งหน้า',
    finishGood: 'ยอดเยี่ยมมาก! วันนี้คิดเป็นเหตุผลและเลือกได้ดีมาก',
    finishMid: 'ทำได้ดีมาก ลองฝึกอีกนิดแล้วจะยิ่งมั่นใจขึ้น',
    finishLow: 'เริ่มต้นได้ดีแล้ว ลองเล่นอีกครั้งเพื่อฝึกการตัดสินใจนะ'
  }
};