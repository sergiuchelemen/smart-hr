package ro.smarthr.platform;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CompanyRepository extends JpaRepository<Company, UUID> {

    Optional<Company> findByCode(String code);

    boolean existsByCode(String code);

    boolean existsByIdAndEnabledTrue(UUID id);

    /** Lock pessimist pe rândul companiei, pentru serializarea modificărilor de ierarhie. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select c from Company c where c.id = :id")
    Optional<Company> findByIdForUpdate(@Param("id") UUID id);
}
