FROM node:8

WORKDIR /app

RUN useradd -ms /bin/bash aws-es-proxy-node
RUN chown aws-es-proxy-node:aws-es-proxy-node /app

COPY package.json /app
RUN npm install
COPY index.js /app

EXPOSE 9200

ENTRYPOINT ["node", "index.js"]
