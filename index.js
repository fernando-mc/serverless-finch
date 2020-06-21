'use strict';

const path = require('path');
const fs = require('fs');

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
        return this._processDeployment();
      },
      'client:remove:remove': () => {
        return this._removeDeployedResources();
      }
    };
  }

  _validateConfig() {
    try {
      validateClient(this.serverless, this.options);
    } catch (e) {
      return Promise.reject(`Serverless Finch configuration errors:\n- ${e.join('\n- ')}`);
    }
    return Promise.resolve();
  }

  _removeDeployedResources() {
    let bucketName, manageResources, keyPrefix;

    return this._validateConfig()
      .then(() => {
        bucketName = this.options.bucketName;
        keyPrefix = this.options.keyPrefix;
        manageResources = this.options.manageResources;
        return this.cliOptions.confirm === false
          ? true
          : new Confirm(`Are you sure you want to delete bucket '${bucketName}'?`).run();
      })
      .then(goOn => {
        if (goOn) {
          this.serverless.cli.log(`Looking for bucket...`);
          return bucketUtils.bucketExists(this.aws, bucketName).then(exists => {
            if (exists) {
              this.serverless.cli.log(`Deleting all objects from bucket...`);
              return bucketUtils
                .emptyBucket(this.aws, bucketName, keyPrefix)
                .then(() => {
                  if (keyPrefix) {
                    this.serverless.cli.log(`Removed only the files under the prefix ${keyPrefix}`);
                    return true;
                  } else {
                    if (manageResources === false) {
                      this.serverless.cli.log(
                        'manageResources has been set to "false". Bucket will not be deleted'
                      );
                    } else {
                      this.serverless.cli.log(`Removing bucket...`);
                      return bucketUtils.deleteBucket(this.aws, bucketName);
                    }
                  }
                })
                .then(() => {
                  if (manageResources === false) {
                    this.serverless.cli.log(`Success! Your files have been removed`);
                  } else {
                    if (!keyPrefix) {
                      this.serverless.cli.log(
                        `Success! Your files have been removed and your bucket has been deleted`
                      );
                    }
                  }
                });
            } else {
              this.serverless.cli.log(`Bucket does not exist`);
            }
          });
        }
        this.serverless.cli.log('Bucket not removed');
        return Promise.resolve();
      })
      .catch(error => {
        return Promise.reject(new this.error(error));
      });
  }

  _processDeployment() {
    let region,
      distributionFolder,
      clientPath,
      bucketName,
      headerSpec,
      orderSpec,
      indexDoc,
      errorDoc,
      redirectAllRequestsTo,
      keyPrefix,
      sse,
      routingRules,
      manageResources,
      tags;

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
          (this.serverless.service &&
          this.serverless.service.provider &&
          this.serverless.service.provider.region
            ? this.serverless.service.provider.region
            : undefined);

        distributionFolder = this.options.distributionFolder || path.join('client/dist');
        clientPath = path.join(this.serverless.config.servicePath, distributionFolder);
        bucketName = this.options.bucketName;
        keyPrefix = this.options.keyPrefix;
        sse = this.options.sse || null;
        manageResources = this.options.manageResources;
        headerSpec = this.options.objectHeaders;
        orderSpec = this.options.uploadOrder;
        indexDoc = this.options.indexDocument || 'index.html';
        errorDoc = this.options.errorDocument || 'error.html';
        redirectAllRequestsTo = this.options.redirectAllRequestsTo || null;
        routingRules = this.options.routingRules || null;
        tags = this.options.tags || []

        const deployDescribe = ['This deployment will:'];

        if (this.cliOptions['delete-contents']) {
          deployDescribe.push(`- Remove all existing files from bucket '${bucketName}'`);
        }
        deployDescribe.push(
          `- Upload all files from '${distributionFolder}' to bucket '${bucketName}'`
        );

        if (this.cliOptions['config-change'] !== false && manageResources !== false) {
          deployDescribe.push(`- Set (and overwrite) bucket '${bucketName}' configuration`);
        }
        if (this.cliOptions['policy-change'] !== false && manageResources !== false) {
          deployDescribe.push(`- Set (and overwrite) bucket '${bucketName}' bucket policy`);
        }
        if (this.cliOptions['cors-change'] !== false && manageResources !== false) {
          deployDescribe.push(`- Set (and overwrite) bucket '${bucketName}' CORS policy`);
        }

        deployDescribe.forEach(m => this.serverless.cli.log(m));
        return this.cliOptions.confirm === false
          ? true
          : new Confirm(`Do you want to proceed?`).run();
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
                  return Promise.resolve();
                }

                this.serverless.cli.log(`Deleting all objects from bucket...`);
                return bucketUtils.emptyBucket(this.aws, bucketName, keyPrefix);
              } else {
                if (manageResources === false) {
                  return Promise.reject(
                    `Bucket does not exist, and manageResources has been set to "false". Ensure that bucket exists or that all resources are deployed first`
                  );
                }
                this.serverless.cli.log(`Bucket does not exist. Creating bucket...`);
                return bucketUtils.createBucket(this.aws, bucketName);
              }
            })
            .then(() => {
              if (this.cliOptions['config-change'] === false || manageResources === false) {
                this.serverless.cli.log(`Retaining existing bucket configuration...`);
                return Promise.resolve();
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
              if (this.cliOptions['policy-change'] === false || manageResources === false) {
                this.serverless.cli.log(`Retaining existing bucket policy...`);
                return Promise.resolve();
              }
              this.serverless.cli.log(`Configuring policy for bucket...`);
              const bucketPolicyFile = this.serverless.service.custom.client.bucketPolicyFile;
              const customPolicy =
                bucketPolicyFile && JSON.parse(fs.readFileSync(bucketPolicyFile));
              return configure.configurePolicyForBucket(this.aws, bucketName, customPolicy);
            })
            .then(() => {
              if (tags.length === 0) {
                this.serverless.cli.log(`Retaining existing tags...`);
                return Promise.resolve();
              }
              this.serverless.cli.log(`Configuring tags for bucket...`);
              return configure.configureTagsForBucket(this.aws, bucketName, tags);
            })
            .then(() => {
              if (this.cliOptions['cors-change'] === false || manageResources === false) {
                this.serverless.cli.log(`Retaining existing bucket CORS configuration...`);
                return Promise.resolve();
              }
              this.serverless.cli.log(`Configuring CORS for bucket...`);
              return configure.configureCorsForBucket(this.aws, bucketName);
            })
            .then(() => {
              this.serverless.cli.log(`Uploading client files to bucket...`);
              return uploadDirectory(
                this.aws,
                bucketName,
                clientPath,
                headerSpec,
                orderSpec,
                keyPrefix,
                sse
              );
            })
            .then(() => {
              this.serverless.cli.log(
                `Success! Your site should be available at http://${bucketName}.${regionUrls[region]}/`
              );
            });
        }
        this.serverless.cli.log('Deployment cancelled');
        return Promise.resolve();
      })
      .catch(error => {
        return Promise.reject(new this.error(error));
      });
  }
}

module.exports = Client;
