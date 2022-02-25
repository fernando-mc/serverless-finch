# Testing

Tests use the [Mocha](https://mochajs.org) test framework. 

Tests are configured with the [runServerless](https://github.com/serverless/test/blob/main/docs/run-serverless.md#run-serverless) util so that they reflect real world usage.

## Unit tests

Run all unit tests:

```
npm test
```

## AWS integration tests

Run all integration tests:

```
AWS_ACCESS_KEY_ID=XXX AWS_SECRET_ACCESS_KEY=xxx npm run integration-test
```

*Note: relying on AWS_PROFILE won't work because home folder is mocked for test runs.*

Run a specific integration test:

```
AWS_ACCESS_KEY_ID=XXX AWS_SECRET_ACCESS_KEY=xxx npx mocha test/integration/{chosen}.test.js
```

S3 buckets created during testing are prefixed with `serverless-finch-test`. They should be automatically deleted on test completion.

Ideally any feature that integrates with AWS functionality should be backed by integration tests.


## References

- [@serverless/serverless testing guidelines](https://github.com/serverless/serverless/tree/main/test#readme)
- [@serverless/test](https://github.com/serverless/test)