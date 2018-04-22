# serverless-finch

[![npm](https://img.shields.io/npm/dm/serverless-finch.svg)](https://www.npmjs.com/package/serverless-finch)
[![npm](https://img.shields.io/npm/v/serverless-finch.svg)](https://www.npmjs.com/package/serverless-finch)
[![license](https://img.shields.io/github/license/fernando-mc/serverless-finch.svg)](https://github.com/fernando-mc/serverless-finch/blob/master/LICENSE)

A Serverless Framework plugin for deployment of static website assets of your Serverless project to AWS S3.

## Installation

```
npm install --save serverless-finch
```

## Usage

**First,** update your `serverless.yml` by adding the following:

```yaml
plugins:
  - serverless-finch

custom:
  client:
    bucketName: [unique-s3-bucketname] # (see Configuration Parameters below)
    # [other configuration parameters] (see Configuration Parameters below)
```

**NOTE:** *For full example configurations, please refer to the [examples](examples) folder.*

**Second**, Create a website folder in the root directory of your Serverless project. This is where your distribution-ready website should live. By default the plugin expects the files to live in a folder called `client/dist`. But this is configurable with the `distributionFolder` option (see the [Configuration Parameters](#configuration-parameters) below).

The plugin uploads the entire `distributionFolder` to S3 and configures the bucket to host the website and make it publicly available, also setting other options based the [Configuration Parameters](#configuration-parameters) specified in `serverless.yml`.

To test the plugin initially you can copy/run the following commands in the root directory of your Serverless project to get a quick sample website for deployment:

```bash
mkdir -p client/dist
touch client/dist/index.html
touch client/dist/error.html
echo "Go Serverless" >> client/dist/index.html
echo "error page" >> client/dist/error.html
```

**Third**, run the plugin, and visit your new website!

```
serverless client deploy [--region $REGION] [--no-delete-contents] [--no-config-change] [--no-policy-change] [--no-cors-change]
```

The plugin should output the location of your newly deployed static site to the console.

**Note:** *See [Command-line Parameters](#command-line-parameters) for details on command above*

**WARNING:** The plugin will overwrite any data you have in the bucket name you set above if it already exists.

If later on you want to take down the website you can use:

```bash
serverless client remove
```

### Configuration Parameters

**bucketName**

_required_

```yaml
custom:
  client:
    bucketName: [unique-s3-bucketname]
```

Use this parameter to specify a unique name for the S3 bucket that your files will be uploaded to.

---

**distributionFolder**

_optional_, default: `client/dist`

```yaml
custom:
  client:
    ...
    distributionFolder: [path/to/files]
    ...
```

Use this parameter to specify the path that contains your website files to be uploaded. This path is relative to the path that your `serverless.yaml` configuration files resides in.

---

**indexDocument**

_optional_, default: `index.html`

```yaml
custom:
  client:
    ...
    indexDocument: [file-name.ext]
    ...
```

The name of your index document inside your `distributionFolder`. This is the file that will be served to a client visiting the base URL for your website.

---

**errorDocument**

_optional_, default: `error.html`

```yaml
custom:
  client:
    ...
    errorDocument: [file-name.ext]
    ...
```

The name of your error document inside your `distributionFolder`. This is the file that will be served to a client if their initial request returns an error (e.g. 404). For an SPA, you may want to set this to the same document specified in `indexDocument` so that all requests are redirected to your index document and routing can be handled on the client side by your SPA.

---

**objectHeaders** 

_optional_, no default

```yaml
custom:
  client:
    ...
    objectHeaders:
      ALL_OBJECTS:
        - name: [header-name]
          value: [header-value]
        ...
      specific-directory/:
        - name: [header-name]
          value: [header-value]
        ...
      specific-file.ext:
        - name: [header-name]
          value: [header-value]
        ...
      ... [more file- or folder-specific rules]
    ...
```

Use the `objectHeaders` option to set HTTP response headers be sent to clients requesting uploaded files from your website. 

Headers may be specified globally for all files in the bucket by adding a `name`, `value` pair to the `ALL_OBJECTS` property of the `objectHeaders` option. They may also be specified for specific folders or files within your site by specifying properties with names like `specific-directory/` (trailing slash required to indicate folder) or `specific-file.ext`, where the folder and/or file paths are relative to `distributionFolder`. 

Headers with more specificity will take precedence over more general ones. For instance, if 'Cache-Control' was set to 'max-age=100' in `ALL_OBJECTS` and to 'max-age=500' in `my/folder/`, the files in `my/folder/` would get a header of 'Cache-Control: max-age=500'.

---

**redirectAllRequestsTo**

_optional_, no default

```yaml
custom:
  client:
    ...
    redirectAllRequestsTo:
      hostName: [hostName]
      protocol: [http|https]
    ...
```

Use the `redirectAllRequestsTo` option if you want to route all traffic coming to your website to a different address. `hostName` is the address that requests should be redirected to (e.g. 'www.other-website.com'). `protocol` is the protocol to use for the redirect and must be either 'http' or 'https'.

[AWS Documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-websiteconfiguration.html#cfn-s3-websiteconfiguration-redirectallrequeststo)

---

**routingRules**

_optional_, no default

```yaml
custom:
  client:
    ...
    routingRules:
      - redirect:
          hostName: [hostName]
          httpRedirectCode: [CODE]
          protocol: [http|https]
          replaceKeyPrefixWith: [prefix]
          replaceKeyWith: [object]
        condition:
          keyPrefixEquals: [prefix]
          httpErrorCodeReturnedEquals: [CODE]
      - [more-rules...]
    ...
```

The `routingRules` option can be used to define rules for when and how certain requests to your site should be redirected. Each rule in the `redirectRules` list consists of a (required) `redirect` definition and (optionally) a `condition` on which the redirect is applied.

The `redirect` property of each rule has five optional parameters:

* `hostName` is the name of the host that the request should be redirected to (e.g. 'www.other-site.com'). Defaults to the host from the original request.
* `httpRedirectCode` is the HTTP status code to use for the redirect (e.g. 301, 303, 308).
* `protocol` is the protocol to use for the redirect and must be 'http' or 'https'. Defaults to the protocol from the original request.
* `replaceKeyPrefixWith` specifies the string to replace the portion of the route specified in the `keyPrefixEquals` with in the redirect. For instance, if you want to redirect requests for pages starting with '/images' to pages starting with '/assets/images', you can specify `keyPrefixEquals` as '/images' and `replaceKeyPrefixWith` as '/assets/images'. _Cannot be specified along with `replaceKeyWith`_.
* `replaceKeyWith` specifies a specific page to redirect requests to (e.g. 'landing.html'). _Cannot be specified along with `replaceKeyPrefixWith`_.

The `condition` property has two optional parameters:

* `keyPrefixEquals` specifies that requests to pages starting with the specified value should be redirected. Often used with the `replaceKeyPrefixWith` and `replaceKeyWith` `redirect` properties.
* `httpErrorCodeReturnedEquals` specifies that requests resulting in the given HTTP error code (e.g. 404, 500) should be redirected.

_If `condition` is not specified, then all requests will be redirected in accordance with the specified `redirect` properties_

[AWS Documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-websiteconfiguration.html#cfn-s3-websiteconfiguration-routingrules)

---

### Command-line Parameters

**--region**

_optional_, defaults to value specified in `provider` section of `serverless.yml`

```bash
serverless client deploy --region $REGION
```

Use this parameter to specify what AWS region your bucket will be deployed in. 

This option will always determine the deployment region if specified. If `region`
is not specified via the CLI, we use the `region` option specified under 
custom/client in `serverless.yml`. If that is not specified, we use the Serverless 
region specified under `provider` in `serverless.yml`.

---

**--no-delete-contents**

_optional_, default `false` (deletes contents by default)

```bash
serverless client deploy --no-delete-contents
```

Use this parameter if you do not want to delete the contents of your bucket before deployment. Files uploaded during deployment will still replace any corresponding files already in your bucket.

---

**--no-config-change**

_optional_, default `false` (overwrites bucket configuration by default)

```bash
serverless client deploy --no-config-change
```

Use this parameter if you do not want to overwrite the bucket configuration when deploying to your bucket.

---

**--no-policy-change**

_optional_, default `false` (overwrites bucket policy by default)

```bash
serverless client deploy --no-policy-change
```

Use this parameter if you do not want to overwrite the bucket policy when deploying to your bucket.

---

**--no-cors-change**

_optional_, default `false` (overwrites bucket CORS configuration by default)

```bash
serverless client deploy --no-cors-change
```

Use this parameter if you do not want to overwrite the bucket CORS configuration when deploying to your bucket.

---

## Contributing

For guidelines on contributing to the project, please refer to our [Contributing](docs/CONTRIBUTING.md) page. 

## Release Notes

### v2.0.0 
- Major refactor of entire codebase to move towards modularity and testability
- Added the ability to set HTTP headers for objects in bucket ([Issue 24](https://github.com/fernando-mc/serverless-finch/issues/24))
- Added the ability to set redirect and routing options for the website (Initially implemented in [Pull 23](https://github.com/fernando-mc/serverless-finch/pull/23))
- Added command-line options to disable (Initially implemented in [Pull 28](https://github.com/fernando-mc/serverless-finch/pull/28/files)):
  + Bucket contents being deleted before deployment
  + Bucket configuration being overwritten on deployment
  + Bucket policy being overwritten on deployment
  + Bucket CORS configuration being overwritten on deployment
- Added validation checks for all configuration options 
- Removed "stage" command-line option. It was not being used for anything

### v1.4.\*
- Added the ability to set custom index and error documents. ([Pull 20](https://github.com/fernando-mc/serverless-finch/pull/20) - [evanseeds](https://github.com/evanseeds))

### v1.3.\*
- Added the ability to set a `distributionFolder` configuration value. This enables you to upload your website files from a custom directory ([Pull 12](https://github.com/fernando-mc/serverless-finch/pull/12) - [pradel](https://github.com/pradel))
- Updated the URL to the official static website endpoint URL ([Pull 13](https://github.com/fernando-mc/serverless-finch/pull/13) - [amsross](https://github.com/amsross))
- Added a new AWS region ([Pull 14](https://github.com/fernando-mc/serverless-finch/pull/14) - [daguix](https://github.com/daguix))
- Fixed an issue with resolving serverless variables ([Pull 18](https://github.com/fernando-mc/serverless-finch/pull/18) - [shentonfreude](https://github.com/shentonfreude))

### v1.2.\*
- Added the `remove` option to tear down what you deploy. ([Pull 10](https://github.com/fernando-mc/serverless-finch/pull/10) thanks to [redroot](https://github.com/redroot))
- Fixed automated builds for the project (no functional differences)

## Maintainers
- **You** - If you're interested in having a more active role in development and becoming a maintainer [get in touch](https://www.fernandomc.com/contact/).
- Fernando Medina Corey - [fernando-mc](https://github.com/fernando-mc)
- Linus Marco - [linusmarco](https://github.com/linusmarco)

## Contributors
- [redroot](https://github.com/redroot)
- [amsross](https://github.com/amsross)
- [pradel](https://github.com/pradel)
- [daguix](https://github.com/daguix)
- [shentonfreude](https://github.com/shentonfreude)
- [evanseeds](https://github.com/evanseeds)

Forked from the [**serverless-client-s3**](https://github.com/serverless/serverless-client-s3/)
