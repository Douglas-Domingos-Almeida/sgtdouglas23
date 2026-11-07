import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createPublicSnapshot } from './scripts/public-snapshot.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const scripts = ['text-utils.js', 'main.js', 'news.js', 'admin-auth.js', 'competitions.js'];

export default defineConfig(({ mode }) => {
  const snapshot = mode === 'public-snapshot';
  return {
    plugins: [{
      name: 'uca-public-assets',
      apply: 'build',
      transformIndexHtml: {
        order: 'pre',
        handler(html) {
          // These scripts use document.currentScript and must remain classic scripts.
          html = html.replace(/<script type="module" src="(js\/[^"]+)"><\/script>/g,
            '<script src="$1" defer></script>');
          if (!snapshot) return html;
          return html.replace(/<script src="js\/news-data\.js[^"]*"[^>]*><\/script>/g, '')
            .replace('</head>', '<meta name="uca-public-data" content="/dados/">\n</head>');
        }
      },
      generateBundle() {
        const emitFile = (relativePath) => this.emitFile({
          type: 'asset',
          fileName: relativePath.split(path.sep).join('/'),
          source: fs.readFileSync(path.join(root, relativePath))
        });
        for (const name of [...scripts, ...(!snapshot ? ['news-data.js'] : [])]) {
          emitFile(path.join('js', name));
        }
        const copyDirectory = (relativePath) => {
          for (const entry of fs.readdirSync(path.join(root, relativePath), { withFileTypes: true })) {
            const child = path.join(relativePath, entry.name);
            if (entry.isDirectory()) copyDirectory(child);
            else if (entry.isFile()) emitFile(child);
          }
        };
        for (const directory of ['Videos', path.join('imagens', 'Icones'), path.join('imagens', 'noticias')]) {
          copyDirectory(directory);
        }
        if (snapshot) {
          const database = JSON.parse(fs.readFileSync(path.join(root, 'BackEnd', 'db.json'), 'utf8'));
          for (const [collection, records] of Object.entries(createPublicSnapshot(database))) {
            this.emitFile({
              type: 'asset', fileName: `dados/${collection}.json`, source: JSON.stringify(records)
            });
          }
        }
      }
    }]
  };
});
