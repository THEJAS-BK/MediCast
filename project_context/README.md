# MediCast Project Context: dataProcessing, Backend, and Frontend

This document explains how the data-processing pipeline works, how the backend works, how the frontend consumes the backend, and exactly which data-processing output the backend uses.

## 1. Repository overview

```text
MediCast/
├── dataProcessing/     # Offline data cleaning, modelling, and model export
├── backend/            # FastAPI application
├── frontend/           # React web UI (section 4)
└── project_context/    # This documentation
```

The important boundary is:

- `dataProcessing/` produces the trained dengue model and the latest rainfall table.
- Both JSON files are copied into `backend/`.
- The backend loads the copied files at startup and never runs pandas or scikit-learn.

---

## 2. dataProcessing

`dataProcessing/` contains the raw source data, notebooks for cleaning and training, and generated data/model files.

For a deeper, task-oriented guide — how to run each notebook, add new dengue or rainfall data, retrain, and publish artifacts to the backend — see [`dataProcessing_README.md`](dataProcessing_README.md). This section remains the concise reference for what the pipeline produces.

To add a second disease (for example TB) to the pipeline and backend, see [`add_disease_README.md`](add_disease_README.md).

### 2.1 Folder contents

```text
dataProcessing/
├── original/
│   ├── Final_data.csv
│   ├── daily-rainfall-data-district-level.csv
│   └── 2026_district_wise_rain_data.csv
├── processed/
│   └── Final_data_filtered.csv        # legacy notebook output
├── data_used/
│   ├── dengue_monthly.csv             # cleaned monthly training table
│   ├── dengue_model.json              # trained model export
│   └── rain_latest.json               # latest state-month rainfall
├── one.ipynb                          # existing exploratory/legacy notebook
├── prepare_dengue_data.ipynb          # dengue/rain training-data preparation
├── train_dengue_model.ipynb           # model training notebook
└── prepare_rain_latest.ipynb          # latest 2026 rainfall preparation
```

The current pipeline writes its outputs to `data_used/`. The `processed/` folder contains the older `Final_data_filtered.csv` and is not used by the backend.

### 2.2 Raw data

1. `original/Final_data.csv`
   - Dengue and other disease case records.
   - Columns include `state_ut`, `district`, `Disease`, `Cases`, `Deaths`, `day`, `mon`, `year`, latitude/longitude, and environmental fields.
   - The pipeline keeps only rows where `Disease == "Dengue"`.

2. `original/daily-rainfall-data-district-level.csv`
   - Daily district-level rainfall.
   - Columns include `date`, `state_name`, `district_name`, `actual`, `normal`, and `deviation`.
   - The pipeline keeps only `date`, `state_name`, `actual`, and `normal`.

3. `original/2026_district_wise_rain_data.csv`
   - Daily district-level rainfall for 2026.
   - Columns include `State`, `District`, `Date`, `Daily Actual`, and `Daily Normal`, plus weekly, cumulative, and monthly summaries that are ignored.
   - The latest-rainfall notebook keeps only the state, district, date, daily actual, and daily normal columns.

### 2.3 `prepare_dengue_data.ipynb`

This notebook builds `data_used/dengue_monthly.csv`.

Processing steps:

1. Load the dengue file, drop the unnamed index column, and keep only `Disease == "Dengue"`.
2. Convert `Cases` to numeric and drop invalid values such as `3/1`.
3. Normalize state and district names:
   - trim whitespace
   - lowercase
   - replace `&` with `and`
   - apply the shared name mapping
4. Drop exact duplicate rows.
5. Collapse repeated outbreak reports:
   - rows with the same state, district, day, month, and year are treated as one outbreak
   - keep the row with the highest `Cases`
6. Aggregate dengue cases by state and month (`YYYY-MM`).
7. Load rainfall data and drop rows missing `actual` or `normal`.
8. Aggregate rainfall by state and month.
9. Attach the previous month's rainfall (`M - 1`) to each state-month row.
10. Inner-join dengue and rainfall on state and month.
11. Save the final monthly table.

Output:

```text
dataProcessing/data_used/dengue_monthly.csv
```

Current output shape and coverage:

- 700 rows
- 32 state names
- 152 distinct months
- Month range: `2009-07` through `2022-06`

Columns:

| Column | Meaning |
|---|---|
| `state` | Normalized state name |
| `month` | Month in `YYYY-MM` format |
| `cases` | Total reported dengue cases for that state-month |
| `rain_prev_actual` | Previous month's total actual rainfall |
| `rain_prev_normal` | Previous month's total normal rainfall |
| `rain_prev_departure` | Previous month's rainfall departure from normal |

