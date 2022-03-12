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
    bucketName: unique-s3-bucketname # (see Configuration Parameters below)
    # [other configuration parameters] (see Configuration Parameters below)
```

**NOTE:** _For full example configurations, please refer to the [examples](examples) folder._

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

**Note:** _See [Command-line Parameters](#command-line-parameters) for details on command above_

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
    bucketName: unique-s3-bucketname
```

Use this parameter to specify a unique name for the S3 bucket that your files will be uploaded to.

---

**tags**

_optional_, default: `none`

```yaml
custom:
  client:
    ...
    tags:
      tagKey: tagvalue
      tagKey2: tagValue2
    ...
```

Use this parameter to specify a list of tags as key:value pairs that will be assigned to your bucket.

---

**distributionFolder**

_optional_, default: `client/dist`

```yaml
custom:
  client:
    ...
    distributionFolder: path/to/files
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
    indexDocument: file-name.ext
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
    errorDocument: file-name.ext
    ...
```

The name of your error document inside your `distributionFolder`. This is the file that will be served to a client if their initial request returns an error (e.g. 404). For an SPA, you may want to set this to the same document specified in `indexDocument` so that all requests are redirected to your index document and routing can be handled on the client side by your SPA.

---

**bucketPolicyFile**

```yaml
custom:
  client:
    ...
    bucketPolicyFile: path/to/policy.json
    ...
```

Use this parameter to specify the path to a _single_ custom policy file. If not set, it defaults to a config for a basic static website. Currently, only JSON is supported. In your policy, make sure that your resource has the correct bucket name specified above: `"Resource": "arn:aws:s3:::BUCKET_NAME/*",`

_Note: You can also use `${env:PWD}` if you want to dynamically specify the policy within your repo. for example:_

```yaml
custom:
  client:
    ...
    bucketPolicyFile: "${env:PWD}/path/to/policy.json"
    ...
```

_Additionally, you will want to specify different policies depending on your stage using `${self:provider.stage}` to ensure your `BUCKET_NAME` corosponds to the stage._

```yaml
custom:
  client:
    ...
    bucketPolicyFile: "/path/to/policy-${self:provider.stage}.json"
    ...
```

---

**corsFile**

```yaml
custom:
  client:
    ...
    corsFile: path/to/cors.json
    ...
```

