import { SetMetadata } from '@nestjs/common';

export const SKIP_AUDIT_KEY = 'skipAudit';

/** Opt out of automatic HTTP request audit logging for a route or controller. */
export const SkipAudit = () => SetMetadata(SKIP_AUDIT_KEY, true);
