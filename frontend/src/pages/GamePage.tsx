import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../app/api'
import type { UserResponse } from '../app/api'
import { useAuth } from '../app/AuthContext'
import PhaserGame from '../game/core/PhaserGame'
import { otherTab, TAB_BOSS_COLOR } from '../game/sync/messages'
import type { TabId } from '../game/sync/messages'
import { BroadcastChannelTransport } from '../game/sync/SyncTransport'
import { TabSync } from '../game/sync/TabSync'
import { formatDuration } from '../lib/format'

const POTION_PRICE = 50

interface MatchResultView {
  victory: boolean
  pointsEarned: number
  durationMs: number
}

export default function GamePage() {
  const { user, refreshUser } = useAuth()
  const [searchParams] = useSearchParams()
  const tab: TabId = searchParams.get('tab') === '2' ? 2 : 1

  const [shopOpen, setShopOpen] = useState(false)
  const [shopError, setShopError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [potions, setPotions] = useState(user?.potions ?? 0)
  const [points, setPoints] = useState(user?.points ?? 0)
  const [alertColor, setAlertColor] = useState<string | null>(null)
  const alertTimer = useRef<number | null>(null)
  const matchIdRef = useRef<number | null>(null)
  const [result, setResult] = useState<MatchResultView | null>(null)

  // One sync session per mounted game page.
  const tabSync = useMemo(() => new TabSync(tab, new BroadcastChannelTransport()), [tab])
  useEffect(() => () => tabSync.dispose(), [tabSync])

  const onShopOpen = useCallback(() => setShopOpen(true), [])
  const onPotionsUsed = useCallback((remaining: number) => setPotions(remaining), [])
  const onWindup = useCallback((color: string) => {
    setAlertColor(color)
    if (alertTimer.current) window.clearTimeout(alertTimer.current)
    alertTimer.current = window.setTimeout(() => setAlertColor(null), 900)
  }, [])

  function openOtherTab() {
    window.open(`/game?tab=${otherTab(tab)}`, '_blank')
  }

  // Tab 1 owns the server-side match lifecycle (the game emits only there).
  const onMatchStart = useCallback(() => {
    api
      .post<{ matchId: number }>('/api/match/start')
      .then((response) => {
        matchIdRef.current = response.matchId
      })
      .catch(() => {
        matchIdRef.current = null
      })
  }, [])

  const onMatchFinished = useCallback(
    (victory: boolean) => {
      const matchId = matchIdRef.current
      matchIdRef.current = null
      if (matchId === null) {
        setResult({ victory, pointsEarned: 0, durationMs: 0 })
        return
      }
      api
        .post<{ victory: boolean; durationMs: number; pointsEarned: number }>(
          '/api/match/complete',
          { matchId, victory },
        )
        .then((response) => {
          setResult({
            victory: response.victory,
            pointsEarned: response.pointsEarned,
            durationMs: response.durationMs,
          })
          return refreshUser()
        })
        .catch(() => setResult({ victory, pointsEarned: 0, durationMs: 0 }))
    },
    [refreshUser],
  )

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
        <div className="game-topbar-left">
          <button className="secondary" onClick={openOtherTab}>
            ⧉ Open Dimension {otherTab(tab)}
          </button>
          <span className="dimension-badge" style={{ color: TAB_BOSS_COLOR[tab] }}>
            {tab === 1 ? "Sirius's Dimension" : "Orion's Dimension"}
          </span>
        </div>
        <div className="game-topbar-left">
          <span className="game-points">✦ {points} points</span>
          <Link className="button-link secondary" to="/lobby">
            Lobby
          </Link>
        </div>
      </header>

      <PhaserGame
        potions={potions}
        tabSync={tabSync}
        onShopOpen={onShopOpen}
        onPotionsUsed={onPotionsUsed}
        onWindup={onWindup}
        onMatchStart={onMatchStart}
        onMatchFinished={onMatchFinished}
      />

      {result && (
        <div className="shop-overlay" role="dialog">
          <div className="shop-modal result-modal">
            <h2>{result.victory ? 'VICTORY' : 'DEFEAT'}</h2>
            {tab === 1 ? (
              <p>
                {result.victory
                  ? 'The Twin Constellations fall silent.'
                  : 'The twins remain… for now.'}
                <br />
                Points earned: <strong>✦ {result.pointsEarned}</strong>
                {result.durationMs > 0 && (
                  <>
                    <br />
                    Time: {formatDuration(result.durationMs)}
                  </>
                )}
              </p>
            ) : (
              <p>The outcome echoes from the other dimension.</p>
            )}
            <div className="shop-actions">
              <button onClick={() => window.location.reload()}>Fight again</button>
              <Link className="button-link secondary" to="/lobby">
                Back to lobby
              </Link>
            </div>
          </div>
        </div>
      )}

      {alertColor && (
        <div
          className="edge-alert"
          style={{ boxShadow: `inset 0 0 70px 22px ${alertColor}` }}
          aria-hidden
        />
      )}

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
