'use strict';

const path = require('path');

const _ = require('lodash');
const BbPromise = require('bluebird');
const Confirm = require('prompt-confirm');

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
    try {
      validateClient(this.serverless, this.options);
    } catch (e) {
      return BbPromise.reject(`Serverless Finch configuration errors:\n- ${e.join('\n- ')}`);
    }
    return BbPromise.resolve();
  }

  _removeDeployedResources() {
    let bucketName;

    return this._validateConfig()
      .then(() => {
        bucketName = this.options.bucketName;
        return new Confirm(`Are you sure you want to delete bucket '${bucketName}'?`).run();
      })
      .then(goOn => {
        if (goOn) {
          this.serverless.cli.log(`Looking for bucket...`);
          return bucketUtils.bucketExists(this.aws, bucketName).then(exists => {
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
          });
        }
        this.serverless.cli.log('Bucket not removed');
        return BbPromise.resolve();
      })
      .catch(error => {
        return BbPromise.reject(new this.error(error));
      });
  }

  _processDeployment() {
    let region,
      distributionFolder,
      clientPath,
      bucketName,
      headerSpec,
      indexDoc,
      errorDoc,
      redirectAllRequestsTo,
      routingRules;

    return this._validateConfig()
      .then(() => {
        // region is set based on the following order of precedence:
        // If specified, the CLI option is used
        // If region is not specified via the CLI, we use the region option specified
        //   under custom/client in serverless.yml
        // Otherwise, use the Serverless region specified under provider in serverless.yml
        region =
          this.cliOptions.region ||
          this.options.region ||
          _.get(this.serverless, 'service.provider.region');

        distributionFolder = this.options.distributionFolder || path.join('client/dist');
        clientPath = path.join(this.serverless.config.servicePath, distributionFolder);
        bucketName = this.options.bucketName;
        headerSpec = this.options.objectHeaders;
        indexDoc = this.options.indexDocument || index.html;
        errorDoc = this.options.errorDocument || error.html;
        redirectAllRequestsTo = this.options.redirectAllRequestsTo || null;
        routingRules = this.options.routingRules || null;

        const deployDescribe = ['This deployment will:'];

        if (this.cliOptions['delete-contents']) {
          deployDescribe.push(`- Remove all existing files from bucket '${bucketName}'`);
        }
        deployDescribe.push(
          `- Upload all files from '${distributionFolder}' to bucket '${bucketName}'`
        );
        if (this.cliOptions['config-change'] !== false) {
          deployDescribe.push(`- Set (and overwrite) bucket '${bucketName}' configuration`);
        }
        if (this.cliOptions['policy-change'] !== false) {
          deployDescribe.push(`- Set (and overwrite) bucket '${bucketName}' bucket policy`);
        }
        if (this.cliOptions['cors-change'] !== false) {
          deployDescribe.push(`- Set (and overwrite) bucket '${bucketName}' CORS policy`);
        }

        deployDescribe.forEach(m => this.serverless.cli.log(m));
        return new Confirm(`Do you want to proceed?`).run();
      })
      .then(goOn => {
        if (goOn) {
          this.serverless.cli.log(`Looking for bucket...`);
          return bucketUtils
            .bucketExists(this.aws, bucketName)
            .then(exists => {
              if (exists) {
                this.serverless.cli.log(`Bucket found...`);
                if (this.cliOptions['delete-contents'] === false) {
                  this.serverless.cli.log(`Keeping current bucket contents...`);
                  return BbPromise.resolve();
                }

                this.serverless.cli.log(`Deleting all objects from bucket...`);
                return bucketUtils.emptyBucket(this.aws, bucketName);
              } else {
                this.serverless.cli.log(`Bucket does not exist. Creating bucket...`);
                return bucketUtils.createBucket(this.aws, bucketName);
              }
            })
            .then(() => {
              if (this.cliOptions['config-change'] === false) {
                this.serverless.cli.log(`Retaining existing bucket configuration...`);
                return BbPromise.resolve();
              }
              this.serverless.cli.log(`Configuring bucket...`);
              return configure.configureBucket(
                this.aws,
                bucketName,
                indexDoc,
                errorDoc,
                redirectAllRequestsTo,
                routingRules
              );
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
                `Success! Your site should be available at http://${bucketName}.${
                  regionUrls[region]
                }/`
              );
            });
        }
        this.serverless.cli.log('Deployment cancelled');
        return BbPromise.resolve();
      })
      .catch(error => {
        return BbPromise.reject(new this.error(error));
      });
  }
}

module.exports = Client;
