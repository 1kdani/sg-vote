import React, { useState } from 'react'
import axios from 'axios'

export default function Login({ onLogin }){
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')

  async function submit(e) {
    e.preventDefault();
    try {
      const res = await axios.post('https://sg-vote-xxqh.onrender.com/api/login', { name, password });
    
      // A backend már visszaadja a class nevét
      const userData = {
        name: res.data.name,
        class: res.data.class || 'Ismeretlen', // fallback, ha valamiért null
        votes_used: res.data.votes_used
      };
    
      // onLogin-nek átadjuk a teljes userData-t, amiben a class már benne van
      onLogin(res.data.token, userData);
    
    } catch (e) {
      setErr(e.response?.data?.error || 'Hiba');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-slate-100">
      <form onSubmit={submit} className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg">
        <h1 className="text-2xl font-semibold mb-4">Ságvári Nap — Bejelentkezés</h1>
        <p className="text-sm text-slate-500 mb-6">Add meg a neved és a kiosztott jelszót.</p>
        <label className="block mb-3"> <span className="text-sm">Név</span>
          <input value={name} onChange={e=>setName(e.target.value)} className="mt-1 block w-full rounded-md border p-2" placeholder="Pl.: Kubat Daniel" />
        </label>
        <label className="block mb-4"> <span className="text-sm">Jelszó</span>
          <input value={password} onChange={e=>setPassword(e.target.value)} type="password" className="mt-1 block w-full rounded-md border p-2" />
        </label>
        {err && <div className="text-red-600 mb-3">{err}</div>}
        <div className="flex items-center justify-between">
          <button className="px-4 py-2 bg-sky-600 text-white rounded-lg">Bejelentkezés</button>
        </div>
      </form>
    </div>
  )
}
