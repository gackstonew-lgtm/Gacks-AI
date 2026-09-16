import { remoteTransport } from './transport/remote'
import type { AskHandlers, CaptureRequest, CaptureResult, ConnectionState } from './transport/types'
import type { Blade, Panel } from '../store'

export type Msg = { role: string; content: string }
export type { AskHandlers, ConnectionState }

export const usingBridge = true

export async function ask(
  prompt: string,
  _history: Msg[],
  handlers: AskHandlers,
): Promise<{ text: string; tools: string[] }> {
  return remoteTransport.ask(prompt, handlers)
}

export async function warm(): Promise<void> {
  await remoteTransport.warm()
}

export function watchServers(fn: (servers: string[]) => void): void {
  remoteTransport.watchServers(fn)
}

export function watchPanels(fn: (panel: Panel) => void): void {
  remoteTransport.watchPanels(fn)
}

export function watchBlades(fn: (blade: Blade) => void): void {
  remoteTransport.watchBlades(fn)
}

export function watchUi(fn: (op: string, args: any) => void): void {
  remoteTransport.watchUi(fn)
}

export function watchCapture(
  fn: (req: CaptureRequest) => Promise<CaptureResult>,
): void {
  remoteTransport.watchCapture(fn)
}

export function watchCaptureScreen(
  fn: (req: { reason?: string }) => Promise<CaptureResult>,
): void {
  remoteTransport.watchCaptureScreen(fn)
}

export function watchMission(fn: (mission: any) => void): void {
  remoteTransport.watchMission(fn)
}

export function cancel(): void {
  remoteTransport.cancel()
}

export function interrupt(): void {
  cancel()
}

export function isConnected(): boolean {
  return remoteTransport.isConnected()
}

export function watchConnection(
  fn: (state: ConnectionState) => void,
): void {
  remoteTransport.watchConnection(fn)
}

export function connectedLabels(): string[] {
  return remoteTransport.connectedLabels()
}
