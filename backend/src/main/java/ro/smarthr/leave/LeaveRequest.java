package ro.smarthr.leave;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.hibernate.annotations.DynamicUpdate;
import org.hibernate.annotations.TenantId;

@Entity
@DynamicUpdate
@Table(name = "leave_request")
public class LeaveRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @TenantId
    @Column(name = "company_id", nullable = false, updatable = false)
    private UUID companyId;

    @Column(name = "employee_id", nullable = false, updatable = false)
    private UUID employeeId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, updatable = false)
    private LeaveType type;

    @Column(name = "start_date", nullable = false, updatable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false, updatable = false)
    private LocalDate endDate;

    @Column(name = "working_days", nullable = false, updatable = false)
    private int workingDays;

    @Column(name = "note", length = 500, updatable = false)
    private String note;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private LeaveStatus status;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "requested_by_user_id", updatable = false)
    private UUID requestedByUserId;

    @Column(name = "decided_by_user_id")
    private UUID decidedByUserId;

    @Column(name = "decided_at")
    private Instant decidedAt;

    @Column(name = "rejection_reason", length = 500)
    private String rejectionReason;

    @Column(name = "cancelled_at")
    private Instant cancelledAt;

    @Version
    @Column(name = "version", nullable = false)
    private long version;

    protected LeaveRequest() {
    }

    public LeaveRequest(UUID employeeId, LeaveType type, LocalDate startDate, LocalDate endDate, int workingDays,
                        String note, UUID requestedByUserId) {
        this.requestedByUserId = requestedByUserId;
        this.employeeId = employeeId;
        this.type = type;
        this.startDate = startDate;
        this.endDate = endDate;
        this.workingDays = workingDays;
        this.note = note;
        this.status = LeaveStatus.PENDING;
    }

    public void approve(UUID userId) {
        this.status = LeaveStatus.APPROVED;
        this.decidedByUserId = userId;
        this.decidedAt = Instant.now();
    }

    public void reject(UUID userId, String reason) {
        this.status = LeaveStatus.REJECTED;
        this.decidedByUserId = userId;
        this.decidedAt = Instant.now();
        this.rejectionReason = reason;
    }

    public void cancel() {
        this.status = LeaveStatus.CANCELLED;
        this.cancelledAt = Instant.now();
    }

    public UUID getId() {
        return id;
    }

    public UUID getEmployeeId() {
        return employeeId;
    }

    public LeaveType getType() {
        return type;
    }

    public LocalDate getStartDate() {
        return startDate;
    }

    public LocalDate getEndDate() {
        return endDate;
    }

    public int getWorkingDays() {
        return workingDays;
    }

    public String getNote() {
        return note;
    }

    public LeaveStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public UUID getRequestedByUserId() {
        return requestedByUserId;
    }

    public UUID getDecidedByUserId() {
        return decidedByUserId;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public Instant getCancelledAt() {
        return cancelledAt;
    }
}
