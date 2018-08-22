## Setup for tests

Tests are currently just a Python script that runs a few common use cases and checks the deployment by using the reqeusts library against the deployment location. This requires the following prerequisites:

1. You have Python3 and pip installed
2. You have npm and node installed
3. You have the Serverless Framework setup globally
4. You're using a unixy OS

After you install python3 you can run the following commands within the `test` directory:
1. python3 -m venv venv
2. source venv/bin/activiate
3. pip install -r requirements.txt

## Running tests

1. You will need to clone the repository and then switch to the branch for the PR in question
2. When on the PR branch (with all the new goodies that might break something) you can pack up the PR with `npm pack` this should output a file like `serverless-finch-2.2.0.tgz` or something similar.
3. Then you will need to switch into the test directory and install the plugin with `npm install serverless-finch-x.x.x.tgz` (where the name of the thing to be installed is the version you're actually testing).
4. Finally, you can either directly run the `test/automated_tests.py` file or just run `npm test`

If the tests run at all without seeing Serverless Framework errors than you should have feedback as to if the tests pass from the results of `npm test`.