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

# Set permissions and restore the SQLite snapshot.
# portfolio_snapshot has no .db extension so it is never excluded by *.db gitignore rules.
RUN mkdir -p storage/logs storage/framework/cache storage/framework/sessions storage/framework/views \
    && chmod -R 775 storage bootstrap/cache \
    && if [ -f database/portfolio_snapshot ]; then \
         cp database/portfolio_snapshot database/portfolio.db; \
         chmod 664 database/portfolio.db; \
         echo "portfolio.db restored from snapshot ($(wc -c < database/portfolio.db) bytes)"; \
       else \
         echo "WARNING: portfolio_snapshot not found"; \
       fi

EXPOSE 8080

# Use shell form so $PORT env var is expanded at runtime
CMD php artisan serve --host=0.0.0.0 --port=${PORT:-8080}
