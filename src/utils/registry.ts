export interface RegistryResult {
	latest: string | null;
	error?: string;
}

export async function fetchLatestVersion(
	pkgName: string,
	timeoutMs = 1500,
): Promise<RegistryResult> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	try {
		const res = await fetch(
			`https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`,
			{ signal: controller.signal },
		);
		if (!res.ok) return { latest: null, error: `HTTP ${res.status}` };
		const data = (await res.json()) as { version?: string };
		return { latest: data.version || null };
	} catch (err) {
		return { latest: null, error: (err as Error).message };
	} finally {
		clearTimeout(timer);
	}
}

export function isVersionOutdated(current: string, latest: string): boolean {
	const parse = (v: string) =>
		v
			.replace(/^v/, "")
			.split(/[.\-+]/)
			.map((p) => Number.parseInt(p, 10))
			.map((n) => (Number.isFinite(n) ? n : 0));
	const a = parse(current);
	const b = parse(latest);
	const len = Math.max(a.length, b.length);
	for (let i = 0; i < len; i++) {
		const x = a[i] || 0;
		const y = b[i] || 0;
		if (x < y) return true;
		if (x > y) return false;
	}
	return false;
}
