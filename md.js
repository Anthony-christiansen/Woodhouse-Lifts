// Minimal, safe Markdown → HTML for the in-app "How it works" page (v1.11.4). Renders the repo's own
// docs/training-logic.md: headings, paragraphs, lists, tables, quotes, rules, bold/italic/code and links.
// Safety: every character of the source is HTML-escaped BEFORE any formatting is applied, so the output can only
// contain the tags produced here. Links are kept only for http(s) URLs, in-app #/ routes and #section anchors;
// anything else (javascript:, data:, …) is shown as plain text. External links open in a new tab with noopener.
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const slug = s => String(s).toLowerCase().replace(/<[^>]+>/g, '').replace(/&[a-z#0-9]+;/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const safeHref = u => /^https?:\/\//i.test(u) ? u : /^#\/?[\w\-/.]*$/.test(u) ? u : null;

export function inline(src) {
  let s = esc(src);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\u0000${codes.length - 1}\u0000`; });   // protect code spans
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, text, url) => {
    const raw = url.replace(/&amp;/g, '&'), h = safeHref(raw);
    if (!h) return text;
    const ext = /^https?:/i.test(h);
    return `<a href="${esc(h)}"${ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
  });
  s = s.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<i>$2</i>');
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[i]}</code>`);
}

export function mdToHtml(md) {
  const lines = String(md).replace(/\r/g, '').split('\n'), out = [], toc = [];
  let i = 0;
  const isTable = l => /^\s*\|.*\|\s*$/.test(l);
  const cells = l => l.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim());
  while (i < lines.length) {
    const l = lines[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      const lvl = m[1].length, html = inline(m[2]), id = slug(m[2]);
      if (lvl === 2) toc.push({ id, html });
      out.push(`<h${lvl + 1} id="${id}">${html}</h${lvl + 1}>`); i++; continue;
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(l)) { out.push('<hr>'); i++; continue; }
    if (isTable(l) && isTable(lines[i + 1] || '') && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(l); i += 2; const rows = [];
      while (i < lines.length && isTable(lines[i])) rows.push(cells(lines[i++]));
      out.push(`<div class="md-table" tabindex="0" role="region" aria-label="Table (scrolls sideways)"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${
        rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    if (/^>\s?/.test(l)) {
      const q = []; while (i < lines.length && /^>\s?/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`); continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
      // lists, nested by indentation (2+ spaces per level)
      const stack = [];
      while (i < lines.length && (/^\s*([-*]|\d+\.)\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && stack.length))) {
        const line = lines[i];
        const mm = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
        if (!mm) { out.push(' ' + inline(line.trim())); i++; continue; }   // continuation line
        const depth = Math.floor(mm[1].length / 2), tag = /\d/.test(mm[2]) ? 'ol' : 'ul';
        while (stack.length > depth + 1) out.push(`</li></${stack.pop()}>`);
        if (stack.length === depth + 1) out.push('</li>');
        while (stack.length < depth + 1) { out.push(`<${tag}>`); stack.push(tag); }
        out.push(`<li>${inline(mm[3])}`); i++;
      }
      while (stack.length) out.push(`</li></${stack.pop()}>`);
      continue;
    }
    const p = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>\s?|\s*([-*]|\d+\.)\s+|\s*---\s*$)/.test(lines[i]) && !isTable(lines[i])) p.push(lines[i++]);
    out.push(`<p>${inline(p.join(' '))}</p>`);
  }
  return { html: out.join('\n'), toc };
}
