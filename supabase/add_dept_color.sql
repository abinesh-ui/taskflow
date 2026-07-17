-- Run this in Supabase SQL Editor to add color column to departments
-- This allows departments to have color-coded indicators
ALTER TABLE departments ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#6b7280';