The notebook does not fill missing state-month combinations with zero. Months without a dengue report are absent.

### 2.4 `train_dengue_model.ipynb`

This notebook reads `data_used/dengue_monthly.csv` and produces `data_used/dengue_model.json`.

Model design:

1. Drop rows missing `cases` or `rain_prev_departure`.
2. Add `year`, `month_num`, and `log_cases = log1p(cases)`.
3. Split by time:
   - training: year `<= 2019`
   - testing: year `> 2019`
   - current split: 618 training rows and 82 test rows
4. Build a seasonal baseline using training data only:
   - mean `log_cases` for each `(state, month_num)`
   - fallback to the mean for that month across all states
   - final fallback to the overall training mean
5. Fit a weather adjustment on training residuals:
   - target: `log_cases` minus the baseline prediction
   - feature: `rain_prev_departure` clipped to `[-1, 2]`
   - model: scikit-learn `LinearRegression`
6. Compare the baseline and weather-adjusted predictions on the test set.

Current test errors:

| Method | MAE on log cases | MAE on cases |
|---|---:|---:|
| Seasonal baseline | 1.2598 | 146.43 |
| Baseline + weather adjustment | 1.2573 | 146.25 |

The saved model is plain JSON. It contains:

- `seasonal_table`: list of `{state, month_num, mean_log_cases}` entries
- `month_fallback`: month-level fallback means
- `overall_mean`: overall training mean of `log_cases`
- `slope`: weather regression slope
- `intercept`: weather regression intercept
- `clip_bounds`: `[-1.0, 2.0]`
- `train_end_year`: `2019`
- `test_errors`: MAE values for both methods

No backend code is imported or executed by these notebooks.

### 2.5 `prepare_rain_latest.ipynb`

This notebook builds `data_used/rain_latest.json` from the 2026 district-level rainfall file.

Processing steps:

1. Load the raw 2026 CSV and print all column names.
2. Match the needed columns case-insensitively: state, district, date, daily actual, and daily normal.
3. Ignore weekly, cumulative, and month-to-date columns.
4. Normalize state names with the same helper and mapping used by the dengue preparation notebook.
5. Convert rainfall values to numeric and remove duplicates.
6. Aggregate by state and month:
   - `actual_sum`
   - `normal_sum`
   - `days_present`
   - `districts`
   - `departure`
   - `is_complete`
7. Save the state-month records as JSON.

Current output:

- 152 state-month records
- Month range: `2026-08` through `2026-11`
- Latest month present: `2026-11`
- Completeness is based on `days_present == days_in_month`

Only complete state-months are used for the backend's automatic rainfall lookup.

---

## 3. Backend

The backend is a FastAPI application under `backend/src/app/`. Hand-run SQL migrations for the PostgreSQL database live under `backend/migrations/` (see section 3.8).

### 3.1 Structure

```text
backend/src/app/
├── main.py                    # FastAPI app setup and router registration
├── schemas.py                 # Pydantic request/response models
├── store.py                   # In-memory inventory
├── data/
│   ├── dengue_model.json      # Copy of the trained model
│   └── rain_latest.json       # Copy of the latest rainfall table
├── routers/
│   ├── inventory.py           # Inventory endpoints
│   └── calculate.py           # /api/calculate endpoint
└── services/
    ├── index.py               # Calculation dispatcher
    ├── dengue_data.py         # Dengue model loading and prediction logic
    └── helpers/
        └── rain.py            # Latest rainfall lookup
```

### 3.2 Which dataProcessing outputs are used?

The backend uses two data-processing artifacts:

```text
dataProcessing/data_used/dengue_model.json
        |
        | copied to
        v
backend/src/app/data/dengue_model.json

dataProcessing/data_used/rain_latest.json
        |
        | copied to
        v
backend/src/app/data/rain_latest.json
```

The backend does **not** read the raw CSV files or `dengue_monthly.csv` at runtime. It only reads the copied JSON files.

The copies exist so the backend is self-contained and does not need access to `dataProcessing/` when deployed.

Dengue model fields actively used by the backend:

| Field | Use |
|---|---|
| `seasonal_table` | Look up the state-month baseline |
| `month_fallback` | Fallback when a state-month pair is missing |
| `overall_mean` | Final fallback when the month is also missing |
| `slope` | Weather adjustment |
| `intercept` | Weather adjustment |
| `clip_bounds` | Clamp rainfall departure before adjustment |

