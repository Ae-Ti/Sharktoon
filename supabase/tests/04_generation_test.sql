\set ON_ERROR_STOP on
-- 생성 테이블(마이그레이션 0006): 소유자만 보이고, 워커가 쓰는 열은 사용자가 못 고친다.

insert into auth.users (id, email) values
  ('33333333-3333-3333-3333-333333333333', 'g@a.b'),
  ('44444444-4444-4444-4444-444444444444', 'h@a.b');

-- 사용자 A 가 회차와 콘티를 만든다.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
insert into series (owner_id, title) values (auth.uid(), '생성 테스트') returning id as sid \gset
insert into episodes (series_id, owner_id, number, story)
values (:'sid', auth.uid(), 1, '퇴근길 이야기') returning id as eid \gset
insert into storyboards (episode_id, owner_id, data) values (:'eid', auth.uid(), '{"cuts":[]}');
insert into post_packages (episode_id, owner_id, captions, hashtags, first_comment)
values (:'eid', auth.uid(), '{}', '{}', '첫 댓글');

-- 사용자는 잡·컷을 직접 만들 수 없다. 워커 몫이다.
do $$
begin
  insert into generation_jobs (id, owner_id, episode_id, mode)
  values ('job-x', auth.uid(), (select id from episodes limit 1), 'agent');
  raise exception '사용자가 잡을 만들었다';
exception when insufficient_privilege then
  raise notice '1. 사용자 잡 생성 차단 OK';
end;
$$;
do $$
begin
  insert into cuts (episode_id, cut_id, owner_id, index, image_path)
  values ((select id from episodes limit 1), 'c1', auth.uid(), 1, 'someone/else.png');
  raise exception '사용자가 컷을 만들었다';
exception when insufficient_privilege then
  raise notice '2. 사용자 컷 생성 차단 OK';
end;
$$;

-- 워커(서비스 롤)가 잡과 컷을 쓴다.
reset role;
set role service_role;
insert into generation_jobs (id, owner_id, episode_id, mode, status)
values ('job-1', '33333333-3333-3333-3333-333333333333', :'eid', 'agent', 'succeeded');
insert into cuts (episode_id, cut_id, owner_id, index, image_path)
values (:'eid', 'c1', '33333333-3333-3333-3333-333333333333', 1,
        '33333333-3333-3333-3333-333333333333/' || :'eid' || '/c1.png');
reset role;

-- 사용자 A: 레이어는 고칠 수 있고, 이미지 경로는 못 고친다.
set request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
set role authenticated;
update cuts set layer_tree = '{"layers":[]}' where cut_id = 'c1';
do $$
begin
  update cuts set image_path = '44444444-4444-4444-4444-444444444444/x.png' where cut_id = 'c1';
  raise exception '사용자가 이미지 경로를 바꿨다';
exception when insufficient_privilege then
  raise notice '3. 이미지 경로 변경 차단 OK';
end;
$$;
do $$
begin
  if (select count(*) from generation_jobs) <> 1 or (select count(*) from cuts) <> 1
     or (select layer_tree from cuts) is null then
    raise exception '본인 잡·컷·레이어가 안 보인다';
  end if;
  raise notice '4. 본인 데이터 조회 OK';
end;
$$;

-- 사용자 B: 아무것도 안 보이고, 남의 레이어를 못 고친다.
reset role;
set request.jwt.claim.sub = '44444444-4444-4444-4444-444444444444';
set role authenticated;
do $$
declare
  n integer;
begin
  if (select count(*) from storyboards) + (select count(*) from generation_jobs)
     + (select count(*) from cuts) + (select count(*) from post_packages) <> 0 then
    raise exception '남의 생성 데이터가 보인다';
  end if;
  update cuts set layer_tree = '{"hacked":true}' where cut_id = 'c1';
  get diagnostics n = row_count;
  if n <> 0 then
    raise exception '남의 레이어를 고쳤다';
  end if;
  raise notice '5. 다른 사용자 차단 OK';
end;
$$;
reset role;
