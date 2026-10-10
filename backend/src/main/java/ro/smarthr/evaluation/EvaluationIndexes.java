package ro.smarthr.evaluation;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.index.PartialIndexFilter;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Component;
import ro.smarthr.tenancy.mongo.TenantMongoOperations;

@Component
class EvaluationIndexes {

    private static final Logger log = LoggerFactory.getLogger(EvaluationIndexes.class);

    private final TenantMongoOperations mongo;

    EvaluationIndexes(TenantMongoOperations mongo) {
        this.mongo = mongo;
    }

    @EventListener(ApplicationReadyEvent.class)
    void create() {
        try {
            mongo.ensureIndex(Evaluation.class, new Index().named("uq_company_cycle_employee").unique()
                .on("companyId", Direction.ASC).on("cycleId", Direction.ASC).on("employeeId", Direction.ASC));
            mongo.ensureIndex(Evaluation.class, new Index().named("ix_company_cycle_reviewer_status")
                .on("companyId", Direction.ASC).on("cycleId", Direction.ASC)
                .on("reviewerEmployeeId", Direction.ASC).on("status", Direction.ASC));
            mongo.ensureIndex(Evaluation.class, new Index().named("ix_company_employee_completed")
                .on("companyId", Direction.ASC).on("employeeId", Direction.ASC).on("completedAt", Direction.ASC));
            // Un singur ciclu deschis pe companie.
            mongo.ensureIndex(EvaluationCycle.class, new Index().named("uq_company_open_cycle").unique()
                .on("companyId", Direction.ASC)
                .partial(PartialIndexFilter.of(Criteria.where("status").is(CycleStatus.OPEN.name()))));
        } catch (RuntimeException e) {
            // Regulile de unicitate se bazează pe indecși: fără ei aplicația nu pornește (se loghează doar clasa).
            log.error("Indecșii evaluărilor nu au putut fi creați: {}", e.getClass().getName());
            throw e;
        }
    }
}
