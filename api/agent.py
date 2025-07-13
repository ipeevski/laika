from litellm import completion
import json

class Agent:
    def __init__(self, model: str = "ollama/mistral", system_prompt: str = "", json_output: bool = True, temperature: float = 0.8):
        self.model = model
        self.system_prompt = system_prompt
        self.json_output = json_output
        self.temperature = temperature

    def call(self, prompt, max_retries=3) -> str:
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt}
        ]

        last_exception = None

        for attempt in range(max_retries):
            try:
                response = completion(
                    model=self.model,
                    messages=messages,
                    temperature=self.temperature,
                    stream=False,
                    # max_tokens=1000,
                    # top_p=0.9,
                )

                content = response["choices"][0]["message"]["content"].strip()
                if self.json_output:
                    try:
                        return self._parse_json(content)
                    except (ValueError, json.JSONDecodeError) as json_exc:
                        last_exception = json_exc
                        if attempt < max_retries - 1:
                            print(f"JSON parsing failed on attempt {attempt + 1}, retrying...")
                            continue
                        else:
                            raise json_exc
                return content
            except Exception as exc:  # pylint: disable=broad-except
                last_exception = exc
                if attempt < max_retries - 1:
                    print(f"LLM call failed on attempt {attempt + 1}, retrying...")
                    continue
                else:
                    raise Exception(f"LLM call failed after {max_retries} attempts: {exc}") from exc

        # This should never be reached, but just in case
        raise Exception(f"All {max_retries} attempts failed. Last error: {last_exception}") from last_exception

    def stream(self, prompt):
        """Yield content tokens from the LLM in streaming mode.

        This helper wraps litellm.completion with ``stream=True`` and yields the
        incremental ``delta.content`` pieces as they arrive. Any ``None``
        chunks are skipped. Note that JSON parsing is disabled – callers are
        responsible for assembling the full string if needed.
        """
        messages = [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": prompt}
        ]

        stream = completion(
            model=self.model,
            messages=messages,
            temperature=self.temperature,
            stream=True,
        )

        for chunk in stream:
            # Depending on the provider, the structure of the streamed chunk may
            # vary slightly. We follow the OpenAI-style delta format which is
            # what litellm normalises to.
            delta = chunk["choices"][0].get("delta", {})
            token = delta.get("content")
            if token:
                yield token

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
