import React, { useEffect, useState } from 'react'
import PersonaDialog from './PersonaDialog'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function PersonaSelector({ show, onSelect, onClose }) {
  const [personas, setPersonas] = useState([])
  const [loading, setLoading] = useState(false)
  const [showDialog, setShowDialog] = useState(false)
  const [editingPersona, setEditingPersona] = useState(null)

  useEffect(() => {
    if (show) loadPersonas()
  }, [show])

  async function loadPersonas() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/personas`)
      if (res.ok) {
        const data = await res.json()
        setPersonas(data)
      }
    } catch (err) {
      console.error('Failed to load personas', err)
      alert('Error loading personas')
    } finally {
      setLoading(false)
    }
  }

  async function handleDialogSave(pdata) {
    try {
      if (editingPersona) {
        // Update existing persona
        await fetch(`${API_BASE}/api/personas/${editingPersona.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pdata),
        })
      } else {
        // Create new persona
        const res = await fetch(`${API_BASE}/api/personas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pdata),
        })
        if (res.ok) {
          const newPersona = await res.json()
          // auto-select the new persona
          onSelect(newPersona)
          setShowDialog(false)
          return
        }
      }
      // Reload list and close dialog
      await loadPersonas()
      setShowDialog(false)
    } catch (err) {
      console.error('Save persona error', err)
      alert('Error saving persona')
    }
  }

  if (!show) return null

  return (
    <div className="modal-overlay">
      <div className="modal model-selector-modal">
        <div className="modal-header">
          <h3>Select Persona</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="modal-content">
          {loading ? (
            <div className="loading-message">Loading personas...</div>
          ) : personas.length === 0 ? (
            <div className="no-models-message">No personas available. Create one!</div>
          ) : (
            <div className="models-list">
              {personas.map(p => (
                <div key={p.id} className="model-card" onClick={() => onSelect(p)}>
                  <div className="model-header">
                    <h4 className="model-name">{p.name}</h4>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditingPersona(p)
                        setShowDialog(true)
                      }}
                      className="manage-book-button"
                      title="Edit Persona"
                    >✏️</button>
                  </div>
                  <p className="model-description">{p.description}</p>
                  <div className="model-tags">
                    {p.traits.slice(0, 5).map(t => (
                      <span key={t} className="tag tag-blue">{t}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={() => { setEditingPersona(null); setShowDialog(true) }} className="new-book-button-header">
            + New Persona
          </button>
          <button onClick={onClose} className="cancel-button">Cancel</button>
        </div>
      </div>

      <PersonaDialog
        show={showDialog}
        persona={editingPersona}
        onSave={handleDialogSave}
        onClose={() => setShowDialog(false)}
      />
    </div>
  )
}
