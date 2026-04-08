#!/usr/bin/env node

/**
 * Extract HTML templates from Agent-Builder and generate seed SQL INSERT statements
 * Usage: node extract-html-templates.js > seed-html-templates.sql
 */

const fs = require('fs');
const path = require('path');

const AGENT_BUILDER_PATH = path.join(__dirname, '..', 'Agent-Builder', 'worker');

const TEMPLATES = [
  { file: 'editable-template.js', id: 'html-tmpl-editable-page', slugName: 'Editable Page (HTML)' },
  { file: 'landing-page-template.js', id: 'html-tmpl-landing-page', slugName: 'Landing Page (HTML)' },
  { file: 'theme-builder-template.js', id: 'html-tmpl-theme-builder', slugName: 'Theme Builder (HTML)' },
  { file: 'agent-chat-template.js', id: 'html-tmpl-agent-chat', slugName: 'Agent Chat (HTML)' },
];

function extractTemplateString(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Find the opening backtick after export const TEMPLATE_NAME = `
  const startMatch = content.match(/export\s+const\s+\w+\s*=\s*`/);
  if (!startMatch) {
    throw new Error(`Could not find export statement in ${filePath}`);
  }
  
  const startIdx = startMatch.index + startMatch[0].length;
  
  // Find the closing backtick (with optional semicolon after)
  const endMatch = content.slice(startIdx).match(/`\s*;?\s*$/);
  if (!endMatch) {
    throw new Error(`Could not find closing backtick in ${filePath}`);
  }
  
  const endIdx = startIdx + endMatch.index;
  return content.slice(startIdx, endIdx);
}

function escapeSqlString(str) {
  // Escape single quotes for SQL
  return str.replace(/'/g, "''");
}

console.log(`-- Seed HTML templates to graphTemplates table
-- Generated: ${new Date().toISOString()}
-- This seeds the 4 hardcoded Agent-Builder HTML templates into the database
-- with gemini=1 so external apps can discover and use them
`);

TEMPLATES.forEach((template) => {
  const filePath = path.join(AGENT_BUILDER_PATH, template.file);
  
  try {
    const htmlContent = extractTemplateString(filePath);
    
    // Create a minimal node structure with the HTML
    const nodeData = {
      type: 'html-node',
      id: template.id,
      label: template.slugName,
      info: htmlContent,
    };
    
    const nodesJson = JSON.stringify([nodeData]);
    const aiInstructions = JSON.stringify({
      placeholders: {
        '{{TITLE}}': 'Page title',
        '{{DESCRIPTION}}': 'Page description',
        '{{FOOTER_TEXT}}': 'Footer content',
        '{{GRAPH_ID_DEFAULT}}': 'Fallback graph ID',
      },
      description: `Agent-Builder ${template.slugName} template with built-in versioning`,
    });
    
    const escapedNodes = escapeSqlString(nodesJson);
    const escapedAi = escapeSqlString(aiInstructions);
    
    const sql = `
INSERT INTO graphTemplates 
  (id, name, nodes, edges, category, ai_instructions, gemini, created_at, updated_at)
VALUES 
  (
    '${template.id}',
    '${template.slugName}',
    '${escapedNodes}',
    '[]',
    'HTML Templates',
    '${escapedAi}',
    1,
    datetime('now'),
    datetime('now')
  );
`;
    
    console.log(sql);
  } catch (error) {
    console.error(`ERROR processing ${template.file}:`, error.message);
    process.exit(1);
  }
});

console.log(`
-- Verify insertion
SELECT id, name, gemini, category FROM graphTemplates WHERE gemini = 1 ORDER BY name;
`);
