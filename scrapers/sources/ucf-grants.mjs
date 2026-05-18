// УКФ надає гранти переважно організаціям, але деякі програми
// мають індивідуальний трек для молодих митців/студентів до 35 р.
// Ті, що релевантні дітям 0-18, виділені нижче.

export const name = 'УКФ — гранти та стипендії для молоді';

const PROGRAMS = [
  {
    title: 'Стипендії УКФ для молодих митців',
    summary: 'Щорічні стипендії Українського культурного фонду для молодих митців і культурних діячів. Підтримка творчих проєктів у сферах музики, театру, образотворчого мистецтва, літератури, кіно.',
    age_from: 14,
    age_to: 17,
    opportunity_type: 'scholarship',
    cost_type: 'free',
    source_url: 'https://ucf.in.ua/programs/stipendiyi',
  },
  {
    title: 'УКФ — Сучасний музичний простір: підтримка молодих артистів',
    summary: 'Грантова програма УКФ для молодих виконавців і колективів. Лот "Молоді артисти" — підтримка стартапу музичної кар\'єри, запис альбому, перші концерти.',
    age_from: 14,
    age_to: 17,
    opportunity_type: 'grant',
    cost_type: 'free',
    source_url: 'https://ucf.in.ua/programs/suchasniy-muzichniy-prostir',
  },
  {
    title: 'УКФ — Мистецтво в кадрі: підтримка дитячого та молодіжного кіно',
    summary: 'Гранти УКФ на створення аудіовізуального контенту, зокрема для дитячої та молодіжної аудиторії. Фінансування передвиробництва та виробництва фільмів.',
    age_from: 14,
    age_to: 17,
    opportunity_type: 'grant',
    cost_type: 'free',
    source_url: 'https://ucf.in.ua/programs/mistectvo-v-kadri',
  },
];

export function scrape() {
  return PROGRAMS.map((p) => ({
    ...p,
    categories: ['art', 'culture'],
    child_needs: [],
    format: 'Онлайн (заявка)',
    deadline: null,
    source: 'Український культурний фонд',
  }));
}
