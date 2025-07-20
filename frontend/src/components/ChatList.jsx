import React, { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function ChatList({ show, onSelect, onClose }) {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (show) loadChats()
  }, [show])

  async function loadChats() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/chats`)
      if (res.ok) {
        const data = await res.json()
        setChats(data)
      }
    } catch (err) {
      console.error('Failed to load chats', err)
      alert('Error loading chats')
    } finally {
      setLoading(false)
    }
  }

  if (!show) return null

  return (
    <div className="modal-overlay">
      <div className="modal model-selector-modal">
        <div className="modal-header">
          <h3>Your Chats</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-message">Loading chats...</div>
          ) : chats.length === 0 ? (
            <div className="no-models-message">No previous chats found.</div>
          ) : (
            <div className="models-list">
              {chats.map(chat => (
                <div key={chat.id} className="model-card" onClick={() => onSelect(chat)}>
                  <h4 className="model-name">{chat.persona_name}</h4>
                  <p className="model-description">{chat.last_message?.slice(0,60) || '—'}</p>
                  <div className="model-tags">
                    <span className="tag tag-blue">{new Date(chat.updated_at).toLocaleString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={()=>onSelect(null)} className="new-book-button-header">+ New Chat</button>
          <button onClick={onClose} className="cancel-button">Close</button>
        </div>
      </div>
    </div>
  )
}
