{/* 
import React, { useEffect, useState } from 'react'
import axios from 'axios'
import VoteBoard from './VoteBoard'
import { io } from 'socket.io-client'

export default function Dashboard({ token, me, onLogout }){
  const [classes, setClasses] = useState([])
  const [user, setUser] = useState(me)

  useEffect(()=>{
    // load classes
    axios.get('https://sg-vote-xxqh.onrender.com/api/classes').then(r => setClasses(r.data))
    const socket = io('https://sg-vote-xxqh.onrender.com');
    socket.on('standings', (payload)=> setClasses(payload))
    return ()=> socket.disconnect()
  }, [])

  useEffect(()=>{
    if (!user && token) axios.get('https://sg-vote-xxqh.onrender.com/api/me', { headers: { Authorization: 'Bearer ' + token } }).then(r=>setUser(r.data))
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <div>
          <h2 className="text-xl font-semibold">Ságvári Nap — Szavazás</h2>
          <div className="text-sm text-slate-500">Bejelentkezve: {user?.name} ({user?.class})</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm">Maradt: <strong>{5 - (user?.votes_used || 0)}</strong> szavazat</div>
          <button onClick={onLogout} className="text-sm px-3 py-1 border rounded">Kijelentkezés</button>
        </div>
      </header>

      <main className="p-6 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <VoteBoard classes={classes} token={token} user={user} onUserUpdate={setUser} />
        </section>
        <aside className="space-y-4">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">TOP 3</h3>
            <ol className="list-decimal pl-5">
              {classes.slice().sort((a,b)=>b.votes - a.votes).slice(0,3).map(c => (
                <li key={c.id} className="mb-1">{c.name} — {c.votes} szavazat</li>
              ))}
            </ol>
          </div>

          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">Állás</h3>
            {(Array.isArray(classes) ? classes : []).map(c=> (
              <div key={c.id} className="flex justify-between text-sm py-1">
                <div>{c.name}</div>
                <div>{c.votes}</div>
              </div>
            ))}
          </div>
        </aside>
      </main>
    </div>
  )
}
*/}

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { io } from 'socket.io-client'
import VoteBoard from './VoteBoard'

export default function Dashboard({ token, me, onLogout }){
  const [classes, setClasses] = useState([])
  const [user, setUser] = useState(me)

  useEffect(()=>{
    if (!token) return; // ha nincs token, ne próbálkozz

    // load classes
    axios.get('https://sg-vote-xxqh.onrender.com/api/classes', {
      headers: { Authorization: 'Bearer ' + token }
    })
    .then(r => setClasses(r.data))
    .catch(err => {
      console.error('Hiba a /api/classes lekérésnél:', err.response?.data || err);
    });

    // websocket
    const socket = io('https://sg-vote-xxqh.onrender.com', {
      auth: { token }
    });
    socket.on('standings', payload => setClasses(payload));

    return () => socket.disconnect();
  }, [token]);

  useEffect(()=>{
    if (!user && token) axios.get('https://sg-vote-xxqh.onrender.com/api/me', { headers: { Authorization: 'Bearer ' + token } }).then(r=>setUser(r.data))
  }, [token])

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between p-4 bg-white shadow">
        <div>
          <h2 className="text-xl font-semibold">Ságvári Nap — Szavazás</h2>
          <div className="text-sm text-slate-500">Bejelentkezve: {user?.name} ({user?.class})</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm">Maradt: <strong>{5 - (user?.votes_used || 0)}</strong> szavazat</div>
          <button onClick={onLogout} className="text-sm px-3 py-1 border rounded">Kijelentkezés</button>
        </div>
      </header>

      <main className="p-6 grid lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2">
          <VoteBoard classes={classes} token={token} user={user} onUserUpdate={setUser} />
        </section>
        <aside className="space-y-4">
          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">TOP 3</h3>
            <ol className="list-decimal pl-5">
              {Array.isArray(classes) && classes.length > 0 ? (
                classes
                  .slice()
                  .sort((a,b)=>b.votes - a.votes)
                  .slice(0,3)
                  .map(c => (
                    <li key={c.id} className="mb-1">{c.name} — {c.votes} szavazat</li>
                  ))
              ) : (
                <li className="text-slate-500">Nincs adat</li>
              )}
            </ol>
          </div>

          <div className="bg-white p-4 rounded shadow">
            <h3 className="font-semibold mb-2">Állás (valós idő)</h3>
            {Array.isArray(classes) ? (
              classes.map(c=> (
                <div key={c.id} className="flex justify-between text-sm py-1">
                  <div>{c.name}</div>
                  <div>{c.votes}</div>
                </div>
              ))
            ) : (
              <div className="text-slate-500">Nincs adat</div>
            )}
          </div>
        </aside>
      </main>
    </div>
  )
}

