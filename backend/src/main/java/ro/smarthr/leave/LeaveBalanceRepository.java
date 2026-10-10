package ro.smarthr.leave;

import jakarta.persistence.LockModeType;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeaveBalanceRepository extends JpaRepository<LeaveBalance, UUID> {

    Optional<LeaveBalance> findByEmployeeIdAndYear(UUID employeeId, int year);

    /** Lock pessimist pe rândul soldului; se ia mereu DUPĂ lock-ul rândului cererii. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select b from LeaveBalance b where b.employeeId = :employeeId and b.year = :year")
    Optional<LeaveBalance> lockByEmployeeIdAndYear(@Param("employeeId") UUID employeeId, @Param("year") int year);
}
