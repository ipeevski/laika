import shutil
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import json
from pathlib import Path
from datetime import datetime
import uuid

BOOKS_DIR = Path("books")
BOOKS_DIR.mkdir(exist_ok=True)

class BookInfo(BaseModel):
    id: str
    title: str
    num_pages: int
    created_at: str
    updated_at: str

class BookMetadata(BaseModel):
    title: str
    created_at: str
    updated_at: str
    characters: List[Dict[str, Any]]
    key_events: List[Dict[str, Any]]
    timeline: List[Dict[str, Any]]
    settings: Dict[str, Any]

class Book:
    def __init__(self, id: str):
        self.id = id
        self.pages = self.load_pages()
        self.num_pages = len(self.pages)
        self.metadata = self.load_metadata()

    def add_page(self, page: str, choices: List[str] = None):
        page_data = {
            "text": page,
            "choices": choices or []
        }
        self.pages.append(page_data)
        self.num_pages += 1
        self.save_pages()
        self.update_timestamp()

    def get_info(self) -> BookInfo:
        return BookInfo(
            id=self.id,
            title=self.metadata.title,
            num_pages=self.num_pages,
            created_at=self.metadata.created_at,
            updated_at=self.metadata.updated_at
        )

    def set_title(self, title: str):
        self.metadata.title = title
        self.save_metadata()
        self.update_timestamp()

    def add_character(self, name: str, description: str, role: str = "character"):
        character = {
            "name": name,
            "description": description,
            "role": role,
            "first_appearance": self.num_pages,
            "added_at": datetime.now().isoformat()
        }
        self.metadata.characters.append(character)
        self.save_metadata()

    def add_key_event(self, event: str, page_number: int, category: str = "plot"):
        key_event = {
            "event": event,
            "page_number": page_number,
            "category": category,
            "added_at": datetime.now().isoformat()
        }
        self.metadata.key_events.append(key_event)
        self.save_metadata()

    def add_timeline_entry(self, entry: str, page_number: int, time_reference: str = ""):
        timeline_entry = {
            "entry": entry,
            "page_number": page_number,
            "time_reference": time_reference,
            "added_at": datetime.now().isoformat()
        }
        self.metadata.timeline.append(timeline_entry)
        self.save_metadata()

    def update_setting(self, key: str, value: Any):
        self.metadata.settings[key] = value
        self.save_metadata()

    def load_pages(self):
        pages_file = self.get_dir() / "pages.json"
        if pages_file.exists():
            try:
                data = json.loads(pages_file.read_text(encoding="utf-8"))
                # Handle both old format (list of strings) and new format (list of objects)
                if data and isinstance(data[0], str):
                    # Convert old format to new format
                    return [{"text": page, "choices": []} for page in data]
                return data
            except json.JSONDecodeError:
                return []
        return []

    def save_pages(self):
        pages_file = self.get_dir() / "pages.json"
        pages_file.write_text(json.dumps(self.pages, ensure_ascii=False, indent=2), encoding="utf-8")

    def get_page_texts(self) -> List[str]:
        """Get just the text content of all pages (for backward compatibility)"""
        return [page["text"] if isinstance(page, dict) else page for page in self.pages]

    def get_current_choices(self) -> List[str]:
        """Get the choices for the current page (last page)"""
        if self.pages:
            last_page = self.pages[-1]
            if isinstance(last_page, dict):
                return last_page.get("choices", [])
        return []

    def load_metadata(self) -> BookMetadata:
        metadata_file = self.get_dir() / "metadata.json"
        if metadata_file.exists():
            try:
                data = json.loads(metadata_file.read_text(encoding="utf-8"))
                return BookMetadata(**data)
            except (json.JSONDecodeError, KeyError):
                pass

        # Create default metadata
        now = datetime.now().isoformat()
        return BookMetadata(
            title=f"Untitled Book ({self.id[:8]})",
            created_at=now,
            updated_at=now,
            characters=[],
            key_events=[],
            timeline=[],
            settings={}
        )

    def save_metadata(self):
        metadata_file = self.get_dir() / "metadata.json"
        metadata_file.write_text(
            json.dumps(self.metadata.dict(), ensure_ascii=False, indent=2),
            encoding="utf-8"
        )

    def update_timestamp(self):
        self.metadata.updated_at = datetime.now().isoformat()
        self.save_metadata()

    def get_summary(self) -> str:
        summary_file = self.get_dir() / "summary.md"
        if summary_file.exists():
            return summary_file.read_text(encoding="utf-8")
        return ""

    def update_summary(self, addition: str) -> None:
        summary_file = self.get_dir() / "summary.md"
        if summary_file.exists():
            summary_file.write_text(addition, encoding="utf-8")
        else:
            summary_file.write_text(addition, encoding="utf-8")

    def get_dir(self) -> Path:
        path = BOOKS_DIR / self.id
        path.mkdir(parents=True, exist_ok=True)
        return path

    def delete(self) -> bool:
        if not self.get_dir().exists():
            raise FileNotFoundError(f"Book directory {self.get_dir()} not found")
        return shutil.rmtree(self.get_dir())

class BookManager:
    def list_all() -> List[BookInfo]:
        books_ids = [p.name for p in BOOKS_DIR.iterdir() if p.is_dir()]

        return [Book(bid).get_info() for bid in books_ids]

    def create_book(title: str = None) -> Book:
        book_id = str(uuid.uuid4())
        book = Book(book_id)
        if title:
            book.set_title(title)
        return book
