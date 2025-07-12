class ImageGenerator:
    def __init__(self):
        pass

    def generate(self, prompt: str) -> str:
        """Generate an illustration using Flux (placeholder).

        Returns a URL (or base64 string) that the frontend can display. If image generation
        fails, returns an empty string.
        """

        try:
            # TODO: Adjust the call below according to the actual Flux API.
            return prompt
        except Exception as exc:  # pylint: disable=broad-except
            # Fallback: no image
            print("[warn] Could not generate image:", exc)
            return ""
