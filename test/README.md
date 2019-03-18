## Setup for tests

Tests are currently just a Python script that runs a few common use cases and checks the deployment by using the reqeusts library against the deployment location. This requires the following prerequisites:

1. You have Python3 and pip installed
2. You have npm and node installed
3. You have the Serverless Framework setup globally
4. You're using a unixy OS

After you install python3 you can run the following commands within the `test` directory:
1. python3 -m venv venv
2. source venv/bin/activate
3. pip install -r requirements.txt

## Running tests

1. You will need to clone the repository and then switch to the branch for the PR in question
2. When on the PR branch (with all the new goodies that might break something) you can run the `test/automated_tests.py` file with python3 or just run `npm test`

If the tests run at all without seeing Serverless Framework errors than you should have feedback as to if the tests pass from the results of `npm test`.