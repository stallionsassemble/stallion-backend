import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsEmail, IsString } from 'class-validator';
import {
  normalizeEmail,
  normalizePhoneNumber,
} from '../utils/normalization.util';

/**
 * Normalizes an email to a canonical form (trim + lowercase) before validation,
 * then validates it as an email. Use in place of `@IsEmail()`.
 */
export function NormalizeEmail(): PropertyDecorator {
  return applyDecorators(
    Transform(({ value }) =>
      typeof value === 'string' ? normalizeEmail(value) : value,
    ),
    IsEmail(),
  );
}

/**
 * Normalizes a phone number to E.164 before validation. A local number is
 * resolved using the sibling `country` field (ISO 3166-1 alpha-2) on the same
 * DTO; an already-international (+...) number is accepted regardless of country.
 *
 * Throws BadRequestException (surfaced as HTTP 400) for invalid numbers.
 */
export function NormalizePhone(): PropertyDecorator {
  return applyDecorators(
    IsString(),
    Transform(({ value, obj }) =>
      typeof value === 'string'
        ? normalizePhoneNumber(value, obj?.country)
        : value,
    ),
  );
}
