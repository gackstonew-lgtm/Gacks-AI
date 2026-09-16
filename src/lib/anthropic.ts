import type { AskHandlers } from './transport/types'
import { remoteTransport } from './transport/remote'

export type Msg = { role: string; content: string }
export type { AskHandlers }

/**
 * GACKS V2 Client Adapter:
 * Direct browser provider calls are routed through the secure Agent Gateway
 * to prevent leaking secrets into client bundles.
 */
export async function ask(
  messages: Msg[],
  handlers: AskHandlers,
): Promise<{ text: string; tools: string[] }> {
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user')?.content || ''
  return remoteTransport.ask(lastUserMsg, handlers)
}

export function cancel(): void {
  remoteTransport.cancel()
}

export function connectedLabels(): string[] {
  return remoteTransport.connectedLabels()
}
