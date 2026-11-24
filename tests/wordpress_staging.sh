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
docker run -d --name wasi-wordpress --network wasi-ci -p 127.0.0.1:8099:80 \
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
    wordpress:cli wp "$@"
}
wp core install --url=http://127.0.0.1:8099 --title='Web Audit CI' \
  --admin_user=admin --admin_password=local-test-password --admin_email=admin@example.test
wp plugin activate web-audit-importer
wp eval-file /tmp/wordpress_integration.php

# Exercise the real nonce-protected admin-post upload in the disposable instance.
cookies="$(mktemp)"
trap 'rm -f "$cookies"; cleanup' EXIT
base='http://127.0.0.1:8099'
curl -fsS -c "$cookies" "$base/wp-login.php" >/dev/null
curl -fsS -L -b "$cookies" -c "$cookies" \
  --data-urlencode 'log=admin' --data-urlencode 'pwd=local-test-password' \
  --data-urlencode 'wp-submit=Log In' --data-urlencode "redirect_to=$base/wp-admin/" \
  --data-urlencode 'testcookie=1' "$base/wp-login.php" >/dev/null
curl -fsS -b "$cookies" "$base/wp-admin/tools.php?page=wasi-import" -o /tmp/wasi-import-form.html
nonce="$(python3 - <<'PY'
from html.parser import HTMLParser
class NonceParser(HTMLParser):
    nonce = ''
    in_form = False
    candidate = ''
    action = ''
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'form':
            self.in_form, self.candidate, self.action = True, '', ''
        if tag == 'input' and self.in_form:
            if a.get('name') == '_wpnonce': self.candidate = a.get('value', '')
            if a.get('name') == 'action': self.action = a.get('value', '')
    def handle_endtag(self, tag):
        if tag == 'form' and self.in_form:
            if self.action == 'wasi_import_pages': self.nonce = self.candidate
            self.in_form = False
p = NonceParser()
p.feed(open('/tmp/wasi-import-form.html', encoding='utf-8').read())
print(p.nonce)
PY
)"
test -n "$nonce"
curl -fsS -L -b "$cookies" -c "$cookies" -o /tmp/wasi-import-result.html \
  -F action=wasi_import_pages -F "_wpnonce=$nonce" \
  -F "wasi_file=@tests/fixtures/wordpress-pages.json;type=application/json" \
  "$base/wp-admin/admin-post.php"
wp post list --post_type=page --post_status=draft --field=post_name | grep -qx wasi-upload-fixture
post_id="$(wp post list --post_type=page --post_status=draft --name=wasi-upload-fixture --field=ID)"
test -n "$post_id"
wp post get "$post_id" --field=post_content | grep -q 'wp:heading'
