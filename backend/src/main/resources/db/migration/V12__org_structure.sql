-- Structura organizațională: departamente (ierarhie) și posturi, legate de angajați prin FK compuse pe companie.
CREATE TABLE department (
    id         UUID PRIMARY KEY,
    company_id UUID         NOT NULL REFERENCES company (id),
    name       VARCHAR(100) NOT NULL,
    parent_id  UUID         NULL,
    CONSTRAINT uq_department_company_id UNIQUE (company_id, id),
    CONSTRAINT fk_department_parent FOREIGN KEY (company_id, parent_id) REFERENCES department (company_id, id),
    CONSTRAINT ck_department_parent_not_self CHECK (parent_id <> id)
);
CREATE UNIQUE INDEX uq_department_company_name ON department (company_id, lower(name));
CREATE INDEX ix_department_company_parent ON department (company_id, parent_id);

CREATE TABLE job_position (
    id         UUID PRIMARY KEY,
    company_id UUID         NOT NULL REFERENCES company (id),
    name       VARCHAR(100) NOT NULL,
    CONSTRAINT uq_job_position_company_id UNIQUE (company_id, id)
);
CREATE UNIQUE INDEX uq_job_position_company_name ON job_position (company_id, lower(name));

ALTER TABLE employee ADD COLUMN department_id UUID NULL;
ALTER TABLE employee ADD COLUMN position_id UUID NULL;
ALTER TABLE employee ADD CONSTRAINT fk_employee_department
    FOREIGN KEY (company_id, department_id) REFERENCES department (company_id, id);
ALTER TABLE employee ADD CONSTRAINT fk_employee_position
    FOREIGN KEY (company_id, position_id) REFERENCES job_position (company_id, id);
CREATE INDEX ix_employee_company_department ON employee (company_id, department_id);
CREATE INDEX ix_employee_company_position ON employee (company_id, position_id);

-- Backfill din valorile text existente (distincte, case-insensitive, trim, nenule).
INSERT INTO department (id, company_id, name)
SELECT gen_random_uuid(), d.company_id, d.name
FROM (SELECT DISTINCT ON (company_id, lower(left(btrim(department), 100)))
             company_id, left(btrim(department), 100) AS name
      FROM employee
      WHERE department IS NOT NULL AND btrim(department) <> ''
      ORDER BY company_id, lower(left(btrim(department), 100)), left(btrim(department), 100)) d;

INSERT INTO job_position (id, company_id, name)
SELECT gen_random_uuid(), p.company_id, p.name
FROM (SELECT DISTINCT ON (company_id, lower(left(btrim(job_title), 100)))
             company_id, left(btrim(job_title), 100) AS name
      FROM employee
      WHERE job_title IS NOT NULL AND btrim(job_title) <> ''
      ORDER BY company_id, lower(left(btrim(job_title), 100)), left(btrim(job_title), 100)) p;

UPDATE employee e SET department_id = d.id
FROM department d
WHERE d.company_id = e.company_id AND e.department IS NOT NULL
  AND lower(d.name) = lower(left(btrim(e.department), 100));

UPDATE employee e SET position_id = p.id
FROM job_position p
WHERE p.company_id = e.company_id AND e.job_title IS NOT NULL
  AND lower(p.name) = lower(left(btrim(e.job_title), 100));

ALTER TABLE employee DROP COLUMN department;
ALTER TABLE employee DROP COLUMN job_title;

-- Privilegiu nou + backfill pe rolurile de sistem HR_ADMIN existente.
INSERT INTO permission (code, description) VALUES
    ('ORG_MANAGE', 'Gestionează departamentele și posturile');

INSERT INTO role_permission (role_id, permission_code)
SELECT r.id, 'ORG_MANAGE' FROM role r
WHERE r.is_system AND r.name = 'HR_ADMIN'
ON CONFLICT DO NOTHING;
