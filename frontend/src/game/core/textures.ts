import Phaser from 'phaser'

/**
 * Placeholder art: every visual is generated at boot so real spritesheets can
 * replace them later by swapping this module for a file-based loader without
 * touching gameplay code (textures are only referenced by key).
 */
export const TEX = {
  eevee: 'tex-eevee',
  ground: 'tex-ground',
  platform: 'tex-platform',
  wall: 'tex-wall',
  star: 'tex-star',
  leaf: 'tex-leaf',
  icicle: 'tex-icicle',
  ribbon: 'tex-ribbon',
  spark: 'tex-spark',
  aoe: 'tex-aoe',
  bubble: 'tex-bubble',
  shopPad: 'tex-shop-pad',
  door: 'tex-door',
  dummy: 'tex-dummy',
} as const

export function makePlaceholderTextures(scene: Phaser.Scene): void {
  const g = scene.add.graphics()

  const make = (key: string, w: number, h: number, draw: () => void) => {
    g.clear()
    draw()
    g.generateTexture(key, w, h)
  }

  make(TEX.eevee, 36, 30, () => {
    g.fillStyle(0xb98a5a) // body
    g.fillRoundedRect(6, 6, 24, 20, 7)
    g.fillStyle(0x8a6544) // ears
    g.fillTriangle(10, 8, 14, 0, 18, 8)
    g.fillTriangle(18, 8, 22, 0, 26, 8)
    g.fillStyle(0xf3d9ae) // flower-shaped tail: petals
    g.fillCircle(5, 12, 4)
    g.fillCircle(1, 16, 4)
    g.fillCircle(5, 20, 4)
    g.fillCircle(9, 16, 4)
    g.fillStyle(0xd9668c)
    g.fillCircle(5, 16, 3)
  })

  make(TEX.ground, 64, 64, () => {
    g.fillStyle(0x232842)
    g.fillRect(0, 0, 64, 64)
    g.fillStyle(0x2f3558)
    g.fillRect(0, 0, 64, 6)
  })

  make(TEX.platform, 96, 14, () => {
    g.fillStyle(0x39406b)
    g.fillRoundedRect(0, 0, 96, 14, 6)
  })

  make(TEX.wall, 32, 128, () => {
    g.fillStyle(0x2f3558)
    g.fillRect(0, 0, 32, 128)
  })

  make(TEX.star, 14, 14, () => {
    g.fillStyle(0xffe066)
    g.fillCircle(7, 7, 5)
    g.fillStyle(0xfff7cc)
    g.fillCircle(7, 7, 2)
  })

  make(TEX.leaf, 16, 10, () => {
    g.fillStyle(0x69c76b)
    g.fillEllipse(8, 5, 15, 8)
  })

  make(TEX.icicle, 10, 26, () => {
    g.fillStyle(0xaee3ff)
    g.fillTriangle(0, 26, 10, 26, 5, 0)
  })

  make(TEX.ribbon, 8, 44, () => {
    g.fillStyle(0xff9ad5)
    g.fillRoundedRect(0, 0, 8, 44, 4)
  })

  make(TEX.spark, 8, 8, () => {
    g.fillStyle(0xfff9a8)
    g.fillCircle(4, 4, 3)
  })

  make(TEX.aoe, 96, 64, () => {
    g.fillStyle(0x4b2a6b, 0.65)
    g.fillEllipse(48, 32, 94, 62)
  })

  make(TEX.bubble, 56, 56, () => {
    g.lineStyle(3, 0xc79bff, 0.8)
    g.strokeCircle(28, 28, 25)
    g.fillStyle(0xc79bff, 0.12)
    g.fillCircle(28, 28, 25)
  })

  make(TEX.shopPad, 48, 10, () => {
    g.fillStyle(0xf0c34e)
    g.fillRoundedRect(0, 0, 48, 10, 4)
  })

  make(TEX.door, 28, 72, () => {
    g.fillStyle(0x7a5cff)
    g.fillRoundedRect(0, 0, 28, 72, 6)
    g.fillStyle(0xcabfff)
    g.fillRect(4, 8, 20, 56)
  })

  make(TEX.dummy, 28, 40, () => {
    g.fillStyle(0x8b93b8)
    g.fillRoundedRect(4, 4, 20, 32, 6)
    g.fillStyle(0x6d7498)
    g.fillRect(12, 36, 4, 4)
  })

  g.destroy()
}
