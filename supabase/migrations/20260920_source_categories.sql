-- Сезонність обходу не діяла на шести живих джерелах — 20.09.2026.
--
-- Множник частоти (category_seasons) множиться на категорії джерела. У шести
-- увімкнених джерел масив categories був порожній, тож пік «вересень–листопад
-- ×3» для обмінів і олімпіад їх не торкався взагалі: FLEX, UWC, Eurodesk і
-- Ukraine Global Scholars обходились із тією самою частотою в липні й у
-- вересні, коли й відкриваються набори.
--
-- Вимкнені скрапери гуртків лишаються без категорій свідомо: їх не обходять.
update sources set categories = '{mizhnarodni,osvita}'
where name in ('America House Kyiv (americahousekyiv.org)',
               'American Councils Ukraine (americancouncils.org.ua)',
               'Ukraine Global Scholars (ugs.foundation)',
               'UWC Ukraine (ukraine.uwc.org)')
  and (categories is null or categories = '{}');

update sources set categories = '{mizhnarodni,volonterstvo}'
where name = 'Eurodesk' and (categories is null or categories = '{}');

update sources set categories = '{talanty,osvita}'
where name = 'Фонд Президента України (presidentfund.gov.ua)'
  and (categories is null or categories = '{}');
