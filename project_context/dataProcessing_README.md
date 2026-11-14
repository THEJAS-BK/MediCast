# Data Processing Guide

This guide is for anyone on the team who needs to understand, run, or extend the offline data pipeline in `dataProcessing/`. It covers what each notebook does, what it produces, how those products reach the backend, and how to add new data.

If you only need the high-level project overview, read `project_context/README.md`. This document goes deeper into the data pipeline itself.

---

## 1. What the pipeline achieves

The pipeline turns raw disease and rainfall CSVs into two small JSON files that the FastAPI backend loads at startup:

```text
raw dengue CSVs ─┐
                 ├─► dengue_monthly.csv ─► dengue_model.json ─┐
raw rainfall CSVs┘                                            ├─► copied into backend/src/app/data/
                                                              │
2026 rainfall CSV ─────────────────────► rain_latest.json ───┘
```

In plain terms:

1. **Clean and merge historical data.** Dengue case records and daily rainfall are normalized, deduplicated, aggregated to state-month level, and joined so each dengue month carries the *previous* month's rainfall.
2. **Train a small forecasting model.** For each state and calendar month, learn an average dengue level (seasonal baseline), then learn a small rainfall adjustment on top of it.
3. **Prepare the latest rainfall lookup.** Turn the newest daily rainfall CSV into a state-month table the backend can query automatically.
4. **Export plain JSON.** The backend uses only Python's standard library at runtime — no pandas or scikit-learn.

The pipeline is entirely offline. Nothing here runs inside the deployed backend.

### Outputs at a glance (current state)

| Output | Built by | Size | Used by |
|---|---|---|---|
| `data_used/dengue_monthly.csv` | `prepare_dengue_data.ipynb` | 700 rows, 32 states, 152 months (`2009-07` → `2022-06`) | Training notebook only |
| `data_used/dengue_model.json` | `train_dengue_model.ipynb` | 197 seasonal rows + rainfall coefficients | Backend dengue calculation |
| `data_used/rain_latest.json` | `prepare_rain_latest.ipynb` | 152 state-month records, 38 states, `2026-08` → `2026-11` | Backend automatic rainfall lookup |

---

## 2. Folder layout

```text
dataProcessing/
├── original/                                  # Raw inputs — do not edit outputs here
│   ├── Final_data.csv                         # Historical dengue/disease case records
│   ├── daily-rainfall-data-district-level.csv # Historical daily district rainfall
│   └── 2026_district_wise_rain_data.csv       # Latest daily district rainfall
├── data_used/                                 # Current pipeline outputs
│   ├── dengue_monthly.csv
│   ├── dengue_model.json
│   └── rain_latest.json
├── processed/
│   └── Final_data_filtered.csv                # Legacy output, not used
├── prepare_dengue_data.ipynb                  # Stage 1
├── train_dengue_model.ipynb                   # Stage 2
├── prepare_rain_latest.ipynb                  # Stage 3
└── one.ipynb                                  # Legacy exploratory notebook
```

### Current vs legacy

- **Current pipeline:** the three notebooks above. They write to `data_used/`.
- **Legacy:** `one.ipynb` filters `Final_data.csv` to `Dengue` and `Tuberculosis` and writes `processed/Final_data_filtered.csv`. Nothing in the backend reads this file. You can ignore it unless you are curious about the original data exploration.
- `prepare_dengue_data.ipynb` has a stale markdown line referring to `processed/dengue_monthly.csv`. The actual code writes `data_used/dengue_monthly.csv`. Trust the code, not that line.

---

## 3. Prerequisites and how to run

### Python packages

The notebooks need:

```text
pandas
scikit-learn
matplotlib
jupyter
```

The backend virtualenv does **not** include these. Create a separate environment if needed:

```bash
cd dataProcessing
python3 -m venv .venv
source .venv/bin/activate
pip install pandas scikit-learn matplotlib jupyter
jupyter lab
```

### Important: run from the right directory

Every path in the notebooks is **relative**, for example `original/Final_data.csv` and `data_used/dengue_model.json`. Run Jupyter from inside `dataProcessing/`:

```bash
cd dataProcessing
jupyter lab
```

If you launch it from the repository root, inputs will not be found.

### Recommended run order

