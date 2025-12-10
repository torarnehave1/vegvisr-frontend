/**
 * Migration Script: MongoDB → D1
 * Fetches all documents from MongoDB and generates SQL INSERT statements
 * Usage: node migrate-to-d1.js
 */

import { MongoClient } from 'mongodb'
import fs from 'fs'
import process from 'process'

const MONGODB_URI = process.env.MONGODB_URI
const DB_NAME = 'slowyounet'
const COLLECTION = 'mdfiles'

async function migrate() {
  if (!MONGODB_URI) {
    console.error('❌ MONGODB_URI environment variable not set')
    console.log('Set it with: export MONGODB_URI="mongodb+srv://..."')
    process.exit(1)
  }

  const client = new MongoClient(MONGODB_URI)
  
  try {
    console.log('🔌 Connecting to MongoDB...')
    await client.connect()
    
    const db = client.db(DB_NAME)
    const collection = db.collection(COLLECTION)
    
    console.log('📥 Fetching all documents...')
    const docs = await collection.find({}).toArray()
    console.log(`✅ Found ${docs.length} documents`)
    
    // Generate SQL INSERT statements
    const inserts = docs.map(doc => {
      const id = doc._id.toString()
      const title = (doc.title || 'Untitled').replace(/'/g, "''")
      const content = (doc.content || '').replace(/'/g, "''")
      const userId = doc.User_id ? doc.User_id.toString() : null
      const locked = doc.locked ? 1 : 0
      const published = doc.published ? 1 : 0
      const tags = JSON.stringify(doc.tags || []).replace(/'/g, "''")
      const part = doc.part || 1
      const totalParts = doc.totalParts || 1
      const connectedAssistant = doc.connectedAssistant ? `'${doc.connectedAssistant}'` : 'NULL'
      const url = doc.URL ? `'${doc.URL}'` : 'NULL'
      const createdAt = doc.createdAt ? `'${new Date(doc.createdAt).toISOString()}'` : 'NULL'
      const updatedAt = doc.updatedAt ? `'${new Date(doc.updatedAt).toISOString()}'` : 'NULL'
      const publishedAt = doc.publishedAt ? `'${new Date(doc.publishedAt).toISOString()}'` : 'NULL'
      
      return `INSERT INTO documents (id, title, content, user_id, locked, published, tags, part, total_parts, connected_assistant, url, created_at, updated_at, published_at) VALUES ('${id}', '${title}', '${content}', ${userId ? `'${userId}'` : 'NULL'}, ${locked}, ${published}, '${tags}', ${part}, ${totalParts}, ${connectedAssistant}, ${url}, ${createdAt}, ${updatedAt}, ${publishedAt});`
    })
    
    // Write to file
    const outputPath = './migration-inserts.sql'
    fs.writeFileSync(outputPath, inserts.join('\n\n'))
    console.log(`✅ Generated ${inserts.length} INSERT statements`)
    console.log(`📝 Saved to: ${outputPath}`)
    console.log('\n📋 Next steps:')
    console.log('1. Create D1 database: wrangler d1 create mystmkra-db')
    console.log('2. Update wrangler.toml with database binding')
    console.log('3. Run schema: wrangler d1 execute mystmkra-db --remote --file=d1-schema.sql')
    console.log('4. Run migration: wrangler d1 execute mystmkra-db --remote --file=migration-inserts.sql')
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await client.close()
  }
}

migrate()
