-- Administrare: companie activă/dezactivată și versiune de sesiune per utilizator (incrementată la schimbarea parolei).
ALTER TABLE company ADD COLUMN enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE app_user ADD COLUMN session_version INT NOT NULL DEFAULT 0;
