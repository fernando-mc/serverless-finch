const fs = require('fs');
const path = require('path');

const _ = require('lodash');
const async = require('async');
const BbPromise = require('bluebird');
const mime = require('mime');

const getFileList = require('./utilities/getFileList');
const regionUrls = require('./resources/awsRegionUrls');

const minimatch = require('minimatch');

/**
 * Uploads client files to an S3 bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be configured
 * @param {string} clientRoot - Full path to the root directory of client files
 * @param {Object[]} headerSpec - Array of header values to add to files
 */
function uploadDirectory(aws, bucketName, clientRoot, headerSpec) {
  const allFiles = getFileList(clientRoot);

  const uploadList = buildUploadList(allFiles, clientRoot, headerSpec);

  return BbPromise.all(
    uploadList.map(u => {
      return uploadFile(aws, bucketName, u.filePath, u.fileKey, u.headers);
    })
  );
}

/**
 * Uploads a file to an S3 bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be configured
 * @param {string} filePath - Full path to file to be uploaded
 * @param {string} clientRoot - Full path to the root directory of client files
 */
function uploadFile(aws, bucketName, filePath, fileKey, headers) {
  let baseHeaderKeys = [
    'Cache-Control',
    'Content-Disposition',
    'Content-Encoding',
    'Content-Language',
    'Content-Type',
    'Expires',
    'Website-Redirect-Location'
  ];

  const fileBuffer = fs.readFileSync(filePath);

  let params = {
    Bucket: bucketName,
    Key: fileKey,
    Body: fileBuffer,
    ContentType: mime.lookup(filePath)
  };

  Object.keys(headers).forEach(h => {
    if (baseHeaderKeys.includes(h)) {
      params[h.replace('-', '')] = headers[h];
    } else {
      if (!params.Metadata) {
        params.Metadata = {};
      }
      params.Metadata[h] = headers[h];
    }
  });

  return aws.request('S3', 'putObject', params);
}

function buildUploadList(files, clientRoot, headerSpec) {
  clientRoot = path.normalize(clientRoot);
  if (!clientRoot.endsWith(path.sep)) {
    clientRoot += path.sep;
  }

  const uploadList = files.map(f => {
    const filePath = path.normalize(f);
    const fileRelPath = filePath.replace(clientRoot, '');
    const fileKey = path
      .normalize(fileRelPath)
      .split(path.sep)
      .join('/');

    let upload = {
      filePath: filePath,
      fileKey: fileKey,
      headers: {}
    };

    if (!headerSpec) {
      return upload;
    }

    // add bucket-wide headers
    if (headerSpec.ALL_OBJECTS) {
      headerSpec.ALL_OBJECTS.forEach(h => {
        upload.headers[h.name] = h.value;
      });
    }

    // add headers by glob pattern
    Object.keys(headerSpec)
      .filter(s => !!s.match(/[\*\?\[\]]/)) // Potential glob pattern
      .filter(s => minimatch(fileRelPath, s, { matchBase: true }))
      .sort((a, b) => a.length - b.length) // sort by length ascending
      .forEach(s => {
        headerSpec[s].forEach(h => {
          upload.headers[h.name] = h.value;
        });
      });

    // add folder-level headers
    Object.keys(headerSpec)
      .filter(s => s.endsWith(path.sep)) // folders
      .sort((a, b) => a.length > b.length) // sort by length ascending
      .forEach(s => {
        if (fileRelPath.startsWith(path.normalize(s))) {
          headerSpec[s].forEach(h => {
            upload.headers[h.name] = h.value;
          });
        }
      });

    // add file-specific headers
    Object.keys(headerSpec)
      .filter(s => {
        return path.normalize(s) === fileRelPath;
      })
      .forEach(s => {
        headerSpec[s].forEach(h => {
          upload.headers[h.name] = h.value;
        });
      });

    return upload;
  });

  return uploadList;
}

module.exports = uploadDirectory;
