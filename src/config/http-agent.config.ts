import axios from 'axios';
import http from 'http';
import https from 'https';

/**
 * Horizon (horizon.stellar.org) is a fleet of instances behind a load
 * balancer. Node >= 19 enables HTTP keep-alive by default, and the Stellar
 * SDK uses the global axios instance, so a single pooled socket gets pinned
 * to one Horizon backend for the whole process lifetime. If that backend
 * degrades (lagging ingestion, mid-reingest, rate-limiting), it returns 404
 * "Resource Missing" for accounts that exist on the other nodes — making
 * every account lookup in the app fail at once until the process restarts.
 *
 * Disabling keep-alive forces each request onto a fresh connection that can
 * be re-load-balanced to a healthy node. This costs a TLS handshake per
 * request but removes the "one bad node poisons everything" failure mode.
 *
 * Must be called before any Stellar SDK request is issued.
 */
export function configureStellarHttpAgents(): void {
  axios.defaults.httpAgent = new http.Agent({ keepAlive: false });
  axios.defaults.httpsAgent = new https.Agent({ keepAlive: false });
}