1. `prepare_dengue_data.ipynb` → `data_used/dengue_monthly.csv`
2. `train_dengue_model.ipynb` → `data_used/dengue_model.json`
3. `prepare_rain_latest.ipynb` → `data_used/rain_latest.json`

Stage 3 is independent of stages 1–2, except that it reads `dengue_monthly.csv` for a name-comparison check. It tolerates that file being missing.

Run all cells in each notebook top to bottom. The notebooks are written as scripts with one step per cell, so skipping cells can leave intermediate state missing.

---

## 4. Stage 1 — `prepare_dengue_data.ipynb`

**Goal:** build the monthly training table.

**Inputs**

- `original/Final_data.csv` — case records with columns `state_ut`, `district`, `Disease`, `Cases`, `Deaths`, `day`, `mon`, `year`, plus unused environmental fields.
- `original/daily-rainfall-data-district-level.csv` — daily rainfall with `date`, `state_name`, `district_name`, `actual`, `normal`, `deviation`.

**Output**

- `data_used/dengue_monthly.csv`

### What it does

1. **Load dengue rows.** Drop `Unnamed*` index columns and keep only rows where `Disease == "Dengue"`.
2. **Clean values.** Convert `Cases` to numeric and drop unparseable values (for example `"3/1"`), then map `state_ut` and `district` through `clean_name`.
3. **Normalize names.** `clean_name` trims, lowercases, replaces `&` with `and`, collapses whitespace, and applies `NAME_MAPPING`.
4. **Drop exact duplicates** across the full row.
5. **Collapse repeated outbreak reports.** Rows sharing `(state, district, day, mon, year)` are treated as duplicate reports of the same outbreak; only the row with the highest `Cases` is kept.
6. **Aggregate dengue monthly.** Build a real date from `year`, `mon`, `day`, drop invalid dates, then sum `Cases` per `(state, YYYY-MM)`. Missing state-months are **not** filled with zero.
7. **Clean rainfall.** Keep `date`, `state_name`, `actual`, `normal`; normalize state names; coerce rainfall to numeric and drop rows missing either value.
8. **Aggregate rainfall monthly.** Sum `actual` and `normal` per `(state, YYYY-MM)` and compute:

   ```text
   departure = (actual_sum - normal_sum) / normal_sum
   ```

   Departure is null when `normal_sum` is zero.
9. **Shift rainfall back one month.** Each rainfall month is relabeled as the *previous* month, so dengue month `M` can be joined to rainfall month `M-1`.
10. **Inner-join** dengue and lagged rainfall on `(state, month)`. Rows without a rainfall match are dropped.
11. **Save** the selected columns, sorted by state and month.

### Output schema

| Column | Type | Meaning |
|---|---|---|
| `state` | string | Normalized state name |
| `month` | string | `YYYY-MM` |
| `cases` | number | Total dengue cases for that state-month |
| `rain_prev_actual` | number | Previous month's total actual rainfall |
| `rain_prev_normal` | number | Previous month's total normal rainfall |
| `rain_prev_departure` | number | `(actual - normal) / normal` for the previous month |

### Why the inner join matters

The join is `inner`, not `left`. A dengue month is kept only if the **previous** month has rainfall in the historical file. This keeps the training data consistent with how the model is used (always predicting from prior-month rainfall), but it also means:

- Dengue data before `2009-05` cannot survive the join, because the rainfall file starts `2009-04`.
- New dengue months require matching rainfall for the month before, or they silently disappear.

---

## 5. Stage 2 — `train_dengue_model.ipynb`

**Goal:** train and export the dengue model.

**Input**

- `processed/dengue_monthly.csv` if present, otherwise `data_used/dengue_monthly.csv`.
  In practice the fallback (`data_used/`) is the one that exists, so the code path is normally the fallback.

**Output**

- `data_used/dengue_model.json`

### What it does

1. **Prepare rows.** Drop rows missing `cases` or `rain_prev_departure`; add `year`, `month_num`, and `log_cases = log1p(cases)`.
2. **Split by time.**
   - Training: `year <= 2019`
   - Testing: `year > 2019`
   - Current split: 618 training rows and 82 test rows.
   - The notebook warns if the test set has fewer than 30 rows.
