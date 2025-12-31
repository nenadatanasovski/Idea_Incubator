// =============================================================================
// FILE: frontend/src/components/ideation/FormRenderer.tsx
// Dynamic form renderer for structured input
// =============================================================================

import { useState, useCallback } from 'react';
import type { FormRendererProps } from '../../types/ideation';
import type { FormField as BaseFormField } from '../../types';

// Create a unified field type for the component
interface FormFieldInput {
  id: string;
  name: string;
  type: 'text' | 'textarea' | 'radio' | 'checkbox' | 'slider' | 'dropdown' | 'date' | 'select';
  label: string;
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
  placeholder?: string;
}

// Convert FormDefinition fields to FormFieldInput
function normalizeField(field: BaseFormField): FormFieldInput {
  return {
    id: field.id,
    name: field.id, // Use id as name
    type: field.type === 'dropdown' ? 'select' : field.type as FormFieldInput['type'],
    label: field.label,
    options: field.options?.map(o => typeof o === 'string' ? o : o.value),
    min: field.min,
    max: field.max,
    required: field.required,
    placeholder: field.placeholder,
  };
}

export function FormRenderer({
  form,
  onSubmit,
  onCancel,
  disabled,
}: FormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  const handleFieldChange = useCallback((fieldName: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  }, [values, onSubmit]);

  const normalizedFields = form.fields.map(normalizeField);

  return (
    <form
      onSubmit={handleSubmit}
      className="form-renderer bg-white rounded-lg border border-gray-200 p-4 space-y-4"
    >
      {form.title && (
        <h3 className="font-semibold text-gray-900">{form.title}</h3>
      )}
      {form.description && (
        <p className="text-sm text-gray-600">{form.description}</p>
      )}

      <div className="space-y-4">
        {normalizedFields.map((field) => (
          <FormFieldComponent
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(value) => handleFieldChange(field.name, value)}
            disabled={disabled}
          />
        ))}
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={disabled}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                     disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {form.submitLabel || 'Submit'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={disabled}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function FormFieldComponent({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormFieldInput;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}) {
  switch (field.type) {
    case 'text':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                       focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          />
        </div>
      );

    case 'radio':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.name}
                  value={option}
                  checked={value === option}
                  onChange={() => onChange(option)}
                  disabled={disabled}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>
      );

    case 'checkbox':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            disabled={disabled}
            className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
          />
          <span className="text-gray-700">{field.label}</span>
        </label>
      );

    case 'slider':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}: {typeof value === 'number' ? value : (field.min ?? 0)}
          </label>
          <input
            type="range"
            min={field.min ?? 0}
            max={field.max ?? 100}
            value={(value as number) ?? field.min ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
            className="w-full"
          />
        </div>
      );

    case 'select':
      return (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2
                       focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
          >
            <option value="">Select...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );

    default:
      return null;
  }
}

export default FormRenderer;
