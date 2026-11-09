// frontend/src/components/ConfirmationModal.jsx
import React from 'react'

function ConfirmationModal({ question, onConfirm, onDecline }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>กรุณายืนยัน</h3>
        <p>{question}</p>
        <div className="modal-buttons">
          <button className="modal-btn modal-btn-yes" onClick={onConfirm}>
            ใช่
          </button>
          <button className="modal-btn modal-btn-no" onClick={onDecline}>
            ไม่ใช่
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal
