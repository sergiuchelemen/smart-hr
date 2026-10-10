package ro.smarthr.iam;

import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface RoleRepository extends JpaRepository<Role, UUID> {

    boolean existsByName(String name);

    Optional<Role> findByNameAndSystemTrue(String name);

    boolean existsByNameAndIdNot(String name, UUID id);

    @Query("select count(u) from AppUser u join u.roles r where r.id = :roleId and r.companyId = u.companyId")
    long countUsersWithRole(@Param("roleId") UUID roleId);

    @Query("select case when count(u) > 0 then true else false end from AppUser u join u.roles r "
        + "where r.id = :roleId and r.companyId = u.companyId")
    boolean existsUserWithRole(@Param("roleId") UUID roleId);

    /** Rânduri [roleId, count]; doar rolurile cu cel puțin un user. */
    @Query("select r.id, count(u) from AppUser u join u.roles r where r.companyId = u.companyId group by r.id")
    List<Object[]> countUsersPerRole();
}
