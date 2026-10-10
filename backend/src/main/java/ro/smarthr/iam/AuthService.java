package ro.smarthr.iam;

import java.util.List;
import java.util.UUID;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import ro.smarthr.common.Emails;
import ro.smarthr.common.Messages;
import ro.smarthr.common.TokenResponse;
import ro.smarthr.platform.Company;
import ro.smarthr.platform.CompanyRepository;
import ro.smarthr.security.JwtService;
import ro.smarthr.tenancy.TenantContext;

@Service
public class AuthService {

    /** Rezultatul verificării în interiorul tranzacției (fără entități lazy în afara sesiunii). */
    record Verified(UUID userId, List<String> permissions, int sessionVersion) {
    }

    private final CompanyRepository companies;
    private final UserVerifier verifier;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final String dummyHash;

    public AuthService(CompanyRepository companies, UserVerifier verifier, PasswordEncoder encoder, JwtService jwt) {
        this.companies = companies;
        this.verifier = verifier;
        this.encoder = encoder;
        this.jwt = jwt;
        this.dummyHash = encoder.encode(UUID.randomUUID().toString());
    }

    public TokenResponse login(String companyCode, String email, String password) {
        Company company = companies.findByCode(companyCode.trim().toLowerCase(java.util.Locale.ROOT)).orElse(null);
        Verified verified = null;
        if (company != null) {
            // Tenantul se setează înainte de a se deschide sesiunea Hibernate (în UserVerifier).
            verified = TenantContext.runAs(company.getId(),
                () -> verifier.verify(Emails.normalize(email), password));
        }
        if (company == null) {
            encoder.matches(password, dummyHash); // egalizare de timp: exact un matches pe fiecare drum
        }
        // Compania dezactivată: același răspuns generic (verify a rulat deja, deci același cost).
        if (verified == null || !company.isEnabled()) {
            throw new BadCredentialsException(Messages.BAD_CREDENTIALS);
        }
        return TokenResponse.bearer(
            jwt.issueTenantToken(verified.userId(), company.getId(), verified.permissions(), verified.sessionVersion()),
            JwtService.TTL.toSeconds());
    }

    @Service
    public static class UserVerifier {

        private final UserRepository users;
        private final PasswordEncoder encoder;
        private final String dummyHash;

        public UserVerifier(UserRepository users, PasswordEncoder encoder) {
            this.users = users;
            this.encoder = encoder;
            this.dummyHash = encoder.encode(UUID.randomUUID().toString());
        }

        /** Null la orice eșec: user inexistent, parolă greșită sau user dezactivat. */
        @org.springframework.transaction.annotation.Transactional(readOnly = true)
        public Verified verify(String email, String password) {
            AppUser user = users.findByEmail(email).orElse(null);
            boolean ok = encoder.matches(password, user != null ? user.getPasswordHash() : dummyHash);
            if (user == null || !ok || !user.isEnabled()) {
                return null;
            }
            List<String> perms = user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .distinct().sorted().toList();
            return new Verified(user.getId(), perms, user.getSessionVersion());
        }
    }
}