The fields `train_end_year` and `test_errors` are stored in the model JSON but are not needed for backend predictions.

Rainfall fields used by the backend:

| Field | Use |
|---|---|
| `state` | State lookup key after name normalization |
| `month` | Month lookup key (`YYYY-MM`) |
| `departure` | Previous-month rainfall departure |
| `is_complete` | Only complete months are allowed as lookup results |

The other rainfall fields (`actual_sum`, `normal_sum`, `days_present`, `districts`) are available in the JSON but are not needed by the current calculation.

### 3.3 Model and rainfall loading

`backend/src/app/services/dengue_data.py` loads the model once at module import time:

```python
MODEL_PATH = Path(__file__).resolve().parent.parent / "data" / "dengue_model.json"

with MODEL_PATH.open(encoding="utf-8") as model_file:
    _DENGUE_MODEL = json.load(model_file)
```

The model is then converted into in-memory lookup structures:

- `_SEASONAL`: `(state, month_num) -> mean_log_cases`
- `_MONTH_FALLBACK`: `month_num -> mean_log_cases`
- `_OVERALL_MEAN`
- `_SLOPE`
- `_INTERCEPT`
- `_CLIP_MIN`, `_CLIP_MAX`

The backend uses only Python's standard library for this: `json`, `math`, and `pathlib`. It does not use pandas or scikit-learn.

Rainfall is loaded the same way in `backend/src/app/services/helpers/rain.py`:

```python
RAIN_PATH = Path(__file__).resolve().parent.parent.parent / "data" / "rain_latest.json"

with RAIN_PATH.open(encoding="utf-8") as rain_file:
    _RAIN_ROWS = json.load(rain_file)
```

The rows are indexed once as `(state, month) -> row`. The helper `get_rain_prev_departure(state, year, month)`:

1. Normalizes the state with `normalize_state` imported from `dengue_data.py`.
2. Computes the previous month, wrapping January to December of the previous year.
3. Looks up the `(state, previous_month)` row.
4. Returns `departure` only when the row exists, `is_complete` is true, and `departure` is not null; otherwise it returns `None`.

### 3.4 `calculate_dengue` logic

`calculate_dengue` is a pure keyword-only function in `services/dengue_data.py`.

Inputs:

```python
calculate_dengue(
    *,
    current_stock,
    yearly_sales,
    days,
    state,
    month,
    rain_prev_departure,
)
```

Calculation steps:

1. Normalize `state`:
   - trim and lowercase
   - replace `&` with `and`
   - collapse whitespace
   - apply the same name mapping used by the preparation notebook
2. Find the baseline `log_cases` for the requested state and month:
   - `state_month` if present
   - otherwise the month-level fallback
   - otherwise the overall mean
3. Convert the baseline to the case scale with `expm1`.
4. Compute the annual mean from the twelve monthly baseline values.
5. If `rain_prev_departure` is provided:
   - clip it to the stored bounds
   - add `intercept + slope * clipped_departure` to the baseline log value
   - convert back with `expm1`
6. Compute:

```text
seasonal_factor = requested_month_value / annual_mean
seasonal_factor = clamp(seasonal_factor, 0.25, 4.0)

daily_average = yearly_sales / 365
expected_daily_use = daily_average * seasonal_factor
target_stock = ceil(expected_daily_use * days)
shortfall = max(0, target_stock - current_stock)
```

7. Set status:
   - `"Order needed"` when `shortfall > 0`
   - `"Stock sufficient"` otherwise

The function returns:

```json
{
  "daily_average": 10.0,
  "seasonal_factor": 1.0115,
  "expected_daily_use": 10.115,
  "target_stock": 304,
  "shortfall": 274,
  "status": "Order needed",
  "baseline_source": "state_month",
  "adjustment_applied": true,
  "capped": false
}
```

### 3.5 Request and response schemas

`schemas.py` defines:

- `CalculationRequest`
  - `medicine`
  - `current_stock`
  - `yearly_sales`
  - `days`
  - optional `state`
  - optional `month` (`1`-`12`)
  - optional `rain_prev_departure`

- `CalculationResult`
  - `status`
  - optional numeric fields returned by the dengue calculation
  - optional `baseline_source`, `adjustment_applied`, and `capped`

### 3.6 `/api/calculate` route

The route in `routers/calculate.py`:

