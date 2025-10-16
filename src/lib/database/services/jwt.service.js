"use strict";
/**
 * JWT Service
 * Handles JWT token generation and verification
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.JWTService = void 0;
const jsonwebtoken_1 = require("jsonwebtoken");
class JWTService {
    constructor() {
        this.secret = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
        this.expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    }
    /**
     * Generate a JWT token
     */
    generateToken(payload) {
        return jsonwebtoken_1.default.sign(payload, this.secret, { expiresIn: this.expiresIn });
    }
    /**
     * Verify a JWT token
     */
    verifyToken(token) {
        try {
            return jsonwebtoken_1.default.verify(token, this.secret);
        }
        catch (error) {
            return null;
        }
    }
    /**
     * Decode a JWT token without verification
     */
    decodeToken(token) {
        return jsonwebtoken_1.default.decode(token);
    }
}
exports.JWTService = JWTService;
