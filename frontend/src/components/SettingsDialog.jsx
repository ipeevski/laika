import React, { useEffect, useState } from 'react'
import ModelSelector from './ModelSelector'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function SettingsDialog({ show, mode, onClose, onOpenPersonaManager }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(false)
  const [showModelSelector, setShowModelSelector] = useState(false)

  useEffect(() => { if (show) loadPrompt() }, [show, mode])

  async function loadPrompt() {
    if (!mode) return
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/prompts/${mode}`)
      if (res.ok) {
        const data = await res.json()
        setPrompt(data.content)
      }
    } catch(err) { console.error('load prompt', err) }
    setLoading(false)
  }

  async function savePrompt() {
    setLoading(true)
    try {
      await fetch(`${API_BASE}/api/prompts/${mode}`, {
        method: 'PUT',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ content: prompt })
      })
      setEditing(false)
    } catch(err) { console.error('save prompt', err) }
    setLoading(false)
  }

  if (!show) return null

  return (
    <div className="modal-overlay">
      <div className="modal custom-prompt-modal" style={{maxWidth:'700px'}}>
        <div className="modal-header">
          <h3>{mode==='chat' ? 'Chat Settings' : 'Story Settings'}</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        <div className="modal-content">
          {loading ? 'Loading...' : (
            <>
              <label>System Prompt</label>
              <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} rows="10" style={{width:'100%'}} />
            </>
          )}
          <div style={{marginTop:'1rem'}}>
            <button onClick={()=>setShowModelSelector(true)} className="secondary-button">Select Model</button>
            {mode==='chat' && onOpenPersonaManager && (
              <button onClick={onOpenPersonaManager} className="secondary-button">Manage Personas</button>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>Close</button>
          <button onClick={savePrompt} disabled={loading} className="save-button">Save</button>
        </div>
      </div>
      <ModelSelector show={showModelSelector} selectedModelId={null} onModelSelect={()=>setShowModelSelector(false)} onClose={()=>setShowModelSelector(false)} />
    </div>
  )
}
