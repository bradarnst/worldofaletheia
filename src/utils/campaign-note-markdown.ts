export function stripMarkdownFrontmatter(markdown: string): string {
  const match = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(markdown);
  return match ? markdown.slice(match[0].length) : markdown;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function normalizeHref(rawHref: string): string {
  const trimmed = rawHref.trim().replace(/^<|>$/g, '');
  if (/^(https?:\/\/|mailto:|\/|#)/i.test(trimmed)) {
    return trimmed;
  }

  return `/${trimmed.replace(/^\.\/+/, '')}`;
}

function renderInlineMarkdown(value: string): string {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
      return `<a href="${escapeHtml(normalizeHref(href))}">${label}</a>`;
    });
}

function renderParagraph(lines: string[]): string {
  return `<p>${renderInlineMarkdown(lines.join(' '))}</p>`;
}

export function renderCampaignNoteMarkdownHtml(markdown: string): string {
  const body = stripMarkdownFrontmatter(markdown).trim();
  if (!body) {
    return '<p>This note has no body content.</p>';
  }

  const html: string[] = [];
  const paragraph: string[] = [];
  let unorderedList: string[] = [];
  let orderedList: string[] = [];
  let inFence = false;
  let fenceLines: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) {
      html.push(renderParagraph(paragraph));
      paragraph.length = 0;
    }
  };
  const flushLists = () => {
    if (unorderedList.length > 0) {
      html.push(`<ul>${unorderedList.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ul>`);
      unorderedList = [];
    }
    if (orderedList.length > 0) {
      html.push(`<ol>${orderedList.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join('')}</ol>`);
      orderedList = [];
    }
  };

  for (const line of body.split(/\r?\n/)) {
    if (line.trim().startsWith('```')) {
      if (inFence) {
        html.push(`<pre><code>${escapeHtml(fenceLines.join('\n'))}</code></pre>`);
        fenceLines = [];
        inFence = false;
      } else {
        flushParagraph();
        flushLists();
        inFence = true;
      }
      continue;
    }

    if (inFence) {
      fenceLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushLists();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushParagraph();
      flushLists();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const unordered = /^\s*[-*]\s+(.+)$/.exec(line);
    if (unordered) {
      flushParagraph();
      orderedList = [];
      unorderedList.push(unordered[1]);
      continue;
    }

    const ordered = /^\s*\d+\.\s+(.+)$/.exec(line);
    if (ordered) {
      flushParagraph();
      unorderedList = [];
      orderedList.push(ordered[1]);
      continue;
    }

    paragraph.push(line.trim());
  }

  if (inFence) {
    html.push(`<pre><code>${escapeHtml(fenceLines.join('\n'))}</code></pre>`);
  }
  flushParagraph();
  flushLists();

  return html.join('\n');
}
