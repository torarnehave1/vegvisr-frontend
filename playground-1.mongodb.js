use('slowyounet')

// Search for documents in the current collection.
db.getCollection('apicalllogs').find({}).sort({ createdAt: -1 }).limit(1)
