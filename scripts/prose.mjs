// Keep supplied recipe prose intact. Presentation must not summarize content.
export function renderProse(text) {
  if (typeof text !== 'string') throw new TypeError('Recipe prose must be a string');
  const escaped = text.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  return `<p class="recipe-prose">${escaped}</p>`;
}
