import { useNavigate } from 'react-router-dom'
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
    <main className="page">
      <h1>Welcome, {user.username}</h1>
      <p>
        Wins: {user.wins} · Points: {user.points} · Potions: {user.potions}
      </p>
      <p>Boss Fight select coming in M2.</p>
      <button onClick={onLogout}>Log out</button>
    </main>
  )
}
