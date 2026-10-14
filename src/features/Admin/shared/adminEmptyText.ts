/**
 * Single placeholder for "no value" cells across Admin tables and detail
 * surfaces. Historically the Audit table used an em dash ('—') while
 * Content/UserDetail/Orders used a hyphen ('-'); the Admin domain now has one
 * constant so cell placeholders cannot drift per table again.
 */
export const ADMIN_EMPTY_TEXT = '-';

export default ADMIN_EMPTY_TEXT;
