/* global use, db */
// MongoDB Playground
// Use Ctrl+Space inside a snippet or a string literal to trigger completions.

// The current database to use.
use('slowyounet')

// Search for documents in the current collection.
db.getCollection('apicalllogs')

  .find({})
  .sort({ createdAt: -1 })
  .limit(1)
