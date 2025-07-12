# Book Builder

A minimal full-stack app that helps you craft a choose-your-own-adventure book with help from an Ollama large language model via [LiteLLM](https://github.com/BerriAI/litellm).

The app delivers:

1. A chat-like interface that writes the next page of your story
2. A continuously-updated `summary.md` file tracking characters & key events
3. Three interactive choices after every page (click a button to decide!)
4. Optional image illustrations generated through Flux

## Quick start

```bash
# 1. Install deps (Python ≥ 3.12)
uv pip install -r uv.lock  # or: pip install -e .

# 2. Point LiteLLM to your local/remote Ollama model
export OLLAMA_MODEL="ollama/mistral"
# Optionally configure OLLAMA_BASE_URL as well.

# 3. Launch the server
python main.py
# ...or uvicorn directly: uvicorn main:app --reload

# 4. Open your browser
http://localhost:8000
```

## Adjusting the model

Set the `OLLAMA_MODEL` environment variable to whichever model you have downloaded in Ollama. Example:

```bash
export OLLAMA_MODEL="ollama/llama3"
```

## Image generation

The `generate_image` helper calls **Flux**. Replace the stub with your preferred image generation code if necessary.

## Project layout

```
frontend/        # static UI (TailwindCSS + vanilla JS)
main.py          # FastAPI backend + Uvicorn entrypoint
summary.md       # continuously updated book summary
pyproject.toml   # project metadata and dependencies
```

Feel free to adapt and extend! ✨
