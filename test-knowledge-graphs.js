#!/usr/bin/env node

/**
 * Node.js Test Script for Knowledge Graphs API
 * Tests fetching knowledge graphs from the knowledge graph database
 *
 * Usage: node test-knowledge-graphs.js
 */

import https from 'https';
import util from 'util';
import process from 'process';

// API Configuration
const API_ENDPOINTS = {
  GET_GRAPHS: 'https://knowledge.vegvisr.org/getknowgraphs',
  GET_SINGLE_GRAPH: 'https://knowledge.vegvisr.org/getknowgraph'
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
        'User-Agent': 'KnowledgeGraphs-Test-Script/1.0'
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
    req.setTimeout(15000, () => {
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
      maxArrayLength: 10, // Limit array display for readability
      compact: false
    }));
  } else {
    console.log(data);
  }
  console.log();
}

/**
 * Analyze knowledge graph structure
 */
function analyzeGraph(graph) {
  const analysis = {
    id: graph.id || 'No ID',
    title: graph.title || graph.metadata?.title || 'No Title',
    description: graph.description || graph.metadata?.description || 'No Description',
    category: graph.category || graph.metadata?.category || 'No Category',

    // Node analysis
    hasNodes: false,
    nodeCount: 0,
    nodeTypes: [],
    visibleNodeCount: 0,

    // Edge analysis
    hasEdges: false,
    edgeCount: 0,

    // Metadata analysis
    hasMetadata: !!graph.metadata,
    metadataFields: graph.metadata ? Object.keys(graph.metadata) : [],

    // Timestamps
    createdAt: graph.created_at || graph.metadata?.created_at || 'Unknown',
    updatedAt: graph.updated_at || graph.metadata?.updated_at || 'Unknown',

    // User info
    userEmail: graph.user_email || graph.metadata?.user_email || 'Unknown',

    // Graph specific metadata
    public: graph.public || graph.metadata?.public || false,
    metaArea: graph.meta_area || graph.metadata?.meta_area || 'None'
  };

  // Analyze nodes
  if (graph.nodes && Array.isArray(graph.nodes)) {
    analysis.hasNodes = true;
    analysis.nodeCount = graph.nodes.length;
    analysis.visibleNodeCount = graph.nodes.filter(node => node.visible !== false).length;
    analysis.nodeTypes = [...new Set(graph.nodes.map(node => node.type).filter(Boolean))];
  }

  // Analyze edges
  if (graph.edges && Array.isArray(graph.edges)) {
    analysis.hasEdges = true;
    analysis.edgeCount = graph.edges.length;
  }

  return analysis;
}

/**
 * Test fetching all knowledge graphs
 */
