// frontend/src/App.jsx
import React, { useState, useRef, useEffect } from 'react'
import axios from 'axios'
import Camera from './components/Camera'
import ResultCard from './components/ResultCard'
import ConfirmationModal from './components/ConfirmationModal'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [predictionId, setPredictionId] = useState(null)

  const handleImageCaptured = async (imageFile) => {
    setLoading(true)
    setError(null)
    setResult(null)
    setShowConfirm(false)

    const formData = new FormData()
    formData.append('file', imageFile)

    try {
      const response = await axios.post(`${API_URL}/api/predictions/predict`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      setResult(response.data)
      setPredictionId(response.data.prediction_id)
      
      if (response.data.needs_confirmation) {
        setShowConfirm(true)
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'เกิดข้อผิดพลาด กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirmation = async (confirmed) => {
    try {
      await axios.post(`${API_URL}/api/predictions/confirm`, {
        prediction_id: predictionId,
        confirmed: confirmed,
        correction: null
      })
      
      setShowConfirm(false)
      // อัปเดตผลลัพธ์หากผู้ใช้ยืนยัน
      if (!confirmed) {
        setError('ผลลัพธ์ถูกบันทึกว่าผู้ใช้ไม่ยืนยัน กรุณาถ่ายใหม่หรือเลือกเมนูด้วยตนเอง')
      }
    } catch (err) {
      setError('ไม่สามารถบันทึกการยืนยันได้')
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>AI Nutrition Scanner</h1>
        <p>ประเมินพลังงานและสารอาหารจากภาพอาหารไทย</p>
      </header>
      
      <main className="main">
        <Camera onImageCaptured={handleImageCaptured} />
        
        {loading && (
          <div className="loading">
            <p>กำลังวิเคราะห์ภาพ...</p>
          </div>
        )}
        
        {error && <div className="error-message">{error}</div>}
        
        {result && !showConfirm && <ResultCard result={result} />}
        
        {showConfirm && result && (
          <ConfirmationModal
            question={result.confirmation_question}
            onConfirm={() => handleConfirmation(true)}
            onDecline={() => handleConfirmation(false)}
          />
        )}
      </main>
    </div>
  )
}

export default App
