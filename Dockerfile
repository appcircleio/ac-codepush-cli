FROM node:23-alpine3.20 AS BUILDER
WORKDIR /app
COPY package-lock.json .
COPY package.json .
RUN npm install
COPY . .
# RUN npm run check:package
RUN npm run build
RUN echo '//registry.npmjs.org/:_authToken=${NPM_AUTH_TOKEN}' >> ~/.npmrc