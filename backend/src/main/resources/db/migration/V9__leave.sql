-- Solduri și cereri de concediu. Izolare per companie prin company_id (FK compuse către employee/app_user).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE leave_balance (
    id                UUID PRIMARY KEY,
    company_id        UUID   NOT NULL REFERENCES company (id),
    employee_id       UUID   NOT NULL,
    year              INT    NOT NULL,
    entitled_days     INT    NOT NULL,
    carried_over_days INT    NOT NULL DEFAULT 0,
    used_days         INT    NOT NULL DEFAULT 0,
    version           BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT uq_leave_balance_employee_year UNIQUE (employee_id, year),
    CONSTRAINT fk_leave_balance_employee FOREIGN KEY (company_id, employee_id) REFERENCES employee (company_id, id),
    CONSTRAINT ck_leave_balance_range CHECK (
        entitled_days BETWEEN 0 AND 100 AND carried_over_days BETWEEN 0 AND 100 AND used_days BETWEEN 0 AND 100),
    CONSTRAINT ck_leave_balance_used CHECK (used_days <= entitled_days + carried_over_days)
);
CREATE INDEX ix_leave_balance_company ON leave_balance (company_id);

CREATE TABLE leave_request (
    id                  UUID PRIMARY KEY,
    company_id          UUID         NOT NULL REFERENCES company (id),
    employee_id         UUID         NOT NULL,
    type                VARCHAR(32)  NOT NULL,
    start_date          DATE         NOT NULL,
    end_date            DATE         NOT NULL,
    working_days        INT          NOT NULL,
    note                VARCHAR(500) NULL,
    status              VARCHAR(32)  NOT NULL,
    created_at          TIMESTAMPTZ  NOT NULL,
    decided_by_user_id  UUID         NULL,
    decided_at          TIMESTAMPTZ  NULL,
    rejection_reason    VARCHAR(500) NULL,
    cancelled_at        TIMESTAMPTZ  NULL,
    version             BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT ck_leave_request_type CHECK (type IN ('ODIHNA', 'MEDICAL', 'FARA_PLATA', 'EVENIMENT_SPECIAL')),
    CONSTRAINT ck_leave_request_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    CONSTRAINT ck_leave_request_dates CHECK (start_date <= end_date),
    CONSTRAINT ck_leave_request_same_year CHECK (EXTRACT(YEAR FROM start_date) = EXTRACT(YEAR FROM end_date)),
    CONSTRAINT ck_leave_request_working_days CHECK (working_days > 0),
    CONSTRAINT ck_leave_request_rejection CHECK (status <> 'REJECTED' OR rejection_reason IS NOT NULL),
    CONSTRAINT ck_leave_request_decision CHECK (
        status NOT IN ('APPROVED', 'REJECTED') OR (decided_by_user_id IS NOT NULL AND decided_at IS NOT NULL)),
    CONSTRAINT fk_leave_request_employee FOREIGN KEY (company_id, employee_id) REFERENCES employee (company_id, id),
    CONSTRAINT fk_leave_request_decider FOREIGN KEY (company_id, decided_by_user_id) REFERENCES app_user (company_id, id),
    CONSTRAINT ex_leave_request_no_overlap EXCLUDE USING gist (
        company_id WITH =, employee_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
        WHERE (status IN ('PENDING', 'APPROVED'))
);
CREATE INDEX ix_leave_request_employee_start ON leave_request (company_id, employee_id, start_date);
CREATE INDEX ix_leave_request_status ON leave_request (company_id, status);
