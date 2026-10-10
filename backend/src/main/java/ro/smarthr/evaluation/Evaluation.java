package ro.smarthr.evaluation;

import java.time.Instant;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import ro.smarthr.tenancy.mongo.TenantScoped;

/** Fără nume, emailuri, CNP, salarii sau date medicale: doar referințe (numele se rezolvă din Postgres). */
@Document("evaluations")
public class Evaluation implements TenantScoped {

    @Id
    private String id;
    private UUID companyId;
    private String cycleId;
    private UUID employeeId;
    private UUID reviewerEmployeeId;
    private EvaluationStatus status;
    private boolean locked;
    private ReviewEntry self;
    private ReviewEntry manager;
    private Double selfScore;
    private Double finalScore;
    private Instant completedAt;

    public Evaluation() {
    }

    public Evaluation(String cycleId, UUID employeeId, UUID reviewerEmployeeId) {
        this.cycleId = cycleId;
        this.employeeId = employeeId;
        this.reviewerEmployeeId = reviewerEmployeeId;
        this.status = EvaluationStatus.PENDING_SELF;
    }

    @Override
    public UUID getCompanyId() {
        return companyId;
    }

    @Override
    public void setCompanyId(UUID companyId) {
        this.companyId = companyId;
    }

    public String getId() {
        return id;
    }

    public String getCycleId() {
        return cycleId;
    }

    public UUID getEmployeeId() {
        return employeeId;
    }

    public UUID getReviewerEmployeeId() {
        return reviewerEmployeeId;
    }

    public EvaluationStatus getStatus() {
        return status;
    }

    public boolean isLocked() {
        return locked;
    }

    public ReviewEntry getSelf() {
        return self;
    }

    public ReviewEntry getManager() {
        return manager;
    }

    public Double getSelfScore() {
        return selfScore;
    }

    public Double getFinalScore() {
        return finalScore;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }
}
