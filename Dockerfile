FROM nginx:stable-alpine

# Only ship application files; backups and repository metadata stay outside.
COPY index.html /usr/share/nginx/html/index.html
COPY assets/ /usr/share/nginx/html/assets/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/
RUN chmod -R a+rX /usr/share/nginx/html

EXPOSE 80
