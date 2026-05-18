// МОН повертає 403 на всі запити → використовуємо статичні дані.
// Дедлайни оновлюються щороку; тут зазначено орієнтовний кінець шкільного
// тура (лютий/березень), конкретна дата береться з наказу МОН.

export const name = 'МОН — предметні олімпіади';

const BASE_URL = 'https://mon.gov.ua/osvita-2/zagalna-serednya-osvita/olimpiadi-ta-konkursi/olimpiadi/vseukrayinski-olimpiadi';

const SUBJECTS = [
  { nom: 'Математика',                    gen: 'математики',                        age_from: 12, age_to: 17, grades: '7–11 кл.' },
  { nom: 'Фізика',                         gen: 'фізики',                             age_from: 13, age_to: 17, grades: '8–11 кл.' },
  { nom: 'Хімія',                          gen: 'хімії',                              age_from: 13, age_to: 17, grades: '8–11 кл.' },
  { nom: 'Біологія',                       gen: 'біології',                           age_from: 12, age_to: 17, grades: '7–11 кл.' },
  { nom: 'Інформатика',                    gen: 'інформатики',                        age_from: 12, age_to: 17, grades: '7–11 кл.' },
  { nom: 'Географія',                      gen: 'географії',                          age_from: 13, age_to: 17, grades: '8–11 кл.' },
  { nom: 'Астрономія',                     gen: 'астрономії',                         age_from: 15, age_to: 17, grades: '10–11 кл.' },
  { nom: 'Українська мова та література',  gen: 'української мови та літератури',     age_from: 12, age_to: 17, grades: '7–11 кл.' },
  { nom: 'Англійська мова',                gen: 'англійської мови',                   age_from: 13, age_to: 17, grades: '8–11 кл.' },
  { nom: 'Французька мова',                gen: 'французької мови',                   age_from: 13, age_to: 17, grades: '8–11 кл.' },
  { nom: 'Німецька мова',                  gen: 'німецької мови',                     age_from: 13, age_to: 17, grades: '8–11 кл.' },
  { nom: 'Іспанська мова',                 gen: 'іспанської мови',                    age_from: 13, age_to: 17, grades: '8–11 кл.' },
  { nom: 'Польська мова',                  gen: 'польської мови',                     age_from: 13, age_to: 17, grades: '8–11 кл.' },
  { nom: 'Економіка',                      gen: 'економіки',                          age_from: 13, age_to: 17, grades: '8–11 кл.' },
  { nom: 'Правознавство',                  gen: 'правознавства',                      age_from: 14, age_to: 17, grades: '9–11 кл.' },
  { nom: 'Екологія',                       gen: 'екології',                           age_from: 12, age_to: 17, grades: '7–11 кл.' },
  { nom: 'Трудове навчання та технології', gen: 'трудового навчання та технологій',   age_from: 10, age_to: 17, grades: '5–11 кл.' },
  { nom: 'Історія України',                gen: 'історії України',                    age_from: 13, age_to: 17, grades: '8–11 кл.' },
];

export function scrape() {
  return SUBJECTS.map(({ nom, gen, age_from, age_to, grades }) => ({
    title: `Всеукраїнська олімпіада з ${gen}`,
    summary: `Щорічна Всеукраїнська учнівська олімпіада з ${gen} для учнів ${grades}. Проводиться у чотири тури: шкільний, районний/міський, обласний, заключний. Організатор — МОН України.`,
    age_from,
    age_to,
    opportunity_type: 'olympiad',
    categories: ['academic'],
    child_needs: [],
    format: 'Офлайн (за регіонами)',
    cost_type: 'free',
    deadline: null,
    source_url: `${BASE_URL}#${nom.toLowerCase().replace(/\s+/g, '-').replace(/[^a-zа-яіїє-]/gi, '')}`,
    source: 'МОН України',
  }));
}
