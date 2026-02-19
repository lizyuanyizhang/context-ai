/**
 * 截图 / 录屏浮层
 * 业界常见做法：getDisplayMedia 获取画面 → 可拖动/缩放的选区 → 截图裁剪或录屏后提供 删除/保存
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { X, Camera, Video, Trash2, Download, Square } from 'lucide-react'

export type CaptureMode = 'screenshot' | 'record'

interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

interface CaptureOverlayProps {
  mode: CaptureMode
  onClose: () => void
  /** 自定义大小（可选）：如果提供，直接使用该大小，跳过选择步骤 */
  customSize?: { width: number; height: number }
}

const MIN_SIZE = 40

function CaptureOverlay({ mode, onClose, customSize }: CaptureOverlayProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const rafRef = useRef<number | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [step, setStep] = useState<'capture' | 'select' | 'recording' | 'preview' | 'customSize'>('capture')
  const [error, setError] = useState<string | null>(null)
  const [crop, setCrop] = useState<CropRect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
  const [dragStart, setDragStart] = useState<{ x: number; y: number; crop: CropRect } | null>(null)
  const [resizeDir, setResizeDir] = useState<string | null>(null)
  const [resultBlob, setResultBlob] = useState<Blob | null>(null)
  const [resultType, setResultType] = useState<'image' | 'video'>('image')
  const [customWidth, setCustomWidth] = useState<string>('1920')
  const [customHeight, setCustomHeight] = useState<string>('1080')
  const [permissionDenied, setPermissionDenied] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      stopStream()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop()
    }
  }, [stopStream])

  useEffect(() => {
    if (step !== 'select' && step !== 'recording' && step !== 'customSize') return
    const v = videoRef.current
    const stream = streamRef.current
    if (v && stream) {
      v.srcObject = stream
      v.muted = true
      v.play().catch(() => {})
    }
  }, [step])

  const startCapture = useCallback(async () => {
    setError(null)
    setPermissionDenied(false)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false
      })
      streamRef.current = stream
      // 监听流结束事件（用户可能在系统设置中停止共享）
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        stopStream()
        setStep('capture')
        setError('屏幕共享已停止')
      })
      // 如果有自定义大小，先显示大小选择界面
      if (customSize) {
        setStep('customSize')
      } else {
        setStep('select')
      }
    } catch (e) {
      // 处理权限被拒绝的情况
      if (e instanceof Error && e.name === 'NotAllowedError') {
        setPermissionDenied(true)
        setError('权限被拒绝：请在系统设置中允许屏幕录制权限，然后重新尝试')
        // 3秒后自动关闭，避免死循环
        setTimeout(() => {
          onClose()
        }, 3000)
      } else {
        setError(e instanceof Error ? e.message : '需要授权共享屏幕/标签页才能截图或录屏')
      }
    }
  }, [customSize, onClose, stopStream])

  const handleCustomSizeConfirm = useCallback(() => {
    const w = parseInt(customWidth, 10)
    const h = parseInt(customHeight, 10)
    if (w > 0 && h > 0 && streamRef.current) {
      const video = videoRef.current
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const vw = video.videoWidth
        const vh = video.videoHeight
        // 计算自定义大小在视频中的相对位置（居中）
        const relW = Math.min(1, w / vw)
        const relH = Math.min(1, h / vh)
        const relX = (1 - relW) / 2
        const relY = (1 - relH) / 2
        setCrop({ x: relX, y: relY, w: relW, h: relH })
        setStep('select')
      } else {
        setError('视频流未就绪，请稍候再试')
      }
    } else {
      setError('请输入有效的宽度和高度（大于0）')
    }
  }, [customWidth, customHeight])

  const getVideoElement = useCallback(() => {
    if (!videoRef.current || !streamRef.current) return null
    const v = videoRef.current
    if (v.srcObject !== streamRef.current) {
      v.srcObject = streamRef.current
      v.muted = true
      v.play().catch(() => {})
    }
    return v
  }, [])

  const captureScreenshot = useCallback(() => {
    const video = getVideoElement()
    if (!video || !canvasRef.current || video.videoWidth === 0) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    const { x, y, w, h } = crop
    const x0 = Math.round(x * vw)
    const y0 = Math.round(y * vh)
    const w0 = Math.round(w * vw)
    const h0 = Math.round(h * vh)
    const canvas = canvasRef.current
    canvas.width = w0
    canvas.height = h0
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, x0, y0, w0, h0, 0, 0, w0, h0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          setResultBlob(blob)
          setResultType('image')
          setStep('preview')
          stopStream()
        }
      },
      'image/png',
      0.95
    )
  }, [crop, getVideoElement, stopStream])

  const startRecording = useCallback(() => {
    const video = getVideoElement()
    if (!video || !canvasRef.current) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    const { x, y, w, h } = crop
    const w0 = Math.round(w * vw)
    const h0 = Math.round(h * vh)
    const canvas = canvasRef.current
    canvas.width = w0
    canvas.height = h0
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    chunksRef.current = []
    const outStream = canvas.captureStream(30)
    const recorder = new MediaRecorder(outStream, { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 2500000 })
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: 'video/webm' })
      setResultBlob(blob)
      setResultType('video')
      setStep('preview')
      stopStream()
    }
    mediaRecorderRef.current = recorder
    recorder.start(100)
    setStep('recording')

    const x0 = x * vw
    const y0 = y * vh
    const sw = w * vw
    const sh = h * vh
    const draw = () => {
      if (video.ended || video.readyState < 2) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }
      ctx.drawImage(video, x0, y0, sw, sh, 0, 0, w0, h0)
      rafRef.current = requestAnimationFrame(draw)
    }
    draw()
  }, [crop, getVideoElement, stopStream])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [])

  const handleSave = useCallback(() => {
    if (!resultBlob) return
    const url = URL.createObjectURL(resultBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = resultType === 'image'
      ? `截图_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`
      : `录屏_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    onClose()
  }, [resultBlob, resultType, onClose])

  const handleDelete = useCallback(() => {
    setResultBlob(null)
    onClose()
  }, [onClose])

  const onPointerDown = (e: React.PointerEvent, dir: string) => {
    e.preventDefault()
    setResizeDir(dir)
    setDragStart({ x: e.clientX, y: e.clientY, crop: { ...crop } })
  }
  const onPanelPointerDown = (e: React.PointerEvent) => {
    if (e.target !== e.currentTarget) return
    setResizeDir('move')
    setDragStart({ x: e.clientX, y: e.clientY, crop: { ...crop } })
  }
  useEffect(() => {
    if (!dragStart || !resizeDir) return
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - dragStart.x) / (typeof window !== 'undefined' ? window.innerWidth : 1)
      const dy = (ev.clientY - dragStart.y) / (typeof window !== 'undefined' ? window.innerHeight : 1)
      const { crop: c } = dragStart
      if (resizeDir === 'move') {
        setCrop({
          x: Math.max(0, Math.min(1 - c.w, c.x + dx)),
          y: Math.max(0, Math.min(1 - c.h, c.y + dy)),
          w: c.w,
          h: c.h
        })
      } else {
        let { x, y, w, h } = { ...c }
        if (resizeDir.includes('e')) {
          w = Math.max(MIN_SIZE / (typeof window !== 'undefined' ? window.innerWidth : 1), Math.min(1 - x, c.w + dx))
        }
        if (resizeDir.includes('w')) {
          const nw = Math.max(MIN_SIZE / (typeof window !== 'undefined' ? window.innerWidth : 1), c.w - dx)
          x = c.x + c.w - nw
          w = nw
        }
        if (resizeDir.includes('s')) {
          h = Math.max(MIN_SIZE / (typeof window !== 'undefined' ? window.innerHeight : 1), Math.min(1 - y, c.h + dy))
        }
        if (resizeDir.includes('n')) {
          const nh = Math.max(MIN_SIZE / (typeof window !== 'undefined' ? window.innerHeight : 1), c.h - dy)
          y = c.y + c.h - nh
          h = nh
        }
        setCrop({ x, y, w, h })
      }
    }
    const up = () => {
      setResizeDir(null)
      setDragStart(null)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dragStart, resizeDir])

  const previewUrl = resultBlob ? URL.createObjectURL(resultBlob) : ''
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  return (
    <div
      className="fixed inset-0 z-[1000004] flex flex-col items-center justify-center"
      style={{
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(8px)'
      }}
    >
      <canvas ref={canvasRef} className="hidden" />
      {step === 'capture' && (
        <div className="flex flex-col items-center gap-4 p-6 rounded-2xl" style={{ background: 'rgba(255,242,248,0.98)', border: '1px solid rgba(220,190,200,0.35)', boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--notion-text)' }}>
            {mode === 'screenshot' ? '选择要截图的标签页或窗口' : '选择要录屏的标签页或窗口'}
          </p>
          {error && (
            <div className="flex flex-col items-center gap-2 max-w-md">
              <p className="text-xs text-center" style={{ color: 'var(--notion-error)' }}>{error}</p>
              {permissionDenied && (
                <p className="text-xs text-center" style={{ color: 'var(--notion-text-tertiary)' }}>
                  3秒后自动关闭...
                </p>
              )}
            </div>
          )}
          <div className="flex gap-3">
            {!permissionDenied && (
              <button
                onClick={startCapture}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: 'rgba(240,200,215,0.6)', color: 'rgba(0,0,0,0.8)', border: '1px solid rgba(220,180,195,0.5)' }}
              >
                {mode === 'screenshot' ? <Camera className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                {mode === 'screenshot' ? '选择并截图' : '选择并录屏'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,248,252,0.9)', color: 'rgba(0,0,0,0.7)', border: '1px solid rgba(220,190,200,0.5)' }}
            >
              <X className="w-4 h-4" /> {permissionDenied ? '关闭' : '取消'}
            </button>
          </div>
        </div>
      )}

      {/* 自定义大小选择界面 */}
      {step === 'customSize' && streamRef.current && (
        <div className="flex flex-col items-center gap-4 p-6 rounded-2xl" style={{ background: 'rgba(255,242,248,0.98)', border: '1px solid rgba(220,190,200,0.35)', boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--notion-text)' }}>
            自定义{mode === 'screenshot' ? '截图' : '录屏'}大小
          </p>
          {error && <p className="text-xs" style={{ color: 'var(--notion-error)' }}>{error}</p>}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--notion-text-secondary)' }}>宽度：</label>
              <input
                type="number"
                value={customWidth}
                onChange={(e) => {
                  setCustomWidth(e.target.value)
                  setError(null)
                }}
                className="px-2 py-1 rounded text-sm"
                style={{
                  border: '1px solid rgba(220,190,200,0.5)',
                  background: 'rgba(255,248,252,0.9)',
                  width: '80px'
                }}
                min="1"
                placeholder="1920"
              />
              <span className="text-xs" style={{ color: 'var(--notion-text-tertiary)' }}>px</span>
            </div>
            <span className="text-xs" style={{ color: 'var(--notion-text-tertiary)' }}>×</span>
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--notion-text-secondary)' }}>高度：</label>
              <input
                type="number"
                value={customHeight}
                onChange={(e) => {
                  setCustomHeight(e.target.value)
                  setError(null)
                }}
                className="px-2 py-1 rounded text-sm"
                style={{
                  border: '1px solid rgba(220,190,200,0.5)',
                  background: 'rgba(255,248,252,0.9)',
                  width: '80px'
                }}
                min="1"
                placeholder="1080"
              />
              <span className="text-xs" style={{ color: 'var(--notion-text-tertiary)' }}>px</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleCustomSizeConfirm}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(240,200,215,0.6)', color: 'rgba(0,0,0,0.8)', border: '1px solid rgba(220,180,195,0.5)' }}
            >
              确认
            </button>
            <button
              onClick={() => {
                setError(null)
                setStep('select')
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,248,252,0.9)', color: 'rgba(0,0,0,0.7)', border: '1px solid rgba(220,190,200,0.5)' }}
            >
              返回
            </button>
            <button
              onClick={() => {
                stopStream()
                onClose()
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,248,252,0.9)', color: 'rgba(0,0,0,0.7)', border: '1px solid rgba(220,190,200,0.5)' }}
            >
              <X className="w-4 h-4" /> 取消
            </button>
          </div>
        </div>
      )}

      {(step === 'select' || step === 'recording') && streamRef.current && (
        <>
          <div className="relative inline-block max-w-full rounded-lg overflow-hidden" style={{ maxHeight: '80vh' }}>
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="block max-w-full max-h-[80vh] object-contain bg-black"
            />
            <div className="absolute inset-0" style={{ pointerEvents: 'none' }}>
              <div
                className="absolute border-2 border-white shadow-lg cursor-move"
                style={{
                  left: `${crop.x * 100}%`,
                  top: `${crop.y * 100}%`,
                  width: `${crop.w * 100}%`,
                  height: `${crop.h * 100}%`,
                  pointerEvents: 'auto'
                }}
                onPointerDown={onPanelPointerDown}
              >
                <div className="absolute -left-1 -top-1 w-3 h-3 rounded-full bg-white border border-gray-400 cursor-nw-resize" style={{ pointerEvents: 'auto' }} onPointerDown={(e) => onPointerDown(e, 'nw')} />
                <div className="absolute -right-1 -top-1 w-3 h-3 rounded-full bg-white border border-gray-400 cursor-ne-resize" style={{ pointerEvents: 'auto' }} onPointerDown={(e) => onPointerDown(e, 'ne')} />
                <div className="absolute -left-1 -bottom-1 w-3 h-3 rounded-full bg-white border border-gray-400 cursor-sw-resize" style={{ pointerEvents: 'auto' }} onPointerDown={(e) => onPointerDown(e, 'sw')} />
                <div className="absolute -right-1 -bottom-1 w-3 h-3 rounded-full bg-white border border-gray-400 cursor-se-resize" style={{ pointerEvents: 'auto' }} onPointerDown={(e) => onPointerDown(e, 'se')} />
              </div>
            </div>
          </div>
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-3">
            {step === 'select' && (
              <>
                <button
                  onClick={() => setStep('customSize')}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                  style={{ background: 'rgba(255,248,252,0.9)', color: 'rgba(0,0,0,0.7)', border: '1px solid rgba(220,190,200,0.5)' }}
                >
                  自定义大小
                </button>
                <button
                  onClick={mode === 'screenshot' ? captureScreenshot : startRecording}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                  style={{ background: 'rgba(220,100,120,0.9)' }}
                >
                  {mode === 'screenshot' ? <Camera className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                  {mode === 'screenshot' ? '截取' : '开始录屏'}
                </button>
                <button onClick={() => { stopStream(); onClose() }} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium" style={{ background: 'rgba(255,248,252,0.9)', color: 'rgba(0,0,0,0.7)' }}>
                  <X className="w-4 h-4" /> 取消
                </button>
              </>
            )}
            {step === 'recording' && (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ background: 'var(--notion-error)' }}
              >
                <Square className="w-4 h-4" /> 停止录屏
              </button>
            )}
          </div>
        </>
      )}

      {step === 'preview' && resultBlob && (
        <div className="flex flex-col items-center gap-4 p-6 rounded-2xl max-w-lg" style={{ background: 'rgba(255,242,248,0.98)', border: '1px solid rgba(220,190,200,0.35)', boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}>
          <p className="text-sm font-medium" style={{ color: 'var(--notion-text)' }}>
            {resultType === 'image' ? '截图已就绪' : '录屏已就绪'}
          </p>
          {resultType === 'image' && <img src={previewUrl} alt="截图预览" className="max-w-full max-h-64 rounded-lg object-contain" />}
          {resultType === 'video' && <video src={previewUrl} controls className="max-w-full max-h-64 rounded-lg" />}
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
              style={{ background: 'var(--notion-accent)' }}
            >
              <Download className="w-4 h-4" /> 保存
            </button>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: 'rgba(255,248,252,0.9)', color: 'var(--notion-error)', border: '1px solid rgba(220,190,200,0.5)' }}
            >
              <Trash2 className="w-4 h-4" /> 删除
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default CaptureOverlay
