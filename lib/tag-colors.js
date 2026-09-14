// Кольори чипа типу (bg / текст) — палітра референсу редизайну, ключі —
// наші opportunity_type. Все, чого немає в мапі, отримує кремовий.
//
// Живе окремо від OpportunitiesList: той файл клієнтський ('use client'), і
// серверна сторінка можливості отримала б звідти не обʼєкт, а клієнтську
// заглушку.
export const TAG_COLORS = {
  club: ['#fde8c7', '#8a5a0a'], internship: ['#fde8c7', '#8a5a0a'],
  course: ['#fef7e0', '#8a5a0a'], workshop: ['#fef7e0', '#8a5a0a'],
  camp: ['#e8f4f2', '#0a5348'], hackathon: ['#e8f4f2', '#0a5348'],
  summer_school: ['#e8f4f2', '#0a5348'],
  olympiad: ['#ede8f8', '#4c3d8c'], exchange: ['#ede8f8', '#4c3d8c'],
  study_program: ['#ede8f8', '#4c3d8c'],
  competition: ['#fde8ef', '#8a1a3a'], volunteer: ['#fde8ef', '#8a1a3a'],
  festival: ['#fde8ef', '#8a1a3a'], sport_tournament: ['#fde8ef', '#8a1a3a'],
  allowance: ['#e4f2d6', '#2d5814'], support_payment: ['#e4f2d6', '#2d5814'],
  medical_aid: ['#e4f2d6', '#2d5814'], scholarship: ['#e4f2d6', '#2d5814'],
  grant: ['#e4f2d6', '#2d5814'], humanitarian: ['#e4f2d6', '#2d5814'],
};

export const TAG_FALLBACK = ['#f7f1e6', '#4a4a4a'];
