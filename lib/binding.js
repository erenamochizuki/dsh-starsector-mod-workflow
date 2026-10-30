import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

/** File name the moci CLI expects inside the Codex home directory. */
const LEGACY_BINDING_SEGMENTS = ["starsector-projects", "moci.json"];

/** Fields a usable moci binding file must provide. */
const REQUIRED_BINDING_FIELDS = ["projectRoot", "mod"];

/**
 * Absolute path of the default binding file, mirroring `Script/lib/moci-project.mjs`
 * (`CODEX_HOME || ~/.codex` + `starsector-projects/moci.json`).
 * @returns {string} absolute path, whether or not it exists
 */
export function defaultBindingPath() {
	const codexHome = process.env.CODEX_HOME;
	const base = codexHome !== undefined && codexHome.trim() !== "" ? codexHome : join(homedir(), ".codex");
	return resolve(join(base, ...LEGACY_BINDING_SEGMENTS));
}

/**
 * Resolve which binding file the plugin should use.
 *
 * Order: explicit plugin config → `SSMOD_CONFIG` (support injected by the moci CLI
 * itself) → `<CODEX_HOME>/starsector-projects/moci.json` → `~/.codex/...`.
 * @param {{ binding?: string }} config plugin config
 * @returns {{ path: string, source: string }}
 */
export function resolveBindingPath(config = {}) {
	if (typeof config.binding === "string" && config.binding.trim() !== "") {
		return { path: resolve(config.binding.trim()), source: "plugin config" };
	}
	const fromEnv = process.env.SSMOD_CONFIG;
	if (fromEnv !== undefined && fromEnv.trim() !== "") {
		return { path: resolve(fromEnv.trim()), source: "SSMOD_CONFIG" };
	}
	return { path: defaultBindingPath(), source: "default (CODEX_HOME / ~/.codex)" };
}

/**
 * Read and lightly validate a binding file.
 * @param {string} path absolute binding path
 * @returns {{ ok: true, data: Record<string, unknown> } | { ok: false, error: string }}
 */
export function readBinding(path) {
	if (!isAbsolute(path)) return { ok: false, error: `binding path must be absolute: ${path}` };
	if (!existsSync(path)) {
		return {
			ok: false,
			error: `moci binding file not found: ${path}`
		};
	}
	let raw;
	try {
		raw = readFileSync(path, "utf8");
	} catch (error) {
		return { ok: false, error: `cannot read moci binding ${path}: ${error.message}` };
	}
	let data;
	try {
		data = JSON.parse(raw);
	} catch (error) {
		return { ok: false, error: `moci binding ${path} is not valid JSON: ${error.message}` };
	}
	if (typeof data !== "object" || data === null || Array.isArray(data)) {
		return { ok: false, error: `moci binding ${path} must contain a JSON object` };
	}
	const missing = REQUIRED_BINDING_FIELDS.filter((field) => typeof data[field] !== "string" || data[field].trim() === "");
	if (missing.length > 0) {
		return { ok: false, error: `moci binding ${path} is missing required field(s): ${missing.join(", ")}` };
	}
	return { ok: true, data };
}

/**
 * Locate a real Node executable. A DSH build ships its own runtime under
 * `~/.dsh/dsh-runtimes/<runtime>/dependencies/node`; the Electron executable
 * also works when spawned with `ELECTRON_RUN_AS_NODE=1`.
 * @param {{ node?: string }} config plugin config
 * @returns {{ node: string, asElectronNode: boolean }}
 */
export function resolveNode(config = {}) {
	const explicit = firstExecutable([config.node, process.env.DSH_MOCI_NODE]);
	if (explicit !== undefined) return { node: explicit, asElectronNode: false };

	const runtimeCandidates = [];
	const runtimesDir = join(homedir(), ".dsh", "dsh-runtimes");
	try {
		for (const entry of readdirSync(runtimesDir, { withFileTypes: true })) {
			if (!entry.isDirectory()) continue;
			runtimeCandidates.push(join(runtimesDir, entry.name, "dependencies", "node", "bin", process.platform === "win32" ? "node.exe" : "node"));
		}
	} catch {
		/* no bundled runtimes: fall through to the current executable */
	}
	const bundled = firstExecutable(runtimeCandidates);
	if (bundled !== undefined) return { node: bundled, asElectronNode: false };

	const execPath = process.execPath;
	const looksLikeNode = /^node(\.exe)?$/iu.test(execPath.split(/[\\/]/u).pop() ?? "");
	if (looksLikeNode) return { node: execPath, asElectronNode: false };
	if (process.versions.electron !== undefined) return { node: execPath, asElectronNode: true };

	throw new Error(
		"dsh-starsector-mod-workflow: no Node executable found for the moci CLI; set the plugin option `node` (absolute path to node.exe) in the profile patch"
	);
}

/**
 * @param {Array<string | undefined>} values candidate paths
 * @returns {string | undefined} first existing absolute file
 */
function firstExecutable(values) {
	for (const value of values) {
		if (typeof value !== "string" || value.trim() === "") continue;
		const candidate = resolve(value.trim());
		if (!isAbsolute(candidate)) continue;
		try {
			if (statSync(candidate).isFile()) return candidate;
		} catch {
			/* not this one */
		}
	}
	return undefined;
}
