from typing import List, Optional
import uuid
import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .agent import Agent
from .book import BookInfo, BookManager, Book
from .models import model_manager
from .persona import Persona, Conversation, _save_json
from .prompts import get_prompt, set_prompt

from dotenv import load_dotenv

load_dotenv()


def load_story_prompt_file(prompt_name: str) -> str:
    """Load a prompt from a file in the data directory, using defaults if the file doesn't exist."""
    prompt_path = Path(__file__).parent.parent / "data" / "story" / "prompts" / f"{prompt_name}.md"
    default_path = Path(__file__).parent.parent / "prompts" / "story" / f"{prompt_name}.md"

    return load_prompt_file(prompt_name, prompt_path, default_path)


def load_chat_prompt_file(prompt_name: str) -> str:
    """Load a chat prompt from a file in the data directory, using defaults if the file doesn't exist."""
    prompt_path = Path(__file__).parent.parent / "data" / "chat" / "prompts" / f"{prompt_name}.md"
    default_path = Path(__file__).parent.parent / "prompts" / "chat" / f"{prompt_name}.md"

    return load_prompt_file(prompt_name, prompt_path, default_path)

def load_prompt_file(prompt_name: str, prompt_path: str, default_path: str) -> str:
    if prompt_path.exists():
        return prompt_path.read_text(encoding="utf-8").strip()
    elif default_path.exists():
        # Create the actual prompt file from the default
        prompt_path.parent.mkdir(parents=True, exist_ok=True)
        default_content = default_path.read_text(encoding="utf-8").strip()
        prompt_path.write_text(default_content, encoding="utf-8")
        return default_content
    else:
        raise FileNotFoundError(f"Prompt file not found: {prompt_path} and no default at {default_path}")


def format_prompt(template: str, **kwargs) -> str:
    """Format a prompt template with the given parameters."""
    return template.format(**kwargs)


def call_llm(summary_text: str, choice: Optional[str], initial_idea: Optional[str] = None, model_id: Optional[str] = None) -> dict:
    if model_id:
        model_config = model_manager.get_model(model_id)
    else:
        model_config = model_manager.get_default_model()

    # Build the system prompt
    base_system_prompt = get_prompt("story")

    # Add model-specific modifier if available
    if model_config.system_prompt_modifier:
        system_prompt = f"{base_system_prompt}\n\n{model_config.system_prompt_modifier}"
    else:
        system_prompt = base_system_prompt

    model_name = model_config.model_name if model_config.provider != "ollama" else f"{model_config.provider}/{model_config.model_name}"

    agent = Agent(
        model=model_name,
        system_prompt=system_prompt,
        json_output=True,
        temperature=model_config.temperature or 0.8,
    )

    prompt = ""

    if summary_text.strip():
        summary_context_template = load_story_prompt_file("summary_context")
        prompt += format_prompt(summary_context_template, summary_text=summary_text.strip()) + "\n\n"

    if choice is None:
        if initial_idea:
            page_with_idea_template = load_story_prompt_file("page_with_idea")
            prompt += format_prompt(page_with_idea_template, initial_idea=initial_idea)
        else:
            prompt += load_story_prompt_file("page_continuation")
    else:
        page_with_choice_template = load_story_prompt_file("page_with_choice")
        prompt += format_prompt(page_with_choice_template, choice=choice)

    try:
        return agent.call(prompt, max_retries=3)
    except Exception as exc:  # pylint: disable=broad-except
        print("[error] LLM call failed:", exc)
        raise HTTPException(status_code=500, detail="LLM generation failed") from exc


