import React, { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

/**
 * PersonaDialog – modal for creating/editing a chat persona.
 *
 * Fields:
 *  - name: display name of persona
 *  - description: persona backstory or system prompt
 *  - traits: comma-separated list of traits/tags
 *
 * The dialog also offers an "AI Enhance" button that sends current fields to the
 * backend which can suggest or fill in persona details. For the prototype it
 * calls a placeholder endpoint and merges the suggested data.
 */
export default function PersonaDialog({ show, persona, onSave, onClose }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [traits, setTraits] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (show) {
      setName(persona?.name || '')
      setDescription(persona?.description || '')
      setTraits((persona?.traits || []).join(', '))
    }
  }, [show, persona])

  async function enhancePersona() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/personas/enhance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, traits }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.name) setName(data.name)
        if (data.description) setDescription(data.description)
        if (data.traits) setTraits(data.traits.join(', '))
      } else {
        console.warn('Enhance persona endpoint not ready')
      }
    } catch (err) {
      console.error('Enhance persona error', err)
      alert('Error enhancing persona')
    } finally {
      setLoading(false)
    }
  }

  function handleSave() {
    const cleaned = {
      name: name.trim() || 'Unnamed',
      description: description.trim(),
      traits: traits.split(',').map(t => t.trim()).filter(Boolean),
    }
    onSave(cleaned)
  }

  if (!show) return null

  return (
    <div className="modal-overlay">
      <div className="modal persona-dialog-modal">
        <div className="modal-header">
          <h3>{persona ? 'Edit Persona' : 'New Persona'}</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>

        <div className="modal-content">
          <div className="form-group">
            <label>Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Persona name"
            />
          </div>

          <div className="form-group">
            <label>Description / Backstory</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the persona's background, motivation, etc."
              rows={4}
            />
          </div>

          <div className="form-group">
            <label>Traits (comma separated)</label>
            <input
              type="text"
              value={traits}
              onChange={e => setTraits(e.target.value)}
              placeholder="e.g., friendly, knowledgeable, humorous"
            />
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={enhancePersona} disabled={loading} className="secondary-button">
            {loading ? 'Enhancing...' : '✨ AI Enhance'}
          </button>
          <div className="save-cancel-buttons">
            <button onClick={onClose} disabled={loading}>Cancel</button>
            <button onClick={handleSave} disabled={loading} className="save-button">
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
