import { isAuthorizationFailure } from './network-error';

export type AdminAccessState = 'loading' | 'allowed' | 'denied' | 'no-organization' | 'unavailable';

/** Only an actual authorization response establishes denied access. */
export function accessAfterFailure(cause: unknown): 'denied' | 'unavailable' {
  return isAuthorizationFailure(cause) ? 'denied' : 'unavailable';
}

export function canShowProtectedContent(access: AdminAccessState): boolean {
  return access === 'allowed';
}
