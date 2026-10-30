/**
 * Smoke test for the dsh-starsector-mod-workflow plugin.
 *
 * Runs the plugin's `apply()` against a fake Cordis context (the real one needs
 * a booted DSH profile, which cannot be dumped for the desktop profile), then
 * exercises the registered skill provider and the `starsector_moci` tool
 * end-to-end against the real bundled CLI.
 *
 * Usage: node test/smoke.mjs
 */
import assert from "node:assert/strict";
import { statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { apply, inject, name } from "../lib/index.js";
import { readBinding, resolveBindingPath, resolveNode } from "../lib/binding.js";
import { createMociTool } from "../lib/moci-tool.js";
import { createFixtureProject } from "./fixture.mjs";

const PACKAGE_ROOT = fileURLToPath(new URL("..", import.meta.url));
const bindings = [];
const tools = [];
const warnings = [];

const ctx = {
	logger: {
		warn: (message) => warnings.push(message),
		info: () => {},
		error: (message) => warnings.push(message)
	},
	skills: {
		registerProvider(create) {
			const provider = create({ signal: new AbortController().signal, invalidate() {} });
			bindings.push(provider);
			return () => {};
		}
	},
	tools: {
		register(definition) {
			tools.push(definition);
			return () => {};
		}
	}
};

assert.equal(name, "dsh-starsector-mod-workflow");
assert.deepEqual(inject, ["skills", "tools"]);

// --- binding ---------------------------------------------------------------
// CI and fresh clones have no `moci.json`; fall back to a throwaway fixture
// project so the CLI happy path can still run end-to-end.
const defaultBinding = resolveBindingPath({});
const hasRealBinding = readBinding(defaultBinding.path).ok;
const fixture = hasRealBinding ? undefined : createFixtureProject();
if (fixture !== undefined) {
	process.on("exit", fixture.cleanup);
	console.log(`smoke: no binding at ${defaultBinding.path}; using a temporary fixture project`);
}
const binding = fixture === undefined ? defaultBinding : { path: fixture.bindingPath, source: "test fixture" };
assert.equal(readBinding(binding.path).ok, true, `binding must be readable: ${binding.path}`);

apply(ctx, { binding: binding.path });

// --- registered services ---------------------------------------------------
assert.equal(bindings.length, 1, "exactly one skill provider is registered");
assert.equal(tools.length, 1, "exactly one tool is registered");
const tool = tools[0];
assert.equal(tool.name, "starsector_moci");
assert.equal(typeof tool.output.render, "function");
assert.equal(typeof tool.execute, "function");

// The raw registry validates values against output.schema; mirror the required
// keys here so a schema/result drift fails the test instead of the tool call.
const required = tool.output.schema.required;
assert.ok(Array.isArray(required) && required.length > 0);

// --- skill provider --------------------------------------------------------
const provider = bindings[0];
assert.equal(provider.name, "dsh-starsector-mod-workflow");
const candidates = await provider.list();
assert.equal(candidates.length, 1);
const candidate = candidates[0];
assert.equal(candidate.name, "starsector-mod-workflow");
assert.match(candidate.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
assert.equal(candidate.provider, provider.name);
assert.ok(candidate.description.length > 20, "description comes from SKILL.md frontmatter");
assert.ok(typeof candidate.whenToUse === "string" && candidate.whenToUse.length > 0);
assert.equal(candidate.invocation.modelInvocable, true);
assert.equal(candidate.invocation.userInvocable, true);
assert.equal(candidate.resourceBase.kind, "directory");
assert.equal(candidate.resourceBase.path.includes("\\"), false, "resourceBase path uses forward slashes");
assert.equal(statSync(candidate.resourceBase.path).isDirectory(), true, "resourceBase must exist");
assert.equal(statSync(candidate.locator).isFile(), true, "locator must exist");

const definition = await provider.get(candidate, {});
assert.equal(definition.name, "starsector-mod-workflow");
assert.ok(definition.content.length > 1000, "skill body is loaded");
assert.ok(definition.content.includes("## DSH 运行环境"), "DSH overlay is appended");
assert.ok(definition.content.includes("starsector_moci"), "overlay names the tool");
assert.ok(definition.content.includes("ask_user_question"), "overlay points at the DSH elicitation tool");
assert.ok(definition.content.includes("Script/moci.mjs"), "overlay documents the CLI entry");
assert.equal("locator" in definition, false, "definition replaces the locator with content");
assert.equal("rank" in definition, false, "rank stays internal to the candidate");

// --- tool: happy path (real CLI run) --------------------------------------
const helpText = await tool.execute({ command: "templates" }, { signal: new AbortController().signal });
for (const key of required) assert.ok(key in helpText, `result is missing ${key}`);
assert.equal(helpText.exitCode, 0, `templates should succeed, stderr: ${helpText.stderr}`);
assert.ok(helpText.stdout.length > 0, "templates prints something");
assert.equal(helpText.timedOut, false);
assert.equal(helpText.argv[0], "templates");
const helpBlocks = tool.output.render({}, helpText);
assert.equal(Array.isArray(helpBlocks), true);
assert.equal(helpBlocks[0].type, "text");
assert.match(helpBlocks[0].text, /exit: 0/u);
const schemaViolations = validateAgainstSchema(tool.output.schema, helpText);
assert.deepEqual(schemaViolations, [], "result matches output.schema");

// --- tool: argument validation -------------------------------------------
const unknown = await tool.execute({ command: "nope" }, {});
assert.equal(unknown.exitCode, -1);
assert.match(unknown.stderr, /unknown command/u);
const badArgs = await tool.execute({ command: "doctor", args: [1, 2] }, {});
assert.equal(badArgs.exitCode, -1);
assert.match(badArgs.stderr, /array of strings/u);
const badTutorial = await tool.execute({ command: "tutorial" }, {});
assert.equal(badTutorial.exitCode, -1);
assert.match(badTutorial.stderr, /needs a subcommand/u);

// --- tool: broken binding is reported as a result, not thrown -------------
const brokenTool = createMociTool({
	assetRoot: join(PACKAGE_ROOT, "assets", "starsector-mod-workflow"),
	bindingPath: join(PACKAGE_ROOT, "test", "missing-moci.json"),
	resolveNode: () => resolveNode({}),
	readBinding
});
const broken = await brokenTool.execute({ command: "doctor" }, {});
assert.equal(broken.exitCode, -1);
assert.match(broken.stderr, /binding file not found/u);

if (warnings.length > 0) console.log("warnings:", warnings.join(" | "));
console.log("smoke: ok");
console.log(`  skill: ${candidate.name} (${candidate.resourceBase.path})`);
console.log(`  tool:  ${tool.name} — templates exit ${helpText.exitCode}, ${helpText.stdout.length} chars`);
console.log(`  binding: ${binding.path}`);

/**
 * Minimal structural validation against the supported JSON Schema subset.
 * @param {Record<string, unknown>} schema schema node
 * @param {unknown} value candidate value
 * @param {string} [path] diagnostic path
 * @returns {string[]} violations
 */
function validateAgainstSchema(schema, value, path = "value") {
	const violations = [];
	const type = schema.type;
	if (type === "object") {
		if (typeof value !== "object" || value === null || Array.isArray(value)) return [`${path} must be an object`];
		const properties = schema.properties ?? {};
		for (const key of schema.required ?? []) if (!(key in value)) violations.push(`${path}.${key} is required`);
		if (schema.additionalProperties === false) {
			for (const key of Object.keys(value)) if (!(key in properties)) violations.push(`${path}.${key} is not declared`);
		}
		return violations;
	}
	if (type === "array") {
		if (!Array.isArray(value)) return [`${path} must be an array`];
		for (const [index, item] of value.entries()) violations.push(...validateAgainstSchema(schema.items ?? {}, item, `${path}[${index}]`));
		return violations;
	}
	if (type === "string" && typeof value !== "string") violations.push(`${path} must be a string`);
	if (type === "integer" && !Number.isInteger(value)) violations.push(`${path} must be an integer`);
	if (type === "boolean" && typeof value !== "boolean") violations.push(`${path} must be a boolean`);
	return violations;
}
