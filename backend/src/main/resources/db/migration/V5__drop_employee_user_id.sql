-- Legătura angajat-cont se va face la nevoie cu un FK compus (company_id, user_id).
ALTER TABLE employee DROP COLUMN user_id;
