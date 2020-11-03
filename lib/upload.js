'use strict';

const fs = require('fs');
const path = require('path');

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
 * @param {string[]} orderSpec - Array of regex's to order upload by
 * @param {string} keyPrefix - A prefix for all files uploaded
 * @param {string} sse - ServerSideEncryption, AES256 | aws:kms | null
 */
function uploadDirectory(aws, bucketName, clientRoot, headerSpec, orderSpec, keyPrefix, sse) {
  const allFiles = getFileList(clientRoot);

  const filesGroupedByOrder = groupFilesByOrder(allFiles, orderSpec);

  return filesGroupedByOrder.reduce((existingUploads, files) => {
    return existingUploads.then(existingResults => {
      const uploadList = buildUploadList(files, clientRoot, headerSpec, keyPrefix);

      return Promise.all(
        uploadList.map(u => uploadFile(aws, bucketName, u.filePath, u.fileKey, u.headers, sse))
      ).then(currentResults => existingResults.concat(currentResults));
    });
  }, Promise.resolve([]));
}

/**
 * Uploads a file to an S3 bucket
 * @param {Object} aws - AWS class
 * @param {string} bucketName - Name of bucket to be configured
 * @param {string} filePath - Full path to file to be uploaded
 * @param {string} fileKey -
 * @param {string} headers -
 * @param {string} sse - ServerSideEncryption, AES256 | aws:kms | null
 */
function uploadFile(aws, bucketName, filePath, fileKey, headers, sse) {
  const baseHeaderKeys = [
    'Cache-Control',
    'Content-Disposition',
    'Content-Encoding',
    'Content-Language',
    'Content-Type',
    'Expires',
    'Website-Redirect-Location'
  ];

  const fileBuffer = fs.readFileSync(filePath);

  const params = {
    Bucket: bucketName,
    Key: fileKey,
    Body: fileBuffer,
    ...getMimeTypeAndContentEncoding(filePath)
  };

  if (sse) {
    params.ServerSideEncryption = sse;
  }

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

function buildUploadList(files, clientRoot, headerSpec, keyPrefix) {
  clientRoot = path.normalize(clientRoot);
  if (!clientRoot.endsWith(path.sep)) {
    clientRoot += path.sep;
  }
  if (keyPrefix) {
    var prefix = keyPrefix.split(path.sep);
  } else {
    var prefix = [];
  }
  const uploadList = files.map(f => {
    const filePath = path.normalize(f);
    const fileRelPath = filePath.replace(clientRoot, '');
    const fileKey = path.normalize(fileRelPath).split(path.sep);
    if (prefix.length) {
      fileKey.unshift(...prefix);
    }
    const upload = {
      filePath: filePath,
      fileKey: fileKey.join('/'),
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

function groupFilesByOrder(files, orderSpec) {
  if (!orderSpec) {
    return [files];
  }

  const orderedFiles = files.map(f => ({ file: f, order: 0 }));

  orderSpec.forEach((orderRegex, i) => {
    const re = new RegExp(orderRegex, 'i');
    orderedFiles.forEach(f => {
      if (re.test(f.file)) {
        f.order = i + 1;
      }
    });
  });

  const unmatchedFiles = orderedFiles.filter(f => f.order === 0).map(f => f.file);
  const matchedFiles = orderSpec.map((orderRegex, i) =>
    orderedFiles.filter(f => f.order === i + 1).map(f => f.file)
  );
  return [unmatchedFiles].concat(matchedFiles);
}

const ContentEncodingMap = {
  gz: 'gzip',
  br: 'br'
};

function getMimeTypeAndContentEncoding(filePath) {
  const match = /(.+\..+)\.(gz|br)$/.exec(filePath);

  if (match) {
    const [fullMatch, strippedFilePath, encodingFileEnding] = match;

    return {
      ContentType: mime.lookup(strippedFilePath),
      ContentEncoding: ContentEncodingMap[encodingFileEnding]
    };
  }

  return { ContentType: mime.lookup(filePath) };
}

module.exports = uploadDirectory;
