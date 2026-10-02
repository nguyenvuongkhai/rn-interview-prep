export type UpdateMode = 'none' | 'soft' | 'force';

export function decideUpdate(installed: string, latest: string, minSupported: string): UpdateMode {
  // TODO: compare the versions as semver and pick the update mode
  throw new Error('Not implemented');
}
