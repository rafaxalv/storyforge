import pkg from "../../package.json";

/** The application version: APP_VERSION when set (e.g. a release tag), else package.json's. */
export function appVersion(): string {
  return process.env.APP_VERSION || pkg.version;
}
