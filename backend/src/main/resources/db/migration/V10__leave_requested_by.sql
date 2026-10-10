-- Userul care a creat cererea; împiedică auto-aprobarea prin dezlegarea contului de angajat.
ALTER TABLE leave_request ADD COLUMN requested_by_user_id UUID NULL;
ALTER TABLE leave_request ADD CONSTRAINT fk_leave_request_requester
    FOREIGN KEY (company_id, requested_by_user_id) REFERENCES app_user (company_id, id);
UPDATE leave_request r SET requested_by_user_id = e.user_id
    FROM employee e
    WHERE e.id = r.employee_id AND e.company_id = r.company_id AND e.user_id IS NOT NULL;
