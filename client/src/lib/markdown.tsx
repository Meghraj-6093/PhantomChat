import React from "react";

/**
 * Minimal, XSS-safe markdown renderer for chat messages.
 * Supports: **bold**, *italic*, ~~strike~~, `code`, ```blocks```,
 * > quotes, links, @mentions. Everything is built as React elements —
 * no innerHTML, so no sanitizer needed.
 */

const URL_RE = /(https?:\/\/[^\s<]+)/g;
const MENTION_RE = /(@[a-zA-Z0-9_.]{3,24})/g;

function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  // Tokenize by inline markers in priority order.
  const nodes: React.ReactNode[] = [];
  let rest = text;
  let k = 0;
  const push = (n: React.ReactNode) => nodes.push(<React.Fragment key={`${keyPrefix}-${k++}`}>{n}</React.Fragment>);

  const patterns: Array<{ re: RegExp; render: (m: RegExpMatchArray) => React.ReactNode }> = [
    { re: /^\*\*(.+?)\*\*/, render: (m) => <strong>{renderInline(m[1]!, `${keyPrefix}b${k}`)}</strong> },
    { re: /^\*(.+?)\*/, render: (m) => <em>{renderInline(m[1]!, `${keyPrefix}i${k}`)}</em> },
    { re: /^~~(.+?)~~/, render: (m) => <del>{renderInline(m[1]!, `${keyPrefix}s${k}`)}</del> },
    { re: /^`([^`]+)`/, render: (m) => <code>{m[1]}</code> },
  ];

  outer: while (rest.length) {
    for (const { re, render } of patterns) {
      const m = rest.match(re);
      if (m) {
        push(render(m));
        rest = rest.slice(m[0].length);
        continue outer;
      }
    }
    // Plain run until the next possible marker.
    const next = rest.slice(1).search(/[*~`]/);
    const chunk = next === -1 ? rest : rest.slice(0, next + 1);
    push(linkify(chunk, `${keyPrefix}t${k}`));
    rest = rest.slice(chunk.length);
  }
  return nodes;
}

function linkify(text: string, keyPrefix: string): React.ReactNode {
  const parts = text.split(URL_RE);
  return parts.map((part, i) => {
    if (URL_RE.test(part)) {
      URL_RE.lastIndex = 0;
      return (
        <a key={`${keyPrefix}-a${i}`} href={part} target="_blank" rel="noopener noreferrer nofollow">
          {part}
        </a>
      );
    }
    URL_RE.lastIndex = 0;
    // mentions
    const sub = part.split(MENTION_RE);
    return sub.map((s, j) =>
      MENTION_RE.test(s) ? (
        (MENTION_RE.lastIndex = 0),
        <span key={`${keyPrefix}-m${i}-${j}`} className="mention">{s}</span>
      ) : (
        ((MENTION_RE.lastIndex = 0), <React.Fragment key={`${keyPrefix}-p${i}-${j}`}>{s}</React.Fragment>)
      )
    );
  });
}

export function renderMarkdown(content: string): React.ReactNode {
  const blocks: React.ReactNode[] = [];
  const segments = content.split(/```/);

  segments.forEach((segment, idx) => {
    if (idx % 2 === 1) {
      // Code block; first line may be a language tag.
      const lines = segment.split("\n");
      const maybeLang = lines[0]?.trim() ?? "";
      const isLang = /^[a-zA-Z0-9+#-]{1,20}$/.test(maybeLang) && lines.length > 1;
      const code = isLang ? lines.slice(1).join("\n") : segment;
      blocks.push(
        <pre key={`cb-${idx}`} data-lang={isLang ? maybeLang : undefined}>
          <code>{code.replace(/\n$/, "")}</code>
        </pre>
      );
      return;
    }
    // Regular text: handle quotes per line.
    const lines = segment.split("\n");
    let para: React.ReactNode[] = [];
    let pk = 0;
    const flush = () => {
      if (para.length) {
        blocks.push(<p key={`p-${idx}-${pk++}`}>{para}</p>);
        para = [];
      }
    };
    lines.forEach((line, li) => {
      if (line.startsWith("> ")) {
        flush();
        blocks.push(
          <blockquote key={`q-${idx}-${li}`}>{renderInline(line.slice(2), `q${idx}-${li}`)}</blockquote>
        );
      } else if (line.trim() === "") {
        flush();
      } else {
        if (para.length) para.push(<br key={`br-${idx}-${li}`} />);
        para.push(<React.Fragment key={`l-${idx}-${li}`}>{renderInline(line, `l${idx}-${li}`)}</React.Fragment>);
      }
    });
    flush();
  });

  return <div className="prose-chat break-words">{blocks}</div>;
}
