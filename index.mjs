#!/usr/bin/env -S node --no-warnings --experimental-modules
import { runAll } from './test-runner';

if (process.argv.length < 3) {
    console.log('Please specify which tests to run.');
    process.exit(1);
}
runAll(process.argv.slice(2));
