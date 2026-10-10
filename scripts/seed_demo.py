#!/usr/bin/env python3
"""Populeaza o companie demo (date FICTIVE) prin API-ul backend-ului, plus SQL/Mongo acolo unde API-ul nu permite.

Doar biblioteca standard Python 3. Vezi scripts/README.md.
"""
import argparse
import datetime as dt
import json
import os
import random
import re
import subprocess
import sys
import time
import unicodedata
import urllib.error
import urllib.request
import uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = dt.date.today()
NOW = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


# ---------------------------------------------------------------- utilitare

def log(msg):
    print(msg, flush=True)


def die(msg):
    print("EROARE: " + msg, file=sys.stderr, flush=True)
    sys.exit(1)


def read_env(path):
    values = {}
    if os.path.isfile(path):
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                values[k.strip()] = v.strip().strip('"').strip("'")
    return values


def ascii_slug(s):
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


class ApiError(Exception):
    def __init__(self, status, method, path, message=""):
        super().__init__("%s %s -> %s %s" % (method, path, status, message))
        self.status = status


class Api:
    def __init__(self, base_url):
        self.base = base_url.rstrip("/")

    def request(self, method, path, body=None, token=None, raw=None, content_type=None, retries=2):
        data = raw if raw is not None else (None if body is None else json.dumps(body).encode("utf-8"))
        headers = {"Accept": "application/json"}
        if data is not None:
            headers["Content-Type"] = content_type or "application/json"
        if token:
            headers["Authorization"] = "Bearer " + token
        last = None
        for attempt in range(retries + 1):
            req = urllib.request.Request(self.base + path, data=data, method=method, headers=headers)
            try:
                with urllib.request.urlopen(req, timeout=60) as resp:
                    text = resp.read().decode("utf-8")
                    return json.loads(text) if text else None
            except urllib.error.HTTPError as e:
                text = e.read().decode("utf-8", "replace")
                msg = ""
                try:
                    msg = json.loads(text).get("message", "")
                except Exception:
                    pass
                last = ApiError(e.code, method, path.split("?")[0], msg)
                if e.code < 500 and e.code != 429:
                    raise last
            except (urllib.error.URLError, ConnectionError, TimeoutError) as e:
                last = ApiError(0, method, path.split("?")[0], "conexiune: %s" % type(e).__name__)
            time.sleep(1.0 + attempt)
        raise last


class Session:
    """Token per cont, cu re-login automat la 401 (tokenul expira in 30 de minute)."""

    def __init__(self, api, code, password):
        self.api, self.code, self.password = api, code, password
        self.tokens = {}
        self.passwords = {}

    def login(self, email, password=None):
        res = self.api.request("POST", "/api/auth/login", {
            "companyCode": self.code, "email": email, "password": password or self.passwords.get(email) or self.password})
        self.tokens[email] = res["accessToken"]
        return res["accessToken"]

    def call(self, email, method, path, body=None, password=None):
        token = self.tokens.get(email) or self.login(email, password)
        try:
            return self.api.request(method, path, body, token=token)
        except ApiError as e:
            if e.status != 401:
                raise
            token = self.login(email, password)
            return self.api.request(method, path, body, token=token)

    def multipart(self, email, path, parts):
        boundary = "----seed" + uuid.uuid4().hex
        out = b""
        for name, filename, ctype, content in parts:
            disp = 'form-data; name="%s"' % name + ('; filename="%s"' % filename if filename else "")
            out += ("--%s\r\nContent-Disposition: %s\r\nContent-Type: %s\r\n\r\n" % (boundary, disp, ctype)).encode()
            out += content + b"\r\n"
        out += ("--%s--\r\n" % boundary).encode()
        token = self.tokens.get(email) or self.login(email)
        return self.api.request("POST", path, token=token, raw=out,
                                content_type="multipart/form-data; boundary=" + boundary)


class Infra:
    """psql / mongosh prin `docker compose exec` (credentialele raman in containere)."""

    def __init__(self, compose_file, env_file):
        self.base = ["docker", "compose", "-f", compose_file]
        if os.path.isfile(env_file):
            self.base += ["--env-file", env_file]

    def _run(self, cmd, stdin):
        r = subprocess.run(self.base + cmd, input=stdin, capture_output=True, text=True)
        if r.returncode != 0:
            raise RuntimeError("comanda docker a esuat (cod %s): %s" % (r.returncode, r.stderr.strip()[-400:]))
        return r.stdout

    def psql(self, sql):
        return self._run(["exec", "-T", "db", "sh", "-c",
                          "psql -U $POSTGRES_USER -d $POSTGRES_DB -v ON_ERROR_STOP=1 -q -A -t"], sql)

    def mongo(self, js):
        self._run(["exec", "-T", "mongo", "sh", "-c", "cat > /tmp/seed_demo.js"], js)
        try:
            return self._run(["exec", "-T", "mongo", "sh", "-c",
                              "mongosh --quiet -u $MONGO_INITDB_ROOT_USERNAME -p $MONGO_INITDB_ROOT_PASSWORD "
                              "--authenticationDatabase admin $MONGO_INITDB_DATABASE --file /tmp/seed_demo.js"], None)
        finally:
            self._run(["exec", "-T", "mongo", "sh", "-c", "rm -f /tmp/seed_demo.js"], None)


# ---------------------------------------------------------------- date fictive