def generate_enhanced_summary(book: Book, model_id: Optional[str] = None) -> dict:
    """Generate an enhanced summary using LLM to update summary, key events, and character profiles."""
    if model_id:
        model_config = model_manager.get_model(model_id)
    else:
        model_config = model_manager.get_default_model()

    # Load custom summary prompt (if any)
    base_summary_prompt = load_story_prompt_file("summary")

    # We still need structured JSON output, so append instructions
    system_prompt = f"{base_summary_prompt}\n\n" + load_story_prompt_file("summary_with_json")

    model_name = model_config.model_name if model_config.provider != "ollama" else f"{model_config.provider}/{model_config.model_name}"

    agent = Agent(
        model=model_name,
        system_prompt=system_prompt,
        json_output=True,
        temperature=0.3,  # Lower temperature for more consistent analysis
    )

    # Get all page texts
    page_texts = book.get_page_texts()
    if not page_texts:
        return {"summary": "", "key_events": [], "characters": []}

    # Build the prompt with all story content
    summary_analysis_template = load_story_prompt_file("summary_analysis")
    story_content = chr(10).join(f"Page {i+1}: {text}" for i, text in enumerate(page_texts))
    prompt = format_prompt(summary_analysis_template, story_content=story_content, current_summary=book.get_summary())

    try:
        result = agent.call(prompt, max_retries=3)
        return result
    except Exception as exc:
        print(f"[error] Enhanced summary generation failed: {exc}")
        # Fallback to basic summary
        return {
            "summary": "\n".join(page_texts[-3:]),  # Last 3 pages as fallback
            "key_events": [],
            "characters": []
        }


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
    model_id: Optional[str] = None
    regenerate: Optional[bool] = False


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


# -------------- BOOK (choose-your-own adventure) ENDPOINTS --------------

@app.post("/api/story", response_model=ChatResponse, name="create-story-page")
async def story_endpoint(req: ChatRequest):
    # identical logic to previous chat_endpoint but path renamed
    book_id = req.book_id or str(uuid.uuid4())
    book = Book(book_id)
    summary_text = book.get_summary()

    initial_idea = None
    if not summary_text.strip() and req.choice is None:
        initial_idea = book.metadata.settings.get("initial_idea")

    prompt = _build_page_only_prompt(summary_text, req.choice, initial_idea)

    data = call_llm(summary_text, req.choice, initial_idea, req.model_id)
    page = data.get("page", "")
    choices = data.get("choices", [])[:3]

    if req.regenerate and book.pages:
        book.replace_last_page(page, choices, prompt, req.choice)
    else:
        book.add_page(page, choices, prompt, req.choice)

    return ChatResponse(book_id=book_id, page=page, choices=choices)


# -----------------------------------------------------------------------
# Helper functions for story generation prompts and choice generation
# -----------------------------------------------------------------------

def _build_page_only_prompt(summary_text: str, choice: Optional[str], initial_idea: Optional[str] = None) -> str:
    """Return a prompt instructing the model to generate ONLY the next page text."""
    base_prompt = load_story_prompt_file("page_generation")

    prompt = "\n\n" + base_prompt + "\n\n"

    if summary_text.strip():
        summary_context_template = load_story_prompt_file("summary_context")
        prompt += format_prompt(summary_context_template, summary_text=summary_text.strip()) + "\n\n"

    if choice is None:
        if initial_idea:
            page_with_idea_template = load_story_prompt_file("page_with_idea")
            prompt += format_prompt(page_with_idea_template, initial_idea=initial_idea)
        else:
            prompt += load_story_prompt_file("page_continuation")
    else:
        page_with_choice_template = load_story_prompt_file("page_with_choice")
        prompt += format_prompt(page_with_choice_template, choice=choice)

    return prompt


def _generate_choices(page_text: str, model_id: Optional[str] = None) -> List[str]:
    """Call the LLM once to produce exactly 3 reader choices based on the given page."""
    if model_id:
        model_config = model_manager.get_model(model_id)
    else:
        model_config = model_manager.get_default_model()

    model_name = model_config.model_name if model_config.provider != "ollama" else f"{model_config.provider}/{model_config.model_name}"

    system_prompt = load_story_prompt_file("choices_generation")

    if model_config.system_prompt_modifier:
        system_prompt += "\n\n" + model_config.system_prompt_modifier

    agent = Agent(model=model_name, system_prompt=system_prompt, json_output=True, temperature=model_config.temperature or 0.8)

    choices_prompt_template = load_story_prompt_file("choices_prompt")
    prompt = format_prompt(choices_prompt_template, page_text=page_text)

    data = agent.call(prompt)
    return data.get("choices", [])[:3]


