package ro.smarthr.timesheet;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.data.domain.Sort.Direction;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.stereotype.Component;
import ro.smarthr.tenancy.mongo.TenantMongoOperations;

@Component
class TimesheetIndexes {

    private static final Logger log = LoggerFactory.getLogger(TimesheetIndexes.class);

    private final TenantMongoOperations mongo;

    TimesheetIndexes(TenantMongoOperations mongo) {
        this.mongo = mongo;
    }

    @EventListener(ApplicationReadyEvent.class)
    void create() {
        try {
            mongo.ensureIndex(TimesheetEntry.class, new Index().named("uq_company_employee_date").unique()
                .on("companyId", Direction.ASC).on("employeeId", Direction.ASC).on("date", Direction.ASC));
            mongo.ensureIndex(TimesheetPeriod.class, new Index().named("uq_company_employee_month").unique()
                .on("companyId", Direction.ASC).on("employeeId", Direction.ASC).on("month", Direction.ASC));
            mongo.ensureIndex(TimesheetPeriod.class, new Index().named("ix_company_status_month")
                .on("companyId", Direction.ASC).on("status", Direction.ASC).on("month", Direction.ASC));
        } catch (RuntimeException e) {
            // Upsert-urile se bazează pe indecșii unici: fără ei aplicația nu pornește (se loghează doar clasa).
            log.error("Indecșii pontajului nu au putut fi creați: {}", e.getClass().getName());
            throw e;
        }
    }
}
