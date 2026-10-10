package ro.smarthr.iam;

import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserRepository extends JpaRepository<AppUser, UUID> {

    /** Emailul se stochează normalizat (litere mici). */
    Optional<AppUser> findByEmail(String email);

    boolean existsByEmail(String email);

    /** Useri activi cu rolul de sistem HR_ADMIN (filtrul de tenant se aplică pe rădăcină; join-ul are condiție explicită). */
    @Query("select count(distinct u) from AppUser u join u.roles r "
        + "where u.enabled = true and r.system = true and r.name = 'HR_ADMIN' and r.companyId = u.companyId")
    long countActiveAdmins();

    @Query("select u.enabled from AppUser u where u.id = :id")
    Optional<Boolean> findEnabledById(@Param("id") UUID id);

    @Query("select distinct p from AppUser u join u.roles r join r.permissions p "
        + "where u.id = :id and r.companyId = u.companyId")
    Set<String> findPermissionCodes(@Param("id") UUID id);

    @Query("select r.id from AppUser u join u.roles r where u.id = :id and r.companyId = u.companyId")
    Set<UUID> findRoleIds(@Param("id") UUID id);
}
