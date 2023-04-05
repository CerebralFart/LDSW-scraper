FROM node:19-alpine AS node
COPY ./ /app/
WORKDIR /app/
RUN npm run compile && \
    node src/holidays.js && \
    node src/knmi.js && \
    node src/mazemap.js

FROM alpine:3.17 AS unzip
WORKDIR /fuseki/
COPY apache-jena-fuseki-*.tar.gz /fuseki/apache-jena.tar.gz
RUN tar -xf  apache-jena.tar.gz -C ./ && \
    rm apache-jena.tar.gz && \
    mv apache-jena-fuseki-*/* ./

FROM amazoncorretto:11 AS fuseki
COPY --from=unzip /fuseki /fuseki
COPY --from=node /app/ontologies /ontologies/
COPY fuseki-config.ttl /config.ttl
EXPOSE 3030
CMD /fuseki/fuseki-server --config=/config.ttl