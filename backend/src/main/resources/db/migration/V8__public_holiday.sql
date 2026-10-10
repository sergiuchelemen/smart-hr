-- Sărbători legale nelucrătoare (global, nu e tenant-scoped), folosite la calculul zilelor lucrătoare.
-- ATENȚIE: lista trebuie verificată cu legislația în vigoare și extinsă pentru anii următori;
-- (1 iunie 2026 coincide cu a doua zi de Rusalii: un singur rând, cheia e data.)
-- fără sărbători pentru un an, cererile de concediu din acel an sunt refuzate (calendar indisponibil).

CREATE TABLE public_holiday (
    holiday_date DATE PRIMARY KEY,
    name         VARCHAR(100) NOT NULL
);

INSERT INTO public_holiday (holiday_date, name) VALUES
    ('2026-01-01', 'Anul Nou'),
    ('2026-01-02', 'Anul Nou (a doua zi)'),
    ('2026-01-06', 'Boboteaza'),
    ('2026-01-07', 'Sfântul Ioan Botezătorul'),
    ('2026-01-24', 'Ziua Unirii Principatelor Române'),
    ('2026-04-10', 'Vinerea Mare'),
    ('2026-04-12', 'Paștele ortodox'),
    ('2026-04-13', 'Paștele ortodox (a doua zi)'),
    ('2026-05-01', 'Ziua Muncii'),
    ('2026-05-31', 'Rusaliile'),
    ('2026-06-01', 'Rusaliile (a doua zi) și Ziua Copilului'),
    ('2026-08-15', 'Adormirea Maicii Domnului'),
    ('2026-11-30', 'Sfântul Andrei'),
    ('2026-12-01', 'Ziua Națională a României'),
    ('2026-12-25', 'Crăciunul'),
    ('2026-12-26', 'Crăciunul (a doua zi)'),
    ('2027-01-01', 'Anul Nou'),
    ('2027-01-02', 'Anul Nou (a doua zi)'),
    ('2027-01-06', 'Boboteaza'),
    ('2027-01-07', 'Sfântul Ioan Botezătorul'),
    ('2027-01-24', 'Ziua Unirii Principatelor Române'),
    ('2027-04-30', 'Vinerea Mare'),
    ('2027-05-01', 'Ziua Muncii'),
    ('2027-05-02', 'Paștele ortodox'),
    ('2027-05-03', 'Paștele ortodox (a doua zi)'),
    ('2027-06-01', 'Ziua Copilului'),
    ('2027-06-20', 'Rusaliile'),
    ('2027-06-21', 'Rusaliile (a doua zi)'),
    ('2027-08-15', 'Adormirea Maicii Domnului'),
    ('2027-11-30', 'Sfântul Andrei'),
    ('2027-12-01', 'Ziua Națională a României'),
    ('2027-12-25', 'Crăciunul'),
    ('2027-12-26', 'Crăciunul (a doua zi)');
