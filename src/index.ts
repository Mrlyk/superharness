import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { traceCommand } from "./commands/trace.js";

const program = new Command();

program
	.name("superharness")
	.description("与 AI 工具无关的软件工程工作流引擎")
	.version("0.1.0");

program.addCommand(initCommand);
program.addCommand(traceCommand);

program.parse();
