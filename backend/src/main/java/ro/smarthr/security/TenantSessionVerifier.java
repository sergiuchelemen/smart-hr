package ro.smarthr.security;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.Messages;
import ro.smarthr.iam.AppUser;
import ro.smarthr.iam.UserRepository;
import ro.smarthr.platform.CompanyRepository;
import ro.smarthr.platform.PlatformAdminRepository;
import ro.smarthr.tenancy.TenantContext;

/**
 * Verifică la FIECARE request că sesiunea din token mai e validă (user activ, companie activă, versiune de
 * sesiune) și calculează autoritățile din DB. Rulează în convertorul JWT, înainte să existe SecurityContext,
 * deci tenantul se setează explicit (runAs) ÎNAINTE de a se deschide tranzacția din {@link Worker}.
 */
@Component
public class TenantSessionVerifier {

    private final Worker worker;
    private final PlatformAdminRepository platformAdmins;

    public TenantSessionVerifier(Worker worker, PlatformAdminRepository platformAdmins) {
        this.worker = worker;
        this.platformAdmins = platformAdmins;
    }

    /** Aruncă InvalidBearerTokenException (401) cu mesaj constant la orice anomalie. */
    public Collection<GrantedAuthority> authorities(Jwt jwt) {
        String type = jwt.getClaimAsString("typ");
        Collection<GrantedAuthority> authorities = new ArrayList<>();
        if ("platform".equals(type)) {
            UUID adminId = parseUuid(jwt.getSubject());
            if (!platformAdmins.existsById(adminId)) {
                throw invalid();
            }
            authorities.add(new SimpleGrantedAuthority("ROLE_PLATFORM_ADMIN"));
            return authorities;
        }
        if (!"tenant".equals(type)) {
            throw invalid();
        }
        UUID userId = parseUuid(jwt.getSubject());
        UUID companyId = parseUuid(jwt.getClaimAsString("cid"));
        Object ver = jwt.getClaim("ver");
        if (!(ver instanceof Number number)) {
            throw invalid();
        }
        int sessionVersion = number.intValue();
        Set<String> perms = TenantContext.runAs(companyId, () -> worker.verify(userId, companyId, sessionVersion));
        if (perms == null) {
            throw invalid();
        }
        perms.forEach(p -> authorities.add(new SimpleGrantedAuthority("PERM_" + p)));
        return authorities;
    }

    private static UUID parseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw invalid();
        }
    }

    private static InvalidBearerTokenException invalid() {
        return new InvalidBearerTokenException(Messages.SESSION_INVALID);
    }

    @Service
    public static class Worker {

        private final UserRepository users;
        private final CompanyRepository companies;

        public Worker(UserRepository users, CompanyRepository companies) {
            this.users = users;
            this.companies = companies;
        }

        /** Null la orice eșec; altfel privilegiile efective ale userului, din DB. */
        @Transactional(readOnly = true)
        public Set<String> verify(UUID userId, UUID companyId, int sessionVersion) {
            AppUser user = users.findById(userId).orElse(null);
            if (user == null || !user.isEnabled() || user.getSessionVersion() != sessionVersion
                || !companies.existsByIdAndEnabledTrue(companyId)) {
                return null;
            }
            return users.findPermissionCodes(userId);
        }
    }
}
