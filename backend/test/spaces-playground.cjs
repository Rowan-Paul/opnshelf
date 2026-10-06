// Manual fixture only. Run through Tranquil's disposable Spaces playground.
// Real PDS calls use the production PrivateSettingsService. OAuth login and
// the application database are synthetic; this is NOT a production entrypoint.
const path = require('node:path');
require('ts-node').register({ project: path.join(__dirname, '../tsconfig.json'), experimentalResolver: true });
require('reflect-metadata');
const { createServer } = require('node:http');
const assert = require('node:assert/strict');
const { PrivateSettingsService } = require('../src/pds/private-settings.service');
const { PRIVATE_SETTINGS_SCOPE } = require('../src/auth/oauth-scopes');

async function main() {
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const fixture = JSON.parse(raw);
  const pds = new URL(fixture.pds);
  assert(['127.0.0.1', 'localhost'].includes(pds.hostname));
  let expiresAt = 0;
  const session = {
    did: fixture.did,
    getTokenInfo: async () => ({ scope: PRIVATE_SETTINGS_SCOPE }),
    fetchHandler: async (pathname, init) => {
      if (Date.now() > expiresAt) {
        const response = await fetch(new URL('/oauth/token', pds), { method: 'POST', body: new URLSearchParams({
          grant_type: 'refresh_token', refresh_token: fixture.refreshToken, client_id: fixture.clientId,
        }) });
        assert(response.ok, 'Synthetic session refresh failed');
        const tokens = await response.json();
        fixture.accessToken = tokens.access_token;
        fixture.refreshToken = tokens.refresh_token || fixture.refreshToken;
        expiresAt = Date.now() + (tokens.expires_in - 30) * 1000;
      }
      return fetch(new URL(pathname, pds), { ...init, headers: { ...init?.headers, Authorization: `Bearer ${fixture.accessToken}` } });
    },
  };
  const service = new PrivateSettingsService({ ENABLE_ATPROTO_SPACES: true });
  assert.equal((await service.read(fixture.did, false, session)).status, 'available');
  await service.save(fixture.did, session, '24h');
  assert.equal((await service.read(fixture.did, true, session)).timeFormat, '24h');
  await service.save(fixture.did, session, '12h');
  assert.equal((await service.read(fixture.did, true, session)).timeFormat, '12h');
  await service.delete(fixture.did, session);
  assert.equal((await service.read(fixture.did, true, session)).status, 'missing');
  console.log('Opnshelf PrivateSettingsService real-PDS create/read/update/delete: PASS');
  let enabled = true;
  let settings = { timeFormat: '24h', timezone: 'Europe/Amsterdam', watchCountry: 'NL', streamingServiceIds: [], alwaysShowSpoilers: false,
    reviewsPublicationUri: null, reviewsPublicationName: null, reviewsMirrorFormat: 'markdown', blogIntegrationEnabled: false,
    blueskyCrossPostEnabled: false, welcomeTourWebVersion: 100, welcomeTourMobileVersion: 100 };
  const user = { did: fixture.did, handle: 'spaces.local.test', displayName: 'Spaces Tester', avatar: null, isNativePds: true,
    emailVerified: true, emailVerifiedAt: new Date().toISOString(), needsOnboarding: false, onboardingCompletedAt: new Date().toISOString(),
    showBlueskyOnProfile: false, showTangledOnProfile: false, followersCount: 0, followingCount: 0 };
  const server = createServer(async (req, res) => {
    if (req.headers.host !== '127.0.0.1:3101') { res.writeHead(403); return res.end(); }
    const origin = req.headers.origin;
    if (origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) { res.writeHead(403); return res.end(); }
    res.setHeader('Access-Control-Allow-Origin', origin || 'http://127.0.0.1:3000');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-opnshelf-device, x-opnshelf-device-id, x-opnshelf-device-name, x-opnshelf-device-platform');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
    const url = new URL(req.url, 'http://127.0.0.1:3101');
    let body = '';
    for await (const chunk of req) body += chunk;
    const input = body ? JSON.parse(body) : {};
    try {
      if (url.pathname === '/auth/me') return res.end(JSON.stringify(user));
      if (url.pathname === '/users/me/settings') {
        if (req.method === 'PATCH') {
          if (enabled && input.timeFormat) await service.save(fixture.did, session, input.timeFormat);
          settings = { ...settings, ...input };
        }
        const state = await service.read(fixture.did, enabled, session);
        if (state.timeFormat) settings.timeFormat = state.timeFormat;
        return res.end(JSON.stringify({ ...settings, privateSettings: { enabled, status: state.status } }));
      }
      if (url.pathname === '/users/me/settings/private' && req.method === 'DELETE') {
        await service.delete(fixture.did, session); return res.end('{}');
      }
      if (url.pathname === '/auth/permissions') {
        // Fixture-only permission transition. Production uses the real OAuth redirect.
        enabled = input.action === 'connect';
        return res.end(JSON.stringify({ authorizationUrl: 'http://127.0.0.1:3000/settings/preferences' }));
      }
      if (url.pathname === '/auth/me/bluesky-profile-status') return res.end(JSON.stringify({ hasProfile: false }));
      if (url.pathname === '/notifications/settings') return res.end(JSON.stringify({ emailEnabled: false, pushEnabled: false }));
      if (url.pathname === '/users/me/trakt-import') return res.end('null');
      if (url.pathname === '/health') return res.end('{"fixture":true}');
      res.statusCode = 404; return res.end(JSON.stringify({ message: 'Not part of this focused settings fixture' }));
    } catch (error) {
      res.statusCode = error.getStatus?.() || 500;
      res.end(JSON.stringify({ message: error.message }));
    }
  });
  server.listen(3101, '127.0.0.1', () => console.log('Opnshelf Spaces UI fixture: http://127.0.0.1:3101'));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
