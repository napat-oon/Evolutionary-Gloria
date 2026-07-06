import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../app/api'
import { formatDuration } from '../lib/format'
import PageBackdrop from './PageBackdrop'

interface LeaderboardEntry {
  username: string
  wins: number
  points: number
  bestTimeMs: number | null
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<LeaderboardEntry[]>('/api/leaderboard')
      .then(setEntries)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load leaderboard'))
  }, [])

  return (
    <main className="page">
      <PageBackdrop src="/images/umbreon-eevee-leaderboard.png" shiftY={-400} />
      <h1 className="mantinia">Leaderboard</h1>
      {error && <p className="form-error">{error}</p>}
      {!entries && !error && (
        <div className="loading-overlay" role="status">
          <div className="loading-box">Loading…</div>
        </div>
      )}
      {entries && (
        <div className="table-wrap">
          <table className="leaderboard glass">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Wins</th>
                <th>Points</th>
                <th>Best time</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry, index) => (
                <tr key={entry.username}>
                  <td>{index + 1}</td>
                  <td>{entry.username}</td>
                  <td>{entry.wins}</td>
                  <td>{entry.points}</td>
                  <td>{entry.bestTimeMs === null ? '—' : formatDuration(entry.bestTimeMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Link className="button-link secondary glass" to="/lobby">
        Back to lobby
      </Link>
    </main>
  )
}
