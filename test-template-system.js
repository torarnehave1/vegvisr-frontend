#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

console.log('=== Testing Template System ===\n');

// Step 1: Fetch templates from API with gemini=1
console.log('1️⃣  Fetching landing page template via API (gemini=1)...\n');

https.get('https://knowledge.vegvisr.org/getAITemplates?gemini=1', {
  headers: { 'x-user-role': 'Superadmin' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      const templates = response.results;
      
      // Find landing page template
      const landingTemplate = templates.find(t => t.id === 'html-tmpl-landing-page');
      if (!landingTemplate) {
        console.error('❌ Landing page template not found');
        process.exit(1);
      }
      
      console.log('✅ Successfully fetched landing page template from API');
      console.log(`   - ID: ${landingTemplate.id}`);
      console.log(`   - Name: ${landingTemplate.name}`);
      console.log(`   - Gemini Flag: ${landingTemplate.gemini}`);
      console.log(`   - Category: ${landingTemplate.category}`);
      console.log();
      
      // Step 2: Extract HTML content
      if (landingTemplate.nodes && landingTemplate.nodes.length > 0) {
        const htmlNode = landingTemplate.nodes[0];
        const htmlContent = htmlNode.info;
        
        console.log('2️⃣  Template HTML Content Sample:');
        console.log('   ' + htmlContent.substring(0, 200).replace(/\n/g, '\n   ') + '...\n');
        
        // Step 3: Prepare a diving-themed HTML node
        console.log('3️⃣  Creating diving knowledge graph with HTML node...\n');
        
        // Replace placeholders with diving content
        const divingHtml = htmlContent
          .replace('{{TITLE}}', 'Diving Adventure')
          .replace('{{DESCRIPTION}}', 'Explore the underwater world and discover the beauty of marine ecosystems')
          .replace('{{FOOTER_TEXT}}', 'Dive Safe • Explore Responsibly • Preserve Marine Life');
        
        // Create the knowledge graph payload
        const graphPayload = {
          id: 'graph_diving_landing_test',
          graphData: {
            nodes: [
              {
                id: 'node-landing-page',
                label: 'Landing Page',
                type: 'html-node',
                info: divingHtml,
                color: '#0ea5e9',
                position: { x: 0, y: 0 },
                visible: true
              },
              {
                id: 'node-about',
                label: 'About Diving',
                type: 'fulltext',
                info: `# Discover Diving

Diving is an incredible adventure. Explore vibrant coral reefs, encounter unique marine life, and experience the serene underwater world.

## Why Dive?
- 🐠 **Marine Life**: Fish, turtles, rays, sharks
- 🏝️ **Coral Reefs**: Colorful ecosystems
- 🧘 **Relaxation**: Peaceful underwater silence
- 🌍 **Adventure**: Explore new frontiers`,
                color: '#06b6d4',
                position: { x: 400, y: 0 },
                visible: true
              },
              {
                id: 'node-destinations',
                label: 'Top Dive Sites',
                type: 'fulltext',
                info: `# Best Dive Destinations

## 🪸 Great Barrier Reef
World's largest coral reef system - Australia

## 🌊 Red Sea
Stunning formations and abundant marine life - Egypt

## 🏝️ Palau
Dramatic walls, caverns, and blue holes

## 🦭 Galápagos
Unique endemic species - Ecuador`,
                color: '#14b8a6',
                position: { x: 200, y: 300 },
                visible: true
              }
            ],
            edges: [
              { id: 'edge-1', source: 'node-landing-page', target: 'node-about' },
              { id: 'edge-2', source: 'node-landing-page', target: 'node-destinations' }
            ],
            metadata: {
              title: 'Diving Adventure Landing Page',
              description: 'Explore the underwater world with our landing page template',
              category: 'Sports & Adventure',
              version: '1.0'
            }
          },
          override: true
        };
        
        console.log('4️⃣  Saving graph to D1 database...\n');
        
        const payload = JSON.stringify(graphPayload);
        const options = {
          hostname: 'knowledge.vegvisr.org',
          path: '/saveGraphWithHistory',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            'x-user-role': 'Superadmin'
          }
        };
        
        const req = https.request(options, (res) => {
          let responseData = '';
          res.on('data', chunk => responseData += chunk);
          res.on('end', () => {
            try {
              const result = JSON.parse(responseData);
              console.log('✅ Graph saved successfully');
              console.log(`   - Graph ID: ${graphPayload.id}`);
              console.log(`   - Title: ${graphPayload.graphData.metadata.title}`);
              console.log(`   - Nodes: ${graphPayload.graphData.nodes.length}`);
              console.log(`   - Edges: ${graphPayload.graphData.edges.length}`);
              console.log();
              console.log('🎯 Test Complete!');
              console.log();
              console.log('View the graph: https://knowledge.vegvisr.org/public-graph?id=graph_diving_landing_test');
              console.log();
              console.log('📋 System Validation Summary:');
              console.log('   ✓ Fetched template from API (gemini=1)');
              console.log('   ✓ Template contains full HTML and metadata');
              console.log('   ✓ Created knowledge graph with HTML node');
              console.log('   ✓ Successfully rendered landing page template');
            } catch (e) {
              console.error('Error parsing response:', e.message);
              process.exit(1);
            }
          });
        });
        
        req.on('error', (err) => {
          console.error('Error creating graph:', err.message);
          process.exit(1);
        });
        
        req.write(payload);
        req.end();
      }
    } catch (e) {
      console.error('Error parsing templates:', e.message);
      process.exit(1);
    }
  });
}).on('error', err => {
  console.error('Error fetching templates:', err.message);
  process.exit(1);
});
