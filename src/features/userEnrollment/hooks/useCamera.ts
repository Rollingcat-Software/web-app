import { useState, useRef, useCallback, useEffect } from 'react'

interface UseCameraReturn {
    videoRef: React.RefObject<HTMLVideoElement>
    stream: MediaStream | null
    hasPermission: boolean | null
    error: string | null
    requestAccess: () => Promise<boolean>
    captureFrame: () => Blob | null
    stopCamera: () => void
}

function mapCameraError(error: unknown): string {
    if (error instanceof DOMException) {
        switch (error.name) {
            case 'NotAllowedError':
                return 'Camera access was denied. Please allow camera access in your browser settings.'
            case 'NotFoundError':
                return 'No camera found. Please connect a camera and try again.'
            case 'NotReadableError':
                return 'Camera is in use by another application. Please close other apps using the camera.'
            case 'OverconstrainedError':
                return 'Camera does not meet the required constraints.'
            case 'AbortError':
                return 'Camera access was aborted.'
            default:
                return `Camera error: ${error.message}`
        }
    }
    return 'An unexpected error occurred while accessing the camera.'
}

export function useCamera(): UseCameraReturn {
    const videoRef = useRef<HTMLVideoElement>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const [stream, setStream] = useState<MediaStream | null>(null)
    const [hasPermission, setHasPermission] = useState<boolean | null>(null)
    const [error, setError] = useState<string | null>(null)

    const stopCamera = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
            streamRef.current = null
            setStream(null)
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null
        }
    }, [])

    const requestAccess = useCallback(async (): Promise<boolean> => {
        setError(null)
        try {
            const mediaStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
            })
            streamRef.current = mediaStream
            setStream(mediaStream)
            setHasPermission(true)

            if (videoRef.current) {
                videoRef.current.srcObject = mediaStream
            }
            return true
        } catch (err) {
            setHasPermission(false)
            setError(mapCameraError(err))
            return false
        }
    }, [])

    const captureFrame = useCallback((): Blob | null => {
        const video = videoRef.current
        if (!video || !streamRef.current) return null

        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return null

        ctx.drawImage(video, 0, 0)

        const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
        const byteString = atob(dataUrl.split(',')[1])
        const mimeString = dataUrl.split(',')[0].split(':')[1].split(';')[0]
        const ab = new ArrayBuffer(byteString.length)
        const ia = new Uint8Array(ab)
        for (let i = 0; i < byteString.length; i++) {
            ia[i] = byteString.charCodeAt(i)
        }
        return new Blob([ab], { type: mimeString })
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((track) => track.stop())
            }
        }
    }, [])

    return {
        videoRef,
        stream,
        hasPermission,
        error,
        requestAccess,
        captureFrame,
        stopCamera,
    }
}
