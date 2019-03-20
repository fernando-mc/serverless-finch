#!/usr/bin/python3
import os
import boto3
from urllib.request import urlopen

s3 = boto3.client('s3')

def remove():
    os.system("sls client remove --no-confirm")

containing_dir = os.path.split(os.getcwd())[0]
test_dir = os.path.join(os.getcwd(), 'test')
os.system("npm pack")
os.chdir(test_dir)

os.system("npm install ../serverless-finch-?*.?*.?*.tgz")
os.system("pwd")
os.system("echo Serverless Finch Tests Running")

# us-west-1
os.system("cp ./config_files/standard-deploy-use1.yml ./serverless.yml")
os.system("sls client deploy --region us-east-1 --no-confirm")
site_text = urlopen("http://sls-finch-test-stndrd-use1-v2.s3-website-us-east-1.amazonaws.com/").read()
if "Serverless Finch Test Page" not in str(site_text):
    raise Exception("us-west-1 test fails")
else:
    print("################## TEST1 PASSES########################")
remove()

# us-west-2
os.system("cp ./config_files/standard-deploy-usw2.yml ./serverless.yml")
os.system("sls client deploy --region us-west-2 --no-confirm")
site_text = urlopen("http://sls-finch-test-stndrd-usw2-fer.s3-website-us-west-2.amazonaws.com/").read()
if "Serverless Finch Test Page" not in str(site_text):
    raise Exception("us-west-2 test fails")
else:
    print("################## TEST2 PASSES########################")
remove()

# custom headers test with custom index
os.system("cp ./config_files/obj-headers-custom-index.yml ./serverless.yml")
os.system("sls client deploy --no-confirm")
res = s3.head_object(Bucket="sls-finch-test-objhdrs-custom-one", Key="home.html")
if res['CacheControl'] != 'max-age=5':
    raise Exception("Isn't setting headers correctly")
else:
    print("################## TEST3 PASSES########################")
remove()

# custom headers test with standard index
os.system("cp ./config_files/obj-headers-standard-index.yml ./serverless.yml")
os.system("sls client deploy --no-confirm")
res = s3.head_object(Bucket="sls-finch-test-objhdrs-stndrd-fer", Key="index.html")
if res['CacheControl'] != 'max-age=5':
    raise Exception("Isn't setting headers correctly with standard index")
else:
    print("################## TEST4 PASSES########################")
remove()

# Clean up node modules after all tests pass
os.system("rm -r node_modules")
os.system("rm ../serverless-finch-?*.?*.?*.tgz")
