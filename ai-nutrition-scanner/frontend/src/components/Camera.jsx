import React, { useRef, useState, useEffect } from 'react'

const SAMPLE_FOODS = [
  { id: 'm001', label: '🍛 ผัดกระเพราหมูสับ', color1: '#f97316', color2: '#ea580c', emoji: '🍛' },
  { id: 'm003', label: '🍲 ต้มยำกุ้ง', color1: '#ef4444', color2: '#dc2626', emoji: '🍲' },
  { id: 'm005', label: '🍜 ผัดไทยกุ้งสด', color1: '#eab308', color2: '#ca8a04', emoji: '🍜' },
  { id: 'm006', label: '🥗 ส้มตำไทย', color1: '#22c55e', color2: '#16a34a', emoji: '🥗' },
  { id: 'm019', label: '🍗 ข้าวมันไก่', color1: '#f59e0b', color2: '#d97706', emoji: '🍗' },
  { id: 'm004', label: '🥘 แกงเขียวหวานไก่', color1: '#10b981', color2: '#059669', emoji: '🥘' }
]

function Camera({ onImageCaptured }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)
  const [cameraError, setCameraError] = useState(false)
  const [cameraActive, setCameraActive] = useState(false)

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      setStream(null)
    }
    setCameraActive(false)
  }

  const startCamera = async () => {
    setCameraError(false)
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError(true)
        return
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 960 } }
      })
      setStream(mediaStream)
      setCameraActive(true)
    } catch (err) {
      setCameraError(true)
      setCameraActive(false)
    }
  }

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream
    }
  }, [stream])

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [stream])

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      stopCamera()
      onImageCaptured(file)
    }, 'image/jpeg', 0.92)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      stopCamera()
      onImageCaptured(file)
    }
  }

  const handleSampleDish = (sample) => {
    const canvas = canvasRef.current || document.createElement('canvas')
    canvas.width = 640
    canvas.height = 480
    const ctx = canvas.getContext('2d')

    const grad = ctx.createLinearGradient(0, 0, 640, 480)
    grad.addColorStop(0, sample.color1)
    grad.addColorStop(1, sample.color2)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 640, 480)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.beginPath()
    ctx.arc(320, 220, 140, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '96px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(sample.emoji, 320, 210)

    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 30px Sarabun, sans-serif'
    ctx.fillText(sample.label.replace(/^[^\s]+\s/, ''), 320, 395)

    canvas.toBlob((blob) => {
      if (!blob) return
      const file = new File([blob], `${sample.id}_sample.jpg`, { type: 'image/jpeg' })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      stopCamera()
      onImageCaptured(file, sample.id)
    }, 'image/jpeg', 0.92)
  }

  const resetCapture = () => {
    setPreviewUrl(null)
  }

  return (
    <div className="camera-section">
      <div className="camera-container">
        {previewUrl ? (
          <img src={previewUrl} alt="ภาพอาหารที่เลือก" className="camera-preview" />
        ) : cameraActive && stream ? (
          <video ref={videoRef} autoPlay playsInline muted className="camera-video" />
        ) : (
          <div className="camera-placeholder">
            <div className="placeholder-icon">📸</div>
            <p className="placeholder-title">ถ่ายภาพอาหาร หรือเลือกไฟล์ภาพเพื่อวิเคราะห์</p>
            <p className="placeholder-sub">
              {cameraError
                ? 'ไม่พบกล้องหรือไม่ได้รับสิทธิ์กล้อง คุณสามารถอัปโหลดรูปภาพหรือเลือกเมนูตัวอย่างด้านล่างได้เลย'
                : 'รองรับทั้งการถ่ายภาพสด อัปโหลดจากเครื่อง และทดสอบด้วยเมนูตัวอย่าง'}
            </p>
            {!cameraActive && (
              <button type="button" className="camera-open-btn" onClick={startCamera}>
                เปิดกล้องถ่ายภาพ
              </button>
            )}
          </div>
        )}

        {!previewUrl && cameraActive && stream && (
          <button className="capture-btn" onClick={capturePhoto} aria-label="ถ่ายภาพ" title="กดเพื่อถ่ายภาพ" />
        )}
      </div>

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      <div className="camera-actions">
        {previewUrl ? (
          <div className="action-row">
            <button type="button" className="retake-btn" onClick={resetCapture}>
              🔄 เลือกหรือถ่ายภาพใหม่
            </button>
            <button type="button" className="upload-btn" onClick={() => fileInputRef.current?.click()}>
              📁 เปลี่ยนรูปจากคลังภาพ
            </button>
          </div>
        ) : (
          <button type="button" className="upload-btn" onClick={() => fileInputRef.current?.click()}>
            📁 เลือกภาพอาหารจากอุปกรณ์
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="file-input"
          onChange={handleFileSelect}
        />
      </div>

      <div className="sample-bar">
        <div className="sample-bar-title">⚡ ทดสอบสแกนด่วน (เมนูตัวอย่าง):</div>
        <div className="sample-chips">
          {SAMPLE_FOODS.map((item) => (
            <button
              key={item.id}
              type="button"
              className="sample-chip"
              onClick={() => handleSampleDish(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Camera
