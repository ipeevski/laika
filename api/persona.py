import json
import uuid
from pathlib import Path
from typing import List, Dict, Optional
import datetime

DATA_DIR = Path(__file__).parent.parent / "data"
PERSONA_DIR = DATA_DIR / "personas"
CONV_DIR = DATA_DIR / "conversations"

# Ensure directories exist
PERSONA_DIR.mkdir(parents=True, exist_ok=True)
CONV_DIR.mkdir(parents=True, exist_ok=True)


def _load_json(path: Path) -> dict:
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            # Corrupted file – rename and start fresh
            path.rename(path.with_suffix(".bak"))
    return {}


def _save_json(path: Path, data: dict):
    tmp = path.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    tmp.replace(path)


class Persona:
    def __init__(self, persona_id: str):
        self.id = persona_id
        self.path = PERSONA_DIR / f"{persona_id}.json"
        self.data = _load_json(self.path)
        if not self.data:
            raise FileNotFoundError("Persona not found")

    # Static helpers -------------------------------------------------------
    @staticmethod
    def create(name: str, description: str = "", traits: Optional[List[str]] = None):
        pid = str(uuid.uuid4())
        persona_data = {
            "id": pid,
            "name": name,
            "description": description,
            "traits": traits or [],
        }
        _save_json(PERSONA_DIR / f"{pid}.json", persona_data)
        return Persona(pid)

    @staticmethod
    def list_all() -> List[dict]:
        personas = []
        for pfile in PERSONA_DIR.glob("*.json"):
            data = _load_json(pfile)
            if data:
                personas.append(data)
        return personas

    # Instance methods -----------------------------------------------------
    def update(self, name: Optional[str] = None, description: Optional[str] = None, traits: Optional[List[str]] = None):
        if name is not None:
            self.data["name"] = name
        if description is not None:
            self.data["description"] = description
        if traits is not None:
            self.data["traits"] = traits
        _save_json(self.path, self.data)
        return self.data

    def delete(self):
        if self.path.exists():
            self.path.unlink()


class Conversation:
    def __init__(self, conv_id: str):
        self.id = conv_id
        self.path = CONV_DIR / f"{conv_id}.json"
        self.data = _load_json(self.path)
        if not self.data:
            raise FileNotFoundError("Conversation not found")

    # Static helpers -------------------------------------------------------
    @staticmethod
    def create(persona_id: str):
        cid = str(uuid.uuid4())
        conv_data = {
            "id": cid,
            "persona_id": persona_id,
            "messages": [],  # list[dict]
            "updated_at": datetime.datetime.utcnow().isoformat()
        }
        _save_json(CONV_DIR / f"{cid}.json", conv_data)
        return Conversation(cid)

    # Instance methods -----------------------------------------------------
    def add_message(self, sender: str, text: str):
        self.data.setdefault("messages", []).append({"sender": sender, "text": text})
        self.data["updated_at"] = datetime.datetime.utcnow().isoformat()
        _save_json(self.path, self.data)

    @property
    def messages(self):
        return self.data.get("messages", [])

    @property
    def persona_id(self):
        return self.data.get("persona_id")

    @property
    def updated_at(self):
        return self.data.get("updated_at")
