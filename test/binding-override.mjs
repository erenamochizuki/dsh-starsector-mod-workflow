/**
 * Integration check that the plugin really routes the CLI at the binding file it
 * resolved: `SSMOD_CONFIG` is set in the child environment and the CLI honours it.
 *
 * Strategy: copy the resolved binding to a temp file with a deliberately invalid
 * `profile`. The CLI must reject that copy ("配置 profile 必须是 moci-maven"),
 * which proves it read the temp file and not its own `CODEX_HOME` default.
 *
 * With a real binding on this machine the test also requires `doctor` to pass.
 * On a machine without one (CI, fresh clone) it runs against a synthetic fixture
 * project: `doctor` is then expected to fail its environment checks, but it must
 * still read the right config, so the `config` echo and the profile rejection are
 * asserted in both modes.
 *
 * Usage: node test/binding-override.mjs
 */
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readBinding, resolveBindingPath, resolveNode } from "../lib/binding.js";
import { createMociTool } from "../lib/moci-tool.js";
import { createFixtureProject } from "./fixture.mjs";

const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const assetRoot = join(packageRoot, "assets", "starsector-mod-workflow");
const resolved = resolveBindingPath({});
const hasRealBinding = readBinding(resolved.path).ok;
const fixture = hasRealBinding ? undefined : createFixtureProject();
if (fixture !== undefined) process.on("exit", fixture.cleanup);
const realBinding = fixture === undefined ? resolved.path : fixture.bindingPath;

const tool = createMociTool({
	assetRoot,
	bindingPath: realBinding,
	resolveNode: () => resolveNode({}),
	readBinding
});

const real = await tool.execute({ command: "doctor" }, {});
const doctor = JSON.parse(real.stdout);
const normalized = (value) => value.split("\\").join("/");
assert.equal(normalized(doctor.config), normalized(realBinding), "doctor must report the binding it read");
assert.equal(doctor.profile, "moci-maven");
if (fixture === undefined) {
	assert.equal(real.exitCode, 0, `doctor failed: ${real.stderr}`);
} else {
	assert.equal(real.exitCode, 1, "the fixture has no JDK/Maven, so doctor must report it as not ok");
	assert.ok(doctor.errors.some((error) => /JDK|Maven/u.test(error)), `expected environment errors, got: ${doctor.errors}`);
}

const directory = mkdtempSync(join(tmpdir(), "dsh-moci-binding-"));
try {
	const overridePath = join(directory, "moci.json");
	const data = JSON.parse(readFileSync(realBinding, "utf8"));
	data.profile = "moci-maven-not-a-real-profile";
	writeFileSync(overridePath, JSON.stringify(data, null, 2));

	const overrideTool = createMociTool({
		assetRoot,
		bindingPath: overridePath,
		resolveNode: () => resolveNode({}),
		readBinding
	});
	const overridden = await overrideTool.execute({ command: "doctor" }, {});
	assert.equal(overridden.exitCode, 1, "the CLI must reject the doctored binding");
	assert.match(overridden.stderr, /profile/u);
} finally {
	rmSync(directory, { recursive: true, force: true });
}

console.log(`binding-override: ok (${fixture === undefined ? "real binding" : "fixture binding"})`);
console.log(`  projectRoot: ${doctor.projectRoot}`);
console.log(`  config:      ${doctor.config}`);
