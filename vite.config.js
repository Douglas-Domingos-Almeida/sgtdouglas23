import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { createPublicSnapshot } from './scripts/public-snapshot.js';

const require = createRequire(import.meta.url);

const root = fileURLToPath(new URL('.', import.meta.url));
const scripts = ['text-utils.js', 'main.js', 'news.js', 'admin-auth.js', 'competitions.js'];

export default defineConfig(({ mode }) => {
  const snapshot = mode === 'public-snapshot';
  return {
    server: {
      fs: {
        deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/Associados_ABRAM_SC.ods']
      },
      watch: {
        // Planilhas e arquivos temporários do Office/LibreOffice ficam bloqueados
        // enquanto abertos e derrubam o watcher no Windows (EBUSY).
        ignored: ['**/*.ods', '**/*.xlsx', '**/*.docx', '**/~$*', '**/.~lock.*']
      }
    },
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
      async generateBundle() {
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
          // O conteúdo publicado vem do MySQL; db.json permanece apenas como fonte da migração inicial.
          const { MysqlStore } = require('./BackEnd/mysql-store.js');
          const { loadMysqlConfig } = require('./BackEnd/mysql-config.js');
          const store = new MysqlStore(loadMysqlConfig());
          try {
            await store.initialize(path.join(root, 'BackEnd', 'db.json'));
            const database = {
              depoimentos: await store.list('depoimentos'),
              noticias: await store.list('noticias'),
              competicoes: await store.list('competicoes')
            };
            for (const [collection, records] of Object.entries(createPublicSnapshot(database))) {
              this.emitFile({
                type: 'asset', fileName: `dados/${collection}.json`, source: JSON.stringify(records)
              });
            }
          } finally {
            await store.close();
          }
        }
      }
    }]
  };
});
