-- 프로필 열 권한 (2026-10-16 보안 점검).
--
-- 0001 의 "본인 프로필 수정" 정책은 행 전체를 열어 둔다. 그래서 로그인한 사용자가 브라우저에서
-- anon key 와 자기 토큰으로 `update profiles set is_admin = true, plan = 'max'` 를 할 수 있었다 —
-- 운영 집계 함수(is_admin())를 통과하고 유료 요금제를 공짜로 얻는다.
--
-- 앱은 프로필을 사용자 권한으로 직접 고치지 않는다. 탈퇴 요청·철회는 security definer 함수,
-- 가입은 트리거, 요금제·운영자 플래그는 서버(서비스 롤)가 바꾼다. 그래서 사용자에게는
-- 이름·프로필 사진 두 열만 연다(0006 의 cuts.layer_tree 와 같은 방식).

revoke update on public.profiles from anon, authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
