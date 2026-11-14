import React, { useState } from 'react'

function ConfirmationModal({ question, menus = [], currentMenuId, onConfirm, onDecline }) {
  const [selectedCorrection, setSelectedCorrection] = useState(currentMenuId || (menus[0]?.id ?? 'm001'))
  const [choosingOther, setChoosingOther] = useState(false)

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>🔍 ยืนยันรายการอาหาร</h3>
        <p className="modal-question">{question}</p>

        {!choosingOther ? (
          <div className="modal-buttons">
            <button type="button" className="modal-btn modal-btn-yes" onClick={() => onConfirm(null)}>
              ✅ ใช่ ถูกต้อง
            </button>
            <button type="button" className="modal-btn modal-btn-no" onClick={() => setChoosingOther(true)}>
              ✏️ ไม่ใช่ (ระบุเมนูเอง)
            </button>
          </div>
        ) : (
          <div className="correction-box">
            <label className="correction-label">เลือกเมนูที่ถูกต้องจากฐานข้อมูล:</label>
            <select
              className="correction-select"
              value={selectedCorrection}
              onChange={(e) => setSelectedCorrection(e.target.value)}
            >
              {menus.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name_th} ({m.name_en})
                </option>
              ))}
            </select>
            <div className="modal-buttons">
              <button
                type="button"
                className="modal-btn modal-btn-yes"
                onClick={() => onConfirm(selectedCorrection)}
              >
                บันทึกเมนูที่เลือก
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-no"
                onClick={onDecline}
              >
                ยกเลิก
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ConfirmationModal
