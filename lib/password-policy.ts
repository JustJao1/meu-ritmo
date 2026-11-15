/**
 * Shared new-password policy for signup, reset and authenticated password changes.
 * Existing passwords are NOT rejected at login: users can keep logging in to migrate.
 */
export const PASSWORD_GUIDANCE='Use de 8 a 128 caracteres, com letra maiúscula, minúscula, número e símbolo.';
export const MIN_PASSWORD_LENGTH=8;
export const MAX_PASSWORD_LENGTH=128;
export function passwordMeetsPolicy(value:unknown):value is string{
  return typeof value==='string'
    && value.length>=MIN_PASSWORD_LENGTH
    && value.length<=MAX_PASSWORD_LENGTH
    && /[a-z]/.test(value)
    && /[A-Z]/.test(value)
    && /[0-9]/.test(value)
    && /[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e]/.test(value);
}