3. **Build the seasonal baseline from training rows only.**
   - Primary: mean `log_cases` per `(state, month_num)`.
   - Fallback 1: mean `log_cases` for that calendar month across states.
   - Fallback 2: overall training mean.
4. **Plot residuals** against previous-month rainfall departure (training rows only).
5. **Fit the rainfall adjustment.** Regress the baseline residual on `rain_prev_departure` clipped to `[-1, 2]` using scikit-learn `LinearRegression`.
6. **Predict.**

   ```text
   baseline_log = seasonal_or_fallback(state, month)
   adjusted_log = baseline_log + intercept + slope * clip(rain_prev_departure)
   ```

7. **Compare methods** on the test set using MAE on both `log_cases` and the original `cases` scale.
8. **Export JSON** with the seasonal table, fallbacks, coefficients, clip bounds, cutoff year, and test errors.

### Current test errors

| Method | MAE on log cases | MAE on cases |
|---|---:|---:|
| Seasonal baseline | 1.2598 | 146.43 |
| Baseline + rainfall adjustment | 1.2573 | 146.25 |

The rainfall adjustment currently improves test MAE only slightly. That is a property of this dataset, not a bug in the code.

### Output schema

| Field | Meaning |
|---|---|
| `seasonal_table` | List of `{state, month_num, mean_log_cases}` |
| `month_fallback` | `{ "1".."12": mean_log_cases }` |
| `overall_mean` | Overall training mean of `log_cases` |
| `slope` | Rainfall regression slope |
| `intercept` | Rainfall regression intercept |
| `clip_bounds` | `[min, max]`, currently `[-1.0, 2.0]` |
| `train_end_year` | `2019` |
| `test_errors` | MAE values for baseline and weather-adjusted methods |

The backend uses `seasonal_table`, `month_fallback`, `overall_mean`, `slope`, `intercept`, and `clip_bounds`. `train_end_year` and `test_errors` are informational.

---

## 6. Stage 3 — `prepare_rain_latest.ipynb`

**Goal:** build the rainfall lookup used for automatic rainfall during calculations.

**Input**

- `original/2026_district_wise_rain_data.csv`

**Output**

- `data_used/rain_latest.json`

### What it does

1. **Load raw rainfall** and report the date range.
2. **Select columns case-insensitively.** It needs `State`, `District`, `Date`, `Daily Actual`, and `Daily Normal`. All weekly, cumulative, and month-to-date columns are ignored.
3. **Normalize state names** with the same helper and mapping, plus one extra 2026 spelling fix (`andaman and nicobar` → `andaman and nicobar islands`).
4. **Clean values and duplicates.** Coerce rainfall to numeric, drop rows missing either value, and keep the last row per `(state, district, date)`.
5. **Aggregate by state-month:**
   - `actual_sum`, `normal_sum`
   - `days_present` (distinct dates)
   - `districts` (distinct districts)
   - `departure = (actual_sum - normal_sum) / normal_sum`
   - `is_complete = days_present == days_in_month`
6. **Report coverage** — list incomplete state-months and the latest complete month per state.
7. **Compare state names** with `dengue_monthly.csv` (diagnostic only; it changes nothing).
8. **Save JSON**, converting missing values to `null`.

### Output schema

Each record is:

```json
{
  "state": "tamil nadu",
  "month": "2026-09",
  "actual_sum": 1234.5,
  "normal_sum": 1000.0,
  "departure": 0.2345,
  "days_present": 30,
  "districts": 32,
  "is_complete": true
}
```

| Field | Meaning |
|---|---|
| `state` | Normalized state name |
| `month` | `YYYY-MM` |
| `actual_sum` | Total actual rainfall for the month |
| `normal_sum` | Total normal rainfall for the month |
| `departure` | `(actual_sum - normal_sum) / normal_sum` |
| `days_present` | Distinct days with data |
| `districts` | Distinct districts with data |
| `is_complete` | `days_present == days in month` |

### Completeness is critical

The backend's automatic lookup only returns a departure when the looked-up row has `is_complete: true`. The current file includes partially reported months (`2026-08` through `2026-11`), and 114 of 152 state-months are incomplete. For those, the backend quietly skips the rainfall adjustment unless the request supplies an explicit `rain_prev_departure`.

