import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Registry of all app-created tables
export const appTables = sqliteTable('app_tables', {
  id: text('id').primaryKey(),
  graphId: text('graph_id').notNull(),
  tableName: text('table_name').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: text('created_at').notNull(),
  createdBy: text('created_by'),
});

// Column definitions for each app table
export const appColumns = sqliteTable('app_columns', {
  id: text('id').primaryKey(),
  tableId: text('table_id').notNull(),
  columnName: text('column_name').notNull(),
  displayName: text('display_name').notNull(),
  columnType: text('column_type').notNull(),
  position: integer('position').notNull(),
  required: integer('required').default(0),
});