1. Determines the requested month, using the current calendar month when `month` is omitted.
2. If `rain_prev_departure` is not supplied and `state` is present, calls `get_rain_prev_departure(state, current_year, month)` to fill it automatically.
3. Calls the dispatcher in `services/index.py`.
4. For `medicine == "Dengue medicines"`, the dispatcher calls `calculate_dengue` and returns the dengue result.
5. For any other medicine, it returns exactly `{"status": "received"}` as before.

An explicit `rain_prev_departure` from the request always wins over the automatic lookup.

Example request with automatic rainfall lookup:

```json
{
  "medicine": "Dengue medicines",
  "current_stock": 30,
  "yearly_sales": 3650,
  "days": 30,
  "state": "Tamil Nadu",
  "month": 7
}
```

Example response:

```json
{
  "status": "Order needed",
  "daily_average": 10.0,
  "seasonal_factor": 1.0115193544711978,
  "expected_daily_use": 10.115193544711978,
  "target_stock": 304,
  "shortfall": 274,
  "baseline_source": "state_month",
  "adjustment_applied": true,
  "capped": false
}
```

### 3.7 Inventory endpoints

Inventory endpoints are unchanged and use in-memory storage in `store.py`:

- `GET /api/inventory`
- `POST /api/medicines`
- `POST /api/inventory`

The inventory resets when the backend restarts. Dengue calculations read `current_stock` from the request body; they do not read inventory storage directly.

### 3.8 Database migrations

The project's PostgreSQL database (`Medicast`) already exists and is managed in pgAdmin. `backend/migrations/` contains plain SQL migrations that are run by hand from pgAdmin's Query Tool. The backend has no migration runner and no database connection code, so the application does not read these tables yet.

```text
backend/migrations/
├── 001_init.sql          # Initial schema: tables, indexes, seeds, updated_at triggers
└── 001_init.down.sql     # Reverses 001_init.sql
```

`001_init.sql` creates, in order:

| Table | Purpose |
|---|---|
| `hospitals` | Hospitals with `state`, optional `district`, and a unique `join_code` |
| `diseases` | Disease reference table, seeded with `dengue` and `tb` |
| `users` | Hospital staff with roles (`admin`/`staff`) and unique lowercased emails |
| `medicines` | Per-hospital medicine stock lines; names unique per hospital ignoring case and outer spaces |
| `stock_movements` | Append-only stock audit log (`old_quantity`, `new_quantity`, `change`, `reason`) |

Details:

- All foreign keys use `on delete restrict`.
- Case-insensitive uniqueness uses indexes on `lower(...)`; medicine names per hospital use `lower(btrim(name))`.
- All timestamps are `timestamptz` with `now()` defaults.
- `stock_movements` has no `updated_at` column because rows are append-only; its `change` column is constrained to equal `new_quantity - old_quantity`.
- A single `set_updated_at()` plpgsql function with `before update` triggers keeps `updated_at` current on `hospitals`, `users`, and `medicines`.
- Only `dengue` and `tb` are seeded; no hospitals, users, or medicines are inserted.

`001_init.down.sql` drops the three triggers, the function, and the five tables in reverse dependency order (`stock_movements`, `medicines`, `users`, `diseases`, `hospitals`). It drops nothing else.

Both files wrap everything in a single transaction (`begin`/`commit`) and use plain `create table`/`drop` without `if not exists`/`if exists`, so running a file twice fails loudly instead of silently skipping.

How to run:

1. In pgAdmin, connect to the server and click the `Medicast` database in the tree to select it.
2. Right-click the database and open **Query Tool**.
3. Open `backend/migrations/001_init.sql` with the Query Tool's file-open button (or paste its contents) and execute (F5).
4. Verify with `select * from diseases;` — it should return the two seeded rows.
5. To undo everything, run `backend/migrations/001_init.down.sql` the same way.

The same files can also be applied from the command line with `psql -d Medicast -f backend/migrations/001_init.sql`.

dbmate (v2.35.0) is installed locally but is not used: these files do not follow dbmate's `<version>_<name>.up.sql` naming, no `DATABASE_URL` is configured, and dbmate would add its own `schema_migrations` tracking table. pgAdmin remains the intended workflow.

---

## 4. Frontend

The frontend is a React + Vite + TypeScript application under `frontend/src/`. It is a thin client: it reads inventory data, posts calculation requests, and renders the returned metrics. It contains no model or rainfall logic of its own. Authentication and organization management are local-only dummy state (section 4.6).

### 4.1 Structure

