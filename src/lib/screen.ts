import { useStore } from '../store'
import { tracer } from './diag'

export interface ScreenCaptureResult {
  data?: string
  mimeType?: string
  error?: string
}

/**
 * Captures the user's screen or a specific window using Web getDisplayMedia.
 * Prompts with browser permission dialog if required.
 */
export async function captureScreen(reason?: string): Promise<ScreenCaptureResult> {
  const store = useStore.getState()
  const perm = store.permissions.READ_SCREEN

  if (perm === 'DENIED') {
    tracer.log('PIPELINE_ERROR', 'screen', 'Screen capture blocked by user permission')
    return { error: 'Screen reading permission is set to DENIED in settings.' }
  }

  if (!navigator.mediaDevices?.getDisplayMedia) {
    tracer.log('PIPELINE_ERROR', 'screen', 'getDisplayMedia unsupported')
    return {
      error: 'Screen capture is not supported in this browser. Please use Chrome or Edge.',
    }
  }

  tracer.log('TOOL_REQUESTED', 'screen', reason || 'Capturing screen')
  store.setLooking(reason || 'inspecting screen')

  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        // Prefer capturing whole monitor or window
        displaySurface: 'monitor',
      },
      audio: false,
    })

    const track = stream.getVideoTracks()[0]
    if (!track) {
      throw new Error('No video track available from display capture.')
    }

    const video = document.createElement('video')
    video.srcObject = stream
    video.muted = true
    await video.play()

    // Wait until video dimensions are ready
    if (video.videoWidth === 0) {
      await new Promise((resolve) => {
        video.onloadedmetadata = resolve
      })
    }

    const width = video.videoWidth || 1280
    const height = video.videoHeight || 720

    // Scale down if massive to keep transmission fast
    const maxDim = 1600
    const scale = Math.min(1, maxDim / Math.max(width, height))
    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Could not create 2D canvas context')

    ctx.drawImage(video, 0, 0, targetW, targetH)

    // Stop tracks immediately so screen share icon turns off
    track.stop()
    stream.getTracks().forEach((t) => t.stop())

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')

    // Show a visual blade on the HUD so user can see what GACKS P.A saw
    const bladeId = `screen-${Date.now()}`
    store.pushBlade({
      id: bladeId,
      title: 'Screen Capture',
      kind: 'image',
      url: dataUrl,
      size: 'wide',
      hold: 'turn',
    })

    tracer.log('TOOL_COMPLETED', 'screen', 'Screen captured successfully')
    return {
      data: base64,
      mimeType: 'image/jpeg',
    }
  } catch (err: any) {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop())
    }
    const isCancel =
      err?.name === 'NotAllowedError' ||
      err?.name === 'AbortError' ||
      String(err).includes('Permission denied')

    tracer.log(
      'PIPELINE_ERROR',
      'screen',
      isCancel ? 'Screen capture cancelled by user' : String(err?.message ?? err),
    )

    return {
      error: isCancel
        ? 'Screen capture was cancelled or permission was not granted by the user.'
        : `Failed to capture screen: ${err?.message ?? err}`,
    }
  } finally {
    store.setLooking(null)
  }
}
