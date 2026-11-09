// frontend/src/components/Camera.jsx
import React, { useRef, useState, useEffect } from 'react'

function Camera({ onImageCaptured }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const fileInputRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [previewUrl, setPreviewUrl] = useState(null)

  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      })
      setStream(mediaStream)
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream
      }
    } catch (err) {
      console.error('ไม่สามารถเปิดกล้องได้:', err)
    }
  }

  useEffect(() => {
    startCamera()
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return
    
    const video = videoRef.current
    const canvas = canvasRef.current
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    
    canvas.toBlob((blob) => {
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
      const url = URL.createObjectURL(blob)
      setPreviewUrl(url)
      onImageCaptured(file)
    }, 'image/jpeg', 0.9)
  }

  const handleFileSelect = (e) => {
    const file = e.target.files[0]
    if (file) {
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      onImageCaptured(file)
    }
  }

  const retake = () => {
    setPreviewUrl(null)
    startCamera()
  }

  return (
    <div className="camera-section">
      <div className="camera-container">
        {previewUrl ? (
          <img src={previewUrl} alt="Preview" className="camera-preview" />
        ) : stream ? (
          <video ref={videoRef} autoPlay playsInline className="camera-video" />
        ) : (
          <div className="camera-placeholder">
            <p>กำลังเปิดกล้อง...</p>
          </div>
        )}
        
        {!previewUrl && stream && (
          <button className="capture-btn" onClick={capturePhoto} aria-label="ถ่ายภาพ" />
        )}
      </div>
      
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      
      {previewUrl ? (
        <button className="retake-btn" onClick={retake}>ถ่ายใหม่</button>
      ) : (
        <>
          <button className="upload-btn" onClick={() => fileInputRef.current?.click()}>
            เลือกภาพจากคลังภาพ
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="file-input"
            onChange={handleFileSelect}
          />
        </>
      )}
    </div>
  )
}

export default Camera
