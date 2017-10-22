# serverless-finch

[![npm](https://img.shields.io/npm/dm/serverless-finch.svg)](https://www.npmjs.com/package/serverless-finch)
[![npm](https://img.shields.io/npm/v/serverless-finch.svg)](https://www.npmjs.com/package/serverless-finch)
[![license](https://img.shields.io/github/license/fernando-mc/serverless-finch.svg)](https://github.com/fernando-mc/serverless-finch/blob/master/LICENSE)

A Serverless Framework plugin for deployment of static website assests of your Serverless project to AWS S3.

Forked from the **serverless-client-s3**
https://github.com/serverless/serverless-client-s3/

**First**, install:

```
npm install --save serverless-finch
```

**Second**, update `serverless.yml` by adding the following:

```yaml
plugins:
  - serverless-finch

custom:
  client:
    bucketName: unique-s3-bucketname-for-your-website-files
```

* **Warning:** The plugin will overwrite any data you have in the bucket name you set above if it already exists.


**Third**, Create a `client/dist` folder in the root directory of your Serverless project. This is where your distribution-ready website should live. 

The plugin simply uploads the entire `client/dist` folder to S3 and configures the bucket to host the website and make it publicly available.

To test the plugin initially you can copy/run the following commands in the root directory of your Serverless project to get a quick sample website for deployment:

```
mkdir -p client/dist
touch client/dist/index.html
touch client/dist/error.html
echo "Go Serverless" >> client/dist/index.html
echo "error page" >> client/dist/error.html
```

**Fourth**, run the plugin, and visit your new website!

```
serverless client deploy [--stage $STAGE] [--region $REGION]
```

The plugin should output the location of your newly deployed static site to the console.

If later on you want to take down the website you can use:

```
serverless client remove
```

## Release Notes

### v1.2.1 
- Added the `remove` option to tear down what you deploy. ([Pull 10](https://github.com/fernando-mc/serverless-finch/pull/10) thanks to [redroot](https://github.com/redroot)
)

## Contributors
- [redroot](https://github.com/redroot)
    