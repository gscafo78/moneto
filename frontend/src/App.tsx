import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Transactions from './pages/Transactions'
import Accounts from './pages/Accounts'
import Categories from './pages/Categories'
import Login from './pages/Login'

const isAuthenticated = () => !!localStorage.getItem('token')

const PrivateRoute = ({ children }: { children: React.ReactNode }) =>
  isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="accounts" element={<Accounts />} />
        <Route path="categories" element={<Categories />} />
      </Route>
    </Routes>
  )
}
