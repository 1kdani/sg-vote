import React, { useEffect, useState } from 'react'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import axios from 'axios'

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [me, setMe] = useState(null);

  useEffect(() => {
    if (!token) return;

    axios.get('https://sg-vote-xxqh.onrender.com/api/me', {
      headers: { Authorization: 'Bearer ' + token }
    })
    .then(r => {
      if (r.data?.id !== undefined) {
        setMe(r.data);
      } else {
        setToken(null);
        localStorage.removeItem('token');
      }
    })
    .catch(() => {
      setToken(null);
      localStorage.removeItem('token');
    });
  }, [token]);

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
