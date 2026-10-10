package ro.smarthr.timesheet;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import ro.smarthr.tenancy.mongo.TenantScoped;

@Document("timesheet_periods")
public class TimesheetPeriod implements TenantScoped {

    @Id
    private String id;
    private UUID companyId;
    private UUID employeeId;
    /** YYYY-MM */
    private String month;
    private TimesheetStatus status;
    private Instant submittedAt;
    private UUID decidedByUserId;
    private Instant decidedAt;
    private String rejectionReason;
    private Integer approvedMinutes;

    public TimesheetPeriod() {
    }

    @Override
    public UUID getCompanyId() {
        return companyId;
    }

    @Override
    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public UUID getEmployeeId() {
        return employeeId;
    }

    public String getMonth() {
        return month;
    }

    public TimesheetStatus getStatus() {
        return status;
    }

    public Instant getSubmittedAt() {
        return submittedAt;
    }

    public Instant getDecidedAt() {
        return decidedAt;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public Integer getApprovedMinutes() {
        return approvedMinutes;
    }
}
