## Setup for tests

Tests are currently just a Python script that runs a few common use cases and checks the deployment by using the reqeusts library against the deployment location. This setup assumes a unixy OS and was not tested on Windows. This requires the following prerequisites:

1. Python 3

After you install python3 you can run the following commands within the `test` directory:
1. python3 -m venv venv
2. source venv/bin/activiate
3. pip install -r requirements.txt

Finally, you can either directly run the `test/automated_tests.py` file or just run `npm test`