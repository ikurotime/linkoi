import './section-effects.js';
const snippets = {
  url: `import { resolve } from '@linkoi/core'

const page = await resolve(
  'https://kitmo.app'
)

console.log(page.title)
console.log(page.description)
console.log(page.image)`,
  html: `import { fromHtml } from '@linkoi/core'

const page = await fromHtml(
  '<html><title>Hello</title></html>',
  'https://example.com',
  { fallback: false }
)

console.log(page.title) // Hello`
};
const snippet = document.querySelector('#snippet');
function renderCode(mode) {
  snippet.textContent = '';
  snippets[mode].split(/('[^'\n]*'|\b(?:import|from|const|await)\b|\/\/[^\n]*)/g).forEach(text => {
    const span = document.createElement('span');
    span.textContent = text;
    if (text.startsWith("'")) span.className = 'token-string';
    else if (text.startsWith('//')) span.className = 'token-comment';
    else if (/^(import|from|const|await)$/.test(text)) span.className = 'token-key';
    snippet.append(span);
  });
}
renderCode('url');
document.querySelectorAll('.api-option').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.api-option').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  renderCode(button.dataset.mode);
  document.querySelector('#copy-status').textContent = '';
}));
document.querySelector('#copy').addEventListener('click', async () => {
  const status = document.querySelector('#copy-status');
  try { await navigator.clipboard.writeText(snippet.textContent); status.textContent = 'Code copied.'; }
  catch { status.textContent = 'Select the code to copy it manually.'; }
});
const examples = {
  kitmo: { url:'https://kitmo.app', brand:'kitmo', tagline:['Made by you.', 'Seen everywhere.'], title:'Kitmo', description:'Create once, distribute everywhere.', publisher:'Kitmo' },
  linkoi: { url:'https://example.com/linkoi', brand:'linkoi', tagline:['A little more', 'behind every link.'], title:'Linkoi', description:'URL metadata for your server-side tools.', publisher:'Linkoi' }
};
document.querySelectorAll('.sample').forEach(button => button.addEventListener('click', () => {
  const data = examples[button.dataset.example];
  document.querySelectorAll('.sample').forEach(item => { item.classList.toggle('active', item === button); item.setAttribute('aria-pressed', String(item === button)); });
  document.querySelector('#example-url').textContent = data.url;
  document.querySelector('#preview-brand').textContent = data.brand;
  const tagline = document.querySelector('#preview-tagline');
  tagline.replaceChildren(document.createTextNode(data.tagline[0]), document.createElement('br'), document.createTextNode(data.tagline[1]));
  for (const field of ['title','description','publisher']) document.querySelector('#meta-' + field).textContent = data[field];
}));

// Load the decorative WebGL effect only when its footer approaches the viewport.
const veil = document.querySelector('.koi-veil');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let destroyVeil;
let loadingVeil = false;
async function startVeil() {
  if (motionPreference.matches || destroyVeil || loadingVeil) return;
  loadingVeil = true;
  try {
    const { mountDitherVeil } = await import('./dither-veil.js');
    if (motionPreference.matches) return;
    destroyVeil = mountDitherVeil(veil, {
      src: '/koi-veil.svg', pattern: 'bayer', pixelSize: 3,
      inkColor: '#1e264a', paperColor: '#eb4034',
      contrast: 1.05, brightness: .05, revealRadius: 130,
      linger: .7, wander: false, clickBurst: false
    });
    veil.classList.add('veil-ready');
  } catch {
    veil.querySelector('canvas')?.remove();
  } finally { loadingVeil = false; }
}
const veilObserver = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) startVeil();
}, { rootMargin: '200px' });
veilObserver.observe(veil);
motionPreference.addEventListener('change', () => {
  if (motionPreference.matches) {
    destroyVeil?.(); destroyVeil = undefined; veil.classList.remove('veil-ready');
  } else startVeil();
});
if (import.meta.hot) import.meta.hot.dispose(() => { destroyVeil?.(); veilObserver.disconnect(); });
