import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './AuthContext'
import ProtectedRoute from './ProtectedRoute'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import ForgotPasswordPage from '../pages/ForgotPasswordPage'
import ResetPasswordPage from '../pages/ResetPasswordPage'
import LobbyPage from '../pages/LobbyPage'
import LeaderboardPage from '../pages/LeaderboardPage'
import GamePage from '../pages/GamePage'

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Navigate to="/lobby" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot" element={<ForgotPasswordPage />} />
        <Route path="/reset" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/game" element={<GamePage />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
