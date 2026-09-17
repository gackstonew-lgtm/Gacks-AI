import { BRIDGE_HTTP_URL } from '../config'
import { getMic } from './audio'
import {
  speakingNow,
  speakingSince,
  isAssistantSpeaking,
  wasAssistantSpeakingRecently,
  getRecentSpokenText,
} from './tts'
import { startVad, type Vad } from './vad'
import { caps } from './capabilities'
import { tracer } from './diag'

/**
 * The voice loop.
 *
 * One recogniser, running for the life of the page. It is never torn down for
 * a turn, and that single fact is most of what separates this from a kiosk:
 * the microphone is still open while JARVIS is talking, so you can cut him off
 * the way you would cut off a person.
 */

export type VoiceMode =
  /** Powered down. Only his name matters. */
  | 'wake'
  /** He is expecting you to speak. Everything is a command. */
  | 'command'
  /** He is thinking or talking. Anything you say is an interruption. */
  | 'guard'
  /** Something is playing that must not be transcribed at all. */
  | 'deaf'

export type VoiceEventSource = 'user' | 'assistant' | 'caption' | 'system'

export interface VoiceEventBase {
  type: string
  source: VoiceEventSource
  timestamp: number
}

export interface UserSpeechInputEvent extends VoiceEventBase {
  type: 'USER_SPEECH_INPUT'
  source: 'user'
  text: string
  final: boolean
  id: string
  confidence?: number
}

export interface AssistantResponseEvent extends VoiceEventBase {
  type: 'ASSISTANT_RESPONSE'
  source: 'assistant'
  text: string
  id: string
}

export interface AssistantTTSOutputEvent extends VoiceEventBase {
  type: 'ASSISTANT_TTS_OUTPUT'
  source: 'assistant'
  text: string
  id: string
}

export interface CaptionUpdateEvent extends VoiceEventBase {
  type: 'CAPTION_UPDATE'
  source: 'caption'
  text: string
}

export interface SystemVoiceEvent extends VoiceEventBase {
  type: 'SYSTEM_EVENT'
  source: 'system'
  text: string
}

export type VoiceEvent =
  | UserSpeechInputEvent
  | AssistantResponseEvent
  | AssistantTTSOutputEvent
  | CaptionUpdateEvent
  | SystemVoiceEvent

export type VoiceHandlers = {
  /** Read fresh on every result, so the app never has to re-subscribe. */
  mode: () => VoiceMode
  /** Fired on his name, from a partial — waiting for endpointing feels slow. */
  onWake: (trailing: string) => void
  /** The user has genuinely started talking. This is the barge-in trigger. */
  onSpeechStart: () => void
  /** Live transcript, for presentation only. */
  onPartial: (text: string) => void
  /** A complete, endpointed utterance from validated user speech. */
  onUtterance: (text: string, event?: UserSpeechInputEvent) => void
  /** The recogniser is unusable. Distinct from the user saying nothing. */
  onError: (message: string) => void
}

export type Voice = {
  stop: () => void
  /** True while a recogniser is actually running. */
  live: () => boolean
}

// ---------------------------------------------------------------------------
// Endpointing
// ---------------------------------------------------------------------------

/** One utterance often produces several partials containing his name. */
const WAKE_DEBOUNCE = 1500

/**
 * His name, and the only wake phrase.
 *
 * The optional prefix is genuinely optional: addressing him by name alone is
 * correct, and during an answer "Jarvis" on its own is the natural way to cut
 * in. The negative lookahead keeps possessives ("Jarvis's job") from waking him.
 *
 * The alternates are not padding. "Jarvis" is not in a general dictation
 * model's high-frequency vocabulary, and Chrome routinely returns Travis,
 * Jervis, Jarvys or Java's for a perfectly clear utterance — every one of which
 * used to be silently discarded, so the wake word "just didn't work" with no
 * indication why. Better a rare false wake than a name that does not answer.
 */
