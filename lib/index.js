import { statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { readBinding, resolveBindingPath, resolveNode } from "./binding.js";
import { createMociTool } from "./moci-tool.js";
import { parseSkillDocument, runtimeHint, skillCandidate } from "./skill.js";

/** Cordis plugin identity (also the package name in the profile patch). */
export const name = "dsh-starsector-mod-workflow";

/** Services this plugin registers into. Both exist on the root composition. */
export const inject = ["skills", "tools"];

/** Skill provider name; a candidate's `provider` field must match it. */
const PROVIDER_NAME = "dsh-starsector-mod-workflow";

/** Name of the bundled skill in the DSH skill catalog. */
const SKILL_NAME = "starsector-mod-workflow";

/** Bundled-skill rank (mirrors BUNDLED_SKILL_RANK from @deepseek-ai/dsh-skill). */
const SKILL_RANK = 600;

/** Package root, resolved from this module's real path (link: installs resolve there). */
const PACKAGE_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Mount the bundled skill provider and the `starsector_moci` tool.
 * @param {import("@deepseek-ai/cordis").Context} ctx plugin context
 * @param {Record<string, unknown>} config plugin config
 */
export function apply(ctx, config = {}) {
	const settings = normalizeConfig(ctx, config);
	const skillDir = settings.assetRoot;
	const binding = resolveBindingPath(settings);

	if (!isDirectory(skillDir)) {
		ctx.logger?.warn?.(`dsh-starsector-mod-workflow: skill assets not found at ${skillDir}; registering the moci tool only`);
	} else {
		registerSkill(ctx, skillDir, binding.path);
	}
	if (!readBinding(binding.path).ok) {
		ctx.logger?.warn?.(
			`dsh-starsector-mod-workflow: no usable moci binding at ${binding.path} (source: ${binding.source}); set the plugin option \`binding\` or export SSMOD_CONFIG`
		);
	}
	if (settings.tool) {
		ctx.tools.register(
			createMociTool({
				assetRoot: skillDir,
				bindingPath: binding.path,
				resolveNode: () => resolveNode(settings),
				readBinding
			})
		);
	}
}

/**
 * Register the bundled skill. Reads SKILL.md lazily so a broken asset cannot
 * take down profile boot; the provider surfaces the error on `list()`/`get()`.
 * @param {import("@deepseek-ai/cordis").Context} ctx plugin context
 * @param {string} skillDir absolute skill directory
 * @param {string} bindingPath absolute moci binding path
 */
function registerSkill(ctx, skillDir, bindingPath) {
	/** @type {Array<Record<string, unknown>> | undefined} */
	let cached;
	const candidates = () => {
		cached ??= [
			skillCandidate({
				skillDir,
				name: SKILL_NAME,
				provider: PROVIDER_NAME,
				rank: SKILL_RANK,
				posix
			})
		];
		return cached;
	};
	const provider = {
		name: PROVIDER_NAME,
		list: () => Promise.resolve().then(candidates),
		async get(candidate, options) {
			const { rank: _rank, locator, ...summary } = candidate;
			const raw = await readFileWithSignal(locator, options?.signal);
			const { content } = parseSkillDocument(raw, locator);
			const hint = runtimeHint({ skillDir, bindingPath, toolName: "starsector_moci" });
			return { ...summary, content: content + hint };
		}
	};
	ctx.skills.registerProvider(() => provider);
}

/**
 * @param {string} path file path
 * @param {AbortSignal | undefined} signal cancellation signal
 * @returns {Promise<string>}
 */
function readFileWithSignal(path, signal) {
	return readFile(path, { encoding: "utf8", signal });
}

/**
 * Normalize and validate user configuration. A broken config is a loud error:
 * silently ignoring it would leave the plugin pointing at the wrong project.
 * @param {import("@deepseek-ai/cordis").Context} ctx plugin context
 * @param {Record<string, unknown>} config raw config
 * @returns {{ assetRoot: string, binding?: string, node?: string, tool: boolean }}
 */
function normalizeConfig(ctx, config) {
	if (typeof config !== "object" || config === null || Array.isArray(config)) {
		throw new Error("dsh-starsector-mod-workflow: plugin config must be an object");
	}
	for (const key of ["assetRoot", "binding", "node"]) {
		const value = config[key];
		if (value !== undefined && (typeof value !== "string" || value.trim() === "")) {
			throw new Error(`dsh-starsector-mod-workflow: config.${key} must be a non-empty string`);
		}
	}
	if (config.tool !== undefined && typeof config.tool !== "boolean") {
		throw new Error("dsh-starsector-mod-workflow: config.tool must be a boolean");
	}
	const assetRoot = typeof config.assetRoot === "string" ? config.assetRoot : join(PACKAGE_ROOT, "assets", SKILL_NAME);
	return { assetRoot, binding: config.binding, node: config.node, tool: config.tool !== false };
}

/**
 * @param {string} path candidate path
 * @returns {boolean} whether the path is an existing directory
 */
function isDirectory(path) {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}

/**
 * Forward-slash form used inside skill metadata and rendered hints.
 * @param {string} path native path
 * @returns {string} POSIX-style path
 */
function posix(path) {
	return path.split(sep).join("/");
}
