/**
 * Application Configuration & Environment Variables
 * Single source of truth for runtime network config and feature flags.
 */

const DEFAULT_BACKEND_HOST = 'muteahhit-online-backend.onrender.com';

function resolveHostname() {
  if (typeof window === 'undefined') return DEFAULT_BACKEND_HOST;
  const envHost = import.meta.env.VITE_PEER_HOST;
  if (envHost && envHost.trim()) return envHost.trim();

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
  if (isLocalhost) return 'localhost';
  if (hostname.includes('onrender.com')) return hostname;
  return DEFAULT_BACKEND_HOST;
}

function resolvePort() {
  if (typeof window === 'undefined') return 443;
  const envPort = import.meta.env.VITE_PEER_PORT;
  if (envPort) return Number(envPort);

  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
  if (isLocalhost) return 3000;
  return 443;
}

const isLocal = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.startsWith('192.168.')
);

const host = resolveHostname();
const port = resolvePort();
const isLocalhost = host === 'localhost' || isLocal;

export const ENV = {
  IS_LOCAL: isLocal,
  IS_PROD: import.meta.env.PROD,
  IS_DEV: import.meta.env.DEV,

  DEFAULT_BACKEND_HOST,
  PEER_HOST: host,
  PEER_PORT: port,
  PEER_PATH: import.meta.env.VITE_PEER_PATH || '/peerjs',
  PEER_SECURE: isLocalhost ? false : (import.meta.env.VITE_PEER_SECURE !== 'false'),

  get RELAY_PROTOCOL() {
    return this.PEER_SECURE ? 'wss:' : 'ws:';
  },

  get HTTP_PROTOCOL() {
    return this.PEER_SECURE ? 'https:' : 'http:';
  },

  get RELAY_URL() {
    if (this.PEER_HOST === 'localhost') {
      return `ws://localhost:${this.PEER_PORT}/wsrelay`;
    }
    return `${this.RELAY_PROTOCOL}//${this.PEER_HOST}/wsrelay`;
  },

  get HEALTH_CHECK_URL() {
    if (this.PEER_HOST === 'localhost') {
      return `http://localhost:${this.PEER_PORT}/api/health`;
    }
    return `${this.HTTP_PROTOCOL}//${this.PEER_HOST}/api/health`;
  },

  getRoomCheckUrl(code) {
    if (this.PEER_HOST === 'localhost') {
      return `http://localhost:${this.PEER_PORT}/api/room-check?code=${encodeURIComponent(code)}`;
    }
    return `${this.HTTP_PROTOCOL}//${this.PEER_HOST}/api/room-check?code=${encodeURIComponent(code)}`;
  },

  getShareableInviteUrl(roomCode) {
    if (typeof window === 'undefined' || !roomCode) return '';
    const hostname = window.location.hostname;
    const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');

    if (isLocalHost || hostname.includes('pages.dev')) {
      return `https://${DEFAULT_BACKEND_HOST}/?room=${encodeURIComponent(roomCode)}`;
    }
    return `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomCode)}`;
  }
};
