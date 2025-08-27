import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import PrivateRoute from './components/PrivateRoute';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Assets from './pages/Assets';
import Inventory from './pages/Inventory';
import Logs from './pages/Logs';
import Users from './pages/Users';
import Tickets from './pages/Tickets';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="assets" element={<Assets />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="logs" element={<Logs />} />
            <Route path="tickets" element={<Tickets />} />
            <Route path="users" element={
              <PrivateRoute adminOnly={true}>
                <Users />
              </PrivateRoute>
            } />
          </Route>
        </Routes>
        <Analytics />
        <SpeedInsights />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App
