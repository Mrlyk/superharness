import pc from "picocolors";

export const PREFIX = pc.bold(pc.cyan("[superharness]"));

export function log(msg: string): void {
	console.log(`${PREFIX} ${msg}`);
}

export function logSuccess(msg: string): void {
	console.log(`${PREFIX} ${pc.green(msg)}`);
}

export function logWarn(msg: string): void {
	console.log(`${PREFIX} ${pc.yellow(msg)}`);
}

export function logError(msg: string): void {
	console.log(`${PREFIX} ${pc.red(msg)}`);
}