async function testGetAllGraphs() {
  printHeader('TESTING GET ALL KNOWLEDGE GRAPHS');

  try {
    console.log(`${colors.blue}Fetching from: ${API_ENDPOINTS.GET_GRAPHS}${colors.reset}`);

    const response = await makeRequest(API_ENDPOINTS.GET_GRAPHS);

    printResults('Response Status', {
      status: response.status,
      statusMessage: response.statusMessage
    });

    if (response.status === 200) {
      const data = response.data;

      if (data.results && Array.isArray(data.results)) {
        const graphs = data.results;
        console.log(`${colors.green}✅ Successfully fetched ${graphs.length} knowledge graphs${colors.reset}\n`);

        // Summary statistics
        const stats = {
          totalGraphs: graphs.length,
          publicGraphs: graphs.filter(g => g.public).length,
          privateGraphs: graphs.filter(g => !g.public).length,
          categories: [...new Set(graphs.map(g => g.category || g.metadata?.category).filter(Boolean))],
          metaAreas: [...new Set(graphs.map(g => g.meta_area || g.metadata?.meta_area).filter(Boolean))],
          users: [...new Set(graphs.map(g => g.user_email || g.metadata?.user_email).filter(Boolean))].length,
          totalNodes: graphs.reduce((sum, g) => sum + (g.nodes?.length || 0), 0),
          totalEdges: graphs.reduce((sum, g) => sum + (g.edges?.length || 0), 0)
        };

        printResults('📊 KNOWLEDGE GRAPHS STATISTICS', stats);

        // Analyze first few graphs in detail
        console.log(`${colors.magenta}📋 GRAPH ANALYSIS (First 5 graphs):${colors.reset}\n`);

        graphs.slice(0, 5).forEach((graph, index) => {
          const analysis = analyzeGraph(graph);
          console.log(`${colors.magenta}Graph ${index + 1}: ${analysis.title}${colors.reset}`);
          console.log(`  ID: ${analysis.id}`);
          console.log(`  Description: ${analysis.description.substring(0, 100)}...`);
          console.log(`  Category: ${analysis.category}`);
          console.log(`  Meta Area: ${analysis.metaArea}`);
          console.log(`  Nodes: ${analysis.nodeCount} (${analysis.visibleNodeCount} visible)`);
          console.log(`  Node Types: [${analysis.nodeTypes.slice(0, 5).join(', ')}]`);
          console.log(`  Edges: ${analysis.edgeCount}`);
          console.log(`  Public: ${analysis.public}`);
          console.log(`  User: ${analysis.userEmail}`);
          console.log(`  Created: ${analysis.createdAt}`);
          console.log('');
        });

        if (graphs.length > 5) {
          console.log(`${colors.yellow}... and ${graphs.length - 5} more graphs${colors.reset}\n`);
        }

        return graphs; // Return graphs for further testing

      } else {
        printResults('Unexpected Response Format', data);
        return [];
      }

    } else {
      console.log(`${colors.red}❌ Request failed with status ${response.status}${colors.reset}`);
      printResults('Error Response', response.data);
      return [];
    }

  } catch (error) {
    console.log(`${colors.red}❌ Error testing knowledge graphs: ${error.message}${colors.reset}`);
    return [];
  }
}

/**
 * Test fetching specific knowledge graph
 */
async function testGetSpecificGraph(graphId) {
  printHeader(`TESTING GET SPECIFIC GRAPH: ${graphId}`);

  try {
    const url = `${API_ENDPOINTS.GET_SINGLE_GRAPH}?id=${graphId}`;
    console.log(`${colors.blue}Fetching from: ${url}${colors.reset}`);

    const response = await makeRequest(url);

    printResults('Response Status', {
      status: response.status,
      statusMessage: response.statusMessage
    });

    if (response.status === 200) {
      const graph = response.data;

      console.log(`${colors.green}✅ Successfully fetched specific knowledge graph${colors.reset}\n`);

      // Detailed analysis of the specific graph
      const analysis = analyzeGraph(graph);

      printResults('🔍 DETAILED GRAPH ANALYSIS', analysis);

      // Show sample nodes if available
      if (graph.nodes && graph.nodes.length > 0) {
        console.log(`${colors.cyan}📝 SAMPLE NODES (First 3):${colors.reset}`);
        graph.nodes.slice(0, 3).forEach((node, index) => {
          console.log(`${colors.cyan}Node ${index + 1}:${colors.reset}`);
          console.log(`  ID: ${node.id}`);
          console.log(`  Label: ${node.label}`);
          console.log(`  Type: ${node.type || 'No type'}`);
          console.log(`  Color: ${node.color || 'No color'}`);
          console.log(`  Visible: ${node.visible !== false ? 'Yes' : 'No'}`);
          console.log(`  Info: ${(node.info || 'No info').substring(0, 100)}...`);
          console.log('');
        });
      }

      // Show sample edges if available
      if (graph.edges && graph.edges.length > 0) {
        console.log(`${colors.cyan}🔗 SAMPLE EDGES (First 3):${colors.reset}`);
        graph.edges.slice(0, 3).forEach((edge, index) => {
          console.log(`${colors.cyan}Edge ${index + 1}:${colors.reset}`);
          console.log(`  Source: ${edge.source}`);
          console.log(`  Target: ${edge.target}`);
          console.log(`  ID: ${edge.id || 'No ID'}`);
          console.log('');
        });
      }

      // Show metadata details
      if (graph.metadata) {
        printResults('📊 METADATA DETAILS', graph.metadata);
      }

      return graph;

    } else {
      console.log(`${colors.red}❌ Request failed with status ${response.status}${colors.reset}`);
      printResults('Error Response', response.data);
      return null;
    }

  } catch (error) {
    console.log(`${colors.red}❌ Error testing specific graph: ${error.message}${colors.reset}`);
    return null;
  }
}

