FROM node:16

COPY . ./app

WORKDIR /app

RUN rm -rf /node_modules
RUN rm -rf /dist

RUN yarn
RUN yarn build

CMD [ "yarn", "start" ]