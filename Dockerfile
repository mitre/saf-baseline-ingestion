FROM ubuntu:18.04

RUN apt-get update && apt-get install -y \
  curl \
  bash \
  sudo \
  git \
  && curl -L https://deb.nodesource.com/setup_14.x | sudo -E bash - \
  && apt-get install -y nodejs

RUN curl https://omnitruck.chef.io/install.sh | sudo bash -s -- -P inspec -v 4.18.108

RUN pwd

RUN ls

COPY package.json package-lock.json ./

RUN npm ci

COPY profiles ./profiles/

COPY ingest.js ./

COPY entrypoint.sh ./

# ENTRYPOINT ["node", "./ingest.js"]
ENTRYPOINT ["bash", "entrypoint.sh"]
