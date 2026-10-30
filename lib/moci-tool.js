import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { join } from "node:path";

/** Commands the moci CLI implements (`Script/commands.json` → `moci`). */
export const MOCI_COMMANDS = [
	"help",
	"doctor",
	"compile",
	"build",
	"verify",
	"sync",
	"api-src",
	"api-grep",
	"find-class",
	"javap",
	"logscan",
	"templates",
	"new",
	"preview"
];

/** Pseudo-command that runs `Script/tutorial.mjs` instead of the moci entry. */
export const TUTORIAL_COMMAND = "tutorial";

/** Every accepted `command` value. */
const COMMANDS = [...MOCI_COMMANDS, TUTORIAL_COMMAND];

/** Per-stream output cap; longer logs keep their tail, which is where errors are. */
const MAX_STREAM_CHARS = 60_000;

/** Default runtime budget per command (milliseconds). */
const DEFAULT_TIMEOUTS = {
	build: 900_000,
	compile: 600_000,
	sync: 300_000
};
const DEFAULT_TIMEOUT_MS = 300_000;
const MAX_TIMEOUT_MS = 1_800_000;

/** Tool name as it appears in the model-facing tool list. */
export const TOOL_NAME = "starsector_moci";

const PARAMETERS = {
	type: "object",
	additionalProperties: false,
	properties: {
		command: {
			type: "string",
			enum: COMMANDS,
			description: "要执行的 moci 子命令；`tutorial` 会转而运行 Script/tutorial.mjs（args 的第一个元素是它的子命令，如 search / read）。"
		},
		args: {
			type: "array",
			items: { type: "string" },
			description: "附加命令行参数，例如 [\"--file\", \"data/hullmods/Foo.java\"]。`--file` 使用工程相对路径；不要在 args 里放命令本身。"
		},
		cwd: {
			type: "string",
			description: "工作目录，默认使用绑定工程的 projectRoot。一般不需要设置。"
		},
		timeoutSec: {
			type: "number",
			description: "超时秒数（1-1800）。默认按命令取 300/600/900 秒。"
		}
	},
	required: ["command"]
};

const OUTPUT_SCHEMA = {
	type: "object",
	additionalProperties: false,
	properties: {
		command: { type: "string" },
		argv: { type: "array", items: { type: "string" } },
		cwd: { type: "string" },
		exitCode: { type: "integer" },
		timedOut: { type: "boolean" },
		truncated: { type: "boolean" },
		durationMs: { type: "integer" },
		stdout: { type: "string" },
		stderr: { type: "string" }
	},
	required: ["command", "argv", "cwd", "exitCode", "timedOut", "truncated", "durationMs", "stdout", "stderr"]
};

const DESCRIPTION =
	"Starsector/Moci 工程工作流的命令入口。在绑定工程上运行 moci CLI：" +
	"doctor（环境自检）、compile（仅编译）、build（打包并更新工作区 JAR）、verify（数据文件静态校验）、sync（生成游戏同步清单）、" +
	"api-src / api-grep / find-class / javap（本地 API 与类查询）、logscan（日志栈帧定位）、templates / new（模板与骨架生成）、preview、help。" +
	"`tutorial` 运行本地教程检索脚本（args: search --exact <词> | read <chunkId>）。" +
	"工作目录默认是绑定工程的 projectRoot，并已用 SSMOD_CONFIG 指向 moci.json。" +
	"注意：任何写游戏目录的操作（sync，或 build 带 --game-approved）必须先通过 ask_user_question 获得用户明确的「是」，不得自行添加 --game-approved。"

/**
 * Create the `starsector_moci` tool definition for the raw tools registry.
 * @param {{
 *   assetRoot: string,
 *   bindingPath: string,
 *   resolveNode: () => { node: string, asElectronNode: boolean },
 *   readBinding: (path: string) => { ok: true, data: Record<string, unknown> } | { ok: false, error: string }
 * }} options
 */
export function createMociTool(options) {
	const { assetRoot, bindingPath, resolveNode, readBinding } = options;
	const mociEntry = join(assetRoot, "Script", "moci.mjs");
	const tutorialEntry = join(assetRoot, "Script", "tutorial.mjs");

	return {
		name: TOOL_NAME,
		description: DESCRIPTION,
		parameters: PARAMETERS,
		output: {
			schema: OUTPUT_SCHEMA,
			render: (_args, value) => [{ type: "text", text: renderResult(value) }]
		},
		timeoutMs: MAX_TIMEOUT_MS + 30_000,
		/**
		 * @param {Record<string, unknown>} args raw arguments from the model
		 * @param {{ signal?: AbortSignal }} exec execution context
		 */
		execute: async (args, exec) => call(options, args, exec, mociEntry, tutorialEntry)
	};
}

