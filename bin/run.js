#!/usr/bin/env node
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tsx = resolve(__dirname, '..', 'node_modules', '.bin', 'tsx');
const entry = resolve(__dirname, 'ledger.ts');

const { status } = spawnSync(tsx, [entry, ...process.argv.slice(2)], { stdio: 'inherit' });
process.exit(status ?? 0);
