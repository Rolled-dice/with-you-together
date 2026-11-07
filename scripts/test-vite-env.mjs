import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { refreshServerEnvironment } from "./vite-env.ts";
const tempBase = resolve(tmpdir());
const root = await mkdtemp(join(tempBase, "someonenear-env-"));
try {
  process.env.SN_ENV_TEST_OVERRIDE = "shell-value";
  await writeFile(
    join(root, ".env"),
    "SN_ENV_TEST_VALUE=old-project\nSN_ENV_TEST_OVERRIDE=file-value\n",
  );
  refreshServerEnvironment("development", root);
  assert.equal(process.env.SN_ENV_TEST_VALUE, "old-project");
  await writeFile(
    join(root, ".env"),
    "SN_ENV_TEST_VALUE=new-project\nSN_ENV_TEST_OVERRIDE=file-value\n",
  );
  refreshServerEnvironment("development", root);
  assert.equal(process.env.SN_ENV_TEST_VALUE, "new-project");
  assert.equal(process.env.SN_ENV_TEST_OVERRIDE, "shell-value");
  await writeFile(join(root, ".env"), "");
  refreshServerEnvironment("development", root);
  assert.equal(process.env.SN_ENV_TEST_VALUE, undefined);
  console.log("PASS environment reload picks up edits/removals and preserves shell overrides");
} finally {
  delete process.env.SN_ENV_TEST_VALUE;
  delete process.env.SN_ENV_TEST_OVERRIDE;
  assert.equal(dirname(resolve(root)), tempBase);
  assert(basename(root).startsWith("someonenear-env-"));
  await rm(root, { recursive: true, force: true });
}
