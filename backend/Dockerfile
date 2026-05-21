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

# Set permissions. portfolio.db is committed to git and arrives via COPY above.
RUN mkdir -p storage/logs storage/framework/cache storage/framework/sessions storage/framework/views \
    && chmod -R 775 storage bootstrap/cache \
    && if [ -f database/portfolio.db ]; then \
         chmod 664 database/portfolio.db; \
         echo "portfolio.db present ($(wc -c < database/portfolio.db) bytes)"; \
       elif [ -f database/portfolio_snapshot ]; then \
         cp database/portfolio_snapshot database/portfolio.db; \
         chmod 664 database/portfolio.db; \
         echo "portfolio.db restored from portfolio_snapshot ($(wc -c < database/portfolio.db) bytes)"; \
       else \
         echo "WARNING: neither portfolio.db nor portfolio_snapshot found — seeding will be skipped"; \
       fi

EXPOSE 8080

# Cache config/routes/views at startup, then run any pending migrations, then serve.
# This ensures new schema changes in git are always applied to whatever DB is configured
# (SQLite snapshot or an external PostgreSQL, depending on env vars).
CMD php artisan config:cache && php artisan route:cache && php artisan view:cache && php artisan migrate --force && php artisan db:seed:from-snapshot && php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
