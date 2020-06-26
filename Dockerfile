FROM node:12-buster-slim as build

WORKDIR /app

ENV DOCKER=true
ARG PACKAGE_VERSION
ENV PACKAGE_VERSION=${PACKAGE_VERSION}

RUN echo ${PACKAGE_VERSION}

COPY . .

RUN yarn install
RUN yarn compile

FROM debian:buster-slim

WORKDIR /app

ARG PACKAGE_VERSION
ENV PACKAGE_VERSION=${PACKAGE_VERSION}

RUN echo ${PACKAGE_VERSION}

COPY --from=build /app/compile/net64plus-server_${PACKAGE_VERSION}_linux-x64 net64plus-server
COPY --from=build /app/compile/cws_linux_72.node cws_linux_72.node
COPY --from=build /app/compile/farmhash_linux_72.node farmhash_linux_72.node

RUN chmod +x net64plus-server

ENTRYPOINT [ "./net64plus-server" ]
