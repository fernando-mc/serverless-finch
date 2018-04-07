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
  constructor(serverless, options) {
    this.error = serverless.classes.Error;
    this.serverless = serverless;
    this.options = serverless.service.custom.client;
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
        this.serverless.cli.log(`Looking for bucket '${bucketName}' ...`);
        return bucketUtils.bucketExists(this.aws, bucketName);
      })
      .then(exists => {
        if (exists) {
          this.serverless.cli.log(`Deleting all objects from bucket '${bucketName}' ...`);
          bucketUtils.emptyBucket(this.aws, bucketName).then(() => {
            this.serverless.cli.log(`Removing bucket '${bucketName}' ...`);
            bucketUtils.deleteBucket(this.aws, bucketName);
          });
        } else {
          this.serverless.cli.log(`Bucket '${bucketName}' does not exist`);
        }
      });
  }

  _processDeployment() {
    this._validateConfig();

    const region = this.options.region || _.get(this.serverless, 'service.provider.region');
    const distributionFolder = _.get(
      this.serverless,
      'service.custom.client.distributionFolder',
      path.join('client/dist')
    );
    const clientPath = path.join(this.serverless.config.servicePath, distributionFolder);
    const bucketName = this.options.bucketName;

    this.serverless.cli.log(`Deploying client in region '${region}'...`);

    this.serverless.cli.log(`Looking for bucket '${bucketName}' ...`);
    return bucketUtils
      .bucketExists(this.aws, bucketName)
      .then(exists => {
        if (exists) {
          this.serverless.cli.log(`Deleting all objects from bucket '${bucketName}' ...`);
          return bucketUtils.emptyBucket(this.aws, bucketName).then(() => {
            this.serverless.cli.log(`Removing bucket '${bucketName}' ...`);
            return bucketUtils.deleteBucket(this.aws, bucketName);
          });
        } else {
          this.serverless.cli.log(`Bucket '${bucketName}' does not exist`);
          return BbPromise.resolve();
        }
      })
      .then(() => {
        this.serverless.cli.log(`Creating bucket ${bucketName}...`);
        return bucketUtils.createBucket(this.aws, bucketName);
      })
      .then(() => {
        this.serverless.cli.log(`Configuring bucket...`);
        const indexDoc = this.serverless.service.custom.client.indexDocument || 'index.html';
        const errorDoc = this.serverless.service.custom.client.errorDocument || 'error.html';
        return configure.configureBucket(this.aws, bucketName, indexDoc, errorDoc);
      })
      .then(() => {
        this.serverless.cli.log(`Configuring policy for bucket...`);
        return configure.configurePolicyForBucket(this.aws, bucketName);
      })
      .then(() => {
        this.serverless.cli.log(`Configuring CORS policy for bucket...`);
        return configure.configureCorsForBucket(this.aws, bucketName);
      })
      .then(() => {
        this.serverless.cli.log(`Uploading client files to bucket...`);
        return uploadDirectory(this.aws, bucketName, clientPath, clientPath);
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
