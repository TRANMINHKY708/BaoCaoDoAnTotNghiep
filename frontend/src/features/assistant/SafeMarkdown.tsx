import type { ReactNode } from 'react';
import { narrativeText } from '../../utils/narrativeText';

// Deliberately small Markdown subset. React escapes everything; no HTML, links,
// images, plugins or embedded content can execute or send data to third parties.
function inline(text: string): ReactNode[] {
  return narrativeText(text)
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/g)
    .map((part, i) =>
      part.startsWith('`') && part.endsWith('`') ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : part.startsWith('**') && part.endsWith('**') ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        part
      ),
    );
}
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .slice(0, 12)
    .map((x) => x.trim());
export function SafeMarkdown({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '',
      key = i;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^\s*```/.test(line)) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i]!)) code.push(lines[i++]!);
      i++;
      blocks.push(
        <pre key={key}>
          <code>{code.join('\n')}</code>
        </pre>,
      );
    } else if (line.includes('|') && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1] ?? '')) {
      const headers = cells(line),
        rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i]!.includes('|') && lines[i]!.trim())
        rows.push(cells(lines[i++]!));
      blocks.push(
        <div
          className="assistant-table"
          key={key}
          tabIndex={0}
          role="region"
          aria-label="Bảng trong câu trả lời"
        >
          <table>
            <thead>
              <tr>
                {headers.map((h, n) => (
                  <th key={n}>{inline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, n) => (
                <tr key={n}>
                  {headers.map((_, c) => (
                    <td key={c}>{inline(r[c] ?? '')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
    } else if (/^#{1,6}\s/.test(line)) {
      blocks.push(<h3 key={key}>{inline(line.replace(/^#{1,6}\s+/, ''))}</h3>);
      i++;
    } else if (/^\s*(?:[-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line),
        items: ReactNode[] = [];
      const pattern = ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/;
      while (i < lines.length && pattern.test(lines[i]!)) {
        items.push(<li key={i}>{inline(lines[i++]!.replace(pattern, ''))}</li>);
      }
      blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>);
    } else {
      blocks.push(<p key={key}>{inline(line)}</p>);
      i++;
    }
  }
  return <div className="assistant-markdown">{blocks}</div>;
}
