'use strict';

const path     = require('path');
const BbPromise    = require('bluebird');
const async        = require('async');
const _            = require('lodash');
const mime         = require('mime');
const fs           = require('fs');

class Client {
  constructor(serverless, options){
    this.serverless = serverless;
    this.options=options;
    this.stage = options.stage || _.get(serverless, 'service.provider.stage')
    this.region = options.region || _.get(serverless, 'service.provider.region');
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
            ],
            options: {
              file: {
                usage: 'Specify the file(s) to deploy, whitespace separated',
                shortcut: 'f',
                default: undefined
              }
            }
          }
        }
      }
    };



    this.hooks = {
      'client:client': () => {
        this.serverless.cli.log(this.commands.client.usage);
      },

      'client:deploy:deploy': () => {
        this._validateAndPrepare()
          .then(this._processDeployment.bind(this));
      }
    };
  }

  _validateAndPrepare() {
    const Utils = this.serverless.utils;
    const Error = this.serverless.classes.Error;

    const _dist = _.get(this.serverless, 'service.custom.client.distributionFolder', 'dist');

    if (!Utils.dirExistsSync(path.join(this.serverless.config.servicePath, 'client', _dist))) {
      return BbPromise.reject(new Error('Could not find "client/' + _dist + ' folder in your project root.'));
    }

    if (!this.serverless.service.custom ||
        !this.serverless.service.custom.client ||
        !this.serverless.service.custom.client.bucketName) {
      return BbPromise.reject(new Error('Please specify a bucket name for the client in serverless.yml.'));
    }

    this.bucketName = this.serverless.service.custom.client.bucketName;
    this.clientPath = path.join(this.serverless.config.servicePath, 'client', _dist);

    return BbPromise.resolve();
  }


  _processDeployment() {
    this.serverless.cli.log('Deploying client to stage "' + this.stage + '" in region "' + this.region + '"...');


    function listBuckets(data) {
      data.Buckets.forEach(function(bucket) {
        if (bucket.Name === this.bucketName) {
          this.bucketExists = true;
          this.serverless.cli.log(`Bucket ${this.bucketName} already exists`);
        }
      }.bind(this));
    }

    function listObjectsInBucket() {
      if (!this.bucketExists) return BbPromise.resolve();

      this.serverless.cli.log(`Listing objects in bucket ${this.bucketName}...`);

      let params = {
        Bucket: this.bucketName
      };

      return this.aws.request('S3', 'listObjectsV2', params, this.stage, this.region);
    }

    function deleteObjectsFromBucket(data) {
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

    function createBucket() {
      if (this.bucketExists) return BbPromise.resolve();
      this.serverless.cli.log(`Creating bucket ${this.bucketName}...`);

      let params = {
        Bucket: this.bucketName
      };

      return this.aws.request('S3', 'createBucket', params, this.stage, this.region)
    }

    function configureBucket() {
      this.serverless.cli.log(`Configuring website bucket ${this.bucketName}...`);

      let params = {
        Bucket: this.bucketName,
        WebsiteConfiguration: {
          IndexDocument: { Suffix: 'index.html' },
          ErrorDocument: { Key: 'error.html' }
        }
      };

      return this.aws.request('S3', 'putBucketWebsite', params, this.stage, this.region)
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
    if(this.options.file){
      var list = '' + this.options.file
      console.log(list)
      var arr=list.split(/\s+/).filter((str)=>{return str!==''})
      if(arr.length===0)
        return console.log("Nothing to upload!")
      return this.aws.request('S3', 'listBuckets', {}, this.stage, this.region)
      .bind(this)
      .then(listBuckets)
      .then(listObjectsInBucket)
      .then(createBucket)
      .then(configureBucket)
      .then(configurePolicyForBucket)
      .then(configureCorsForBucket)
      .then(function(){
        console.log(arr)
        return this._uploadFiles(arr,this.clientPath)
      });
    }else{
      return this.aws.request('S3', 'listBuckets', {}, this.stage, this.region)
      .bind(this)
      .then(listBuckets)
      .then(listObjectsInBucket)
      .then(deleteObjectsFromBucket)
      .then(createBucket)
      .then(configureBucket)
      .then(configurePolicyForBucket)
      .then(configureCorsForBucket)
      .then(function(){
          return this._uploadDirectory(this.clientPath)
      });
    }
  }

  _uploadFiles(fileNames, directoryPath) {
    let _this         = this,
    readDirectory = _.partial(fs.readdir, directoryPath);

    async.waterfall([readDirectory, function (files) {
      files = _.map(fileNames, function(file) {
        return path.join(directoryPath, file);
      });

      async.each(files, function(path) {
        fs.stat(path, _.bind(function (err, stats) {
          if(err){
            console.log(err)
            return
          }
          return stats.isDirectory()
            ? _this._uploadDirectory(path)
            : _this._uploadFile(path);
        }, _this));
      });
    }]);
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
        fileKey    = filePath.replace(_this.clientPath, '').substr(1).replace(/\\/g, '/');

    this.serverless.cli.log(`Uploading file ${fileKey} to bucket ${_this.bucketName}...`);
    this.serverless.cli.log(`If successful this should be deployed at: https://s3.amazonaws.com/${_this.bucketName}/${fileKey}`)

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
