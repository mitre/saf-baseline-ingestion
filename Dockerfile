FROM ubuntu:20.04

RUN apt-get update && apt-get install -y \
  curl \
  bash \
  sudo \
  git \
  && curl -L https://deb.nodesource.com/setup_14.x | sudo -E bash - \
  && apt-get install -y nodejs \
  && rm -rf /var/lib/apt/lists/*

RUN curl https://omnitruck.chef.io/install.sh | sudo bash -s -- -P inspec

WORKDIR /control-table-data-ingest

COPY package.json package-lock.json ./

RUN npm ci

COPY profiles ./profiles/

COPY ingest.js ./

COPY entrypoint.sh ./

ENTRYPOINT ["bash", "/control-table-data-ingest/entrypoint.sh"]
