import { BadRequestException } from '@nestjs/common';

export interface SubmissionField {
  name: string;
  label: string;
  type: 'text' | 'url' | 'number' | 'textarea';
  required: boolean;
  placeholder?: string;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
  };
}

/**
 * Validates submission data against bounty's submission fields
 */
export function validateSubmissionData(
  submissionData: Record<string, any> | undefined,
  submissionFields: SubmissionField[] | undefined,
): void {
  // If no submission fields are defined, no validation needed
  if (!submissionFields || submissionFields.length === 0) {
    return;
  }

  // If submission fields are required but no data provided
  if (!submissionData) {
    const requiredFields = submissionFields.filter((field) => field.required);
    if (requiredFields.length > 0) {
      throw new BadRequestException(
        `Missing required submission fields: ${requiredFields.map((f) => f.label).join(', ')}`,
      );
    }
    return;
  }

  // Validate each required field
  for (const field of submissionFields) {
    const value = submissionData[field.name];

    // Check required fields
    if (
      field.required &&
      (value === undefined || value === null || value === '')
    ) {
      throw new BadRequestException(`Field "${field.label}" is required`);
    }

    // Skip validation if field is optional and not provided
    if (!field.required && (value === undefined || value === null)) {
      continue;
    }

    // Type validation
    switch (field.type) {
      case 'number':
        if (typeof value !== 'number' || isNaN(value)) {
          throw new BadRequestException(
            `Field "${field.label}" must be a valid number`,
          );
        }
        // Min/Max validation
        if (
          field.validation?.min !== undefined &&
          value < field.validation.min
        ) {
          throw new BadRequestException(
            `Field "${field.label}" must be at least ${field.validation.min}`,
          );
        }
        if (
          field.validation?.max !== undefined &&
          value > field.validation.max
        ) {
          throw new BadRequestException(
            `Field "${field.label}" must be at most ${field.validation.max}`,
          );
        }
        break;

      case 'url':
        if (typeof value !== 'string') {
          throw new BadRequestException(
            `Field "${field.label}" must be a string`,
          );
        }
        // Basic URL validation
        try {
          new URL(value);
        } catch {
          throw new BadRequestException(
            `Field "${field.label}" must be a valid URL`,
          );
        }
        break;

      case 'text':
      case 'textarea':
        if (typeof value !== 'string') {
          throw new BadRequestException(
            `Field "${field.label}" must be a string`,
          );
        }
        // Length validation
        if (
          field.validation?.min !== undefined &&
          value.length < field.validation.min
        ) {
          throw new BadRequestException(
            `Field "${field.label}" must be at least ${field.validation.min} characters`,
          );
        }
        if (
          field.validation?.max !== undefined &&
          value.length > field.validation.max
        ) {
          throw new BadRequestException(
            `Field "${field.label}" must be at most ${field.validation.max} characters`,
          );
        }
        // Pattern validation
        if (field.validation?.pattern) {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            throw new BadRequestException(
              `Field "${field.label}" does not match the required format`,
            );
          }
        }
        break;

      default:
        break;
    }
  }
}
