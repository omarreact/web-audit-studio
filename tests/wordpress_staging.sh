#!/usr/bin/env bash
set -euo pipefail

docker network create wasi-ci >/dev/null
cleanup() {
  docker rm -f wasi-wordpress wasi-mariadb >/dev/null 2>&1 || true
  docker network rm wasi-ci >/dev/null 2>&1 || true
}
trap cleanup EXIT
docker run -d --name wasi-mariadb --network wasi-ci \
  -e MARIADB_DATABASE=wordpress -e MARIADB_USER=wordpress \
  -e MARIADB_PASSWORD=local-test-password -e MARIADB_ROOT_PASSWORD=local-root-password \
  mariadb:11 >/dev/null
docker run -d --name wasi-wordpress --network wasi-ci \
  -e WORDPRESS_DB_HOST=wasi-mariadb -e WORDPRESS_DB_USER=wordpress \
  -e WORDPRESS_DB_PASSWORD=local-test-password -e WORDPRESS_DB_NAME=wordpress \
  -v "$PWD/wordpress/web-audit-importer:/var/www/html/wp-content/plugins/web-audit-importer:ro" \
  wordpress:php8.3-apache >/dev/null
for attempt in $(seq 1 60); do
  if docker exec wasi-wordpress test -f /var/www/html/wp-config.php && \
     docker exec wasi-mariadb mariadb-admin ping -uwordpress -plocal-test-password --silent >/dev/null 2>&1; then
    break
  fi
  sleep 2
done
docker exec wasi-wordpress test -f /var/www/html/wp-config.php
wp() {
  docker run --rm --network wasi-ci --volumes-from wasi-wordpress --user 33:33 \
    -e WORDPRESS_DB_HOST=wasi-mariadb -e WORDPRESS_DB_USER=wordpress \
    -e WORDPRESS_DB_PASSWORD=local-test-password -e WORDPRESS_DB_NAME=wordpress \
    -v "$PWD/tests/wordpress_integration.php:/tmp/wordpress_integration.php:ro" \
    wordpress:cli "$@"
}
wp core install --url=http://wasi-wordpress --title='Web Audit CI' \
  --admin_user=admin --admin_password=local-test-password --admin_email=admin@example.test
wp plugin activate web-audit-importer
wp eval-file /tmp/wordpress_integration.php
