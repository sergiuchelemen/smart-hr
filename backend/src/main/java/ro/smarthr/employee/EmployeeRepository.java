package ro.smarthr.employee;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EmployeeRepository extends JpaRepository<Employee, UUID> {

    /** Emailul se stochează normalizat (litere mici); filtrul de tenant e aplicat de Hibernate. */
    boolean existsByWorkEmail(String workEmail);

    boolean existsByWorkEmailAndIdNot(String workEmail, UUID id);

    Optional<Employee> findByUserId(UUID userId);

    boolean existsByManagerId(UUID managerId);

    List<Employee> findAllByUserIdIn(Collection<UUID> userIds);

    @Query("select e.id from Employee e where e.managerId = :managerId")
    List<UUID> findIdsByManagerId(@Param("managerId") UUID managerId);

    /** Singura cale de scriere a user_id (filtrul de tenant se aplică și interogărilor JPQL de update). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Employee e set e.userId = :userId where e.id = :id")
    int updateUserId(@Param("id") UUID id, @Param("userId") UUID userId);

    /** Singura cale de scriere a manager_id. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Employee e set e.managerId = :managerId where e.id = :id")
    int updateManagerId(@Param("id") UUID id, @Param("managerId") UUID managerId);
}
