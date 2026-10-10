package ro.smarthr.tenancy;

import java.util.UUID;
import java.util.function.Supplier;

/** Override explicit al tenantului curent (ex: la crearea unei companii sau la login), valabil doar în firul curent. */
public final class TenantContext {

    private static final ThreadLocal<UUID> CURRENT = new ThreadLocal<>();

    private TenantContext() {
    }

    public static UUID current() {
        return CURRENT.get();
    }

    public static <T> T runAs(UUID companyId, Supplier<T> action) {
        UUID previous = CURRENT.get();
        CURRENT.set(companyId);
        try {
            return action.get();
        } finally {
            if (previous == null) {
                CURRENT.remove();
            } else {
                CURRENT.set(previous);
            }
        }
    }

    public static void runAs(UUID companyId, Runnable action) {
        runAs(companyId, () -> {
            action.run();
            return null;
        });
    }
}
