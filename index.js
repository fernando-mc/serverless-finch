'use strict';

// const path = require('path');
const BbPromise = require('bluebird');
// const async = require('async');
// const _ = require('lodash');
// const mime = require('mime');
// const fs = require('fs');

const validateClient = require('./lib/validate');
const deleteBucket = require('./lib/delete');
const emptyBucket = require('./lib/empty');
const bucketUtils = require('./lib/bucketUtils');

class Client {
  constructor(serverless, options) {
    this.error = serverless.classes.Error;

    if (validateClient(serverless, options)) {
      BbPromise.reject(new this.Error(e));
    }

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

  _removeDeployedResources() {
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
          emptyBucket(this.aws, bucketName).then(() => {
            this.serverless.cli.log(`Removing bucket '${bucketName}' ...`);
            deleteBucket(this.aws, bucketName);
          });
        } else {
          this.serverless.cli.log(`Bucket '${bucketName}' does not exist`);
        }
      });
  }

  // _processDeployment() {
  //   this.serverless.cli.log(
  //     'Deploying client to stage "' + this.stage + '" in region "' + this.region + '"...'
  //   );

  //   return this.listBuckets()
  //     .then(this.findBucket)
  //     .then(this.listObjectsInBucket)
  //     .then(this.deleteObjectsFromBucket)
  //     .then(createBucket)
  //     .then(configureBucket)
  //     .then(configurePolicyForBucket)
  //     .then(configureCorsForBucket)
  //     .then(function() {
  //       return upload(this);
  //     });
  // }
}

module.exports = Client;
