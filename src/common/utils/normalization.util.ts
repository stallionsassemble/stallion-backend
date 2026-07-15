import { BadRequestException } from '@nestjs/common';
import {
  CountryCode,
  isSupportedCountry,
  parsePhoneNumberWithError,
} from 'libphonenumber-js';

/**
 * Normalize an email address to a canonical form for storage and lookups.
 *
 * Only casing and surrounding whitespace are normalized. We deliberately do NOT
 * strip dots or "+tag" suffixes (gmail-style canonicalization) because that
 * changes the identity of the address and could collide two genuinely different
 * accounts or lock a user out.
 */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Normalize a phone number to E.164 (e.g. "+2349012345678").
 *
 * Accepts:
 *  - An already-E.164 number (starting with "+"), validated as-is.
 *  - A local/national number (e.g. "09012345678") together with an ISO 3166-1
 *    alpha-2 country code (e.g. "NG") used to resolve the country calling code.
 *
 * Throws BadRequestException on anything that cannot be parsed into a valid
 * phone number.
 *
 * @param raw     Raw phone input from the client.
 * @param country ISO 3166-1 alpha-2 country code, used as the default region
 *                when `raw` is not already in E.164 form.
 */
export function normalizePhoneNumber(raw: string, country?: string): string {
  const trimmed = (raw ?? '').trim();

  if (!trimmed) {
    throw new BadRequestException('Phone number is required');
  }

  const defaultCountry = normalizeCountryCode(country);

  // A bare local number cannot be resolved without knowing the country.
  if (!trimmed.startsWith('+') && !defaultCountry) {
    throw new BadRequestException(
      'A country is required to interpret a local phone number. ' +
        'Provide the number in international format (e.g. +2349012345678) or include a country.',
    );
  }

  try {
    const phone = parsePhoneNumberWithError(
      trimmed,
      defaultCountry ? { defaultCountry } : undefined,
    );

    if (!phone.isValid()) {
      throw new BadRequestException('Invalid phone number');
    }

    return phone.number; // E.164 format
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException('Invalid phone number');
  }
}

/**
 * Validate and normalize an ISO 3166-1 alpha-2 country code (e.g. "ng" -> "NG").
 * Returns undefined for empty input; throws for a non-empty but unsupported code.
 */
export function normalizeCountryCode(
  country?: string,
): CountryCode | undefined {
  const trimmed = (country ?? '').trim().toUpperCase();
  if (!trimmed) {
    return undefined;
  }
  if (!isSupportedCountry(trimmed)) {
    throw new BadRequestException(`Unsupported country code: ${country}`);
  }
  return trimmed;
}
