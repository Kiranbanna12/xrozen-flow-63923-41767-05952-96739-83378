/**
 * JWT Service
 * Handles JWT token generation and verification
 */

import jwt from 'jsonwebtoken';

export class JWTService {
  private readonly secret: string;
  private readonly expiresIn: string;

  constructor() {
    const secret = process.env.JWT_SECRET;
    
    // SECURITY: Fail fast if JWT_SECRET is not properly configured
    if (!secret || secret.includes('change-in-production') || secret.length < 32) {
      throw new Error(
        'SECURITY ERROR: JWT_SECRET must be set to a strong secret (minimum 32 characters). ' +
        'Generate one with: openssl rand -base64 32'
      );
    }
    
    this.secret = secret;
    this.expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  }

  /**
   * Generate a JWT token
   */
  generateToken(payload: any): string {
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn } as jwt.SignOptions);
  }

  /**
   * Verify a JWT token
   */
  verifyToken(token: string): any {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      return null;
    }
  }

  /**
   * Decode a JWT token without verification
   */
  decodeToken(token: string): any {
    return jwt.decode(token);
  }
}
