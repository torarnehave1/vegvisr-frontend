# `/generate-worker-ai` Endpoint Documentation

## Overview

The `/generate-worker-ai` endpoint in `dev-worker/index.js` generates Cloudflare Worker JavaScript code using Cloudflare Workers AI (Meta Llama 3.1 8B Instruct model). It is designed for users who want to create new Worker scripts by providing a prompt and optional code examples.

---

## Endpoint Details

- **Method:** POST
- **Path:** `/generate-worker-ai`

### Request Body Parameters

| Parameter          | Type   | Required | Description                                              |
| ------------------ | ------ | -------- | -------------------------------------------------------- |
| `prompt`           | string | Yes      | The main user instruction for the worker to generate.    |
| `selectedExamples` | array  | No       | Code examples to provide context for the AI.             |
| `userPrompt`       | string | No       | Additional user prompt, often the original user request. |
| `workingExample`   | string | No       | A working code example to guide the AI.                  |

#### Example Request

```json
{
  "prompt": "Create a worker that fetches images from Pexels API.",
  "selectedExamples": [
    {
      "title": "Basic Worker",
      "language": "js",
      "description": "Simple fetch example",
      "code": "..."
    }
  ],
  "userPrompt": "I want a Pexels image search worker.",
  "workingExample": "export default { async fetch(request, env, ctx) { ... } }"
}
```

---

## Special Behaviors

- If the prompt or userPrompt mentions "pexels", a specific Pexels API worker example is used as a template.
- The AI is instructed to:
  - Always use the `export default { async fetch(request, env, ctx) { ... } }` format.
  - Always pass both `request` and `env` to helper functions.
  - Always include CORS handling, try-catch error handling, and a `/debug` endpoint.
  - Never use import statements or the old `addEventListener` format.
  - For Pexels, use `env.PEXELS_API_KEY` directly (no "Bearer" prefix), and support both `query` and `q` parameters.

---

## AI Model

- Uses Cloudflare Workers AI: `@cf/meta/llama-3.1-8b-instruct`
- Max tokens: 3000
- Temperature: 0.3 (for consistent code generation)

---

## Response Structure

Returns a JSON object with:

- `code`: The generated JavaScript code (cleaned and validated).
- `model`: The AI model used.
- `validation`: Object with validation results (structure, fetch function, debug endpoint, syntax).
- `usedCloudflareAI`: Boolean flag.
- `debug`: Additional debug info (lengths, first chars, flags).
- `success`: true/false.

#### Example Response

```json
{
  "success": true,
  "code": "export default { async fetch(request, env, ctx) { ... } }",
  "model": "cloudflare-ai-llama-3.1-8b",
  "validation": {
    "isValid": true,
    "errors": [],
    "warnings": [],
    "score": 100
  },
  "usedCloudflareAI": true,
  "debug": {
    "originalLength": 1234,
    "cleanedLength": 1200,
    "firstChars": "export default { ...",
    "isPexelsRequest": true,
    "syntaxValid": true,
    "syntaxError": null
  }
}
```

---

## Error Handling

- Returns clear error messages for missing parameters, AI binding issues, or generation failures.
- If the AI output is invalid, falls back to a working example.
- All errors are returned as JSON with descriptive messages and details.

---

## Usage Notes

- This endpoint is intended for advanced users and developers who want to generate Cloudflare Worker code programmatically.
- The generated code follows strict patterns for compatibility and maintainability.
- For Pexels API requests, ensure the `PEXELS_API_KEY` is set in the environment.
- Always review the generated code and validation results before deploying.

---

## File Reference

- **Source:** `dev-worker/index.js`
- **Endpoint:** `/generate-worker-ai`
