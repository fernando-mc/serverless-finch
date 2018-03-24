'use strict';

const path = require('path');
const BbPromise = require('bluebird');
const async = require('async');
const _ = require('lodash');
const mime = require('mime');
const fs = require('fs');
const is = require('is_js');

// per http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_website_region_endpoints
const regionToUrlRootMap = region =>
  ({
    'us-east-2': 's3-website.us-east-2.amazonaws.com',
    'us-east-1': 's3-website-us-east-1.amazonaws.com',
    'us-west-1': 's3-website-us-west-1.amazonaws.com',
    'us-west-2': 's3-website-us-west-2.amazonaws.com',
    'ca-central-1': 's3-website.ca-central-1.amazonaws.com',
    'ap-south-1': 's3-website.ap-south-1.amazonaws.com',
    'ap-northeast-2': 's3-website.ap-northeast-2.amazonaws.com',
    'ap-southeast-1': 's3-website-ap-southeast-1.amazonaws.com',
    'ap-southeast-2': 's3-website-ap-southeast-2.amazonaws.com',
    'ap-northeast-1': 's3-website-ap-northeast-1.amazonaws.com',
    'eu-central-1': 's3-website.eu-central-1.amazonaws.com',
    'eu-west-1': 's3-website-eu-west-1.amazonaws.com',
    'eu-west-2': 's3-website.eu-west-2.amazonaws.com',
    'eu-west-3': 's3-website.eu-west-3.amazonaws.com',
    'sa-east-1': 's3-website-sa-east-1.amazonaws.com'
  }[region]);

