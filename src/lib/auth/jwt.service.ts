/**
 * JWT Service for Token Management
 * Handles token generation, verification, and refresh
 */

import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

export interface TokenPayload {
  userId: string;
  email: string;
  role?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class JWTService {
  private static readonly ACCESS_TOKEN_SECRET = (() => {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret || secret.includes('change-in-production') || secret.length < 32) {
      throw new Error(
        'SECURITY ERROR: JWT_ACCESS_SECRET must be set to a strong secret (minimum 32 characters). ' +
        'Generate one with: openssl rand -base64 32'
      );
    }
    return secret;
  })();
  
  private static readonly REFRESH_TOKEN_SECRET = (() => {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret || secret.includes('change-in-production') || secret.length < 32) {
      throw new Error(
        'SECURITY ERROR: JWT_REFRESH_SECRET must be set to a strong secret (minimum 32 characters). ' +
        'Generate one with: openssl rand -base64 32'
      );
    }
    return secret;
  })();
  
  private static readonly ACCESS_TOKEN_EXPIRY = '24h'; // 24 hours
  private static readonly REFRESH_TOKEN_EXPIRY = '7d'; // 7 days

  /**
   * Generate access and refresh token pair
   */
  static generateTokenPair(payload: TokenPayload): TokenPair {
    const jti = uuidv4(); // Unique token identifier

    const accessToken = jwt.sign(
      { ...payload, jti, type: 'access' },
      this.ACCESS_TOKEN_SECRET,
      { expiresIn: this.ACCESS_TOKEN_EXPIRY }
    );

    const refreshToken = jwt.sign(
      { userId: payload.userId, jti, type: 'refresh' },
      this.REFRESH_TOKEN_SECRET,
      { expiresIn: this.REFRESH_TOKEN_EXPIRY }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 24 * 60 * 60, // 24 hours in seconds
    };
  }

  /**
   * Verify access token
   */
  static verifyAccessToken(token: string): TokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET) as any;
      
      if (decoded.type !== 'access') {
        return null;
      }

      return {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
    } catch (error) {
      console.error('Access token verification failed:', error);
      return null;
    }
  }

  /**
   * Verify refresh token
   */
  static verifyRefreshToken(token: string): { userId: string } | null {
    try {
      const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET) as any;
      
      if (decoded.type !== 'refresh') {
        return null;
      }

      return { userId: decoded.userId };
    } catch (error) {
      console.error('Refresh token verification failed:', error);
      return null;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  static decode(token: string): any {
    return jwt.decode(token);
  }

  /**
   * Check if token is expired
   */
  static isExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (!decoded || !decoded.exp) return true;
      
      return Date.now() >= decoded.exp * 1000;
    } catch {
      return true;
    }
  }
}
