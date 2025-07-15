from typing import List, Optional
import uuid
import json

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from .agent import Agent
from .book import BookInfo, BookManager, Book
from .models import model_manager

from dotenv import load_dotenv

load_dotenv()


def call_llm(summary_text: str, choice: Optional[str], initial_idea: Optional[str] = None, model_id: Optional[str] = None) -> dict:
    if model_id:
        model_config = model_manager.get_model(model_id)
    else:
        model_config = model_manager.get_default_model()

    # Build the system prompt
    base_system_prompt = (
        "You are a creative writer helping the user craft a choose-your-own-adventure book. "
        "Respond strictly in valid JSON with the following keys: \n"
        "page: the next ~300-400 word page of the book.\n"
        "choices: an array of exactly 3 short distinct reader choices.\n"
        "summary_update: a concise bullet list of new characters or key events in this page.\n"
        "image_prompt: a vivid, concise description to illustrate the current page.\n"
        "IMPORTANT: within JSON string values, escape newlines as \\n instead of raw line breaks.\n"
        "Do NOT wrap the JSON in markdown code fences and do not add any additional keys."
    )

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
        prompt += f"Book summary so far:\n{summary_text.strip()}\n"

    if choice is None:
        if initial_idea:
            prompt += f"Let's begin the story based on this idea: {initial_idea}\n\nGenerate the first page."
        else:
            prompt += "Let's begin the story. Generate the first page."
    else:
        prompt += f"Continue the story following the reader's choice: '{choice}'."

    try:
        return agent.call(prompt, max_retries=3)
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


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(req: ChatRequest):
    book_id = req.book_id or str(uuid.uuid4())
    book = Book(book_id)
    summary_text = book.get_summary()

    # Get initial idea if this is the first page (no summary yet)
    initial_idea = None
    if not summary_text.strip() and req.choice is None:
        initial_idea = book.metadata.settings.get("initial_idea")

    # Build the prompt for this request
    prompt = _build_page_only_prompt(summary_text, req.choice, initial_idea)

    data = call_llm(summary_text, req.choice, initial_idea, req.model_id)

    page = data.get("page", "")
    choices = data.get("choices", [])[:3]

    if req.regenerate and book.pages:
        book.replace_last_page(page, choices, prompt, req.choice)
    else:
        book.add_page(page, choices, prompt, req.choice)

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
async def commit_page_endpoint(book_id: str):
    """Commit the last page to the summary"""
    try:
        book = Book(book_id)
        if not book.book_info.pages:
            raise HTTPException(status_code=400, detail="No pages to commit")

        last_page = book.book_info.pages[-1]
        if isinstance(last_page, dict):
            page_text = last_page["text"]
        else:
            page_text = last_page

        book.update_summary(page_text)
        return {"detail": "Page committed to summary"}
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

# ====== Streaming chat endpoint ======


# Helper prompt builders ----------------------------------------------------


def _build_page_only_prompt(summary_text: str, choice: Optional[str], initial_idea: Optional[str] = None) -> str:
    """Return a prompt instructing the model to generate ONLY the next page text.

    The model must **NOT** output any metadata or choices – just the prose for
    the next page. Newlines are allowed.
    """
    base_prompt = (
        "You are a creative writer helping the user craft a choose-your-own-adventure book. "
        "Generate the next ~300-400 word page of the book ONLY. Do not include any JSON or additional commentary, just the story text."
    )

    prompt = "\n\n" + base_prompt + "\n\n"

    if summary_text.strip():
        prompt += f"Book summary so far:\n{summary_text.strip()}\n\n"

    if choice is None:
        if initial_idea:
            prompt += f"Let's begin the story based on this idea: {initial_idea}\n\nGenerate the first page."
        else:
            prompt += "Let's begin the story. Generate the first page."
    else:
        prompt += f"Continue the story following the reader's choice: '{choice}'."

    return prompt


def _generate_choices(page_text: str, model_id: Optional[str] = None) -> List[str]:
    """Call the LLM once to produce exactly 3 reader choices based on the given page."""
    if model_id:
        model_config = model_manager.get_model(model_id)
    else:
        model_config = model_manager.get_default_model()

    model_name = model_config.model_name if model_config.provider != "ollama" else f"{model_config.provider}/{model_config.model_name}"

    # Prompt asking for choices only in JSON
    system_prompt = (
        "You are a creative writer crafting a choose-your-own-adventure book. "
        "Respond strictly in valid JSON with a single key 'choices' that maps to an array of exactly 3 short, distinct reader choices for what should happen next. "
        "Do NOT include any additional keys or commentary."
    )

    if model_config.system_prompt_modifier:
        system_prompt += "\n\n" + model_config.system_prompt_modifier

    agent = Agent(model=model_name, system_prompt=system_prompt, json_output=True, temperature=model_config.temperature or 0.8)

    prompt = (
        "Here is the most recent page of the story:\n" + page_text + "\n\nGenerate only the 'choices' JSON object."
    )

    data = agent.call(prompt)
    choices = data.get("choices", [])[:3]
    return choices


