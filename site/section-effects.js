// Website-only adaptations of React Bits SpotlightCard and MagnetLines by David Haz.
// License: vendor/REACT-BITS-LICENSE.md. No React runtime is needed.
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
const cleanups = [];
for (const card of document.querySelectorAll('.spotlight-card')) {
  let frame = 0;
  const move = event => {
    if (reduced.matches || !finePointer.matches) return;
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${event.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${event.clientY - rect.top}px`);
    });
  };
  card.addEventListener('pointermove', move, { passive: true });
  cleanups.push(() => { cancelAnimationFrame(frame); card.removeEventListener('pointermove', move); });
}
const section = document.querySelector('.pipeline-wrap');
const field = section.querySelector('.magnet-field');
const lines = [...field.children];
let frame = 0;
const follow = event => {
  if (reduced.matches || !finePointer.matches) return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const rect = field.getBoundingClientRect();
    // Compute grid centers from one layout read instead of measuring every line.
    lines.forEach((line, index) => {
      const x = rect.left + ((index % 20) + .5) * rect.width / 20;
      const y = rect.top + (Math.floor(index / 20) + .5) * rect.height / 9;
      const angle = Math.atan2(event.clientY - y, event.clientX - x) * 180 / Math.PI;
      line.style.setProperty('--rotate', `${angle}deg`);
    });
  });
};
const reset = () => { cancelAnimationFrame(frame); lines.forEach(line => line.style.removeProperty('--rotate')); };
section.addEventListener('pointermove', follow, { passive: true });
section.addEventListener('pointerleave', reset);
reduced.addEventListener('change', reset);
if (import.meta.hot) import.meta.hot.dispose(() => {
  cleanups.forEach(cleanup => cleanup()); reset();
  section.removeEventListener('pointermove', follow);
  section.removeEventListener('pointerleave', reset);
  reduced.removeEventListener('change', reset);
});
