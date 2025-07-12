import React from 'react'

export default function EditTitleModal({
  showEditTitle,
  editingTitle,
  onEditingTitleChange,
  onSave,
  onCancel
}) {
  if (!showEditTitle) return null

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Edit Book Title</h3>
        <input
          type="text"
          value={editingTitle}
          onChange={onEditingTitleChange}
          placeholder="Enter new book title"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSave()
            } else if (e.key === 'Escape') {
              onCancel()
            }
          }}
          autoFocus
        />
        <div className="modal-buttons">
          <button onClick={onSave}>
            Save
          </button>
          <button onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
