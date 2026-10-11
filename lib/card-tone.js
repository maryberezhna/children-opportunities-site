// Колір смуги вгорі картки в двох колонках на телефоні (11.10.2026, Марія
// обрала «Кольорову шапку»). Тип можливостей — понад тридцять, кольорів
// пігулок — шість, тож тон дає не сам тип, а його родина: поруч стоять
// конкурс і олімпіада одного кольору, грант і стипендія — іншого. Самі
// кольори — у cards.css (.card[data-tone]), лише наявні токени, тож нічний
// режим підхоплює їх сам.

const TONES = {
  compete: ['olympiad', 'competition', 'hackathon', 'sport_tournament', 'award', 'sport_event'],
  money: ['grant', 'scholarship', 'allowance', 'support_payment'],
  learn: ['course', 'workshop', 'summer_school', 'study_program', 'mentorship', 'club', 'educational_material', 'study_abroad'],
  event: ['camp', 'festival', 'excursion', 'volunteer', 'conference'],
  grow: ['exchange', 'residency', 'internship'],
  aid: ['medical_aid', 'psychology', 'rehabilitation', 'humanitarian', 'legal_aid', 'shelter'],
};

const BY_TYPE = Object.fromEntries(
  Object.entries(TONES).flatMap(([tone, types]) => types.map((t) => [t, tone])),
);

/** Родина типу для data-tone; невідомий тип — 'learn', найнейтральніший тон. */
export function cardTone(type) {
  return BY_TYPE[type] || 'learn';
}

export const CARD_TONES = Object.keys(TONES);
