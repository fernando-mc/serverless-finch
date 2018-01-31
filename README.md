# serverless-finch

[![npm](https://img.shields.io/npm/dm/serverless-finch.svg)](https://www.npmjs.com/package/serverless-finch)
[![npm](https://img.shields.io/npm/v/serverless-finch.svg)](https://www.npmjs.com/package/serverless-finch)
[![license](https://img.shields.io/github/license/fernando-mc/serverless-finch.svg)](https://github.com/fernando-mc/serverless-finch/blob/master/LICENSE)

A Serverless Framework plugin for deployment of static website assests of your Serverless project to AWS S3.

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
    distributionFolder: client/dist # (Optional) The location of your website. This defaults to client/dist
```

* **Warning:** The plugin will overwrite any data you have in the bucket name you set above if it already exists unless you specify `"keepFiles": "true"` in custom.client.


**Third**, Create a website folder in the root directory of your Serverless project. This is where your distribution-ready website should live. By default the plugin expects the files to live in a folder called `client/dist`. But this is configurable with the `distributionFolder` option (see the example yaml configuration above).

The plugin uploads the entire distributionFolder to S3 and configures the bucket to host the website and make it publicly available.

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

### v1.2.*
- Added the `remove` option to tear down what you deploy. ([Pull 10](https://github.com/fernando-mc/serverless-finch/pull/10) thanks to [redroot](https://github.com/redroot)) 
- Fixed automated builds for the project (no functional differences)

### v1.3.*
- Added the ability to set a `distributionFolder` configuration value. This enables you to upload your website files from a custom directory ([Pull 12](https://github.com/fernando-mc/serverless-finch/pull/12) - [pradel](https://github.com/pradel))
- Updated the URL to the official static website endpoint URL ([Pull 13](https://github.com/fernando-mc/serverless-finch/pull/13) - [amsross](https://github.com/amsross))
- Minor fixes to prs ([fernando-mc](https://github.com/fernando-mc))
- Added a new AWS region ([daguix](https://github.com/daguix))

## Maintainers
- **You** - If you're interested in having a more active role in development and becoming a maintainer [get in touch](https://www.fernandomc.com/contact/).
- Fernando Medina Corey - [fernando-mc](https://github.com/fernando-mc)

## Contributors
- [redroot](https://github.com/redroot)
- [amsross](https://github.com/amsross)
- [pradel](https://github.com/pradel)
- [daguix](https://github.com/daguix)

Forked from the [**serverless-client-s3**](https://github.com/serverless/serverless-client-s3/)
