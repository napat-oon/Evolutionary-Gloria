#!/usr/bin/env bash
# One-time droplet setup for Evolutionary Gloria. Run with sudo:
#   sudo DOMAIN=ssc-gameproject.dranon-todolist.me EMAIL=you@example.com \
#     DEPLOY_USER=<the user the Deploy workflow SSHes in as> bash setup-droplet.sh
set -euo pipefail

DOMAIN="${DOMAIN:-ssc-gameproject.dranon-todolist.me}"
EMAIL="${EMAIL:?Set EMAIL=your-email for Lets Encrypt registration}"
# The deploy workflow runs docker and writes /opt/gloria as this (non-root) user.
DEPLOY_USER="${DEPLOY_USER:-${SUDO_USER:-}}"

echo "== Installing Docker =="
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sh
fi

echo "== Firewall: allow SSH/HTTP/HTTPS only =="
apt-get install -y -q ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "== App directory =="
mkdir -p /opt/gloria

if [ -n "$DEPLOY_USER" ]; then
  echo "== Granting $DEPLOY_USER docker access and /opt/gloria ownership =="
  usermod -aG docker "$DEPLOY_USER"
  chown "$DEPLOY_USER": /opt/gloria
fi

echo "== Initial Lets Encrypt certificate (standalone, port 80 must be free) =="
if [ ! -e "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  docker run --rm -p 80:80 \
    -v /etc/letsencrypt:/etc/letsencrypt \
    certbot/certbot certonly --standalone \
    -d "$DOMAIN" -m "$EMAIL" --agree-tos --non-interactive
fi

echo "== Certificate auto-renewal (twice daily) =="
cat > /etc/cron.d/gloria-certbot <<'CRON'
0 3,15 * * * root docker run --rm -v /etc/letsencrypt:/etc/letsencrypt -v gloria_certbot-webroot:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet && cd /opt/gloria && docker compose -f docker-compose.prod.yml exec -T web nginx -s reload
CRON

echo "== Done. Push to main (or run the Deploy workflow) to ship the app. =="