@app.get("/api/story/stream")
async def story_stream_endpoint(request: Request, book_id: Optional[str] = None, choice: Optional[str] = None, model_id: Optional[str] = None, regenerate: Optional[bool] = False):
    """Stream the generated story page."""
    bid = book_id or str(uuid.uuid4())
    book = Book(bid)
    summary_text = book.get_summary()

    initial_idea = None
    if not summary_text.strip() and choice is None:
        initial_idea = book.book_info.settings.get("initial_idea")

    prompt = _build_page_only_prompt(summary_text, choice, initial_idea)

    if model_id:
        model_config = model_manager.get_model(model_id)
    else:
        model_config = model_manager.get_default_model()

    model_name = model_config.model_name if model_config.provider != "ollama" else f"{model_config.provider}/{model_config.model_name}"

    agent = Agent(model=model_name, system_prompt=load_story_prompt_file("stream_page_generation"), json_output=False, temperature=model_config.temperature or 0.8)

    async def event_gen():
        page_tokens: List[str] = []
        # Stream tokens using the helper
        for event, data in agent.process_stream(prompt, model_config.thinking_model):
            if await request.is_disconnected():
                break
            if event == "thinking":
                yield f"event: thinking\ndata: {json.dumps({'thinking': data})}\n\n"
            elif event == "token":
                page_tokens.append(data)
                safe_token = json.dumps(data)
                yield f"data: {safe_token}\n\n"

        full_page_text = "".join(page_tokens).strip()

        # Save page immediately with placeholder choices to avoid commit failure
        placeholder_choices: List[str] = []
        if regenerate and book.pages:
            book.replace_last_page(full_page_text, placeholder_choices, prompt, choice)
        else:
            book.add_page(full_page_text, placeholder_choices, prompt, choice)

        # Generate choices once page is complete
        choices_list = _generate_choices(full_page_text, model_id)

        # Update page with real choices
        book.replace_last_page(full_page_text, choices_list, prompt, choice)

        yield f"event: choices\ndata: {json.dumps({'choices': choices_list})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")

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

@app.get("/api/books/{book_id}/metadata", response_model=BookInfo)
async def get_book_metadata_endpoint(book_id: str):
    try:
        book = Book(book_id)
        return book.book_info
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

@app.get("/api/books/{book_id}/prompts")
async def get_book_prompts_endpoint(book_id: str):
    try:
        book = Book(book_id)
        return {"prompts": book.get_page_prompts()}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

@app.get("/api/books/{book_id}/prompts/{page_index}")
async def get_book_page_prompt_endpoint(book_id: str, page_index: int):
    try:
        book = Book(book_id)
        prompt = book.get_page_prompt(page_index)
        if not prompt:
            raise HTTPException(status_code=404, detail="Prompt not found")
        return {"prompt": prompt}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

@app.get("/api/books/{book_id}/choice-used/{page_index}")
async def get_book_page_choice_used_endpoint(book_id: str, page_index: int):
    try:
        book = Book(book_id)
        choice_used = book.get_page_choice_used(page_index)
        return {"choice_used": choice_used}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

