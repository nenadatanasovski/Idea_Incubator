// =============================================================================
// FILE: frontend/src/components/ideation/MessageText.tsx
// Message text with markdown rendering
// =============================================================================

import 'react';
import type { MessageTextProps } from '../../types/ideation';

export function MessageText({ content, isStreaming = false }: MessageTextProps) {
  // Simple markdown-like rendering
  const renderContent = () => {
    // Split by double newlines for paragraphs
    const paragraphs = content.split(/\n\n+/);

    return paragraphs.map((paragraph, index) => {
      // Check for bullet points
      if (paragraph.trim().startsWith('- ') || paragraph.trim().startsWith('* ')) {
        const items = paragraph.split(/\n/).filter(line => line.trim());
        return (
          <ul key={index} className="list-disc list-inside space-y-1 mb-2">
            {items.map((item, i) => (
              <li key={i} className="text-gray-800">
                {item.replace(/^[-*]\s+/, '')}
              </li>
            ))}
          </ul>
        );
      }

      // Check for numbered list
      if (/^\d+\./.test(paragraph.trim())) {
        const items = paragraph.split(/\n/).filter(line => line.trim());
        return (
          <ol key={index} className="list-decimal list-inside space-y-1 mb-2">
            {items.map((item, i) => (
              <li key={i} className="text-gray-800">
                {item.replace(/^\d+\.\s*/, '')}
              </li>
            ))}
          </ol>
        );
      }

      // Regular paragraph with basic formatting
      const formatted = paragraph
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 rounded text-sm">$1</code>');

      return (
        <p
          key={index}
          className="text-gray-800 mb-2 last:mb-0"
          dangerouslySetInnerHTML={{ __html: formatted }}
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
