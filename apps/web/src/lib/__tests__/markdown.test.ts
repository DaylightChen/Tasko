/**
 * Tests for lib/markdown.ts
 * Covers: renderMarkdown — bold, italic, code, links, checkboxes, XSS sanitization
 */
import { describe, expect, it } from 'vitest';
import { renderMarkdown } from '../markdown';

// ---------------------------------------------------------------------------
// Inline formatting
// ---------------------------------------------------------------------------

describe('renderMarkdown — inline formatting', () => {
  it('renders **bold** as <strong>', () => {
    const html = renderMarkdown('**foo**');
    expect(html).toContain('<strong>foo</strong>');
  });

  it('renders *italic* as <em>', () => {
    const html = renderMarkdown('*bar*');
    expect(html).toContain('<em>bar</em>');
  });

  it('renders `inline code` as <code>', () => {
    const html = renderMarkdown('`hello`');
    expect(html).toContain('<code>hello</code>');
  });

  it('passes plain text through untouched (no extra tags)', () => {
    const html = renderMarkdown('just plain text');
    expect(html).toContain('just plain text');
    expect(html).not.toContain('<strong>');
    expect(html).not.toContain('<em>');
  });
});

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

describe('renderMarkdown — links', () => {
  it('renders [text](url) as <a> with correct text and href', () => {
    const html = renderMarkdown('[Google](https://google.com)');
    expect(html).toContain('href="https://google.com"');
    expect(html).toContain('>Google<');
  });

  it('adds target="_blank" to links', () => {
    // IMPLEMENTATION BUG (task-13): DOMPurify with USE_PROFILES: { html: true } strips
    // target="_blank" even though 'target' is in ALLOWED_ATTR. The renderer correctly
    // generates the attribute but sanitization removes it. The brief requires this attribute
    // for security (opens links in new tab). Fix: add FORCE_ATTR: ['target'] or remove
    // USE_PROFILES and rely solely on ALLOWED_TAGS + ALLOWED_ATTR.
    const html = renderMarkdown('[link](https://example.com)');
    expect(html).toContain('target="_blank"');
  });

  it('adds rel="noopener noreferrer" to links', () => {
    const html = renderMarkdown('[link](https://example.com)');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('javascript: URL — output does NOT contain href="javascript:', () => {
    const html = renderMarkdown('[click](javascript:alert(1))');
    // DOMPurify must strip or neutralise the unsafe href
    expect(html).not.toContain('href="javascript:');
  });
});

// ---------------------------------------------------------------------------
// Checkboxes
// ---------------------------------------------------------------------------

describe('renderMarkdown — checkboxes', () => {
  it('renders unchecked checkbox: - [ ] foo', () => {
    const html = renderMarkdown('- [ ] foo');
    expect(html).toContain('class="md-checkbox"');
    expect(html).toContain('data-checked="false"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('☐');
    expect(html).toContain('foo');
  });

  it('renders checked checkbox: - [x] foo', () => {
    const html = renderMarkdown('- [x] foo');
    expect(html).toContain('class="md-checkbox"');
    expect(html).toContain('data-checked="true"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('☑');
    expect(html).toContain('foo');
  });

  it('unchecked checkbox span is inside a <li>', () => {
    const html = renderMarkdown('- [ ] item');
    // The <li> must wrap the span
    const liMatch = html.match(/<li>([\s\S]*?)<\/li>/);
    expect(liMatch).not.toBeNull();
    expect(liMatch?.[1]).toContain('md-checkbox');
    expect(liMatch?.[1]).toContain('data-checked="false"');
  });

  it('checked checkbox span is inside a <li>', () => {
    const html = renderMarkdown('- [x] done');
    const liMatch = html.match(/<li>([\s\S]*?)<\/li>/);
    expect(liMatch).not.toBeNull();
    expect(liMatch?.[1]).toContain('md-checkbox');
    expect(liMatch?.[1]).toContain('data-checked="true"');
  });
});

// ---------------------------------------------------------------------------
// XSS / DOMPurify sanitization
// ---------------------------------------------------------------------------

describe('renderMarkdown — XSS sanitization', () => {
  it('strips <script> tags from input', () => {
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('</script>');
  });

  it('does not execute injected script content', () => {
    // The text "alert(1)" may appear as escaped text, but the <script> element must not exist
    const html = renderMarkdown('<script>alert(1)</script>');
    expect(html).not.toContain('<script');
  });

  it('strips onerror event attributes from img tags', () => {
    const html = renderMarkdown('<img src="x" onerror="alert(1)">');
    // img is not in ALLOWED_TAGS so the whole tag should be removed
    expect(html).not.toContain('onerror');
  });
});
