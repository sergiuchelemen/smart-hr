package ro.smarthr.org;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ro.smarthr.common.ApiException;
import ro.smarthr.common.Messages;
import ro.smarthr.employee.EmployeeRepository;
import ro.smarthr.iam.CurrentUserPrivileges;
import ro.smarthr.platform.CompanyRepository;

@Service
public class OrgService {

    static final int MAX_DEPTH = 10;
    static final int MAX_NAME = 100;

    private final DepartmentRepository departments;
    private final PositionRepository positions;
    private final EmployeeRepository employees;
    private final CompanyRepository companies;

    public OrgService(DepartmentRepository departments, PositionRepository positions, EmployeeRepository employees,
                      CompanyRepository companies) {
        this.departments = departments;
        this.positions = positions;
        this.employees = employees;
        this.companies = companies;
    }

    // ---------- departamente ----------

    @Transactional(readOnly = true)
    public List<DepartmentController.DepartmentResponse> listDepartments() {
        Map<UUID, Long> children = new HashMap<>();
        departments.countChildren().forEach(r -> children.put((UUID) r[0], (Long) r[1]));
        Map<UUID, Long> counts = new HashMap<>();
        employees.countPerDepartment().forEach(r -> counts.put((UUID) r[0], (Long) r[1]));
        return departments.findAll().stream()
            .sorted(Comparator.comparing((Department d) -> d.getName().toLowerCase()).thenComparing(Department::getId))
            .map(d -> new DepartmentController.DepartmentResponse(d.getId(), d.getName(), d.getParentId(),
                counts.getOrDefault(d.getId(), 0L), children.getOrDefault(d.getId(), 0L)))
            .toList();
    }

