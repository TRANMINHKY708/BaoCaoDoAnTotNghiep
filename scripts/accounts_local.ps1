# Dot-source in EACH terminal. Public configuration only; DATABASE_URL stays in .env.
$env:SECURITY_PROFILE = 'accounts'
$env:ACCOUNTS_INSECURE_LOOPBACK = 'true'
$env:ACCOUNTS_ALLOWED_HOSTS = '["127.0.0.1"]'
$env:SECURITY_CORS_ORIGINS = '["http://127.0.0.1:5173","http://127.0.0.1:8000"]'
$env:DATABASE_ECHO = 'false'
$env:VITE_AUTH_PROFILE = 'accounts'
$env:VITE_API_BASE_URL = '/backend'
$env:FRONTEND_PROXY_TARGET = 'http://127.0.0.1:8000'