/**
 * @param {object} deps plugin dependencies
 * @param {Record<string, unknown>} args raw arguments
 * @param {{ signal?: AbortSignal }} exec execution context
 * @param {string} mociEntry absolute moci entry
 * @param {string} tutorialEntry absolute tutorial entry
 */
async function call(deps, args, exec, mociEntry, tutorialEntry) {
	const startedAt = Date.now();
	const raw = typeof args === "object" && args !== null ? args : {};
	const command = raw.command;

	// The raw registry does not validate arguments for third-party tools, so
	// everything below is checked here and answered with a structured result.
	if (typeof command !== "string" || !COMMANDS.includes(command)) {
		return failure(
			typeof command === "string" ? command : String(command),
			[],
			"",
			`unknown command ${JSON.stringify(command)}; expected one of: ${COMMANDS.join(", ")}`,
			startedAt
		);
	}
	const extra = raw.args ?? [];
	if (!Array.isArray(extra) || extra.some((item) => typeof item !== "string")) {
		return failure(command, [], "", "`args` must be an array of strings", startedAt);
	}
	if (command === TUTORIAL_COMMAND && extra.length === 0) {
		return failure(command, [], "", "`tutorial` needs a subcommand in args (search / read / --help)", startedAt);
	}
	const script = command === TUTORIAL_COMMAND ? tutorialEntry : mociEntry;
	if (!isFile(script)) {
		return failure(command, [], "", `bundled script is missing: ${script}`, startedAt);
	}

	const argv = [script, ...(command === TUTORIAL_COMMAND ? [] : [command]), ...extra];

	const binding = deps.readBinding(deps.bindingPath);
	if (!binding.ok) {
		return failure(
			command,
			argv,
			"",
			`${binding.error}\n\nFix: create the binding file, or set the plugin option \`binding\` to the moci.json path (or export SSMOD_CONFIG).`,
			startedAt
		);
	}

	const cwdOverride = typeof raw.cwd === "string" && raw.cwd.trim() !== "" ? raw.cwd.trim() : undefined;
	const projectRoot = typeof binding.data.projectRoot === "string" ? binding.data.projectRoot : "";
	const cwd = cwdOverride ?? (projectRoot !== "" && isDirectory(projectRoot) ? projectRoot : process.cwd());

	let node;
	try {
		node = deps.resolveNode();
	} catch (error) {
		return failure(command, argv, cwd, error.message, startedAt);
	}

	const timeout = clampTimeout(raw.timeoutSec, command);
	const env = { ...process.env, SSMOD_CONFIG: deps.bindingPath };
	if (node.asElectronNode) env.ELECTRON_RUN_AS_NODE = "1";
	// A leftover ELECTRON_RUN_AS_NODE from the host would break a real node.exe.
	if (!node.asElectronNode) delete env.ELECTRON_RUN_AS_NODE;

	const outcome = await runProcess({
		node: node.node,
		argv,
		cwd,
		env,
		timeoutMs: timeout,
		signal: exec?.signal
	});
	return {
		command,
		argv: [command, ...extra],
		cwd,
		exitCode: outcome.exitCode,
		timedOut: outcome.timedOut,
		truncated: outcome.truncated,
		durationMs: Date.now() - startedAt,
		stdout: outcome.stdout,
		stderr: outcome.stderr
	};
}

/**
 * @param {unknown} value raw `timeoutSec`
 * @param {string} command command being run
 * @returns {number} timeout in milliseconds
 */
function clampTimeout(value, command) {
	const fallback = DEFAULT_TIMEOUTS[command] ?? DEFAULT_TIMEOUT_MS;
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return fallback;
	return Math.min(Math.max(Math.round(value * 1000), 1_000), MAX_TIMEOUT_MS);
}

/**
 * Spawn the CLI, capturing bounded output and honouring cancellation/timeouts.
 * @param {{ node: string, argv: string[], cwd: string, env: NodeJS.ProcessEnv, timeoutMs: number, signal?: AbortSignal }} options
 * @returns {Promise<{ exitCode: number, timedOut: boolean, truncated: boolean, stdout: string, stderr: string }>}
 */
