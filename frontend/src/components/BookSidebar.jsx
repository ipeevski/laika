import React from 'react'

export default function BookSidebar({
  currentBookTitle,
  pages,
  currentIndex,
  onSwitchBook,
  onPageSelect
}) {
  return (
    <aside className="sidebar">
      <div className="book-info">
        <button
          onClick={onSwitchBook}
          className="back-button"
          title="Switch Book"
        >
          ← Back
        </button>
      </div>
      <br/>

      <ul className="page-list">
        {pages.map((_, idx) => (
          <li
            key={idx}
            className={idx === currentIndex ? 'active' : ''}
            onClick={() => onPageSelect(idx)}
          >
            Page {idx + 1}
          </li>
        ))}
      </ul>
    </aside>
  )
}
