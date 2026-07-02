import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../app/api'
import type { UserResponse } from '../app/api'
import { useAuth } from '../app/AuthContext'
import PhaserGame from '../game/core/PhaserGame'

const POTION_PRICE = 50

export default function GamePage() {
  const { user, refreshUser } = useAuth()
  const [shopOpen, setShopOpen] = useState(false)
  const [shopError, setShopError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [potions, setPotions] = useState(user?.potions ?? 0)
  const [points, setPoints] = useState(user?.points ?? 0)

  const onShopOpen = useCallback(() => setShopOpen(true), [])
  const onPotionsUsed = useCallback((remaining: number) => setPotions(remaining), [])

  async function buyPotion() {
    setBusy(true)
    setShopError(null)
    try {
      const updated = await api.post<UserResponse>('/api/shop/potions', { quantity: 1 })
      setPotions(updated.potions)
      setPoints(updated.points)
      await refreshUser()
    } catch (e) {
      setShopError(e instanceof Error ? e.message : 'Purchase failed')
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <main className="game-page">
      <header className="game-topbar">
        <Link className="button-link secondary" to="/lobby">
          ← Lobby
        </Link>
        <span className="game-points">✦ {points} points</span>
      </header>

      <PhaserGame potions={potions} onShopOpen={onShopOpen} onPotionsUsed={onPotionsUsed} />

      {shopOpen && (
        <div className="shop-overlay" role="dialog">
          <div className="shop-modal">
            <h2>Potion Shop</h2>
            <p>
              Potions restore 40 HP instantly (press R in combat).
              <br />
              You carry <strong>{potions}</strong> · ✦ {points} points
            </p>
            {shopError && <p className="form-error">{shopError}</p>}
            <div className="shop-actions">
              <button onClick={buyPotion} disabled={busy || points < POTION_PRICE}>
                Buy 1 potion (✦ {POTION_PRICE})
              </button>
              <button className="secondary" onClick={() => setShopOpen(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
