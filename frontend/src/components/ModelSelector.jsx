import React, { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function ModelSelector({
  selectedModelId,
  onModelSelect,
  onClose,
  show = false
}) {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [filters, setFilters] = useState({
    contentLevel: '',
    tags: ''
  })
  const [filteredModels, setFilteredModels] = useState([])

  useEffect(() => {
    if (show) {
      loadModels()
    }
  }, [show])

  useEffect(() => {
    applyFilters()
  }, [models, filters])

  async function loadModels() {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/api/models`)
      if (res.ok) {
        const modelsData = await res.json()
        setModels(modelsData)
      } else {
        throw new Error('Failed to load models')
      }
    } catch (err) {
      console.error('Failed to load models:', err)
      alert('Error loading models')
    } finally {
      setLoading(false)
    }
  }

  async function refreshModels() {
    setRefreshing(true)
    try {
      const res = await fetch(`${API_BASE}/api/models/refresh`, {
        method: 'POST'
      })
      if (res.ok) {
        // Reload the models after refresh
        await loadModels()
      } else {
        throw new Error('Failed to refresh models')
      }
    } catch (err) {
      console.error('Failed to refresh models:', err)
      alert('Error refreshing models')
    } finally {
      setRefreshing(false)
    }
  }

    function applyFilters() {
    let filtered = [...models]

    if (filters.contentLevel) {
      filtered = filtered.filter(model => model.content_level === filters.contentLevel)
    }
    if (filters.tags) {
      const tagList = filters.tags.toLowerCase().split(',').map(tag => tag.trim())
      filtered = filtered.filter(model =>
        model.tags.some(tag => tagList.some(filterTag => tag.toLowerCase().includes(filterTag)))
      )
    }

    setFilteredModels(filtered)
  }

  function handleFilterChange(key, value) {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  function getContentLevelColor(level) {
    switch (level) {
      case 'safe': return 'content-level-safe'
      case 'mild': return 'content-level-mild'
      case 'mature': return 'content-level-mature'
      case 'explicit': return 'content-level-explicit'
      default: return 'content-level-default'
    }
  }



  if (!show) return null

  return (
    <div className="modal-overlay">
      <div className="modal model-selector-modal">
        <div className="modal-header">
          <h3>Select AI Model</h3>
          <div className="modal-header-actions">
            <button
              onClick={refreshModels}
              className="refresh-button"
              disabled={refreshing}
              title="Refresh models from config"
            >
              {refreshing ? '⟳' : '↻'}
            </button>
            <button onClick={onClose} className="close-button">×</button>
          </div>
        </div>

        <div className="modal-content">
          {/* Filters */}
          <div className="model-filters">
            <div className="filter-row">
              <div className="filter-group">
                <label>Content Level:</label>
                <select
                  value={filters.contentLevel}
                  onChange={(e) => handleFilterChange('contentLevel', e.target.value)}
                >
                  <option value="">All Levels</option>
                  <option value="safe">Safe</option>
                  <option value="mild">Mild</option>
                  <option value="mature">Mature</option>
                  <option value="explicit">Explicit</option>
                </select>
              </div>

              <div className="filter-group">
                <label>Tags:</label>
                <input
                  type="text"
                  value={filters.tags}
                  onChange={(e) => handleFilterChange('tags', e.target.value)}
                  placeholder="e.g., safe, creative, poetic"
                />
              </div>
            </div>


          </div>

          {/* Models List */}
          <div className="models-list">
            {loading ? (
              <div className="loading-message">Loading models...</div>
            ) : filteredModels.length === 0 ? (
              <div className="no-models-message">No models match your filters.</div>
            ) : (
              filteredModels.map(model => (
                <div
                  key={model.id}
                  className={`model-card ${selectedModelId === model.id ? 'selected' : ''}`}
                  onClick={() => onModelSelect(model)}
                >
                  <div className="model-header">
                    <h4 className="model-name">{model.name}</h4>
                    <div className="model-provider">{model.provider}</div>
                  </div>

                  <p className="model-description">{model.description}</p>

                  <div className="model-tags">
                    <span className={`tag ${getContentLevelColor(model.content_level)}`}>
                      {model.content_level}
                    </span>
                    {model.tags.slice(0, 3).map(tag => (
                      <span key={tag} className="tag tag-blue">
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="model-details">
                    <span className="detail">Temp: {model.temperature}</span>
                    {model.tags.slice(3, 6).map(tag => (
                      <span key={tag} className="detail-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="cancel-button">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