class Client {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.provider = 'aws';
    this.aws = this.serverless.getProvider(this.provider);

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
        this.serverless.cli.log(this.commands.client.usage);
      },

      'client:deploy:deploy': () => {
        this.stage = options.stage || _.get(serverless, 'service.provider.stage');
        this.region = options.region || _.get(serverless, 'service.provider.region');
        this._validateAndPrepare().then(this._processDeployment.bind(this));
      },
      'client:remove:remove': () => {
        this._removeDeployedResources();
      }
    };
  }

  // Shared functions

  listBuckets() {
    return this.aws.request('S3', 'listBuckets', {}).bind(this);
  }

  findBucket(data) {
    data.Buckets.forEach(
      function(bucket) {
        if (bucket.Name === this.bucketName) {
          this.bucketExists = true;
          this.serverless.cli.log(`Bucket ${this.bucketName} exists`);
        }
      }.bind(this)
    );
  }

  listObjectsInBucket() {
    if (!this.bucketExists) return BbPromise.resolve();

    this.serverless.cli.log(`Listing objects in bucket ${this.bucketName}...`);

    let params = {
      Bucket: this.bucketName
    };

    return this.aws.request('S3', 'listObjectsV2', params);
  }

  deleteObjectsFromBucket(data) {
    if (!this.bucketExists) return BbPromise.resolve();

    this.serverless.cli.log(`Deleting all objects from bucket ${this.bucketName}...`);

    if (!data.Contents[0]) {
      return BbPromise.resolve();
    } else {
      let Objects = _.map(data.Contents, function(content) {
        return _.pick(content, 'Key');
      });

      let params = {
        Bucket: this.bucketName,
        Delete: { Objects: Objects }
      };

      return this.aws.request('S3', 'deleteObjects', params);
    }
  }

  // Hook handlers

  _removeDeployedResources() {
    this.bucketName = this.serverless.service.custom.client.bucketName;
    var safetyDelay = 3000;
    this.serverless.cli.log(
      `Preparing to empty and remove bucket ${this.bucketName}, waiting for ${safetyDelay /
        1000} seconds...`
    );

    function deleteBucket() {
      this.serverless.cli.log(`Removing bucket ${this.bucketName}...`);
      let params = {
        Bucket: this.bucketName
      };
      return this.aws.request('S3', 'deleteBucket', params);
    }

    return BbPromise.delay(safetyDelay)
      .bind(this)
      .then(this.listBuckets)
      .then(this.findBucket)
      .then(this.listObjectsInBucket)
      .then(this.deleteObjectsFromBucket)
      .then(deleteBucket);
  }

  _validateAndPrepare() {
    const Utils = this.serverless.utils;
    const Error = this.serverless.classes.Error;

    const distributionFolder = _.get(
      this.serverless,
      'service.custom.client.distributionFolder',
      path.join('client', 'dist')
    );
    const clientPath = path.join(this.serverless.config.servicePath, distributionFolder);

    if (!Utils.dirExistsSync(clientPath)) {
      return BbPromise.reject(
        new Error('Could not find ' + clientPath + ' folder in your project root.')
      );
    }

    if (
      !this.serverless.service.custom ||
      !this.serverless.service.custom.client ||
      !this.serverless.service.custom.client.bucketName
    ) {
      return BbPromise.reject(
        new Error('Please specify a bucket name for the client in serverless.yml.')
      );
    }

    this.bucketName = this.serverless.service.custom.client.bucketName;
    this.clientPath = clientPath;

    return BbPromise.resolve();
  }

  _processDeployment() {
    this.serverless.cli.log(
      'Deploying client to stage "' + this.stage + '" in region "' + this.region + '"...'
    );

    function createBucket() {
      if (this.bucketExists) return BbPromise.resolve();
      this.serverless.cli.log(`Creating bucket ${this.bucketName}...`);

      let params = {
        Bucket: this.bucketName
      };

      return this.aws.request('S3', 'createBucket', params);
    }

    function configureBucket() {
      const Error = this.serverless.classes.Error;

      this.serverless.cli.log(`Configuring website bucket ${this.bucketName}...`);

      const indexDoc = this.serverless.service.custom.client.indexDocument || 'index.html';
      const errorDoc = this.serverless.service.custom.client.errorDocument || 'error.html';

      let params = {
        Bucket: this.bucketName,
        WebsiteConfiguration: {}
      };

      const redirectAllRequestsTo = this.serverless.service.custom.client.redirectAllRequestsTo;
      if (redirectAllRequestsTo) {
        // if redirectAllRequestsTo specified, no other options can be specified
        // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-websiteconfiguration.html
        const clientConfigOptions = Object.keys(this.serverless.service.custom.client);
        confirmThat(
          !is.inArray('indexDocument', clientConfigOptions),
          'indexDocument cannot be specified with redirectAllRequestsTo'
        );
        confirmThat(
          !is.inArray('errorDocument', clientConfigOptions),
          'errorDocument cannot be specified with redirectAllRequestsTo'
        );
        confirmThat(
          !is.inArray('routingRules', clientConfigOptions),
          'routingRules cannot be specified with redirectAllRequestsTo'
        );

        params.WebsiteConfiguration.RedirectAllRequestsTo = {};

        let hostName = redirectAllRequestsTo.hostName;
        confirmThat(
          is.existy(hostName),
          'hostName is required if redirectAllRequestsTo is specified'
        );
        confirmThat(is.string(hostName), 'hostName must be a string');
        params.WebsiteConfiguration.RedirectAllRequestsTo.HostName = redirectAllRequestsTo.hostName;

        if (redirectAllRequestsTo.protocol) {
          confirmThat(is.string(redirectAllRequestsTo.protocol), 'hostName must be a string');
          confirmThat(
            is.inArray(redirectAllRequestsTo.protocol.toLowerCase(), ['http', 'https']),
            'redirectAllRequestsTo must be either http or https'
          );
          params.WebsiteConfiguration.RedirectAllRequestsTo.Protocol =
            redirectAllRequestsTo.protocol;
        }
      } else {
        params.WebsiteConfiguration.IndexDocument = { Suffix: indexDoc };
        params.WebsiteConfiguration.ErrorDocument = { Key: errorDoc };
      }

      const routingRules = this.serverless.service.custom.client.routingRules;
      if (routingRules) {
        params.WebsiteConfiguration.RoutingRules = [];

        confirmThat(is.array(routingRules), 'routingRules must be a list');

        routingRules.forEach(r => {
          const routingRule = {
            Redirect: {}
          };
          confirmThat(
            is.existy(r.redirect),
            'redirect must be specified for each member of routingRules'
          );

          confirmThat(
            !(is.existy(r.redirect.replaceKeyPrefixWith) && is.existy(r.redirect.replaceKeyWith)),
            'replaceKeyPrefixWith and replaceKeyWith cannot both be specified'
          );

          const props = [
            'hostName',
            'httpRedirectCode',
            'protocol',
            'replaceKeyPrefixWith',
            'replaceKeyWith'
          ];
          props.forEach(p => {
            if (r.redirect[p]) {
              if (p === 'httpRedirectCode') {
                confirmThat(is.integer(r.redirect[p]), 'httpRedirectCode must be an integer');
                r.redirect[p] = r.redirect[p].toString();
              } else {
                confirmThat(is.string(r.redirect[p]), `${p} must be a string`);
              }
              routingRule.Redirect[p.charAt(0).toUpperCase() + p.slice(1)] = r.redirect[p];
            }
          });

          if (r.condition) {
            routingRule.Condition = {};

            confirmThat(
              is.existy(r.condition.httpErrorCodeReturnedEquals) ||
                is.existy(r.condition.keyPrefixEquals),
              'httpErrorCodeReturnedEquals or keyPrefixEquals must be defined for each condition'
            );

            const props = ['httpErrorCodeReturnedEquals', 'keyPrefixEquals'];
            props.forEach(p => {
              if (r.condition[p]) {
                if (p === 'httpErrorCodeReturnedEquals') {
                  confirmThat(
                    is.integer(r.condition[p]),
                    'httpErrorCodeReturnedEquals must be an integer'
                  );
                  r.condition[p] = r.condition[p].toString();
                } else {
                  confirmThat(is.string(r.condition[p]), `${p} must be a string`);
                }
                routingRule.Condition[p.charAt(0).toUpperCase() + p.slice(1)] = r.condition[p];
              }
            });
          }

          params.WebsiteConfiguration.RoutingRules.push(routingRule);
        });
      }

      function confirmThat(expr, error) {
        if (!expr) {
          BbPromise.reject(new Error(error));
        }
      }

      return this.aws.request('S3', 'putBucketWebsite', params);
    }

    function configurePolicyForBucket() {
      this.serverless.cli.log(`Configuring policy for bucket ${this.bucketName}...`);

      let policy = {
        Version: '2008-10-17',
        Id: 'Policy1392681112290',
        Statement: [
          {
            Sid: 'Stmt1392681101677',
            Effect: 'Allow',
            Principal: {
              AWS: '*'
            },
            Action: 's3:GetObject',
            Resource: 'arn:aws:s3:::' + this.bucketName + '/*'
          }
        ]
      };

      let params = {
        Bucket: this.bucketName,
        Policy: JSON.stringify(policy)
      };

      return this.aws.request('S3', 'putBucketPolicy', params);
    }

    function configureCorsForBucket() {
      this.serverless.cli.log(`Configuring CORS policy for bucket ${this.bucketName}...`);

      let putPostDeleteRule = {
        AllowedMethods: ['PUT', 'POST', 'DELETE'],
        AllowedOrigins: ['https://*.amazonaws.com'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 0
      };

      let getRule = {
        AllowedMethods: ['GET'],
        AllowedOrigins: ['*'],
        AllowedHeaders: ['*'],
        MaxAgeSeconds: 0
      };

      let params = {
        Bucket: this.bucketName,
        CORSConfiguration: {
          CORSRules: [putPostDeleteRule, getRule]
        }
      };

      return this.aws.request('S3', 'putBucketCors', params);
    }

    return this.listBuckets()
      .then(this.findBucket)
      .then(this.listObjectsInBucket)
      .then(this.deleteObjectsFromBucket)
      .then(createBucket)
      .then(configureBucket)
      .then(configurePolicyForBucket)
      .then(configureCorsForBucket)
      .then(function() {
        return this._uploadDirectory(this.clientPath);
      });
  }

  _uploadDirectory(directoryPath) {
    let _this = this,
      readDirectory = _.partial(fs.readdir, directoryPath);

    async.waterfall([
      readDirectory,
      function(files) {
        files = _.map(files, function(file) {
          return path.join(directoryPath, file);
        });

        async.each(files, function(path) {
          fs.stat(
            path,
            _.bind(function(err, stats) {
              return stats.isDirectory() ? _this._uploadDirectory(path) : _this._uploadFile(path);
            }, _this)
          );
        });
      }
    ]);
  }

  _uploadFile(filePath) {
    let _this = this,
      urlRoot = regionToUrlRootMap(_this.region);

    let fileKey = path.normalize(filePath).replace(_this.clientPath, '');
    if (fileKey.substr(0, 1) === path.sep) {
      fileKey = fileKey.replace(path.sep, '');
    }

    let distRoot = path.join(
      _this.serverless.config.servicePath,
      _this.serverless.service.custom.client.distributionFolder || path.join('client', 'dist')
    );
    distRoot += path.sep;

    let baseHeaderKeys = [
      'Cache-Control',
      'Content-Disposition',
      'Content-Encoding',
      'Content-Language',
      'Content-Type',
      'Expires',
      'Website-Redirect-Location'
    ];

    let ruleList = [];
    let headers = _this.serverless.service.custom.client.objectHeaders;
    if (headers) {
      if (headers.ALL_OBJECTS) {
        ruleList = ruleList.concat(headers.ALL_OBJECTS);
      }
      Object.keys(headers)
        .filter(m => m.substr(-1, 1) === '/') // folders
        .sort((a, b) => a.length > b.length) // sort by length ascending
        .forEach(m => {
          if (filePath.replace(distRoot, '').substr(0, m.length) === m) {
            ruleList = ruleList.concat(headers[m]);
          }
        });
      if (headers[fileKey]) {
        ruleList = ruleList.concat(headers[fileKey]);
      }
    }

    this.serverless.cli.log(`Uploading file ${fileKey} to bucket ${_this.bucketName}...`);
    this.serverless.cli.log('If successful this should be deployed at:');
    this.serverless.cli.log(`http://${_this.bucketName}.${urlRoot}/${fileKey}`);

    fs.readFile(filePath, function(err, fileBuffer) {
      let params = {
        Bucket: _this.bucketName,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: mime.lookup(filePath)
      };

      ruleList.forEach(r => {
        if (baseHeaderKeys.includes(r.headerName)) {
          params[r.headerName.replace('-', '')] = r.headerValue;
        } else {
          if (!params.Metadata) {
            params.Metadata = {};
          }
          params.Metadata[r.headerName] = r.headerValue;
        }
      });

      return _this.aws.request('S3', 'putObject', params);
    });
  }
}

module.exports = Client;
