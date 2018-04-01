const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const async = require('async');
const mime = require('mime');

const regionUrls = require('./resources/awsRegionUrls');

/**
 * Uploads a directory to an S3 bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be configured
 * @param {string} directory - Full path to directory to be uploaded
 * @param {string} clientRoot - Full path to the root directory of client files
 */
function uploadDirectory(aws, bucketName, directory, clientRoot) {
  let readDirectory = _.partial(fs.readdir, directory);

  async.waterfall([
    readDirectory,
    files => {
      files = _.map(files, file => {
        return path.join(directory, file);
      });

      async.each(files, path => {
        fs.stat(path, (err, stats) => {
          if (stats.isDirectory()) {
            return uploadDirectory(aws, bucketName, path, clientRoot);
          } else {
            return uploadFile(aws, bucketName, path, clientRoot);
          }
        });
      });
    }
  ]);
}

/**
 * Uploads a file to an S3 bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be configured
 * @param {string} filePath - Full path to file to be uploaded
 * @param {string} clientRoot - Full path to the root directory of client files
 */
function uploadFile(aws, bucketName, filePath, clientRoot) {
  const fileKey = filePath
    .replace(clientRoot, '')
    .substr(1)
    .replace(/\\/g, '/');

  const fileBuffer = fs.readFileSync(filePath);
  const params = {
    Bucket: bucketName,
    Key: fileKey,
    Body: fileBuffer,
    ContentType: mime.lookup(filePath)
  };

  return aws.request('S3', 'putObject', params);
}

module.exports = uploadDirectory;
