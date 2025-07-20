import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function StoryInsights({ show, bookId, meta: initialMeta, onClose }) {
  const [meta,setMeta]=useState(initialMeta)
  useEffect(()=>{ setMeta(initialMeta)},[initialMeta])
  useEffect(()=>{
    if(show && bookId){
      fetch(`${API_BASE}/api/books/${bookId}/meta`).then(r=>r.json()).then(setMeta).catch(()=>{})
    }
  },[show,bookId])
  if(!show) return null
  const { summary='', characters=[], key_events=[] } = meta || {}
  return (
    <div className="modal-overlay">
      <div className="modal custom-prompt-modal" style={{maxWidth:'600px', width:'90vw', maxHeight:'90vh', overflowY:'auto'}}>
        <div className="modal-header">
          <h3>Story Insights</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        <div className="modal-content">
          <h4>Summary</h4>
          <p style={{whiteSpace:'pre-line'}}>{summary}</p>
          <h4>Characters</h4>
          <ul>
            {characters.map((c,i)=>(<li key={i}><strong>{c.name}</strong>: {c.description}</li>))}
          </ul>
          <h4>Key Events</h4>
          <ul>
            {key_events.map((e,i)=>(<li key={i}>{e.event} (page {e.page_number})</li>))}
          </ul>
        </div>
      </div>
    </div>
  )
}
