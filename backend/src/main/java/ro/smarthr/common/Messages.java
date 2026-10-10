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

    public static final String LAST_ADMIN = "Compania trebuie să păstreze cel puțin un administrator activ.";

    public static final String ROLE_IN_USE = "Rolul este atribuit unor utilizatori.";

    public static final String ROLE_NAME_TAKEN = "Există deja un rol cu acest nume.";

    public static final String USER_EMAIL_TAKEN = "Există deja un utilizator cu acest email.";

    public static final String COMPANY_CODE_TAKEN = "Codul companiei este deja folosit.";

    public static final String DEPARTMENT_NAME_TAKEN = "Există deja un departament cu acest nume.";

    public static final String POSITION_NAME_TAKEN = "Există deja un post cu acest nume.";

    public static final String DEPARTMENT_CYCLE = "Departamentul părinte ales ar crea o buclă în ierarhie.";

    public static final String DEPARTMENT_TOO_DEEP = "Ierarhia departamentelor depășește adâncimea maximă.";

    public static final String DEPARTMENT_HAS_CHILDREN = "Departamentul are subdepartamente.";

    public static final String DEPARTMENT_HAS_EMPLOYEES = "Departamentul are angajați.";

    public static final String POSITION_HAS_EMPLOYEES = "Postul are angajați.";

    public static final String ORG_INVALID_REFERENCE = "Departament sau post invalid.";

    public static final String SESSION_INVALID = "Sesiune invalidă.";

    public static final String SESSION_INVALID_HEADER = "Invalid session.";

    public static final String TIMESHEET_FUTURE_DATE = "Nu se poate pontaja o zi viitoare.";

    public static final String TIMESHEET_DATE_TOO_OLD = "Ziua este prea veche pentru a fi modificată.";

    public static final String TIMESHEET_DUPLICATE_DATE = "Aceeași zi apare de mai multe ori.";

    public static final String TIMESHEET_MONTH_LOCKED = "Luna este trimisă sau aprobată și nu mai poate fi modificată.";

    public static final String TIMESHEET_DAY_BLOCKED = "Ziua este concediu sau sărbătoare legală.";

    public static final String TIMESHEET_STATE_CONFLICT = "Pontajul nu este în starea necesară pentru această acțiune.";

    public static final String TIMESHEET_FUTURE_MONTH = "Luna nu a început încă.";

    public static final String DOCUMENT_INVALID_FILE = "Fișier invalid: sunt permise doar PDF și text UTF-8, până la 10 MB.";

    public static final String EVALUATION_STATE_CONFLICT = "Evaluarea sau ciclul nu este în starea necesară pentru această acțiune.";

    public static final String EVALUATION_CYCLE_OPEN_EXISTS = "Există deja un ciclu de evaluare deschis.";

    public static final String EVALUATION_INVALID_CYCLE = "Ciclu invalid: verifică numele, datele și criteriile (suma ponderilor trebuie să fie 100).";

    public static final String EVALUATION_INVALID_SCORES = "Scoruri invalide: sunt necesare numere întregi între 1 și 5 pentru toate criteriile.";

    public static final String EVALUATION_INVALID_COMMENT = "Comentariul poate avea cel mult 1000 de caractere.";

    public static final String EVALUATION_INVALID_REVIEWER = "Evaluator invalid.";

    private Messages() {
    }
}
