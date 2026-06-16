import { Response } from 'express';
import { join } from 'path';
import {
  isClientDistAvailable,
  isServeClientEnabled,
  resolveClientDistPath,
  shouldBypassSpa,
} from './client-dist.util';

type SpaRequest = { method?: string; path?: string; url?: string };

/** Serve React index.html for client-side routes; returns true when handled. */
export function tryServeSpaShell(req: SpaRequest, res: Response): boolean {
  const path = req.path ?? req.url?.split('?')[0] ?? '';
  const serveClient = isServeClientEnabled() && isClientDistAvailable();
  const isGetOrHead = req.method === 'GET' || req.method === 'HEAD';

  if (serveClient && isGetOrHead && !shouldBypassSpa(path)) {
    res.sendFile(join(resolveClientDistPath(), 'index.html'));
    return true;
  }

  return false;
}
