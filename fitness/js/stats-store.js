import { recordSession } from './stats-store.js';
import { EventLogger } from './event-logger.js';
import { SessionLogger } from './session-logger.js';

const eventLogger = new EventLogger();
const sessionLogger = new SessionLogger();

// ใน logEvent:
function logEvent(type, targetData, extra) {
  // ... สร้าง row ตามเดิม
  eventRows.push(row);          // ถ้ายังอยากเก็บแบบเดิม
  eventLogger.add(row);         // เพิ่มแบบวิจัย
}

// ใน endGame(reason) หลังสร้าง sessionSummary:
sessionLogger.add(sessionSummary);
recordSession('shadow-breaker', sessionSummary);
