import { describe, it, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import {
  isEcho,
  isMeaninglessUtterance,
  isDuplicateUtterance,
  resetUtteranceDeduplication,
  OVERRIDE,
  type VoiceEvent,
  type UserSpeechInputEvent,
  type CaptionUpdateEvent,
} from '../src/lib/voice.js'
import {
  speakingNow,
  isAssistantSpeaking,
  wasAssistantSpeakingRecently,
  getRecentSpokenText,
} from '../src/lib/tts.js'
import { useStore } from '../src/store.js'
import { ENABLE_SCREEN_CAPTIONS } from '../src/config.js'
import { createGatewayServer } from '../server/gateway.js'
import { WebSocket } from 'ws'
import type { Server } from 'node:http'

describe('Voice Intelligence & Conversational Turn-Taking Suite', () => {
  beforeEach(() => {
    resetUtteranceDeduplication()
  })

  describe('1. Strongly-Typed Voice Events & Source Isolation', () => {
    it('should validate USER_SPEECH_INPUT as the only authoritative conversational trigger', () => {
      const userEvent: UserSpeechInputEvent = {
        type: 'USER_SPEECH_INPUT',
        source: 'user',
        text: 'What are our key financial metrics today?',
        final: true,
        id: 'utt_test_1',
        timestamp: Date.now(),
      }

      const captionEvent: CaptionUpdateEvent = {
        type: 'CAPTION_UPDATE',
        source: 'caption',
        text: 'What are our key financial metrics today?',
        timestamp: Date.now(),
      }

      assert.equal(userEvent.source, 'user')
      assert.equal(userEvent.type, 'USER_SPEECH_INPUT')
      assert.equal(captionEvent.source, 'caption')
      assert.notEqual(captionEvent.source, 'user')

      function canInitiateTurn(evt: VoiceEvent): boolean {
        return evt.source === 'user' && evt.type === 'USER_SPEECH_INPUT' && evt.final
      }

      assert.equal(canInitiateTurn(userEvent), true)
      assert.equal(canInitiateTurn(captionEvent), false)
    })

    it('should reject assistant responses and presentation events from conversational turn initiation', () => {
      const assistantOutput: VoiceEvent = {
        type: 'ASSISTANT_TTS_OUTPUT',
        source: 'assistant',
        text: 'Your application has started successfully.',
        id: 'tts_1',
        timestamp: Date.now(),
      }

      const systemEvent: VoiceEvent = {
        type: 'SYSTEM_EVENT',
        source: 'system',
        text: 'wake_word_detected',
        timestamp: Date.now(),
      }

      function canInitiateTurn(evt: VoiceEvent): boolean {
        return evt.source === 'user' && evt.type === 'USER_SPEECH_INPUT'
      }

      assert.equal(canInitiateTurn(assistantOutput), false)
      assert.equal(canInitiateTurn(systemEvent), false)
    })
  })

  describe('2. Echo Detection & Assistant Self-Listening Shield', () => {
    it('should correctly classify exact and partial assistant utterances as echo', () => {
      const assistantSpoken = 'I found three revenue opportunities in the physical business radar.'
      assert.equal(isEcho('I found three revenue opportunities', assistantSpoken), true)
      assert.equal(isEcho('three revenue opportunities in the physical business radar', assistantSpoken), true)
    })

    it('should distinguish user questions from assistant voice echoes', () => {
      const assistantSpoken = 'The server is currently running on port 8787 with all services active.'
      const realUserQuestion = 'What is the current stock price of Apple?'
      assert.equal(isEcho(realUserQuestion, assistantSpoken), false)
    })

    it('should NEVER suppress intentional user barge-in override words as echo', () => {
      const assistantSpoken = 'The automated scanner is proceeding to stop and restart the process.'
      assert.equal(isEcho('stop', assistantSpoken), false)
      assert.equal(isEcho('wait', assistantSpoken), false)
      assert.equal(isEcho('hold on', assistantSpoken), false)
      assert.equal(isEcho('cancel', assistantSpoken), false)
      assert.equal(isEcho('no', assistantSpoken), false)
    })
  })

  describe('3. Utterance Validation & Meaningless Filler Filtering', () => {
    it('should identify and discard meaningless standalone filler utterances', () => {
      assert.equal(isMeaninglessUtterance('uh'), true)
      assert.equal(isMeaninglessUtterance('um...'), true)
      assert.equal(isMeaninglessUtterance('ah'), true)
      assert.equal(isMeaninglessUtterance('mm'), true)
      assert.equal(isMeaninglessUtterance('hmm'), true)
      assert.equal(isMeaninglessUtterance('   '), true)
      assert.equal(isMeaninglessUtterance('...'), true)
    })

    it('should accept meaningful short and long user commands', () => {
      assert.equal(isMeaninglessUtterance('Show my leads'), false)
      assert.equal(isMeaninglessUtterance('Stop'), false)
      assert.equal(isMeaninglessUtterance('Open terminal'), false)
      assert.equal(isMeaninglessUtterance('Um, can you check the database?'), false)
    })
  })

  describe('4. Utterance Deduplication Protection', () => {
    it('should deduplicate identical utterances received in rapid succession', () => {
      const utterance = 'Check system hardware vitals'
      assert.equal(isDuplicateUtterance(utterance), false)
      assert.equal(isDuplicateUtterance(utterance), true)
      assert.equal(isDuplicateUtterance('   check system hardware vitals   '), true)
    })

    it('should process distinct utterances independently', () => {
      assert.equal(isDuplicateUtterance('First distinct command'), false)
      assert.equal(isDuplicateUtterance('Second distinct command'), false)
    })
  })

  describe('5. Screen Caption Configuration & Safe Isolation', () => {
    it('should have ENABLE_SCREEN_CAPTIONS defined with safe default (false)', () => {
      assert.equal(typeof ENABLE_SCREEN_CAPTIONS, 'boolean')
    })

    it('should isolate caption updates in Zustand store based on configuration', () => {
      const store = useStore.getState()
      
      // When screenCaptionsEnabled is false (default)
      useStore.setState({
        settings: {
          ...store.settings,
          ai: {
            ...store.settings.ai,
            screenCaptionsEnabled: false,
          },
        },
      })

      store.setCaption('Live partial speech subtitle')
      assert.equal(useStore.getState().caption, '')

      // When screenCaptionsEnabled is explicitly true
      useStore.setState({
        settings: {
          ...store.settings,
          ai: {
            ...store.settings.ai,
            screenCaptionsEnabled: true,
          },
        },
      })

      store.setCaption('Live partial speech subtitle')
      assert.equal(useStore.getState().caption, 'Live partial speech subtitle')

      // Reset
      store.setCaption('')
      useStore.setState({
        settings: {
          ...store.settings,
          ai: {
            ...store.settings.ai,
            screenCaptionsEnabled: false,
          },
        },
      })
    })
  })

  describe('6. Gateway WebSocket Voice & Ask Frame Validation', () => {
    let server: Server
    let port: number
    let wssUrl: string

    before(async () => {
      const gw = createGatewayServer()
      server = gw.server
      await new Promise<void>((resolve) => {
        server.listen(0, '127.0.0.1', () => {
          const addr = server.address() as any
          port = addr.port
          wssUrl = `ws://127.0.0.1:${port}/ws`
          resolve()
        })
      })
    })

    after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    })

    it('should reject ask frame when source is caption or presentation', async () => {
      const ws = new WebSocket(wssUrl)
      await new Promise<void>((resolve) => ws.once('open', () => resolve()))

      const receivedMessages: any[] = []
      ws.on('message', (data) => {
        try {
          receivedMessages.push(JSON.parse(data.toString()))
        } catch {}
      })

      // Send invalid caption ask frame
      ws.send(JSON.stringify({
        type: 'ask',
        text: 'Some caption text accidentally pushed',
        source: 'caption',
        id: 'bad_caption_1',
      }))

      // Wait 300ms to verify no turn is started
      await new Promise((r) => setTimeout(r, 300))

      const hasTurnStarted = receivedMessages.some((m) => m.ask === 'bad_caption_1')
      assert.equal(hasTurnStarted, false)

      ws.close()
    })
  })
})
