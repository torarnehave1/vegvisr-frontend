# Affiliate Knowledge Graph Integration Plan

## 🎯 **PROJECT OVERVIEW**

**Objective**: Integrate the affiliate system with knowledge graphs by using `graphId` as `deal_name` and implementing visual "ambassador" badges in GraphPortfolio.

**Core Concept**: Affiliat### **⚠️ Graph Deletion Handling**

#### **Problem**: What happens when a graph is deleted but affiliates still reference it?

#### **Solution Strategies**:

**1. Prevent Deletion**
```javascript
// Before deleting a graph, check for affiliates
const affiliateCount = await checkAffiliatesForGraph(graphId)
if (affiliateCount > 0) {
  throw new Error(`Cannot delete graph: ${affiliateCount} affiliates are connected to this graph`)
}
```

**2. Reassignment Process**
```javascript
// Admin interface for reassigning orphaned affiliates
{
  orphanedAffiliates: [
    { affiliateId: 'aff_123', email: 'user@example.com', deletedGraphId: 'graph_456' }
  ],
  reassignmentOptions: availableGraphs
}
```

**3. Migration API Endpoint**
```javascript
// POST /migrate-affiliates
{
  fromGraphId: 'deleted_graph_123',
  toGraphId: 'new_graph_456',
  affiliateIds: ['aff_1', 'aff_2', 'aff_3']
}
```

#### **Implementation Steps**:
- [ ] **Database Constraint**: Add referential integrity checking
- [ ] **Deletion Guard**: Prevent graph deletion if affiliates exist
- [ ] **Admin Interface**: Show orphaned affiliates dashboard
- [ ] **Migration Tool**: Bulk reassignment functionality
- [ ] **Notification System**: Alert superadmin about orphaned affiliates

---

## 🔧 **TECHNICAL SPECIFICATIONS**eals become "ambassadors" for specific knowledge graphs, creating a visual connection between affiliate marketing and graph content.

---

## 📋 **CURRENT STATE ANALYSIS**

### **✅ Existing Affiliate System**
- **Database**: `deal_name` field already implemented in `affiliates` table
- **API Support**: Both registration and invitation flows accept `dealName` parameter
- **Multi-Deal**: System supports multiple deals per affiliate
- **Default Behavior**: Falls back to "default" when no specific deal provided

### **✅ Existing GraphPortfolio Badge System**
- **System Badges**: 
  - `bg-primary` - Node count
  - `bg-secondary` - Edge count  
  - `bg-info` - Version number
  - `bg-success` - Vectorization status
- **Content Badges**:
  - `bg-success` - Categories (`#Research #Project`)
  - `bg-warning` - Meta Areas (`#AI #DataScience`)
- **Rich Metadata**: Category and metaArea fields with `#` separation pattern

### **🔄 Integration Opportunity**
- Knowledge graph `id` values can directly serve as `deal_name` values
- GraphPortfolio already has sophisticated badge display system
- Existing affiliate API endpoints can be enhanced to support graph queries

---

## 🏗️ **IMPLEMENTATION PLAN**

### **Phase 1: Backend Integration (aff-worker)**

#### **1.1 Enhanced Invitation Flow with Graph Selection**
```javascript
// POST /send-affiliate-invitation
// Enhanced to support graph-specific invitations
{
  "recipientEmail": "user@example.com",
  "recipientName": "John Doe",
  "senderName": "Admin User", 
  "dealName": "graph_1754203620085",  // Knowledge Graph ID
  "commissionType": "fixed",
  "commissionAmount": "50.00",
  "graphTitle": "AI Research Methods",  // For email template
  "graphDescription": "Advanced AI research methodologies..."  // For email context
}
```

**Implementation Steps:**
- **API Enhancement**: Store `dealName` (graphId) in invitation records (deal_name field exists)
- **Code Update**: Fix invitation creation to properly store dealName in existing deal_name column
- **Code Update**: Fix acceptance flow to retrieve and use stored deal_name from invitation
- **Email Template Update**: Include graph information in invitation emails
- **Validation**: Ensure graphId exists before sending invitation

