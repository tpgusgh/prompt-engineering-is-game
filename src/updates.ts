// Update checks for the desktop app. Windows (NSIS) and Linux (AppImage)
// download and install new releases themselves via electron-updater; the Mac
// build only notifies and links to the release page, because macOS
// self-update (Squirrel.Mac) needs a Developer ID-signed app.
export const REPO = 'tpgusgh/prompt-engineering-is-game';
export const RELEASES_URL = `https://github.com/${REPO}/releases/latest`;
export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`;

const parse = (v: string) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
  return m ? m.slice(1).map(Number) : null;
};

export function isNewerVersion(candidate: string, current: string): boolean {
  const a = parse(candidate);
  const b = parse(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
}

export function updateMode(platform: string, env: Record<string, string | undefined>): 'install' | 'notify' {
  if (platform === 'win32') return 'install';
  if (platform === 'linux' && env.APPIMAGE) return 'install';
  return 'notify';
}

export type UpdateStatus =
  | { state: 'available'; version: string; url: string } // notify only: go download it
  | { state: 'downloading'; version: string }
  | { state: 'ready'; version: string } // downloaded: installs on restart
  | { state: 'latest'; version: string }; // a manual check found nothing newer