If automatic rainfall seems to "do nothing", check whether the relevant state-month is complete.

---

## 7. Publishing to the backend

The backend does **not** read from `dataProcessing/`. After running the notebooks, copy the artifacts:

```bash
cp dataProcessing/data_used/dengue_model.json backend/src/app/data/dengue_model.json
cp dataProcessing/data_used/rain_latest.json backend/src/app/data/rain_latest.json
```

`dengue_monthly.csv` is not copied; it is training-only.

The backend loads both JSON files once at import time, so **restart the backend** after copying for changes to take effect.

`dengue_model.json` fields used at runtime: `seasonal_table`, `month_fallback`, `overall_mean`, `slope`, `intercept`, `clip_bounds`.

`rain_latest.json` fields used at runtime: `state`, `month`, `departure`, `is_complete`.

---

## 8. How to add more data

Before adding data, remember: **names are the join key**. The dengue and rainfall sides must normalize to exactly the same state string, or the rows will not match. See section 9.

### 8.1 Add historical dengue cases

1. Append rows to `original/Final_data.csv` using the existing columns.
2. Requirements:
   - `Disease` must be exactly `"Dengue"`.
   - `Cases` must be numeric. Values such as `"3/1"` are dropped.
   - `day`, `mon`, `year` must form a valid date.
   - `state_ut` and `district` should use normal spellings; the cleaner handles case, `&`, and extra whitespace.
3. Make sure the **previous** month for any new dengue month exists in `original/daily-rainfall-data-district-level.csv`, otherwise the inner join drops it.
4. Re-run `prepare_dengue_data.ipynb`.
5. Re-run `train_dengue_model.ipynb`.
6. Copy the updated `dengue_model.json` into the backend and restart.

Check the printouts after each step. A large unexpected drop in row count usually means a name mismatch or missing prior-month rainfall.

### 8.2 Add historical rainfall

1. Append daily district rows to `original/daily-rainfall-data-district-level.csv` with at least `date`, `state_name`, `actual`, `normal`.
2. Both `actual` and `normal` must be present; rows missing either are dropped.
3. Use state names that normalize to the dengue names (see section 9).
4. Re-run `prepare_dengue_data.ipynb`, then retrain if you want the model updated.

The historical rainfall file is the *training* rainfall source. The 2026 file is only for the latest lookup.

### 8.3 Add or refresh latest rainfall

1. Put the new daily rainfall CSV in `original/`, replacing `2026_district_wise_rain_data.csv` or updating `INPUT_FILE` in the notebook.
2. The notebook matches columns case-insensitively:
   - `State`, `District`, `Date`, `Daily Actual`, `Daily Normal`
   - Extra columns are ignored.
3. Run `prepare_rain_latest.ipynb`.
4. Check:
   - printed latest month
   - incomplete state-month report
   - latest complete month per state
5. Copy `data_used/rain_latest.json` into the backend and restart.

The backend's lookup uses the **previous** month. To get automatic rainfall for a calculation in month `M`, the row for `M-1` must exist and be complete.

### 8.4 Retrain after changing the cutoff

`TRAIN_END_YEAR` is a constant in `train_dengue_model.ipynb` (default `2019`). Raising it gives more training data but a smaller test set; the notebook warns below 30 test rows. Lowering it gives a larger, but less realistic, test set. Keep the train/test split time-based — do not randomly shuffle months, because that leaks future information.

### 8.5 Change or add a state name mapping

There are three separate copies of the name mapping:

1. `prepare_dengue_data.ipynb` → `NAME_MAPPING`
2. `prepare_rain_latest.ipynb` → `NAME_MAPPING` (includes the 2026-only `andaman and nicobar` fix)
3. `backend/src/app/services/dengue_data.py` → `NAME_MAPPING`

If you add a new spelling, update the relevant notebooks **and** the backend. If you only update a notebook, requests using the new spelling will not match the JSON at runtime.

---

## 9. Current name mappings

Both notebooks and the backend lowercase, trim, replace `&` with `and`, and collapse whitespace before applying these:

