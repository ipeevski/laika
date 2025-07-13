from typing import Dict, List, Optional
from pydantic import BaseModel
import json
from pathlib import Path

class ModelConfig(BaseModel):
    id: str
    name: str
    provider: str
    model_name: str
    description: str
    content_level: str
    temperature: float
    tags: List[str] = []
    system_prompt_modifier: Optional[str] = None

class ModelManager:

    DEFAULT_MODEL = "mistral-balanced"

    def __init__(self):
        self.models = {}
        self.default_model_id = None
        self._load_models()

    def _load_models(self):
        """Load models from JSON configuration file"""
        config_path = Path(__file__).parent / "models_config.json"
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)

            # Load models using JSON keys as IDs
            for model_id, model_data in config["models"].items():
                # Use the JSON key as the ID, not the id field from the data
                model_data["id"] = model_id
                self.models[model_id] = ModelConfig(**model_data)

            # Load special model IDs
            self.default_model_id = config.get("default_model", self.DEFAULT_MODEL)

        except Exception as e:
            print(f"Error loading models config: {e}")
            # Fallback to basic models
            self._create_fallback_models()

    def refresh_models(self):
        """Reload models from the JSON configuration file"""
        self.models = {}
        self._load_models()

    def _create_fallback_models(self):
        """Create fallback models if JSON config fails to load"""
        self.models = {
            "mistral-balanced": ModelConfig(
                id="mistral-balanced",
                name="Mistral Balanced",
                provider="ollama",
                model_name="ollama/mistral",
                description="Balanced creativity with moderate content flexibility",
                content_level="mild",
                temperature=0.8,
                tags=["balanced", "creative", "moderate", "versatile"]
            )
        }
        self.default_model_id = "mistral-balanced"

    def get_all_models(self) -> List[ModelConfig]:
        """Get all available models"""
        return list(self.models.values())

    def get_model(self, model_id: str) -> Optional[ModelConfig]:
        """Get a specific model by ID"""
        return self.models.get(model_id)

    def get_models_by_filter(self, content_level=None, tags=None) -> List[ModelConfig]:
        """Filter models by various criteria"""
        filtered_models = []

        for model in self.models.values():
            if content_level and model.content_level != content_level:
                continue

            if tags:
                if not any(tag in model.tags for tag in tags):
                    continue

            filtered_models.append(model)

        return filtered_models

    def get_default_model(self) -> ModelConfig:
        """Get the default model"""
        return self.models.get(self.default_model_id) or list(self.models.values())[0]

# Global model manager instance
model_manager = ModelManager()