```text
frontend/src/
├── api/
│   └── inventory.ts         # Typed fetch client for all backend endpoints
├── components/
│   ├── NavBar.tsx           # Shared nav bar and profile dropdown
│   └── MedicineCard.tsx     # Stock card used by the dashboard
├── context/
│   ├── auth.ts              # Auth context, user/organization/member types
│   ├── AuthProvider.tsx     # Dummy auth, members, and localStorage persistence
│   └── useAuth.ts           # Context hook
├── pages/
│   ├── LandingPage.tsx      # Public hero page
│   ├── LoginPage.tsx        # Login form
│   ├── SignupPage.tsx       # Signup form
│   ├── OrganizationPage.tsx # Create or join an organization
│   ├── OrganizationInfoPage.tsx # Read-only organization and member view
│   ├── DashboardPage.tsx    # Current stock levels (GET /api/inventory)
│   ├── InventoryPage.tsx    # Add medicines and stock (POST /api/medicines, POST /api/inventory)
│   ├── CalculatorPage.tsx   # Calculation form and result card
│   ├── ProfilePage.tsx      # Dummy profile details
│   └── AdminPage.tsx        # Admin member management
├── medicines.ts             # Static medicine list ("TB medicines", "Dengue medicines")
├── App.tsx                  # Routes, guards, and authenticated layout
└── main.tsx                 # Entry point and AuthProvider wrapper
```

### 4.2 API client

All HTTP calls go through `frontend/src/api/inventory.ts`:

| Function | Endpoint | Use |
|---|---|---|
| `getInventory()` | `GET /api/inventory` | Medicine list and stock levels |
| `addMedicine()` | `POST /api/medicines` | Register a new medicine |
| `addInventory()` | `POST /api/inventory` | Add stock for a medicine |
| `sendCalculation()` | `POST /api/calculate` | Submit a calculation |

The client uses a single `request()` helper. The backend base URL comes from the `VITE_API_BASE_URL` environment variable and defaults to `http://localhost:8000` (see `frontend/.env.example`).

The `CalculationResponse` type mirrors the backend's `CalculationResult`. Every field except `status` is optional because non-dengue medicines return only a status.

### 4.3 Calculator flow

`CalculatorPage` works as follows:

1. On mount, it loads the medicine list with `getInventory()` and fills the medicine dropdown.
2. The form collects:
   - medicine (dropdown)
   - current stock (whole number, 0 or greater)
   - average sold per year (positive whole number)
   - days of stock to cover (positive whole number, defaults to 30)
3. Inputs are validated client-side before submitting.
4. On submit, it posts only `medicine`, `current_stock`, `yearly_sales`, and `days` to `POST /api/calculate`.
5. The result card shows:
   - a status badge (green for `Stock sufficient`, amber otherwise)
   - target stock, shortfall, daily average, expected daily use, and seasonal factor
   - the baseline source with underscores replaced by spaces
   - a `Rainfall adjustment: applied/not applied` badge
   - a `Capped` badge when the seasonal factor was clamped
6. For non-dengue medicines, the backend returns only `{"status": "received"}`; the card then shows a plain "Request received" message with no calculation details.

### 4.4 Current limitation

The UI does not send `state`, `month`, or `rain_prev_departure`. Dengue calculations made from the web UI therefore:

