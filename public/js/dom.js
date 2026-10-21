/**
 * Creates an element. Text is always assigned via textContent so untrusted
 * strings can never be interpreted as HTML.
 */
export function el(tag, { className, text, attrs = {} } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
  children.forEach((child) => node.append(child));
  return node;
}

export function announce(message) {
  const region = document.getElementById('app-status');
  if (!region) return;
  region.textContent = '';
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}
