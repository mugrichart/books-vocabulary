import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-jwt-secret-for-lexiflow';

export interface UserSession {
  userId: string;
  email: string;
}

export function generateToken(payload: UserSession): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserSession | null {
  try {
    return jwt.verify(token, JWT_SECRET) as UserSession;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  // Simple deterministic pbkdf2 hash using a fixed salt for ease of setup
  return crypto.pbkdf2Sync(password, 'lexiflow-salt-string-2026', 1000, 64, 'sha512').toString('hex');
}

export function getSession(req: NextRequest): UserSession | null {
  const token = req.cookies.get('token')?.value;
  if (!token) return null;
  return verifyToken(token);
}
