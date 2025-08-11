#!/usr/bin/env node

/**
 * Node.js Test Script for GraphTemplates API
 * Tests fetching content from the graphTemplates database table
 *
 * Usage: node test-graph-templates.js
 */

import https from 'https';
import util from 'util';
import process from 'process';

// API Configuration
const API_ENDPOINTS = {
  GENERAL_TEMPLATES: 'https://knowledge.vegvisr.org/getTemplates',
  AI_TEMPLATES: 'https://knowledge.vegvisr.org/getAITemplates'
};

// ANSI color codes for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

/**
 * Make HTTP request with Promise wrapper
 */
function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': 'GraphTemplates-Test-Script/1.0'
      },
      ...options
    }, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            data: parsedData
          });
        } catch (error) {
          resolve({
            status: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            data: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

/**
 * Print formatted section header
 */
function printHeader(title) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}${colors.reset}`);
  console.log(`${colors.cyan}${colors.bright} ${title} ${colors.reset}`);
  console.log(`${colors.cyan}${'='.repeat(60)}${colors.reset}\n`);
}

/**
 * Print formatted results
 */
function printResults(title, data) {
  console.log(`${colors.yellow}${colors.bright}${title}:${colors.reset}`);

  if (typeof data === 'object') {
    console.log(util.inspect(data, {
      colors: true,
      depth: null,
      maxArrayLength: null,
      compact: false
    }));
  } else {
    console.log(data);
  }
  console.log();
}

/**
 * Analyze template structure
 */
function analyzeTemplate(template) {
  const analysis = {
    id: template.id || 'No ID',
    name: template.name || 'No Name',
    category: template.category || 'No Category',
    hasNodes: false,
    nodeCount: 0,
    nodeTypes: [],
    hasEdges: false,
    edgeCount: 0,
    hasAIInstructions: !!template.ai_instructions,
    createdAt: template.created_at || 'Unknown',
    updatedAt: template.updated_at || 'Unknown'
  };

  // Parse nodes if present
  if (template.nodes) {
    try {
      const nodes = typeof template.nodes === 'string'
        ? JSON.parse(template.nodes)
        : template.nodes;

      if (Array.isArray(nodes)) {
        analysis.hasNodes = true;
        analysis.nodeCount = nodes.length;
        analysis.nodeTypes = [...new Set(nodes.map(node => node.type).filter(Boolean))];
      }
    } catch (error) {
      analysis.nodeParseError = error.message;
    }
  }

  // Parse edges if present
  if (template.edges) {
    try {
      const edges = typeof template.edges === 'string'
        ? JSON.parse(template.edges)
        : template.edges;

      if (Array.isArray(edges)) {
        analysis.hasEdges = true;
        analysis.edgeCount = edges.length;
      }
    } catch (error) {
      analysis.edgeParseError = error.message;
    }
  }

  return analysis;
}

/**
 * Test fetching general templates
 */
async function testGeneralTemplates() {
  printHeader('TESTING GENERAL TEMPLATES ENDPOINT');

  try {
    console.log(`${colors.blue}Fetching from: ${API_ENDPOINTS.GENERAL_TEMPLATES}${colors.reset}`);

    const response = await makeRequest(API_ENDPOINTS.GENERAL_TEMPLATES);

    printResults('Response Status', {
      status: response.status,
      statusMessage: response.statusMessage
    });

    if (response.status === 200) {
      const templates = response.data;

      if (Array.isArray(templates)) {
        console.log(`${colors.green}✅ Successfully fetched ${templates.length} templates${colors.reset}\n`);

        // Analyze each template
        templates.forEach((template, index) => {
          const analysis = analyzeTemplate(template);
          console.log(`${colors.magenta}Template ${index + 1}: ${analysis.name}${colors.reset}`);
          console.log(`  ID: ${analysis.id}`);
          console.log(`  Category: ${analysis.category}`);
          console.log(`  Nodes: ${analysis.nodeCount} (${analysis.nodeTypes.join(', ')})`);
          console.log(`  Edges: ${analysis.edgeCount}`);
          console.log(`  AI Instructions: ${analysis.hasAIInstructions ? 'Yes' : 'No'}`);
          console.log(`  Created: ${analysis.createdAt}`);
          console.log('');
        });

        // Look for image-analysis template
        const imageAnalysisTemplate = templates.find(t =>
          t.name?.toLowerCase().includes('image') &&
          t.name?.toLowerCase().includes('analysis')
        );

        if (imageAnalysisTemplate) {
          printResults('🔍 IMAGE ANALYSIS TEMPLATE FOUND', imageAnalysisTemplate);
        } else {
          console.log(`${colors.yellow}⚠️  Image Analysis template not found in general templates${colors.reset}\n`);
        }

      } else if (templates.results && Array.isArray(templates.results)) {
        const templateList = templates.results;
        console.log(`${colors.green}✅ Successfully fetched ${templateList.length} templates (results format)${colors.reset}\n`);

        templateList.forEach((template, index) => {
          const analysis = analyzeTemplate(template);
          console.log(`${colors.magenta}Template ${index + 1}: ${analysis.name}${colors.reset}`);
          console.log(`  ID: ${analysis.id}`);
          console.log(`  Category: ${analysis.category}`);
          console.log(`  Nodes: ${analysis.nodeCount} (${analysis.nodeTypes.join(', ')})`);
          console.log(`  Edges: ${analysis.edgeCount}`);
          console.log(`  AI Instructions: ${analysis.hasAIInstructions ? 'Yes' : 'No'}`);
          console.log('');
        });
      } else {
        printResults('Unexpected Response Format', response.data);
      }

    } else {
      console.log(`${colors.red}❌ Request failed with status ${response.status}${colors.reset}`);
      printResults('Error Response', response.data);
    }

  } catch (error) {
    console.log(`${colors.red}❌ Error testing general templates: ${error.message}${colors.reset}`);
  }
}

/**
 * Test fetching AI templates
 */
async function testAITemplates() {
  printHeader('TESTING AI TEMPLATES ENDPOINT');

  try {
    console.log(`${colors.blue}Fetching from: ${API_ENDPOINTS.AI_TEMPLATES}${colors.reset}`);

    const response = await makeRequest(API_ENDPOINTS.AI_TEMPLATES);

    printResults('Response Status', {
      status: response.status,
      statusMessage: response.statusMessage
    });

    if (response.status === 200) {
      const data = response.data;

      if (data.results && Array.isArray(data.results)) {
        const templates = data.results;
        console.log(`${colors.green}✅ Successfully fetched ${templates.length} AI templates${colors.reset}\n`);

        // Analyze each template
        templates.forEach((template, index) => {
          const analysis = analyzeTemplate(template);
          console.log(`${colors.magenta}AI Template ${index + 1}: ${analysis.name}${colors.reset}`);
          console.log(`  ID: ${analysis.id}`);
          console.log(`  Category: ${analysis.category}`);
          console.log(`  Nodes: ${analysis.nodeCount} (${analysis.nodeTypes.join(', ')})`);
          console.log(`  Edges: ${analysis.edgeCount}`);
          console.log(`  AI Instructions: ${analysis.hasAIInstructions ? 'Yes' : 'No'}`);
          console.log('');
        });

        // Look for image-analysis template
        const imageAnalysisTemplate = templates.find(t =>
          t.name?.toLowerCase().includes('image') &&
          t.name?.toLowerCase().includes('analysis')
        );

        if (imageAnalysisTemplate) {
          printResults('🔍 IMAGE ANALYSIS TEMPLATE FOUND (AI)', imageAnalysisTemplate);

          // Deep dive into the image analysis template
          if (imageAnalysisTemplate.ai_instructions) {
            try {
              const aiInstructions = typeof imageAnalysisTemplate.ai_instructions === 'string'
                ? JSON.parse(imageAnalysisTemplate.ai_instructions)
                : imageAnalysisTemplate.ai_instructions;

              printResults('AI Instructions Analysis', aiInstructions);
            } catch (error) {
              console.log(`${colors.yellow}⚠️  Could not parse AI instructions: ${error.message}${colors.reset}`);
            }
          }
        } else {
          console.log(`${colors.yellow}⚠️  Image Analysis template not found in AI templates${colors.reset}\n`);
        }

      } else {
        printResults('Unexpected AI Templates Response Format', data);
      }

    } else {
      console.log(`${colors.red}❌ AI Templates request failed with status ${response.status}${colors.reset}`);
      printResults('Error Response', response.data);
    }

  } catch (error) {
    console.log(`${colors.red}❌ Error testing AI templates: ${error.message}${colors.reset}`);
  }
}

/**
 * Generate summary report
 */
function generateSummary() {
  printHeader('GRAPHTEMPLATES TEST SUMMARY');

  console.log(`${colors.green}✅ Test completed successfully${colors.reset}`);
  console.log(`${colors.blue}📊 Endpoints tested:${colors.reset}`);
  console.log(`   • ${API_ENDPOINTS.GENERAL_TEMPLATES}`);
  console.log(`   • ${API_ENDPOINTS.AI_TEMPLATES}`);
  console.log(`${colors.yellow}🔍 Search criteria: Templates containing 'image' and 'analysis'${colors.reset}`);
  console.log(`${colors.magenta}📝 Analysis includes: ID, name, category, nodes, edges, AI instructions${colors.reset}`);
  console.log(`\n${colors.cyan}For detailed analysis of specific templates, check the output above.${colors.reset}`);
}

/**
 * Main test function
 */
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}GraphTemplates API Test Script${colors.reset}`);
  console.log(`${colors.cyan}Testing graphTemplates content retrieval${colors.reset}`);
  console.log(`${colors.yellow}Timestamp: ${new Date().toISOString()}${colors.reset}`);

  try {
    await testGeneralTemplates();
    await testAITemplates();
    generateSummary();

  } catch (error) {
    console.log(`${colors.red}❌ Test suite failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.log(`${colors.red}❌ Unhandled Rejection at:${colors.reset}`, promise, `${colors.red}reason:${colors.reset}`, reason);
  process.exit(1);
});

// Run the tests
runTests().then(() => {
  console.log(`\n${colors.green}${colors.bright}✅ All tests completed${colors.reset}\n`);
  process.exit(0);
}).catch((error) => {
  console.log(`\n${colors.red}${colors.bright}❌ Test suite failed: ${error.message}${colors.reset}\n`);
  process.exit(1);
});

export {
  runTests,
  testGeneralTemplates,
  testAITemplates,
  makeRequest,
  analyzeTemplate
};