MALE = ["Andrei", "Mihai", "Alexandru", "Ionut", "Cristian", "Radu", "Bogdan", "Florin", "Catalin", "Daniel",
        "Razvan", "Vlad", "Stefan", "Adrian", "Marius", "Lucian", "Tudor", "Nicolae", "Gabriel", "Ovidiu",
        "Dragos", "Sorin", "Costin", "Emil", "Octavian", "Silviu", "Valentin", "Horia", "Paul", "Darius"]
FEMALE = ["Maria", "Elena", "Ioana", "Andreea", "Alexandra", "Cristina", "Mihaela", "Diana", "Raluca", "Simona",
          "Larisa", "Oana", "Laura", "Roxana", "Bianca", "Carmen", "Daniela", "Georgiana", "Irina", "Madalina",
          "Teodora", "Anca", "Corina", "Denisa", "Lavinia", "Monica", "Nicoleta", "Paula", "Sabina", "Violeta"]
SURNAMES = ["Popescu", "Ionescu", "Popa", "Stan", "Dumitru", "Georgescu", "Constantin", "Marin", "Tudor", "Stoica",
            "Diaconu", "Mocanu", "Serban", "Barbu", "Radu", "Lazar", "Matei", "Neagu", "Preda", "Rusu",
            "Dinu", "Ilie", "Voicu", "Munteanu", "Craciun", "Toma", "Vasile", "Oprea", "Manole", "Ene",
            "Cristea", "Ardeleanu", "Banu", "Pavel", "Nistor", "Filip", "Zaharia", "Lungu", "Moldovan", "Pascu",
            "Sandu", "Avram", "Bucur", "Coman", "Dragomir", "Enache", "Gheorghe", "Iacob", "Mares", "Olteanu"]

# (nume, parinte) - ierarhia departamentelor
DEPARTMENTS = [
    ("Conducere", None), ("Tehnologie", "Conducere"), ("Dezvoltare", "Tehnologie"),
    ("Infrastructură", "Tehnologie"), ("Date", "Tehnologie"), ("Operațiuni", "Conducere"),
    ("Suport clienți", "Operațiuni"), ("Vânzări", "Conducere"), ("Resurse umane", "Conducere"),
    ("Financiar", "Conducere"),
]
POSITIONS = ["Director general", "Director", "Manager HR", "Șef de echipă", "Dezvoltator senior", "Dezvoltator",
             "Inginer DevOps", "Analist de date", "Specialist suport clienți", "Reprezentant vânzări",
             "Contabil", "Specialist resurse umane", "Specialist operațiuni", "Asistent administrativ"]

SELF_COMMENTS = ["Am atins majoritatea obiectivelor stabilite pentru perioadă.",
                 "Consider că am livrat constant și am colaborat bine cu echipa.",
                 "Mi-am îmbunătățit organizarea muncii față de perioada anterioară.",
                 "Aș vrea să particip la mai multe activități de formare.",
                 "Am preluat sarcini noi și le-am dus la bun sfârșit."]
MGR_COMMENTS = {
    "low": ["Rezultatele sunt sub așteptări în unele zone; recomand un plan de îmbunătățire.",
            "Este nevoie de mai multă constanță în livrare."],
    "mid": ["Livrează la nivelul așteptat și respectă termenele.", "Colaborare corectă; poate prelua mai multă inițiativă.",
            "Rezultate bune, cu loc de creștere la planificare."],
    "high": ["Rezultate peste așteptări și colaborare foarte bună.", "Preia inițiativa și sprijină colegii.",
             "Calitate constantă a muncii pe toată perioada."],
}

DOCUMENTS = [
    ("Regulament intern", "Regulamentul intern al companiei.", "Regulamente", "ALL", "regulament-intern.txt", [
        "Prezentul regulament intern stabilește regulile de organizare și disciplină a muncii în cadrul companiei Nordic Tech SRL. "
        "Toți angajații au obligația de a-l cunoaște și de a-l respecta.",
        "Programul normal de lucru este de 8 ore pe zi, de luni până vineri. Angajații își desfășoară activitatea cu bună-credință, "
        "respectă confidențialitatea informațiilor și folosesc echipamentele companiei doar în scop profesional.",
        "Abaterile de la regulament se discută mai întâi cu managerul direct. Orice sesizare poate fi adresată departamentului de resurse umane."]),
    ("Politica de concedii", "Reguli pentru solicitarea și aprobarea concediilor.", "Politici", "ALL", "politica-de-concedii.txt", [
        "Fiecare angajat are dreptul la un număr de zile de concediu de odihnă pe an, stabilit prin contract. "
        "Zilele neefectuate pot fi reportate în anul următor, în limita stabilită de companie.",
        "Cererea de concediu se depune în aplicație, cu cel puțin cinci zile lucrătoare înainte de începerea perioadei, "
        "și se aprobă de managerul direct. Sărbătorile legale nu se numără ca zile de concediu.",
        "Concediul medical și evenimentele speciale se solicită ca tipuri separate și nu se scad din soldul de odihnă."]),
    ("Ghid pentru noii angajați", "Primii pași în companie.", "Ghiduri", "ALL", "ghid-noi-angajati.txt", [
        "Bine ai venit în echipă. În prima săptămână vei primi accesul la aplicațiile necesare și vei cunoaște colegii din departamentul tău.",
        "Managerul direct îți va prezenta obiectivele pentru primele trei luni. Pentru întrebări administrative te poți adresa departamentului de resurse umane.",
        "În aplicație îți poți vedea soldul de concediu, completa pontajul și consulta documentele companiei."]),
    ("Procedura de pontaj", "Cum se completează și se aprobă pontajul.", "Proceduri", "ALL", "procedura-de-pontaj.txt", [
        "Pontajul se completează zilnic, cu numărul de ore lucrate și tipul zilei: lucrat, telemuncă sau absent. "
        "Zilele de concediu și sărbătorile legale sunt marcate automat.",
        "La finalul lunii, angajatul trimite pontajul spre aprobare. Managerul direct îl aprobă sau îl respinge cu un motiv, iar în caz de respingere pontajul se corectează și se retrimite.",
        "Pontajul poate fi modificat doar în ultimele 35 de zile, cât timp luna nu a fost trimisă."]),
    ("Procedura de evaluare", "Ciclul de evaluare a performanței, pentru manageri.", "Proceduri", "MANAGERS", "procedura-de-evaluare.txt", [
        "Evaluarea performanței se desfășoară în cicluri deschise de departamentul de resurse umane. Fiecare angajat își completează autoevaluarea, "
        "apoi managerul direct completează evaluarea proprie.",
        "Criteriile și ponderile sunt stabilite la deschiderea ciclului. Scorurile se acordă pe o scară de la 1 la 5, iar scorul final se calculează ponderat.",
        "Managerii motivează scorurile în comentarii scurte și obiective și respectă confidențialitatea rezultatelor."]),
    ("Politica de salarizare internă", "Principiile de salarizare, doar pentru resurse umane.", "Politici", "HR", "politica-de-salarizare.txt", [
        "Această politică descrie principiile generale de salarizare din companie: echitate internă, transparență a criteriilor și corelarea cu responsabilitățile postului.",
        "Revizuirea salariilor are loc anual, pe baza rezultatelor evaluării și a bugetului aprobat. Deciziile se documentează de departamentul de resurse umane.",
        "Documentul este destinat exclusiv personalului din resurse umane și nu conține date individuale."]),
]


# ---------------------------------------------------------------- structura organizatorica

def build_org(rng, real_name):
    """Intoarce lista de angajati (dict-uri) in ordinea creerii; mgr = index in lista."""
    emps = []

    def add(dept, pos, mgr, tier):
        emps.append({"dept": dept, "pos": pos, "mgr": mgr, "tier": tier})
        return len(emps) - 1

    ceo = add("Conducere", "Director general", None, "exec")
    add("Conducere", "Asistent administrativ", ceo, "staff")
    d_tech = add("Tehnologie", "Director", ceo, "director")
    d_ops = add("Operațiuni", "Director", ceo, "director")
    d_sales = add("Vânzări", "Director", ceo, "director")
    d_fin = add("Financiar", "Director", ceo, "director")
    d_hr = add("Resurse umane", "Director", ceo, "director")
    for _ in range(2):
        lead = add("Dezvoltare", "Șef de echipă", d_tech, "lead")
        for i in range(8):
            add("Dezvoltare", "Dezvoltator senior" if i < 3 else "Dezvoltator", lead, "staff")
    lead = add("Infrastructură", "Șef de echipă", d_tech, "lead")
    for _ in range(4):
        add("Infrastructură", "Inginer DevOps", lead, "staff")
    lead = add("Date", "Șef de echipă", d_tech, "lead")
    for _ in range(5):
        add("Date", "Analist de date", lead, "staff")
    lead = add("Suport clienți", "Șef de echipă", d_ops, "lead")
    for _ in range(14):
        add("Suport clienți", "Specialist suport clienți", lead, "staff")
    for _ in range(6):
        add("Operațiuni", "Specialist operațiuni", d_ops, "staff")
    lead = add("Vânzări", "Șef de echipă", d_sales, "lead")
    for _ in range(12):
        add("Vânzări", "Reprezentant vânzări", lead, "staff")
    for _ in range(6):
        add("Financiar", "Contabil", d_fin, "staff")
    hr_specialists = [add("Resurse umane", "Specialist resurse umane", d_hr, "staff") for _ in range(4)]
    real = add("Resurse umane", "Manager HR", d_hr, "staff")
    emps[real]["real"] = True

    # nume unice, fictive
    used = set()
    for i, e in enumerate(emps):
        if e.get("real"):
            e["first"], e["last"] = real_name
            continue
        while True:
            first = rng.choice(MALE if rng.random() < 0.5 else FEMALE)
            last = rng.choice(SURNAMES)
            key = (first, last)
            if key not in used and (first, last) != real_name:
                used.add(key)
                e["first"], e["last"] = first, last
                break
    has_reports = {e["mgr"] for e in emps if e["mgr"] is not None}
    for i, e in enumerate(emps):
        e["email"] = "%s.%s@nordic.example" % (ascii_slug(e["first"]), ascii_slug(e["last"]))
        if i in hr_specialists[:2] or e.get("real"):
            e["role"] = "HR_ADMIN"
        elif i in has_reports:
            e["role"] = "MANAGER"
        else:
            e["role"] = "EMPLOYEE"
    return emps


