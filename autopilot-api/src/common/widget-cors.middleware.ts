import type { NextFunction, Request, Response } from 'express';

/** CORS for embeddable widget API only (third-party sites embedding the chatbot). */
export function widgetCorsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    if (!res.getHeader('Access-Control-Allow-Origin')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Vary', 'Origin');
  } else if (!res.getHeader('Access-Control-Allow-Origin')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET,POST,PUT,DELETE,PATCH,OPTIONS',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Visitor-Id, Accept',
  );

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  next();
}
