/** External addresses the app links to — plain links, nothing is contacted until the user opens one. */

/**
 * This deployment is a fork: source code lives here, and the "Codice sorgente"
 * link in the Info page points to it.
 */
export const FORK_REPOSITORY_URL = 'https://github.com/Gianluca-Di-Stefano/rotazionivolley_FT';

/**
 * The upstream this fork was taken from (Maurizio Napolitano's rotazionivolley).
 * The native installers (Windows/macOS/Linux/Android) are published on its
 * GitHub Releases, so releaseDownloads() builds URLs against this origin.
 */
export const SOURCE_REPOSITORY_URL = 'https://github.com/napo/rotazionivolley';

/** The original project rotazionivolley itself derives from (Apache 2.0). */
export const UPSTREAM_VBROTATIONS_URL = 'https://github.com/monkeysppp/VBRotations';

/**
 * Direct links to this version's installers on its GitHub Release, named as
 * the release workflows upload them (GitHub turns the space in "Rotazioni
 * Volley" into a dot). The web build carries the same version as the release.
 */
export function releaseDownloads(version: string): { label: string; href: string }[] {
  const base = `${SOURCE_REPOSITORY_URL}/releases/download/v${version}/Rotazioni.Volley`;
  return [
    { label: 'Windows (.exe)', href: `${base}_${version}_x64-setup.exe` },
    { label: 'Windows (.msi)', href: `${base}_${version}_x64_en-US.msi` },
    { label: 'macOS Apple Silicon (.dmg)', href: `${base}_${version}_aarch64.dmg` },
    { label: 'Linux (.AppImage)', href: `${base}_${version}_amd64.AppImage` },
    { label: 'Linux (.deb)', href: `${base}_${version}_amd64.deb` },
    { label: 'Linux (.rpm)', href: `${base}-${version}-1.x86_64.rpm` },
    { label: 'Android (.apk)', href: `${base}-${version}.apk` },
  ];
}