#### **1.2 New API Endpoint - Get Affiliate Deals by Graph ID**
```javascript
// GET /affiliate-deals-by-graph?graphId={id}
// Returns all affiliate deals connected to a specific knowledge graph
```

**Implementation Details:**
- Query `affiliates` table where `deal_name = graphId`
- Return affiliate count, commission info, and deal status
- Include aggregate statistics (total affiliates, total earnings)

#### **1.2 Enhanced Registration Flow**
```javascript
// POST /register-affiliate
// Enhanced to accept graphId directly as dealName
{
  "email": "user@example.com",
  "name": "John Doe", 
  "dealName": "graph_1754203620085",  // Knowledge Graph ID
  "domain": "vegvisr.org",
  "commissionType": "fixed",
  "commissionAmount": "50.00"
}
```

#### **1.3 Graph Ambassador Status Endpoint**
```javascript
// GET /graph-ambassador-status?graphIds[]=id1&graphIds[]=id2
// Bulk check which graphs have affiliate ambassadors
```

**Response Format:**
```json
{
  "success": true,
  "ambassadorStatus": {
    "graph_1754203620085": {
      "hasAmbassadors": true,
      "affiliateCount": 5,
      "totalCommissions": "250.00",
      "topAffiliate": "john@example.com"
    },
    "graph_1754203620086": {
      "hasAmbassadors": false,
      "affiliateCount": 0
    }
  }
}
```

### **Phase 2: Frontend Integration (GraphPortfolio.vue)**

#### **2.1 Superadmin Invitation UI Enhancement**
```vue
<!-- Enhanced invitation form with required graph selection -->
<template>
  <div class="invitation-form">
    <div class="form-group">
      <label>Knowledge Graph *</label>
      <select v-model="selectedGraphId" class="form-control" required>
        <option value="">Select a knowledge graph...</option>
        <option v-for="graph in availableGraphs" :key="graph.id" :value="graph.id">
          {{ graph.metadata?.title || graph.id }} ({{ graph.nodes?.length || 0 }} nodes)
        </option>
      </select>
      <small class="text-muted">
        Every affiliate must be assigned to a specific knowledge graph
      </small>
    </div>
    <!-- Existing invitation form fields -->
  </div>
</template>
```

**Implementation Requirements:**
- **Graph API Integration**: Fetch available graphs for dropdown
- **Required Selection**: Graph selection is mandatory, no default/general option
- **Graph Validation**: Backend validates graph exists before creating invitation
- **Graph Preview**: Display basic graph info when selected
- **Email Preview**: Show how invitation email will look with graph context

#### **2.2 Affiliate Ambassador Badge Component**
```vue
<!-- New badge type for affiliate ambassadors -->
<span
  v-if="graph.ambassadorStatus?.hasAmbassadors"
  class="badge bg-gold ms-2"
  :title="`${graph.ambassadorStatus.affiliateCount} affiliate ambassadors`"
>
  💼 Ambassador ({{ graph.ambassadorStatus.affiliateCount }})
</span>
```

#### **2.2 Enhanced Badge System**
**New Badge Types:**
- **`bg-gold`** - Affiliate Ambassador indicator
- **Hover Tooltips** - Show affiliate statistics on hover
- **Click Actions** - Link to affiliate management for graph owners

#### **2.3 GraphPortfolio Integration Logic**
```javascript
// Enhanced fetchGraphs() function
const fetchGraphs = async () => {
  // 1. Fetch graphs (existing logic)
  const graphs = await fetchKnowledgeGraphs()
  
  // 2. Extract graph IDs for affiliate check
  const graphIds = graphs.map(g => g.id)
  
  // 3. Check affiliate ambassador status (NEW)
  const ambassadorStatus = await checkAmbassadorStatus(graphIds)
  
  // 4. Merge ambassador data with graph data
  graphs.forEach(graph => {
    graph.ambassadorStatus = ambassadorStatus[graph.id] || { hasAmbassadors: false }
  })
  
  return graphs
}
```

