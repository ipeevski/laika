import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

function Spinner() {
  return (
    <div className="spinner" role="status" aria-label="Loading">
      <div></div>
    </div>
  )
}

function BookManager({
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

function BookSelector({ books, onSelectBook, onBack, onCreateNew }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTags, setSelectedTags] = useState([])

  // Extract unique tags from books (for future implementation)
  const allTags = []
  books.forEach(book => {
    if (book.tags) {
      book.tags.forEach(tag => {
        if (!allTags.includes(tag)) {
          allTags.push(tag)
        }
      })
    }
  })

  // Filter books based on search term and tags
  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTags = selectedTags.length === 0 ||
      (book.tags && selectedTags.some(tag => book.tags.includes(tag)))
    return matchesSearch && matchesTags
  })

  return (
    <div className="book-selector-screen">
      <div className="book-selector-header">
        <button onClick={onBack} className="back-button">
          ← Back
        </button>
        <h2>Select a Book to Continue</h2>
        <button onClick={onCreateNew} className="new-book-button-header">
          + New Book
        </button>
      </div>

      <div className="search-section">
        <div className="search-input-container">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search books by title..."
            className="search-input"
            autoFocus
          />
          <span className="search-icon">🔍</span>
        </div>

        {allTags.length > 0 && (
          <div className="tags-section">
            <h4>Filter by tags:</h4>
            <div className="tags-list">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTags(prev =>
                      prev.includes(tag)
                        ? prev.filter(t => t !== tag)
                        : [...prev, tag]
                    )
                  }}
                  className={`tag-button ${selectedTags.includes(tag) ? 'active' : ''}`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="books-grid">
        {filteredBooks.length > 0 ? (
          filteredBooks.map(book => (
            <div
              key={book.id}
              className="book-card"
              onClick={() => onSelectBook(book.id)}
            >
              <div className="book-card-header">
                <h3 className="book-card-title">{book.title}</h3>
                <div className="book-card-pages">{book.num_pages} pages</div>
              </div>
              <div className="book-card-info">
                <div className="book-card-date">
                  Updated {new Date(book.updated_at).toLocaleDateString()}
                </div>
                {book.tags && book.tags.length > 0 && (
                  <div className="book-card-tags">
                    {book.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="book-tag">{tag}</span>
                    ))}
                    {book.tags.length > 3 && (
                      <span className="book-tag-more">+{book.tags.length - 3}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="no-books-found">
            <p>No books found matching your search.</p>
            <button onClick={onCreateNew} className="create-new-button">
              Create a new book instead
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function WelcomeScreen({ onStartNew, onContinueExisting, books, loading, onLoadBook }) {
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
              {books.slice(0, 3).map(book => (
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

export default function App() {
  const [pages, setPages] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [choices, setChoices] = useState([])
  const [loading, setLoading] = useState(false)
  const [customChoice, setCustomChoice] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [books, setBooks] = useState([])
  const [currentBookId, setCurrentBookId] = useState(null)
  const [currentBookTitle, setCurrentBookTitle] = useState('')
  const [showCreateBook, setShowCreateBook] = useState(false)
  const [newBookTitle, setNewBookTitle] = useState('')
  const [newBookIdea, setNewBookIdea] = useState('')
  const [showWelcome, setShowWelcome] = useState(true)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showEditTitle, setShowEditTitle] = useState(false)
  const [editingTitle, setEditingTitle] = useState('')
  const [showBookSelector, setShowBookSelector] = useState(false)

  async function loadBooks() {
    try {
      const res = await fetch(`${API_BASE}/api/books`)
      if (res.ok) {
        const booksData = await res.json()
        setBooks(booksData)
      }
    } catch (err) {
      console.error('Failed to load books:', err)
    } finally {
      setInitialLoading(false)
    }
  }

  async function createBook(title = null, idea = null) {
    try {
      const res = await fetch(`${API_BASE}/api/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, idea }),
      })
      if (res.ok) {
        const newBook = await res.json()
        setBooks(prev => [...prev, newBook])
        setCurrentBookId(newBook.id)
        setCurrentBookTitle(newBook.title)
        setShowCreateBook(false)
        setNewBookTitle('')
        setNewBookIdea('')
        setShowWelcome(false)
        setShowBookSelector(false)
        // Start the new book
        await sendChoice(null, newBook.id)
      }
    } catch (err) {
      console.error('Failed to create book:', err)
      alert('Error creating book')
    }
  }

  async function updateBookTitle(bookId, newTitle) {
    try {
      const res = await fetch(`${API_BASE}/api/books/${bookId}/title`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle }),
      })
      if (res.ok) {
        // Update local state
        setBooks(prev => prev.map(book =>
          book.id === bookId
            ? { ...book, title: newTitle }
            : book
        ))

        // Update current book title if it's the one being edited
        if (bookId === currentBookId) {
          setCurrentBookTitle(newTitle)
        }

        setShowEditTitle(false)
        setEditingTitle('')
      } else {
        throw new Error('Failed to update title')
      }
    } catch (err) {
      console.error('Failed to update book title:', err)
      alert('Error updating book title')
    }
  }

  function handleEditTitle() {
    setEditingTitle(currentBookTitle)
    setShowEditTitle(true)
  }

  async function loadBook(bookId) {
    try {
      console.log('Loading book:', bookId)

      const res = await fetch(`${API_BASE}/api/books/${bookId}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch book info: ${res.status}`)
      }

      const bookData = await res.json()
      console.log('Book data:', bookData)

      setCurrentBookId(bookId)
      setCurrentBookTitle(bookData.title)

      // Load pages for this book
      const pagesRes = await fetch(`${API_BASE}/api/books/${bookId}/pages`)
      let pagesData = { pages: [] }

      if (pagesRes.ok) {
        pagesData = await pagesRes.json()
        console.log('Pages data:', pagesData)
        setPages(pagesData.pages.map(page => ({ text: page, image: null })))
        setCurrentIndex(pagesData.pages.length - 1)
      } else {
        console.warn('Failed to load pages:', pagesRes.status)
      }

      // Load choices for this book
      if (pagesData.pages.length > 0) {
        // Load current choices for the book
        const choicesRes = await fetch(`${API_BASE}/api/books/${bookId}/choices`)
        if (choicesRes.ok) {
          const choicesData = await choicesRes.json()
          console.log('Choices data:', choicesData)
          setChoices(choicesData.choices)
        } else {
          console.warn('Failed to load choices:', choicesRes.status)
          setChoices([])
        }
      } else {
        // If no pages exist, start the book
        console.log('Starting new book')
        await sendChoice(null, bookId)
      }

      setShowBookSelector(false)
      setShowWelcome(false)
    } catch (err) {
      console.error('Failed to load book:', err)
      alert(`Error loading book: ${err.message}`)
    }
  }

  async function sendChoice(choice = null, bookId = null) {
    const targetBookId = bookId || currentBookId
    if (!targetBookId) {
      // Create a new book if none exists
      await createBook()
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: targetBookId, choice }),
      })
      if (!res.ok) {
        throw new Error('Request failed')
      }
      const data = await res.json()
      setPages(prev => {
        const newPages = [...prev, { text: data.page, image: data.image_url }]
        setCurrentIndex(newPages.length - 1)
        return newPages
      })
      setChoices(data.choices)
      setCustomChoice('')
      setShowCustomInput(false)

      // Update the book's page count in the local state
      setBooks(prev => prev.map(book =>
        book.id === targetBookId
          ? { ...book, num_pages: book.num_pages + 1 }
          : book
      ))
    } catch (err) {
      console.error(err)
      alert('Error generating page')
    } finally {
      setLoading(false)
    }
  }

  function handleChoiceClick(choice) {
    if (showCustomInput) {
      // If custom input is open, populate it with the choice text
      setCustomChoice(choice)
    } else {
      // Otherwise, submit the choice directly
      sendChoice(choice)
    }
  }

  function handleCustomChoiceSubmit() {
    if (customChoice.trim()) {
      sendChoice(customChoice.trim())
    }
  }

  function handleStartNew() {
    setShowCreateBook(true)
  }

  function handleContinueExisting() {
    setShowBookSelector(true)
    setShowWelcome(false)
  }

  function handleBackToWelcome() {
    setShowBookSelector(false)
    setShowWelcome(true)
  }

  useEffect(() => {
    loadBooks()
  }, [])

  // Show welcome screen until user makes a choice
  if (showWelcome) {
    return (
      <>
        <WelcomeScreen
          onStartNew={handleStartNew}
          onContinueExisting={handleContinueExisting}
          books={books}
          loading={initialLoading}
          onLoadBook={loadBook}
        />
        <BookManager
          showCreateBook={showCreateBook}
          setShowCreateBook={setShowCreateBook}
          newBookTitle={newBookTitle}
          setNewBookTitle={setNewBookTitle}
          newBookIdea={newBookIdea}
          setNewBookIdea={setNewBookIdea}
          onCreateBook={createBook}
        />
      </>
    )
  }

  // Show book selector when user chooses to continue existing
  if (showBookSelector) {
    return (
      <>
        <BookSelector
          books={books}
          onSelectBook={loadBook}
          onBack={handleBackToWelcome}
          onCreateNew={handleStartNew}
        />
        <BookManager
          showCreateBook={showCreateBook}
          setShowCreateBook={setShowCreateBook}
          newBookTitle={newBookTitle}
          setNewBookTitle={setNewBookTitle}
          newBookIdea={newBookIdea}
          setNewBookIdea={setNewBookIdea}
          onCreateBook={createBook}
        />
      </>
    )
  }

  function goPrev() {
    setCurrentIndex(i => (i > 0 ? i - 1 : i))
  }

  function goNext() {
    setCurrentIndex(i => (i < pages.length - 1 ? i + 1 : i))
  }

  return (
    <>
      <div className="layout">
        <aside className="sidebar">
          <div className="book-selector">
            <button
              onClick={() => setShowBookSelector(!showBookSelector)}
              className="book-selector-button"
            >
              📚 {currentBookTitle || 'Select Book'}
            </button>

            {showBookSelector && (
              <div className="book-list">
                {books.map(book => (
                  <div
                    key={book.id}
                    className={`book-item ${book.id === currentBookId ? 'active' : ''}`}
                    onClick={() => loadBook(book.id)}
                  >
                    <div className="book-title">{book.title}</div>
                    <div className="book-info">{book.num_pages} pages</div>
                  </div>
                ))}
                <button
                  onClick={handleStartNew}
                  className="create-book-button"
                >
                  + New Book
                </button>
              </div>
            )}
          </div>

          <ul className="page-list">
            {pages.map((_, idx) => (
              <li
                key={idx}
                className={idx === currentIndex ? 'active' : ''}
                onClick={() => setCurrentIndex(idx)}
              >
                Page {idx + 1}
              </li>
            ))}
          </ul>
        </aside>

        <div className="container">
          <div className="title-container">
            <h1 className="title">{currentBookTitle || 'Book'}</h1>
            {currentBookId && (
              <button
                onClick={handleEditTitle}
                className="edit-title-button"
                title="Edit book title"
              >
                ✏️
              </button>
            )}
          </div>

          {currentIndex >= 0 && pages[currentIndex] && (
            <div className="page">
              {pages[currentIndex].image && (
                <img src={pages[currentIndex].image} alt="illustration" />
              )}
              <p>{pages[currentIndex].text}</p>
            </div>
          )}

          {loading && <Spinner />}

          <div className="nav-buttons">
            <button onClick={goPrev} disabled={currentIndex <= 0}>
              Prev
            </button>
            <button onClick={goNext} disabled={currentIndex >= pages.length - 1}>
              Next
            </button>
          </div>

          <div className="choices">
            {choices.map((choice, index) => (
              <button
                key={index}
                disabled={loading}
                onClick={() => handleChoiceClick(choice)}
                className={`choice-button ${showCustomInput ? 'choice-button-custom-mode' : ''}`}
              >
                {choice}
              </button>
            ))}

            {showCustomInput ? (
              <div className="custom-choice">
                <input
                  type="text"
                  value={customChoice}
                  onChange={(e) => setCustomChoice(e.target.value)}
                  placeholder="Enter your own choice..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCustomChoiceSubmit()
                    }
                  }}
                  autoFocus
                />
                <button onClick={handleCustomChoiceSubmit} disabled={!customChoice.trim()}>
                  Submit
                </button>
                <button onClick={() => {
                  setShowCustomInput(false)
                  setCustomChoice('')
                }}>
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCustomInput(true)}
                className="add-custom-choice"
                disabled={loading}
              >
                + Add Custom Choice
              </button>
            )}
          </div>
        </div>
      </div>

      <BookManager
        showCreateBook={showCreateBook}
        setShowCreateBook={setShowCreateBook}
        newBookTitle={newBookTitle}
        setNewBookTitle={setNewBookTitle}
        newBookIdea={newBookIdea}
        setNewBookIdea={setNewBookIdea}
        onCreateBook={createBook}
      />

      {/* Edit Title Modal */}
      {showEditTitle && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit Book Title</h3>
            <input
              type="text"
              value={editingTitle}
              onChange={(e) => setEditingTitle(e.target.value)}
              placeholder="Enter new book title"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  updateBookTitle(currentBookId, editingTitle.trim())
                } else if (e.key === 'Escape') {
                  setShowEditTitle(false)
                  setEditingTitle('')
                }
              }}
              autoFocus
            />
            <div className="modal-buttons">
              <button onClick={() => updateBookTitle(currentBookId, editingTitle.trim())}>
                Save
              </button>
              <button onClick={() => {
                setShowEditTitle(false)
                setEditingTitle('')
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
