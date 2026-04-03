import { Command } from "commander";
import { initCommand } from "./commands/init.js";

const program = new Command();

program
	.name("superharness")
	.description("AI tool-agnostic workflow engine for software engineering")
	.version("0.1.0");

program.addCommand(initCommand);

program.parse();
