-- IAM: companii (tenanți), roluri, privilegii, utilizatori. O singură schemă, discriminator company_id.

CREATE TABLE company (
    id         UUID PRIMARY KEY,
    name       VARCHAR(200) NOT NULL,
    code       VARCHAR(32)  NOT NULL UNIQUE,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE platform_admin (
    id            UUID PRIMARY KEY,
    email         VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL
);

-- Global (nu e tenant-scoped)
CREATE TABLE permission (
    code        VARCHAR(64) PRIMARY KEY,
    description VARCHAR(255) NOT NULL
);

CREATE TABLE role (
    id         UUID PRIMARY KEY,
    company_id UUID         NOT NULL REFERENCES company (id),
    name       VARCHAR(100) NOT NULL,
    is_system  BOOLEAN      NOT NULL DEFAULT FALSE,
    CONSTRAINT uq_role_company_name UNIQUE (company_id, name)
);
CREATE INDEX ix_role_company_id ON role (company_id);

CREATE TABLE role_permission (
    role_id         UUID        NOT NULL REFERENCES role (id) ON DELETE CASCADE,
    permission_code VARCHAR(64) NOT NULL REFERENCES permission (code),
    PRIMARY KEY (role_id, permission_code)
);

CREATE TABLE app_user (
    id            UUID PRIMARY KEY,
    company_id    UUID         NOT NULL REFERENCES company (id),
    email         VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE
);
CREATE INDEX ix_app_user_company_id ON app_user (company_id);
CREATE UNIQUE INDEX uq_app_user_company_email ON app_user (company_id, lower(email));

CREATE TABLE user_role (
    user_id UUID NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES role (id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);
CREATE INDEX ix_user_role_role_id ON user_role (role_id);