### **Phase 3: User Experience Features**

#### **3.1 Affiliate Dashboard Integration**
- **Graph Owner View**: "Manage Affiliates" button for graphs with ambassadors
- **Affiliate View**: "My Ambassador Graphs" section showing connected graphs
- **Performance Metrics**: Commission tracking per graph

#### **3.2 Social Features Integration**
- **Ambassador Profiles**: Show top affiliates in graph social feeds
- **Ambassador Reviews**: Let affiliates comment on graphs they promote
- **Ambassador Recommendations**: AI-powered graph-to-affiliate matching

#### **3.3 Discovery Features**
- **Filter by Ambassador Status**: Portfolio filter for graphs with/without ambassadors
- **Ambassador Search**: Find graphs by affiliate partner names
- **Commission Insights**: Show earning potential for graph creators

---

## � **SUPERADMIN INVITATION WORKFLOW**

### **Enhanced Invitation Process**

#### **Step 1: Graph Selection (New)**
```
1. Superadmin accesses invitation interface
2. Form displays dropdown with available knowledge graphs
3. Optional: Select specific graph for ambassador role
4. System shows graph preview (title, description, node count)
5. Commission suggestions based on graph complexity
```

#### **Step 2: Invitation Configuration**
```
1. Enter recipient details (email, name)
2. Choose commission structure
3. System auto-generates graph-aware invitation email
4. Preview email with graph context
5. Send invitation with embedded graph ID
```

#### **Step 3: Recipient Experience**
```
1. Recipient receives email with graph-specific context
2. Email includes graph title, description, and value proposition
3. Invitation link includes graph ID for automatic assignment
4. Registration flow pre-fills graph as deal name
5. Instant ambassador status upon acceptance
```

### **Superadmin Dashboard Enhancements**

#### **Invitation Management View**
```vue
<template>
  <div class="invitation-dashboard">
    <!-- Graph-specific invitation metrics -->
    <div class="metrics-row">
      <div class="metric-card">
        <h3>Graph Ambassadors</h3>
        <p>{{ totalGraphAmbassadors }} active</p>
      </div>
      <div class="metric-card">
        <h3>Top Promoted Graphs</h3>
        <ul>
          <li v-for="graph in topGraphs">
            {{ graph.title }} ({{ graph.ambassadorCount }} ambassadors)
          </li>
        </ul>
      </div>
    </div>
    
    <!-- Enhanced invitation form -->
    <div class="invitation-form">
      <h4>Send Graph-Specific Invitation</h4>
      <GraphSelector v-model="selectedGraph" />
      <InvitationForm :graph="selectedGraph" @send="sendInvitation" />
    </div>
  </div>
</template>
```

#### **Graph Ambassador Analytics**
- **Per-Graph Metrics**: Number of ambassadors per graph
- **Performance Tracking**: Commission generated by graph
- **Ambassador Effectiveness**: Which graphs convert best
- **Invitation Success Rate**: Acceptance rate by graph type

---

## �🔧 **TECHNICAL SPECIFICATIONS**

### **Database Schema (Already Implemented)**
```sql
-- affiliate_invitations table already includes deal_name column:
CREATE TABLE IF NOT EXISTS affiliate_invitations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token TEXT UNIQUE NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  site_name TEXT,
  commission_type TEXT DEFAULT 'percentage',
  commission_rate REAL DEFAULT 15.0,
  commission_amount REAL,
  inviter_affiliate_id TEXT,
  domain TEXT DEFAULT 'vegvisr.org',
  expires_at TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  used INTEGER DEFAULT 0,
  used_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  deal_name TEXT DEFAULT 'default',  -- ✅ ALREADY EXISTS - Stores graphId
  FOREIGN KEY (inviter_affiliate_id) REFERENCES affiliates(affiliate_id)
);

-- Existing affiliates table already supports this:
CREATE TABLE affiliates (
  affiliate_id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  deal_name TEXT NOT NULL,  -- This becomes the graphId
  domain TEXT DEFAULT 'vegvisr.org',
  commission_type TEXT,
  commission_amount DECIMAL(10,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### **CSS Enhancements**
```css
/* New badge style for affiliate ambassadors */
.badge.bg-gold {
  background-color: #ffd700 !important;
  color: #000 !important;
  border: 1px solid #ffed4e;
}

