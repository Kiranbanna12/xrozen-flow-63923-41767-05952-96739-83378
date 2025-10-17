-- Security Fix Part 1: Add 'admin' role to app_role enum
-- This must be done in a separate transaction before using it

ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'admin';