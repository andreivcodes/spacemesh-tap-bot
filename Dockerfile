FROM node:16

COPY . ./app

WORKDIR /app

RUN rm -rf /node_modules
RUN yarn

CMD [ "yarn", "start" ]