const WAKE =
  /\b(?:hey|hi|ok|okay|yo)?\s*(?:gacks(?:\s*p\.?a\.?)?|gacks\s*pa|gacks|gax|gack|jarvis|jarvys|jervis|jarvis's|travis|jarviss|java's|jarv)\b(?!'s)/i

/** Everything after the wake phrase, which is usually the actual command. */
function afterWake(text: string): string {
  const m = WAKE.exec(text)
  if (!m) return ''
  return text
    .slice(m.index + m[0].length)
    .replace(/^[\s,.:;!?-]+/, '')
    .trim()
}

// ---------------------------------------------------------------------------
// Assembling one utterance out of several segments
// ---------------------------------------------------------------------------

/**
 * Why this exists.
 *
 * The voice-activity detector is an energy gate, and energy is a fact about the
 * room rather than about the sentence. It ends a segment after a fixed quiet
 * gap, so "what's the weather in — " *pause* " — London" is two segments, two
 * transcripts and, before this, two turns: the first one asking the model a
 * truncated question, the second arriving as a bare noun with no question left
 * to attach it to. People pause. They pause to think of the word, to look at
 * something, mid-list, before the important part. An assistant that treats the
 * first gap as the end of the thought is one you have to talk to carefully, and
 * having to talk carefully is the whole failure.
 *
 * So the segment is no longer the turn. Transcripts accumulate here, and the
 * turn fires only when the text looks finished AND the room has gone quiet.
 *
 * Crucially this costs nothing in the common case. A complete sentence with no
 * one speaking fires immediately — `holdFor` returns 0 — so the latency of an
 * ordinary question is exactly what it was. The waiting only happens when there
 * is a reason to wait.
 */

/**
 * Ending on one of these means the sentence is not over, whatever the silence
 * says. Function words only: they are closed-class, so the list is complete in
 * a way a content-word list could never be, and none of them is a plausible
 * last word of a real request.
 */
const CONTINUES =
  /\b(and|or|but|so|because|since|if|when|while|that|which|who|whose|to|of|in|on|at|by|for|with|from|about|into|onto|over|under|between|through|the|a|an|my|your|his|her|its|our|their|is|are|was|were|be|been|do|does|did|have|has|had|can|could|would|should|will|shall|might|must|like|than|then|as|very|really|just|some|any|all|both|either|neither)$/i

/** Trailing punctuation a transcriber emits mid-thought. */
const TRAILS = /[,;:–—-]$/

/**
 * A barge-in this soon after he starts a sentence is him, not you.
 *
 * Echo cancellation and the raised guard threshold stop most of his playback
 * reaching the detector, but the attack of the very first syllable is the
 * loudest, least-cancelled thing in the whole answer — it arrives before the
 * canceller has adapted to it. Without this, a long answer could interrupt
 * itself on its own first word, which reads as JARVIS refusing to speak.
 *
 * Kept short deliberately. This is the one window where a genuine interruption
 * is also least likely: the user has not yet heard enough to want to stop him.
 */
const SELF_GUARD_MS = 350

/**
 * A quiet gap this long with a finished-looking sentence ends the turn.
 *
 * Small on purpose: by the time a transcript reaches the assembler the detector
 * has already sat through SILENCE_MS of quiet and the transcriber has taken its
 * own few hundred milliseconds, so roughly a second of real silence has passed
 * already. All this window has to catch is someone drawing breath to add one
 * more clause. Making it generous here is what would make every ordinary
 * question feel slow.
 */
const SETTLE_MS = 250
/** ...and this long when the sentence is plainly unfinished. */
const CONTINUE_MS = 1600
/**
 * Nothing is held longer than this in total. A ceiling rather than a timer:
 * without it, someone who ends every clause on "and" could hold a turn open
 * for ever, and the assistant would look like it had stopped listening.
 */
const MAX_HOLD_MS = 6000

/**
 * How long to keep waiting, given what has been said so far.
 * 0 means "this is a complete thought, send it now".
 */
function holdFor(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (!words.length) return CONTINUE_MS
  // An explicit terminator is the speaker telling us they are done.
  if (/[.!?]$/.test(text)) return 0
  if (TRAILS.test(text.trim())) return CONTINUE_MS
  if (CONTINUES.test(words[words.length - 1])) return CONTINUE_MS
  // One or two words is usually the start of something, not the whole of it —
  // except for the short commands that genuinely are complete.
  if (words.length <= 2 && !OVERRIDE.test(text)) return CONTINUE_MS
  return SETTLE_MS
}

type Assembler = {
  /** Add a transcript. `active` is true if the user is audibly still going. */
  feed: (text: string, active: boolean) => void
  /** Send whatever is held right now, if anything. */
  flush: () => void
  /** Throw away whatever is held — used when he stands down. */
  cancel: () => void
  held: () => string
}

function makeAssembler(h: {
  emit: (text: string) => void
  partial: (text: string) => void
}): Assembler {
  let held = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  let firstAt = 0

  const clear = () => {
    if (timer) clearTimeout(timer)
    timer = null
  }

  const fire = () => {
    clear()
    const text = held.trim()
    held = ''
    firstAt = 0
    if (text) h.emit(text)
  }

  return {
    feed(text, active) {
      if (!text.trim()) return
      held = `${held} ${text}`.replace(/\s+/g, ' ').trim()
      if (!firstAt) firstAt = Date.now()
      // The caption shows the whole thought as it assembles, not just the
      // fragment that happened to arrive last.
      h.partial(held)
      diag.holding = held
      clear()

      // Already talking again. Decide nothing now — the next transcript is
      // part of this same sentence and will bring more of it.
      if (active) {
        timer = setTimeout(fire, MAX_HOLD_MS)
        return
      }

      const wait = Math.min(
        holdFor(held),
        Math.max(0, MAX_HOLD_MS - (Date.now() - firstAt)),
      )
      diag.waitedMs = wait
      if (wait === 0) {
        fire()
        return
      }
      timer = setTimeout(fire, wait)
    },
    flush: fire,
    cancel() {
      clear()
      held = ''
      firstAt = 0
      diag.holding = ''
    },
    held: () => held,
  }
}

// ---------------------------------------------------------------------------
// Hearing himself
// ---------------------------------------------------------------------------

export const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Short words that must always cut through, even when they collide with what
 * he happens to be saying. Suppressing "stop" because he just said "stop"
 * would be the single most infuriating failure this file could have.
 */
export const OVERRIDE =
  /\b(stop|wait|jarvis|gacks|cancel|enough|quiet|hold on|shut up|never ?mind|forget it|no|halt|pause)\b/i

/**
 * Filler-only sounds that should never trigger an AI conversational response.
 */
const FILLER_ONLY = /^(?:uh+|um+|mm+|ah+|eh+|er+|erm+|hmm+|huh+)[,.!?\s]*$/i
const BARE_FILLER_WORDS = new Set(['uh', 'um', 'mm', 'ah', 'eh', 'er', 'erm', 'hmm', 'huh'])

export function isMeaninglessUtterance(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return true
  if (FILLER_ONLY.test(trimmed)) return true
  const words = norm(trimmed).split(' ').filter(Boolean)
  if (words.length === 0) return true
  if (words.length === 1 && BARE_FILLER_WORDS.has(words[0])) return true
  return false
}

/**
 * Utterance Deduplication Engine
 * Prevents identical spoken utterances from triggering multiple AI turns
 * within a short time window (3000ms).
 */
const RECENT_UTTERANCE_WINDOW_MS = 3000
const recentUtterances = new Map<string, number>()

export function isDuplicateUtterance(text: string): boolean {
  const key = norm(text)
  if (!key) return true
  const now = Date.now()
  const lastTime = recentUtterances.get(key)
  if (lastTime && now - lastTime < RECENT_UTTERANCE_WINDOW_MS) {
    return true
  }
  recentUtterances.set(key, now)
  // Prune old entries
  for (const [k, t] of recentUtterances.entries()) {
    if (now - t > 15000) recentUtterances.delete(k)
  }
  return false
}

export function resetUtteranceDeduplication(): void {
  recentUtterances.clear()
}

/**
 * Words too common to be evidence of anything.
 */
export const STOP = new Set(
  ('a an the and or but so of to in on at by for with from is are was were be ' +
    'it its this that these those i you he she we they me him her them my your ' +
    'our their what which who how why when where do does did can could would ' +
    'should will shall not no yes if then than as about into over under out up ' +
    'down one two three first second third now here there just very really got ' +
    'get have has had say said tell me okay ok well right').split(' '),
)

/**
 * Is this the microphone hearing the speakers?
 *
 * Checks against the active speech, recent sentence tail, and historical
 * buffer across both single words and multi-word phrases.
 */
export function isEcho(heard: string, spoken?: string): boolean {
  if (!heard) return false
  if (OVERRIDE.test(heard)) return false

  const heardNorm = norm(heard)
  if (!heardNorm) return true

  const fullSpoken = `${spoken ?? ''} ${speakingNow()} ${getRecentSpokenText()}`.trim()
  const spokenNorm = norm(fullSpoken)
  if (!spokenNorm) return false

  // Direct substring match for longer phrases
  if (spokenNorm.includes(heardNorm) && heardNorm.length >= 6) {
    return true
  }

  const all = heardNorm.split(' ').filter(Boolean)
  if (!all.length) return true

  const mine = new Set(spokenNorm.split(' ').filter(Boolean))
  const content = all.filter((w) => !STOP.has(w))

  // If nothing distinctive was said:
  if (content.length < 2) {
    if (all.length < 2) return false
    return all.every((w) => mine.has(w))
  }

  let hits = 0
  for (const w of content) {
    if (mine.has(w)) hits++
  }

  return hits / content.length >= 0.5
}

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

/**
 * Live state of the voice loop, published on `window.__voice`.
 *
 * When someone says the wake word and nothing happens there are only a handful
 * of possible causes — the recogniser never started, it started and died, it is
 * running but hearing silence, or it is hearing you and transcribing the name
 * as something else. From outside the page those are indistinguishable, which
 * makes the failure impossible to report and impossible to fix. This tells them
 * apart in one glance.
 */
export const diag = {
  /** Which input engine is running: 'elevenlabs' (VAD+Scribe) or 'browser'. */
  engine: 'browser',
  /** Whether the microphone pipeline is live. */
  running: false,
  /** Speech segments captured since load. */
  sessions: 0,
  /** The most recent transcript, whatever the mode. */
  heard: '',
  heardAt: 0,
  /** Last failure — a transcription error, or a capture error. */
  lastError: '',
  /** Times the wake word matched. */
  wakes: 0,
  /** Current mode, as the app last reported it. */
  mode: '',
  /** Why the last transcript was ignored — '' when it was accepted. */
  dropped: '',
  /** Transcripts accepted and passed to the app. */
  accepted: 0,
  /** Text assembled but not yet sent, because the thought looks unfinished. */
  holding: '',
  /** How long the assembler decided to wait before sending, in ms. */
  waitedMs: 0,
  /** Barge-ins suppressed because he had only just started the sentence. */
  selfGuarded: 0,
  /** Transcription failures (network, or the bridge speech proxy). */
  restarts: 0,
  /** Milliseconds the last transcription round-trip took. */
  idleMs: 0,
}

/** Record why a transcript went nowhere. Silence always has a reason; this is
 *  the difference between debugging it and speculating about it. */
function drop(why: string) {
  diag.dropped = why
}

if (typeof window !== 'undefined') {
  ;(window as unknown as Record<string, unknown>).__voice = diag
}

/**
 * Pick the voice engine and start it.
 *
 * Two engines, chosen by what the bridge reported at boot (see capabilities.ts):
 *   - ElevenLabs available -> local voice-activity detection for instant
 *     barge-in, and ElevenLabs Scribe for the words. The reliable path.
 *   - nothing configured -> the browser's own SpeechRecognition, so a student
 *     with no keys still has a working assistant. Less robust, but free and
 *     zero-setup, and guarded by a heartbeat so its silent death is recovered.
 *
 * The microphone is opened once here so a denied permission is reported loudly
 * rather than surfacing later as an unexplained deafness, whichever engine runs.
 */
export async function startVoice(h: VoiceHandlers): Promise<Voice> {
  try {
    await getMic()
  } catch (err) {
    diag.lastError = 'mic'
    h.onError(
      err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Microphone access denied — voice input is unavailable.'
        : 'No microphone available.',
    )
    return { stop: () => {}, live: () => false }
  }

  let activeEngine: Voice | null = null
  let stopped = false

  const switchToBrowser = (reason: string) => {
    if (stopped) return
    console.warn(`[GACKS P.A] Switching to browser speech recognition: ${reason}`)
    tracer.log('FALLBACK_TRIGGERED', 'voice', `STT fallback to browser SpeechRecognition (${reason})`)
    diag.engine = 'browser'
    diag.lastError = reason
    try {
      activeEngine?.stop()
    } catch {}
    activeEngine = startBrowserVoice(h)
  }

  if (caps().stt) {
    diag.engine = 'elevenlabs'
    try {
      activeEngine = await startElevenVoice(h, (reason) => switchToBrowser(reason))
    } catch (err) {
      switchToBrowser(String(err))
    }
  } else {
    diag.engine = 'browser'
    activeEngine = startBrowserVoice(h)
  }

  return {
    stop: () => {
      stopped = true
      activeEngine?.stop()
    },
    live: () => activeEngine?.live() ?? false,
  }
}

/** VAD + ElevenLabs Scribe. */
async function startElevenVoice(
  h: VoiceHandlers,
  onFallback?: (reason: string) => void,
): Promise<Voice> {
  let lastWake = 0
  let vad: Vad | null = null

  const pendingAudio: Blob[] = []
  let draining = false

  const assemble = makeAssembler({
    emit: (text) => {
      const clean = text.trim()
      if (isMeaninglessUtterance(clean)) {
        drop('meaningless filler utterance')
        return
      }
      if (isDuplicateUtterance(clean)) {
        drop('duplicate voice utterance')
        return
      }
      diag.dropped = ''
      diag.accepted++
      diag.holding = ''
      const event: UserSpeechInputEvent = {
        type: 'USER_SPEECH_INPUT',
        source: 'user',
        text: clean,
        final: true,
        id: `utt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      }
      h.onUtterance(clean, event)
    },
    partial: (text) => h.onPartial(text),
  })

  /**
   * Send one captured segment to the bridge and act on the words.
   */
  const transcribe = async (blob: Blob) => {
    const mode = h.mode()
    if (mode === 'deaf') return
    const t0 = performance.now()
    try {
      const res = await fetch(`${BRIDGE_HTTP_URL}/stt`, {
        method: 'POST',
        headers: { 'content-type': blob.type || 'audio/webm' },
        body: blob,
      })
      diag.idleMs = Math.round(performance.now() - t0)
      if (!res.ok) {
        diag.restarts++
        diag.lastError = `stt ${res.status}`
        drop(`transcription failed (${res.status})`)
        onFallback?.(`STT service returned HTTP ${res.status}`)
        return
      }
      const { text } = (await res.json()) as { text?: string }
      const said = (text ?? '').trim()
      diag.lastError = ''

      if (!said) {
        drop('nothing intelligible in the segment')
        return
      }

      // His own voice, come back through the microphone.
      if (isEcho(said, speakingNow())) {
        drop('echo of his own voice')
        return
      }

      if (isMeaninglessUtterance(said) && mode !== 'wake') {
        drop('meaningless filler sound')
        return
      }

      diag.heard = said
      diag.heardAt = Date.now()

      if (mode === 'wake') {
        if (WAKE.test(said) && Date.now() - lastWake > WAKE_DEBOUNCE) {
          lastWake = Date.now()
          diag.wakes++
          diag.dropped = ''
          diag.accepted++
          h.onWake(afterWake(said))
        } else {
          drop(`heard "${said.slice(-40)}" — not his name`)
        }
        return
      }

      assemble.feed(said, vad?.meter().speaking ?? false)
    } catch (err) {
      diag.restarts++
      diag.lastError = String(err)
      drop('could not reach the speech service')
      onFallback?.(String(err))
    }
  }

  /** One transcription at a time, in the order the segments were spoken. */
  const drain = async () => {
    if (draining) return
    draining = true
    try {
      while (pendingAudio.length) {
        await transcribe(pendingAudio.shift()!)
      }
    } finally {
      draining = false
    }
  }

  vad = await startVad({
    onStart: () => {
      const mode = h.mode()
      diag.mode = mode
      diag.sessions++
      if (mode === 'deaf') return
      if (mode === 'wake') assemble.cancel()
      if (mode === 'guard') {
        const since = speakingSince()
        if (since && Date.now() - since < 750) {
          diag.selfGuarded++
          return
        }
        h.onSpeechStart()
      }
    },
    onEnd: (blob) => {
      pendingAudio.push(blob)
      void drain()
    },
    onLevel: (v) => {
      const mode = h.mode()
      if (mode !== 'command') return
      if (assemble.held()) return
      h.onPartial(v > 0.04 ? '…' : '')
    },
    onError: (message) => {
      diag.lastError = 'capture'
      diag.running = false
      h.onError(message)
    },
  })
  diag.running = vad.live()

  const guardPoll = setInterval(() => {
    const mode = h.mode()
    vad?.setGuard(mode === 'guard')
    if ((mode === 'wake' || mode === 'deaf') && assemble.held()) assemble.cancel()
  }, 200)

  return {
    stop: () => {
      clearInterval(guardPoll)
      assemble.cancel()
      vad?.stop()
      diag.running = false
    },
    live: () => vad?.live() ?? false,
  }
}

/* -------------------------------------------------------------------------- */
/* Browser fallback: SpeechRecognition                                        */
/* -------------------------------------------------------------------------- */

function startBrowserVoice(h: VoiceHandlers): Voice {
  const Ctor =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
  if (!Ctor) {
    h.onError('This browser has no speech recognition — use Chrome or Edge, or add an ElevenLabs key.')
    return { stop: () => {}, live: () => false }
  }

  let stopped = false
  let running = false
  let rec: any = null
  let settled = ''
  let interim = ''
  let started = false
  let barged = false
  let lastWake = 0
  let lastAlive = Date.now()
  let silenceTimer: ReturnType<typeof setTimeout> | null = null

  const assemble = makeAssembler({
    emit: (text) => {
      const clean = text.trim()
      if (isMeaninglessUtterance(clean)) {
        drop('meaningless filler utterance')
        return
      }
      if (isDuplicateUtterance(clean)) {
        drop('duplicate voice utterance')
        return
      }
      diag.dropped = ''
      diag.accepted++
      diag.holding = ''
      const event: UserSpeechInputEvent = {
        type: 'USER_SPEECH_INPUT',
        source: 'user',
        text: clean,
        final: true,
        id: `utt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      }
      h.onUtterance(clean, event)
    },
    partial: (text) => h.onPartial(text),
  })

  const touch = () => {
    lastAlive = Date.now()
  }

  const clearSilence = () => {
    if (silenceTimer) clearTimeout(silenceTimer)
    silenceTimer = null
  }

  const reset = () => {
    clearSilence()
    settled = ''
    interim = ''
    started = false
    barged = false
  }

  const emit = () => {
    const text = `${settled} ${interim}`.replace(/\s+/g, ' ').trim()
    const mode = h.mode()
    reset()
    if (!text || mode === 'deaf') return
    if (isEcho(text, speakingNow())) {
      drop('echo of his own voice')
      return
    }
    if (isMeaninglessUtterance(text) && mode !== 'wake') {
      drop('meaningless filler sound')
      return
    }
    diag.heard = text
    diag.heardAt = Date.now()
    if (mode === 'wake') {
      assemble.cancel()
      if (WAKE.test(text) && Date.now() - lastWake > WAKE_DEBOUNCE) {
        lastWake = Date.now()
        diag.wakes++
        diag.dropped = ''
        diag.accepted++
        h.onWake(afterWake(text))
      } else {
        drop(`heard "${text.slice(-40)}" — not his name`)
      }
      return
    }
    assemble.feed(text, false)
  }

  const bumpSilence = () => {
    clearSilence()
    silenceTimer = setTimeout(emit, 900)
  }

  const onResult = (e: any) => {
    touch()
    const mode = h.mode()
    diag.mode = mode
    if (mode === 'deaf') {
      interim = ''
      return
    }
    let fresh = ''
    interim = ''
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const chunk = e.results[i][0].transcript as string
      if (e.results[i].isFinal) fresh += chunk
      else interim += chunk
    }
    const heard = `${settled}${fresh} ${interim}`.replace(/\s+/g, ' ').trim()
    if (!heard) return
    if (isEcho(`${fresh} ${interim}`, speakingNow())) {
      interim = ''
      return
    }

    if (mode === 'wake') {
      settled += fresh
      if (WAKE.test(heard) && Date.now() - lastWake > WAKE_DEBOUNCE) {
        lastWake = Date.now()
        diag.wakes++
        const trailing = afterWake(heard)
        reset()
        h.onWake(trailing)
      } else if (settled.length > 400) {
        settled = ''
      }
      return
    }

    settled += fresh
    const full = `${settled} ${interim}`.replace(/\s+/g, ' ').trim()
    if (!started || (mode === 'guard' && !barged)) {
      if (mode === 'guard') {
        if (OVERRIDE.test(full)) {
          // Intentional override word ("stop", "wait", etc.) cuts through immediately
          started = true
          barged = true
          h.onSpeechStart()
        } else {
          // Regular speech during guard mode
          if (isAssistantSpeaking() || isEcho(full, speakingNow())) {
            return
          }
          const since = speakingSince()
          if (since && Date.now() - since < 750) {
            diag.selfGuarded++
            return
          }
          const nonStopWords = full
            .split(/\s+/)
            .filter((w) => !STOP.has(norm(w))).length
          if (nonStopWords < 2) return

          started = true
          barged = true
          h.onSpeechStart()
        }
      } else {
        started = true
        h.onSpeechStart()
      }
    }
    diag.dropped = ''
    const carried = assemble.held()
    h.onPartial(carried ? `${carried} ${full}` : full)
    bumpSilence()
  }

  const spin = () => {
    if (stopped || running) return
    rec = new Ctor()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-GB'
    rec.onstart = () => {
      running = true
      diag.running = true
      diag.sessions++
      touch()
    }
    rec.onresult = onResult
    rec.onerror = (ev: any) => {
      diag.lastError = String(ev.error ?? '')
      if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
        stopped = true
        diag.running = false
        h.onError('Microphone access was refused — voice input is unavailable.')
      }
    }
    rec.onend = () => {
      running = false
      diag.running = false
      touch()
      rec = null
      if (!stopped) setTimeout(spin, 80)
    }
    try {
      rec.start()
    } catch {
      running = false
      setTimeout(spin, 250)
    }
  }

  spin()

  const health = setInterval(() => {
    if (stopped) return
    const idle = Date.now() - lastAlive
    diag.idleMs = idle
    if (idle < 15000) return
    diag.restarts++
    try {
      rec?.abort()
    } catch {}
    rec = null
    running = false
    diag.running = false
    touch()
    spin()
  }, 5000)

  return {
    stop: () => {
      stopped = true
      clearInterval(health)
      clearSilence()
      assemble.cancel()
      diag.running = false
      try {
        rec?.abort()
      } catch {}
    },
    live: () => running,
  }
}
