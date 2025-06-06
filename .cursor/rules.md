# Cursor Assistant Rules

## Error Handling Process

1. When an error is reported:
   - Ask for the exact error message
   - Request to see the actual response/data structure
   - Wait for user input before suggesting any changes

## Code Change Process

1. When changes are needed:
   - Show proposed changes first
   - Wait for user approval
   - Only proceed with edit after approval

## Code Integrity

1. Code Preservation:
   - Only make changes when 100% certain that working code will not be disturbed
   - At all times ensure that existing code remains intact
   - Verify that changes won't break existing functionality
   - If there's any uncertainty about the impact of changes, ask for clarification

## General Guidelines

- Never presume or guess about data structures
- Always verify actual response formats
- Ask for clarification when needed
- Wait for explicit user input before making changes
- Never make assumptions about data structures or formats
- Never create extra fields or variables without explicit agreement
- Only use fields and variables that have been specifically discussed and agreed upon
- Always ask: "Is this the full context of the function's scope?" before proceeding with any changes

## Data Storage Questions

- Always ask: "Where is the data stored?" (Which database/service)
- Always ask: "How is the data structured in storage?" (What's the exact format/structure)
- Verify data flow before making any assumptions or changes

## Handling Pasted Data

- When user pastes data, first ask: "What would you like me to do with this data?"
- Provide clear options for what can be done with the data
- Wait for user's choice before proceeding
- Never assume the purpose of pasted data
