import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../app/api'
import type { UserResponse } from '../app/api'
import { useAuth } from '../app/AuthContext'
import { SESSION_CHANNEL } from '../app/AuthContext'
import PhaserGame from '../game/core/PhaserGame'
import { otherTab, TAB_BOSS_COLOR } from '../game/sync/messages'
import type { TabId } from '../game/sync/messages'
import { BroadcastChannelTransport } from '../game/sync/SyncTransport'
import { TabSync } from '../game/sync/TabSync'
import { formatDuration } from '../lib/format'

const POTION_PRICE = 50
const HOLD_TO_LEAVE_MS = 2000

interface MatchResultView {
  victory: boolean
  pointsEarned: number
  durationMs: number
}

/** Hold for HOLD_TO_LEAVE_MS to trigger — prevents accidental exits mid-fight. */
function HoldButton({ onComplete, children }: { onComplete: () => void; children: string }) {
  const [progress, setProgress] = useState(0)
  const timer = useRef<number | null>(null)

  const stop = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current)
    timer.current = null
    setProgress(0)
  }, [])

  function start() {
    const startedAt = Date.now()
    timer.current = window.setInterval(() => {
      const fraction = (Date.now() - startedAt) / HOLD_TO_LEAVE_MS
      if (fraction >= 1) {
        stop()
        onComplete()
      } else {
        setProgress(fraction)
      }
    }, 40)
  }

  useEffect(() => stop, [stop])

  return (
    <button
      className="secondary hold-button"
      onPointerDown={start}
      onPointerUp={stop}
      onPointerLeave={stop}
      style={{
        background: `linear-gradient(to right, var(--accent-strong) ${progress * 100}%, transparent ${progress * 100}%)`,
      }}
      title="Hold for 2 seconds"
    >
      {progress > 0 ? 'Keep holding…' : children}
    </button>
  )
}

export default function GamePage() {
  const { user, refreshUser } = useAuth()
  const navigate = useNavigate()
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
  const [loggedOut, setLoggedOut] = useState(false)
  // Another tab of this session left for the lobby: the session is over
  // everywhere, so this tab only offers to close itself.
  const [sessionEnded, setSessionEnded] = useState(false)

  // One sync session per mount. Created in the effect (not useMemo) so React
  // StrictMode's mount/unmount/mount cycle gets a fresh, un-disposed channel.
  const [tabSync, setTabSync] = useState<TabSync | null>(null)
  useEffect(() => {
    const sync = new TabSync(tab, new BroadcastChannelTransport())
    setTabSync(sync)
    return () => sync.dispose()
  }, [tab])

  // A logout anywhere (any tab) pauses this game and overlays a notice.
  useEffect(() => {
    const channel = new BroadcastChannel(SESSION_CHANNEL)
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type === 'logout') {
        setLoggedOut(true)
      }
    }
    return () => channel.close()
  }, [])

  const onShopOpen = useCallback(() => setShopOpen(true), [])
  const onSessionEnded = useCallback(() => setSessionEnded(true), [])

  // Mirror tabs don't own the server match, but they still show the outcome.
  const onFightEnded = useCallback(
    (victory: boolean) => {
      if (tab !== 1) {
        setResult({ victory, pointsEarned: 0, durationMs: 0 })
      }
    },
    [tab],
  )
  const onPotionsUsed = useCallback((remaining: number) => setPotions(remaining), [])
  const onWindup = useCallback((color: string) => {
    setAlertColor(color)
    if (alertTimer.current) window.clearTimeout(alertTimer.current)
    alertTimer.current = window.setTimeout(() => setAlertColor(null), 900)
  }, [])

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

  function openOtherTab() {
    window.open(`/game?tab=${otherTab(tab)}`, '_blank')
  }

  /** Leaving ends the session for every tab, not just this one. */
  function leaveToLobby() {
    tabSync?.publishEnded('left')
    navigate('/lobby')
  }

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

  if (!user && !loggedOut) return null

  return (
    <main className="game-page">
      {tabSync && (
        <PhaserGame
          potions={potions}
          tabSync={tabSync}
          paused={loggedOut || sessionEnded}
          onShopOpen={onShopOpen}
          onPotionsUsed={onPotionsUsed}
          onWindup={onWindup}
          onMatchStart={onMatchStart}
          onMatchFinished={onMatchFinished}
          onFightEnded={onFightEnded}
          onSessionEnded={onSessionEnded}
        />
      )}

      <div className="corner corner-tl">
        <button className="secondary" onClick={openOtherTab}>
          ⧉ Open Dimension {otherTab(tab)}
        </button>
        <span className="dimension-badge" style={{ color: TAB_BOSS_COLOR[tab] }}>
          {tab === 1 ? "Sirius's Dimension" : "Orion's Dimension"}
        </span>
      </div>
      <div className="corner corner-tr">
        <span className="game-points">✦ {points} points</span>
        {/* Only the primary dimension can leave; other tabs are pure mirrors. */}
        {tab === 1 && <HoldButton onComplete={leaveToLobby}>Lobby (hold)</HoldButton>}
      </div>

      {alertColor && (
        <div
          className="edge-alert"
          style={{ boxShadow: `inset 0 0 70px 22px ${alertColor}` }}
          aria-hidden
        />
      )}

      {loggedOut && (
        <div className="shop-overlay translucent" role="dialog">
          <div className="shop-modal">
            <h2>Logged out</h2>
            <p>This account has been logged out. The fight has been suspended.</p>
            <div className="shop-actions">
              {tab === 1 ? (
                <Link className="button-link" to="/login">
                  Back to login
                </Link>
              ) : (
                <button onClick={() => window.close()}>Close this tab</button>
              )}
            </div>
          </div>
        </div>
      )}

      {sessionEnded && !loggedOut && (
        <div className="shop-overlay translucent" role="dialog">
          <div className="shop-modal">
            <h2>Session ended</h2>
            <p>
              The player left to the lobby from another tab, so this dimension
              has been sealed. Close this tab — start the next fight from the
              lobby.
            </p>
            <div className="shop-actions">
              <button onClick={() => window.close()}>Close this tab</button>
            </div>
          </div>
        </div>
      )}

      {result && !loggedOut && !sessionEnded && (
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
              {tab === 1 ? (
                <>
                  <button onClick={() => window.location.reload()}>Fight again</button>
                  <Link className="button-link secondary" to="/lobby">
                    Back to lobby
                  </Link>
                </>
              ) : (
                <button onClick={() => window.close()}>Close this tab</button>
              )}
            </div>
          </div>
        </div>
      )}

      {shopOpen && !loggedOut && (
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
