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

    this.clientOptions = [].concat(serverless.service.custom.client).filter(c => c);

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
          },
          diagnostics: {
            usage: 'prints out diagnostics',
            lifecycleEvents: ['diagnostics']
          }
        }
      }
    };

    this.hooks = {
      'client:client': () => {
        serverless.cli.log(this.commands.client.usage);
      },
      'client:deploy:deploy': () => {
        return this._processAllDeployments();
      },
      'client:remove:remove': () => {
        return this._removeAllDeployedResources();
      },
      'client:diagnostics:diagnostics': () => {
        return this._printDiagnostics();
      }
    };
  }

  _printDiagnostics() {
    this.serverless.cli.log(JSON.stringify(this.clientOptions));
    this._validateAllConfigs();
  }

  _validateAllConfigs() {
    const _validations = this.clientOptions.map(options => this._validateConfig(options));
    return Promise.all(_validations);
  }

  _validateConfig(options) {
    try {
      validateClient(this.serverless, options);
    } catch (e) {
      return Promise.reject(
        `Serverless Finch configuration errors:\n- ${[].concat(e).join('\n- ')}`
      );
    }
    return Promise.resolve();
  }

  _removeAllDeployedResources() {
    const _resourceRemovals = this.clientOptions.map(options =>
      this._removeDeployedResources(options)
    );

    return Promise.all(_resourceRemovals);
  }

  _removeDeployedResources(options) {
    let bucketName, manageResources, keyPrefix;

    return this._validateConfig(options)
      .then(() => {
        bucketName = options.bucketName;
        keyPrefix = options.keyPrefix;
        manageResources = options.manageResources;
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

  _processAllDeployments() {
    const _processedDeployments = this.clientOptions.map(options =>
      this._processDeployment(options)
    );

    return Promise.all(_processedDeployments);
  }

  _processDeployment(options) {
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
      bucketPolicyFile;

    return this._validateConfig(options)
      .then(() => {
        // region is set based on the following order of precedence:
        // If specified, the CLI option is used
        // If region is not specified via the CLI, we use the region option specified
        //   under custom/client in serverless.yml
        // Otherwise, use the Serverless region specified under provider in serverless.yml

        region =
          this.cliOptions.region ||
          options.region ||
          (this.serverless.service &&
          this.serverless.service.provider &&
          this.serverless.service.provider.region
            ? this.serverless.service.provider.region
            : undefined);

        distributionFolder = options.distributionFolder || path.join('client/dist');
        clientPath = path.join(this.serverless.config.servicePath, distributionFolder);
        bucketName = options.bucketName;
        keyPrefix = options.keyPrefix;
        sse = options.sse || null;
        manageResources = options.manageResources;
        headerSpec = options.objectHeaders;
        orderSpec = options.uploadOrder;
        indexDoc = options.indexDocument || 'index.html';
        errorDoc = options.errorDocument || 'error.html';
        redirectAllRequestsTo = options.redirectAllRequestsTo || null;
        routingRules = options.routingRules || null;
        bucketPolicyFile = options.bucketPolicyFile || null;

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
              const customPolicy =
                bucketPolicyFile && JSON.parse(fs.readFileSync(bucketPolicyFile));
              return configure.configurePolicyForBucket(this.aws, bucketName, customPolicy);
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
