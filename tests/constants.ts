/** A Postgres URL where nothing listens (port 1 on loopback). No imports: used by configs. */
export const UNREACHABLE_DB_URL = "postgres://nobody:nothing@127.0.0.1:1/none";

/** A random private client address, so tests don't share a rate-limit bucket. */
export const randomIp = () =>
  `10.${[1, 2, 3].map(() => Math.floor(Math.random() * 250)).join(".")}`;