Path to a JSON file defining the bucket [CORS configuration](https://docs.aws.amazon.com/AmazonS3/latest/userguide/ManageCorsUsing.html).
If not set, it defaults to the configuration defined [here](./lib/resources/cors-rules.json).
_See above docs on `bucketPolicyFile` option for how to provide a dynamic file path._

---

**objectHeaders**

_optional_, no default

```yaml
custom:
  client:
    ...
    objectHeaders:
      ALL_OBJECTS:
        - name: header-name
          value: header-value
        ...
      'someGlobPattern/*.html':
        - name: header-name
          value: header-value
        ...
      specific-directory/:
        - name: header-name
          value: header-value
        ...
      specific-file.ext:
        - name: header-name
          value: header-value
        ...
      ... # more file- or folder-specific rules
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
      hostName: hostName
      protocol: protocol # "http" or "https"
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
          hostName: hostName
          httpRedirectCode: httpCode
          protocol: protocol # "http" or "https"
          replaceKeyPrefixWith: prefix
          replaceKeyWith: [object]
        condition:
          keyPrefixEquals: prefix
          httpErrorCodeReturnedEquals: httpCode
      - ...
    ...
```

The `routingRules` option can be used to define rules for when and how certain requests to your site should be redirected. Each rule in the `redirectRules` list consists of a (required) `redirect` definition and (optionally) a `condition` on which the redirect is applied.

The `redirect` property of each rule has five optional parameters:

- `hostName` is the name of the host that the request should be redirected to (e.g. 'www.other-site.com'). Defaults to the host from the original request.
- `httpRedirectCode` is the HTTP status code to use for the redirect (e.g. 301, 303, 308).
- `protocol` is the protocol to use for the redirect and must be 'http' or 'https'. Defaults to the protocol from the original request.
- `replaceKeyPrefixWith` specifies the string to replace the portion of the route specified in the `keyPrefixEquals` with in the redirect. For instance, if you want to redirect requests for pages starting with '/images' to pages starting with '/assets/images', you can specify `keyPrefixEquals` as '/images' and `replaceKeyPrefixWith` as '/assets/images'. _Cannot be specified along with `replaceKeyWith`_.
- `replaceKeyWith` specifies a specific page to redirect requests to (e.g. 'landing.html'). _Cannot be specified along with `replaceKeyPrefixWith`_.

The `condition` property has two optional parameters:

- `keyPrefixEquals` specifies that requests to pages starting with the specified value should be redirected. Often used with the `replaceKeyPrefixWith` and `replaceKeyWith` `redirect` properties.
- `httpErrorCodeReturnedEquals` specifies that requests resulting in the given HTTP error code (e.g. 404, 500) should be redirected.

_If `condition` is not specified, then all requests will be redirected in accordance with the specified `redirect` properties_

[AWS Documentation](https://docs.aws.amazon.com/AWSCloudFormation/latest/UserGuide/aws-properties-s3-websiteconfiguration.html#cfn-s3-websiteconfiguration-routingrules)

---

**uploadOrder**

_optional_, no default

```yaml
custom:
  client:
    ...
    uploadOrder:
      - .*
      - .*/assets/.*
      - service-worker\.js
      - index\.html
    ...
```

The `uploadOrder` option can be used for ordering the files uploaded to the bucket. When combined with `--no-delete-contents` this helps with 0 downtime, as we can make sure we upload any assets before serving the html files which need them.

---

**keyPrefix**

_optional_, no default

```yaml
custom:
  client:
    ...
    keyPrefix: s3-folder/possible-sub-folder
    ...
```

Adding a keyPrefix option, so that it's possibly to upload files to a prefixed s3 path. You can use this to specify a key prefix path such as `static` so the deployment matches the naming conventions of popular frontend frameworks and tools.

---

**sse**

_optional_, no default

```yaml
custom:
  client:
    ...
    sse: AES256
    ...
```

Enable server side encryption for the uploaded files. You can use `AES256` or `aws:kms`.

[AWS Documentation](https://docs.aws.amazon.com/AmazonS3/latest/dev/UsingServerSideEncryption.html)

---

**manageResources**

_optional_, default `true` (the plugin does manage your resources by default)

```yaml
custom:
  client:
    ...
    manageResources: false
    ...
```

This allows you to opt out of having serverless-finch create or configure the s3 bucket. Instead, you can rely on an existing bucket or a CloudFormation definition.

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

**--no-confirm**

_optional_, default `false` (disables confirmation prompt)

```bash
serverless client deploy --no-confirm
```

Use this parameter if you do not want a confirmation prompt to interrupt automated builds.

---

## Contributing

Please read our [contribution guide](./CONTRIBUTING.md).

## Release Notes

See [Releases](https://github.com/fernando-mc/serverless-finch/releases) for releases after `v2.6.0`.

### v2.6.0

- Fix bucket deletion when using the `keyPrefix` option - [Pull 102](https://github.com/fernando-mc/serverless-finch/pull/102) - [Joseph](https://github.com/josephnle)
- Add new supported regions - [Pull 101](https://github.com/fernando-mc/serverless-finch/pull/101) - [Andreas Franzén](https://github.com/triptec)
- Add support for tags - [Pull 96](https://github.com/fernando-mc/serverless-finch/pull/96) - [itsjesseyo](https://github.com/itsjesseyo)

### v2.5.0

- Added the `sse` option to allow you to encrypt files with Server Side Encryption using `AES256` or `aws:kms` - [Pull 91](https://github.com/fernando-mc/serverless-finch/pull/91) - [Severi Haverila](https://github.com/severi)

### v2.4.\*

- Added the `manageResources` option to allow you to tell serverless-finch to not interact with your S3 bucket - [Pull 75](https://github.com/fernando-mc/serverless-finch/pull/75) - [sprockow](https://github.com/sprockow)
- Added the `keyPrefix` option to enable working with S3 folders - [Pull 76](https://github.com/fernando-mc/serverless-finch/pull/76) - [Archanium](https://github.com/Archanium)
- Fixed some testing instructions
- Path resolution bugfix - [Olga Skurativska](https://github.com/ol-ko) - [Pull 87](https://github.com/fernando-mc/serverless-finch/pull/87)
- Typo and legacy promise bugfixes - [Joel Van Horn](https://github.com/joelvh), [Raptor](https://github.com/redhat-raptor), [Frederik Ring](https://github.com/m90)

### v2.0.\*

- Added ability to deploy files in a specific order to maximize uptime - [Issue 63](https://github.com/fernando-mc/serverless-finch/issues/63) - [stefan-lz](https://github.com/stefan-lz)
- Added Python tests of functionality to speed up development - [fernando-mc](https://github.com/fernando-mc)
- Major refactor of entire codebase to move towards modularity and testability
- Added the ability to set HTTP headers for objects in bucket ([Issue 24](https://github.com/fernando-mc/serverless-finch/issues/24))
- Added the ability to set redirect and routing options for the website (Initially implemented in [Pull 23](https://github.com/fernando-mc/serverless-finch/pull/23))
- Added command-line options to disable (Initially implemented in [Pull 28](https://github.com/fernando-mc/serverless-finch/pull/28/files)):
  - Bucket contents being deleted before deployment
  - Bucket configuration being overwritten on deployment
  - Bucket policy being overwritten on deployment
  - Bucket CORS configuration being overwritten on deployment
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

## Contributors

- [stefan-lz](https://github.com/stefan-lz)
- [WarWithinMe](https://github.com/WarWithinMe)
- [tahir-mm](https://github.com/tahir-mm)
- [jsphweid](https://github.com/jsphweid)
- [redroot](https://github.com/redroot)
- [amsross](https://github.com/amsross)
- [pradel](https://github.com/pradel)
- [daguix](https://github.com/daguix)
- [shentonfreude](https://github.com/shentonfreude)
- [evanseeds](https://github.com/evanseeds)
- [wzedi](https://github.com/wzedi)
- [sprockow](https://github.com/sprockow)
- [Archanium](https://github.com/Archanium)
- [m90](https://github.com/m90)
- [redhat-raptor](https://github.com/redhat-raptor)
- [ol-ko](https://github.com/ol-ko)
- [severi](https://github.com/severi)
- [josephnle](https://github.com/josephnle)
- [triptec](https://github.com/triptec)
- [itsjesseyo](https://github.com/itsjesseyo)
- [EnricoPicci](https://github.com/EnricoPicci)
- [Lilja](https://github.com/Lilja)
- [mikejpeters](https://github.com/mikejpeters)
- [Shereef](https://github.com/Shereef)

Forked from the [**serverless-client-s3**](https://github.com/serverless/serverless-client-s3/)