YEAR_WEIGHTS = {2015: 2, 2016: 4, 2017: 6, 2018: 8, 2019: 9, 2020: 8, 2021: 12, 2022: 14, 2023: 12, 2024: 10,
                2025: 8, 2026: 6}


def pick_hire_dates(rng, emps):
    def rand_date(year):
        start = dt.date(year, 1, 1)
        end = min(dt.date(year, 12, 31), TODAY - dt.timedelta(days=100))
        d = start + dt.timedelta(days=rng.randint(0, (end - start).days))
        while d.weekday() >= 5:
            d += dt.timedelta(days=1)
        return d

    for e in emps:
        if e["tier"] in ("exec", "director"):
            e["hire"] = rand_date(rng.randint(2015, 2018))
        elif e["tier"] == "lead":
            e["hire"] = rand_date(rng.randint(2016, 2021))
        else:
            years = list(YEAR_WEIGHTS)
            e["hire"] = rand_date(rng.choices(years, [YEAR_WEIGHTS[y] for y in years])[0])
    e_real = next(e for e in emps if e.get("real"))
    e_real["hire"] = dt.date(2022, 9, 1)
    # cativa angajari in ultimele 90 de zile (dashboard: hiredLast90Days)
    staff = [e for e in emps if e["tier"] == "staff" and not e.get("real") and e["pos"] != "Asistent administrativ"]
    for e in rng.sample(staff, 4):
        d = TODAY - dt.timedelta(days=rng.randint(10, 80))
        while d.weekday() >= 5:
            d -= dt.timedelta(days=1)
        e["hire"] = d


# ---------------------------------------------------------------- calendar / concedii

class Calendar:
    def __init__(self, holidays):
        self.hol = set(holidays)

    def is_wd(self, d):
        return d.weekday() < 5 and d not in self.hol

    def shift(self, d, n):
        """Deplaseaza cu n zile lucratoare (d trebuie sa fie zi lucratoare)."""
        step = 1 if n >= 0 else -1
        for _ in range(abs(n)):
            d += dt.timedelta(days=step)
            while not self.is_wd(d):
                d += dt.timedelta(days=step)
        return d

    def on_or_after(self, d):
        while not self.is_wd(d):
            d += dt.timedelta(days=1)
        return d

    def wdays(self, s, e):
        n, d = 0, s
        while d <= e:
            n += self.is_wd(d)
            d += dt.timedelta(days=1)
        return n


def day_weights(cal, year):
    """Sezonalitate: iulie-august mai mult, in jurul sarbatorilor (punti) mai mult."""
    days, weights = [], []
    d = dt.date(year, 1, 1)
    while d.year == year:
        if cal.is_wd(d):
            w = 1.0
            if d.month in (7, 8):
                w *= 3.0
            elif d.month in (6, 9):
                w *= 1.4
            elif d.month == 12:
                w *= 1.6
            if any(abs((d - h).days) <= 4 for h in cal.hol if h.year == year):
                w *= 2.2
            days.append(d)
            weights.append(w)
        d += dt.timedelta(days=1)
    return days, weights


def overlaps(segments, s, e):
    return any(not (e < a or s > b) for a, b, _, _ in segments)


def gen_history(rng, cal, days, weights, window_start, cutoff, target, segments, extra_types):
    """Adauga in `segments` (start, end, zile, tip) pana la `target` zile de odihna + tipuri speciale."""
    cand = [(d, w) for d, w in zip(days, weights) if window_start <= d <= cutoff]
    if not cand:
        return
    cd, cw = [c[0] for c in cand], [c[1] for c in cand]

    def place(n_cap, kind, pool):
        for _ in range(60):
            s = rng.choices(cd, cw)[0]
            n = min(rng.choice(pool(s)), n_cap)
            e = cal.shift(s, n - 1)
            if e <= cutoff and e.year == s.year and not overlaps(segments, s, e):
                segments.append((s, e, n, kind))
                return n
        return 0

    def pool(s):
        return [5, 7, 10, 10, 14] if s.month in (7, 8) else [1, 1, 2, 2, 3, 4, 5, 5, 5, 7, 10]

    rem = target
    while rem > 0:
        n = place(rem, "ODIHNA", pool)
        if n == 0:
            break
        rem -= n
    for kind, cap in extra_types:
        place(cap, kind, lambda s, c=cap: list(range(1, c + 1)))


# ---------------------------------------------------------------- pasii principali

