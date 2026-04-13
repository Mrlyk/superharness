import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

export interface ConfirmOptions {
	defaultYes?: boolean;
	assumeYes?: boolean;
}

export async function confirm(
	question: string,
	opts: ConfirmOptions = {},
): Promise<boolean> {
	const { defaultYes = false, assumeYes = false } = opts;
	if (assumeYes) return true;

	const suffix = defaultYes ? " (Y/n) " : " (y/N) ";
	const rl = createInterface({ input: stdin, output: stdout });
	try {
		const answer = await new Promise<string>((res) =>
			rl.question(question + suffix, res),
		);
		const trimmed = answer.trim().toLowerCase();
		if (trimmed === "") return defaultYes;
		return trimmed === "y" || trimmed === "yes";
	} finally {
		rl.close();
	}
}
