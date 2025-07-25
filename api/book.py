from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
from pathlib import Path
from datetime import datetime
import uuid
import re

BOOKS_DIR = Path("data/story/books")
BOOKS_DIR.mkdir(exist_ok=True)

class BookInfo(BaseModel):
    id: str
    title: str
    description: Optional[str] = None
    summary: str = ""
    characters: List[Dict[str, Any]] = []
    key_events: List[Dict[str, Any]] = []
    timeline: List[Dict[str, Any]] = []
    pages: List[Dict[str, Any]] = []
    num_pages: int = 0
    created_at: str
    updated_at: str
    cover_url: Optional[str] = None
    tags: List[str] = []
    settings: Dict[str, Any] = {}


class Book:
    def __init__(self, id: str):
        self.id = id
        self.file_path = self._find_file()
        self._load_data()

    def _find_file(self) -> Path:
        """Find the JSON file for this book by matching the book ID suffix"""
        book_dir = self.get_dir()
        if not book_dir.exists():
            return None

        expected_suffix = f"_{self.id}.json"
        for file in book_dir.glob("*_*.json"):
            if file.name.endswith(expected_suffix):
                return file
        # No matching file
        return None

    def _load_data(self):
        """Load the book data from file"""
        if not self.file_path or not self.file_path.exists():
            # Create new file if it doesn't exist
            self.book_info = self._init_book_info()
            return

        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Ensure the id is set correctly
                data['id'] = self.id
                self.book_info = BookInfo(**data)
        except (json.JSONDecodeError, FileNotFoundError):
            # If file is corrupted or doesn't exist, create new one
            self.book_info = self._init_book_info()

    def _save_data(self):
        """Save the data to file"""
        self.book_info.updated_at = datetime.now().isoformat()
        self.book_info.num_pages = len(self.book_info.pages)

        if not self.file_path:
            # Generate filename based on current title
            safe_title = self._sanitize_filename(self.book_info.title)
            filename = f"{safe_title}_{self.id}.json"
            self.file_path = self.get_dir() / filename

        # Ensure directory exists
        self.file_path.parent.mkdir(parents=True, exist_ok=True)

        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump(self.book_info.model_dump(), f, ensure_ascii=False, indent=2)

    def _sanitize_filename(self, title: str) -> str:
        """Convert book title to a safe filename"""
        # Remove or replace invalid characters
        safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)
        # Limit length and trim whitespace
        safe_title = safe_title.strip()[:50]
        return safe_title

    def _init_book_info(self) -> BookInfo:
        now = datetime.now().isoformat()
        return BookInfo(
            id=self.id,
            title=f"Untitled Book ({self.id[:8]})",
            created_at=now,
            updated_at=now
        )

    def add_page(self, page: str, choices: List[str] = None, prompt: str = None, choice_used: str = None):
        page_data = {
            "text": page,
            "choices": choices or [],
            "prompt": prompt or "",
            "choice_used": choice_used or ""
        }
        self.book_info.pages.append(page_data)
        self.book_info.num_pages = len(self.book_info.pages)
        self._save_data()

    def get_info(self) -> BookInfo:
        return self.book_info

    def set_title(self, title: str):
        old_title = self.book_info.title
        self.book_info.title = title

        # Check if we need to rename the file
        if old_title != title:
            self._rename_file_if_needed()

        self._save_data()

    def _rename_file_if_needed(self):
        """Rename the file if the title has changed"""
        if not self.file_path:
            return

        old_path = self.file_path
        safe_title = self._sanitize_filename(self.book_info.title)
        new_filename = f"{safe_title}_{self.id}.json"
        new_path = self.get_dir() / new_filename

        if old_path != new_path:
            try:
                # Rename the file
                old_path.rename(new_path)
                self.file_path = new_path
            except Exception as e:
                print(f"Warning: Could not rename file from {old_path} to {new_path}: {e}")

    def set_description(self, description: str):
        self.book_info.description = description
        self._save_data()

    def set_cover_url(self, cover_url: str):
        self.book_info.cover_url = cover_url
        self._save_data()

    def set_tags(self, tags: List[str]):
        self.book_info.tags = tags
        self._save_data()

    def add_character(self, name: str, description: str, role: str = "character"):
        character = {
            "name": name,
            "description": description,
            "role": role,
            "first_appearance": self.book_info.num_pages,
            "added_at": datetime.now().isoformat()
        }
        self.book_info.characters.append(character)
        self._save_data()

    def add_key_event(self, event: str, page_number: int, category: str = "plot"):
        key_event = {
            "event": event,
            "page_number": page_number,
            "category": category,
            "added_at": datetime.now().isoformat()
        }
        self.book_info.key_events.append(key_event)
        self._save_data()

    def add_timeline_entry(self, entry: str, page_number: int, time_reference: str = ""):
        timeline_entry = {
            "entry": entry,
            "page_number": page_number,
            "time_reference": time_reference,
            "added_at": datetime.now().isoformat()
        }
        self.book_info.timeline.append(timeline_entry)
        self._save_data()

    def update_setting(self, key: str, value: Any):
        self.book_info.settings[key] = value
        self._save_data()

    def get_page_texts(self) -> List[str]:
        """Get just the text content of all pages (for backward compatibility)"""
        return [page["text"] if isinstance(page, dict) else page for page in self.book_info.pages]

    def get_page_prompts(self) -> List[str]:
        """Get the prompts used for all pages"""
        return [page.get("prompt", "") if isinstance(page, dict) else "" for page in self.book_info.pages]

    def get_page_prompt(self, page_index: int) -> str:
        """Get the prompt used for a specific page"""
        if 0 <= page_index < len(self.book_info.pages):
            page = self.book_info.pages[page_index]
            if isinstance(page, dict):
                return page.get("prompt", "")
        return ""

    def get_page_choice_used(self, page_index: int) -> str:
        """Get the choice that was used to generate a specific page"""
        if 0 <= page_index < len(self.book_info.pages):
            page = self.book_info.pages[page_index]
            if isinstance(page, dict):
                return page.get("choice_used", "")
        return ""

    def get_current_choices(self) -> List[str]:
        """Get the choices for the current page (last page)"""
        if self.book_info.pages:
            last_page = self.book_info.pages[-1]
            if isinstance(last_page, dict):
                return last_page.get("choices", [])
        return []

    def get_summary(self) -> str:
        return self.book_info.summary

    def update_page_text(self, index: int, new_text: str):
        """Replace a page's text and refresh summary placeholders."""
        if index < 0 or index >= len(self.book_info.pages):
            raise IndexError("Page index out of range")
        page_entry = self.book_info.pages[index]
        if isinstance(page_entry, dict):
            page_entry["text"] = new_text
        else:
            self.book_info.pages[index] = new_text
        self._save_data()

    def get_meta(self):
        return {
            "summary": self.book_info.summary,
            "characters": self.book_info.characters,
            "key_events": self.book_info.key_events,
        }

    def get_dir(self) -> Path:
        path = BOOKS_DIR
        path.mkdir(parents=True, exist_ok=True)
        return path

    def get_path(self) -> Path:
        return self.get_dir() / f"{self.book_info.title}_{self.id}.json"

    def delete(self) -> bool:
        if not self.get_dir().exists():
            raise FileNotFoundError(f"Book directory {self.get_dir()} not found")
        return self.get_path().unlink()

    def replace_last_page(self, page: str, choices: List[str] = None, prompt: str = None, choice_used: str = None):
        """Replace the most recent page with new content and choices."""
        if not self.book_info.pages:
            # If no pages exist yet, fallback to add
            return self.add_page(page, choices, prompt, choice_used)
        last_page = self.book_info.pages[-1]
        if isinstance(last_page, dict):
            last_page["text"] = page
            last_page["choices"] = choices or []
            if prompt is not None:
                last_page["prompt"] = prompt
            if choice_used is not None:
                last_page["choice_used"] = choice_used
        else:
            # legacy string format
            self.book_info.pages[-1] = page
        self._save_data()

class BookManager:
    def list_all() -> List[BookInfo]:
        # Look for JSON files directly in the books directory
        json_files = list(BOOKS_DIR.glob("*.json"))
        print(BOOKS_DIR.glob("*.json"))
        books = []

        for json_file in json_files:
            try:
                # Extract book ID from filename (format: title_id.json)
                filename = json_file.stem  # Remove .json extension
                if '_' in filename:
                    # Extract the ID part after the last underscore
                    book_id = filename.split('_')[-1]
                    book = Book(book_id)
                    books.append(book.get_info())
            except Exception as e:
                print(f"Warning: Could not load book from {json_file}: {e}")
                continue

        return books

    def create_book(title: str = None) -> Book:
        book_id = str(uuid.uuid4())
        book = Book(book_id)
        if title:
            book.set_title(title)
        return book
