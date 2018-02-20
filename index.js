'use strict';

const path     = require('path');
const BbPromise    = require('bluebird');
const async        = require('async');
const _            = require('lodash');
const mime         = require('mime');
const fs           = require('fs');

// per http://docs.aws.amazon.com/general/latest/gr/rande.html#s3_website_region_endpoints
const regionToUrlRootMap = region => ({
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
  'sa-east-1': 's3-website-sa-east-1.amazonaws.com',
}[region])

class Client {
  constructor(serverless, options){
    this.serverless = serverless;
    this.provider = 'aws';
    this.aws = this.serverless.getProvider(this.provider);

    this.commands = {
      client: {
        usage: 'Generate and deploy clients',
        lifecycleEvents:[
          'client',
          'deploy'
        ],
        commands: {
          deploy: {
            usage: 'Deploy serverless client code',
            lifecycleEvents:[
              'deploy'
            ]
          },
          remove: {
            usage: 'Removes deployed files and bucket',
            lifecycleEvents: [
              'remove'
            ]
          }
        }
      }
    };


    this.hooks = {
      'client:client': () => {
        this.serverless.cli.log(this.commands.client.usage);
      },

      'client:deploy:deploy': () => {
        this.stage = options.stage || _.get(serverless, 'service.provider.stage')
        this.region = options.region || _.get(serverless, 'service.provider.region');
        this._validateAndPrepare()
          .then(this._processDeployment.bind(this));
      },
      'client:remove:remove': () => {
        this._removeDeployedResources();
      }
    };
  }

  // Shared functions

  listBuckets() {
    return this.aws.request('S3', 'listBuckets', {}, this.stage, this.region).bind(this);
  }

  findBucket(data) {
    data.Buckets.forEach(function(bucket) {
      if (bucket.Name === this.bucketName) {
        this.bucketExists = true;
        this.serverless.cli.log(`Bucket ${this.bucketName} exists`);
      }
    }.bind(this));
  }

  listObjectsInBucket() {
    if (!this.bucketExists) return BbPromise.resolve();

    this.serverless.cli.log(`Listing objects in bucket ${this.bucketName}...`);

    let params = {
      Bucket: this.bucketName
    };

    return this.aws.request('S3', 'listObjectsV2', params, this.stage, this.region);
  }

  deleteObjectsFromBucket(data) {
    if (!this.bucketExists) return BbPromise.resolve();

    this.serverless.cli.log(`Deleting all objects from bucket ${this.bucketName}...`);

    if (!data.Contents[0]) {
      return BbPromise.resolve();
    } else {
      let Objects = _.map(data.Contents, function (content) {
        return _.pick(content, 'Key');
      });

      let params = {
        Bucket: this.bucketName,
        Delete: { Objects: Objects }
      };

      return this.aws.request('S3', 'deleteObjects', params, this.stage, this.region);
    }
  }

  // Hook handlers

  _removeDeployedResources() {
    this.bucketName = this.serverless.service.custom.client.bucketName;
    var safetyDelay = 3000;
    this.serverless.cli.log(`Preparing to empty and remove bucket ${this.bucketName}, waiting for ${safetyDelay/1000} seconds...`);

    function deleteBucket() {
      this.serverless.cli.log(`Removing bucket ${this.bucketName}...`);
      let params = {
        Bucket: this.bucketName
      };
      return this.aws.request('S3', 'deleteBucket', params, this.stage, this.region);
    }

    return BbPromise.delay(safetyDelay).bind(this)
      .then(this.listBuckets)
      .then(this.findBucket)
      .then(this.listObjectsInBucket)
      .then(this.deleteObjectsFromBucket)
      .then(deleteBucket)
  }

  _validateAndPrepare() {
    const Utils = this.serverless.utils;
    const Error = this.serverless.classes.Error;

    const distributionFolder = _.get(this.serverless, 'service.custom.client.distributionFolder', path.join('client', 'dist'));
    const clientPath = path.join(this.serverless.config.servicePath, distributionFolder);
    
    if (!Utils.dirExistsSync(clientPath)) {
      return BbPromise.reject(new Error('Could not find ' + clientPath + ' folder in your project root.'));
    }

    if (!this.serverless.service.custom ||
        !this.serverless.service.custom.client ||
        !this.serverless.service.custom.client.bucketName) {
      return BbPromise.reject(new Error('Please specify a bucket name for the client in serverless.yml.'));
    }

    this.bucketName = this.serverless.service.custom.client.bucketName;
    this.clientPath = clientPath;

    return BbPromise.resolve();
  }


