package ro.smarthr.evaluation;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;
import ro.smarthr.tenancy.mongo.TenantScoped;

@Document("evaluation_cycles")
public class EvaluationCycle implements TenantScoped {

    static final int SCALE_MAX = 5;

    @Id
    private String id;
    private UUID companyId;
    private String name;
    /** YYYY-MM-DD */
    private String startDate;
    private String endDate;
    private CycleStatus status;
    private List<CycleCriterion> criteria;
    private int scaleMax = SCALE_MAX;
    private Instant openedAt;
    private Instant closedAt;

    public EvaluationCycle() {
    }

    public EvaluationCycle(String name, String startDate, String endDate, List<CycleCriterion> criteria) {
        this.name = name;
        this.startDate = startDate;
        this.endDate = endDate;
        this.criteria = criteria;
        this.status = CycleStatus.DRAFT;
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

    public String getName() {
        return name;
    }

    public String getStartDate() {
        return startDate;
    }

    public String getEndDate() {
        return endDate;
    }

    public CycleStatus getStatus() {
        return status;
    }

    public List<CycleCriterion> getCriteria() {
        return criteria;
    }

    public int getScaleMax() {
        return scaleMax;
    }

    public Instant getOpenedAt() {
        return openedAt;
    }

    public Instant getClosedAt() {
        return closedAt;
    }
}
