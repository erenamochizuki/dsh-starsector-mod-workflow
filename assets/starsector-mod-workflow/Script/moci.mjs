#!/usr/bin/env node
import { runMoci } from './lib/moci-tools.mjs';

try {
  process.exitCode = await runMoci(process.argv[2] || 'help', process.argv.slice(3));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
