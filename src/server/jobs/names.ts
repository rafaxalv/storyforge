/** pg-boss queue names. One place, so senders and the worker can't drift apart. */
export const QUEUES = {
  accountPurge: "account.purge",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];
