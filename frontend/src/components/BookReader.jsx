import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import Spinner from './Spinner'
import ThinkingIndicator from './ThinkingIndicator'
import PageEditor from './PageEditor'
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function BookReader({
  currentBookTitle,
  currentBookId,
  currentModelId,
  pages,
  currentIndex,
  choices,
  prompts,
  showPrompts,
  loading,
  isThinking,
  customChoice,
  showCustomInput,
  showCustomPromptInput,
  customPrompt,
  onModelSelector,
  onPageNavigation,
  onChoiceClick,
  onCustomChoiceChange,
  onCustomChoiceSubmit,
  onToggleCustomInput,
  onCustomChoiceCancel,
  onRegenerate,
  onRegenerateWithPrompt,
  onStopGeneration,
  onTogglePrompts,
  onCustomPromptChange,
  onCustomPromptSubmit,
  onCustomPromptCancel,
  onOpenSettings,
  onOpenInsights = null,
  onPageUpdated,
}) {
  const goPrev = () => onPageNavigation('prev')
  const goNext = () => onPageNavigation('next')

  const [editing, setEditing] = useState(false)

  const handleSaveEdit = async (newText) => {
    try {
      const params = new URLSearchParams()
      if (currentModelId) params.append('model_id', currentModelId)

      const res = await fetch(`${API_BASE}/api/books/${currentBookId}/pages/${currentIndex}?${params.toString()}`, {
        method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({text:newText})
      })
      if(res.ok){
        const result = await res.json()
        console.log('Page updated with enhanced summary', result)
        pages[currentIndex].text = newText
        onPageUpdated && onPageUpdated(currentIndex, newText)
        setEditing(false)
      }
    }catch(err){console.error('save page',err)}
  }

  return (
    <div className="container">
      <div className="title-container">
        <h1 className="title">{currentBookTitle || 'Book'}</h1>
        <div className="title-actions">
          {onModelSelector && (
            <button
              onClick={onModelSelector}
              className="model-selector-button"
              title="Select AI Model"
            >
              🤖
            </button>
          )}
          <button onClick={onOpenSettings} className="model-selector-button" title="Settings">⚙️</button>
          {onOpenInsights && (<button onClick={onOpenInsights} className="model-selector-button" title="Story Insights">📖</button>)}
          <button
            onClick={onTogglePrompts}
            className="prompt-toggle-button"
            title="Toggle Prompt Display"
          >
            {showPrompts ? '🔍' : '👁️'}
          </button>
        </div>
      </div>

      {currentIndex >= 0 && pages[currentIndex] && (
        <div className="page">
          {pages[currentIndex].image && (
            <img src={pages[currentIndex].image} alt="illustration" />
          )}

          {showPrompts && prompts[currentIndex] && (
            <div className="prompt-display">
              <h4>Prompt:</h4>
              <pre>{prompts[currentIndex]}</pre>
            </div>
          )}

          <ReactMarkdown
            components={{
              p: ({node, ...props}) => (
                <p {...props} />
              )
            }}
          >
            {pages[currentIndex].text}
          </ReactMarkdown>
        </div>
      )}

      {loading && <Spinner />}
      {isThinking && <ThinkingIndicator isThinking={isThinking} />}

      <div className="nav-buttons">
        <button onClick={goPrev} disabled={currentIndex <= 0}>
          Prev
        </button>
        {currentIndex < pages.length - 1 && (
          <button onClick={goNext} disabled={currentIndex >= pages.length - 1}>
            Next
          </button>
        )}
        {currentIndex >= pages.length - 1 && (
          <>
            {onRegenerate && (
              <button onClick={onRegenerate} disabled={loading} title="Regenerate this page with original prompt">
                ↻ Reload
              </button>
            )}
            {onRegenerateWithPrompt && (
              <button
                onClick={() => {
                  // This will be handled by the parent component to show custom choice input
                  onRegenerateWithPrompt(null)
                }}
                disabled={loading}
                title="Regenerate this page with custom choice"
              >
                ✏️ Custom Choice
              </button>
            )}
          </>
        )}
        {loading && onStopGeneration && (
          <button onClick={onStopGeneration} title="Stop generation">
            ⏹ Stop
          </button>
        )}
        {currentIndex>=0 && (
          <button onClick={()=>setEditing(true)} title="Edit page">✏️ Edit</button>
        )}
      </div>

      {currentIndex === pages.length - 1 && (
        <div className="choices">
          {choices.map((choice, index) => (
            <button
              key={index}
              disabled={loading}
              onClick={() => onChoiceClick(choice)}
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
                onChange={onCustomChoiceChange}
                placeholder="Enter your own choice..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onCustomChoiceSubmit()
                  }
                }}
                autoFocus
              />
              <button onClick={onCustomChoiceSubmit} disabled={!customChoice.trim()}>
                Submit
              </button>
              <button onClick={onCustomChoiceCancel}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={onToggleCustomInput}
              className="add-custom-choice"
              disabled={loading}
            >
              + Add Custom Choice
            </button>
          )}
        </div>
      )}

            {showCustomPromptInput && (
        <div className="modal-overlay">
          <div className="modal custom-prompt-modal">
            <div className="modal-header">
              <h3>Custom Choice for Regeneration</h3>
              <button onClick={onCustomPromptCancel} className="close-button">×</button>
            </div>
            <div className="modal-content">
              <p className="custom-prompt-help">The last choice used is preloaded below. You can modify it to change how the page is regenerated.</p>
              <input
                type="text"
                value={customPrompt}
                onChange={onCustomPromptChange}
                placeholder="Enter a custom choice for regeneration..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onCustomPromptSubmit()
                  }
                }}
                autoFocus
              />
            </div>
            <div className="modal-footer">
              <button onClick={onCustomPromptCancel}>
                Cancel
              </button>
              <button
                onClick={onCustomPromptSubmit}
                disabled={!customPrompt.trim()}
                className="save-button"
              >
                Regenerate with Custom Choice
              </button>
            </div>
          </div>
        </div>
      )}
      <PageEditor show={editing} pageText={pages[currentIndex]?.text} onSave={handleSaveEdit} onClose={()=>setEditing(false)} />
    </div>
  )
}
