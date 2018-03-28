const fs = require('fs');
const _ = require('lodash');

const regionUrls = require('./resources/awsRegionUrls');

function uploadDirectory(client) {
  let readDirectory = _.partial(fs.readdir, client.clientPath);

  async.waterfall([
    readDirectory,
    files => {
      files = _.map(files, file => {
        return path.join(client.clientPath, file);
      });

      async.each(files, path => {
        fs.stat(path, (err, stats) => {
          return stats.isDirectory() ? uploadDirectory(path, client) : uploadFile(path, client);
        });
      });
    }
  ]);
}

function uploadFile(filePath, client) {
  const fileKey = filePath
    .replace(client.clientPath, '')
    .substr(1)
    .replace(/\\/g, '/');

  const urlRoot = regionUrls[client.region];

  client.serverless.cli.log(`Uploading file ${fileKey} to bucket ${client.bucketName}...`);
  client.serverless.cli.log('If successful this should be deployed at:');
  client.serverless.cli.log(`http://${client.bucketName}.${urlRoot}/${fileKey}`);

  fs.readFile(filePath, (err, fileBuffer) => {
    let params = {
      Bucket: client.bucketName,
      Key: fileKey,
      Body: fileBuffer,
      ContentType: mime.lookup(filePath)
    };

    return client.aws.request('S3', 'putObject', params);
  });
}

module.exports = uploadDirectory;
