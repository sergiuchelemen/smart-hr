package ro.smarthr.platform;

import java.util.UUID;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import ro.smarthr.common.Emails;
import ro.smarthr.common.Messages;
import ro.smarthr.common.TokenResponse;
import ro.smarthr.security.JwtService;

@Service
public class PlatformAuthService {

    private final PlatformAdminRepository admins;
    private final PasswordEncoder encoder;
    private final JwtService jwt;
    private final String dummyHash;

    public PlatformAuthService(PlatformAdminRepository admins, PasswordEncoder encoder, JwtService jwt) {
        this.admins = admins;
        this.encoder = encoder;
        this.jwt = jwt;
        this.dummyHash = encoder.encode(UUID.randomUUID().toString());
    }

    public TokenResponse login(String email, String password) {
        PlatformAdmin admin = admins.findByEmail(Emails.normalize(email)).orElse(null);
        // Verificăm mereu un hash, ca să nu se vadă diferența de timp.
        boolean ok = encoder.matches(password, admin != null ? admin.getPasswordHash() : dummyHash);
        if (admin == null || !ok) {
            throw new BadCredentialsException(Messages.BAD_CREDENTIALS);
        }
        return TokenResponse.bearer(jwt.issuePlatformToken(admin.getId()), JwtService.TTL.toSeconds());
    }
}
