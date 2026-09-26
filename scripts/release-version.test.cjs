const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { spawnSync } = require('node:child_process');
const { join } = require('node:path');

const workflow = readFileSync(join(__dirname, '../.github/workflows/release.yml'), 'utf8');
const start = workflow.indexOf('          # Always higher');
const end = workflow.indexOf('          echo "Tag $tag', start);
assert.ok(start >= 0 && end > start, 'Find the version selection and validation block');
const versionScript = workflow.slice(start, end);

for (const [name, appVersion, storeRelease, expectedTag] of [
  ['reject a store version already used by GitHub', '1.6.2', true, null],
  ['align the next store release', '1.6.3', true, 'v1.6.3'],
  ['allow a minor store version bump', '1.7.0', true, 'v1.7.0'],
  ['allow an OTA with an unchanged app version', '1.6.0', false, 'v1.6.3'],
]) {
  test(name, () => {
    const result = spawnSync('bash', ['-c', `
      set -euo pipefail
      git() { printf '%s\\n' v1.6.0 v1.6.1 v1.6.2; }
      ${versionScript}
      printf 'publish:%s\\n' "$tag"
    `], {
      encoding: 'utf8',
      env: { ...process.env, app_version: appVersion, store_release: String(storeRelease) },
    });
    if (expectedTag === null) {
      assert.equal(result.status, 1, result.stderr);
      assert.match(result.stdout, /Store release version mismatch/);
      assert.doesNotMatch(result.stdout, /publish:/);
    } else {
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), `publish:${expectedTag}`);
    }
  });
}
