/**
 * Synthetic moci project used by the tests when the machine has no real
 * `moci.json` binding (CI, fresh clones). It contains only what `loadProject()`
 * validates: a `pom.xml`, a `MociShipPack/mod_info.json` declaring the
 * `moci_shippack` id, and a plausible `target` build artifact path.
 *
 * The fixture is *not* a compilable project and has no JDK/Maven/game — tests
 * that need those must skip instead of asserting success.
 *
 * @returns {{ dir: string, bindingPath: string, cleanup: () => void }}
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export function createFixtureProject() {
	const dir = mkdtempSync(join(tmpdir(), "dsh-moci-fixture-"));
	const projectRoot = join(dir, "Moci");
	const mod = join(projectRoot, "MociShipPack");
	mkdirSync(join(projectRoot, "src"), { recursive: true });
	mkdirSync(join(mod, "jars"), { recursive: true });

	writeFileSync(
		join(projectRoot, "pom.xml"),
		[
			'<?xml version="1.0" encoding="UTF-8"?>',
			'<project xmlns="http://maven.apache.org/POM/4.0.0">',
			"  <modelVersion>4.0.0</modelVersion>",
			"  <groupId>fixture</groupId>",
			"  <artifactId>moci-fixture</artifactId>",
			"  <version>0.0.0</version>",
			"</project>",
			""
		].join("\n")
	);
	writeFileSync(
		join(mod, "mod_info.json"),
		JSON.stringify(
			{
				id: "moci_shippack",
				name: "Moci fixture",
				version: "0.0.0",
				modPlugin: "data.scripts.Moci_bounty_plugin",
				jars: ["jars/MociShipPack.jar"]
			},
			null,
			2
		) + "\n"
	);

	const bindingPath = join(dir, "moci.json");
	const binding = {
		profile: "moci-maven",
		projectRoot,
		sourceRoot: join(projectRoot, "src"),
		mod,
		gameRoot: join(dir, "game"),
		gameMod: join(dir, "game", "mods", "fixture-mod"),
		jdkHome: join(dir, "jdk-17"),
		jdk: join(dir, "jdk-17"),
		maven: join(dir, "maven", "bin", process.platform === "win32" ? "mvn.cmd" : "mvn"),
		buildArtifact: join(projectRoot, "target", "moci-fixture.jar"),
		workRoot: join(projectRoot, ".work", "MociShipPack"),
		apiSourceRoots: [join(projectRoot, "starfarer.api")],
		autoDeployJar: false,
		autoUpdateWorkspaceJar: false,
		autoSyncResources: false,
		gameSyncRequiresApproval: true,
		resourceSyncMode: "explicit-current-task-file-list"
	};
	writeFileSync(bindingPath, JSON.stringify(binding, null, 2) + "\n");

	return {
		dir,
		bindingPath,
		cleanup: () => rmSync(dir, { recursive: true, force: true })
	};
}