@app.post("/api/books/{book_id}/commit")
async def commit_page_endpoint(book_id: str, model_id: Optional[str] = None):
    """Commit the last page to the summary and generate enhanced summary with key events and character profiles"""
    try:
        book = Book(book_id)
        if not book.book_info.pages:
            raise HTTPException(status_code=400, detail="No pages to commit")

        # Generate enhanced summary using LLM
        enhanced_data = generate_enhanced_summary(book, model_id)

        # Update the book with the enhanced summary, key events, and characters
        book.book_info.summary = enhanced_data.get("summary", "")

        # Update key events
        book.book_info.key_events = enhanced_data.get("key_events", [])

        # Update characters
        book.book_info.characters = enhanced_data.get("characters", [])

        # Save the updated book data
        book._save_data()

        return {
            "detail": "Page committed to summary",
            "summary": enhanced_data.get("summary", ""),
            "key_events_count": len(enhanced_data.get("key_events", [])),
            "characters_count": len(enhanced_data.get("characters", []))
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

@app.patch("/api/books/{book_id}/pages/{page_index}")
async def update_page_endpoint(book_id: str, page_index: int, body: dict = Body(...), model_id: Optional[str] = None):
    new_text = body.get("text")
    if new_text is None:
        raise HTTPException(status_code=400, detail="text required")
    try:
        book = Book(book_id)
        book.update_page_text(page_index, new_text)

        # Generate enhanced summary after page update
        enhanced_data = generate_enhanced_summary(book, model_id)

        # Update the book with the enhanced summary, key events, and characters
        book.book_info.summary = enhanced_data.get("summary", "")
        book.book_info.key_events = enhanced_data.get("key_events", [])
        book.book_info.characters = enhanced_data.get("characters", [])

        # Save the updated book data
        book._save_data()

        return {
            "detail": "page updated",
            "summary": enhanced_data.get("summary", ""),
            "key_events_count": len(enhanced_data.get("key_events", [])),
            "characters_count": len(enhanced_data.get("characters", []))
        }
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")
    except IndexError:
        raise HTTPException(status_code=400, detail="index out of range")

@app.get("/api/books/{book_id}/meta")
async def get_book_meta(book_id: str):
    try:
        book = Book(book_id)
        return book.get_meta()
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Book not found")

# ====== Model management endpoints ======
@app.get("/api/models")
async def list_models_endpoint():
    """Get all available models"""
    return model_manager.get_all_models()

@app.post("/api/models/refresh")
async def refresh_models_endpoint():
    """Refresh the models list from the JSON configuration file"""
    try:
        model_manager.refresh_models()
        return {"detail": "Models refreshed successfully", "count": len(model_manager.get_all_models())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to refresh models: {str(e)}")

# ----------- PERSONA CHAT ENDPOINTS (previously /dialogue) --------------
# Rename routes to /api/chat and /api/chat/stream

class PersonaBase(BaseModel):
    name: str
    description: str = ""
    traits: List[str] = []

class PersonaCreateRequest(PersonaBase):
    pass

class PersonaUpdateRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    traits: Optional[List[str]] = None

class PersonaEnhanceRequest(PersonaBase):
    pass

class DialogueRequest(BaseModel):
    persona_id: str
    message: str
    conversation_id: Optional[str] = None

class DialogueResponse(BaseModel):
    conversation_id: str
    reply: str

@app.post("/api/chat", response_model=DialogueResponse)
async def chat_endpoint(req: DialogueRequest):
    # Load persona
    try:
        persona = Persona(req.persona_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Persona not found")

    # Load or create conversation
    if req.conversation_id:
        try:
            conv = Conversation(req.conversation_id)
        except FileNotFoundError:
            conv = Conversation.create(req.persona_id)
    else:
        conv = Conversation.create(req.persona_id)

    # Add user message
    conv.add_message("user", req.message)

    # Build conversation history text (simple)
    history_lines = []
    for m in conv.messages[-10:]:
        prefix = "User:" if m["sender"] == "user" else f"{persona.data['name']}:"
        history_lines.append(f"{prefix} {m['text']}")
    history_text = "\n".join(history_lines) + "\n" + f"{persona.data['name']}:"

    # Call LLM
    system_prompt = build_persona_system_prompt(persona.data)
    model_config = model_manager.get_default_model()
    model_name = model_config.model_name if model_config.provider != "ollama" else f"{model_config.provider}/{model_config.model_name}"

    agent = Agent(model=model_name, system_prompt=system_prompt, json_output=False, temperature=model_config.temperature or 0.7)

    try:
        reply = agent.call(history_text, max_retries=3)
    except Exception as exc:
        raise HTTPException(status_code=500, detail="LLM generation failed") from exc

    # Save AI reply
    conv.add_message(persona.data['name'], reply)

    return DialogueResponse(conversation_id=conv.id, reply=reply)

@app.get("/api/chat/stream")
async def chat_stream_endpoint(request: Request, persona_id: str, message: str, conversation_id: Optional[str] = None, model_id: Optional[str] = None):
    # Load persona
    try:
        persona = Persona(persona_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Persona not found")

    # Conversation handling
    if conversation_id:
        try:
            conv = Conversation(conversation_id)
        except FileNotFoundError:
            conv = Conversation.create(persona_id)
    else:
        conv = Conversation.create(persona_id)

    conv.add_message("user", message)

    # Build history prompt (last 10 turns)
    history_lines = []
    for m in conv.messages[-10:]:
        prefix = "User:" if m["sender"] == "user" else f"{persona.data['name']}:"
        history_lines.append(f"{prefix} {m['text']}")
    history_text = "\n".join(history_lines) + "\n" + f"{persona.data['name']}:"

    system_prompt = build_persona_system_prompt(persona.data)

    model_config = model_manager.get_default_model() if not model_id else model_manager.get_model(model_id)
    model_name = model_config.model_name if model_config.provider != "ollama" else f"{model_config.provider}/{model_config.model_name}"

    agent = Agent(model=model_name, system_prompt=system_prompt, json_output=False, temperature=model_config.temperature or 0.7)

    async def event_gen():
        ai_tokens: List[str] = []
        for event, data in agent.process_stream(history_text, model_config.thinking_model):
            if await request.is_disconnected():
                break
            if event == "thinking":
                yield f"event: thinking\ndata: {json.dumps({'thinking': data})}\n\n"
            elif event == "token":
                ai_tokens.append(data)
                safe = json.dumps(data)
                yield f"data: {safe}\n\n"
        full_reply = "".join(ai_tokens).strip()
        conv.add_message(persona.data['name'], full_reply)
        yield f"event: done\ndata: {json.dumps({'conversation_id': conv.id})}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")

@app.get("/api/chat/{conversation_id}/messages/{msg_index}/stream")
async def chat_regen_stream(request: Request, conversation_id: str, msg_index: int, regenerate: Optional[bool] = False, user_message: Optional[str] = None, model_id: Optional[str] = None):
    """Stream a regenerated AI reply starting at a specific message index.
    If regenerate=false and user_message provided, replaces the user message text before generating.
    All conversation messages after msg_index are truncated first.
    """
    try:
        conv = Conversation(conversation_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if msg_index < 0 or msg_index >= len(conv.messages):
        raise HTTPException(status_code=400, detail="msg_index out of range")

    # Expect pattern: even indices user, odd indices ai; ensure index is user message
    if conv.messages[msg_index]["sender"] != "user":
        raise HTTPException(status_code=400, detail="msg_index must point to a user message")

    # Optionally edit user message
    if user_message is not None and not regenerate:
        conv.messages[msg_index]["text"] = user_message.strip()

    # Trim conversation after this user turn
    conv.data["messages"] = conv.messages[: msg_index + 1]  # keep user msg
    _save_json(conv.path, conv.data)  # persist trim

    persona = Persona(conv.persona_id)

    # Build history prompt again
    history_lines = []
    for m in conv.messages[-10:]:
        prefix = "User:" if m["sender"] == "user" else f"{persona.data['name']}:"
        history_lines.append(f"{prefix} {m['text']}")
    history_text = "\n".join(history_lines) + "\n" + f"{persona.data['name']}:"

    system_prompt = build_persona_system_prompt(persona.data)

    model_config = model_manager.get_default_model() if not model_id else model_manager.get_model(model_id)
    model_name = model_config.model_name if model_config.provider != "ollama" else f"{model_config.provider}/{model_config.model_name}"
    agent = Agent(model=model_name, system_prompt=system_prompt, json_output=False, temperature=model_config.temperature or 0.7)

    async def event_gen():
        ai_tokens = []
        for event, data in agent.process_stream(history_text, model_config.thinking_model):
            if await request.is_disconnected():
                break
            if event == "thinking":
                yield f"event: thinking\ndata: {json.dumps({'thinking': data})}\n\n"
            elif event == "token":
                ai_tokens.append(data)
                yield f"data: {json.dumps(data)}\n\n"
        full_reply = "".join(ai_tokens).strip()
        # Append new AI message
        conv.add_message("ai", full_reply)
        yield f"event: done\ndata: {{}}\n\n"

    return StreamingResponse(event_gen(), media_type="text/event-stream")

@app.patch("/api/chat/{conversation_id}/messages/{msg_index}")
async def patch_message(conversation_id: str, msg_index: int, body: dict = Body(...)):
    try:
        conv = Conversation(conversation_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if msg_index <0 or msg_index>=len(conv.messages):
        raise HTTPException(status_code=400, detail="index out of range")
    new_text = body.get("text")
    if new_text is None:
        raise HTTPException(status_code=400, detail="text required")
    conv.messages[msg_index]["text"] = new_text.strip()
    _save_json(conv.path, conv.data)
    return {"detail":"updated"}

# ---------------- Conversation Library Endpoints -------------------------

class ConversationMeta(BaseModel):
    id: str
    persona_id: str
    persona_name: str
    updated_at: str
    last_message: Optional[str]

@app.get("/api/chats", response_model=List[ConversationMeta])
async def list_chats():
    metas: List[ConversationMeta] = []
    conv_dir = Path(__file__).parent.parent / "data" / "chat" / "conversations"
    for path in conv_dir.glob("*.json"):
        try:
            conv = Conversation(path.stem)
            persona = Persona(conv.persona_id)
            last_message = conv.messages[-1]["text"] if conv.messages else None
            metas.append(ConversationMeta(id=conv.id, persona_id=conv.persona_id, persona_name=persona.data.get("name"), updated_at=conv.updated_at, last_message=last_message))
        except Exception:
            continue
    # Sort newest first
    metas.sort(key=lambda m: m.updated_at or "", reverse=True)
    return metas

@app.get("/api/chat/{conversation_id}")
async def get_chat(conversation_id: str):
    try:
        conv = Conversation(conversation_id)
        return conv.data
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Conversation not found")

# ========= Persona and Dialogue models =========
@app.get("/api/personas")
async def list_personas_endpoint():
    return Persona.list_all()

@app.post("/api/personas", status_code=201)
async def create_persona_endpoint(req: PersonaCreateRequest):
    persona = Persona.create(req.name, req.description, req.traits)
    return persona.data

@app.get("/api/personas/{persona_id}")
async def get_persona_endpoint(persona_id: str):
    try:
        persona = Persona(persona_id)
        return persona.data
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Persona not found")

@app.put("/api/personas/{persona_id}")
async def update_persona_endpoint(persona_id: str, req: PersonaUpdateRequest):
    try:
        persona = Persona(persona_id)
        updated = persona.update(req.name, req.description, req.traits)
        return updated
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Persona not found")

@app.delete("/api/personas/{persona_id}")
async def delete_persona_endpoint(persona_id: str):
    try:
        persona = Persona(persona_id)
        persona.delete()
        return {"detail": "Persona deleted"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Persona not found")

# Stub – enhance persona via LLM (optional)
@app.post("/api/personas/enhance")
async def enhance_persona_endpoint(req: PersonaEnhanceRequest):
    # For now, echo back with minor tweak
    enhanced = {
        "name": req.name.strip().title(),
        "description": req.description.strip(),
        "traits": req.traits,
    }
    return enhanced

# ========= Dialogue/chat endpoints =========

def build_persona_system_prompt(pdata: dict) -> str:
    description = pdata.get("description", "")
    traits = ", ".join(pdata.get("traits", []))
    base_prompt = get_prompt("chat")

    persona_template = load_chat_prompt_file("persona_template")
    persona_part = format_prompt(persona_template, name=pdata.get('name', 'an AI persona'), description=description, traits=traits)

    return base_prompt + "\n\n" + persona_part

@app.get("/api/prompts/{mode}")
async def get_prompt_endpoint(mode:str):
    if mode not in ("story","chat"):
        raise HTTPException(status_code=400, detail="mode must be story or chat")
    return {"content": get_prompt(mode)}

@app.put("/api/prompts/{mode}")
async def set_prompt_endpoint(mode:str, body: dict = Body(...)):
    if mode not in ("story","chat"):
        raise HTTPException(status_code=400, detail="mode must be story or chat")
    content = body.get("content")
    if content is None:
        raise HTTPException(status_code=400, detail="content required")
    set_prompt(mode, content)
    return {"detail":"updated"}
