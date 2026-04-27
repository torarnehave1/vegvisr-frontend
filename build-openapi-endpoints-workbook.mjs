import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SpreadsheetFile, Workbook } from '@oai/artifact-tool'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const openApiPath = '/tmp/vegvisr-openapi.json'
const outputDir = path.join(__dirname, 'outputs', 'openapi-endpoints-20260424')
const outputPath = path.join(outputDir, 'vegvisr-openapi-endpoints.xlsx')

const raw = await fs.readFile(openApiPath, 'utf8')
const openApi = JSON.parse(raw)

const endpoints = Object.entries(openApi.paths)
  .flatMap(([apiPath, methods]) =>
    Object.entries(methods).map(([method, spec]) => ({
      method: method.toUpperCase(),
      path: apiPath,
      summary: spec.summary || '',
      description: spec.description || '',
      operationId: spec.operationId || '',
      tags: Array.isArray(spec.tags) ? spec.tags.join(', ') : '',
    })),
  )
  .sort((a, b) => {
    if (a.path === b.path) return a.method.localeCompare(b.method)
    return a.path.localeCompare(b.path)
  })

const countsByMethod = endpoints.reduce((acc, endpoint) => {
  acc[endpoint.method] = (acc[endpoint.method] || 0) + 1
  return acc
}, {})

const workbook = Workbook.create()

const overview = workbook.worksheets.add('Oversikt')
const details = workbook.worksheets.add('Endpoints')

overview.getRange('A1').values = [['Vegvisr OpenAPI Endpoint Oversikt']]
overview.getRange('A1').format.font = { bold: true, size: 18, color: '#FFFFFF' }
overview.getRange('A1:F1').merge()
overview.getRange('A1:F1').format.fill = '#1F4E78'
overview.getRange('A1:F1').format.rowHeightPx = 30

overview.getRange('A3:B7').values = [
  ['Kilde', 'knowledge worker OpenAPI'],
  ['Eksportert', new Date()],
  ['Antall endpoints', endpoints.length],
  ['Antall GET', countsByMethod.GET || 0],
  ['Antall POST', countsByMethod.POST || 0],
]
overview.getRange('A3:A7').format.font = { bold: true }
overview.getRange('B4').format.number = 'yyyy-mm-dd hh:mm'

const methodRows = Object.entries(countsByMethod)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([method, count]) => [method, count])

overview.getRange(`D3:E${3 + methodRows.length}`).values = [
  ['Metode', 'Antall'],
  ...methodRows,
]
overview.getRange('D3:E3').format.fill = '#D9EAF7'
overview.getRange('D3:E3').format.font = { bold: true }

overview.getRange('A10:B14').values = [
  ['Innhold i arket "Endpoints"'],
  ['Method', 'HTTP-metode'],
  ['Path', 'Selve endpoint-pathen'],
  ['Summary', 'Kort tittel fra OpenAPI'],
  ['Description', 'Lengre forklaring fra OpenAPI'],
]
overview.getRange('A10:F10').merge()
overview.getRange('A10:F10').format.fill = '#E2F0D9'
overview.getRange('A10:F10').format.font = { bold: true }
overview.getRange('A11:A14').format.font = { bold: true }

overview.getRange('A1:F14').format.wrapText = true
overview.getRange('A:A').format.columnWidthPx = 170
overview.getRange('B:B').format.columnWidthPx = 240
overview.getRange('D:E').format.columnWidthPx = 110
overview.getRange('A10:F14').format.rowHeightPx = 26
overview.freezePanes.freezeRows(1)

const headerRow = [['Method', 'Path', 'Summary', 'Description', 'Operation ID', 'Tags']]
details.getRange('A1:F1').values = headerRow
details.getRange(`A2:F${endpoints.length + 1}`).values = endpoints.map((endpoint) => [
  endpoint.method,
  endpoint.path,
  endpoint.summary,
  endpoint.description,
  endpoint.operationId,
  endpoint.tags,
])

details.getRange('A1:F1').format.fill = '#1F4E78'
details.getRange('A1:F1').format.font = { bold: true, color: '#FFFFFF' }
details.getRange('A1:F1').format.rowHeightPx = 28
details.getRange(`A1:F${endpoints.length + 1}`).format.wrapText = true

details.getRange('A:A').format.columnWidthPx = 90
details.getRange('B:B').format.columnWidthPx = 180
details.getRange('C:C').format.columnWidthPx = 220
details.getRange('D:D').format.columnWidthPx = 520
details.getRange('E:E').format.columnWidthPx = 170
details.getRange('F:F').format.columnWidthPx = 140
details.getRange(`A2:F${endpoints.length + 1}`).format.rowHeightPx = 42

details.freezePanes.freezeRows(1)
details.freezePanes.freezeColumns(2)

const inspectOverview = await workbook.inspect({
  kind: 'table',
  range: 'Oversikt!A1:F14',
  include: 'values,formulas',
  tableMaxRows: 14,
  tableMaxCols: 6,
})

const inspectDetails = await workbook.inspect({
  kind: 'table',
  range: `Endpoints!A1:F12`,
  include: 'values,formulas',
  tableMaxRows: 12,
  tableMaxCols: 6,
})

const formulaErrors = await workbook.inspect({
  kind: 'match',
  searchTerm: '#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A',
  options: { useRegex: true, maxResults: 50 },
  summary: 'final formula error scan',
})

await workbook.render({ sheetName: 'Oversikt', range: 'A1:F14', scale: 1.5 })
await workbook.render({ sheetName: 'Endpoints', range: `A1:F20`, scale: 1.2 })

await fs.mkdir(outputDir, { recursive: true })
const output = await SpreadsheetFile.exportXlsx(workbook)
await output.save(outputPath)

console.log(
  JSON.stringify({
    outputPath,
    endpointCount: endpoints.length,
    countsByMethod,
    inspectOverview: inspectOverview.ndjson,
    inspectDetails: inspectDetails.ndjson,
    formulaErrors: formulaErrors.ndjson,
  }),
)
