FROM node:16-alpine

RUN apk update

COPY . ./app

WORKDIR /app

RUN rm -rf /node_modules
RUN yarn

CMD [ "yarn", "start" ]