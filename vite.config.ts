import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { appendFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

/** Emit asset-manifest.json listing every built file, so the service worker can precache the app. */
function assetManifest(): Plugin {
  let version = ''
  let outDir = 'dist'
  return {
    name: 'bandforge-asset-manifest',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir
    },
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'))
      version = Date.now().toString(36)
      this.emitFile({ type: 'asset', fileName: 'asset-manifest.json', source: JSON.stringify({ version, files }) })
    },
    // Stamp the service worker so browsers pick up each new deploy.
    writeBundle() {
      const sw = join(outDir, 'sw.js')
      if (existsSync(sw)) appendFileSync(sw, `\n// build ${version}\n`)
    },
  }
}

// Relative base so the build works on GitHub Pages under /music-sequencer/.
export default defineConfig({
  base: './',
  plugins: [react(), assetManifest()],
  // Export encoders load on demand; pre-bundle them so the dev server doesn't re-optimize mid-session.
  optimizeDeps: { include: ['mediabunny', '@mediabunny/mp3-encoder', '@mediabunny/aac-encoder', '@mediabunny/flac-encoder'] },
})
