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
          <div>
            <h4>Summary</h4>
            <p style={{whiteSpace:'pre-line'}}>{summary}</p>

            <h4>Characters ({characters.length})</h4>
            {characters.length > 0 ? (
              <ul>
                {characters.map((c,i)=>(
                  <li key={i}>
                    <strong>{c.name}</strong> ({c.role || 'character'})
                    <br />
                    <span style={{color: '#666', fontSize: '0.9em'}}>{c.description}</span>
                    {c.development && (
                      <>
                      <br />
                      <span style={{color: '#888', fontSize: '0.8em', fontStyle: 'italic'}}>
                        Development: {c.development}
                      </span>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{color: '#666', fontStyle: 'italic'}}>No characters identified yet.</p>
            )}

            <h4>Key Events ({key_events.length})</h4>
            {key_events.length > 0 ? (
              <ul>
                {key_events.map((e,i)=>(
                  <li key={i}>
                    <strong>{e.event}</strong>
                    <br />
                    <span style={{color: '#666', fontSize: '0.9em'}}>
                      Page {e.page_number} • {e.category || 'plot'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{color: '#666', fontStyle: 'italic'}}>No key events identified yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
