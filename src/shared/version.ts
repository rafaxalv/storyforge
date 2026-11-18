/**
 * The application version: APP_VERSION when set (e.g. a release tag), otherwise the
 * package.json version inlined at build time (Next config / esbuild define), otherwise
 * the npm-provided version when run through an npm script.
 */
export function appVersion(): string {
  return (
    process.env.APP_VERSION ||
    process.env.STORYFORGE_BUILD_VERSION ||
    process.env.npm_package_version ||
    "0.0.0-dev"
  );
}
