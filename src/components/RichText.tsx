import React from 'react';

/** Renders the lightweight CMS format: "## " headings, "- " bullets, blank-line paragraphs. */
export function RichText({ text, className = '' }: {text: string;className?: string;}) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className={`space-y-4 text-[15px] leading-relaxed text-ink-soft ${className}`}>
      {blocks.map((block, i) => {
        const lines = block.split('\n');
        const heading = lines[0].startsWith('## ') ? lines.shift()!.slice(3) : null;
        const bullets = lines.length > 0 && lines.every((l) => l.trim().startsWith('- '));
        return (
          <div key={i}>
            {heading && <h2 className="mb-2 text-lg font-semibold text-ink">{heading}</h2>}
            {lines.length > 0 && (
            bullets ?
            <ul className="list-disc space-y-1.5 pl-5">
                  {lines.map((l, j) =>
              <li key={j}>{l.trim().slice(2)}</li>
              )}
                </ul> :

            <p>{lines.join(' ')}</p>)
            }
          </div>);

      })}
    </div>);

}