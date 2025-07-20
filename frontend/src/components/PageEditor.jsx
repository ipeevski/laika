import React, { useState, useEffect } from 'react'

export default function PageEditor({ show, pageText, onSave, onClose }) {
  const [text, setText] = useState('')

  useEffect(()=>{ if(show) setText(pageText||'') }, [show, pageText])

  if(!show) return null

  return (
    <div className="modal-overlay">
      <div className="modal custom-prompt-modal" style={{maxWidth:'800px', width:'90vw', maxHeight:'90vh', overflowY:'auto'}}>
        <div className="modal-header">
          <h3>Edit Page Markdown</h3>
          <button onClick={onClose} className="close-button">×</button>
        </div>
        <div className="modal-content">
          <textarea value={text} onChange={e=>setText(e.target.value)} rows="20" style={{width:'100%'}} />
        </div>
        <div className="modal-footer">
          <button onClick={onClose}>Cancel</button>
          <button onClick={()=>onSave(text)} className="save-button" disabled={!text.trim()}>Save</button>
        </div>
      </div>
    </div>
  )
}
