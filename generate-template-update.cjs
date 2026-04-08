#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the landing page template file
const templatePath = path.join(__dirname, '..', 'Agent-Builder', 'worker', 'landing-page-template.js');
const fileContent = fs.readFileSync(templatePath, 'utf8');

// Extract HTML content between backticks
const startMatch = fileContent.match(/export\s+const\s+\w+\s*=\s*`/);
if (!startMatch) {
  console.error('Could not find export statement');
  process.exit(1);
}

const startIdx = startMatch.index + startMatch[0].length;
const endMatch = fileContent.slice(startIdx).match(/`\s*;?\s*$/);
if (!endMatch) {
  console.error('Could not find closing backtick');
  process.exit(1);
}

const htmlContent = fileContent.slice(startIdx, startIdx + endMatch.index);
console.log('✓ Extracted HTML content');
console.log(`  Size: ${htmlContent.length} bytes`);
console.log(`  First 100 chars: ${htmlContent.substring(0, 100)}`);

// Create the update SQL
const escapedHtml = htmlContent.replace(/'/g, "''");
const nodeJson = JSON.stringify({
  type: 'html-node',
  id: 'html-tmpl-landing-page',
  label: 'Landing Page Template',
  info: htmlContent
});
const escapedNodes = nodeJson.replace(/'/g, "''");

const sql = `UPDATE graphTemplates 
SET nodes = '${escapedNodes}'
WHERE id = 'html-tmpl-landing-page';`;

console.log('\n✓ Generated SQL update statement');
console.log(`  SQL length: ${sql.length} bytes`);

// Write to file
fs.writeFileSync('/Users/torarnehave/Documents/GitHub/vegvisr-frontend/update-landing-template.sql', sql);
console.log('\n✓ Wrote to update-landing-template.sql');
