// Disposable protocol integration test; run only through Tranquil's manual fixture.
// Uses real OAuth, DPoP, Prisma stores and application services. Only discovery
// transport is mapped from the fixture's advertised hosts to its loopback servers.
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

async function main() {
  const databaseUrl = new URL(process.env.OPNSHELF_SPACES_DATABASE_URL);
  assert.equal(databaseUrl.hostname, '127.0.0.1');
  assert.equal(databaseUrl.pathname, '/spaces_oauth');
  process.env.DATABASE_URL = databaseUrl.href;
  process.env.NODE_ENV = 'test';
  // Imports must not load any checkout's .env file.
  process.chdir(os.tmpdir());
  require('ts-node').register({ project: path.join(__dirname, '../tsconfig.json'), experimentalResolver: true });
  require('reflect-metadata');
  let raw = '';
  for await (const chunk of process.stdin) raw += chunk;
  const fixture = JSON.parse(raw);
  const pds = new URL(fixture.pds);
  const plc = new URL(fixture.plcDirectory);
  assert(['127.0.0.1', 'localhost'].includes(pds.hostname));
  assert(['127.0.0.1', 'localhost'].includes(plc.hostname));
  const nativeFetch = globalThis.fetch;
  const document = await (await nativeFetch(new URL(`/${fixture.did}`, plc))).json();
  const handle = document.alsoKnownAs[0].slice('at://'.length);
  let dpopRequests = 0;
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    let target;
    if (url.origin === fixture.advertisedPds) target = new URL(url.pathname + url.search, pds);
    else if (url.origin === 'https://plc.directory' && decodeURIComponent(url.pathname) === `/${fixture.did}`) target = new URL(url.pathname, plc);
    else if (url.hostname === handle && url.pathname === '/.well-known/atproto-did') return new Response(fixture.did);
    else if (url.hostname === 'public.api.bsky.app') return Response.json({}, { status: 404 });
    else throw new Error(`Unexpected non-fixture request: ${url.origin}${url.pathname}`);
    if (request.headers.has('DPoP')) dpopRequests++;
    return nativeFetch(target, { method: request.method, headers: request.headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.arrayBuffer(),
      redirect: 'manual', signal: request.signal });
  };
  const { Logger } = require('@nestjs/common');
  Logger.overrideLogger(false); // Never print OAuth callback errors containing request parameters.
  const { PrismaService } = require('../src/prisma/prisma.service');
  const { OAuthClientFactory } = require('../src/auth/oauth-client.factory');
  const { DeviceSessionsService } = require('../src/auth/device-sessions.service');
  const { AuthService } = require('../src/auth/auth.service');
  const { AuthController } = require('../src/auth/auth.controller');
  const { PermissionsController } = require('../src/auth/permissions.controller');
  const { UsersService } = require('../src/users/users.service');
  const { PrivateSettingsService } = require('../src/pds/private-settings.service');
  const { PRIVATE_SETTINGS_SCOPE, buildOAuthScope } = require('../src/auth/oauth-scopes');
  const prisma = new PrismaService();
  await prisma.$connect();
  try {
    assert.equal(await prisma.user.count(), 0, 'Requires a fresh disposable application database');
    await prisma.user.create({ data: { did: fixture.did, handle, emailVerifiedAt: new Date(), onboardingCompletedAt: new Date() } });
    const config = { ENABLE_ATPROTO_SPACES: true, BACKEND_PUBLIC_URL: 'http://127.0.0.1:3102', PORT: 3102,
      FRONTEND_URL: 'http://127.0.0.1:3000', PDS_URL: fixture.advertisedPds, NODE_ENV: 'test' };
    const factory = new OAuthClientFactory(prisma, config);
    factory.onModuleInit();
    const sessions = new DeviceSessionsService(prisma, config, factory);
    const auth = new AuthService(prisma, config, factory, sessions);
    const privateSettings = new PrivateSettingsService(config);
    const users = new UsersService(prisma, undefined, undefined, undefined, undefined, undefined, undefined, privateSettings);
    const permissions = new PermissionsController(auth, privateSettings);
    // Tab ingestion is outside this private-settings test. All auth and settings
    // operations, including the callback controller, use production code.
    const controller = new AuthController(auth, config, { addRepo: async () => {} }, users, undefined);
    const userRow = () => prisma.user.findUniqueOrThrow({ where: { did: fixture.did } });
    async function jsonPost(route, data) {
      const response = await nativeFetch(new URL(route, pds), { method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(data) });
      assert(response.ok, `${route} returned ${response.status}`);
      return response.json();
    }
    async function authorize(url, approvedScopes) {
      const request_uri = new URL(url).searchParams.get('request_uri');
      assert(request_uri, 'Client must start with PAR');
      const login = await jsonPost('/oauth/authorize', { request_uri, username: handle, password: fixture.password, remember_device: false });
      let details;
      let result = login;
      if (login.redirect_uri.includes('/oauth/consent')) {
      const consent = await nativeFetch(new URL(`/oauth/authorize/consent?request_uri=${encodeURIComponent(request_uri)}`, pds));
      assert(consent.ok);
      details = await consent.json();
      assert.equal(details.failed_sets.length, 0);
      result = approvedScopes.length
        ? await jsonPost('/oauth/authorize/consent', { request_uri, approved_scopes: approvedScopes })
        : await jsonPost('/oauth/authorize/deny', { request_uri });
      }
      let callback = new URL(result.redirect_uri);
      if (callback.origin === fixture.advertisedPds) {
        const redirectResponse = await nativeFetch(new URL(callback.pathname + callback.search, pds), { redirect: 'manual' });
        assert.equal(redirectResponse.status, 303);
        callback = new URL(redirectResponse.headers.get('location'));
      }
      assert.equal(callback.origin, 'http://127.0.0.1:3102');
      let sessionId;
      let redirect;
      await controller.callback({ url: callback.pathname + callback.search, cookies: {} }, {
        cookie: (name, value) => { if (name === 'opnshelf_session') sessionId = value; },
        clearCookie: () => {}, redirect: (value) => { redirect = value; },
      });
      return { sessionId, redirect, details };
    }
    async function login() {
      // Target the PDS directly for initial sign-in, exactly as the native-account button does.
      return authorize(await auth.authorizeWithPds(), buildOAuthScope().split(' '));
    }
    async function restore(id) {
      assert(id, 'Callback must set a session cookie');
      const record = await prisma.authSession.findUniqueOrThrow({ where: { id } });
      return sessions.restoreBySession(record);
    }
    async function change(previousId, enable, approved = buildOAuthScope({ privateSettingsEnabled: enable }).split(' ')) {
      const session = await restore(previousId);
      const { authorizationUrl } = await permissions.permissions({ user: { did: fixture.did, session } }, { integration: 'spaces', action: enable ? 'connect' : 'disconnect' });
      return authorize(authorizationUrl, approved);
    }
    const first = await login();
    await restore(first.sessionId);
    assert.equal((await userRow()).privateSettingsEnabled, false);
    assert.equal((await privateSettings.read(fixture.did, false, await restore(first.sessionId))).status, 'available');
    const second = await login();
    await restore(second.sessionId);
    const denied = await change(first.sessionId, true, []);
    assert(!denied.sessionId);
    assert(denied.redirect.includes('permission_declined'));
    assert.equal(await prisma.authSession.count(), 2);
    assert.equal((await userRow()).privateSettingsEnabled, false);
    const partial = await change(first.sessionId, true, buildOAuthScope().split(' '));
    assert(!partial.sessionId);
    assert(partial.redirect.includes('callback_failed'));
    assert.equal(await prisma.authSession.count(), 2, 'Partial grant preserves current device');
    const connected = await change(first.sessionId, true);
    const connectedSession = await restore(connected.sessionId);
    assert.equal((await userRow()).privateSettingsEnabled, true);
    assert.equal(await prisma.authSession.count(), 1, 'Connect revokes both previous devices');
    assert(connected.details.scopes.some((scope) => scope.scope === PRIVATE_SETTINGS_SCOPE));
    await users.updateUserSettings(fixture.did, { timeFormat: '12h' }, connectedSession);
    assert.equal((await userRow()).timeFormat, '12h');
    assert.equal((await privateSettings.read(fixture.did, true, connectedSession)).timeFormat, '12h');
    await connectedSession.getTokenInfo(true); // Real DPoP refresh and persisted token rotation.
    assert.equal((await privateSettings.read(fixture.did, true, connectedSession)).timeFormat, '12h');
    console.log('PASS: Core sign-in, explicit consent, atomic device replacement, DPoP CRUD and refresh');
    const disconnected = await change(connected.sessionId, false);
    const disconnectedSession = await restore(disconnected.sessionId);
    assert.equal((await userRow()).privateSettingsEnabled, false);
    assert(!(await disconnectedSession.getTokenInfo()).scope.includes('space:'));
    await assert.rejects(privateSettings.save(fixture.did, disconnectedSession, '24h'));
    assert.equal((await userRow()).timeFormat, '12h');
    const reconnected = await change(disconnected.sessionId, true);
    const reconnectedSession = await restore(reconnected.sessionId);
    assert.equal((await users.getUserSettings(fixture.did, reconnectedSession)).timeFormat, '12h');
    assert.equal((await userRow()).privateSettingsHasCopy, true);
    await users.updateUserSettings(fixture.did, { timeFormat: '24h' }, reconnectedSession);
    await users.deletePrivateSettings(fixture.did, reconnectedSession);
    assert.equal((await users.getUserSettings(fixture.did, reconnectedSession)).privateSettings.status, 'missing');
    assert.equal((await userRow()).timeFormat, '24h');
    assert.equal((await userRow()).privateSettingsHasCopy, false);
    assert(dpopRequests > 10, 'Client must send DPoP on real requests');
    console.log('PASS: Disconnect, denied/partial consent, reconnect, persisted settings and private-copy deletion');
  } finally {
    await prisma.$disconnect();
    globalThis.fetch = nativeFetch;
  }
}
main().catch(error => { console.error(`Spaces OAuth test failed: ${error.name}: ${error.message}`); process.exitCode = 1; });
