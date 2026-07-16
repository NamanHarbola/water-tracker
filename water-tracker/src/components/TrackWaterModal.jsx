import { useEffect, useRef, useState } from 'react'
import { supabase } from '../supabaseClient'

const MAX_SECONDS = 10

export default function TrackWaterModal({ userId, slotId, onClose, onLogged }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])

  const [status, setStatus] = useState('idle') // idle | recording | uploading | done | error
  const [seconds, setSeconds] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user' },
          audio: false
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
      } catch (err) {
        setStatus('error')
        setErrorMsg('Camera access was blocked. Allow camera permission and try again.')
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function startRecording() {
    if (!streamRef.current) return
    chunksRef.current = []
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType: MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
        ? 'video/webm;codecs=vp8'
        : 'video/webm'
    })
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    recorder.onstop = handleUpload
    recorderRef.current = recorder
    recorder.start()
    setStatus('recording')
    setSeconds(0)

    const tick = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) {
          clearInterval(tick)
          recorder.stop()
        }
        return s + 1
      })
    }, 1000)
  }

  function stopEarly() {
    recorderRef.current?.stop()
  }

  async function handleUpload() {
    setStatus('uploading')
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    const fileName = `${userId}/${Date.now()}.webm`

    const { error: uploadError } = await supabase.storage
      .from('water-clips')
      .upload(fileName, blob, { contentType: 'video/webm' })

    if (uploadError) {
      setStatus('error')
      setErrorMsg('Upload failed — check your connection and try again.')
      return
    }

    const { error: insertError } = await supabase.from('logs').insert({
      user_id: userId,
      slot_id: slotId,
      video_path: fileName,
      uploaded_at: new Date().toISOString(),
      reviewed: false
    })

    if (insertError) {
      setStatus('error')
      setErrorMsg('Saved the clip but could not log it — tell the admin.')
      return
    }

    setStatus('done')
    onLogged?.()
  }

  return (
    <div className="fixed inset-0 z-50 bg-deep/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-blob overflow-hidden w-full max-w-sm shadow-2xl">
        <div className="relative aspect-[3/4] bg-ink">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {status === 'recording' && (
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-ink/60 rounded-full px-3 py-1">
              <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="tabular text-white text-sm">{MAX_SECONDS - seconds}s</span>
            </div>
          )}
          {status === 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-deep/70">
              <span className="font-body text-white">Saving your clip…</span>
            </div>
          )}
          {status === 'done' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-deep/85 text-white gap-2">
              <span className="text-3xl">💧</span>
              <span className="font-display text-xl">Logged</span>
            </div>
          )}
        </div>

        <div className="p-5 space-y-3">
          {status === 'error' && (
            <p className="text-sm text-red-500">{errorMsg}</p>
          )}

          {status === 'idle' && (
            <button
              onClick={startRecording}
              className="w-full py-3 rounded-2xl bg-splash text-white font-semibold font-body active:scale-[0.98] transition"
            >
              Start recording
            </button>
          )}

          {status === 'recording' && (
            <button
              onClick={stopEarly}
              className="w-full py-3 rounded-2xl bg-deep text-white font-semibold font-body active:scale-[0.98] transition"
            >
              Stop &amp; save
            </button>
          )}

          {status === 'done' ? (
            <button
              onClick={onClose}
              className="w-full py-3 rounded-2xl bg-bubble text-deep font-semibold font-body"
            >
              Close
            </button>
          ) : (
            status !== 'uploading' && (
              <button onClick={onClose} className="w-full text-center text-sm text-ink/50 py-1">
                Cancel
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
