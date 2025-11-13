import type { Request, Response, NextFunction } from 'express';

// Simple API key authentication
// In production, use environment variables and more secure methods
const API_KEY = process.env.API_KEY || 'your-secret-api-key';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  next();
}
