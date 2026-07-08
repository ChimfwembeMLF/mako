import { Request, Response, NextFunction } from 'express';

export function createBullBoardAuthMiddleware(
  username?: string,
  password?: string,
): ((req: Request, res: Response, next: NextFunction) => void) | undefined {
  const user = username?.trim();
  const pass = password?.trim();
  if (!pass) return undefined;

  return (req: Request, res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
      res.status(401).send('Authentication required');
      return;
    }

    const decoded = Buffer.from(header.slice(6), 'base64').toString('utf8');
    const colon = decoded.indexOf(':');
    const u = colon >= 0 ? decoded.slice(0, colon) : decoded;
    const p = colon >= 0 ? decoded.slice(colon + 1) : '';

    if (u === user && p === pass) {
      next();
      return;
    }

    res.setHeader('WWW-Authenticate', 'Basic realm="Bull Board"');
    res.status(401).send('Invalid credentials');
  };
}
