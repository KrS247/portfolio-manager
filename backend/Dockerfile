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

# Startup script: create DB from migrations if snapshot not present
RUN printf '#!/bin/sh\n\
if [ ! -f /app/database/portfolio.db ]; then\n\
  echo "[startup] portfolio.db not found — running migrations..."\n\
  php artisan migrate --force --no-interaction\n\
fi\n\
exec php artisan serve --host=0.0.0.0 --port=${PORT:-8080}\n' > /app/start.sh \
    && chmod +x /app/start.sh

EXPOSE 8080

CMD ["/app/start.sh"]
