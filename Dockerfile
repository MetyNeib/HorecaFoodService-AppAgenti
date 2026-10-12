FROM ruby:4.0.5-slim-bookworm

RUN apt-get update -qq && apt-get install -y --no-install-recommends \
    build-essential libpq-dev libyaml-dev git curl tzdata ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV BUNDLE_PATH=/usr/local/bundle \
    LANG=C.UTF-8 \
    TZ=Europe/Rome \
    LISTEN_GEM_USE_POLLING=1

COPY Gemfile Gemfile.lock ./
RUN bundle install --jobs 4 --retry 3
COPY . .
EXPOSE 3000
CMD ["bundle", "exec", "puma", "-C", "config/puma.rb"]
