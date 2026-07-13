import * as StellarSDK from '@stellar/stellar-sdk';
import axios from 'axios';
import http from 'http';
import https from 'https';

/**
 * Max inclusion fee (in stroops) bid for contract-invocation transactions.
 *
 * BASE_FEE (100) is too low: during network surge pricing an underpriced
 * Soroban transaction is accepted by the RPC (status PENDING) but never gets
 * included in a ledger, so getTransaction polling returns NOT_FOUND until the
 * transaction expires — surfacing as TransactionStillPendingError after the
 * full 300s wait. This value is only a *cap*; the network charges the going
 * inclusion rate, not the cap, so raising it costs nothing on a calm network.
 */
export const CONTRACT_INCLUSION_FEE = '1000000'; // 0.1 XLM

/**
 * Build a Soroban RPC server whose underlying HTTP connection is kept alive,
 * so a whole stateful invocation (getAccount -> simulate -> sendTransaction ->
 * getTransaction polling) sticks to ONE backend node.
 *
 * The public RPC endpoint is a fleet behind a load balancer. We disable HTTP
 * keep-alive globally (see http-agent.config.ts) so a bad Horizon node can't
 * stay pinned for read-only account lookups — but that also scatters each RPC
 * request across different nodes. For submit/poll that scatter is harmful: a
 * transaction submitted via one node may be polled on another that never saw
 * it (or submitted via a degraded node that never propagates it), producing
 * PENDING -> perpetual NOT_FOUND. Pinning the flow to a single kept-alive
 * connection restores the correct, previously-working RPC behavior.
 */
export function createSorobanRpcServer(rpcUrl: string): StellarSDK.rpc.Server {
  const allowHttp = rpcUrl.startsWith('http://');

  const prevHttpsAgent = axios.defaults.httpsAgent;
  const prevHttpAgent = axios.defaults.httpAgent;

  // rpc.Server construction is synchronous and snapshots axios.defaults into
  // its own axios instance, so temporarily swapping in keep-alive agents
  // yields a keep-alive server without affecting the global (Horizon) default.
  axios.defaults.httpsAgent = new https.Agent({ keepAlive: true });
  axios.defaults.httpAgent = new http.Agent({ keepAlive: true });
  try {
    return new StellarSDK.rpc.Server(rpcUrl, { allowHttp });
  } finally {
    axios.defaults.httpsAgent = prevHttpsAgent;
    axios.defaults.httpAgent = prevHttpAgent;
  }
}

/**
 * Build the options for a contract-bindings `Client`, pre-wired with a
 * kept-alive RPC server (node stickiness) and a surge-proof inclusion fee.
 *
 * The base `ClientOptions` type omits `fee`, but the SDK spreads the client
 * options into every method call, so a client-level `fee` is honored at
 * runtime (see @stellar/stellar-sdk contract/client.js). Returning the extra
 * `fee` field on a typed (non-literal) object keeps it assignable to
 * `ClientOptions` without an `any` cast at each call site.
 */
export function buildSorobanContractOptions(params: {
  contractId: string;
  networkPassphrase: string;
  rpcUrl: string;
}): StellarSDK.contract.ClientOptions & { fee: string } {
  return {
    contractId: params.contractId,
    networkPassphrase: params.networkPassphrase,
    rpcUrl: params.rpcUrl,
    server: createSorobanRpcServer(params.rpcUrl),
    fee: CONTRACT_INCLUSION_FEE,
  };
}