- use the current calendar month (the backend defaults `month` to today's month),
- run without a state, so the baseline comes from the month-level fallback rather than a state-month entry,
- never apply the rainfall adjustment (`adjustment_applied` is always `false`).

State-aware baselines and the automatic rainfall lookup only take effect on direct API calls that include a `state`.

### 4.5 CORS

The backend enables `CORSMiddleware` in `main.py` with `allow_origins=["*"]`, so the Vite dev server (default `http://localhost:5173`) can call the API directly without a proxy.

### 4.6 Authentication and organization flow (frontend only)

Authentication is a frontend-only simulation. There is no backend auth, token, cookie, or password verification. Any input that passes the client-side checks succeeds.

Routes and access rules:

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page with Login and Sign Up buttons |
| `/login` | Public | Email and password form |
| `/signup` | Public | Name, email, and password form |
| `/organization` | Logged in | Choose Create Organization or Join Organization; NavBar is visible |
| `/dashboard` | Logged in + organization | Existing dashboard page |
| `/inventory` | Logged in + organization | Existing inventory page |
| `/calculator` | Logged in + organization | Existing calculator page |
| `/profile` | Logged in + organization | Dummy name, email, organization, and role |
| `/organization-info` | Logged in + organization | Read-only organization details and member list |
| `/admin` | Logged in + organization + admin role | Admin member management |

Guards live in `App.tsx`:

- `RequireAuth` redirects unauthenticated users to `/login`.
- `AuthLayout` renders the shared NavBar and page container for every authenticated route, including `/organization`.
- `RequireOrganization` redirects logged-in users without an organization to `/organization` for all organization-dependent pages.
- `AdminOnly` redirects non-admins from `/admin` to `/dashboard`.

The existing Dashboard, Inventory, and Calculator pages are unchanged; `AuthLayout` only wraps them with the shared NavBar and page container.

Client-side validation:

- Login requires a non-empty email and password.
- Signup requires a non-empty name, a non-empty email, and a password.
- Email must match a basic `name@domain.tld` pattern.
- Password must be at least 8 characters.
- Adding a member requires a non-empty name and a valid email.

Auth state shape:

```ts
{
  user: { name: string; email: string } | null
  organization: { name: string; code: string } | null
  role: 'admin' | 'member' | null
  members: Array<{
    id: string
    name: string
    email: string
    role: 'admin' | 'member'
  }>
}
```

The state is persisted in `localStorage` under the key `medicast.auth` and is read when the app starts, so a refresh does not log the user out or lose member changes.

Flow details:

1. Login and signup set the dummy user, clear any previous organization/role/members, and navigate to `/organization`.
2. Create Organization asks for a name, generates a code such as `ORG-4X7K2`, stores the organization, sets the current user's role to `admin`, seeds the members list with the current admin plus four dummy members, and shows the code before the user continues to `/dashboard`.
3. Join Organization asks for a code. Any non-empty code is accepted; it is uppercased, stored as the organization code with the name `Organization <CODE>`, and the current user is added with the `member` role. The seeded member list includes one dummy admin plus three dummy members.
4. The members list is stored in the same auth context and persisted with the rest of the state. Member changes are local only; no invites or emails are sent.
5. Logout is available from the NavBar profile dropdown, removes the stored auth state, and navigates to `/`.
6. The NavBar shows links to Dashboard, Inventory, and Calculate, highlights the active link, and opens a profile dropdown with Profile, Organization, Admin Panel (admins only), and Logout. The dropdown closes on an outside click or Escape.
7. The admin panel shows the organization name and code, a members table, and an Add Member form. Removal requires a browser confirm, and the current admin's own Remove button is disabled. New members are added with the `member` role.
8. `/organization-info` is read-only for all roles. Members see a Leave Organization button that clears the organization, role, and members list and redirects to `/organization`; admins do not see this button.

---

## 5. End-to-end data flow

```text
Raw dengue CSV ----------------------+
                                     |
                                     v
                          prepare_dengue_data.ipynb
                                     |
                                     v
                       data_used/dengue_monthly.csv
                                     |
Raw daily rainfall CSV -------------+
                                     |
                                     v
                          train_dengue_model.ipynb
                                     |
                                     v
                         data_used/dengue_model.json
                                     |
                                     | manual copy
                                     v
                    backend/src/app/data/dengue_model.json
                                     |
                                     | loaded once at import
                                     v
                  backend/src/app/services/dengue_data.py
                                     |
                                     v
                        POST /api/calculate
                (request from CalculatorPage)
                                     |
                                     v
                       JSON calculation result
                                     |
                                     v
                   CalculatorPage result card


Raw 2026 rainfall CSV
        |
        v
prepare_rain_latest.ipynb
        |
        v
data_used/rain_latest.json
        |
        | manual copy
        v
backend/src/app/data/rain_latest.json
        |
        | loaded once at import
        v
backend/src/app/services/helpers/rain.py
        |
        v
POST /api/calculate
        |
        v
JSON result rendered in CalculatorPage
```

In short:

- `dataProcessing/` is the offline data and training pipeline.
- The interfaces between data processing and the backend are the dengue model JSON and the latest rainfall JSON.
- The backend performs lightweight lookups and arithmetic, with no data science libraries or runtime access to the raw data.
- The rainfall lookup fills `rain_prev_departure` automatically when a state is provided and the request does not supply it.
- The frontend is a thin client: it reads inventory, posts calculation requests, and renders the returned metrics, with no model or rainfall logic of its own.
- `backend/migrations/` contains hand-run SQL migrations that prepare the PostgreSQL `Medicast` database (pgAdmin); the backend does not connect to it yet, and inventory still lives in the in-memory store.
