from litellm import completion
import json

class Agent:
    def __init__(self, model: str = "ollama/mistral", system_prompt: str = "", json_output: bool = True):
        self.model = model
        self.system_prompt = system_prompt
        self.json_output = json_output

    def call(self, prompt: str) -> str:
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt}
        ]
        try:
            response = completion(
                model=self.model,
                messages=messages,
                temperature=0.8,
                stream=False,
                # max_tokens=1000,
                # top_p=0.9,
            )

            content = response["choices"][0]["message"]["content"].strip()
            if self.json_output:
                return self._parse_json(content)
            return content
        except Exception as exc:  # pylint: disable=broad-except
            raise Exception(f"LLM call failed: {exc}") from exc

    def _parse_json(self, content: str) -> dict:
            start, end = content.find("{"), content.rfind("}")
            if start == -1 or end == -1:
                raise ValueError("Model response did not contain JSON")
            json_str = content[start:end + 1]
            try:
                data = json.loads(json_str)
            except json.JSONDecodeError:
                escaped = json_str.replace("\r", " ").replace("\n", r"\n")
                data = json.loads(escaped)
            return data
