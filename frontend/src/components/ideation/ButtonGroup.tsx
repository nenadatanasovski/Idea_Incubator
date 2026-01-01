// =============================================================================
// FILE: frontend/src/components/ideation/ButtonGroup.tsx
// Button group for quick actions
// =============================================================================

import 'react';
import type { ButtonGroupProps } from '../../types/ideation';

export function ButtonGroup({
  buttons,
  onSelect,
  disabled,
  selectedId,
}: ButtonGroupProps) {
  return (
    <div className="button-group flex flex-wrap gap-2">
      {buttons.map((button) => {
        const isSelected = selectedId === button.id;
        const isDisabled = disabled || (selectedId !== undefined && !isSelected);

        const baseClasses = 'px-4 py-2 rounded-lg text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2';
        const styleClasses = getButtonStyles(button.style, isSelected, isDisabled);

        return (
          <button
            key={button.id}
            data-testid={`action-btn-${button.id}`}
            onClick={() => onSelect(button.id, button.value, button.label)}
            disabled={isDisabled}
            className={`${baseClasses} ${styleClasses} ${button.fullWidth ? 'w-full' : ''}`}
          >
            {button.icon && <span className="mr-2">{button.icon}</span>}
            {button.label}
          </button>
        );
      })}
    </div>
  );
}

function getButtonStyles(
  style: 'primary' | 'secondary' | 'outline' | 'danger',
  isSelected: boolean,
  isDisabled: boolean
): string {
  if (isDisabled && !isSelected) {
    return 'bg-gray-100 text-gray-400 cursor-not-allowed';
  }

  if (isSelected) {
    switch (style) {
      case 'primary':
        return 'bg-blue-600 text-white ring-2 ring-blue-300';
      case 'danger':
        return 'bg-red-600 text-white ring-2 ring-red-300';
      default:
        return 'bg-gray-700 text-white ring-2 ring-gray-300';
    }
  }

  switch (style) {
    case 'primary':
      return 'bg-blue-100 text-blue-700 hover:bg-blue-200 border border-blue-200';
    case 'secondary':
      return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200';
    case 'outline':
      return 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300';
    case 'danger':
      return 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200';
  }
}

export default ButtonGroup;