    @Transactional
    public DepartmentController.DepartmentResponse createDepartment(String rawName, UUID parentId) {
        String name = cleanName(rawName);
        lockCompany();
        if (departments.existsByNameIgnoreCase(name)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.DEPARTMENT_NAME_TAKEN);
        }
        Map<UUID, Department> all = loadAll();
        if (parentId != null) {
            requireParent(all, parentId);
            if (depthOf(all, parentId) + 1 > MAX_DEPTH) {
                throw new ApiException(HttpStatus.CONFLICT, Messages.DEPARTMENT_TOO_DEEP);
            }
        }
        Department saved = departments.saveAndFlush(new Department(name, parentId));
        return response(saved);
    }

    @Transactional
    public DepartmentController.DepartmentResponse updateDepartment(UUID id, String rawName, UUID parentId) {
        String name = cleanName(rawName);
        lockCompany();
        Department d = findDepartment(id);
        if (departments.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.DEPARTMENT_NAME_TAKEN);
        }
        Map<UUID, Department> all = loadAll();
        if (parentId != null) {
            requireParent(all, parentId);
            // ciclu: noul părinte este chiar nodul sau un descendent al lui (urcare iterativă, limitată)
            UUID current = parentId;
            for (int i = 0; current != null; i++) {
                if (current.equals(id) || i > all.size()) {
                    throw new ApiException(HttpStatus.CONFLICT, Messages.DEPARTMENT_CYCLE);
                }
                current = all.get(current).getParentId();
            }
            if (depthOf(all, parentId) + height(all, id) > MAX_DEPTH) {
                throw new ApiException(HttpStatus.CONFLICT, Messages.DEPARTMENT_TOO_DEEP);
            }
        }
        d.update(name, parentId);
        return response(departments.saveAndFlush(d));
    }

    @Transactional
    public void deleteDepartment(UUID id) {
        lockCompany();
        Department d = findDepartment(id);
        if (departments.existsByParentId(id)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.DEPARTMENT_HAS_CHILDREN);
        }
        if (employees.existsByDepartmentId(id)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.DEPARTMENT_HAS_EMPLOYEES);
        }
        departments.delete(d);
        departments.flush();
    }

    private DepartmentController.DepartmentResponse response(Department d) {
        long children = departments.existsByParentId(d.getId()) ? countChildren(d.getId()) : 0L;
        return new DepartmentController.DepartmentResponse(d.getId(), d.getName(), d.getParentId(),
            employees.countByDepartmentId(d.getId()), children);
    }

    private long countChildren(UUID id) {
        return departments.countChildren().stream().filter(r -> id.equals(r[0])).mapToLong(r -> (Long) r[1]).sum();
    }

    private Map<UUID, Department> loadAll() {
        Map<UUID, Department> all = new HashMap<>();
        departments.findAll().forEach(d -> all.put(d.getId(), d));
        return all;
    }

    /** Părintele din body: inexistent sau din altă companie => 400 (filtrul de tenant nu îl găsește). */
    private static void requireParent(Map<UUID, Department> all, UUID parentId) {
        if (!all.containsKey(parentId)) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.ORG_INVALID_REFERENCE);
        }
    }

    /** Numărul de niveluri de la rădăcină până la nod inclusiv (rădăcina = 1). */
    private static int depthOf(Map<UUID, Department> all, UUID id) {
        int depth = 0;
        UUID current = id;
        while (current != null && depth <= all.size()) {
            depth++;
            Department d = all.get(current);
            current = d == null ? null : d.getParentId();
        }
        return depth;
    }

    /** Înălțimea subarborelui nodului (nodul singur = 1), iterativ pe niveluri. */
    private static int height(Map<UUID, Department> all, UUID id) {
        Map<UUID, List<UUID>> kids = new HashMap<>();
        all.values().forEach(d -> {
            if (d.getParentId() != null) {
                kids.computeIfAbsent(d.getParentId(), k -> new java.util.ArrayList<>()).add(d.getId());
            }
        });
        int h = 0;
        List<UUID> level = List.of(id);
        while (!level.isEmpty() && h <= all.size()) {
            h++;
            List<UUID> next = new java.util.ArrayList<>();
            level.forEach(n -> next.addAll(kids.getOrDefault(n, List.of())));
            level = next;
        }
        return h;
    }

    private Department findDepartment(UUID id) {
        return departments.findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND));
    }

    // ---------- posturi ----------

    @Transactional(readOnly = true)
    public List<PositionController.PositionResponse> listPositions() {
        Map<UUID, Long> counts = new HashMap<>();
        employees.countPerPosition().forEach(r -> counts.put((UUID) r[0], (Long) r[1]));
        return positions.findAll().stream()
            .sorted(Comparator.comparing((Position p) -> p.getName().toLowerCase()).thenComparing(Position::getId))
            .map(p -> new PositionController.PositionResponse(p.getId(), p.getName(),
                counts.getOrDefault(p.getId(), 0L)))
            .toList();
    }

    @Transactional
    public PositionController.PositionResponse createPosition(String rawName) {
        String name = cleanName(rawName);
        lockCompany();
        if (positions.existsByNameIgnoreCase(name)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.POSITION_NAME_TAKEN);
        }
        Position saved = positions.saveAndFlush(new Position(name));
        return new PositionController.PositionResponse(saved.getId(), saved.getName(), 0L);
    }

    @Transactional
    public PositionController.PositionResponse updatePosition(UUID id, String rawName) {
        String name = cleanName(rawName);
        lockCompany();
        Position p = findPosition(id);
        if (positions.existsByNameIgnoreCaseAndIdNot(name, id)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.POSITION_NAME_TAKEN);
        }
        p.rename(name);
        Position saved = positions.saveAndFlush(p);
        return new PositionController.PositionResponse(saved.getId(), saved.getName(),
            employees.countByPositionId(id));
    }

    @Transactional
    public void deletePosition(UUID id) {
        lockCompany();
        Position p = findPosition(id);
        if (employees.existsByPositionId(id)) {
            throw new ApiException(HttpStatus.CONFLICT, Messages.POSITION_HAS_EMPLOYEES);
        }
        positions.delete(p);
        positions.flush();
    }

    private Position findPosition(UUID id) {
        return positions.findById(id)
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, Messages.NOT_FOUND));
    }

    // ---------- comune ----------

    private static String cleanName(String raw) {
        String n = raw == null ? "" : raw.trim();
        if (n.isEmpty() || n.length() > MAX_NAME) {
            throw new ApiException(HttpStatus.BAD_REQUEST, Messages.BAD_REQUEST);
        }
        return n;
    }

    /** Lock pe rândul companiei ÎNAINTE de orice citire: serializează mutațiile structurii. */
    private void lockCompany() {
        companies.findByIdForUpdate(CurrentUserPrivileges.companyIdFromToken())
            .orElseThrow(() -> new ApiException(HttpStatus.FORBIDDEN, Messages.FORBIDDEN));
    }
}
