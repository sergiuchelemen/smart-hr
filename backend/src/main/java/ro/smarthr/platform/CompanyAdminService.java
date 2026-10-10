package ro.smarthr.platform;

import java.util.Set;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Emails;
import ro.smarthr.common.Messages;
import ro.smarthr.iam.AppUser;
import ro.smarthr.iam.Role;
import ro.smarthr.iam.RoleRepository;
import ro.smarthr.iam.UserRepository;
import ro.smarthr.tenancy.TenantContext;

/**
 * Administrarea companiilor de către platformă. Tenantul se setează (runAs) ÎNAINTE de tranzacție;
 * munca reală e în {@link Worker}. Nu loghează date personale.
 */
@Service
public class CompanyAdminService {

    private final CompanyRepository companies;
    private final Worker worker;
    private final PasswordEncoder encoder;

    public CompanyAdminService(CompanyRepository companies, Worker worker, PasswordEncoder encoder) {
        this.companies = companies;
        this.worker = worker;
        this.encoder = encoder;
    }

    public CompanyController.CompanyDetail detail(UUID id) {
        requireExists(id);
        return TenantContext.runAs(id, () -> worker.detail(id));
    }

    public CompanyController.CompanyDetail setEnabled(UUID id, boolean enabled) {
        requireExists(id);
        return TenantContext.runAs(id, () -> worker.setEnabled(id, enabled));
    }

    public UUID addAdmin(UUID id, String email, String password) {
        requireExists(id);
        String hash = encoder.encode(password); // înainte de lock: BCrypt e scump
        return TenantContext.runAs(id, () -> worker.addAdmin(id, Emails.normalize(email), hash));
    }

    private void requireExists(UUID id) {
        if (!companies.existsById(id)) {
            throw notFound();
        }
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND);
    }

    @Service
    public static class Worker {

        private final CompanyRepository companies;
        private final UserRepository users;
        private final RoleRepository roles;

        public Worker(CompanyRepository companies, UserRepository users, RoleRepository roles) {
            this.companies = companies;
            this.users = users;
            this.roles = roles;
        }

        @Transactional(readOnly = true)
        public CompanyController.CompanyDetail detail(UUID id) {
            Company c = companies.findById(id).orElseThrow(CompanyAdminService::notFound);
            return toDetail(c);
        }

        /**
         * Dezactivarea incrementează session_version pentru toți userii companiei, ca la reactivare
         * tokenurile emise înainte să nu mai funcționeze.
         */
        @Transactional
        public CompanyController.CompanyDetail setEnabled(UUID id, boolean enabled) {
            Company c = companies.findByIdForUpdate(id).orElseThrow(CompanyAdminService::notFound);
            if (c.isEnabled() && !enabled) {
                users.bumpAllSessionVersions();
            }
            c.setEnabled(enabled);
            companies.saveAndFlush(c);
            return toDetail(c);
        }

        @Transactional
        public UUID addAdmin(UUID id, String email, String hash) {
            companies.findByIdForUpdate(id).orElseThrow(CompanyAdminService::notFound);
            if (users.existsByEmail(email)) {
                throw new ApiException(HttpStatus.CONFLICT, Messages.USER_EMAIL_TAKEN);
            }
            Role hrAdmin = roles.findByNameAndSystemTrue(Role.HR_ADMIN).orElseThrow(CompanyAdminService::notFound);
            return users.saveAndFlush(new AppUser(email, hash, Set.of(hrAdmin))).getId();
        }

        private CompanyController.CompanyDetail toDetail(Company c) {
            return new CompanyController.CompanyDetail(c.getId(), c.getName(), c.getCode(), c.getCreatedAt(),
                c.isEnabled(), users.count(), users.countByEnabledTrue(), users.countActiveAdmins());
        }
    }
}
