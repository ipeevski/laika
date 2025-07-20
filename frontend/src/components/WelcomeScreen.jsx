import React from 'react'

export default function WelcomeScreen({ onStartNew, onContinueExisting, onContinueChat, onStartChat, books, loading, onLoadBook }) {
  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <h1>Feel inspired to create</h1>
        <p>Chat with a friend or create your own stories.</p>

        <div className="welcome-choices">


          {onContinueChat && (
            <button
              onClick={onContinueChat}
              className="welcome-button chat-button"
              disabled={loading}
            >
              <div className="button-icon">💬</div>
              <div className="button-content">
                <h3>Chat</h3>
                <p>Have a conversation</p>
              </div>
            </button>
          )}



          {books.length > 0 ? (
            <button
              onClick={onContinueExisting}
              className="welcome-button continue-button"
              disabled={loading}
            >
              <div className="button-icon">📚</div>
              <div className="button-content">
                <h3>Stories</h3>
                <p>Pick up where you left off with {books.length} book{books.length !== 1 ? 's' : ''}</p>
              </div>
            </button>
          ) : (
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
          )}
        </div>
      </div>
    </div>
  )
}
