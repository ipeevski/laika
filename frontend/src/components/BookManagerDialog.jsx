import React, { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function BookManagerDialog({
  book,
  showDialog,
  onClose,
  onBookUpdated,
  onBookDeleted
}) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [tags, setTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Load book data when dialog opens
  useEffect(() => {
    if (showDialog && book) {
      setTitle(book.title || '')
      setDescription(book.description || '')
      setCoverUrl(book.cover_url || '')
      setTags(book.tags || [])
      setShowDeleteConfirm(false) // Reset delete confirmation when dialog opens
    }
  }, [showDialog, book])

  const handleSave = async () => {
    if (!book) return

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/books/${book.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          cover_url: coverUrl.trim(),
          tags: tags
        }),
      })

      if (res.ok) {
        if (onBookUpdated) {
          onBookUpdated(book.id, {
            title: title.trim(),
            description: description.trim(),
            cover_url: coverUrl.trim(),
            tags: tags
          })
        }
        handleClose()
      } else {
        throw new Error('Failed to update book')
      }
    } catch (err) {
      console.error('Failed to update book:', err)
      alert('Error updating book')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!book) return

    setDeleting(true)
    try {
      const res = await fetch(`${API_BASE}/api/books/${book.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        if (onBookDeleted) {
          onBookDeleted(book.id)
        }
        handleClose()
      } else {
        throw new Error('Failed to delete book')
      }
    } catch (err) {
      console.error('Failed to delete book:', err)
      alert('Error deleting book')
    } finally {
      setDeleting(false)
    }
  }

  const addTag = () => {
    const trimmedTag = newTag.trim()
    if (trimmedTag && !tags.includes(trimmedTag)) {
      setTags([...tags, trimmedTag])
      setNewTag('')
    }
  }

  const removeTag = (tagToRemove) => {
    setTags(tags.filter(tag => tag !== tagToRemove))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag()
    }
  }

  const handleClose = () => {
    setShowDeleteConfirm(false)
    onClose()
  }

  if (!showDialog || !book) return null

  return (
    <div className="modal-overlay">
      <div className="modal book-manager-modal">
        <div className="modal-header">
          <h3>Manage Book</h3>
          <button onClick={handleClose} className="close-button">×</button>
        </div>

        <div className="modal-content">
          <div className="book-info-section">
            <div className="book-cover-section">
              <div className="book-cover">
                {coverUrl ? (
                  <img src={coverUrl} alt="Book cover" />
                ) : (
                  <div className="book-cover-placeholder">
                    📚
                  </div>
                )}
              </div>
              <input
                type="text"
                value={coverUrl}
                onChange={(e) => setCoverUrl(e.target.value)}
                placeholder="Cover image URL"
                className="cover-url-input"
              />
            </div>

            <div className="book-details">
              <div className="form-group">
                <label>Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Book title"
                  className="title-input"
                />
              </div>

              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Book description"
                  rows="4"
                  className="description-input"
                />
              </div>

              <div className="form-group">
                <label>Tags</label>
                <div className="tags-input-container">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add a tag..."
                    className="tag-input"
                  />
                  <button onClick={addTag} className="add-tag-button">
                    Add
                  </button>
                </div>
                <div className="tags-display">
                  {tags.map(tag => (
                    <span key={tag} className="tag-item">
                      {tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="remove-tag-button"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div className="book-stats">
                <div className="stat-item">
                  <span className="stat-label">Pages:</span>
                  <span className="stat-value">{book.num_pages}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Created:</span>
                  <span className="stat-value">
                    {new Date(book.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Updated:</span>
                  <span className="stat-value">
                    {new Date(book.updated_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="delete-button"
            disabled={loading}
            title="Delete Book"
          >
            🗑️
          </button>
          <div className="save-cancel-buttons">
            <button onClick={handleClose} disabled={loading}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={loading || !title.trim()}
              className="save-button"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="modal-overlay delete-confirm-overlay">
            <div className="modal delete-confirm-modal">
              <h3>Delete Book</h3>
              <p>
                Are you sure you want to delete "{book.title}"?
                This action cannot be undone.
              </p>
              <div className="modal-buttons">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="delete-confirm-button"
                >
                  {deleting ? 'Deleting...' : 'Delete'}
                </button>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
