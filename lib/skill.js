import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Frontmatter block of a Markdown skill file. */
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u;

/** Suggested entry in the DSH skill catalog. */
const WHEN_TO_USE =
	"在 Moci Starsector 工程里开发、调试或验证 Java 功能、UI、特效、战役系统与 mod 数据时使用：需要查 API、编译打包 JAR、静态校验数据文件、定位游戏日志栈帧、按模板生成骨架或检索本地教程。";

/**
 * Parse the YAML-ish frontmatter this skill actually uses (a single `description`
 * scalar, possibly folded) and return the Markdown body.
 * @param {string} raw file contents
 * @param {string} path file path, for diagnostics
 * @returns {{ description: string, content: string }}
 */
export function parseSkillDocument(raw, path) {
	const frontmatter = FRONTMATTER.exec(raw);
	if (frontmatter?.[1] === undefined) throw new Error(`dsh-starsector-mod-workflow: ${path} has no YAML frontmatter`);
	const description = readScalar(frontmatter[1], "description");
	if (description === undefined || description === "") {
		throw new Error(`dsh-starsector-mod-workflow: ${path} has no description`);
	}
	return { description, content: raw.slice(frontmatter[0].length).trim() };
}

/**
 * Read a top-level frontmatter scalar. Supports plain, quoted, folded (`>`) and
 * literal (`|`) values; anything more exotic is out of scope for this skill.
 * @param {string} block frontmatter body
 * @param {string} key key to read
 * @returns {string | undefined}
 */
function readScalar(block, key) {
	const lines = block.split(/\r?\n/u);
	for (let index = 0; index < lines.length; index++) {
		const match = /^([A-Za-z0-9_-]+):(.*)$/u.exec(lines[index]);
		if (match?.[1] !== key) continue;
		let value = match[2].trim();
		if (value === ">" || value === "|" || value === "") {
			const parts = [];
			for (let next = index + 1; next < lines.length; next++) {
				const line = lines[next];
				if (line.trim() === "") continue;
				if (!/^\s+/u.test(line)) break;
				parts.push(line.trim());
			}
			return parts.join(value === "|" ? "\n" : " ");
		}
		if (/^"(.*)"$/u.test(value)) return value.slice(1, -1);
		if (/^'(.*)'$/u.test(value)) return value.slice(1, -1).replace(/''/gu, "'");
		return value;
	}
	return undefined;
}

/**
 * Absolute path of the bundled SKILL.md.
 * @param {string} skillDir absolute skill directory
 * @returns {string}
 */
export function skillFile(skillDir) {
	return join(skillDir, "SKILL.md");
}

/**
 * Markdown appended to the skill body. It is the authoritative DSH adaptation:
 * the on-disk Codex skill stays untouched (so its per-file hashes remain valid)
 * while the model is told how the same workflow runs inside DSH.
 * @param {{ skillDir: string, bindingPath: string, toolName: string }} options
 * @returns {string}
 */
export function runtimeHint(options) {
	const { skillDir, bindingPath, toolName } = options;
	return `

## DSH 运行环境（由 \`dsh-starsector-mod-workflow\` 插件注入，优先于上文冲突表述）

- 本 skill 根目录：\`${skillDir}\`。上文所有相对路径都相对它解析；读取参考文档请直接拼绝对路径（例如 \`${join(skillDir, "REF", "moci-environment.md")}\`），不要 \`cd\` 到 skill 根再运行脚本。
- **命令入口改用 DSH 工具 \`${toolName}\`**：上文「实施与验证」表里的每条命令都通过该工具执行，等价于 \`node "${join(skillDir, "Script", "moci.mjs")}" <command> [args...]\`，插件会自动设置工作目录与绑定文件，因此不需要关心 cwd。
  - \`${toolName}({ command: "doctor" })\`
  - \`${toolName}({ command: "compile" })\` / \`${toolName}({ command: "build" })\`
  - \`${toolName}({ command: "verify", args: ["--file", "data/hullmods/Foo.java"] })\`
  - \`${toolName}({ command: "sync", args: ["--file", "…"] })\`、\`${toolName}({ command: "api-src", args: ["ShipAPI"] })\`、\`${toolName}({ command: "new", args: ["hullmod", "--id", "Foo"] })\`
  - \`--file\` 仍填写**工程相对路径**（CLI 会自行换算到 projectRoot）。
- **教程检索**：\`${toolName}({ command: "tutorial", args: ["search", "--exact", "<关键词>"] })\`，读取片段用 \`args: ["read", "<chunkId>"]\`。只有在工具不可用时才退回 bash，用**绝对路径**调用 \`${join(skillDir, "Script", "tutorial.mjs")}\`。
- **项目绑定**：当前 moci.json 为 \`${bindingPath}\`，插件已把 \`SSMOD_CONFIG\` 指向它。换工程时修改插件配置项 \`binding\`（profile 的 cordis.patch.yml 中该插件的 config），不要改动 skill 包内容。
- **收尾确认**：用 DSH 的 \`ask_user_question\` 工具发送二选一问题（选项「是」「否」）。它是阻塞式工具，直接读取用户选择；不要使用 Codex 的 \`functions.request_user_input\` / \`request_user_input_async\` / \`clock.sleep\` 机制。只有用户明确选择「是」才给命令加 \`--game-approved\`；选择「否」、未回答或工具调用失败时，保留工作区结果、不写入游戏目录。
- **专项 skill**：\`starsector-moci-shipbuilding\` 与 \`starsector-rules-writing\` 是 Codex 侧的配套 skill。若当前 DSH skill 列表里没有它们，跳过对应专项规则、只按本 skill 的通用规则继续，不要臆造其内容或额外读取不存在的路径。
- 收尾时最终回复仍必须附「本次文件变更」逐文件清单。
`;
}

/**
 * Build the skill catalog candidate for one bundled skill.
 * @param {{ skillDir: string, name: string, provider: string, rank: number, posix: (path: string) => string }} options
 */
export function skillCandidate(options) {
	const { skillDir, name, provider, rank, posix } = options;
	const path = skillFile(skillDir);
	const { description } = parseSkillDocument(readFileSync(path, "utf8"), path);
	return {
		name,
		description,
		whenToUse: WHEN_TO_USE,
		invocation: { modelInvocable: true, userInvocable: true },
		provider,
		source: "bundled",
		rank,
		resourceBase: { kind: "directory", path: posix(skillDir) },
		locator: path
	};
}