| Raw name | Normalized name |
|---|---|
| `pudukkottai` | `pudukottai` |
| `dadra and nagar haveli` | `the dadra and nagar haveli and daman and diu` |
| `daman and diu` | `the dadra and nagar haveli and daman and diu` |
| `andaman and nicobar` | `andaman and nicobar islands` *(rain-latest only)* |

The backend mapping includes the `andaman and nicobar` entry as well, so user input using that spelling resolves correctly.

---

## 10. Current coverage and limitations

### Dataset coverage

- Training table: 700 rows, 32 states, 152 months, `2009-07` through `2022-06`.
- Coverage is uneven. Some states have many months, others only a few, because the pipeline only keeps state-months present in both sources.
- The seasonal table has 197 `(state, month)` entries, not `32 × 12 = 384`, because many state-month pairs never appear in the training data.

### Model behavior

- The model is a lookup table plus a single linear rainfall adjustment. It is intentionally simple and interpretable.
- Unknown `(state, month)` pairs fall back to a month average, then to the overall mean. The backend reports which fallback was used via `baseline_source`.
- Rainfall departures are clipped to `[-1, 2]` before adjustment, so extreme departures cannot swing predictions without bound.
- The rainfall term gives only a small improvement on the current test set.

### Rainfall lookup

- The current latest file covers `2026-08` through `2026-11` only, and most state-months are incomplete because those months were still in progress when the file was generated.
- If a requested state or month is absent, incomplete, or has a null departure, the backend proceeds without a rainfall adjustment. This is a silent fallback, not an error.

### Data hygiene caveats

- The pipeline trusts `Cases` after numeric conversion. There is no outlier or negative-value check.
- Monthly aggregation sums whatever rows survive cleaning; there is no reconciliation against an official total.
- `preci`, `LAI`, and `Temp` in the raw dengue file are not used.
- The historical and latest rainfall files use different column layouts; each notebook handles its own file.
- The notebooks are not parameterized into a single script. Each stage is run manually.

---

## 11. Validation checklist

After regenerating anything, confirm:

1. `prepare_dengue_data.ipynb`
   - row count after each cleaning step looks reasonable
   - `Only in dengue file` / `Only in rainfall file` lists are empty or understood
   - final saved row count is non-trivial
2. `train_dengue_model.ipynb`
   - train and test rows are both non-zero
   - test set has at least 30 rows
   - both MAE values print
   - `data_used/dengue_model.json` is valid JSON
3. `prepare_rain_latest.ipynb`
   - latest month is what you expect
   - incomplete state-months are understood
   - `In rain_latest but not in dengue_monthly` is empty or understood
   - `data_used/rain_latest.json` is valid JSON
4. Backend
   - both JSON files copied to `backend/src/app/data/`
   - backend restarted
   - a dengue calculation returns a sensible `seasonal_factor`, `target_stock`, and `baseline_source`

Quick JSON sanity check:

```bash
python3 -m json.tool dataProcessing/data_used/dengue_model.json > /dev/null
python3 -m json.tool dataProcessing/data_used/rain_latest.json > /dev/null
```

---

## 12. Common problems

| Symptom | Likely cause | Fix |
|---|---|---|
| `FileNotFoundError` for `original/...` | Jupyter started outside `dataProcessing/` | `cd dataProcessing` and relaunch |
| Training row count much lower than expected | Names do not match between dengue and rainfall, or previous-month rainfall is missing | Check the "Only in…" printout and name mappings |
| Test set has fewer than 30 rows | `TRAIN_END_YEAR` too low, or recent years absent | Lower `TRAIN_END_YEAR` or add newer data |
| Backend ignores rainfall | State-month missing or `is_complete` is false | Use a state-month whose `is_complete` is true, or pass `rain_prev_departure` explicitly |
| Backend uses old predictions | JSON not copied, or backend not restarted | Copy files and restart |
| `processed/dengue_monthly.csv` not found | That file is not normally generated | The training notebook already falls back to `data_used/`; this message is expected |

---

## 13. Related files

- `project_context/README.md` — overall project context, including backend and frontend.
- `backend/src/app/services/dengue_data.py` — model loading, state normalization, and `calculate_dengue`.
- `backend/src/app/services/helpers/rain.py` — latest-rainfall lookup and completeness check.
- `backend/src/app/routers/calculate.py` — automatic rainfall lookup wiring.
