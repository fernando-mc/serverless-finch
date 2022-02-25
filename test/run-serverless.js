'use strict';

const path = require('path');
const setupServerless = require('./setup-serverless');

/**
 * Version of serverless to use in tests
 * (otherwise latest code is downloaded from main branch)
 */
const version = process.env.SERVERLESS_VERSION;

/**
 * Initializes fixture engine for a folder and returns `runServerless` runner
 *
 * - https://github.com/serverless/test/blob/main/docs/run-serverless.md
 * - https://github.com/serverless/test/blob/main/docs/setup-run-serverless-fixtures-engine.md
 */
module.exports = require('@serverless/test/setup-run-serverless-fixtures-engine')({
  fixturesDir: path.resolve(__dirname, './fixtures'),
  resolveServerlessDir: async () => (await setupServerless({ version })).root
});
