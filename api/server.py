from typing import List, Optional
import os
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agent import Agent
from .book import BookInfo, BookManager, Book, BookMetadata

from dotenv import load_dotenv

load_dotenv()


def call_llm(summary_text: str, choice: Optional[str], initial_idea: Optional[str] = None) -> dict:
    system_prompt = (
        "You are a creative writer helping the user craft a choose-your-own-adventure book. "
        "Respond strictly in valid JSON with the following keys: \n"
        "page: the next ~300-400 word page of the book.\n"
        "choices: an array of exactly 3 short distinct reader choices.\n"
        "summary_update: a concise bullet list of new characters or key events in this page.\n"
        "image_prompt: a vivid, concise description to illustrate the current page.\n"
        "IMPORTANT: within JSON string values, escape newlines as \\n instead of raw line breaks.\n"
        "Do NOT wrap the JSON in markdown code fences and do not add any additional keys."
    )
    agent = Agent(model=os.getenv("OLLAMA_MODEL", "ollama/mistral"), system_prompt=system_prompt, json_output=True)

    prompt = ""

    if summary_text.strip():
        prompt += f"Book summary so far:\n{summary_text.strip()}\n"

    if choice is None:
        if initial_idea:
            prompt += f"Let's begin the story based on this idea: {initial_idea}\n\nGenerate the first page."
        else:
            prompt += "Let's begin the story. Generate the first page."
    else:
        prompt += f"Continue the story following the reader's choice: '{choice}'."

    try:
        return agent.call(prompt)
    except Exception as exc:  # pylint: disable=broad-except
        print("[error] LLM call failed:", exc)
        raise HTTPException(status_code=500, detail="LLM generation failed") from exc


# ====== FastAPI setup ======

app = FastAPI(title="Book Builder")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    book_id: Optional[str] = None
    choice: Optional[str] = None


class ChatResponse(BaseModel):
    book_id: str
    page: str
    choices: List[str]


class CreateBookRequest(BaseModel):
    title: Optional[str] = None
    idea: Optional[str] = None


class UpdateTitleRequest(BaseModel):
    title: str

class UpdateBookRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    cover_url: Optional[str] = None
    tags: Optional[List[str]] = None


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    book_id = req.book_id or str(uuid.uuid4())
    book = Book(book_id)
    summary_text = book.get_summary()

    # Get initial idea if this is the first page (no summary yet)
    initial_idea = None
    if not summary_text.strip() and req.choice is None:
        initial_idea = book.metadata.settings.get("initial_idea")

    data = call_llm(summary_text, req.choice, initial_idea)

    page = data.get("page", "")
    choices = data.get("choices", [])[:3]

    book.add_page(page, choices)
    book.update_summary(page)

    return ChatResponse(book_id=book_id, page=page, choices=choices)


# ====== Book management endpoints ======
@app.get("/api/books", response_model=List[BookInfo])
async def list_books_endpoint():
    return BookManager.list_all()

@app.post("/api/books", response_model=BookInfo)
async def create_book_endpoint(req: CreateBookRequest):
    book = BookManager.create_book(req.title)
    if req.idea:
        book.update_setting("initial_idea", req.idea)
    return book.get_info()

@app.get("/api/books/{book_id}", response_model=BookInfo)
async def get_book_endpoint(book_id: str):
    try:
        book = Book(book_id)
        return book.get_info()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

@app.put("/api/books/{book_id}/title")
async def update_book_title_endpoint(book_id: str, req: UpdateTitleRequest):
    try:
        book = Book(book_id)
        book.set_title(req.title)
        return {"detail": "Title updated", "title": req.title}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

@app.put("/api/books/{book_id}")
async def update_book_endpoint(book_id: str, req: UpdateBookRequest):
    try:
        book = Book(book_id)

        if req.title is not None:
            book.set_title(req.title)
        if req.description is not None:
            book.set_description(req.description)
        if req.cover_url is not None:
            book.set_cover_url(req.cover_url)
        if req.tags is not None:
            book.set_tags(req.tags)

        return {"detail": "Book updated", "book": book.get_info()}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

@app.get("/api/books/{book_id}/metadata", response_model=BookMetadata)
async def get_book_metadata_endpoint(book_id: str):
    try:
        book = Book(book_id)
        return book.metadata
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

@app.get("/api/books/{book_id}/choices")
async def get_book_choices_endpoint(book_id: str):
    try:
        book = Book(book_id)
        return {"choices": book.get_current_choices()}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

@app.delete("/api/books/{book_id}")
async def delete_book_endpoint(book_id: str):
    try:
        Book(book_id).delete()
        return {"detail": "Book deleted"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

@app.get("/api/books/{book_id}/summary")
async def get_book_summary_endpoint(book_id: str):
    text = Book(book_id).get_summary()
    if not text:
        raise HTTPException(status_code=404, detail="Summary not found")
    return {"summary": text}

@app.get("/api/books/{book_id}/pages")
async def get_book_pages_endpoint(book_id: str):
    return {"pages": Book(book_id).get_page_texts()}
