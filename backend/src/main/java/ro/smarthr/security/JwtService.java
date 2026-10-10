package ro.smarthr.security;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    public static final Duration TTL = Duration.ofMinutes(30);

    private final JwtEncoder encoder;

    public JwtService(JwtEncoder encoder) {
        this.encoder = encoder;
    }

    public String issueTenantToken(UUID userId, UUID companyId, Collection<String> permissions, int sessionVersion) {
        JwtClaimsSet.Builder b = base(userId, "tenant");
        b.claim("cid", companyId.toString());
        b.claim("perms", List.copyOf(permissions));
        b.claim("ver", sessionVersion);
        return encode(b);
    }

    public String issuePlatformToken(UUID adminId) {
        return encode(base(adminId, "platform"));
    }

    private JwtClaimsSet.Builder base(UUID subject, String type) {
        Instant now = Instant.now();
        return JwtClaimsSet.builder()
            .subject(subject.toString())
            .issuedAt(now)
            .expiresAt(now.plus(TTL))
            .claim("typ", type);
    }

    private String encode(JwtClaimsSet.Builder claims) {
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims.build())).getTokenValue();
    }
}
