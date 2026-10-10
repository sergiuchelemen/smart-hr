package ro.smarthr.tenancy.mongo;

import com.mongodb.client.result.UpdateResult;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.aggregation.AggregationOperation;
import org.springframework.data.mongodb.core.index.Index;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;
import ro.smarthr.iam.CurrentUserPrivileges;
import ro.smarthr.tenancy.TenantContext;

/**
 * SINGURA clasă din aplicație care folosește {@link MongoTemplate} (regulă verificată cu grep).
 * Fiecare operație adaugă filtrul {@code companyId} al tenantului curent (TenantContext, apoi claim-ul "cid").
 * Fără context de tenant: excepție 403, niciodată "toate companiile".
 *
 * Întărire: un {@link Update} care atinge {@code companyId} sau {@code _id} (set, unset, rename, inc etc.) este respins,
 * altfel un document ar putea fi mutat în altă companie. Un pipeline de agregare cu {@code $lookup}, {@code $unionWith},
 * {@code $graphLookup}, {@code $merge} sau {@code $out} este respins, pentru că ar citi (sau scrie) colecții/documente
 * fără filtrul {@code companyId}. Sunt greșeli de programare, deci 500 generic (IllegalArgumentException), fără detalii.
 *
 * Atenție: izolarea depinde de disciplina de cod (accesul doar prin această clasă), nu de motorul bazei de date;
 * MongoDB nu are echivalentul @TenantId din Hibernate.
 */
@Component
public class TenantMongoOperations {

    private final MongoTemplate template;

    public TenantMongoOperations(MongoTemplate template) {
        this.template = template;
    }

    /** Tenantul curent sau 403. */
    public static UUID currentCompanyId() {
        UUID cid = TenantContext.current();
        if (cid != null) {
            return cid;
        }
        try {
            cid = CurrentUserPrivileges.companyIdFromToken();
        } catch (ApiException e) {
            throw e;
        } catch (RuntimeException e) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        if (cid == null) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        return cid;
    }

    private static final Set<String> FORBIDDEN_STAGES =
        Set.of("$lookup", "$unionWith", "$merge", "$out", "$graphLookup");

    private static boolean protectedField(String name) {
        return name.equals("companyId") || name.startsWith("companyId.") || name.equals("_id") || name.startsWith("_id.");
    }

    private static void checkUpdate(Update update) {
        for (String op : update.getUpdateObject().keySet()) {
            Object body = update.getUpdateObject().get(op);
            if (!(body instanceof Document doc)) {
                throw new IllegalArgumentException("Update nepermis");
            }
            for (String field : doc.keySet()) {
                Object value = doc.get(field);
                if (protectedField(field) || ("$rename".equals(op) && value instanceof String target && protectedField(target))) {
                    throw new IllegalArgumentException("Update nepermis");
                }
            }
        }
    }

    private static Criteria scoped(UUID cid, Criteria criteria) {
        Criteria base = Criteria.where("companyId").is(cid);
        return criteria == null ? base : base.andOperator(criteria);
    }

    public <T extends TenantScoped> List<T> find(Class<T> type, Criteria criteria, Sort sort, int skip, int limit) {
        Query q = new Query(scoped(currentCompanyId(), criteria));
        if (sort != null) {
            q.with(sort);
        }
        if (skip > 0) {
            q.skip(skip);
        }
        if (limit > 0) {
            q.limit(limit);
        }
        return template.find(q, type);
    }

    public <T extends TenantScoped> List<T> find(Class<T> type, Criteria criteria) {
        return find(type, criteria, null, 0, 0);
    }

    public <T extends TenantScoped> T findOne(Class<T> type, Criteria criteria) {
        return template.findOne(new Query(scoped(currentCompanyId(), criteria)), type);
    }

    public <T extends TenantScoped> long count(Class<T> type, Criteria criteria) {
        return template.count(new Query(scoped(currentCompanyId(), criteria)), type);
    }

    public <T extends TenantScoped> UpdateResult upsert(Class<T> type, Criteria criteria, Update update) {
        checkUpdate(update);
        UUID cid = currentCompanyId();
        update.setOnInsert("companyId", cid);
        return template.upsert(new Query(scoped(cid, criteria)), update, type);
    }

    /** Returnează documentul (nou sau vechi, după returnNew) sau null dacă nu s-a potrivit nimic. */
    public <T extends TenantScoped> T findAndModify(Class<T> type, Criteria criteria, Update update,
                                                    boolean returnNew, boolean upsert) {
        checkUpdate(update);
        UUID cid = currentCompanyId();
        if (upsert) {
            update.setOnInsert("companyId", cid);
        }
        return template.findAndModify(new Query(scoped(cid, criteria)), update,
            FindAndModifyOptions.options().returnNew(returnNew).upsert(upsert), type);
    }

    public <T extends TenantScoped> T insert(T entity) {
        entity.setCompanyId(currentCompanyId());
        return template.insert(entity);
    }

    public <T extends TenantScoped> long delete(Class<T> type, Criteria criteria) {
        return template.remove(new Query(scoped(currentCompanyId(), criteria)), type).getDeletedCount();
    }

    /** Primul pas al pipeline-ului este mereu $match pe companyId. */
    public <T extends TenantScoped, R> List<R> aggregate(Class<T> inputType, Class<R> outputType,
                                                         AggregationOperation... operations) {
        for (AggregationOperation op : operations) {
            for (Document stage : op.toPipelineStages(Aggregation.DEFAULT_CONTEXT)) {
                if (stage.keySet().stream().anyMatch(FORBIDDEN_STAGES::contains)) {
                    throw new IllegalArgumentException("Etapă de agregare nepermisă");
                }
            }
        }
        AggregationOperation[] all = new AggregationOperation[operations.length + 1];
        all[0] = Aggregation.match(Criteria.where("companyId").is(currentCompanyId()));
        System.arraycopy(operations, 0, all, 1, operations.length);
        return template.aggregate(Aggregation.newAggregation(all), inputType, outputType).getMappedResults();
    }

    /** Operație de infrastructură (la pornire), fără date de tenant. */
    public void ensureIndex(Class<? extends TenantScoped> type, Index index) {
        template.indexOps(type).ensureIndex(index);
    }
}
