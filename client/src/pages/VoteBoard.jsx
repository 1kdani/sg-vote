import React, { useState } from 'react'
import axios from 'axios'

export default function VoteBoard({ classes = [], token, user, onUserUpdate }){
  const [busy, setBusy] = useState(false)
  const remaining = 5 - (user?.votes_used || 0)

  async function vote(classId, count=1){
    if (remaining <= 0) return alert('Nincs több szavazatod');
    if (!confirm(`Biztosan szeretnél ${count} szavazatot adni erre az osztályra?`)) return;
    setBusy(true)
    try{
      const res = await axios.post('https://sg-vote-xxqh.onrender.com/api/vote', { classId, count }, { headers: { Authorization: 'Bearer ' + token } });
      // server visszaadja a frissített user-t
      onUserUpdate(res.data.user)
    } catch (e){
      alert(e.response?.data?.error || 'Hiba a szavazás során')
    }
    setBusy(false)
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Osztályok — Válassz</h3>
      <div className="grid sm:grid-cols-2 gap-4">
        {classes.map(c => (
          <div key={c.id} className="bg-white p-4 rounded shadow">  
            <div className="flex justify-between">
              <div>
                <div className="font-medium">{c.name}</div>
                <div className="text-sm text-slate-500">Terem: {c.room || '—'} • Téma: {c.theme || '—'}</div>
              </div>
              <div className="text-2xl font-semibold">{c.votes}</div>
            </div>
            <div className="mt-3 flex gap-2">
              <button disabled={busy || remaining<=0 || (user && user.class === c.name)} onClick={()=>vote(c.id,1)} className="px-3 py-1 rounded border">+1</button>
              <button disabled={busy || remaining<=0 || (user && user.class === c.name)} onClick={()=>vote(c.id,Math.min(remaining,3))} className="px-3 py-1 rounded border">+{Math.min(remaining,3)}</button>
              <button disabled={busy || remaining<=0 || (user && user.class === c.name)} onClick={()=>vote(c.id,remaining)} className="px-3 py-1 rounded border">Mind ({remaining})</button>
            </div>
            {user && user.class === c.name && <div className="mt-2 text-xs text-red-600">Saját osztályra nem szavazhatsz</div>}
          </div>
        ))}
      </div>
    </div>
  )
}
