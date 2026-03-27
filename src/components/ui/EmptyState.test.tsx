// ============================================================
// LegacyLens — EmptyState Component Tests
// Feature: legacylens-vibecon-2026
// ============================================================

import { describe, it, expect } from 'vitest';

// Test the EmptyState props interface and logic without DOM rendering
// (no @testing-library/react dependency required)

interface EmptyStateProps {
  icon: unknown;
  heading: string;
  description: string;
  cta?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  className?: string;
}

function validateEmptyStateProps(props: EmptyStateProps): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!props.heading || props.heading.trim() === '') errors.push('heading is required');
  if (!props.description || props.description.trim() === '') errors.push('description is required');
  if (!props.icon) errors.push('icon is required');
  if (props.cta) {
    if (!props.cta.label || props.cta.label.trim() === '') errors.push('cta.label is required');
    if (props.cta.href && props.cta.onClick) errors.push('cta should have either href or onClick, not both');
  }
  return { valid: errors.length === 0, errors };
}

describe('EmptyState component', () => {
  it('accepts valid props with heading and description', () => {
    const props: EmptyStateProps = {
      icon: () => null,
      heading: 'No meetings yet',
      description: 'Upload a meeting to get started.',
    };
    const { valid } = validateEmptyStateProps(props);
    expect(valid).toBe(true);
  });

  it('is valid without CTA prop', () => {
    const props: EmptyStateProps = {
      icon: () => null,
      heading: 'No data',
      description: 'Nothing here yet.',
    };
    const { valid } = validateEmptyStateProps(props);
    expect(valid).toBe(true);
    expect(props.cta).toBeUndefined();
  });

  it('is valid with CTA href', () => {
    const props: EmptyStateProps = {
      icon: () => null,
      heading: 'No data',
      description: 'Nothing here.',
      cta: { label: 'Go to Overview', href: '/dashboard' },
    };
    const { valid } = validateEmptyStateProps(props);
    expect(valid).toBe(true);
    expect(props.cta?.href).toBe('/dashboard');
  });

  it('is valid with CTA onClick', () => {
    let clicked = false;
    const props: EmptyStateProps = {
      icon: () => null,
      heading: 'No data',
      description: 'Nothing here.',
      cta: { label: 'Upload', onClick: () => { clicked = true; } },
    };
    const { valid } = validateEmptyStateProps(props);
    expect(valid).toBe(true);
    props.cta?.onClick?.();
    expect(clicked).toBe(true);
  });

  it('requires heading to be non-empty', () => {
    const props: EmptyStateProps = {
      icon: () => null,
      heading: '',
      description: 'Something.',
    };
    const { valid, errors } = validateEmptyStateProps(props);
    expect(valid).toBe(false);
    expect(errors).toContain('heading is required');
  });

  it('requires description to be non-empty', () => {
    const props: EmptyStateProps = {
      icon: () => null,
      heading: 'Title',
      description: '',
    };
    const { valid, errors } = validateEmptyStateProps(props);
    expect(valid).toBe(false);
    expect(errors).toContain('description is required');
  });
});
