import { Rich } from './components';
import { parseMarkdown } from './parseMarkdown';

export function Markdown({ source }: { source: string }) {
  return (
    <div className="md">
      {parseMarkdown(source).map((block, i) => {
        switch (block.kind) {
          case 'heading':
            return block.level === 1 ? <h3 key={i}><Rich text={block.text} /></h3> : <h4 key={i}><Rich text={block.text} /></h4>;
          case 'code':
            return <pre key={i} className="md-code">{block.text}</pre>;
          case 'list':
            return (
              <ul key={i}>
                {block.items.map((item, j) => (
                  <li key={j}><Rich text={item} /></li>
                ))}
              </ul>
            );
          case 'paragraph':
            return <p key={i}><Rich text={block.text} /></p>;
        }
      })}
    </div>
  );
}
