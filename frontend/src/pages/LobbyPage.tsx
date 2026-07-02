import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'

export default function LobbyPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function onLogout() {
    await logout()
    navigate('/login')
  }

  if (!user) return null

  return (
    <main className="page lobby">
      <header className="lobby-header">
        <div>
          <h1>{user.username}</h1>
          <p className="lobby-stats">
            <span title="Wins">🏆 {user.wins}</span>
            <span title="Points">✦ {user.points}</span>
            <span title="Potions">🧪 {user.potions}</span>
          </p>
        </div>
        <nav className="lobby-nav">
          <Link className="button-link secondary" to="/leaderboard">
            Leaderboard
          </Link>
          <button className="secondary" onClick={onLogout}>
            Log out
          </button>
        </nav>
      </header>

      <section className="boss-select">
        <h2>Boss Fights</h2>
        <button className="boss-card" onClick={() => navigate('/game')}>
          <span className="boss-card-title">Sirius &amp; Orion</span>
          <span className="boss-card-sub">The Twin Constellations</span>
        </button>
      </section>
    </main>
  )
}
