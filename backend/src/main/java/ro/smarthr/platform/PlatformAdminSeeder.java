package ro.smarthr.platform;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import ro.smarthr.common.Emails;

/** Doar pe profilul dev: creează admin-ul de platformă din .env, dacă nu există. */
@Component
@Profile("dev")
public class PlatformAdminSeeder implements ApplicationRunner {

    private final PlatformAdminRepository admins;
    private final PasswordEncoder encoder;
    private final String email;
    private final String password;

    public PlatformAdminSeeder(PlatformAdminRepository admins, PasswordEncoder encoder,
                               @Value("${PLATFORM_ADMIN_EMAIL:}") String email,
                               @Value("${PLATFORM_ADMIN_PASSWORD:}") String password) {
        this.admins = admins;
        this.encoder = encoder;
        this.email = email;
        this.password = password;
    }

    @Override
    public void run(ApplicationArguments args) {
        if (email.isBlank() || password.length() < 12 || email.startsWith("CHANGE_ME")
            || password.startsWith("CHANGE_ME")) {
            throw new IllegalStateException(
                "PLATFORM_ADMIN_EMAIL / PLATFORM_ADMIN_PASSWORD (min 12 caractere) trebuie setate în .env pentru profilul dev.");
        }
        String normalized = Emails.normalize(email);
        if (!admins.existsByEmail(normalized)) {
            admins.save(new PlatformAdmin(normalized, encoder.encode(password)));
        }
    }
}
