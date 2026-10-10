package ro.smarthr.leave;

import jakarta.persistence.LockModeType;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
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

    // ---- tablou de bord (agregări; filtrul de tenant se aplică automat) ----

    long countByEmployeeIdAndStatus(UUID employeeId, LeaveStatus status);

    @Query("select r from LeaveRequest r where r.employeeId = :employeeId "
        + "and r.status = ro.smarthr.leave.LeaveStatus.APPROVED and r.startDate >= :from order by r.startDate, r.id")
    List<LeaveRequest> findNextApproved(@Param("employeeId") UUID employeeId, @Param("from") LocalDate from,
                                        Pageable pageable);

    @Query("select count(r) from LeaveRequest r where r.status = ro.smarthr.leave.LeaveStatus.PENDING "
        + "and r.employeeId <> :exclude")
    long countPendingExcluding(@Param("exclude") UUID exclude);

    @Query("select count(r) from LeaveRequest r where r.status = ro.smarthr.leave.LeaveStatus.PENDING "
        + "and r.employeeId in :ids and r.employeeId <> :exclude")
    long countPendingIn(@Param("ids") Collection<UUID> ids, @Param("exclude") UUID exclude);

    /** Rânduri [employeeId, startDate, endDate] ale concediilor aprobate care se suprapun intervalului. */
    @Query("select r.employeeId, r.startDate, r.endDate from LeaveRequest r "
        + "where r.status = ro.smarthr.leave.LeaveStatus.APPROVED and r.startDate <= :to and r.endDate >= :from "
        + "order by r.startDate, r.endDate, r.employeeId")
    List<Object[]> findApprovedSpans(@Param("from") LocalDate from, @Param("to") LocalDate to, Pageable pageable);

    @Query("select r.employeeId, r.startDate, r.endDate from LeaveRequest r "
        + "where r.status = ro.smarthr.leave.LeaveStatus.APPROVED and r.startDate <= :to and r.endDate >= :from "
        + "and r.employeeId in :ids order by r.startDate, r.endDate, r.employeeId")
    List<Object[]> findApprovedSpansIn(@Param("ids") Collection<UUID> ids, @Param("from") LocalDate from,
                                       @Param("to") LocalDate to, Pageable pageable);

    @Query("select count(distinct r.employeeId) from LeaveRequest r "
        + "where r.status = ro.smarthr.leave.LeaveStatus.APPROVED and r.startDate <= :day and r.endDate >= :day")
    long countOnLeave(@Param("day") LocalDate day);

    @Query("select count(distinct r.employeeId) from LeaveRequest r "
        + "where r.status = ro.smarthr.leave.LeaveStatus.APPROVED and r.startDate <= :day and r.endDate >= :day "
        + "and r.employeeId in :ids")
    long countOnLeaveIn(@Param("ids") Collection<UUID> ids, @Param("day") LocalDate day);

    /** Rânduri [lună, zile lucrătoare] pentru concediile aprobate cuprinse într-o singură lună. */
    @Query("select extract(month from r.startDate), sum(r.workingDays) from LeaveRequest r "
        + "where r.status = ro.smarthr.leave.LeaveStatus.APPROVED and r.startDate between :from and :to "
        + "and r.endDate <= :to and extract(month from r.startDate) = extract(month from r.endDate) "
        + "group by extract(month from r.startDate)")
    List<Object[]> sumApprovedDaysByMonth(@Param("from") LocalDate from, @Param("to") LocalDate to);

    /** Concediile aprobate care trec peste o limită de lună (rare); se împart pe luni în serviciu. */
    @Query("select r.startDate, r.endDate from LeaveRequest r "
        + "where r.status = ro.smarthr.leave.LeaveStatus.APPROVED and r.startDate between :from and :to "
        + "and r.endDate <= :to and extract(month from r.startDate) <> extract(month from r.endDate)")
    List<Object[]> findApprovedMultiMonth(@Param("from") LocalDate from, @Param("to") LocalDate to);
}
