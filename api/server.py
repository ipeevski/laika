from typing import List, Optional
import os
import uuid

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from .agent import Agent
from .book import BookInfo, BookManager, Book

from dotenv import load_dotenv

load_dotenv()


def call_llm(summary_text: str, choice: Optional[str]) -> dict:
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


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    book_id = req.book_id or str(uuid.uuid4())
    book = Book(book_id)
    summary_text = book.get_summary()
    data = call_llm(summary_text, req.choice)

    page = data.get("page", "")
    choices = data.get("choices", [])[:3]

    book.add_page(page)
    book.update_summary(page)

    return ChatResponse(book_id=book_id, page=page, choices=choices)


# ====== Book management endpoints ======
@app.get("/api/books", response_model=List[BookInfo])
async def list_books_endpoint():
    return BookManager().list_all()

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
    return {"pages": Book(book_id).load_pages()}
