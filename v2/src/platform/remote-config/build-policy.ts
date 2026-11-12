export function requiresAppUpdate(installedBuild: string, minimumBuild: number): boolean {
  const parsedBuild = Number.parseInt(installedBuild, 10);
  const minimum = Math.max(0, Math.floor(minimumBuild));
  return minimum > 0 && Number.isFinite(parsedBuild) && parsedBuild < minimum;
}
