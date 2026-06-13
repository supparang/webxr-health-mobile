CSAI2102 AI Quest — PATCH v3.0.5 Storage Quota Fix

แก้ QuotaExceededError localStorage key CSAI2102_AIQUEST_ATTEMPTS_V1
เปิด /ai-quest/index.html?v=20260612-quota305
ถ้ายังมี state เก่าค้าง ให้รัน localStorage.removeItem('CSAI2102_AIQUEST_ATTEMPTS_V1') และ localStorage.removeItem('CSAI2102_AIQUEST_EVENTS_V1')
