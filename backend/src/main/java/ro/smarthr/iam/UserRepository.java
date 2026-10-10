package ro.smarthr.iam;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<AppUser, UUID> {

    /** Emailul se stochează normalizat (litere mici). */
    Optional<AppUser> findByEmail(String email);

    boolean existsByEmail(String email);
}
