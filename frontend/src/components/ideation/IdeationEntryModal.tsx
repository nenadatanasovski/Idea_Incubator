// =============================================================================
// FILE: frontend/src/components/ideation/IdeationEntryModal.tsx
// Entry modal for choosing how to start ideation
// =============================================================================

import { Lightbulb, Compass, X } from 'lucide-react';
import type { IdeationEntryModalProps, EntryMode } from '../../types/ideation';

export function IdeationEntryModal({ isOpen, onSelect, onClose }: IdeationEntryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-2xl font-bold text-center mb-2">
          Start Your Ideation Journey
        </h2>
        <p className="text-gray-600 text-center mb-8">
          How would you like to begin?
        </p>

        <div className="space-y-4">
          <EntryOption
            icon={<Lightbulb className="w-8 h-8" />}
            title="I have an idea"
            description="Explore and validate an idea you already have in mind"
            mode="have_idea"
            onSelect={onSelect}
          />
          <EntryOption
            icon={<Compass className="w-8 h-8" />}
            title="Help me discover"
            description="Let's explore your interests and find opportunities together"
            mode="discover"
            onSelect={onSelect}
          />
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full text-gray-500 hover:text-gray-700 text-sm py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EntryOption({
  icon,
  title,
  description,
  mode,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  mode: EntryMode;
  onSelect: (mode: EntryMode) => void;
}) {
  return (
    <button
      onClick={() => onSelect(mode)}
      data-testid={`entry-mode-${mode}`}
      className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500
                 hover:bg-blue-50 transition-all flex items-start gap-4 text-left"
    >
      <div className="text-blue-600 mt-1">{icon}</div>
      <div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>
    </button>
  );
}

export default IdeationEntryModal;