  _processDeployment() {
    this.serverless.cli.log('Deploying client to stage "' + this.stage + '" in region "' + this.region + '"...');

    function createBucket() {
      if (this.bucketExists) return BbPromise.resolve();
      this.serverless.cli.log(`Creating bucket ${this.bucketName}...`);

      let params = {
        Bucket: this.bucketName
      };

      return this.aws.request('S3', 'createBucket', params, this.stage, this.region)
    }

    function configureBucket() {
      const Error = this.serverless.classes.Error;
      
      this.serverless.cli.log(`Configuring website bucket ${this.bucketName}...`);

      const indexDoc = this.serverless.service.custom.client.indexDocument || 'index.html'
      const errorDoc = this.serverless.service.custom.client.errorDocument || 'error.html'

      let params = {
        Bucket: this.bucketName,
        WebsiteConfiguration: {}
      };

      const redirectAllRequestsTo = this.serverless.service.custom.client.redirectAllRequestsTo;
      if (redirectAllRequestsTo) {
        
        // if redirectAllRequestsTo specified, no other options can be specified
        // https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-websiteconfiguration.html
        const clientConfigOptions = Object.keys(this.serverless.service.custom.client);
        confirm(
          clientConfigOptions.indexOf('indexDocument') === -1, 
          'indexDocument cannot be specified with redirectAllRequestsTo'
        );
        confirm(
          clientConfigOptions.indexOf('errorDocument') === -1, 
          'errorDocument cannot be specified with redirectAllRequestsTo'
        );
        confirm(
          clientConfigOptions.indexOf('routingRules') === -1, 
          'routingRules cannot be specified with redirectAllRequestsTo'
        );

        params.WebsiteConfiguration.RedirectAllRequestsTo = {};
        
        let hostName = redirectAllRequestsTo.hostName;
        confirmExists(hostName, 'hostName is required if redirectAllRequestsTo is specified');
        confirmString(hostName, 'hostName must be a string');
        params.WebsiteConfiguration.RedirectAllRequestsTo.HostName = redirectAllRequestsTo.hostName;

        if (redirectAllRequestsTo.protocol) {
          confirmString(redirectAllRequestsTo.protocol, 'hostName must be a string');
          confirmInArray(
            redirectAllRequestsTo.protocol.toLowerCase(), 
            ['http', 'https'],
            "redirectAllRequestsTo must be either http or https"
          );
          params.WebsiteConfiguration.RedirectAllRequestsTo.Protocol = redirectAllRequestsTo.protocol;
        }
      } else {
        params.WebsiteConfiguration.IndexDocument = { Suffix: indexDoc };
        params.WebsiteConfiguration.ErrorDocument = { Key: errorDoc };
      }

      const routingRules = this.serverless.service.custom.client.routingRules;
      if (routingRules) {
        params.WebsiteConfiguration.RoutingRules = [];
        
        confirmArray(routingRules, 'routingRules must be a list');
        
        routingRules.forEach(r => {
          const routingRule = {
            Redirect: {}
          };
          confirmExists(r.redirect, 'redirect must be specified for each member of routingRules');

          confirm(
            !(r.redirect.replaceKeyPrefixWith && r.redirect.replaceKeyWith),
            "replaceKeyPrefixWith and replaceKeyWith cannot both be specified"
          );

          const props = ["hostName", "httpRedirectCode", "protocol", "replaceKeyPrefixWith", "replaceKeyWith"];
          props.forEach(p => {
            if (r.redirect[p]) {
              if (p === "httpRedirectCode") {
                confirmInteger(r.redirect[p], "httpRedirectCode must be an integer");
                r.redirect[p] = r.redirect[p].toString();
              } else {
                confirmString(r.redirect[p], `${p} must be a string`);
              }
              routingRule.Redirect[p.charAt(0).toUpperCase() + p.slice(1)] = r.redirect[p];
            }
          });

          if (r.condition) {
            routingRule.Condition = {};

            confirm(
              r.condition.httpErrorCodeReturnedEquals || r.condition.keyPrefixEquals,
              "httpErrorCodeReturnedEquals or keyPrefixEquals must be defined for each condition"
            );

            const props = ["httpErrorCodeReturnedEquals", "keyPrefixEquals"];
            props.forEach(p => {
              if (r.condition[p]) {
                if (p === "httpErrorCodeReturnedEquals") {
                  confirmInteger(r.condition[p], "httpErrorCodeReturnedEquals must be an integer");
                  r.condition[p] = r.condition[p].toString();
                } else {
                  confirmString(r.condition[p], `${p} must be a string`);
                }
                routingRule.Condition[p.charAt(0).toUpperCase() + p.slice(1)] = r.condition[p];
              }
            });
          }

          params.WebsiteConfiguration.RoutingRules.push(routingRule);
        });
        
      }

      function confirm(expr, error) {
        if (!expr) { BbPromise.reject(new Error(error)); }
      }
      function confirmString(value, error) { confirm(_.isString(value), error); }
      function confirmInteger(value, error) { confirm(_.isInteger(value), value); }
      function confirmArray(value, error) { confirm(_.isArray(value), error); }
      function confirmExists(value, error) { confirm(value, error); }
      function confirmInArray(value, array, error) { confirm(_.includes(array, value), error); }

      return this.aws.request('S3', 'putBucketWebsite', params, this.stage, this.region);
    }

    function configurePolicyForBucket(){
      this.serverless.cli.log(`Configuring policy for bucket ${this.bucketName}...`);

      let policy = {
        Version: "2008-10-17",
        Id: "Policy1392681112290",
        Statement: [
          {
            Sid: "Stmt1392681101677",
            Effect: "Allow",
            Principal: {
              AWS: "*"
            },
            Action: "s3:GetObject",
            Resource: "arn:aws:s3:::" + this.bucketName + '/*'
          }
        ]
      };

      let params = {
        Bucket: this.bucketName,
        Policy: JSON.stringify(policy)
      };

      return this.aws.request('S3', 'putBucketPolicy', params, this.stage, this.region);
    }

    function configureCorsForBucket(){
      this.serverless.cli.log(`Configuring CORS policy for bucket ${this.bucketName}...`);

      let putPostDeleteRule = {
        AllowedMethods: [
          'PUT',
          'POST',
          'DELETE'
        ],
        AllowedOrigins: [
          'https://*.amazonaws.com'
        ],
        AllowedHeaders: [
          '*'
        ],
        MaxAgeSeconds: 0
      };

      let getRule = {
        AllowedMethods: [
          'GET'
        ],
        AllowedOrigins: [
          '*'
        ],
        AllowedHeaders: [
          '*'
        ],
        MaxAgeSeconds: 0
      };

      let params = {
        Bucket: this.bucketName,
        CORSConfiguration: {
          CORSRules: [
            putPostDeleteRule,
            getRule
          ]
        },
      };

      return this.aws.request('S3', 'putBucketCors', params, this.stage, this.region);
    }

    return this.listBuckets()
      .then(this.findBucket)
      .then(this.listObjectsInBucket)
      .then(this.deleteObjectsFromBucket)
      .then(createBucket)
      .then(configureBucket)
      .then(configurePolicyForBucket)
      .then(configureCorsForBucket)
      .then(function(){
        return this._uploadDirectory(this.clientPath)
      });
  }