.badge.bg-gold:hover {
  background-color: #ffed4e !important;
  cursor: pointer;
}

/* Ambassador tooltip styling */
.ambassador-tooltip {
  background: linear-gradient(135deg, #ffd700, #ffed4e);
  color: #000;
  border: 1px solid #f59e0b;
}
```

### **API Integration Points**
```javascript
// Enhanced invitation sending
const sendGraphSpecificInvitation = async (invitationData) => {
  const response = await fetch('https://aff-worker.torarnehave.workers.dev/send-affiliate-invitation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipientEmail: invitationData.email,
      recipientName: invitationData.name,
      senderName: invitationData.senderName,
      dealName: invitationData.graphId,  // Graph ID as deal name
      graphTitle: invitationData.graphTitle,
      graphDescription: invitationData.graphDescription,
      commissionType: invitationData.commissionType,
      commissionAmount: invitationData.commissionAmount
    })
  })
  return await response.json()
}

// Frontend API calls
const checkAmbassadorStatus = async (graphIds) => {
  const response = await fetch('https://aff-worker.torarnehave.workers.dev/graph-ambassador-status', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ graphIds })
  })
  return await response.json()
}

const getAffiliateDealsForGraph = async (graphId) => {
  const response = await fetch(`https://aff-worker.torarnehave.workers.dev/affiliate-deals-by-graph?graphId=${graphId}`)
  return await response.json()
}

