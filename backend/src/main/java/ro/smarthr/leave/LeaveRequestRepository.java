package ro.smarthr.leave;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LeaveRequestRepository extends JpaRepository<LeaveRequest, UUID>,
    JpaSpecificationExecutor<LeaveRequest> {

    /** Lock pessimist pe rândul cererii; primul lock al oricărei tranziții. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from LeaveRequest r where r.id = :id")
    Optional<LeaveRequest> lockById(@Param("id") UUID id);

    @Query("select coalesce(sum(r.workingDays), 0) from LeaveRequest r where r.employeeId = :employeeId "
        + "and r.type = ro.smarthr.leave.LeaveType.ODIHNA and r.status = ro.smarthr.leave.LeaveStatus.PENDING "
        + "and r.startDate between :from and :to")
    long sumPendingRestDays(@Param("employeeId") UUID employeeId, @Param("from") LocalDate from,
                            @Param("to") LocalDate to);

    @Query("select count(r) > 0 from LeaveRequest r where r.employeeId = :employeeId "
        + "and r.status in (ro.smarthr.leave.LeaveStatus.PENDING, ro.smarthr.leave.LeaveStatus.APPROVED) "
        + "and r.startDate <= :end and r.endDate >= :start")
    boolean existsActiveOverlap(@Param("employeeId") UUID employeeId, @Param("start") LocalDate start,
                                @Param("end") LocalDate end);

    @Query("select r from LeaveRequest r where r.employeeId in :ids "
        + "and r.status = ro.smarthr.leave.LeaveStatus.APPROVED and r.startDate <= :to and r.endDate >= :from")
    java.util.List<LeaveRequest> findApprovedOverlapping(@Param("ids") java.util.Collection<UUID> ids,
                                                         @Param("from") LocalDate from, @Param("to") LocalDate to);
}
