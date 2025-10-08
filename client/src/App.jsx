import React, { useEffect, useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!token || !me?.is_admin) return; // Ha nincs token vagy nem admin, ne próbálkozzunk

    axios.get('https://sg-vote-xxqh.onrender.com/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => setStats(r.data))
    .catch(err => {
      console.error(err);
      alert('Nem sikerült lekérni a statisztikákat. Ellenőrizd a bejelentkezést és a token-t.');
    })
  }, [token, me]);


  if (!token) {
    return (
      <Login onLogin={(t, user) => {
        setToken(t);
        localStorage.setItem('token', t);
        setMe(user);
      }} />
    );
  }

  if (me?.is_admin) {
    return (
      <Admin
        token={token}
        me={me}
        onLogout={() => {
          setToken(null);
          localStorage.removeItem('token');
          setMe(null);
        }}
      />
    )
  }

  return (
    <Dashboard
      token={token}
      me={me}
      onLogout={() => {
        setToken(null);
        localStorage.removeItem('token');
        setMe(null);
      }}
    />
  )
}
