-- Menu Templates Database Schema for Cloudflare D1 (SQLite)
-- This table stores menu templates for both graph-level and top-level menus
-- Following the same pattern as graphTemplates.sql

CREATE TABLE IF NOT EXISTS menuTemplates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    menu_data TEXT NOT NULL,        -- JSON string containing menu structure
    category TEXT DEFAULT 'General',
    menu_level TEXT DEFAULT 'graph', -- 'graph' or 'top'
    access_level TEXT DEFAULT 'user', -- 'user', 'admin', 'superadmin'
    created_by TEXT,
    domain TEXT,                    -- For branding integration (optional)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_menuTemplates_category ON menuTemplates(category);
CREATE INDEX IF NOT EXISTS idx_menuTemplates_level ON menuTemplates(menu_level);
CREATE INDEX IF NOT EXISTS idx_menuTemplates_domain ON menuTemplates(domain);
CREATE INDEX IF NOT EXISTS idx_menuTemplates_created_by ON menuTemplates(created_by);
CREATE INDEX IF NOT EXISTS idx_menuTemplates_access_level ON menuTemplates(access_level);
CREATE INDEX IF NOT EXISTS idx_menuTemplates_created_at ON menuTemplates(created_at);

-- Create a trigger to update the updated_at timestamp (SQLite syntax)
CREATE TRIGGER IF NOT EXISTS update_menuTemplates_timestamp
AFTER UPDATE ON menuTemplates
BEGIN
  UPDATE menuTemplates SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert default menu templates following the same pattern as graphTemplates
INSERT OR REPLACE INTO menuTemplates (
    id,
    name,
    menu_data,
    category,
    menu_level,
    access_level,
    created_by
) VALUES (
    'default-graph-menu-001',
    'Default Graph Menu',
    '{
        "id": "default-graph-menu-001",
        "type": "menu",
        "label": "Default Graph Menu",
        "info": "{\"menuId\": \"default-graph-menu\", \"name\": \"Default Graph Menu\", \"description\": \"Basic navigation menu for graph-level usage\", \"menuLevel\": \"graph\", \"items\": [{\"id\": \"home\", \"label\": \"Home\", \"icon\": \"🏠\", \"type\": \"route\", \"path\": \"/\", \"requiresRole\": null}, {\"id\": \"portfolio\", \"label\": \"Portfolio\", \"icon\": \"📁\", \"type\": \"route\", \"path\": \"/graph-portfolio\", \"requiresRole\": null}, {\"id\": \"editor\", \"label\": \"Editor\", \"icon\": \"✏️\", \"type\": \"route\", \"path\": \"/graph-editor\", \"requiresRole\": null}], \"style\": {\"layout\": \"horizontal\", \"theme\": \"default\", \"position\": \"top\", \"buttonStyle\": \"hamburger\"}}",
        "color": "#f0f8ff",
        "visible": true,
        "position": {"x": 100, "y": 100},
        "bibl": [],
        "imageWidth": "100%",
        "imageHeight": "100%"
    }',
    'Navigation',
    'graph',
    'user',
    'system'
);

INSERT OR REPLACE INTO menuTemplates (
    id,
    name,
    menu_data,
    category,
    menu_level,
    access_level,
    created_by
) VALUES (
    'admin-graph-menu-001',
    'Admin Graph Menu',
    '{
        "menuId": "admin-graph-menu",
        "name": "Admin Graph Menu",
        "description": "Administrative menu with template access",
        "menuLevel": "graph",
        "items": [
            {
                "id": "home",
                "label": "Home",
                "icon": "🏠",
                "type": "route",
                "path": "/",
                "requiresRole": null
            },
            {
                "id": "portfolio",
                "label": "Portfolio",
                "icon": "📁",
                "type": "route",
                "path": "/graph-portfolio",
                "requiresRole": null
            },
            {
                "id": "templates",
                "label": "Templates",
                "icon": "📋",
                "type": "template-selector",
                "requiresRole": ["Admin", "Superadmin"]
            },
            {
                "id": "admin-panel",
                "label": "Admin",
                "icon": "⚙️",
                "type": "route",
                "path": "/admin",
                "requiresRole": ["Admin", "Superadmin"]
            }
        ],
        "style": {
            "layout": "horizontal",
            "theme": "admin",
            "position": "top",
            "buttonStyle": "hamburger"
        }
    }',
    'Admin',
    'graph',
    'admin',
    'system'
);

INSERT OR REPLACE INTO menuTemplates (
    id,
    name,
    menu_data,
    category,
    menu_level,
    access_level,
    created_by
) VALUES (
    'default-top-menu-001',
    'Default Top Menu',
    '{
        "menuId": "default-top-menu",
        "name": "Default Top Menu",
        "description": "Basic top-level navigation menu",
        "menuLevel": "top",
        "items": [
            {
                "id": "dashboard",
                "label": "Dashboard",
                "icon": "📊",
                "type": "route",
                "path": "/user",
                "requiresRole": null
            },
            {
                "id": "graph-viewer",
                "label": "Viewer",
                "icon": "👁️",
                "type": "route",
                "path": "/graph-viewer",
                "requiresRole": null
            },
            {
                "id": "graph-editor",
                "label": "Editor",
                "icon": "✏️",
                "type": "route",
                "path": "/graph-editor",
                "requiresRole": null
            },
            {
                "id": "roadmap",
                "label": "Roadmap",
                "icon": "🗺️",
                "type": "route",
                "path": "/github-issues",
                "requiresRole": null
            }
        ],
        "style": {
            "layout": "horizontal",
            "theme": "default",
            "position": "top",
            "buttonStyle": "button"
        }
    }',
    'Navigation',
    'top',
    'user',
    'system'
); 