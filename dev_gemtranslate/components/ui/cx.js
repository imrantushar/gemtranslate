/**
 * Tiny classNames joiner. Filters out falsy values so callers can do
 * `cx('base', cond && 'extra', className)` without leaking `false`/`undefined`
 * into the class string.
 */
export const cx = (...parts) => parts.filter(Boolean).join(' ');
