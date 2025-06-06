UPDATE graphTemplates 
SET ai_instructions = '{
  "format": "YYYY-MM-DD: @username - Brief summary",
  "requirements": ["date", "username", "summary"],
  "validation": {
    "date": {
      "pattern": "\\d{4}-\\d{2}-\\d{2}",
      "message": "Date must be in YYYY-MM-DD format"
    },
    "username": {
      "pattern": "@\\w+",
      "message": "Username must be prefixed with @"
    },
    "summary": {
      "minLength": 10,
      "message": "Summary must be at least 10 characters"
    }
  }
}'
WHERE json_extract(nodes, '$[0].type') = 'worknote'; 