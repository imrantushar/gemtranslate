/**
 * Current user's access level, injected by PHP into `window.gtrans.currentUser`.
 * Managers (admins) see the whole app; translators only see their assigned work.
 */
const USER = (typeof window !== 'undefined' && window.gtrans && window.gtrans.currentUser) || {};

export const canManage = !!USER.canManage;
