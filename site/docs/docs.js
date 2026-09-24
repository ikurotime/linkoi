const theme = document.querySelector('#theme');
let chosenTheme;
try { chosenTheme = localStorage.getItem('linkoi-docs-theme'); } catch {}
const dark = matchMedia('(prefers-color-scheme: dark)');
function setTheme(value) {
  document.documentElement.dataset.theme = value;
  theme.setAttribute('aria-label', `Switch to ${value === 'dark' ? 'light' : 'dark'} theme`);
}
setTheme(chosenTheme || (dark.matches ? 'dark' : 'light'));
theme.addEventListener('click', () => {
  chosenTheme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  setTheme(chosenTheme);
  try { localStorage.setItem('linkoi-docs-theme', chosenTheme); } catch {}
});
dark.addEventListener('change', () => { if (!chosenTheme) setTheme(dark.matches ? 'dark' : 'light'); });
const menu = document.querySelector('#menu');
function showMenu(open) { document.body.classList.toggle('menu-open', open); menu.setAttribute('aria-expanded', String(open)); }
menu.addEventListener('click', () => showMenu(!document.body.classList.contains('menu-open')));
const search = document.querySelector('#doc-search');
search.addEventListener('input', () => {
  const query = search.value.trim().toLowerCase();
  const links = [...document.querySelectorAll('#sidebar > a')];
  links.forEach(link => { link.hidden = !link.textContent.toLowerCase().includes(query); });
  document.querySelector('#no-results').hidden = links.some(link => !link.hidden);
  if (query && matchMedia('(max-width: 760px)').matches) showMenu(true);
});
search.addEventListener('keydown', event => {
  if (event.key === 'Enter') document.querySelector('#sidebar > a:not([hidden])')?.click();
});
document.addEventListener('keydown', event => {
  if (event.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); search.focus(); }
  if (event.key === 'Escape') { showMenu(false); search.blur(); menu.focus(); }
});
document.querySelectorAll('.copy-code').forEach(button => button.addEventListener('click', async () => {
  const block = button.closest('.codeblock');
  try { await navigator.clipboard.writeText(block.querySelector('code').textContent); block.querySelector('.copy-status').textContent = 'Copied.'; }
  catch { block.querySelector('.copy-status').textContent = 'Select the code to copy it manually.'; }
}));
