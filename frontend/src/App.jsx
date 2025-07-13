import { useEffect, useState, useRef } from 'react'
import BookManager from './components/BookManager'
import BookSelector from './components/BookSelector'
import WelcomeScreen from './components/WelcomeScreen'
import BookSidebar from './components/BookSidebar'
import BookReader from './components/BookReader'
import BookManagerDialog from './components/BookManagerDialog'
import ModelSelector from './components/ModelSelector'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

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
  const [showBookSelector, setShowBookSelector] = useState(false)
  const [showManageBook, setShowManageBook] = useState(false)
  const [selectedBook, setSelectedBook] = useState(null)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [currentModelId, setCurrentModelId] = useState(null)
  const [lastChoiceUsed, setLastChoiceUsed] = useState(null)
  const streamRef = useRef(null)

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
        sendChoice(null, newBook.id)
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
      } else {
        throw new Error('Failed to update title')
      }
    } catch (err) {
      console.error('Failed to update book title:', err)
      alert('Error updating book title')
    }
  }

  function handleEditTitle() {
    setShowEditTitle(true)
  }

  async function handleManageBook() {
    if (!currentBookId) return

    try {
      const res = await fetch(`${API_BASE}/api/books/${currentBookId}`)
      if (res.ok) {
        const bookData = await res.json()
        setSelectedBook(bookData)
        setShowManageBook(true)
      } else {
        throw new Error('Failed to fetch book data')
      }
    } catch (err) {
      console.error('Failed to fetch book data:', err)
      alert('Error loading book data')
    }
  }

  function handleModelSelector() {
    setShowModelSelector(true)
  }

  function handleModelSelect(model) {
    setCurrentModelId(model.id)
    setShowModelSelector(false)
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
        sendChoice(null, bookId)
      }

      setShowBookSelector(false)
      setShowWelcome(false)
    } catch (err) {
      console.error('Failed to load book:', err)
      alert(`Error loading book: ${err.message}`)
    }
  }

  function sendChoice(choice = null, bookId = null, regenerate = false) {
    const targetBookId = bookId || currentBookId
    if (!targetBookId) {
      console.error('No active book to send choice')
      return
    }

    setLoading(true)

    // Build stream URL with query params
    const params = new URLSearchParams()
    params.append('book_id', targetBookId)
    if (choice) params.append('choice', choice)
    if (currentModelId) params.append('model_id', currentModelId)
    if (regenerate) params.append('regenerate', '1')

    const streamUrl = `${API_BASE}/api/chat/stream?${params.toString()}`

    let pageText = ''
    let pageInitialised = regenerate ? true : false

    // Close any existing stream before starting new one
    if (streamRef.current) {
      streamRef.current.close()
    }

    const evtSource = new EventSource(streamUrl)
    streamRef.current = evtSource

    // Remember the choice that led to this generation for potential regeneration
    setLastChoiceUsed(choice)

    evtSource.onmessage = (e) => {
      // Accumulate the streamed token
      pageText += e.data

      setPages(prev => {
        const newPages = [...prev]

        if (!pageInitialised) {
          // For new generation append new page
          newPages.push({ text: pageText, image: null })
          pageInitialised = true
        } else {
          // Replace last page text
          newPages[newPages.length - 1].text = pageText
        }

        setCurrentIndex(newPages.length - 1)
        return newPages
      })
    }

    evtSource.addEventListener('choices', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.choices) {
          setChoices(data.choices)
        }

        // Update book list page count if it's a new page
        if (!regenerate) {
          setBooks(prev => prev.map(book =>
            book.id === targetBookId
              ? { ...book, num_pages: (book.num_pages || 0) + 1 }
              : book
          ))
        }
      } catch(err) {
        console.error('Failed to parse choices event', err)
      } finally {
        setLoading(false)
        evtSource.close()
        streamRef.current = null
        setCustomChoice('')
        setShowCustomInput(false)
      }
    })

    evtSource.addEventListener('error', (e) => {
      console.error('Streaming error', e)
      setLoading(false)
      evtSource.close()
      streamRef.current = null
      alert('Error generating page')
    })
  }

  function handleRegenerate() {
    if (loading) return
    // Use the last choice (may be null for the first page)
    sendChoice(lastChoiceUsed, null, true)
  }

  function handleStopGeneration() {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
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

    function handleBookDeleted(bookId) {
    // Remove the deleted book from the local state and capture new list
    setBooks(prev => {
      const updated = prev.filter(book => book.id !== bookId)

      // If the deleted book was the current book, reset reading state
      if (currentBookId === bookId) {
        setCurrentBookId(null)
        setCurrentBookTitle('')
        setPages([])
        setCurrentIndex(-1)
        setChoices([])

        // Navigate: if there are remaining books, show selector; else welcome
        if (updated.length > 0) {
          setShowBookSelector(true)
          setShowWelcome(false)
        } else {
          setShowWelcome(true)
          setShowBookSelector(false)
        }
      }

      return updated
    })
  }

  function handleBookUpdated(bookId, updatedData) {
    // Update the book in the local state
    setBooks(prev => prev.map(book =>
      book.id === bookId
        ? { ...book, ...updatedData }
        : book
    ))

    // If the updated book was the current book, update the current book title
    if (currentBookId === bookId && updatedData.title) {
      setCurrentBookTitle(updatedData.title)
    }
  }

  function handlePageNavigation(direction) {
    if (direction === 'prev') {
      setCurrentIndex(i => (i > 0 ? i - 1 : i))
    } else if (direction === 'next') {
      setCurrentIndex(i => (i < pages.length - 1 ? i + 1 : i))
    }
  }

  function handlePageSelect(index) {
    setCurrentIndex(index)
  }

  function handleCustomChoiceChange(e) {
    setCustomChoice(e.target.value)
  }

  function handleToggleCustomInput() {
    setShowCustomInput(true)
  }

  function handleCustomChoiceCancel() {
    setShowCustomInput(false)
    setCustomChoice('')
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
          onBookDeleted={handleBookDeleted}
          onBookUpdated={handleBookUpdated}
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

  return (
    <>
      <div className="layout">
        <BookSidebar
          pages={pages}
          currentIndex={currentIndex}
          onSwitchBook={() => setShowBookSelector(true)}
          onPageSelect={handlePageSelect}
          onManageBook={handleManageBook}
        />

        <BookReader
          currentBookTitle={currentBookTitle}
          currentBookId={currentBookId}
          pages={pages}
          currentIndex={currentIndex}
          choices={choices}
          loading={loading}
          customChoice={customChoice}
          showCustomInput={showCustomInput}
          onModelSelector={handleModelSelector}
          onPageNavigation={handlePageNavigation}
          onChoiceClick={handleChoiceClick}
          onRegenerate={handleRegenerate}
          onStopGeneration={handleStopGeneration}
          onCustomChoiceChange={handleCustomChoiceChange}
          onCustomChoiceSubmit={handleCustomChoiceSubmit}
          onToggleCustomInput={handleToggleCustomInput}
          onCustomChoiceCancel={handleCustomChoiceCancel}
        />
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

      <BookManagerDialog
        book={selectedBook}
        showDialog={showManageBook}
        onClose={() => {
          setShowManageBook(false)
          setSelectedBook(null)
        }}
        onBookDeleted={handleBookDeleted}
        onBookUpdated={handleBookUpdated}
      />

      <ModelSelector
        show={showModelSelector}
        selectedModelId={currentModelId}
        onModelSelect={handleModelSelect}
        onClose={() => setShowModelSelector(false)}
      />
    </>
  )
}
