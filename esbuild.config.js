import { build } from 'esbuild'
import { exit } from 'process'

build({
  entryPoints: ['main-worker/index.js'],
  bundle: true,
  platform: 'node', // Set the platform to 'node'
  outfile: 'dist/index.js',
}).catch((error) => {
  console.error(error)
  exit(1)
})
