import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent / "data"
STORY_PATH = BASE_DIR / "story" / "prompts" / "system.md"
CHAT_PATH = BASE_DIR / "chat" / "prompts" / "system.md"

for p, default in [(STORY_PATH,"You are a creative writer helping the user craft a choose-your-own-adventure book."), (CHAT_PATH,"You are an AI persona engaging in helpful dialogue.")]:
    p.parent.mkdir(parents=True, exist_ok=True)
    if not p.exists() or p.stat().st_size==0:
        p.write_text(default, encoding="utf-8")

_cache = {}

def get_prompt(mode: str) -> str:
    path = STORY_PATH if mode=="story" else CHAT_PATH
    if path in _cache:
        return _cache[path]
    text = path.read_text(encoding="utf-8")
    _cache[path]=text
    return text

def set_prompt(mode: str, content: str):
    path = STORY_PATH if mode=="story" else CHAT_PATH
    path.write_text(content, encoding="utf-8")
    _cache[path]=content
