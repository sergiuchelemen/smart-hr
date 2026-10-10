package ro.smarthr.tenancy;

import java.util.UUID;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Component;

/**
 * Ordine: override din TenantContext, apoi claim-ul "cid" din JWT, apoi un UUID-santinelă (niciodată null),
 * astfel încât fără context să nu fie vizibil niciun rând de tenant.
 */
@Component
public class TenantIdentifierResolver implements CurrentTenantIdentifierResolver<UUID> {

    public static final UUID NO_TENANT = new UUID(0L, 0L);

    @Override
    public UUID resolveCurrentTenantIdentifier() {
        UUID override = TenantContext.current();
        if (override != null) {
            return override;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken jwt) {
            String cid = jwt.getToken().getClaimAsString("cid");
            if (cid != null) {
                try {
                    return UUID.fromString(cid);
                } catch (IllegalArgumentException ignored) {
                    return NO_TENANT;
                }
            }
        }
        return NO_TENANT;
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return false;
    }
}
