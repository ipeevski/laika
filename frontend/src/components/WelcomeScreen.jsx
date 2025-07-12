import React from 'react'

export default function WelcomeScreen({ onStartNew, onContinueExisting, books, loading, onLoadBook }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h1>Welcome to Book Builder</h1>
        <p>Create your own choose-your-own-adventure stories with AI assistance.</p>

        <div className="welcome-choices">
          <button
            onClick={onStartNew}
            className="welcome-button new-book-button"
            disabled={loading}
          >
            <div className="button-icon">✨</div>
            <div className="button-content">
              <h3>Start New Book</h3>
              <p>Begin a fresh adventure with a new story</p>
            </div>
          </button>

          {books.length > 0 && (
            <button
              onClick={onContinueExisting}
              className="welcome-button continue-button"
              disabled={loading}
            >
              <div className="button-icon">📚</div>
              <div className="button-content">
                <h3>Continue Existing</h3>
                <p>Pick up where you left off with {books.length} book{books.length !== 1 ? 's' : ''}</p>
              </div>
            </button>
          )}
        </div>

        {books.length > 0 && (
          <div className="recent-books">
            <h3>Recent Books</h3>
            <div className="recent-books-list">
              {books.sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at)).slice(0, 3).map(book => (
                <div
                  key={book.id}
                  className="recent-book-item"
                  onClick={() => onLoadBook(book.id)}
                >
                  <div className="recent-book-title">{book.title}</div>
                  <div className="recent-book-info">
                    {book.num_pages} pages • Updated {new Date(book.updated_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
