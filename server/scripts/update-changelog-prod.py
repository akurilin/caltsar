#!/usr/bin/env python3
from urllib.parse import urlparse
import os
import re

DATABASE_URL = os.getenv('DATABASE_URL')
dbc = urlparse(DATABASE_URL)

# this is pretty quick and dirty, I'm sure there are some corner
# cases here I'm not thinking through
results = re.findall(r'^(\S+):(\S+)@(\S+):(\d+)$', dbc.netloc)

# comes with a leading /
database = dbc.path
username = results[0][0]
password = results[0][1]
host = results[0][2]
port = results[0][3]

ROOT_FOLDER="/Users/alex/code/caltsar"
CHANGELOG_FOLDER="/sql/changelog"
CHANGELOG_FILE="changelog.postgresql.sql"

url = f"jdbc:postgresql://{host}:{port}{database}?user={username}\&password={password}"
command = f"docker run --network=host --rm -v {ROOT_FOLDER}{CHANGELOG_FOLDER}:/liquibase/changelog liquibase/liquibase --url={url} --changeLogFile={CHANGELOG_FILE} update"
print(command)
os.system(command)
