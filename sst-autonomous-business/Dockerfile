FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    TZ=America/Sao_Paulo

RUN apt-get update && apt-get install -y --no-install-recommends tzdata \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --create-home --uid 1000 sst

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY config ./config
COPY knowledge ./knowledge
COPY templates ./templates
COPY workflows ./workflows
COPY src ./src
COPY web ./web
COPY tests ./tests
RUN mkdir -p data reports && chown -R sst:sst /app

USER sst
# Saúde: o heartbeat do agendador precisa ter menos de 3 minutos.
HEALTHCHECK --interval=2m --timeout=20s CMD python -c "import sqlite3,datetime,sys; c=sqlite3.connect('data/sst.db'); r=c.execute('select heartbeat_at from scheduler_lock').fetchone(); sys.exit(0 if r and (datetime.datetime.now(datetime.timezone.utc)-datetime.datetime.fromisoformat(r[0])).total_seconds()<180 else 1)"

CMD ["python", "-m", "src.main", "daemon"]
