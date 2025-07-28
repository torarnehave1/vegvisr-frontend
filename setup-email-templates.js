/**
 * Email Template Database Setup Script
 * This script adds the email templates to the Knowledge Graph template database
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Template data
const emailTemplates = [
  {
    file: 'basic-chat-invitation-template.json',
    endpoint: 'https://knowledge.vegvisr.org/addTemplate',
  },
  {
    file: 'project-update-notification-template.json',
    endpoint: 'https://knowledge.vegvisr.org/addTemplate',
  },
]

async function addEmailTemplates() {
  console.log('🚀 Starting Email Template Database Setup...\n')

  for (const template of emailTemplates) {
    try {
      console.log(`📧 Processing: ${template.file}`)

      // Read template file
      const templatePath = path.join(__dirname, 'templates', template.file)
      const templateData = JSON.parse(fs.readFileSync(templatePath, 'utf8'))

      console.log(`   Template Name: ${templateData.name}`)
      console.log(`   Template ID: ${templateData.id}`)
      console.log(`   Category: ${templateData.category}`)

      // Prepare data for database
      const dbData = {
        name: templateData.name,
        nodes: JSON.stringify(templateData.nodes),
        edges: JSON.stringify(templateData.edges),
        category: templateData.category,
        type: templateData.type,
      }

      // Add to database
      const response = await fetch(template.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EmailTemplateSetup/1.0',
        },
        body: JSON.stringify(dbData),
      })

      if (response.ok) {
        const result = await response.json()
        console.log(`   ✅ Success: ${result.message || 'Template added successfully'}`)
      } else {
        const errorText = await response.text()
        console.log(`   ❌ Error: ${response.status} - ${errorText}`)
      }

      console.log('') // Empty line for readability
    } catch (error) {
      console.error(`   ❌ Error processing ${template.file}:`, error.message)
      console.log('')
    }
  }

  console.log('🎉 Email Template Setup Complete!')
  console.log('\n📋 Next Steps:')
  console.log('1. Verify templates appear in GNewTemplateSidebar')
  console.log('2. Test email template node creation')
  console.log('3. Test email sending functionality')
}

// Run setup
addEmailTemplates().catch(console.error)

export { addEmailTemplates, emailTemplates }
