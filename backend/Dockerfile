# eGuardian API — PHP 8.4 + Laravel 12
FROM php:8.4-fpm-alpine
RUN apk add --no-cache postgresql-dev libzip-dev oniguruma-dev \
    && docker-php-ext-install pdo_pgsql pcntl zip bcmath
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
WORKDIR /var/www/html
COPY . .
RUN composer install --no-dev --optimize-autoloader --no-interaction \
    && chown -R www-data:www-data storage bootstrap/cache
EXPOSE 9000
CMD ["php-fpm"]
