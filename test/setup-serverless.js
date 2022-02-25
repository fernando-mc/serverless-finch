'use strict';

const path = require('path');
const os = require('os');
const crypto = require('crypto');
const spawn = require('child-process-ext/spawn');
const { ensureDir, ensureSymlink, writeJson, realpath, removeSync } = require('fs-extra');
const fetch = require('node-fetch');
const tar = require('tar');
const memoizee = require('memoizee');
const log = require('log').get('test');

const tmpDir = os.tmpdir();

/**
 * 1. Download and extract serverless from GitHub to temp directory
 * 2. Install dependencies
 * 3. Link serverless-finch dependency
 *
 * Adapted from the Serverless Dashboard Plugin:
 * https://github.com/serverless/dashboard-plugin/blob/main/test/setup-serverless/index.js
 */
module.exports = memoizee(
  (options = {}) => {
    const serverlessTmpDir = path.join(
      tmpDir,
      `serverless-finch-plugin-test-${crypto.randomBytes(2).toString('hex')}`
    );

    log.notice(`Setup 'serverless' at ${serverlessTmpDir}`);
    return ensureDir(serverlessTmpDir)
      .then(() => {
        if (!options.shouldKeepServerlessDir) {
          process.on('exit', () => {
            try {
              removeSync(serverlessTmpDir);
            } catch (error) {
              // Safe to ignore
            }
          });
        }

        log.debug('... fetch tarball');

        return fetch(
          `https://github.com/serverless/serverless/archive/${
            options.version ? `refs/tags/v${options.version}` : 'main'
          }.tar.gz`
        );
      })
      .then(res => {
        const tarDeferred = tar.x({ cwd: serverlessTmpDir, strip: 1 });
        res.body.pipe(tarDeferred);
        return new Promise((resolve, reject) => {
          res.body.on('error', reject);
          tarDeferred.on('error', reject);
          tarDeferred.on('finish', resolve);
        });
      })
      .then(() => {
        log.debug('... patch serverless/package.json');
        const pkgJsonPath = `${serverlessTmpDir}/package.json`;
        const pkgJson = require(pkgJsonPath);
        // Do not npm install serverless-finch
        // (local installation will be linked in further steps)
        delete pkgJson.dependencies['serverless-finch'];
        // Prevent any postinstall setup
        delete pkgJson.scripts.postinstall;
        return writeJson(pkgJsonPath, pkgJson);
      })
      .then(() => {
        return spawn('npm', ['install', '--production'], { cwd: serverlessTmpDir });
      })
      .then(() => {
        log.debug('... link serverless-finch dependency');
        return ensureSymlink(
          path.join(__dirname, '../'),
          path.join(serverlessTmpDir, 'node_modules/serverless-finch'),
          'junction'
        );
      })
      .then(() => {
        return realpath(path.join(serverlessTmpDir, 'node_modules/serverless-finch'));
      })
      .then(pluginPath => {
        return {
          root: serverlessTmpDir,
          binary: path.join(serverlessTmpDir, 'bin/serverless.js'),
          version: require(`${serverlessTmpDir}/package`).version,
          plugin: pluginPath
        };
      });
  },
  { promise: true }
);
