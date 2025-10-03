import React, { useEffect, useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (token) {
      fetch(process.env.REACT_APP_API_BASE_URL ? process.env.REACT_APP_API_BASE_URL + '/api/me' : 'https://sg-vote-xxqh.onrender.com/api/me', {
        headers: { Authorization: 'Bearer ' + token }
      }).then(r => r.json()).then(data => { if (data && data.id) setMe(data); else { setToken(null); localStorage.removeItem('token'); } }).catch(()=>{ setToken(null); localStorage.removeItem('token'); });
    }
  }, [token]);



  if (!token) return <Login onLogin={(t, user) => { setToken(t); localStorage.setItem('token', t); setMe(user); }} />;
  return <Dashboard token={token} me={me} onLogout={() => { setToken(null); localStorage.removeItem('token'); setMe(null); }} />
}
