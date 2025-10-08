import React, { useEffect, useState } from 'react'
import axios from 'axios'

export default function Admin({ token, me, onLogout }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!token || !me?.is_admin) return;

    axios.get('https://sg-vote-xxqh.onrender.com/api/admin/stats', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(r => setStats(r.data))
    .catch(err => {
      console.error(err);
      alert('Nem sikerült lekérni a statisztikákat. Ellenőrizd a bejelentkezést és a token-t.');
    });
  }, [token, me]);

  if (!stats || !stats.top3) return <div>Betöltés...</div>

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <header className="flex justify-between items-center mb-6">
        <h1 className="text-xl font-bold">Adminisztráció</h1>
        <button onClick={onLogout} className="px-3 py-1 border rounded">Kijelentkezés</button>
      </header>

      <section className="mb-6 bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">TOP 3</h2>
        <ol className="list-decimal pl-5">
          {stats.top3.map(c => (
            <li key={c.id}>{c.name} — {c.votes} szavazat</li>
          ))}
        </ol>
      </section>

      <section className="mb-6 bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Teljes állás</h2>
        {stats.all.map(c => (
          <div key={c.id} className="flex justify-between">
            <span>{c.name}</span>
            <span>{c.votes}</span>
          </div>
        ))}
      </section>

      <section className="bg-white p-4 rounded shadow">
        <h2 className="font-semibold mb-2">Egyéb statisztikák</h2>
        <p>Összes leadott szavazat: {stats.totalVotes}</p>
        <p>Aktív felhasználók száma: {stats.activeUsers}</p>
      </section>
    </div>
  )
}
