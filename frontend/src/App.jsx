import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

function Spinner() {
  return (
    <div className="spinner" role="status" aria-label="Loading">
      <div></div>
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

  async function sendChoice(choice = null) {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ choice }),
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

  useEffect(() => {
    sendChoice()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function goPrev() {
    setCurrentIndex(i => (i > 0 ? i - 1 : i))
  }

  function goNext() {
    setCurrentIndex(i => (i < pages.length - 1 ? i + 1 : i))
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <ul>
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
        <h1 className="title">Book</h1>

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
  )
}
