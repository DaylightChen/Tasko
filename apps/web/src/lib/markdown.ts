import DOMPurify from 'dompurify';
import { Renderer, type Tokens, marked } from 'marked';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const renderer = new Renderer();

renderer.checkbox = ({ checked }: Tokens.Checkbox): string =>
  `<span class="md-checkbox" data-checked="${checked}" aria-hidden="true">${checked ? '☑' : '☐'}</span>`;

renderer.link = ({ href, tokens }: Tokens.Link): string => {
  const safe = escapeHtml(href ?? '');
  const text = renderer.parser.parseInline(tokens);
  return `<a href="${safe}" target="_blank" rel="noopener noreferrer">${text}</a>`;
};

export function renderMarkdown(source: string): string {
  const raw = marked.parse(source, { renderer, breaks: true, async: false }) as string;
  // NOTE: USE_PROFILES: { html: true } would strip target="_blank" from <a> even when
  // listed in ALLOWED_ATTR. Drop the profile and rely on ALLOWED_TAGS + ALLOWED_ATTR
  // explicitly so the renderer's target/rel attrs survive.
  return DOMPurify.sanitize(raw, {
    ALLOWED_TAGS: [
      'p',
      'br',
      'strong',
      'em',
      'code',
      'pre',
      'ul',
      'ol',
      'li',
      'a',
      'span',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'blockquote',
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'data-checked', 'aria-hidden', 'class'],
  });
}
