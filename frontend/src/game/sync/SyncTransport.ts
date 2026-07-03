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
  private closed = false

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
    // A frame can still be in flight while React unmounts; never throw
    // into the game loop over a closed channel.
    if (this.closed) return
    this.channel.postMessage(message)
  }

  subscribe(listener: (message: SyncMessage) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.listeners.clear()
    this.channel.close()
  }
}
