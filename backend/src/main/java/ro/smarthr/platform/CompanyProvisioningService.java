package ro.smarthr.platform;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Emails;
import ro.smarthr.common.Messages;
import ro.smarthr.iam.AppUser;
import ro.smarthr.iam.Permission;
import ro.smarthr.iam.PermissionRepository;
import ro.smarthr.iam.Role;
import ro.smarthr.iam.RoleRepository;
import ro.smarthr.iam.UserRepository;
import ro.smarthr.tenancy.TenantContext;

/**
 * Tenantul e setat (TenantContext.runAs) ÎNAINTE de a se deschide tranzacția/sesiunea Hibernate;
 * de aceea această clasă (nu @Transactional) orchestrează, iar munca reală e în {@link Worker}.
 */
@Service
public class CompanyProvisioningService {

    private final CompanyRepository companies;
    private final Worker worker;

    public CompanyProvisioningService(CompanyRepository companies, Worker worker) {
        this.companies = companies;
        this.worker = worker;
    }

    public Company createCompany(String name, String code, String adminEmail, String adminPassword) {
        if (companies.existsByCode(code)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.COMPANY_CODE_TAKEN);
        }
        UUID companyId = UUID.randomUUID();
        return TenantContext.runAs(companyId,
            () -> worker.provision(companyId, name, code, Emails.normalize(adminEmail), adminPassword));
    }

    @Service
    public static class Worker {

        private final CompanyRepository companies;
        private final PermissionRepository permissions;
        private final RoleRepository roles;
        private final UserRepository users;
        private final PasswordEncoder encoder;

        public Worker(CompanyRepository companies, PermissionRepository permissions, RoleRepository roles,
                      UserRepository users, PasswordEncoder encoder) {
            this.companies = companies;
            this.permissions = permissions;
            this.roles = roles;
            this.users = users;
            this.encoder = encoder;
        }

        @org.springframework.transaction.annotation.Transactional
        public Company provision(UUID companyId, String name, String code, String adminEmail, String adminPassword) {
            Company company = companies.saveAndFlush(new Company(companyId, name, code));
            Set<String> all = permissions.findAll().stream().map(Permission::getCode).collect(Collectors.toSet());
            Role hrAdmin = roles.save(new Role(Role.HR_ADMIN, true, all));
            roles.save(new Role("MANAGER", true, Set.of("EMPLOYEE_READ", "LEAVE_REQUEST", "LEAVE_APPROVE",
                "TIMESHEET_SUBMIT", "TIMESHEET_APPROVE")));
            roles.save(new Role("EMPLOYEE", true, Set.of("LEAVE_REQUEST", "TIMESHEET_SUBMIT")));
            users.save(new AppUser(adminEmail, encoder.encode(adminPassword), Set.of(hrAdmin)));
            return company;
        }
    }
}