@app.get("/api/chat/stream")
async def chat_stream_endpoint(request: Request, book_id: Optional[str] = None, choice: Optional[str] = None, model_id: Optional[str] = None, regenerate: Optional[bool] = False):
    """Stream the generated page token-by-token followed by a final JSON event with the available reader choices.

    The response uses the Server-Sent Events (SSE) protocol. Regular message
    events contain incremental page tokens. After the page has finished
    generating, an event named ``choices`` is emitted whose data is a JSON
    object ``{"choices": [...]}``.
    """

    # Prepare book context --------------------------------------------------
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

    system_prompt = (
        "You are a creative writer crafting a choose-your-own-adventure book. "
        "Do NOT include any additional commentary or content to the main block - it should be a stand alone page of a book."
    )

    if model_config.system_prompt_modifier:
        system_prompt += "\n\n" + model_config.system_prompt_modifier

    agent = Agent(
        model=model_name,
        system_prompt=system_prompt,
        json_output=False,
        temperature=model_config.temperature or 0.8
    )

                                            # Streaming generator ---------------------------------------------------
    async def event_generator():
        page_buffer = ""
        thinking_buffer = ""
        in_thinking_section = False
        in_answer_section = False
        token_buffer = ""
        token_queue = []  # Queue to delay token sending

        try:
            for token in agent.stream(prompt):
                # If client has disconnected, stop the generator
                if await request.is_disconnected():
                    break

                # Handle thinking model tokens
                if model_config.thinking_model:
                    # Add token to buffer for pattern matching
                    token_buffer += token

                    # Check for thinking section start
                    if "<think>" in token_buffer and not in_thinking_section:
                        in_thinking_section = True
                        # Send thinking indicator to frontend
                        yield f"event: thinking\ndata: {json.dumps({'thinking': True})}\n\n"
                        # Remove the <think> tag from buffer
                        token_buffer = token_buffer.replace("<think>", "", 1)
                        # Clear the token queue since we're entering thinking mode
                        token_queue.clear()
                        continue

                                        # Check for thinking section end
                    if "</think>" in token_buffer and in_thinking_section:
                        in_thinking_section = False
                        # Send thinking end indicator
                        yield f"event: thinking\ndata: {json.dumps({'thinking': False})}\n\n"
                        # Remove the </think> tag from buffer
                        token_buffer = token_buffer.replace("</think>", "", 1)
                        # Clear the token queue since we're exiting thinking mode
                        token_queue.clear()
                        continue

                    # Check for answer section start
                    if "<answer>" in token_buffer and not in_answer_section:
                        in_answer_section = True
                        # Remove the <answer> tag from buffer
                        token_buffer = token_buffer.replace("<answer>", "", 1)
                        # Clear the token queue since we're entering answer mode
                        token_queue.clear()
                        continue

                    # Check for answer section end
                    if "</answer>" in token_buffer and in_answer_section:
                        in_answer_section = False
                        # Remove the </answer> tag from buffer
                        token_buffer = token_buffer.replace("</answer>", "", 1)
                        # Clear the token queue since we're exiting answer mode
                        token_queue.clear()
                        continue

                    # Accumulate tokens based on current section
                    if in_thinking_section:
                        thinking_buffer += token
                        # Don't send thinking tokens to frontend and don't accumulate in page_buffer
                        continue
                    elif in_answer_section:
                        # Only accumulate answer tokens
                        page_buffer += token
                    else:
                        # If not in any special section, accumulate normally
                        page_buffer += token
                else:
                    # Non-thinking model: accumulate all tokens normally
                    page_buffer += token

                # Only send tokens to frontend if we're not in thinking section
                if not (model_config.thinking_model and in_thinking_section):
                    # For thinking models, use a delay queue to avoid sending partial tags
                    if model_config.thinking_model:
                        token_queue.append(token)
                        # Send tokens with a 3-token delay to ensure we can detect complete tags
                        if len(token_queue) >= 3:
                            # Send the oldest token in the queue
                            safe_token = json.dumps(token_queue.pop(0))
                            yield f"data: {safe_token}\n\n"
                    else:
                        # Non-thinking model: send immediately
                        safe_token = json.dumps(token)
                        yield f"data: {safe_token}\n\n"

                        # After page finished, send any remaining tokens in the queue
            if model_config.thinking_model and token_queue:
                for queued_token in token_queue:
                    safe_token = json.dumps(queued_token)
                    yield f"data: {safe_token}\n\n"

            # After page finished, generate choices ----------------------
            # For thinking models, clean up any remaining tags and use only the answer portion
            final_page_text = page_buffer.strip()

            if model_config.thinking_model:
                # Remove any remaining thinking or answer tags
                final_page_text = final_page_text.replace("<think>", "").replace("</think>", "")
                final_page_text = final_page_text.replace("<answer>", "").replace("</answer>", "")
                final_page_text = final_page_text.strip()

            choices_list = _generate_choices(final_page_text, model_id)

            # Save or replace page in book (but don't update summary yet)
            if regenerate and book.pages:
                book.replace_last_page(final_page_text, choices_list, prompt, choice)
            else:
                book.add_page(final_page_text, choices_list, prompt, choice)
            # Note: Summary is NOT updated here - it will be updated when user commits the page

            # Send choices event
            choices_json = json.dumps({"choices": choices_list, "book_id": bid})
            yield f"event: choices\ndata: {choices_json}\n\n"
        except Exception as exc:
            error_json = json.dumps({"error": str(exc)})
            yield f"event: error\ndata: {error_json}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
