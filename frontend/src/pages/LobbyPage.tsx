import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import PageBackdrop from './PageBackdrop'

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
      <PageBackdrop src="/images/eevee-evolutions-wallpaper.png" shiftY={-165} />
      <header className="lobby-header">
        <div>
          <h1 className="mantinia">{user.username}</h1>
          <p className="lobby-stats">
            <span title="Wins">🏆 {user.wins}</span>
            <span title="Points">✦ {user.points}</span>
            <span title="Potions">🧪 {user.potions}</span>
          </p>
        </div>
        <nav className="lobby-nav">
          <Link className="button-link secondary glass" to="/leaderboard">
            Leaderboard
          </Link>
          <button className="secondary glass" onClick={onLogout}>
            Log out
          </button>
        </nav>
      </header>

      <section className="boss-select">
        <h2 className="mantinia">Boss Fights</h2>
        <button className="boss-card" onClick={() => navigate('/game')}>
          <img className="boss-card-art" src="/images/sirius-orion-icon.png" alt="" />
          <img className="boss-card-art boss-card-art-hover" src="/images/sirius-orion-hovered.png" alt="" />
          <span className="boss-card-title">SIRIUS &amp; ORION</span>
          <span className="boss-card-sub">THE TWIN CONSTELLATIONS</span>
        </button>
      </section>
    </main>
  )
}
