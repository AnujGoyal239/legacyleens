// ============================================================
// LegacyLens — Runbook Service Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import { extractEnvVarsFromText } from './runbook.js';

describe('extractEnvVarsFromText', () => {
  it('extracts process.env.FOO', () => {
    const vars = extractEnvVarsFromText('const x = process.env.DATABASE_URL;');
    expect(vars.has('DATABASE_URL')).toBe(true);
  });

  it('extracts process.env[\"FOO\"]', () => {
    const vars = extractEnvVarsFromText('const x = process.env[\"REDIS_URL\"];');
    expect(vars.has('REDIS_URL')).toBe(true);
  });

  it('ignores lowercase env names', () => {
    const vars = extractEnvVarsFromText('process.env.node_env');
    expect(vars.size).toBe(0);
  });
});

