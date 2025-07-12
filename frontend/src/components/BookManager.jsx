import React from 'react'

export default function BookManager({
  showCreateBook,
  setShowCreateBook,
  newBookTitle,
  setNewBookTitle,
  newBookIdea,
  setNewBookIdea,
  onCreateBook
}) {
  return (
    <>
      {/* Create Book Modal */}
      {showCreateBook && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Create New Book</h3>
            <input
              type="text"
              value={newBookTitle}
              onChange={(e) => setNewBookTitle(e.target.value)}
              placeholder="Enter book title (optional)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onCreateBook(newBookTitle || null, newBookIdea || null)
                } else if (e.key === 'Escape') {
                  setShowCreateBook(false)
                  setNewBookTitle('')
                  setNewBookIdea('')
                }
              }}
              autoFocus
            />
            <textarea
              value={newBookIdea}
              onChange={(e) => setNewBookIdea(e.target.value)}
              placeholder="Enter a brief description or idea for your book (optional)"
              rows="4"
              cols="50"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onCreateBook(newBookTitle || null, newBookIdea || null)
                } else if (e.key === 'Escape') {
                  setShowCreateBook(false)
                  setNewBookTitle('')
                  setNewBookIdea('')
                }
              }}
            />
            <div className="modal-buttons">
              <button onClick={() => onCreateBook(newBookTitle || null, newBookIdea || null)}>
                Create
              </button>
              <button onClick={() => {
                setShowCreateBook(false)
                setNewBookTitle('')
                setNewBookIdea('')
              }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
