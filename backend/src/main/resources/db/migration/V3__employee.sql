-- Angajați (date minime, fără CNP/salariu). Izolare per companie prin company_id.

CREATE TABLE employee (
    id         UUID PRIMARY KEY,
    company_id UUID         NOT NULL REFERENCES company (id),
    user_id    UUID         NULL REFERENCES app_user (id),
    first_name VARCHAR(100) NOT NULL,
    last_name  VARCHAR(100) NOT NULL,
    work_email VARCHAR(254),
    job_title  VARCHAR(150),
    department VARCHAR(150),
    hire_date  DATE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX ix_employee_company_id ON employee (company_id);
CREATE UNIQUE INDEX uq_employee_company_work_email ON employee (company_id, lower(work_email))
    WHERE work_email IS NOT NULL;
