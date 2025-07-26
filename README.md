# Book Builder

A minimal full-stack app that helps you craft a choose-your-own-adventure book or chat with an AI companion with help from a large language model via [LiteLLM](https://github.com/BerriAI/litellm).

The app delivers:

## Story telling
1. A chat-like interface that writes the next page of your story
2. A continuously-updated `summary.md` file tracking characters & key events
3. Three interactive choices after every page (click a button to decide or write your custom one)
4. Optional image illustrations (TODO)

## Chat
1. Create personas to talk with
2. Chat with them

## Quick start

```bash
# 1. Install deps (Python ≥ 3.12)
uv install

# 2. Point LiteLLM to your local/remote Ollama model
export OLLAMA_MODEL="ollama/mistral"

# 3. Launch the server
uv run python main.py
# ...or uvicorn directly: uvicorn main:app --reload

# 4. Run the frontend
cd frontend
yarn
yarn run dev

# 5. Open your browser
http://localhost:5173
```

## Adjusting the model

Set the `OLLAMA_MODEL` environment variable to whichever model you have downloaded in Ollama. Example:

```bash
export OLLAMA_MODEL="ollama/llama3"
```


## Project layout

```
api/             # Python api to handle generation
frontend/        # static UI (Bootstrap)
pyproject.toml   # project metadata and dependencies
```

Feel free to adapt and extend! ✨
