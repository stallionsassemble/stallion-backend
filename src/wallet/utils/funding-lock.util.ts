/**
 * Serializes transactions submitted from the shared platform funding wallet.
 *
 * Every funding payment is sourced from the same account, and Stellar requires
 * strictly increasing sequence numbers per source account. If several funding
 * transactions are built concurrently they all load the same sequence number
 * and every one but the first fails with `tx_bad_seq`. This lock guarantees the
 * whole load-sequence → build → sign → submit cycle runs to completion for one
 * funding transaction before the next begins, so callers (e.g. paying out
 * multiple hackathon winners) can run everything else concurrently while the
 * funding-wallet submissions remain safely serialized.
 */
let fundingChain: Promise<unknown> = Promise.resolve();

export function withFundingWalletLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = fundingChain.then(() => fn());
  // Keep the chain alive regardless of whether this run succeeds or fails, so a
  // single failure doesn't wedge the queue for subsequent callers.
  fundingChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}
