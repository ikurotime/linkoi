import { defineConfig } from 'vite';
import { readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHighlighter } from 'shiki';
const root = dirname(fileURLToPath(import.meta.url));
const pages = readdirSync(resolve(root, 'docs'), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => resolve(root, 'docs', entry.name, 'index.html'));
const highlighter = createHighlighter({ themes: ['github-dark'], langs: ['typescript', 'shellscript', 'json'] });
const decode = text => text.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_, key) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'", '#39': "'" }[key]));
export default defineConfig({
  plugins: [{
    name: 'docs-code-highlighting',
    async transformIndexHtml(html, context) {
      if (!context.filename.includes('/docs/')) return html;
      const engine = await highlighter;
      return html.replace(/(<div class="code-label">)(ts|sh|json)([\s\S]*?<\/div>)<pre><code>([\s\S]*?)<\/code><\/pre>/g,
        (_, open, language, bar, code) => open + language + bar + engine.codeToHtml(decode(code), { lang: { ts: 'typescript', sh: 'shellscript', json: 'json' }[language], theme: 'github-dark' }));
    }
  }],
  build: { rollupOptions: { input: [resolve(root, 'index.html'), resolve(root, 'docs/index.html'), ...pages] } }
});
