#!/usr/bin/python3
import os
import boto3
import time
from urllib.request import urlopen

s3 = boto3.client('s3')

def setup(desc):

    print("")
    print("TEST: " + desc)

def testpass():
    
    print(".... PASS")

def assertfail(message):

    print(".... FAIL .." + message)
    raise Exception(message)

def teardown():
    print("  CLEANUP START")
    os.system("sls client remove --no-confirm")
    print("          END")

containing_dir = os.path.split(os.getcwd())[0]
test_dir = os.path.join(os.getcwd(), 'test')
os.system("npm pack")
os.chdir(test_dir)

os.system("npm install ../serverless-finch-?*.?*.?*.tgz")
os.system("pwd")
os.system("echo Serverless Finch Tests Running")

os.system("mkdir -p temp")

# client test suite definitions

def func_original_config_tests():

    setup("Does use original configuration to deploy single site to US-EAST-1")

    os.system("cp ./config_files/standard-deploy-use1.yml ./serverless.yml")
    os.system("sls client deploy --region us-east-1 --no-confirm --verbose")
    site_text = urlopen("http://sls-finch-test-stndrd-use1-v2-da-1.s3-website-us-east-1.amazonaws.com/").read()
    if "Serverless Finch Test Page" not in str(site_text):
      assertfail("us-east-1 test fails")

    testpass()
    teardown()

    setup("Does use original configuration to deploy single site to US-WEST-2")

    os.system("cp ./config_files/standard-deploy-usw2.yml ./serverless.yml")
    os.system("sls client deploy --region us-west-2 --no-confirm")
    site_text = urlopen("http://sls-finch-test-stndrd-usw2-fer.s3-website-us-west-2.amazonaws.com/").read()
    if "Serverless Finch Test Page" not in str(site_text):
      assertfail("us-west-2 test fails")

    testpass()
    teardown()

    setup("Can set custom header with custom index and original configuration")

    os.system("cp ./config_files/obj-headers-custom-index.yml ./serverless.yml")
    os.system("sls client deploy --no-confirm")
    res = s3.head_object(Bucket="sls-finch-test-objhdrs-custom-one", Key="home.html")
    if res['CacheControl'] != 'max-age=5':
      assertfail("Isn't setting headers correctly")

    testpass()
    teardwon()

    setup("Can set custom header with standard index and original configuration")

    os.system("cp ./config_files/obj-headers-standard-index.yml ./serverless.yml")
    os.system("sls client deploy --no-confirm")
    res = s3.head_object(Bucket="sls-finch-test-objhdrs-stndrd-fer", Key="index.html")
    if res['CacheControl'] != 'max-age=5':
      assertfail("Isn't setting headers correctly with standard index")

    testpass()
    teardown()

def func_multiple_config_tests():

    setup("Diagnostics printed without error")

    os.system("cp ./config_files/standard-deploy-m1.yml ./temp/diagnostic_1.yml")
    os.system("sed 's/BUCKET1/sls-finch-test-diag-1/g' ./temp/diagnostic_1.yml > ./serverless.yml")  
    os.system("sls client diagnostics --region ap-southeast-2 --no-confirm --verbose")

    testpass()
    teardown()

    setup("Does deploy single site using new configuration")

    os.system("cp ./config_files/standard-deploy-m1.yml ./temp/test_n1.yml")
    os.system("sed 's/BUCKET1/sls-finch-test-dep-apse1-1/g' ./temp/test_n1.yml > ./serverless.yml")  
    os.system("sls client deploy --region ap-southeast-2 --no-confirm --verbose")
    site_text0 = urlopen("http://sls-finch-test-dep-apse1-1.s3-website-ap-southeast-2.amazonaws.com/").read()

    if "Serverless Finch Test Page" not in str(site_text0):
      assertfail("ap-southeast-2 test fails")

    testpass()
    teardown()

    setup("Does deploy mutiple sites using new configuration")

    os.system("cp ./config_files/standard-deploy-m3.yml ./temp/test_n2.yml")
    os.system("sed -i 's/BUCKET1/sls-finch-test-mdep-apse1-1/g' ./temp/test_n2.yml")
    os.system("sed -i 's/BUCKET2/sls-finch-test-mdep-apse1-2/g' ./temp/test_n2.yml")
    os.system("sed    's/BUCKET3/sls-finch-test-mdep-apse1-3/g' ./temp/test_n2.yml > ./serverless.yml")
    os.system("sls client deploy --region ap-southeast-2 --no-confirm --verbose")

    site_text1 = urlopen("http://sls-finch-test-mdep-apse1-1.s3-website-ap-southeast-2.amazonaws.com/").read()
    if "Serverless Finch Test Page" not in str(site_text1):
      assertfail("test of first fails")

    site_text2 = urlopen("http://sls-finch-test-mdep-apse1-2.s3-website-ap-southeast-2.amazonaws.com/").read()
    if "Serverless Finch Test Page" not in str(site_text2):
      assertfail("test of second site fails")

    site_text3 = urlopen("http://sls-finch-test-mdep-apse1-3.s3-website-ap-southeast-2.amazonaws.com/").read()
    if "Serverless Finch Test Page" not in str(site_text3):
      assertfail("test of third site fails")

    testpass()
    teardown()

    setup("Does set custom headers with custom text with new configuration")

    os.system("cp ./config_files/obj-headers-custom-index-m.yml ./temp/test_n3.yml")
    os.system("sed -i 's/BUCKET1/sls-finch-test-objhdrs-mdep-apse1-1/g' ./temp/test_n3.yml")
    os.system("sed    's/BUCKET2/sls-finch-test-objhdrs-mdep-apse1-2/g' ./temp/test_n3.yml > serverless.yml")
    os.system("sls client deploy --region ap-southeast-2 --no-confirm")

    res = s3.head_object(Bucket="sls-finch-test-objhdrs-mdep-apse1-1", Key="home.html")
    if res['CacheControl'] != 'max-age=1':
      assertfail("Isn't setting headers correctly")

    res = s3.head_object(Bucket="sls-finch-test-objhdrs-mdep-apse1-2", Key="home.html")
    if res['CacheControl'] != 'max-age=2':
      assertfail("Isn't setting headers correctly")

    testpass()
    teardown()

    setup("Does deploy from alternate folder")

    os.system("cp ./config_files/standard-deploy-m2.yml ./temp/test_n4.yml")
    os.system("sed -i 's/BUCKET1/sls-finch-test-apse-alt-1/g' ./temp/test_n4.yml")
    os.system("sed    's/BUCKET2/sls-finch-test-apse-alt-2/g' ./temp/test_n4.yml > serverless.yml")
    os.system("sls client deploy --region ap-southeast-2 --no-confirm")

    site_text1 = urlopen("http://sls-finch-test-apse-alt-1.s3-website-ap-southeast-2.amazonaws.com/").read()
    if "Serverless Finch Test Page" not in str(site_text1):
      assertfail("test of first fails")

    site_text2 = urlopen("http://sls-finch-test-apse-alt-2.s3-website-ap-southeast-2.amazonaws.com/").read()
    if "Alternate Site" not in str(site_text2):
      assertfail("test of alternate fails")

    testpass()
    teardown()


#############################################-----------------------------

#func_original_config_tests():
func_multiple_config_tests()


# Clean up node modules after all tests pass
os.system("rm -r node_modules")
os.system("rm ../serverless-finch-?*.?*.?*.tgz")
