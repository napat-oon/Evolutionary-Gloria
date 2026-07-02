import { isSyncMessage } from './messages'
import type { SyncMessage } from './messages'

/**
 * How the two dimensions talk. BroadcastChannel today (same browser);
 * a WebSocket implementation slots in here for multiplayer later.
 */
export interface SyncTransport {
  post(message: SyncMessage): void
  subscribe(listener: (message: SyncMessage) => void): () => void
  close(): void
}

export class BroadcastChannelTransport implements SyncTransport {
  private readonly channel: BroadcastChannel
  private readonly listeners = new Set<(message: SyncMessage) => void>()

  constructor(channelName = 'gloria-tab-sync') {
    this.channel = new BroadcastChannel(channelName)
    this.channel.onmessage = (event: MessageEvent) => {
      if (!isSyncMessage(event.data)) return
      for (const listener of this.listeners) {
        listener(event.data)
      }
    }
  }

  post(message: SyncMessage): void {
    this.channel.postMessage(message)
  }

  subscribe(listener: (message: SyncMessage) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  close(): void {
    this.listeners.clear()
    this.channel.close()
  }
}