def main():
    ap = argparse.ArgumentParser(description="Seed de date demo (fictive) pentru Smart HR.")
    ap.add_argument("--code", default="nordic", help="codul companiei (implicit nordic)")
    ap.add_argument("--name", default="Nordic Tech SRL")
    ap.add_argument("--password", default="Demo-Parola-2026!", help="parola conturilor demo (min. 12 caractere)")
    ap.add_argument("--base-url", default="http://localhost:8080")
    ap.add_argument("--env-file", default=os.path.join(ROOT, ".env"),
                    help="fisier .env cu PLATFORM_ADMIN_EMAIL/PASSWORD (si pentru docker compose)")
    ap.add_argument("--compose-file", default=os.path.join(ROOT, "docker-compose.yml"))
    ap.add_argument("--real-user-email", default=None,
                    help="optional: cont HR_ADMIN suplimentar legat de un angajat 'Sergiu Chelemen' (HR Manager)")
    ap.add_argument("--real-user-password", default=None, help="implicit: valoarea --password")
    ap.add_argument("--seed", type=int, default=2026)
    args = ap.parse_args()

    if len(args.password) < 12:
        die("--password trebuie sa aiba cel putin 12 caractere.")
    if not re.fullmatch(r"[a-z0-9-]{3,32}", args.code):
        die("--code trebuie sa respecte [a-z0-9-]{3,32}.")
    domain = args.code + ".example"
    rng = random.Random(args.seed)
    env = read_env(args.env_file)
    pa_email = env.get("PLATFORM_ADMIN_EMAIL") or os.environ.get("PLATFORM_ADMIN_EMAIL")
    pa_pass = env.get("PLATFORM_ADMIN_PASSWORD") or os.environ.get("PLATFORM_ADMIN_PASSWORD")
    if not pa_email or not pa_pass:
        die("lipsesc PLATFORM_ADMIN_EMAIL/PASSWORD (din --env-file sau din mediu).")

    api = Api(args.base_url)
    infra = Infra(args.compose_file, args.env_file)
    sess = Session(api, args.code, args.password)

    # ---- 1. platforma: verificare idempotenta + creare companie
    try:
        ptoken = api.request("POST", "/api/platform/auth/login", {"email": pa_email, "password": pa_pass})["accessToken"]
        companies = api.request("GET", "/api/platform/companies", token=ptoken)
    except ApiError as e:
        die("autentificare/listare platforma esuata: %s" % e)
    if any(c["code"] == args.code for c in companies):
        log("Compania '%s' exista deja: nu se modifica nimic." % args.code)
        return
    admin_email = "admin@" + domain
    api.request("POST", "/api/platform/companies", {"name": args.name, "code": args.code,
                                                    "adminEmail": admin_email, "adminPassword": args.password},
                token=ptoken)
    log("[1/9] Companie creata: %s (cod %s)" % (args.name, args.code))
    A = admin_email

    def call(method, path, body=None):
        return sess.call(A, method, path, body)

    roles = {r["name"]: r["id"] for r in call("GET", "/api/roles")}

    # ---- 2. departamente, posturi
    dept_ids, pos_ids = {}, {}
    for name, parent in DEPARTMENTS:
        r = call("POST", "/api/departments", {"name": name, "parentId": dept_ids.get(parent)})
        dept_ids[name] = r["id"]
    for name in POSITIONS:
        pos_ids[name] = call("POST", "/api/positions", {"name": name})["id"]
    log("[2/9] %d departamente, %d posturi" % (len(dept_ids), len(pos_ids)))

    # ---- 3. angajati, manageri, conturi
    real_name = ("Sergiu", "Chelemen")
    emps = build_org(rng, real_name)
    pick_hire_dates(rng, emps)
    if not args.real_user_email:
        # fara utilizator real: angajatul HR Manager ramane, cu nume fictiv
        real = next(e for e in emps if e.get("real"))
        real["first"], real["last"] = "Anca", "Rotaru"
        real["email"] = "anca.rotaru@" + domain
    for e in emps:
        r = call("POST", "/api/employees", {
            "firstName": e["first"], "lastName": e["last"], "workEmail": e["email"],
            "positionId": pos_ids[e["pos"]], "departmentId": dept_ids[e["dept"]], "hireDate": e["hire"].isoformat()})
        e["id"] = r["id"]
    for e in emps:
        e["mgr_id"] = emps[e["mgr"]]["id"] if e["mgr"] is not None else None
        if e["mgr"] is not None:
            call("PUT", "/api/employees/%s/manager" % e["id"], {"managerId": e["mgr_id"]})
    log("[3/9] %d angajati, ierarhie de manageri setata" % len(emps))

    failures = 0
    for e in emps:
        pwd = args.password
        email = e["email"]
        if e.get("real") and args.real_user_email:
            email = args.real_user_email.strip().lower()
            pwd = args.real_user_password or args.password
            sess.passwords[email] = pwd
        try:
            u = call("POST", "/api/users", {"email": email, "password": pwd, "roleIds": [roles[e["role"]]]})
            e["user_id"], e["login"] = u["id"], email
            call("PUT", "/api/employees/%s/account" % e["id"], {"userId": u["id"]})
        except ApiError as ex:
            failures += 1
            log("  ! cont/legare esuata pentru un angajat: %s" % ex)
    admin_user_id = next(u["id"] for u in call("GET", "/api/users") if u["email"] == A)
    by_role = {}
    for e in emps:
        by_role[e["role"]] = by_role.get(e["role"], 0) + 1
    log("[4/9] Conturi create si legate: %d (%s)%s" % (
        len(emps) - failures, ", ".join("%s=%d" % kv for kv in sorted(by_role.items())),
        "; erori: %d" % failures if failures else ""))
    emps = [e for e in emps if "user_id" in e]
    idx_by_id = {e["id"]: e for e in emps}

    # ---- 5. solduri de concediu
    holidays = [dt.date.fromisoformat(x) for x in
                infra.psql("select holiday_date from public_holiday order by 1;").split()]
    cal = Calendar(holidays)
    for e in emps:
        h = e["hire"]
        base = rng.randint(21, 25)
        if h.year < 2026:
            e["ent26"], e["car26"] = base, rng.randint(0, 5)
        else:
            e["ent26"], e["car26"] = max(4, round(base * (13 - h.month) / 12)), 0
        if h.year < 2025:
            e["ent25"], e["car25"] = rng.randint(21, 25), rng.randint(0, 3)
        elif h.year == 2025:
            e["ent25"], e["car25"] = max(4, round(base * (13 - h.month) / 12)), 0
        else:
            e["ent25"] = None
        call("PUT", "/api/employees/%s/leave-balances/2026" % e["id"],
             {"entitledDays": e["ent26"], "carriedOverDays": e["car26"]})
        if e["ent25"] is not None:
            call("PUT", "/api/employees/%s/leave-balances/2025" % e["id"],
                 {"entitledDays": e["ent25"], "carriedOverDays": e["car25"]})
    log("[5/9] Solduri 2026 (si 2025) setate")

    # ---- 6. concedii: istoric prin SQL, viitor prin API
    year = TODAY.year
    days, weights = day_weights(cal, year)
    segs = {e["id"]: [] for e in emps}
    base_wd = cal.on_or_after(TODAY)
    movable = [e for e in emps if e["mgr"] is not None and e["hire"] < TODAY - dt.timedelta(days=120)]
    rng.shuffle(movable)
    cur_emps, fut_ok, fut_pend, fut_rej = movable[:5], movable[5:10], movable[10:16], movable[16:19]
    current_cfg = [(-4, 6), (-3, 5), (-2, 3), (-1, 4), (0, 3)]
    for e, (off, n) in zip(cur_emps, current_cfg):
        s = cal.shift(base_wd, off)
        segs[e["id"]].append((s, cal.shift(s, n - 1), n, "ODIHNA"))
    cutoff = TODAY - dt.timedelta(days=1)
    for e in emps:
        total = e["ent26"] + e["car26"]
        already = sum(n for _, _, n, k in segs[e["id"]] if k == "ODIHNA")
        target = int(total * rng.uniform(0.3, 0.85) * (cutoff.timetuple().tm_yday / 300))
        target = max(0, min(target, total - 9) - already) if rng.random() > 0.04 else 0
        extra = []
        if rng.random() < 0.15:
            extra.append(("MEDICAL", 3))
        if rng.random() < 0.04:
            extra.append(("FARA_PLATA", 5))
        if rng.random() < 0.06:
            extra.append(("EVENIMENT_SPECIAL", 3))
        window = max(dt.date(year, 1, 1), e["hire"] + dt.timedelta(days=14))
        if e["id"] in {x["id"] for x in cur_emps}:
            extra = []
        gen_history(rng, cal, days, weights, window, cutoff, target, segs[e["id"]], extra)

    sql_rows, used = [], {}
    for e in emps:
        mgr = idx_by_id.get(e["mgr_id"]) if e.get("mgr_id") else None
        decider = mgr["user_id"] if mgr else admin_user_id
        for s, en, n, kind in segs[e["id"]]:
            created = min(dt.datetime.combine(s - dt.timedelta(days=rng.randint(7, 25)), dt.time(9, 0),
                                              tzinfo=dt.timezone.utc), NOW - dt.timedelta(hours=3))
            decided = min(created + dt.timedelta(hours=rng.randint(2, 40)), NOW - dt.timedelta(hours=1))
            if cal.wdays(s, en) != n:
                continue
            sql_rows.append("(gen_random_uuid(),'%s','%s','%s','%s','%s',%d,'APPROVED','%s','%s','%s','%s')" % (
                "%CID%", e["id"], kind, s, en, n, created.isoformat(), decider, decided.isoformat(), e["user_id"]))
            if kind == "ODIHNA":
                used[e["id"]] = used.get(e["id"], 0) + n
    for r in sql_rows:
        for tok in re.findall(r"'([0-9a-f-]{36})'", r):
            uuid.UUID(tok)
    carry_sql = ",".join("('%s'::uuid,%d)" % (e["id"], e["ent25"] + e["car25"] - e["car26"])
                         for e in emps if e["ent25"] is not None and e["ent25"] + e["car25"] - e["car26"] >= 0)
    used_sql = ",".join("('%s'::uuid,%d)" % (i, n) for i, n in used.items())
    values = ",\n".join(r.replace("'%CID%'", "(select id from cid)") + "" for r in sql_rows)
    sql = ("begin;\n"
           "create temp table cid as select id from company where code='%s';\n"
           "insert into leave_request (id, company_id, employee_id, type, start_date, end_date, working_days, status,"
           " created_at, decided_by_user_id, decided_at, requested_by_user_id) values\n%s;\n"
           "update leave_balance b set used_days = v.u from (values %s) as v(e,u) "
           "where b.employee_id = v.e and b.year = %d;\n"
           "update leave_balance b set used_days = v.u from (values %s) as v(e,u) "
           "where b.employee_id = v.e and b.year = 2025;\n"
           "commit;\n") % (args.code, values, used_sql or "(null::uuid,0)", year, carry_sql or "(null::uuid,0)")
    infra.psql(sql)
    approved_ranges = {e["id"]: [(s, en) for s, en, _, _ in segs[e["id"]]] for e in emps}
    log("[6/9] Concedii istorice: %d cereri aprobate (SQL), %d zile de odihna folosite" % (
        len(sql_rows), sum(used.values())))

    # concedii viitoare prin API (cont angajat, aprobare de manager)
    def future_request(e, off, n, note=None):
        s = cal.shift(base_wd, off)
        en = cal.shift(s, n - 1)
        r = sess.call(e["login"], "POST", "/api/leave-requests",
                      {"type": "ODIHNA", "startDate": s.isoformat(), "endDate": en.isoformat(), "note": note})
        return r["id"], s, en

    def approver(e):
        m = idx_by_id.get(e.get("mgr_id"))
        return m["login"] if m else A

    ok_cfg = [(3, 3), (5, 2), (7, 4), (8, 3), (10, 5)]
    pend_cfg = [(14, 3), (18, 5), (22, 4), (25, 2), (30, 5), (35, 3)]
    rej_cfg = [(12, 4), (16, 3), (27, 5)]
    reasons = ["Perioadă aglomerată în proiect, vă rugăm să reprogramați.",
               "Echipa nu poate fi acoperită în intervalul cerut.",
               "Solicitare depusă prea aproape de data începerii."]
    counts = {"approved": 0, "pending": 0, "rejected": 0, "errors": 0}
    for e, (off, n) in zip(fut_ok, ok_cfg):
        try:
            rid, s, en = future_request(e, off, n)
            sess.call(approver(e), "POST", "/api/leave-requests/%s/approve" % rid)
            approved_ranges[e["id"]].append((s, en))
            counts["approved"] += 1
        except ApiError as ex:
            counts["errors"] += 1
            log("  ! concediu viitor (aprobare): %s" % ex)
    for e, (off, n) in zip(fut_pend, pend_cfg):
        try:
            future_request(e, off, n)
            counts["pending"] += 1
        except ApiError as ex:
            counts["errors"] += 1
            log("  ! concediu viitor (in asteptare): %s" % ex)
    for e, (off, n), why in zip(fut_rej, rej_cfg, reasons):
        try:
            rid, _, _ = future_request(e, off, n)
            sess.call(approver(e), "POST", "/api/leave-requests/%s/reject" % rid, {"reason": why})
            counts["rejected"] += 1
        except ApiError as ex:
            counts["errors"] += 1
            log("  ! concediu viitor (respins): %s" % ex)
    log("      Concedii prin API: %(approved)d aprobate, %(pending)d in asteptare, %(rejected)d respinse, "
        "%(errors)d erori" % counts)

    # ---- 7. pontaj (MongoDB)
    log("[7/9] Pontaj: se genereaza documentele...")
    months = []
    m = dt.date(TODAY.year, TODAY.month, 1)
    for _ in range(4):
        months.append(m)
        m = (m - dt.timedelta(days=1)).replace(day=1)
    months.reverse()  # 3 luni complete + luna curenta
    cur_month = months[-1]
    sloppy = {e["id"] for e in rng.sample(emps, 8)}
    empty_ts = {e["id"] for e in rng.sample([x for x in emps if x["tier"] == "staff"], 4)}
    submitted_pool = [e for e in emps if e["mgr"] is not None and e["id"] not in empty_ts]
    submitted = {e["id"] for e in rng.sample(submitted_pool, 14)}
    entry_rows, period_rows = [], []
    for e in emps:
        if e["id"] in empty_ts:
            continue
        remote = rng.choices([0.0, 0.2, 0.5], [50, 30, 20])[0]
        if e["dept"] in ("Dezvoltare", "Date", "Infrastructură"):
            remote = min(0.6, remote + 0.2)
        omit = 0.2 if e["id"] in sloppy else 0.02
        blocked = approved_ranges[e["id"]]
        decider = (idx_by_id.get(e.get("mgr_id")) or {"user_id": admin_user_id})["user_id"]
        for ms in months:
            worked, last = 0, 0
            d = ms
            while d.month == ms.month and d <= TODAY:
                if cal.is_wd(d) and d >= e["hire"] and not any(a <= d <= b for a, b in blocked) \
                        and rng.random() > omit:
                    r = rng.random()
                    if r < 0.006:
                        typ, mins = "ABSENT", 0
                    elif r < 0.006 + remote * 0.4:
                        typ, mins = "TELEMUNCA", rng.choice([420, 450, 480, 480, 510])
                    else:
                        typ, mins = "LUCRAT", rng.choice([420, 450, 480, 480, 480, 510, 540])
                    entry_rows.append([e["id"], e["user_id"], d.isoformat(), mins, typ])
                    if typ != "ABSENT":
                        worked += mins
                    last += 1
                d += dt.timedelta(days=1)
            if ms == cur_month or last == 0:
                continue
            month_key = ms.strftime("%Y-%m")
            end_of_month = (ms.replace(day=28) + dt.timedelta(days=4)).replace(day=1)
            submitted_at = dt.datetime.combine(end_of_month, dt.time(10, 0), tzinfo=dt.timezone.utc)
            if ms == months[-2] and e["id"] in submitted:
                period_rows.append([e["id"], month_key, "SUBMITTED", submitted_at.isoformat(), None, None, None])
            else:
                period_rows.append([e["id"], month_key, "APPROVED", submitted_at.isoformat(), decider,
                                    (submitted_at + dt.timedelta(days=1 + rng.randint(0, 3))).isoformat(), worked])
    js = """
const cid = UUID("%(cid)s");
const rows = %(rows)s;
const periods = %(periods)s;
const col = db.getCollection("timesheet_entries");
for (let i = 0; i < rows.length; i += 1000) {
  col.insertMany(rows.slice(i, i + 1000).map(r => ({
    _class: "ro.smarthr.timesheet.TimesheetEntry", companyId: cid, employeeId: UUID(r[0]),
    date: r[2], minutes: NumberInt(r[3]), type: r[4], updatedAt: new Date(r[2] + "T17:00:00Z"),
    updatedByUserId: UUID(r[1])})), {ordered: false});
}
db.getCollection("timesheet_periods").insertMany(periods.map(p => {
  const d = {_class: "ro.smarthr.timesheet.TimesheetPeriod", companyId: cid, employeeId: UUID(p[0]), month: p[1],
    status: p[2], submittedAt: new Date(p[3])};
  if (p[2] === "APPROVED") { d.decidedByUserId = UUID(p[4]); d.decidedAt = new Date(p[5]); d.approvedMinutes = NumberInt(p[6]); }
  return d;
}), {ordered: false});
print("entries=" + col.countDocuments({companyId: cid}) + " periods=" + db.getCollection("timesheet_periods").countDocuments({companyId: cid}));
"""
    company_id = infra.psql("select id from company where code='%s';" % args.code).strip()
    uuid.UUID(company_id)
    out = infra.mongo(js % {"cid": company_id, "rows": json.dumps(entry_rows, separators=(",", ":")),
                            "periods": json.dumps(period_rows, separators=(",", ":"))})
    log("      Mongo: %s" % out.strip())

    # ---- 8. evaluari
    def scores(q, lo, hi, centre, criteria):
        return {k: max(lo, min(hi, int(round(centre + q + rng.gauss(0, 0.7))))) for k in criteria}

    criteria = [{"key": "calitate", "name": "Calitatea muncii", "weight": 40},
                {"key": "colaborare", "name": "Colaborare", "weight": 30},
                {"key": "initiativa", "name": "Inițiativă", "weight": 30}]
    keys = [c["key"] for c in criteria]
    quality = {e["id"]: rng.gauss(0, 0.6) for e in emps}
    managers = [e for e in emps if e["role"] != "EMPLOYEE" and any(x.get("mgr_id") == e["id"] for x in emps)]

    def mgr_comment(sc):
        avg = sum(sc.values()) / len(sc)
        return rng.choice(MGR_COMMENTS["low" if avg < 3 else "mid" if avg < 4.2 else "high"])

    def run_cycle(name, start, end, p_self, p_mgr, close):
        cyc = call("POST", "/api/evaluation-cycles", {"name": name, "startDate": start, "endDate": end,
                                                      "criteria": criteria})
        call("POST", "/api/evaluation-cycles/%s/open" % cyc["id"])
        n_self = n_mgr = 0
        for e in emps:
            if e["mgr"] is None or rng.random() > p_self:
                continue
            try:
                mine = sess.call(e["login"], "GET", "/api/evaluations/me")
                ev = next(x for x in mine if x["cycle"]["id"] == cyc["id"])
                sess.call(e["login"], "POST", "/api/evaluations/%s/self-review" % ev["id"], {
                    "scores": scores(quality[e["id"]], 3, 5, 4.0, keys), "comment": rng.choice(SELF_COMMENTS)})
                n_self += 1
            except (ApiError, StopIteration) as ex:
                log("  ! autoevaluare: %s" % ex)
        for m_ in managers:
            try:
                team = sess.call(m_["login"], "GET", "/api/evaluations/team?cycleId=%s&size=100" % cyc["id"])
            except ApiError as ex:
                log("  ! lista echipa: %s" % ex)
                continue
            for row in team["items"]:
                if rng.random() > p_mgr:
                    continue
                emp_id = row["employee"]["id"]
                sc = scores(quality.get(emp_id, 0), 2, 5, 3.6, keys)
                try:
                    sess.call(m_["login"], "POST", "/api/evaluations/%s/manager-review" % row["id"],
                              {"scores": sc, "comment": mgr_comment(sc)})
                    n_mgr += 1
                except ApiError as ex:
                    log("  ! evaluare manager: %s" % ex)
        if close:
            call("POST", "/api/evaluation-cycles/%s/close" % cyc["id"])
        log("      %s: %d autoevaluari, %d evaluari manager%s" % (name, n_self, n_mgr, ", inchis" if close else ", deschis"))

    run_cycle("Evaluare anuală 2025", "2025-01-01", "2025-12-31", 1.0, 1.0, True)
    run_cycle("Evaluare semestrială 2026", "2026-01-01", "2026-06-30", 0.6, 0.3, False)
    log("[8/9] Evaluari create")

    # ---- 9. documente
    n_docs = 0
    for title, desc, cat, vis, fname, paragraphs in DOCUMENTS:
        text = (title + "\n\n" + "\n\n".join(paragraphs) + "\n").encode("utf-8")
        meta = json.dumps({"title": title, "description": desc, "category": cat, "visibility": vis}).encode("utf-8")
        try:
            sess.multipart(A, "/api/documents", [("file", fname, "text/plain", text),
                                                 ("meta", None, "application/json", meta)])
            n_docs += 1
        except ApiError as ex:
            log("  ! document: %s" % ex)
    log("[9/9] Documente: %d" % n_docs)
    log("Gata. Cont HR_ADMIN: admin@%s (parola din --password)." % domain)


if __name__ == "__main__":
    main()
