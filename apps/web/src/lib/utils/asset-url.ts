/** Base path for production deployment — must match next.config.js basePath */
export const BASE_PATH = '/lab/curious';

/** Prepend basePath to a public asset path (e.g. "/glb/sword.glb" → "/lab/curious/glb/sword.glb") */
export function assetUrl(path: string): string {
  return `${BASE_PATH}${path}`;
}
