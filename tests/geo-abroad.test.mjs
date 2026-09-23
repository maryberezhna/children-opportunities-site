import test from 'node:test';
import assert from 'node:assert/strict';
import { goesAbroad, placeLabel } from '../lib/geo.js';

/**
 * 23.09.2026, Марія про картку English Club: «написано в описі у Києві, а ти
 * ставиш лейбл за кордоном». Підпис рахувався з прапорця is_international,
 * який модель ставила за «учасники з різних країн» (американці в гостях), і
 * прапорець перебивав місто. У базі таких записів було сім — серед них
 * вокальна школа в Києві й гурток боксу в Запоріжжі.
 */
const kyivClub = {
  cities: ['Київ'], countries: ['ua'], is_international: true, format: 'offline',
};

test('місто в Україні перебиває прапорець «міжнародна»', () => {
  assert.equal(goesAbroad(kyivClub), false);
  assert.equal(placeLabel(kyivClub), 'Київ');
});

test('справжня поїздка за кордон лишається за кордоном', () => {
  // Країна не наша — вирішує вона, а не місто.
  assert.equal(goesAbroad({ cities: ['Закопане'], countries: ['pl'], is_international: true }), true);
  // Країни немає взагалі: Erasmus, UWC, міжнародні олімпіади.
  assert.equal(goesAbroad({ cities: [], countries: [], is_international: true, format: 'offline' }), true);
  // «Вся Україна» — не місто: Європейський корпус солідарності возить у ЄС.
  assert.equal(goesAbroad({ cities: ['Вся Україна'], countries: ['ua'], is_international: true, format: 'offline' }), true);
});

test('онлайн нікого нікуди не везе', () => {
  assert.equal(goesAbroad({ cities: ['Онлайн'], countries: [], is_international: true, format: 'online' }), false);
});

test('звичайний гурток без прапорця не змінився', () => {
  const club = { cities: ['Запоріжжя'], countries: ['ua'], is_international: false, format: 'offline' };
  assert.equal(goesAbroad(club), false);
  assert.equal(placeLabel(club), 'Запоріжжя');
});
