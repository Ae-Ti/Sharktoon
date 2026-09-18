\set ON_ERROR_STOP on
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;

insert into series (owner_id, title) values (auth.uid(), '직장 상사 빌런') returning id as sid \gset
insert into series_rules (series_id, tone) values (:'sid', '반말 · 자조적');
insert into assets (owner_id, kind, name, tags)
values (auth.uid(), 'character', '나 (기본)', array['안경','곱슬머리']) returning id as aid \gset
insert into series_assets (series_id, asset_id) values (:'sid', :'aid');
insert into episodes (series_id, owner_id, number, title, status)
values (:'sid', auth.uid(), 1, '내 아이디어', 'published') returning id as eid \gset
insert into asset_references (episode_id, asset_id) values (:'eid', :'aid');

select 'A. 본인 데이터' as step,
  (select count(*) from series) s, (select count(*) from assets) a,
  (select count(*) from episodes) e, (select count(*) from asset_references) r;

-- 에셋을 바꿨을 때 영향받는 회차 조회 (PRD 2.1)
select 'B. 영향 회차' as step, e.number, e.title
from asset_references ar join episodes e on e.id = ar.episode_id
where ar.asset_id = :'aid';

-- 다른 사용자로 전환: 비공개 시리즈는 안 보인다
reset role;
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select 'C. 남의 비공개' as step, count(*) as 보이는_시리즈 from series;

-- 공개로 돌리면 시리즈와 게시된 회차만 보인다
reset role;
update series set is_public = true where id = :'sid';
set request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';
set role authenticated;
select 'D. 공개 후' as step,
  (select count(*) from series) as 시리즈,
  (select count(*) from episodes) as 회차,
  (select count(*) from assets) as 남의_에셋;

-- 남의 시리즈는 수정할 수 없다
do $$
begin
  update series set title = '탈취' where title = '직장 상사 빌런';
  if found then raise exception '남의 시리즈가 수정되었다'; end if;
  raise notice 'E. 남의 시리즈 수정 차단 OK';
end $$;

-- 태그는 5개까지
reset role;
set request.jwt.claim.sub = '11111111-1111-1111-1111-111111111111';
set role authenticated;
do $$
begin
  insert into assets (owner_id, kind, name, tags)
  values (auth.uid(), 'character', '과다태그', array['a','b','c','d','e','f']);
  raise exception '막히지 않았다';
exception when check_violation then
  raise notice 'F. 태그 5개 초과 차단 OK';
end $$;
