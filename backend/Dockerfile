FROM php:8.4-cli

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git curl zip unzip libpq-dev libxml2-dev libzip-dev libonig-dev libsqlite3-dev \
    && docker-php-ext-install pdo pdo_pgsql pgsql pdo_sqlite mbstring xml zip bcmath opcache \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:latest /usr/bin/composer /usr/bin/composer

WORKDIR /app

# Copy composer files first for layer caching
COPY composer.json composer.lock ./

# Install PHP dependencies
RUN composer install --no-dev --optimize-autoloader --no-scripts --no-interaction

# Copy application code
COPY . .

# Set permissions
RUN mkdir -p storage/logs storage/framework/cache storage/framework/sessions storage/framework/views \
    && chmod -R 775 storage bootstrap/cache \
    && chmod 664 database/portfolio.db 2>/dev/null || true

# Startup script: verify DB has tables before serving
RUN printf '#!/bin/sh\n\
DB=/app/database/portfolio.db\n\
echo "[startup] Checking DB at $DB ..."\n\
ls -lh $DB 2>/dev/null || echo "[startup] WARNING: $DB not found"\n\
TABLE_COUNT=$(php -r "try { \\$db = new PDO('"'"'sqlite:'"'"'.getenv('"'"'DB_DATABASE'"'"').'"'"''"'"'); echo \\$db->query(\"SELECT count(*) FROM sqlite_master WHERE type='"'"'table'"'"'\")->fetchColumn(); } catch (Exception \\$e) { echo 0; }" 2>/dev/null || echo 0)\n\
echo "[startup] Tables found: $TABLE_COUNT"\n\
if [ "$TABLE_COUNT" -lt 5 ]; then\n\
  echo "[startup] DB missing or empty — running migrations..."\n\
  php artisan migrate --force --no-interaction\n\
fi\n\
exec php artisan serve --host=0.0.0.0 --port=${PORT:-8080}\n' > /app/start.sh \
    && chmod +x /app/start.sh

EXPOSE 8080

CMD ["/app/start.sh"]
