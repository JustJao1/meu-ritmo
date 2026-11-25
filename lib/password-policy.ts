/**
 * Shared new-password policy for signup, reset and authenticated password changes.
 * Existing passwords are NOT rejected at login: users can keep logging in to migrate.
 */
export const PASSWORD_GUIDANCE='A senha deve conter pelo menos uma letra e um símbolo.';
export const MAX_PASSWORD_LENGTH=128;
export function passwordMeetsPolicy(value:unknown):value is string{
  return typeof value==='string'
    && value.length<=MAX_PASSWORD_LENGTH
    && /\p{L}/u.test(value)
    && /[\p{P}\p{S}]/u.test(value);
}
