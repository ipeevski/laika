import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import PersonaDialog from './PersonaDialog'
import ThinkingIndicator from './ThinkingIndicator'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

/**
 * ChatInterface – prototype component for a persona-driven chat mode.
 *
 * UX goals:
 * 1. Display persona details (name/avatar) in the header with an Edit button.
 * 2. Scrollable message list. Messages are labeled by sender (User / Persona name).
 * 3. Textarea input with send button (Enter submits, Shift+Enter newline).
 * 4. Streaming AI responses supported but optional – placeholder fetch for now.
 * 5. Allow editing persona via PersonaDialog.
 */
function ChatInterfaceInner({ initialPersona = null, onExit, initialConversation=null, selectedModelId=null, onModelSelector, onOpenSettings }, ref) {
  const [persona, setPersona] = useState(initialPersona)
  const [messages, setMessages] = useState(initialConversation?.messages || [])
  const [conversationId, setConversationId] = useState(initialConversation?.id || null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPersonaDialog, setShowPersonaDialog] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const messagesEndRef = useRef(null)
  const streamRef = useRef(null)
  const [editingIndex, setEditingIndex] = useState(null)
  const [editText, setEditText] = useState('')

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  function closeStream() {
    if (streamRef.current) {
      streamRef.current.close()
      streamRef.current = null
    }
  }

  function startStreaming(userText) {
    const params = new URLSearchParams()
    params.append('persona_id', persona.id)
    params.append('message', userText)
    if (conversationId) params.append('conversation_id', conversationId)
    if (selectedModelId) params.append('model_id', selectedModelId)

    const url = `${API_BASE}/api/chat/stream?${params.toString()}`

    const evtSource = new EventSource(url)
    streamRef.current = evtSource

    // Ensure we have an AI message placeholder to accumulate tokens
    let aiIndex = null
    setMessages(prev => {
      const newMsgs = [...prev, { sender: 'ai', text: '' }]
      aiIndex = newMsgs.length - 1
      return newMsgs
    })

    evtSource.onmessage = (e) => {
      let token = ''
      try {
        token = JSON.parse(e.data)
      } catch {
        token = e.data
      }
      setMessages(prev => {
        const newMsgs = [...prev]
        newMsgs[aiIndex].text += token
        return newMsgs
      })
    }

    evtSource.addEventListener('thinking', (e) => {
      try {
        const data = JSON.parse(e.data)
        setIsThinking(data.thinking)
      } catch {}
    })

    evtSource.addEventListener('done', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (!conversationId) setConversationId(data.conversation_id)
      } catch {}
      setLoading(false)
      setIsThinking(false)
      closeStream()
    })

    evtSource.onerror = (e) => {
      console.error('Stream error', e)
      setLoading(false)
      setIsThinking(false)
      closeStream()
      alert('Error generating reply')
    }
  }

  function sendMessage() {
    const trimmed = input.trim()
    if (!trimmed || loading || !persona) return

    const userMsg = { sender: 'user', text: trimmed }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    closeStream()
    startStreaming(trimmed)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  function handlePersonaSave(updatedPersona) {
    setPersona(updatedPersona)
  }

  function beginEditAI(index) { setEditingIndex(index); setEditText(messages[index].text) }

  function cancelEdit() { setEditingIndex(null); setEditText('') }

  async function submitEditAI(index){
    const trimmed=editText.trim();if(!trimmed)return;setLoading(true);
    await fetch(`${API_BASE}/api/chat/${conversationId}/messages/${index}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:trimmed})});
    setMessages(prev=>{const copy=[...prev];copy[index].text=trimmed;return copy})
    cancelEdit();setLoading(false);
  }

  function regenerate(index) {
    closeStream()
    setLoading(true)
    const url = `${API_BASE}/api/chat/${conversationId}/messages/${index}/stream?regenerate=true`
    doPatchStream(index, url)
  }

  function doPatchStream(index, url) {
    // Trim messages locally
    setMessages(prev => prev.slice(0, index + 1))
    const evt = new EventSource(url)
    streamRef.current = evt
    let aiIndex = null
    setMessages(prev => {
      const newMsgs = [...prev, { sender: 'ai', text: '' }]
      aiIndex = newMsgs.length - 1
      return newMsgs
    })
    setEditingIndex(null)
    setIsThinking(false)

    evt.onmessage = (e) => {
      let token = ''
      try { token = JSON.parse(e.data) } catch { token = e.data }
      setMessages(prev => {
        const copy = [...prev]
        copy[aiIndex].text += token
        return copy
      })
    }
    evt.addEventListener('thinking', (e) => {
      try { const d = JSON.parse(e.data); setIsThinking(d.thinking) } catch {}
    })
    evt.addEventListener('done', () => { setLoading(false); closeStream() })
    evt.onerror = () => { setLoading(false); closeStream() }
  }

  useImperativeHandle(ref, ()=>({ openPersonaDialog: ()=>setShowPersonaDialog(true) }))

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="persona-info">
          <span className="persona-name">{persona?.name || 'Unnamed Persona'}</span>
          <button onClick={() => setShowPersonaDialog(true)} className="edit-persona-button">
            ✏️ Edit Persona
          </button>
          {onModelSelector && (
            <button onClick={onModelSelector} className="model-selector-button" title="Select AI Model">🤖</button>
          )}
          <button onClick={()=>onOpenSettings && onOpenSettings()} className="model-selector-button" title="Settings">⚙️</button>
        </div>
        <button onClick={onExit} className="exit-chat-button" title="Back to Home">🏠</button>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.map((msg, idx) => {
          const role = msg.sender==='user' ? 'user' : 'ai'
          return (
            <div key={idx} className={`chat-message ${role}`}>
              <div className="chat-bubble">
                {editingIndex===idx ? (
                  <>
                    <textarea value={editText} onChange={e=>setEditText(e.target.value)} rows="3" />
                    <div className="edit-actions">
                      <button onClick={()=>submitEditAI(idx)} disabled={!editText.trim()}>Save</button>
                      <button onClick={cancelEdit}>Cancel</button>
                    </div>
                  </>
                ) : (
                  msg.text || (role==='ai'&&idx===messages.length-1&&isThinking&&<ThinkingIndicator isThinking />)
                )}
              </div>
              {/* action buttons for last user message */}
              {role==='ai' && idx===messages.length-1 && !loading && !isThinking && (
                <div className="msg-actions">
                  <button onClick={()=>beginEditAI(idx)} className="icon-btn" title="Edit reply">✏️</button>
                  <button onClick={()=>regenerate(idx-1)} className="icon-btn" title="Regenerate reply">♻️</button>
                </div>
              )}
            </div>
          )
        })}
        {/* thinking indicator now embedded in bubble */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={loading}
        />
        <button onClick={sendMessage} disabled={loading || !input.trim()} className="send-button">➤</button>
      </div>

      <PersonaDialog
        show={showPersonaDialog}
        persona={persona}
        onSave={handlePersonaSave}
        onClose={() => setShowPersonaDialog(false)}
      />
    </div>
  )
}

export default forwardRef(ChatInterfaceInner);
