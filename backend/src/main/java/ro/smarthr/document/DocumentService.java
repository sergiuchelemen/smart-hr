package ro.smarthr.document;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import org.bson.Document;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.aggregation.Aggregation;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;
import ro.smarthr.iam.CurrentUserPrivileges;
import ro.smarthr.iam.CurrentUserPrivileges.Caller;
import ro.smarthr.tenancy.mongo.TenantMongoOperations;

/** Fără nume de fișiere sau titluri în loguri. Vizibilitatea se aplică în interogare, privilegiile se citesc din DB. */
@Service
public class DocumentService {

    static final String MANAGE = "DOCUMENT_MANAGE";
    private static final Set<String> MANAGER_PERMS = Set.of("LEAVE_APPROVE", "LEAVE_APPROVE_ALL",
        "TIMESHEET_APPROVE", "TIMESHEET_APPROVE_ALL", MANAGE);
    static final int MAX_PAGE_SIZE = 100;

    public record Content(String contentType, String fileName, byte[] bytes) {
    }

    public record Page(List<LibraryDocument> items, int page, int size, long totalElements) {
    }

    public record CategoryCount(String category, long count) {
    }

    private final TenantMongoOperations mongo;
    private final CurrentUserPrivileges currentUser;

    public DocumentService(TenantMongoOperations mongo, CurrentUserPrivileges currentUser) {
        this.mongo = mongo;
        this.currentUser = currentUser;
    }

    private static boolean canManage(Caller c) {
        return c.permissions().contains(MANAGE);
    }

    private static List<String> visibleLevels(Caller c) {
        List<String> levels = new ArrayList<>(List.of("ALL"));
        if (c.permissions().stream().anyMatch(MANAGER_PERMS::contains)) {
            levels.add("MANAGERS");
        }
        if (canManage(c)) {
            levels.add("HR");
        }
        return levels;
    }