// Get available graphs for invitation form
const getAvailableGraphs = async () => {
  const response = await fetch('https://knowledge.vegvisr.org/graphs')
  return await response.json()
}
```

---

## 📊 **IMPLEMENTATION PHASES**

### **🚀 Phase 1: Core Integration (Week 1-2)**
- [ ] **Code Fix**: Update invitation storage to properly use existing deal_name column
- [ ] **Code Fix**: Update acceptance flow to retrieve deal_name from invitation
- [ ] **Backend**: Implement graph ambassador status endpoint
- [ ] **Backend**: Enhance existing endpoints to handle graphId as dealName
- [ ] **Backend**: Add bulk ambassador status checking
- [ ] **Email Templates**: Update invitation templates with graph context
- [ ] **Validation**: Add graphId existence checking before invitation
- [ ] **Testing**: Verify affiliate registration with graphId works

### **🎨 Phase 2: UI Enhancement (Week 2-3)**
- [ ] **Superadmin UI**: Add graph selection dropdown to invitation form
- [ ] **Superadmin UI**: Implement graph preview in invitation interface
- [ ] **Superadmin UI**: Add commission suggestions based on graph complexity
- [ ] **Frontend**: Add ambassador badge component
- [ ] **Frontend**: Integrate ambassador status fetching
- [ ] **Frontend**: Implement new badge styling (bg-gold)
- [ ] **Email Preview**: Show invitation email with graph context
- [ ] **Testing**: Verify badges display correctly across view modes

### **⚡ Phase 3: User Experience (Week 3-4)**
- [ ] **Features**: Add filtering by ambassador status
- [ ] **Features**: Implement hover tooltips with affiliate stats
- [ ] **Features**: Add click actions for graph owners
- [ ] **Testing**: End-to-end testing of affiliate-graph workflow

### **🔗 Phase 4: Advanced Features (Week 4+)**
- [ ] **Integration**: Connect with social feed system
- [ ] **Analytics**: Add commission tracking and insights
- [ ] **Discovery**: Implement affiliate-based recommendations
- [ ] **Mobile**: Optimize for mobile responsiveness

---

## 🎯 **SUCCESS METRICS**

### **Technical Success**
- ✅ GraphId can be used as dealName in affiliate registration and invitations
- ✅ Superadmin can select specific graphs when sending invitations
- ✅ Ambassador badges display correctly in all portfolio views
- ✅ Invitation emails include relevant graph context and information
- ✅ API performance remains under 200ms for ambassador status checks
- ✅ Database schema supports deal_name in both affiliates and invitations tables
- ✅ No disruption to existing affiliate or portfolio functionality

### **User Experience Success**
- ✅ Superadmin can easily invite ambassadors for specific graphs
- ✅ Recipients receive contextual invitations with graph information
- ✅ Graph creators can easily see which graphs have affiliate ambassadors
- ✅ Affiliates can identify and promote relevant graphs
- ✅ Visual connection between affiliate marketing and graph content is clear
- ✅ Invitation acceptance flow preserves graph assignment
- ✅ Mobile experience remains smooth and responsive

### **Business Success**
- ✅ Increased affiliate engagement with knowledge graph content
- ✅ Higher conversion rates for graph-specific affiliate deals
- ✅ Better visibility into which graphs generate affiliate interest
- ✅ Foundation for future affiliate recommendation systems

---

## ⚠️ **RISK MITIGATION**

### **Technical Risks**
- **Performance**: Bulk ambassador status checks could slow portfolio loading
  - *Mitigation*: Implement caching and pagination
- **Data Consistency**: Graph deletions could leave orphaned affiliate deals
  - *Mitigation*: Add cleanup processes and referential integrity

### **User Experience Risks**
- **Badge Overload**: Too many badges could clutter the interface
  - *Mitigation*: Implement badge priority system and responsive hiding
- **Confusion**: Users might not understand ambassador concept
  - *Mitigation*: Add clear tooltips and help documentation

### **Business Risks**
- **Privacy**: Showing affiliate data might raise privacy concerns
  - *Mitigation*: Only show aggregate data, no individual affiliate details
- **Bias**: Graphs with ambassadors might appear more valuable
  - *Mitigation*: Clearly communicate that ambassadors don't indicate quality

---

## 🚀 **GETTING STARTED**

### **Immediate Next Steps**
1. **Approve this plan** and confirm the approach
2. **Start with Phase 1**: Backend API enhancements
3. **Test with existing data**: Use current affiliate registrations
4. **Iterate based on feedback**: Adjust UI and UX based on testing

### **Development Environment Setup**
```bash
# Test affiliate registration with graphId
curl -X POST "https://aff-worker.torarnehave.workers.dev/register-affiliate" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "name": "Test User",
    "dealName": "graph_1754203620085",
    "commissionType": "fixed",
    "commissionAmount": "25.00"
  }'

# Test frontend integration
npm run dev:vue
# Navigate to /portfolio and verify badge system
```

---

## 📚 **DOCUMENTATION REQUIREMENTS**

### **API Documentation Updates**
- Document new `dealName` accepts graphId format
- Add examples for graph-specific affiliate registration
- Document ambassador status endpoint specifications

### **User Documentation**
- Create "Ambassador Program" guide for graph creators
- Add FAQ about affiliate-graph connections
- Update portfolio user guide with new badge explanations

### **Developer Documentation**
- Document badge system extension patterns
- Add integration guide for future affiliate features
- Create troubleshooting guide for common issues

---

**Rollback ID**: AFFILIATE_GRAPH_INTEGRATION_PLAN_2025_01_31_001

This plan provides a comprehensive roadmap for integrating affiliate deals with knowledge graphs while preserving all existing functionality and following established patterns in both the affiliate system and GraphPortfolio interface.
