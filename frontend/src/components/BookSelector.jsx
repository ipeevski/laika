import React, { useState } from 'react'

export default function BookSelector({ books, onSelectBook, onBack, onCreateNew }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTags, setSelectedTags] = useState([])
  const [sortField, setSortField] = useState('updated_at')
  const [sortDirection, setSortDirection] = useState('desc')

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

  // Sort books based on selected field and direction
  const sortBooks = (booksToSort) => {
    return [...booksToSort].sort((a, b) => {
      let aValue, bValue

      switch (sortField) {
        case 'title':
          aValue = a.title.toLowerCase()
          bValue = b.title.toLowerCase()
          break
        case 'num_pages':
          aValue = a.num_pages
          bValue = b.num_pages
          break
        case 'updated_at':
        case 'created_at':
          aValue = new Date(a[sortField])
          bValue = new Date(b[sortField])
          break
        default:
          aValue = a[sortField]
          bValue = b[sortField]
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : -1
      } else {
        return aValue < bValue ? 1 : -1
      }
    })
  }

  // Filter books based on search term and tags
  const filteredBooks = books.filter(book => {
    const matchesSearch = book.title.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTags = selectedTags.length === 0 ||
      (book.tags && selectedTags.some(tag => book.tags.includes(tag)))
    return matchesSearch && matchesTags
  })

  // Apply sorting to filtered books
  const sortedBooks = sortBooks(filteredBooks)

  const handleSortChange = (field) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Set new field with default direction
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIcon = (field) => {
    if (sortField !== field) return '↕️'
    return sortDirection === 'asc' ? '↑' : '↓'
  }

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

        <div className="sort-section">
          <h4>Sort by:</h4>
          <div className="sort-buttons">
            <button
              onClick={() => handleSortChange('title')}
              className={`sort-button ${sortField === 'title' ? 'active' : ''}`}
            >
              Title {getSortIcon('title')}
            </button>
            <button
              onClick={() => handleSortChange('num_pages')}
              className={`sort-button ${sortField === 'num_pages' ? 'active' : ''}`}
            >
              Pages {getSortIcon('num_pages')}
            </button>
            <button
              onClick={() => handleSortChange('updated_at')}
              className={`sort-button ${sortField === 'updated_at' ? 'active' : ''}`}
            >
              Updated {getSortIcon('updated_at')}
            </button>
            <button
              onClick={() => handleSortChange('created_at')}
              className={`sort-button ${sortField === 'created_at' ? 'active' : ''}`}
            >
              Created {getSortIcon('created_at')}
            </button>
          </div>
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
        {sortedBooks.length > 0 ? (
          sortedBooks.map(book => (
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
