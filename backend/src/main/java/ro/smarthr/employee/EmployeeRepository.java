package ro.smarthr.employee;

import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeRepository extends JpaRepository<Employee, UUID> {

    /** Emailul se stochează normalizat (litere mici); filtrul de tenant e aplicat de Hibernate. */
    boolean existsByWorkEmail(String workEmail);

    boolean existsByWorkEmailAndIdNot(String workEmail, UUID id);

    Optional<Employee> findByUserId(UUID userId);

    boolean existsByManagerId(UUID managerId);
}
