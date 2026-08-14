import { execSync } from 'child_process';

console.log('\x1b[32m%s\x1b[0m', '════════════════════════════════════════════════════════════');
console.log('\x1b[32m%s\x1b[0m', '  ALAN DATABASE • DUAL REPO SYNC (GITHUB + GITLAB)');
console.log('\x1b[32m%s\x1b[0m', '════════════════════════════════════════════════════════════');

function run(cmd: string, desc: string) {
	try {
		console.log(`\x1b[90m> ${desc} (${cmd})...\x1b[0m`);
		const stdout = execSync(cmd, { stdio: 'pipe' }).toString();
		if (stdout.trim()) console.log(stdout.trim());
		console.log(`\x1b[32m✔ ${desc} complete.\x1b[0m\n`);
	} catch (err: any) {
		console.warn(`\x1b[33m⚠ ${desc} notice:\x1b[0m ${err.stderr?.toString() || err.message}\n`);
	}
}

// 1. Check working directory status
run('git status -s', 'Checking git tree');

// 2. Push to GitHub (origin)
run('git push origin main', 'Pushing to GitHub (origin main)');

// 3. Push to GitLab (gitlab)
run('git push gitlab main', 'Pushing to GitLab (gitlab main)');

console.log('\x1b[32m%s\x1b[0m', '✨ Dual repository synchronization process finished!');
