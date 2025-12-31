// =============================================================================
// FILE: frontend/src/components/ideation/UserMessage.tsx
// User message component
// =============================================================================

import 'react';
import { User } from 'lucide-react';
import type { UserMessageProps } from '../../types/ideation';

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="user-message flex gap-3 justify-end">
      <div className="flex-1 max-w-[80%]">
        <div className="bg-blue-600 text-white rounded-lg p-4 ml-auto">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-gray-600" />
        </div>
      </div>
    </div>
  );
}

export default UserMessage;