function runProcess(options) {
	const { node, argv, cwd, env, timeoutMs, signal } = options;
	return new Promise((resolvePromise) => {
		if (signal?.aborted === true) {
			resolvePromise({ exitCode: -1, timedOut: false, truncated: false, stdout: "", stderr: "aborted before start" });
			return;
		}
		const stdout = new BoundedBuffer(MAX_STREAM_CHARS);
		const stderr = new BoundedBuffer(MAX_STREAM_CHARS);
		let settled = false;
		let timedOut = false;
		let forceKill;
		const child = spawn(node, argv, { cwd, env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });

		const timer = setTimeout(() => {
			timedOut = true;
			child.kill("SIGTERM");
			forceKill = setTimeout(() => child.kill("SIGKILL"), 5_000);
		}, timeoutMs);

		const onAbort = () => child.kill("SIGTERM");
		signal?.addEventListener("abort", onAbort, { once: true });

		const finish = (exitCode, errorMessage) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			if (forceKill !== undefined) clearTimeout(forceKill);
			signal?.removeEventListener("abort", onAbort);
			let errText = stderr.text();
			if (errorMessage !== undefined) errText = errText === "" ? errorMessage : `${errText}\n${errorMessage}`;
			if (timedOut) errText = `${errText}${errText === "" ? "" : "\n"}timed out after ${timeoutMs} ms`;
			resolvePromise({
				exitCode,
				timedOut,
				truncated: stdout.truncated || stderr.truncated,
				stdout: stdout.text(),
				stderr: errText
			});
		};

		child.stdout.setEncoding("utf8");
		child.stderr.setEncoding("utf8");
		child.stdout.on("data", (chunk) => stdout.push(chunk));
		child.stderr.on("data", (chunk) => stderr.push(chunk));
		child.on("error", (error) => finish(-1, `spawn failed: ${error.message}`));
		child.on("close", (code, signalName) => finish(typeof code === "number" ? code : signalName === null ? -1 : -1));
	});
}

/** Keeps a bounded tail of a stream and records whether anything was dropped. */
class BoundedBuffer {
	constructor(limit) {
		this.limit = limit;
		this.chunks = [];
		this.size = 0;
		this.truncated = false;
	}

	push(chunk) {
		this.chunks.push(chunk);
		this.size += chunk.length;
		while (this.size > this.limit * 2) {
			const dropped = this.chunks.shift();
			this.size -= dropped.length;
			this.truncated = true;
		}
	}

	text() {
		const text = this.chunks.join("");
		if (text.length <= this.limit) return text;
		this.truncated = true;
		return text.slice(text.length - this.limit);
	}
}

/**
 * @param {string} command command name
 * @param {string[]} argv argument vector
 * @param {string} cwd working directory
 * @param {string} message diagnostic
 * @param {number} startedAt start timestamp
 */
function failure(command, argv, cwd, message, startedAt) {
	return {
		command,
		argv,
		cwd,
		exitCode: -1,
		timedOut: false,
		truncated: false,
		durationMs: Date.now() - startedAt,
		stdout: "",
		stderr: message
	};
}

/**
 * @param {object} value tool output
 * @returns {string} model-facing text block
 */
function renderResult(value) {
	const lines = [`$ ${[TOOL_NAME, ...value.argv].join(" ")}`, `cwd: ${value.cwd}`, `exit: ${value.exitCode} · ${value.durationMs} ms`];
	if (value.timedOut) lines.push("(killed by timeout)");
	if (value.truncated) lines.push("(output truncated: only the tail is shown)");
	if (value.stdout !== "") lines.push("", "--- stdout ---", value.stdout);
	if (value.stderr !== "") lines.push("", "--- stderr ---", value.stderr);
	if (value.stdout === "" && value.stderr === "") lines.push("", "(no output)");
	return lines.join("\n");
}

/**
 * @param {string} path candidate
 * @returns {boolean}
 */
function isFile(path) {
	try {
		return statSync(path).isFile();
	} catch {
		return false;
	}
}

/**
 * @param {string} path candidate
 * @returns {boolean}
 */
function isDirectory(path) {
	try {
		return statSync(path).isDirectory();
	} catch {
		return false;
	}
}
