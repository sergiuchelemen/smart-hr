package ro.smarthr.common;

public final class Messages {

    public static final String BAD_CREDENTIALS = "Date de autentificare incorecte.";

    public static final String FORBIDDEN = "Acces interzis.";

    public static final String NOT_FOUND = "Resursa nu a fost găsită.";

    public static final String EMPLOYEE_EMAIL_TAKEN = "Există deja un angajat cu acest email de serviciu.";

    public static final String BAD_REQUEST = "Cerere invalidă.";

    public static final String USER_ALREADY_LINKED = "Contul este deja legat de alt angajat.";

    public static final String MANAGER_CYCLE = "Managerul ales ar crea o buclă în ierarhie.";

    public static final String USER_DISABLED = "Contul este dezactivat.";

    public static final String LEAVE_INVALID_INTERVAL = "Intervalul de date este invalid.";

    public static final String LEAVE_CROSS_YEAR = "Cererea trebuie să se încadreze într-un singur an calendaristic; împarte-o pe ani.";

    public static final String LEAVE_START_IN_PAST = "Data de început nu poate fi în trecut.";

    public static final String LEAVE_NO_WORKING_DAYS = "Intervalul nu conține nicio zi lucrătoare.";

    public static final String CALENDAR_UNAVAILABLE = "Calendarul sărbătorilor legale este indisponibil pentru acest an.";

    public static final String LEAVE_INSUFFICIENT_BALANCE = "Sold de concediu insuficient.";

    public static final String LEAVE_OVERLAP = "Există deja o cerere activă care se suprapune cu acest interval.";

    public static final String LEAVE_NOT_PENDING = "Cererea nu mai este în așteptare.";

    public static final String LEAVE_CANNOT_CANCEL = "Cererea nu mai poate fi anulată.";

    public static final String LEAVE_BALANCE_BELOW_USED = "Totalul nou este mai mic decât zilele deja folosite.";

    public static final String CONCURRENT_UPDATE = "Resursa a fost modificată concurent; reîncearcă.";

    private Messages() {
    }
}
