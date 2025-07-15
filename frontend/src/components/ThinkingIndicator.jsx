import React from 'react'

export default function ThinkingIndicator({ isThinking }) {
  if (!isThinking) return null

  return (
    <div className="thinking-indicator">
      <div className="thinking-dots">
        <span className="thinking-dot"></span>
        <span className="thinking-dot"></span>
        <span className="thinking-dot"></span>
      </div>
      <span className="thinking-text">Thinking...</span>
    </div>
  )
}
