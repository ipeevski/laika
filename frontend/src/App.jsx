import { useEffect, useState, useRef } from 'react'
import BookManager from './components/BookManager'
import BookSelector from './components/BookSelector'
import WelcomeScreen from './components/WelcomeScreen'
import BookSidebar from './components/BookSidebar'
import BookReader from './components/BookReader'
import BookManagerDialog from './components/BookManagerDialog'
import ModelSelector from './components/ModelSelector'
import ChatInterface from './components/ChatInterface'
import PersonaSelector from './components/PersonaSelector'
import ChatList from './components/ChatList'
import SettingsDialog from './components/SettingsDialog'
import StoryInsights from './components/StoryInsights'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function App() {
  const [pages, setPages] = useState([])
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [choices, setChoices] = useState([])
  const [prompts, setPrompts] = useState([])
  const [loading, setLoading] = useState(false)
  const [customChoice, setCustomChoice] = useState('')
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [showPrompts, setShowPrompts] = useState(false)
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
  const [showCustomPromptInput, setShowCustomPromptInput] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const streamRef = useRef(null)
  const [chatMode, setChatMode] = useState(false)
  const [persona, setPersona] = useState(null)
  const [showPersonaSelector, setShowPersonaSelector] = useState(false)
  const [showChatList, setShowChatList] = useState(false)
  const [conversationData, setConversationData] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settingsMode, setSettingsMode] = useState('story')
  const chatRef = useRef(null)
  const [showInsights, setShowInsights] = useState(false)
  const [meta, setMeta] = useState(null)

  function openSettings(mode){ setSettingsMode(mode); setShowSettings(true) }

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
        // reset previous reading state
        setPages([])
        setCurrentIndex(-1)
        setChoices([])
        setPrompts([])
        setLastChoiceUsed(null)
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
      await fetchMeta(bookId)

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

      // Load prompts for this book
      const promptsRes = await fetch(`${API_BASE}/api/books/${bookId}/prompts`)
      if (promptsRes.ok) {
        const promptsData = await promptsRes.json()
        setPrompts(promptsData.prompts)
      } else {
        setPrompts([])
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

  async function sendChoice(choice = null, bookId = null, regenerate = false) {
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

    const streamUrl = `${API_BASE}/api/story/stream?${params.toString()}`

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
      // Tokens are JSON-encoded on the server so they can contain \n safely.
      // Decode here; fallback to raw string for backward-compatibility.
      let token = ''
      try {
        token = JSON.parse(e.data)
      } catch {
        token = e.data
      }

      // Accumulate the streamed token
      pageText += token

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

    evtSource.addEventListener('thinking', (e) => {
      try {
        const data = JSON.parse(e.data)
        setIsThinking(data.thinking)

        // Clear the page when thinking starts
        if (data.thinking) {
          setPages(prev => {
            const newPages = [...prev]
            if (newPages.length > 0) {
              // Clear the current page content
              newPages[newPages.length - 1].text = ''
            }
            return newPages
          })
        }
      } catch(err) {
        console.error('Failed to parse thinking event', err)
      }
    })

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

        // Commit the current page after streaming finishes
        if (!regenerate && data.choices && data.choices.length > 0) {
          const commitParams = new URLSearchParams()
          if (currentModelId) commitParams.append('model_id', currentModelId)

          fetch(`${API_BASE}/api/books/${targetBookId}/commit?${commitParams.toString()}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          })
            .then(async (res) => {
              if (res.ok) {
                const data = await res.json()
                console.log('Current page committed to summary', data)
                // Refresh meta data
                await fetchMeta(targetBookId)
              } else {
                console.error('Failed to commit current page')
              }
            })
            .catch(err => {
              console.error('Error committing current page:', err)
            })
        }

      } catch(err) {
        console.error('Failed to parse choices event', err)
      } finally {
        setLoading(false)
        setIsThinking(false)
        evtSource.close()
        streamRef.current = null
        setCustomChoice('')
        setShowCustomInput(false)
      }
    })

    evtSource.addEventListener('error', (e) => {
      console.error('Streaming error', e)
      setLoading(false)
      setIsThinking(false)
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

        async function handleRegenerateWithPrompt(customChoice = null) {
    if (loading) return

    // If no custom choice provided, show the input UI with last choice preloaded
    if (customChoice === null) {
      // Try to get the choice from the book data for the current page
      let defaultChoice = lastChoiceUsed || ''

      if (currentBookId && pages.length > 0) {
        try {
          const res = await fetch(`${API_BASE}/api/books/${currentBookId}/choice-used/${pages.length - 1}`)
          if (res.ok) {
            const data = await res.json()
            defaultChoice = data.choice_used || lastChoiceUsed || ''
          }
        } catch (err) {
          console.error('Failed to load choice used:', err)
          defaultChoice = lastChoiceUsed || ''
        }
      }

      console.log('Preloading custom choice with:', defaultChoice)
      setCustomPrompt(defaultChoice)
      setShowCustomPromptInput(true)
      return
    }

    // Use the custom choice (or last choice if empty) for regeneration
    const choiceToUse = customChoice.trim() || lastChoiceUsed
    if (choiceToUse) {
      sendChoice(choiceToUse, null, true)
    }
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

  function handleTogglePrompts() {
    setShowPrompts(!showPrompts)
  }

  function handleCustomPromptChange(e) {
    setCustomPrompt(e.target.value)
  }

  function handleCustomPromptSubmit() {
    handleRegenerateWithPrompt(customPrompt.trim())
    setShowCustomPromptInput(false)
    setCustomPrompt('')
  }

  function handleCustomPromptCancel() {
    setShowCustomPromptInput(false)
    setCustomPrompt('')
  }

  function handleStartChat() {
    setPersona(null)
    setConversationData(null)
    setShowPersonaSelector(true)
    setShowWelcome(false)
  }

  function handleContinueChat() { setShowChatList(true); setShowWelcome(false) }

  function handlePersonaSelected(p) {
    setPersona(p)
    setShowPersonaSelector(false)
    setChatMode(true)
  }

  function handlePageUpdated(idx, txt){
    setPages(prev=>{ const cp=[...prev]; cp[idx].text=txt; return cp })
    if(currentBookId) fetchMeta(currentBookId)
  }

  async function fetchMeta(bid){
    try{ const r=await fetch(`${API_BASE}/api/books/${bid}/meta`); if(r.ok){ setMeta(await r.json()) }}catch{}
  }

  useEffect(() => {
    loadBooks()
  }, [])

  // Show chat mode immediately
  if (chatMode) {
    return (
      <>
        <ChatInterface
          ref={chatRef}
          initialPersona={persona}
          initialConversation={conversationData}
          selectedModelId={currentModelId}
          onModelSelector={handleModelSelector}
          onExit={() => {
            setChatMode(false)
            setShowWelcome(true)
          }}
          onOpenSettings={()=>openSettings('chat')}
        />
        <SettingsDialog show={showSettings && settingsMode==='chat'} mode="chat" onClose={()=>setShowSettings(false)} onOpenPersonaManager={()=>{setShowSettings(false); chatRef.current?.openPersonaDialog();}} />
        <ModelSelector
          show={showModelSelector}
          selectedModelId={currentModelId}
          onModelSelect={handleModelSelect}
          onClose={() => setShowModelSelector(false)}
        />
        <PersonaSelector
          show={showPersonaSelector}
          onSelect={handlePersonaSelected}
          onClose={()=>setShowPersonaSelector(false)}
        />
      </>
    )
  }

  // Show welcome screen until user makes a choice
  if (showWelcome) {
    return (
      <>
        <WelcomeScreen
          onStartNew={handleStartNew}
          onContinueExisting={handleContinueExisting}
          onStartChat={handleStartChat}
          onContinueChat={handleContinueChat}
          books={books}
          loading={initialLoading}
          onLoadBook={loadBook}
          onOpenSettings={()=>openSettings('story')}
        />
        <SettingsDialog show={showSettings && settingsMode==='story'} mode="story" onClose={()=>setShowSettings(false)} />
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

  // Show persona selector if needed
  if (showPersonaSelector) {
    return (
      <PersonaSelector
        show={showPersonaSelector}
        onSelect={handlePersonaSelected}
        onClose={() => {
          setShowPersonaSelector(false)
          setShowWelcome(true)
        }}
      />
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

  // Show chat list if user chooses to continue existing chat
  if (showChatList) {
    return (
      <ChatList
        show={showChatList}
        onSelect={async (chatMeta) => {
          if(!chatMeta){
             setShowChatList(false);
             handleStartChat();
             return;
          }
          // fetch conversation
          try {
            const res = await fetch(`${API_BASE}/api/chat/${chatMeta.id}`)
            if (res.ok) {
              const data = await res.json()
              const personaRes = await fetch(`${API_BASE}/api/personas/${data.persona_id}`)
              const personaData = personaRes.ok ? await personaRes.json() : null
              setPersona(personaData)
              setChatMode(true)
              setShowChatList(false)
              setConversationData(data)
            }
          } catch(err) { console.error('load chat failed',err) }
        }}
        onClose={() => { setShowChatList(false); setShowWelcome(true) }}
      />
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
          currentModelId={currentModelId}
          pages={pages}
          currentIndex={currentIndex}
          choices={choices}
          prompts={prompts}
          showPrompts={showPrompts}
          loading={loading}
          isThinking={isThinking}
          customChoice={customChoice}
          showCustomInput={showCustomInput}
          showCustomPromptInput={showCustomPromptInput}
          customPrompt={customPrompt}
          onModelSelector={handleModelSelector}
          onPageNavigation={handlePageNavigation}
          onChoiceClick={handleChoiceClick}
          onRegenerate={handleRegenerate}
          onRegenerateWithPrompt={handleRegenerateWithPrompt}
          onStopGeneration={handleStopGeneration}
          onCustomChoiceChange={handleCustomChoiceChange}
          onCustomChoiceSubmit={handleCustomChoiceSubmit}
          onToggleCustomInput={handleToggleCustomInput}
          onCustomChoiceCancel={handleCustomChoiceCancel}
          onTogglePrompts={handleTogglePrompts}
          onCustomPromptChange={handleCustomPromptChange}
          onCustomPromptSubmit={handleCustomPromptSubmit}
          onCustomPromptCancel={handleCustomPromptCancel}
          onOpenSettings={()=>openSettings('story')}
          onPageUpdated={handlePageUpdated}
          onOpenInsights={()=>setShowInsights(true)}
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
      <SettingsDialog show={showSettings && settingsMode==='story'} mode="story" onClose={()=>setShowSettings(false)} />
      <StoryInsights show={showInsights} bookId={currentBookId} meta={meta} onClose={()=>setShowInsights(false)} />
    </>
  )
}
