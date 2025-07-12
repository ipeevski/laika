import shutil
from pydantic import BaseModel
from typing import List
import json
from pathlib import Path

BOOKS_DIR = Path("books")
BOOKS_DIR.mkdir(exist_ok=True)

class BookInfo(BaseModel):
    id: str
    num_pages: int

class Book:
    def __init__(self, id: str):
        self.id = id
        self.pages = self.load_pages()
        self.num_pages = len(self.pages)

    def add_page(self, page: str):
        self.pages.append(page)
        self.num_pages += 1
        self.save_pages()

    def get_info(self) -> BookInfo:
        return BookInfo(id=self.id, num_pages=self.num_pages)

    def load_pages(self):
        pages_file = self.get_dir() / "pages.json"
        if pages_file.exists():
            try:
                return json.loads(pages_file.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                return []
        return []

    def save_pages(self):
        pages_file = self.get_dir() / "pages.json"
        pages_file.write_text(json.dumps(self.pages, ensure_ascii=False, indent=2), encoding="utf-8")

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

        return [BookInfo(id=bid, num_pages=len(Book(bid).load_pages())) for bid in books_ids]
