-- 001_init.down.sql: reverses 001_init.sql.
-- Drops the set_updated_at triggers, the set_updated_at() function, and the
-- stock_movements, medicines, users, diseases, and hospitals tables in reverse
-- dependency order. Drops nothing else.
--
-- How to run: in pgAdmin, connect to the Medicast database, open the Query Tool,
-- paste this file, and execute it. Everything runs in a single transaction, so
-- a failure leaves the database unchanged. Plain DROP statements are used (no
-- IF EXISTS), so re-running fails loudly.

begin;

drop trigger medicines_set_updated_at on medicines;
drop trigger users_set_updated_at on users;
drop trigger hospitals_set_updated_at on hospitals;

drop function set_updated_at();

drop table stock_movements;
drop table medicines;
drop table users;
drop table diseases;
drop table hospitals;

commit;
