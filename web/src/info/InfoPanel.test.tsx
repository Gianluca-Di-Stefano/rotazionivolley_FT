import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SOURCE_REPOSITORY_URL } from '../links';
import { APP_VERSION } from '../version';
import { renderWithProviders } from '../testUtils';
import { InfoPanel } from './InfoPanel';

describe('InfoPanel — downloads', () => {
  it('links each platform installer of the current version on its GitHub Release', () => {
    renderWithProviders(<InfoPanel onClose={() => {}} />);
    const base = `${SOURCE_REPOSITORY_URL}/releases/download/v${APP_VERSION}/`;
    for (const name of ['Windows (.exe)', 'macOS Apple Silicon (.dmg)', 'Linux (.AppImage)', 'Android (.apk)']) {
      expect(screen.getByRole('link', { name }).getAttribute('href')).toMatch(new RegExp(`^${base.replace(/[.?]/g, '\\$&')}Rotazioni\\.Volley[_-]${APP_VERSION.replace(/\./g, '\\.')}`));
    }
    expect(screen.getByRole('link', { name: 'GitHub Releases' })).toHaveAttribute('href', `${SOURCE_REPOSITORY_URL}/releases`);
  });
});
