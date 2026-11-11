-- 001_init.sql: initial schema for the Medicast PostgreSQL database.
-- Creates the hospitals, diseases, users, medicines, and stock_movements tables
-- with their indexes and checks, seeds the two diseases, and installs the
-- set_updated_at() function with BEFORE UPDATE triggers on hospitals, users,
-- and medicines. Inserts no hospitals, users, or medicines.
--
-- How to run: in pgAdmin, connect to the Medicast database, open the Query Tool,
-- paste this file, and execute it. Everything runs in a single transaction, so
-- a failure leaves the database unchanged. Plain CREATE TABLE is used (no
-- IF NOT EXISTS), so re-running against a migrated database fails loudly.

begin;

create table hospitals (
    id integer generated always as identity primary key,
    name text not null,
    state text not null,
    district text,
    join_code text not null unique,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table diseases (
    id integer generated always as identity primary key,
    name text not null
);

create unique index diseases_name_lower_unique_idx on diseases (lower(name));

insert into diseases (name)
values ('dengue'), ('tb');

create table users (
    id integer generated always as identity primary key,
    hospital_id integer not null references hospitals (id) on delete restrict,
    name text not null,
    email text not null,
    password_hash text not null,
    role text not null default 'staff' constraint users_role_check check (role in ('admin', 'staff')),
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index users_email_lower_unique_idx on users (lower(email));
create index users_hospital_id_idx on users (hospital_id);

create table medicines (
    id integer generated always as identity primary key,
    hospital_id integer not null references hospitals (id) on delete restrict,
    name text not null,
    disease_id integer references diseases (id) on delete restrict,
    unit text,
    quantity integer not null default 0 constraint medicines_quantity_check check (quantity >= 0),
    reorder_level integer constraint medicines_reorder_level_check check (reorder_level >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index medicines_hospital_name_lower_unique_idx
    on medicines (hospital_id, lower(btrim(name)));
create index medicines_disease_id_idx on medicines (disease_id);

create table stock_movements (
    id bigint generated always as identity primary key,
    medicine_id integer not null references medicines (id) on delete restrict,
    user_id integer not null references users (id) on delete restrict,
    old_quantity integer not null constraint stock_movements_old_quantity_check check (old_quantity >= 0),
    new_quantity integer not null constraint stock_movements_new_quantity_check check (new_quantity >= 0),
    change integer not null constraint stock_movements_change_check check (change = new_quantity - old_quantity),
    reason text not null constraint stock_movements_reason_check check (reason in ('add', 'set', 'correction')),
    created_at timestamptz not null default now()
);

create index stock_movements_medicine_id_created_at_idx
    on stock_movements (medicine_id, created_at desc);

create function set_updated_at() returns trigger
language plpgsql
as
$$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger hospitals_set_updated_at
    before update
    on hospitals
    for each row
    execute function set_updated_at();

create trigger users_set_updated_at
    before update
    on users
    for each row
    execute function set_updated_at();

create trigger medicines_set_updated_at
    before update
    on medicines
    for each row
    execute function set_updated_at();

commit;
