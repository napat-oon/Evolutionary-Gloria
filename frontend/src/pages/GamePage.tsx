import { Link } from 'react-router-dom'

export default function GamePage() {
  return (
    <main className="page">
      <h1>Intermission Stage</h1>
      <p>The Phaser game mounts here in M4 — potion shop, corridor, and the boss room beyond.</p>
      <Link className="button-link secondary" to="/lobby">
        Back to lobby
      </Link>
    </main>
  )
}
