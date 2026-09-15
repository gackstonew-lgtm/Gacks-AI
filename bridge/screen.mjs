import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

const SCREEN_DESCRIPTION = `Capture and view what is currently open on the user's screen, desktop, or window.

Captures one frame of the display and returns it as an image you can inspect, read, and analyze.

Use this tool whenever the user asks:
- "look at my screen"
- "what is on my screen right now?"
- "summarize what I am looking at"
- "explain this code on my screen"
- "help me debug what is open on my display"
- "read this webpage/document/error on my screen"

Always describe what you observe clearly and address their specific request.`

/**
 * @param {(kind: string, args: object, timeoutMs?: number) => Promise<object>} ask
 *   Sends a request to the browser and resolves with its reply.
 */
export function screenServer(ask) {
  return createSdkMcpServer({
    name: 'jarvis_screen',
    version: '1.0.0',
    instructions:
      "Inspect and understand what is currently displayed on the user's screen or monitor.",
    alwaysLoad: true,
    tools: [
      tool(
        'capture_screen',
        SCREEN_DESCRIPTION,
        {
          reason: z
            .string()
            .optional()
            .catch(undefined)
            .describe('Reason for screen capture, shown to the user.'),
        },
        async (args) => {
          let reply
          try {
            reply = await ask(
              'capture_screen',
              {
                reason: String(args.reason ?? 'inspecting screen contents').slice(0, 100),
              },
              60_000,
            )
          } catch (err) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text:
                    `Could not capture screen: ${err?.message ?? err}. ` +
                    'Inform the user and verify that screen sharing permission was granted.',
                },
              ],
            }
          }

          if (reply?.error) {
            return {
              isError: true,
              content: [{ type: 'text', text: String(reply.error) }],
            }
          }

          if (typeof reply?.data !== 'string' || !reply.data) {
            return {
              isError: true,
              content: [{ type: 'text', text: 'The screen capture returned no image data.' }],
            }
          }

          return {
            content: [
              { type: 'text', text: 'Current screen capture from the user display:' },
              {
                type: 'image',
                data: reply.data,
                mimeType: reply.mimeType ?? 'image/jpeg',
              },
            ],
          }
        },
      ),
    ],
  })
}
