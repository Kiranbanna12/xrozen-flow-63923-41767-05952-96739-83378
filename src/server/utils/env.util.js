"use strict";
/**
 * Environment Configuration Utility
 * Loads environment variables from env.config file
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvironmentConfig = loadEnvironmentConfig;
exports.getEnvVar = getEnvVar;
exports.getEnvVarAsNumber = getEnvVarAsNumber;
exports.getEnvVarAsBoolean = getEnvVarAsBoolean;
const fs_1 = require("fs");
const path_1 = require("path");
function loadEnvironmentConfig() {
    const envConfigPath = path_1.default.join(process.cwd(), 'env.config');
    try {
        if (fs_1.default.existsSync(envConfigPath)) {
            const envContent = fs_1.default.readFileSync(envConfigPath, 'utf8');
            const lines = envContent.split('\n');
            for (const line of lines) {
                const trimmedLine = line.trim();
                // Skip empty lines and comments
                if (!trimmedLine || trimmedLine.startsWith('#')) {
                    continue;
                }
                // Parse KEY=VALUE format
                const equalIndex = trimmedLine.indexOf('=');
                if (equalIndex > 0) {
                    const key = trimmedLine.substring(0, equalIndex).trim();
                    const value = trimmedLine.substring(equalIndex + 1).trim();
                    // Only set if not already defined in process.env
                    if (!process.env[key]) {
                        process.env[key] = value;
                    }
                }
            }
            console.log('✅ Environment configuration loaded from env.config');
        }
        else {
            console.warn('⚠️ env.config file not found, using system environment variables');
        }
    }
    catch (error) {
        console.error('❌ Failed to load environment configuration:', error);
    }
}
function getEnvVar(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new Error(`Environment variable ${key} is not defined`);
    }
    return value;
}
function getEnvVarAsNumber(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new Error(`Environment variable ${key} is not defined`);
    }
    const parsed = parseInt(value, 10);
    if (isNaN(parsed)) {
        throw new Error(`Environment variable ${key} is not a valid number: ${value}`);
    }
    return parsed;
}
function getEnvVarAsBoolean(key, defaultValue) {
    const value = process.env[key];
    if (value === undefined) {
        if (defaultValue !== undefined) {
            return defaultValue;
        }
        throw new Error(`Environment variable ${key} is not defined`);
    }
    return value.toLowerCase() === 'true' || value === '1';
}
