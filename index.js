'use strict';

const path = require('path');

const _ = require('lodash');
const BbPromise = require('bluebird');

const bucketUtils = require('./lib/bucketUtils');
const configure = require('./lib/configure');
const regionUrls = require('./lib/resources/awsRegionUrls');
const uploadDirectory = require('./lib/upload');
const validateClient = require('./lib/validate');

class Client {
  constructor(serverless, cliOptions) {
    this.error = serverless.classes.Error;
    this.serverless = serverless;
    this.options = serverless.service.custom.client;
    this.cliOptions = cliOptions || {};
    this.aws = this.serverless.getProvider('aws');

    this.commands = {
      client: {
        usage: 'Generate and deploy clients',
        lifecycleEvents: ['client', 'deploy'],
        commands: {
          deploy: {
            usage: 'Deploy serverless client code',
            lifecycleEvents: ['deploy']
          },
          remove: {
            usage: 'Removes deployed files and bucket',
            lifecycleEvents: ['remove']
          }
        }
      }
    };

    this.hooks = {
      'client:client': () => {
        serverless.cli.log(this.commands.client.usage);
      },
      'client:deploy:deploy': () => {
        this._processDeployment();
      },
      'client:remove:remove': () => {
        this._removeDeployedResources();
      }
    };
  }

  _validateConfig() {
    const validationError = validateClient(this.serverless, this.options);
    if (validationError) {
      return BbPromise.reject(new this.error(validationError));
    }
  }

  _removeDeployedResources() {
    this._validateConfig();

    const safetyDelay = 3000;
    const bucketName = this.options.bucketName;

    this.serverless.cli.log(
      `Preparing to empty and remove bucket '${bucketName}', waiting for ${safetyDelay /
        1000} seconds...`
    );

    return BbPromise.delay(safetyDelay)
      .then(() => {
        this.serverless.cli.log(`Looking for bucket...`);
        return bucketUtils.bucketExists(this.aws, bucketName);
      })
      .then(exists => {
        if (exists) {
          this.serverless.cli.log(`Deleting all objects from bucket...`);
          return bucketUtils
            .emptyBucket(this.aws, bucketName)
            .then(() => {
              this.serverless.cli.log(`Removing bucket...`);
              return bucketUtils.deleteBucket(this.aws, bucketName);
            })
            .then(() => {
              this.serverless.cli.log(
                `Success! Your files have been removed and your bucket has been deleted`
              );
            });
        } else {
          this.serverless.cli.log(`Bucket does not exist`);
        }
      })
      .catch(error => {
        return BbPromise.reject(new this.error(error));
      });
  }

  _processDeployment() {
    this._validateConfig();

    const region =
      this.cliOptions.region ||
      this.options.region ||
      _.get(this.serverless, 'service.provider.region');
    const distributionFolder = this.options.distributionFolder || path.join('client/dist');
    const clientPath = path.join(this.serverless.config.servicePath, distributionFolder);
    const bucketName = this.options.bucketName;
    const headerSpec = this.options.objectHeaders;
    const indexDoc = this.options.indexDocument || index.html;
    const errorDoc = this.options.errorDocument || error.html;

    this.serverless.cli.log(`Deploying client to bucket '${bucketName}' in region '${region}'...`);

    const keepBucket =
      this.cliOptions['delete-contents'] === false ||
      this.cliOptions['config-change'] === false ||
      this.cliOptions['policy-change'] === false ||
      this.cliOptions['cors-change'] === false;

    this.serverless.cli.log(`Looking for bucket...`);
    return bucketUtils
      .bucketExists(this.aws, bucketName)
      .then(exists => {
        if (exists) {
          if (this.cliOptions['delete-contents'] === false) {
            this.serverless.cli.log(`Keeping current bucket contents...`);
            return BbPromise.resolve();
          }

          this.serverless.cli.log(`Deleting all objects from bucket...`);
          return bucketUtils.emptyBucket(this.aws, bucketName).then(() => {
            if (keepBucket) {
              this.serverless.cli.log(`Keeping existing bucket...`);
              return BbPromise.resolve();
            }
            this.serverless.cli.log(`Removing bucket...`);
            return bucketUtils.deleteBucket(this.aws, bucketName);
          });
        } else {
          this.serverless.cli.log(`Bucket does not exist`);
          return BbPromise.resolve();
        }
      })
      .then(() => {
        if (keepBucket) {
          this.serverless.cli.log(`Skipping bucket creation...`);
          return BbPromise.resolve();
        }
        this.serverless.cli.log(`Creating bucket...`);
        return bucketUtils.createBucket(this.aws, bucketName);
      })
      .then(() => {
        if (this.cliOptions['config-change'] === false) {
          this.serverless.cli.log(`Retaining existing bucket configuration...`);
          return BbPromise.resolve();
        }
        this.serverless.cli.log(`Configuring bucket...`);
        return configure.configureBucket(this.aws, bucketName, indexDoc, errorDoc);
      })
      .then(() => {
        if (this.cliOptions['policy-change'] === false) {
          this.serverless.cli.log(`Retaining existing bucket policy...`);
          return BbPromise.resolve();
        }
        this.serverless.cli.log(`Configuring policy for bucket...`);
        return configure.configurePolicyForBucket(this.aws, bucketName);
      })
      .then(() => {
        if (this.cliOptions['cors-change'] === false) {
          this.serverless.cli.log(`Retaining existing bucket CORS configuration...`);
          return BbPromise.resolve();
        }
        this.serverless.cli.log(`Configuring CORS for bucket...`);
        return configure.configureCorsForBucket(this.aws, bucketName);
      })
      .then(() => {
        this.serverless.cli.log(`Uploading client files to bucket...`);
        return uploadDirectory(this.aws, bucketName, clientPath, headerSpec);
      })
      .then(() => {
        this.serverless.cli.log(
          `Success! Your site should be available at http://${bucketName}.${regionUrls[region]}/`
        );
      })
      .catch(error => {
        return BbPromise.reject(new this.error(error));
      });
  }
}

module.exports = Client;