/**
 * Search for graphs by criteria
 */
function searchGraphs(graphs, criteria) {
  const results = graphs.filter(graph => {
    const analysis = analyzeGraph(graph);

    // Search by title, description, category, or meta area
    const searchText = [
      analysis.title,
      analysis.description,
      analysis.category,
      analysis.metaArea,
      ...analysis.nodeTypes
    ].join(' ').toLowerCase();

    return criteria.some(criterion =>
      searchText.includes(criterion.toLowerCase())
    );
  });

  return results;
}

/**
 * Generate comprehensive summary
 */
function generateSummary(allGraphs, sampleGraph) {
  printHeader('KNOWLEDGE GRAPHS TEST SUMMARY');

  console.log(`${colors.green}✅ Test completed successfully${colors.reset}`);
  console.log(`${colors.blue}📊 Endpoints tested:${colors.reset}`);
  console.log(`   • ${API_ENDPOINTS.GET_GRAPHS}`);
  console.log(`   • ${API_ENDPOINTS.GET_SINGLE_GRAPH}`);

  if (allGraphs.length > 0) {
    console.log(`${colors.green}📈 Summary Statistics:${colors.reset}`);
    console.log(`   • Total Knowledge Graphs: ${allGraphs.length}`);
    console.log(`   • Total Nodes Across All Graphs: ${allGraphs.reduce((sum, g) => sum + (g.nodes?.length || 0), 0)}`);
    console.log(`   • Total Edges Across All Graphs: ${allGraphs.reduce((sum, g) => sum + (g.edges?.length || 0), 0)}`);
    console.log(`   • Unique Categories: ${[...new Set(allGraphs.map(g => g.category || g.metadata?.category).filter(Boolean))].length}`);
    console.log(`   • Unique Users: ${[...new Set(allGraphs.map(g => g.user_email || g.metadata?.user_email).filter(Boolean))].length}`);

    // Search examples
    const searchCriteria = ['image', 'analysis', 'ai', 'chart', 'test'];
    searchCriteria.forEach(criterion => {
      const results = searchGraphs(allGraphs, [criterion]);
      if (results.length > 0) {
        console.log(`   • Graphs containing "${criterion}": ${results.length}`);
      }
    });
  }

  if (sampleGraph) {
    const analysis = analyzeGraph(sampleGraph);
    console.log(`${colors.yellow}🔍 Sample Graph Analysis:${colors.reset}`);
    console.log(`   • Sample: ${analysis.title} (${analysis.id})`);
    console.log(`   • Nodes: ${analysis.nodeCount}, Edges: ${analysis.edgeCount}`);
    console.log(`   • Node Types: [${analysis.nodeTypes.slice(0, 3).join(', ')}]`);
  }

  console.log(`\n${colors.cyan}For detailed analysis of specific graphs, check the output above.${colors.reset}`);
}

/**
 * Main test function
 */
async function runTests() {
  console.log(`${colors.bright}${colors.cyan}Knowledge Graphs API Test Script${colors.reset}`);
  console.log(`${colors.cyan}Testing knowledge graphs content retrieval${colors.reset}`);
  console.log(`${colors.yellow}Timestamp: ${new Date().toISOString()}${colors.reset}`);

  try {
    // Step 1: Get all knowledge graphs
    const allGraphs = await testGetAllGraphs();

    // Step 2: Test specific graph if graphs are available
    let sampleGraph = null;
    if (allGraphs.length > 0) {
      // Test the first available graph
      const firstGraphId = allGraphs[0].id;
      sampleGraph = await testGetSpecificGraph(firstGraphId);
    } else {
      console.log(`${colors.yellow}⚠️  No graphs available for individual testing${colors.reset}`);
    }

    // Step 3: Generate summary
    generateSummary(allGraphs, sampleGraph);

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
  console.log(`\n${colors.green}${colors.bright}✅ All knowledge graph tests completed${colors.reset}\n`);
  process.exit(0);
}).catch((error) => {
  console.log(`\n${colors.red}${colors.bright}❌ Knowledge graph test suite failed: ${error.message}${colors.reset}\n`);
  process.exit(1);
});

export {
  runTests,
  testGetAllGraphs,
  testGetSpecificGraph,
  makeRequest,
  analyzeGraph,
  searchGraphs
};
