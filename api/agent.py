from litellm import completion
import json

class Agent:
    def __init__(self, model: str = "ollama/mistral", system_prompt: str = "", json_output: bool = True, temperature: float = 0.8):
        self.model = model
        self.system_prompt = system_prompt
        self.json_output = json_output
        self.temperature = temperature

    def call(self, prompt, max_retries=3) -> str:
        print("Using model: ", self.model)
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

        print("Streaming with model: ", self.model)
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

    def process_stream(self, prompt: str, thinking_model: bool):
        """Yield tuples (event_type, data) from a streaming call.

        event_type is one of:
          - "token": regular content token (data=str)
          - "thinking": thinking status changed (data=True/False)

        The method also assembles and returns the full reply text once the
        stream ends via StopIteration value.
        """
        stream = completion(
            model=self.model,
            messages=[
                {"role": "system", "content": self.system_prompt},
                {"role": "user", "content": prompt},
            ],
            temperature=self.temperature,
            stream=True,
        )

        page_buffer = ""
        token_buffer = ""
        in_thinking_section = False
        in_answer_section = False

        token_queue = []

        for chunk in stream:
            delta = chunk["choices"][0].get("delta", {})
            token = delta.get("content")
            if not token:
                continue

            if thinking_model:
                token_buffer += token

                if "<think>" in token_buffer and not in_thinking_section:
                    in_thinking_section = True
                    token_buffer = token_buffer.replace("<think>", "", 1)
                    yield ("thinking", True)
                    token_queue.clear()
                    continue

                if "</think>" in token_buffer and in_thinking_section:
                    in_thinking_section = False
                    token_buffer = token_buffer.replace("</think>", "", 1)
                    yield ("thinking", False)
                    token_queue.clear()
                    continue

                if "<answer>" in token_buffer and not in_answer_section:
                    in_answer_section = True
                    token_buffer = token_buffer.replace("<answer>", "", 1)
                    token_queue.clear()
                    continue

                if "</answer>" in token_buffer and in_answer_section:
                    in_answer_section = False
                    token_buffer = token_buffer.replace("</answer>", "", 1)
                    token_queue.clear()
                    continue

                if in_thinking_section:
                    # skip sending thinking tokens
                    continue
                else:
                    page_buffer += token
                    # Delay sending tokens slightly to avoid partial tag leaks
                    token_queue.append(token)
                    if len(token_queue) >= 3:
                        yield ("token", token_queue.pop(0))
            else:
                page_buffer += token
                yield ("token", token)

        # flush remaining queue
        for t in token_queue:
            yield ("token", t)

        # Clean tags from final text
        if thinking_model:
            page_buffer = page_buffer.replace("<think>", "").replace("</think>", "")
            page_buffer = page_buffer.replace("<answer>", "").replace("</answer>", "")

        return page_buffer.strip()

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
