/** Tiny DOM helpers. Keeps the panel modules readable without a framework. */

const SVG_NS = 'http://www.w3.org/2000/svg';

function applyAttrs(node, attrs) {
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === null || value === undefined || value === false) continue;

    if (key === 'class') node.setAttribute('class', value);
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
}

function appendAll(node, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    node.appendChild(typeof child === 'string' || typeof child === 'number'
      ? document.createTextNode(String(child))
      : child);
  }
}

/** Create an HTML element. */
export function h(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  applyAttrs(node, attrs);
  appendAll(node, children);
  return node;
}

/** Create an SVG element. */
export function s(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  applyAttrs(node, attrs);
  appendAll(node, children);
  return node;
}

/** Replace a node's children. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
  return node;
}

export function replace(node, ...children) {
  clear(node);
  appendAll(node, children);
  return node;
}
