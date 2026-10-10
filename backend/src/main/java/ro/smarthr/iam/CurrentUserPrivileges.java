package ro.smarthr.iam;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;

/**
 * Privilegiile efective ale utilizatorului curent, citite din DB (nu din claim-ul "perms" al tokenului),
 * în contextul tenantului din token. Orice token invalid/incomplet sau user inexistent/dezactivat => 403.
 */
@Service
public class CurrentUserPrivileges {

    public record Caller(UUID userId, Set<String> permissions, Set<UUID> roleIds) {
    }

    private final UserRepository users;

    public CurrentUserPrivileges(UserRepository users) {
        this.users = users;
    }

    @Transactional(readOnly = true)
    public Caller load() {
        UUID userId = userIdFromToken();
        // Filtrul de tenant (din cid) face ca userii altor companii să nu fie găsiți.
        AppUser user = users.findById(userId).filter(AppUser::isEnabled).orElseThrow(CurrentUserPrivileges::forbidden);
        Set<String> perms = user.getRoles().stream().flatMap(r -> r.getPermissions().stream())
            .collect(Collectors.toSet());
        Set<UUID> roleIds = user.getRoles().stream().map(Role::getId).collect(Collectors.toSet());
        return new Caller(userId, perms, roleIds);
    }

    /** Validează și extrage sub dintr-un token de tenant; 403 pentru orice anomalie. */
    public static UUID userIdFromToken() {
        Jwt jwt = currentJwt();
        if (!"tenant".equals(jwt.getClaimAsString("typ"))) {
            throw forbidden();
        }
        try {
            UUID.fromString(jwt.getClaimAsString("cid"));
            return UUID.fromString(jwt.getSubject());
        } catch (IllegalArgumentException | NullPointerException e) {
            throw forbidden();
        }
    }

    public static UUID companyIdFromToken() {
        userIdFromToken();
        return UUID.fromString(currentJwt().getClaimAsString("cid"));
    }

    private static Jwt currentJwt() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken t) {
            return t.getToken();
        }
        throw forbidden();
    }

    private static ApiException forbidden() {
        return new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
    }
}