    private Caller manager() {
        Caller c = currentUser.load();
        if (!canManage(c)) {
            throw new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN);
        }
        return c;
    }

    private static ApiException notFound() {
        return new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND);
    }

    static UUID parseId(String id) {
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException | NullPointerException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
    }

    private LibraryDocument visibleDoc(Caller c, UUID id) {
        LibraryDocument d = mongo.findOne(LibraryDocument.class,
            new Criteria().andOperator(Criteria.where("_id").is(id), Criteria.where("visibility").in(visibleLevels(c))));
        if (d == null) {
            throw notFound();
        }
        return d;
    }

    private LibraryDocument anyDoc(UUID id) {
        LibraryDocument d = mongo.findOne(LibraryDocument.class, Criteria.where("_id").is(id));
        if (d == null) {
            throw notFound();
        }
        return d;
    }

    public Page list(String q, String category, int page, int size) {
        Caller c = currentUser.load();
        int sz = Math.min(Math.max(size, 1), MAX_PAGE_SIZE);
        int pg = Math.min(Math.max(page, 0), 100_000);
        List<Criteria> all = new ArrayList<>();
        all.add(Criteria.where("visibility").in(visibleLevels(c)));
        if (category != null && !category.isBlank()) {
            all.add(Criteria.where("category").is(clip(category.trim(), 50)));
        }
        if (q != null && !q.isBlank()) {
            Pattern p = Pattern.compile(Pattern.quote(clip(q.trim(), 100)), Pattern.CASE_INSENSITIVE);
            all.add(new Criteria().orOperator(Criteria.where("title").regex(p), Criteria.where("description").regex(p)));
        }
        Criteria crit = new Criteria().andOperator(all);
        long total = mongo.count(LibraryDocument.class, crit);
        List<LibraryDocument> items = mongo.find(LibraryDocument.class, crit,
            Sort.by(Sort.Direction.DESC, "updatedAt").and(Sort.by("_id")), pg * sz, sz);
        return new Page(items, pg, sz, total);
    }

    private static String clip(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    public List<CategoryCount> categories() {
        Caller c = currentUser.load();
        List<Document> rows = mongo.aggregate(LibraryDocument.class, Document.class,
            Aggregation.match(Criteria.where("visibility").in(visibleLevels(c))),
            Aggregation.group("category").count().as("count"),
            Aggregation.sort(Sort.by("_id")));
        return rows.stream().map(r -> new CategoryCount(r.getString("_id"), ((Number) r.get("count")).longValue()))
            .toList();
    }

    public LibraryDocument get(String id) {
        return visibleDoc(currentUser.load(), parseId(id));
    }

    public Content content(String id) {
        Caller c = currentUser.load();
        LibraryDocument d = visibleDoc(c, parseId(id));
        DocumentFile f = mongo.findOne(DocumentFile.class, Criteria.where("_id").is(d.getId()));
        if (f == null) {
            throw notFound();
        }
        return new Content(f.getContentType() != null ? f.getContentType() : d.getContentType(),
            f.getFileName() != null ? f.getFileName() : d.getFileName(), f.getContent());
    }

    public LibraryDocument create(MultipartFile file, String title, String description, String category,
                                  DocumentVisibility visibility) {
        Caller c = manager();
        byte[] bytes = readBytes(file);
        String type = DocumentContentValidator.detect(bytes);
        LibraryDocument d = new LibraryDocument();
        d.setId(UUID.randomUUID());
        applyMeta(d, title, description, category, visibility);
        d.setFileName(sanitizedName(file, type));
        d.setContentType(type);
        d.setSizeBytes(bytes.length);
        d.setVersion(1);
        d.setCreatedAt(Instant.now());
        d.setUpdatedAt(d.getCreatedAt());
        d.setUploadedByUserId(c.userId());
        mongo.insert(new DocumentFile(d.getId(), bytes, type, d.getFileName(), 1));
        try {
            return mongo.insert(d);
        } catch (RuntimeException e) {
            mongo.delete(DocumentFile.class, Criteria.where("_id").is(d.getId()));
            throw e;
        }
    }

    public LibraryDocument updateMeta(String id, String title, String description, String category,
                                      DocumentVisibility visibility) {
        manager();
        UUID uid = parseId(id);
        String t = requireText(title, 150);
        String cat = requireText(category, 50);
        String desc = optionalText(description, 500);
        if (visibility == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
        anyDoc(uid);
        Update u = new Update().set("title", t).set("description", desc).set("category", cat)
            .set("visibility", visibility).set("updatedAt", Instant.now());
        LibraryDocument d = mongo.findAndModify(LibraryDocument.class, Criteria.where("_id").is(uid), u, true, false);
        if (d == null) {
            throw notFound();
        }
        return d;
    }

    public LibraryDocument replaceFile(String id, MultipartFile file) {
        manager();
        UUID uid = parseId(id);
        byte[] bytes = readBytes(file);
        String type = DocumentContentValidator.detect(bytes);
        String fileName = sanitizedName(file, type);
        anyDoc(uid);
        // Metadatele întâi (fără upsert): dacă documentul a dispărut, nu s-a scris nimic.
        Update u = new Update().set("fileName", fileName)
            .set("contentType", type).set("sizeBytes", (long) bytes.length).inc("version", 1)
            .set("updatedAt", Instant.now());
        LibraryDocument d = mongo.findAndModify(LibraryDocument.class, Criteria.where("_id").is(uid), u, true, false);
        if (d == null) {
            throw notFound();
        }
        int v = d.getVersion();
        try {
            // Scriere monotonă după versiune: o înlocuire mai veche nu o suprascrie pe una mai nouă.
            mongo.findAndModify(DocumentFile.class, new Criteria().andOperator(Criteria.where("_id").is(uid),
                    new Criteria().orOperator(Criteria.where("version").lt(v), Criteria.where("version").exists(false))),
                new Update().set("content", bytes).set("contentType", type).set("fileName", fileName)
                    .set("version", v), false, true);
        } catch (org.springframework.dao.DuplicateKeyException e) {
            // există deja o versiune mai nouă a fișierului
        }
        // Scrierea fișierului precede verificarea; o ștergere concurentă fie vede fișierul (îl șterge), fie îl vedem noi.
        if (mongo.count(LibraryDocument.class, Criteria.where("_id").is(uid)) == 0) {
            mongo.delete(DocumentFile.class, Criteria.where("_id").is(uid));
            throw notFound();
        }
        return d;
    }

    public void delete(String id) {
        manager();
        UUID uid = parseId(id);
        long removed = mongo.delete(LibraryDocument.class, Criteria.where("_id").is(uid));
        mongo.delete(DocumentFile.class, Criteria.where("_id").is(uid));
        if (removed == 0) {
            throw notFound();
        }
    }

    private static String sanitizedName(MultipartFile file, String type) {
        String name = DocumentContentValidator.sanitizeName(file.getOriginalFilename());
        DocumentContentValidator.checkExtension(name, type);
        return name;
    }

    private void applyMeta(LibraryDocument d, String title, String description, String category,
                           DocumentVisibility visibility) {
        if (visibility == null) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
        d.setTitle(requireText(title, 150));
        d.setDescription(optionalText(description, 500));
        d.setCategory(requireText(category, 50));
        d.setVisibility(visibility);
    }

    private static String requireText(String s, int max) {
        String t = s == null ? "" : s.trim();
        if (t.isEmpty() || t.length() > max || hasControl(t)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
        return t;
    }

    private static String optionalText(String s, int max) {
        String t = s == null ? "" : s.trim();
        if (t.length() > max) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
        return t.isEmpty() ? null : t;
    }

    private static boolean hasControl(String s) {
        return s.codePoints().anyMatch(cp -> Character.isISOControl(cp));
    }

    private static byte[] readBytes(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.DOCUMENT_INVALID_FILE);
        }
        try {
            return file.getBytes();
        } catch (java.io.IOException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.DOCUMENT_INVALID_FILE);
        }
    }
}
