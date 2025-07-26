# Prompt Management System

This directory contains the default prompt templates that are used to generate the actual prompt files.

## Structure

- `story/` - Default story generation prompts
- `chat/` - Default chat/persona prompts

## How it works

1. **Defaults**: This directory contains all the prompt templates that are version controlled
2. **Auto-generation**: When the application starts, if a prompt file doesn't exist in `data/`, it's automatically generated from the corresponding default here
3. **Customization**: You can modify the actual prompt files in `data/story/prompts/` or `data/chat/prompts/` without committing changes to git
4. **Reset**: Use the utility functions to regenerate all prompts from defaults

## Available Prompts

### Story Prompts (`story/`)
- `page_generation.md` - Instructions for generating story pages
- `choices_generation.md` - Instructions for generating reader choices
- `stream_page_generation.md` - Instructions for streaming page generation
- `page_continuation.md` - Instructions for continuing the story
- `page_with_idea.md` - Instructions for starting with an initial idea
- `page_with_choice.md` - Instructions for continuing based on a choice
- `choices_prompt.md` - Template for choices generation prompt
- `summary_analysis.md` - Instructions for analyzing story content
- `summary_with_json.md` - JSON output format for summaries
- `summary_context.md` - Template for including summary context
- `summary.md` - Instructions for summary generation

### Chat Prompts (`chat/`)
- `persona_base.md` - Base instructions for persona chat
- `persona_template.md` - Template for persona-specific instructions

## Usage

### API
```bash
# Regenerate all prompts from defaults
curl -X POST http://localhost:8000/api/prompts/regenerate
```

## Customization

1. **Modify defaults**: Edit files in this directory and commit changes
2. **Customize locally**: Edit the actual prompt files in `data/` for local testing
3. **Reset to defaults**: Use the regenerate function to reset all prompts to their defaults

## Template Variables

Some prompts use template variables that are replaced at runtime:

- `{initial_idea}` - The initial story idea
- `{choice}` - The reader's choice
- `{page_text}` - The current page text
- `{story_content}` - All story content
- `{current_summary}` - Current story summary
- `{summary_text}` - Summary text for context
- `{name}` - Persona name
- `{description}` - Persona description
- `{traits}` - Persona traits
