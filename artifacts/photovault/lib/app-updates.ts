import Constants from 'expo-constants';
import * as Updates from 'expo-updates';

export type AppUpdateCheck =
  | { status: 'not-configured' }
  | { status: 'up-to-date'; currentVersion: string; latestVersion: string }
  | { status: 'ota'; isAvailable: true }
  | { status: 'apk'; version: string; downloadUrl: string };

type GithubRelease = {
  tag_name?: unknown;
  assets?: unknown;
};

function getRepository(): string {
  const repository =
    process.env.EXPO_PUBLIC_GITHUB_REPOSITORY?.trim() || 'AFFAN-SHAIK-07/PhotoVault';

  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) {
    throw new Error('EXPO_PUBLIC_GITHUB_REPOSITORY must use the owner/repository format.');
  }

  return repository;
}

function parseVersion(version: string): number[] {
  const match = version.trim().match(/^v?(\d+(?:\.\d+){1,3})(?:[-+].*)?$/i);
  if (!match) throw new Error(`Unrecognized PhotoVault release version: ${version}`);
  return match[1].split('.').map(Number);
}

function isNewerVersion(candidate: string, current: string): boolean {
  const candidateParts = parseVersion(candidate);
  const currentParts = parseVersion(current);

  for (let index = 0; index < Math.max(candidateParts.length, currentParts.length); index++) {
    const candidatePart = candidateParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;
    if (candidatePart !== currentPart) return candidatePart > currentPart;
  }

  return false;
}

export async function checkForAppUpdate(): Promise<AppUpdateCheck> {
  if (Updates.isEnabled) {
    const update = await Updates.checkForUpdateAsync();
    if (update.isAvailable) return { status: 'ota', isAvailable: true };
  }

  const repository = getRepository();

  const response = await fetch(
    `https://api.github.com/repos/${repository}/releases/latest`,
    { headers: { Accept: 'application/vnd.github+json' } },
  );
  if (!response.ok) {
    throw new Error(`GitHub release check failed with HTTP ${response.status}.`);
  }

  const release = (await response.json()) as GithubRelease;
  if (typeof release.tag_name !== 'string' || !Array.isArray(release.assets)) {
    throw new Error('The latest GitHub release does not have valid release metadata.');
  }

  const apk = release.assets.find(
    (asset): asset is { name: string; browser_download_url: string } =>
      typeof asset === 'object' &&
      asset !== null &&
      'name' in asset &&
      typeof asset.name === 'string' &&
      /^photovault-.*\.apk$/i.test(asset.name) &&
      'browser_download_url' in asset &&
      typeof asset.browser_download_url === 'string' &&
      asset.browser_download_url.startsWith('https://'),
  );
  if (!apk) throw new Error('The latest GitHub release does not include a PhotoVault APK.');

  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
  return isNewerVersion(release.tag_name, currentVersion)
    ? {
        status: 'apk',
        version: release.tag_name.replace(/^v/i, ''),
        downloadUrl: apk.browser_download_url,
      }
    : {
        status: 'up-to-date',
        currentVersion,
        latestVersion: release.tag_name.replace(/^v/i, ''),
      };
}

export async function installOtaUpdate(): Promise<void> {
  const result = await Updates.fetchUpdateAsync();
  if (!result.isNew) {
    throw new Error('The PhotoVault update could not be downloaded.');
  }
  await Updates.reloadAsync();
}
