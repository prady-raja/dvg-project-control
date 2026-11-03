-- Row-level security checks. Run by scripts/test-supabase-rls.sh against a scratch database.
-- Each check raises on failure; psql runs with ON_ERROR_STOP.
\set ON_ERROR_STOP on
\set admin    '11111111-1111-1111-1111-111111111111'
\set editor_a '22222222-2222-2222-2222-222222222222'
\set viewer_a '33333333-3333-3333-3333-333333333333'
\set outsider '44444444-4444-4444-4444-444444444444'

insert into public."user"(id, role) values (:'admin','admin'), (:'editor_a','user'), (:'viewer_a','user'), (:'outsider','user');
insert into public.project(id, name, code) values ('pA','Project A','A'), ('pB','Project B','B');
insert into public.project_membership(id, user_id, project_id, role, active) values
  ('m1', :'editor_a', 'pA', 'Project Editor', true),
  ('m2', :'viewer_a', 'pA', 'Viewer', true),
  ('m3', :'outsider', 'pA', 'Project Editor', false);
insert into public.task(id, task_ref, project_id, discipline, name) values ('tA','A-1','pA','CIVIL','Task in A'), ('tB','B-1','pB','CIVIL','Task in B');
insert into public.contractor(id, name) values ('c1','Contractor');

create schema if not exists t;
create or replace function t.as_user(uid text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid, false);
  execute 'set role authenticated';
end $$;

create or replace function t.count_of(q text) returns bigint language plpgsql as $$
declare n bigint; begin execute 'select count(*) from (' || q || ') s' into n; return n; end $$;

create or replace function t.expect(label text, got anyelement, want anyelement) returns void language plpgsql as $$
begin
  if got is distinct from want then raise exception 'FAIL %: got %, want %', label, got, want; end if;
  raise notice 'ok   %', label;
end $$;

-- Writes that must be refused: returns true when RLS stopped it.
create or replace function t.refused(stmt text) returns boolean language plpgsql as $$
declare n bigint;
begin
  execute stmt; get diagnostics n = row_count; return n = 0;
exception when insufficient_privilege then return true;
end $$;

grant usage on schema t to authenticated;
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema t to authenticated;

-- Editor on project A
select t.as_user(:'editor_a');
select t.expect('editor reads own project task', t.count_of($$select 1 from public.task where id='tA'$$), 1::bigint);
select t.expect('editor cannot read other project task', t.count_of($$select 1 from public.task where id='tB'$$), 0::bigint);
select t.expect('editor sees only own project', t.count_of($$select 1 from public.project$$), 1::bigint);
select t.expect('editor reads open contractor list', t.count_of($$select 1 from public.contractor$$), 1::bigint);
select t.expect('editor rank on A is 2', public.app_rank('pA'), 2);
select t.expect('editor rank on B is -1', public.app_rank('pB'), -1);
select t.expect('editor cannot write task directly (server-only)', t.refused($$update public.task set name='x' where id='tA'$$), true);
select t.expect('editor cannot insert task directly', t.refused($$insert into public.task(id,task_ref,project_id,discipline,name) values ('tX','A-2','pA','CIVIL','x')$$), true);
select t.expect('editor cannot delete task', t.refused($$delete from public.task where id='tA'$$), true);
select t.expect('editor cannot edit contractors', t.refused($$update public.contractor set name='x'$$), true);
select t.expect('editor cannot add a membership', t.refused($$insert into public.project_membership(id,user_id,project_id,role) values ('mx','z','pA','Viewer')$$), true);
select t.expect('editor cannot make themselves admin', t.refused($$update public."user" set role='admin'$$), true);
select t.expect('editor cannot read ai_usage', t.count_of($$select 1 from public.ai_usage$$), 0::bigint);
select t.expect('anyone signed in may log a client error', t.refused($$insert into public.client_error(id,message) values ('e1','boom')$$), false);
select t.expect('but cannot read client errors back', t.count_of($$select 1 from public.client_error$$), 0::bigint);

-- Viewer on project A
reset role;
select t.as_user(:'viewer_a');
select t.expect('viewer reads project task', t.count_of($$select 1 from public.task where id='tA'$$), 1::bigint);
select t.expect('viewer rank is 0', public.app_rank('pA'), 0);
select t.expect('viewer cannot write', t.refused($$update public.task set name='x'$$), true);

-- Inactive membership
reset role;
select t.as_user(:'outsider');
select t.expect('inactive member reads nothing', t.count_of($$select 1 from public.task$$), 0::bigint);
select t.expect('inactive member rank is -1', public.app_rank('pA'), -1);

-- Signed out
reset role;
select set_config('request.jwt.claim.sub', '', false);
set role authenticated;
select t.expect('no identity reads nothing', t.count_of($$select 1 from public.task$$), 0::bigint);

-- App admin
reset role;
select t.as_user(:'admin');
select t.expect('admin reads every task', t.count_of($$select 1 from public.task$$), 2::bigint);
select t.expect('admin rank is 4', public.app_rank('pB'), 4);
select t.expect('admin can edit contractors', t.refused($$update public.contractor set name='y'$$), false);
select t.expect('admin can add a membership', t.refused($$insert into public.project_membership(id,user_id,project_id,role) values ('m9','z','pB','Viewer')$$), false);
select t.expect('admin still cannot write task directly', t.refused($$update public.task set name='x' where id='tA'$$), true);
select t.expect('admin reads client errors', t.count_of($$select 1 from public.client_error$$), 1::bigint);
reset role;
\echo ALL RLS CHECKS PASSED
