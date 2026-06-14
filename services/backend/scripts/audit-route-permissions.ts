/**
 * Audit Elysia controllers for authenticated mutating routes missing hasPermission.
 *
 * Usage: bun run scripts/audit-route-permissions.ts
 * Exit code 1 when findings exist (CI-friendly).
 */
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

const CONTROLLERS_DIR = join(import.meta.dir, '../src/modules');
const MUTATING = /\.(post|patch|put|delete)\s*\(/gi;
const PUBLIC_MARKERS = ['prefix: \'/public', 'prefix: "/public', "prefix: '/engine", 'prefix: "/engine'];
const SKIP_PERMISSION = [
    'iam/login', 'iam/refresh', 'iam/verify-otp', 'guest/login', '/health',
    'guest-actions', '/logout-all', '/change-password', '/verify-password', '/profile',
    '/push/register', '/push/unregister', 'super-admin.controller',
];

interface Finding {
    file: string;
    method: string;
    line: number;
    snippet: string;
}

function walkControllers(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...walkControllers(full));
        else if (entry.name.endsWith('.controller.ts')) out.push(full);
    }
    return out;
}

function auditFile(filePath: string): Finding[] {
    const rel = filePath.replace(CONTROLLERS_DIR, '').replace(/\\/g, '/');
    const content = readFileSync(filePath, 'utf-8');
    if (PUBLIC_MARKERS.some(m => content.includes(m))) return [];

    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        const match = line.match(/\.(post|patch|put|delete)\s*\(/i);
        if (!match?.[1]) continue;

        const method = match[1].toUpperCase();
        const window = lines.slice(i, Math.min(i + 35, lines.length)).join('\n');
        const hasSignedIn = /isSignedIn\s*:\s*true/.test(window);
        const hasPermission = /hasPermission\s*:/.test(window);
        const isPublic = !hasSignedIn;

        if (isPublic) continue;
        if (hasPermission) continue;
        if (SKIP_PERMISSION.some(s => window.includes(s) || rel.includes(s))) continue;

        findings.push({
            file: rel,
            method,
            line: i + 1,
            snippet: line.trim().slice(0, 120),
        });
    }

    return findings;
}

const files = walkControllers(CONTROLLERS_DIR);
const allFindings = files.flatMap(auditFile);

console.log(`\nRoute permission audit — ${files.length} controllers scanned\n`);

if (allFindings.length === 0) {
    console.log('✓ No authenticated mutating routes missing hasPermission.\n');
    process.exit(0);
}

for (const f of allFindings) {
    console.log(`  ${f.method} ${f.file}:${f.line}`);
    console.log(`    ${f.snippet}`);
}

console.log(`\n${allFindings.length} route(s) need review (isSignedIn without hasPermission).\n`);
process.exit(1);
