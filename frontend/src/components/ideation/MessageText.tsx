// =============================================================================
// FILE: frontend/src/components/ideation/MessageText.tsx
// Message text with markdown rendering
// =============================================================================

import 'react';
import type { MessageTextProps } from '../../types/ideation';

export function MessageText({ content, isStreaming = false }: MessageTextProps) {
  // Helper to format inline markdown (bold, italic, code, links)
  const formatInline = (text: string): string => {
    return text
      // Links: [text](url) -> clickable anchor
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">$1</a>')
      // Bold: **text**
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic: *text*
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Inline code: `text`
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');
  };

  // Check if a block of text is a markdown table
  const isTable = (text: string): boolean => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return false;
    // Check for pipe characters and separator row (|---|---|)
    return lines[0].includes('|') && lines.some(line => /^\|?[\s-:|]+\|?$/.test(line.trim()));
  };

  // Render a markdown table
  const renderTable = (text: string, key: number) => {
    const lines = text.trim().split('\n').filter(line => line.trim());
    // Find separator row index
    const separatorIndex = lines.findIndex(line => /^\|?[\s-:|]+\|?$/.test(line.trim()));
    if (separatorIndex < 1) return null;

    // Parse header row
    const headerCells = lines[0]
      .split('|')
      .map(cell => cell.trim())
      .filter(cell => cell);

    // Parse body rows (skip separator)
    const bodyRows = lines.slice(separatorIndex + 1).map(line =>
      line
        .split('|')
        .map(cell => cell.trim())
        .filter(cell => cell)
    );

    return (
      <div key={key} className="overflow-x-auto mb-4">
        <table className="min-w-full border-collapse border border-gray-300 text-sm">
          <thead>
            <tr className="bg-gray-100">
              {headerCells.map((cell, i) => (
                <th
                  key={i}
                  className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700"
                  dangerouslySetInnerHTML={{ __html: formatInline(cell) }}
                />
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="border border-gray-300 px-3 py-2 text-gray-800"
                    dangerouslySetInnerHTML={{ __html: formatInline(cell) }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Simple markdown-like rendering
  const renderContent = () => {
    // Split by double newlines for paragraphs, but keep tables together
    const blocks: string[] = [];
    let currentBlock = '';
    let inTable = false;

    content.split('\n').forEach(line => {
      const lineIsTableRow = line.includes('|');

      if (lineIsTableRow && !inTable) {
        // Starting a table - save previous block
        if (currentBlock.trim()) {
          blocks.push(currentBlock.trim());
        }
        currentBlock = line + '\n';
        inTable = true;
      } else if (!lineIsTableRow && inTable) {
        // Ending a table
        blocks.push(currentBlock.trim());
        currentBlock = line + '\n';
        inTable = false;
      } else if (line.trim() === '' && !inTable) {
        // Empty line - paragraph break
        if (currentBlock.trim()) {
          blocks.push(currentBlock.trim());
        }
        currentBlock = '';
      } else {
        currentBlock += line + '\n';
      }
    });
    if (currentBlock.trim()) {
      blocks.push(currentBlock.trim());
    }

    return blocks.map((block, index) => {
      // Check for table
      if (isTable(block)) {
        return renderTable(block, index);
      }

      // Check for bullet points
      if (block.startsWith('- ') || block.startsWith('* ')) {
        const items = block.split(/\n/).filter(line => line.trim());
        return (
          <ul key={index} className="list-disc list-inside space-y-1 mb-2">
            {items.map((item, i) => (
              <li
                key={i}
                className="text-gray-800"
                dangerouslySetInnerHTML={{ __html: formatInline(item.replace(/^[-*]\s+/, '')) }}
              />
            ))}
          </ul>
        );
      }

      // Check for numbered list
      if (/^\d+\./.test(block)) {
        const items = block.split(/\n/).filter(line => line.trim());
        return (
          <ol key={index} className="list-decimal list-inside space-y-1 mb-2">
            {items.map((item, i) => (
              <li
                key={i}
                className="text-gray-800"
                dangerouslySetInnerHTML={{ __html: formatInline(item.replace(/^\d+\.\s*/, '')) }}
              />
            ))}
          </ol>
        );
      }

      // Regular paragraph with basic formatting
      return (
        <p
          key={index}
          className="text-gray-800 mb-2 last:mb-0"
          dangerouslySetInnerHTML={{ __html: formatInline(block) }}
        />
      );
    });
  };

  return (
    <div className="message-text prose prose-sm max-w-none">
      {renderContent()}
      {isStreaming && (
        <span className="inline-block w-0.5 h-4 bg-blue-500 animate-pulse ml-0.5" />
      )}
    </div>
  );
}

export default MessageText;
