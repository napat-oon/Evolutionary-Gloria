export type StarColor = 'jade' | 'crimson'

/**
 * The twins' shared passive. Every special attack adds one star of the
 * caster's color. Rules from the design spec:
 *  - at most 7 stars, FIFO: an 8th star evicts the oldest
 *  - at most 2 stars of the same color may be added in a row (a 3rd is refused)
 *  - at 7 stars the ultimate unlocks; using it consumes stars last-to-first
 */
export class ConstellationTracker {
  static readonly CAPACITY = 7

  private stars: StarColor[] = []

  /** @returns true when the star was accepted */
  add(color: StarColor): boolean {
    const count = this.stars.length
    if (count >= 2 && this.stars[count - 1] === color && this.stars[count - 2] === color) {
      return false
    }
    this.stars.push(color)
    if (this.stars.length > ConstellationTracker.CAPACITY) {
      this.stars.shift()
    }
    return true
  }

  /** Consumes the newest star (ultimate dives run last-to-first). */
  consumeNewest(): StarColor | undefined {
    return this.stars.pop()
  }

  clear(): void {
    this.stars = []
  }

  /** Adopt another tab's star list (late-join sync). */
  restore(stars: readonly StarColor[]): void {
    this.stars = stars.slice(-ConstellationTracker.CAPACITY)
  }

  get count(): number {
    return this.stars.length
  }

  get isFull(): boolean {
    return this.stars.length === ConstellationTracker.CAPACITY
  }

  /** Oldest first. */
  list(): readonly StarColor[] {
    return [...this.stars]
  }
}