  _uploadDirectory(directoryPath) {
    let _this         = this,
    readDirectory = _.partial(fs.readdir, directoryPath);

    async.waterfall([readDirectory, function (files) {
      files = _.map(files, function(file) {
        return path.join(directoryPath, file);
      });

      async.each(files, function(path) {
        fs.stat(path, _.bind(function (err, stats) {

          return stats.isDirectory()
            ? _this._uploadDirectory(path)
            : _this._uploadFile(path);
        }, _this));
      });
    }]);
  }

  _uploadFile(filePath) {
    let _this      = this,
        fileKey    = filePath.replace(_this.clientPath, '').substr(1).replace(/\\/g, '/'),
        urlRoot    = regionToUrlRootMap(_this.region);

    this.serverless.cli.log(`Uploading file ${fileKey} to bucket ${_this.bucketName}...`);
    this.serverless.cli.log('If successful this should be deployed at:')
    this.serverless.cli.log(`http://${_this.bucketName}.${urlRoot}/${fileKey}`)

    fs.readFile(filePath, function(err, fileBuffer) {

      let params = {
        Bucket: _this.bucketName,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: mime.lookup(filePath)
      };

      // TODO: remove browser caching
      return _this.aws.request('S3', 'putObject', params, _this.stage, _this.region);
    });

  }

}

module.exports = Client;
