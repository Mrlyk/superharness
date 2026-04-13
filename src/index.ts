import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { traceCommand } from "./commands/trace.js";

const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version: string };

const program = new Command();

program
	.name("superharness")
	.description("与 AI 工具无关的软件工程工作流引擎")
	.version(pkg.version);

program.addCommand(initCommand);
program.addCommand(traceCommand);

program.parse();
