'use strict';

const confirm = require('@serverless/utils/inquirer/confirm');
const fs = require('fs');
const path = require('path');

const bucketUtils = require('./bucket-utils');
const configure = require('./configure');
const regionUrls = require('./resources/aws-region-urls.json');
const uploadDirectory = require('./upload');
const validateClient = require('./validate');

class Client {
  constructor(serverless, cliOptions, { log }) {
    this.error = serverless.classes.Error;
    this.log = log;
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
            lifecycleEvents: ['deploy'],
            options: {
              region: {
                usage: 'Specify what AWS region the bucket will be deployed in',
                type: 'string'
              },
              'delete-contents': {
                usage: 'Delete the bucket contents before deployment',
                type: 'boolean'
              },
              'config-change': {
                usage: 'Overwrite the bucket configuration',
                type: 'boolean'
              },
              'policy-change': {
                usage: 'Overwrite the bucket policy',
                type: 'boolean'
              },
              'cors-change': {
                usage: 'Overwrite the bucket CORS configuration',
                type: 'boolean'
              },
              confirm: {
                usage: 'Display a confirmation prompt',
                type: 'boolean'
              }
            }
          },
          remove: {
            usage: 'Removes deployed files and bucket',
            lifecycleEvents: ['remove'],
            options: {
              confirm: {
                usage: 'Display a confirmation prompt',
                type: 'boolean'
              }
            }
          }
        }
      }
    };

    this.hooks = {
      'client:client': () => {
        log(this.commands.client.usage);
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
          : confirm(`Are you sure you want to delete bucket '${bucketName}'?`);
      })
      .then(goOn => {
        if (goOn) {
          this.log(`Looking for bucket...`);
          return bucketUtils.bucketExists(this.aws, bucketName).then(exists => {
            if (exists) {
              this.log(`Deleting ${keyPrefix ? `objects under ${keyPrefix}` : 'all objects'}...`);
              return bucketUtils
                .emptyBucket(this.aws, bucketName, keyPrefix)
                .then(isBucketEmpty => {
                  if (manageResources === false) {
                    this.log('manageResources has been set to "false". Bucket will not be deleted');
                    return false;
                  } else if (!isBucketEmpty) {
                    this.log('Bucket is not empty and will not be deleted');
                    return false;
                  } else {
                    this.log(`Removing bucket...`);
                    return bucketUtils.deleteBucket(this.aws, bucketName).then(() => true);
                  }
                })
                .then(isBucketDeleted => {
                  this.log(
                    `Success! Your files have been removed${
                      isBucketDeleted ? ' and your bucket has been deleted' : ''
                    }`
                  );
                });
            } else {
              this.log(`Bucket does not exist`);
            }
          });
        }
        this.log('Bucket not removed');
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
        tags = this.options.tags || [];

        const deployDescribe = ['This deployment will:'];

        if (this.cliOptions['delete-contents']) {
          deployDescribe.push(`- Remove all existing files from bucket '${bucketName}'`);
        }
        deployDescribe.push(
          `- Upload all files from '${distributionFolder}' to bucket '${bucketName}'${
            keyPrefix ? ` under the prefix '${keyPrefix}'` : ''
          }`
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

        deployDescribe.forEach(m => this.log(m));
        return this.cliOptions.confirm === false ? true : confirm(`Do you want to proceed?`);
      })
      .then(goOn => {
        if (goOn) {
          this.log(`Looking for bucket...`);
          return bucketUtils
            .bucketExists(this.aws, bucketName)
            .then(exists => {
              if (exists) {
                this.log(`Bucket found...`);
                if (this.cliOptions['delete-contents'] === false) {
                  this.log(`Keeping current bucket contents...`);
                  return Promise.resolve();
                }

                this.log(`Deleting all objects from bucket...`);
                return bucketUtils.emptyBucket(this.aws, bucketName, keyPrefix);
              } else {
                if (manageResources === false) {
                  return Promise.reject(
                    `Bucket does not exist, and manageResources has been set to "false". Ensure that bucket exists or that all resources are deployed first`
                  );
                }
                this.log(`Bucket does not exist. Creating bucket...`);
                return bucketUtils.createBucket(this.aws, bucketName);
              }
            })
            .then(() => {
              if (this.cliOptions['config-change'] === false || manageResources === false) {
                this.log(`Retaining existing bucket configuration...`);
                return Promise.resolve();
              }
              this.log(`Configuring bucket...`);
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
                this.log(`Retaining existing bucket policy...`);
                return Promise.resolve();
              }
              this.log(`Configuring policy for bucket...`);
              const bucketPolicyFile = this.serverless.service.custom.client.bucketPolicyFile;
              const customPolicy =
                bucketPolicyFile && JSON.parse(fs.readFileSync(bucketPolicyFile));
              return configure.configurePolicyForBucket(this.aws, bucketName, customPolicy);
            })
            .then(() => {
              if (tags.length === 0) {
                this.log(`Retaining existing tags...`);
                return Promise.resolve();
              }
              this.log(`Configuring tags for bucket...`);
              return configure.configureTagsForBucket(this.aws, bucketName, tags);
            })
            .then(() => {
              if (this.cliOptions['cors-change'] === false || manageResources === false) {
                this.log(`Retaining existing bucket CORS configuration...`);
                return Promise.resolve();
              }
              this.log(`Configuring CORS for bucket...`);
              const corsFile = this.serverless.service.custom.client.corsFile;
              const customRules = corsFile && JSON.parse(fs.readFileSync(corsFile));
              return configure.configureCorsForBucket(this.aws, bucketName, customRules);
            })
            .then(() => {
              this.log(`Uploading client files to bucket...`);
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
              this.log(
                `Success! Your site should be available at http://${bucketName}.${regionUrls[region]}/`
              );
            });
        }
        this.log('Deployment cancelled');
        return Promise.resolve();
      })
      .catch(error => {
        return Promise.reject(new this.error(error));
      });
  }
}

module.exports = Client;
