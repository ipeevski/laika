import React from 'react'
import ReactMarkdown from 'react-markdown'
import Spinner from './Spinner'

export default function BookReader({
  currentBookTitle,
  currentBookId,
  pages,
  currentIndex,
  choices,
  loading,
  customChoice,
  showCustomInput,
  onModelSelector,
  onPageNavigation,
  onChoiceClick,
  onCustomChoiceChange,
  onCustomChoiceSubmit,
  onToggleCustomInput,
  onCustomChoiceCancel,
  onRegenerate,
  onStopGeneration
}) {
  const goPrev = () => onPageNavigation('prev')
  const goNext = () => onPageNavigation('next')

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
        </div>
      </div>

      {currentIndex >= 0 && pages[currentIndex] && (
        <div className="page">
          {pages[currentIndex].image && (
            <img src={pages[currentIndex].image} alt="illustration" />
          )}
          <ReactMarkdown
            components={{
              p: ({node, ...props}) => (
                <p style={{whiteSpace: 'pre-line'}} {...props} />
              )
            }}
          >
            {pages[currentIndex].text}
          </ReactMarkdown>
        </div>
      )}

      {loading && <Spinner />}

      <div className="nav-buttons">
        <button onClick={goPrev} disabled={currentIndex <= 0}>
          Prev
        </button>
        {currentIndex < pages.length - 1 && (
          <button onClick={goNext} disabled={currentIndex >= pages.length - 1}>
            Next
          </button>
        )}
        {onRegenerate && currentIndex >= pages.length - 1 && (
          <button onClick={onRegenerate} disabled={loading} title="Regenerate this page">
            ↻ Reload
          </button>
        )}
        {loading && onStopGeneration && (
          <button onClick={onStopGeneration} title="Stop generation">
            ⏹ Stop
          </button>
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
    </div>
  )
}
