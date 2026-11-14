# Adding a New Disease

How to add a second disease (for example Tuberculosis) to the forecasting pipeline and backend. Read [`dataProcessing_README.md`](dataProcessing_README.md) first; this document assumes you know the three stages (prepare, train, publish).

> **Status of this doc:** the pipeline steps are grounded in the data processing guide, and the backend section has been checked against the current code in `backend/src/app/`.

---

## 1. Approach: copy per disease, keep the JSON schema

To keep diffs small, do not build a generic framework yet.

- Copy the two disease-specific notebooks (prepare and train) with a disease suffix.
- Write outputs with a disease suffix.
- Keep `<disease>_model.json` in the **same schema** as `dengue_model.json`, so the prediction logic can be reused. The loader itself is currently a dengue-specific module-level singleton, so it needs a small refactor to hold several models (see section 6).
- The backend currently chooses a calculation from the `medicine` string, not from a `disease` field. Decide whether to keep that pattern or add a `disease` request field (section 6).

Parameterizing the notebooks into one script is a later cleanup, not part of adding a disease.

---

## 2. Check the data first

Do this before writing anything. Dengue lost a lot of rows (raw to 700 usable) because of cleaning and the join, so a thinner disease may not train at all.

In `original/Final_data.csv`, for the new disease:

1. Find the **exact** `Disease` spelling (case matters; the filter is an exact match).
2. Count rows, states, and the date range.
3. Check how many `Cases` values are non-numeric (e.g. `"3/1"`) and get dropped.
4. Count state-months after aggregation. You want enough that the time-based test split gives **at least 30 test rows**.

If the numbers are too small, stop here and decide whether the disease needs more data or a simpler model.

---

## 3. Decide: does weather apply?

The dengue model uses the previous month's rainfall departure because mosquito breeding follows rain. That reasoning does not automatically carry over.

| Situation | What to do |
|---|---|
| Disease plausibly weather-driven | Keep the rainfall lag and adjustment as in dengue |
| Not weather-driven (TB is a likely example) | Seasonal baseline only; skip the rainfall join |

Do not add a weather term just because the pipeline has one. If the test MAE does not improve (dengue's barely did), prefer the simpler model.

**Skipping rainfall helps data volume too:** the inner join with lagged rainfall drops any row whose previous month is missing from the historical rainfall file. The rainfall file starts `2009-04`, so the join cannot keep anything before `2009-05`. Without the join, those rows survive.

---

## 4. Data pipeline steps

Run everything from inside `dataProcessing/`.

### 4.1 Prepare notebook

Copy `prepare_dengue_data.ipynb` to `prepare_<disease>_data.ipynb`, then change:

- The disease filter: `Disease == "Dengue"` to the exact new spelling.
- The output path: `data_used/<disease>_monthly.csv`.
- If weather does **not** apply: remove the rainfall cleaning, aggregation, one-month shift, and the inner join. Output only `state`, `month`, `cases`.
- If weather applies: leave the rainfall steps as they are.

Keep the name cleaning (`clean_name`, `NAME_MAPPING`) identical, since names are the join key.

### 4.2 Train notebook

Copy `train_dengue_model.ipynb` to `train_<disease>_model.ipynb`, then change:

- The input file to `data_used/<disease>_monthly.csv`.
- The output file to `data_used/<disease>_model.json`.
- Re-check `TRAIN_END_YEAR`. The time-based split must stay time-based, and the test set must have 30 or more rows. The disease's date range may differ from dengue's.

If weather does **not** apply, more changes are needed than just paths:

- Remove `rain_prev_departure` from the `dropna(subset=[...])` call and from the feature code, otherwise the notebook fails on a missing column.
- Skip the residual regression (and its plot) and write `"slope": 0.0` and `"intercept": 0.0`.
- Keep `clip_bounds` in the file so the JSON schema stays valid; the rainfall term becomes a no-op.

### 4.3 Latest rainfall

`rain_latest.json` is disease-independent. Do not duplicate it. Only refresh it if the weather data changed.

---

## 5. Publish

```bash
cp dataProcessing/data_used/<disease>_model.json backend/src/app/data/<disease>_model.json
```

Then restart the backend. Models are loaded once at import time.

---

## 6. Backend changes

Files to read first (checked against the current code):

- `backend/src/app/schemas.py` — `CalculationRequest` has `medicine`, not `disease`.
- `backend/src/app/services/index.py` — dispatch is `if medicine == "Dengue medicines"`; everything else returns `{"status": "received"}`.
- `backend/src/app/services/dengue_data.py` — hardcoded module-level model load, `NAME_MAPPING`, and `calculate_dengue`.
- `backend/src/app/services/helpers/rain.py` — latest rainfall lookup.
- `backend/src/app/routers/calculate.py` — request wiring and automatic rainfall lookup.
- `frontend/src/api/inventory.ts` and `frontend/src/medicines.ts` — the client sends `medicine` and already lists `"TB medicines"`.

What you will need to do:

1. Refactor `dengue_data.py` so each disease loads its own model, for example:

   ```python
   _MODELS = {
       "dengue": load_model("dengue_model.json"),
       "tb": load_model("tb_model.json"),
   }
   ```

   Keep each model's lookup structures (`seasonal_table`, fallbacks, coefficients, clip bounds) in the same shape.

2. Generalize `calculate_dengue` (or add a sibling) so it takes the selected model's structures instead of using the module-level dengue ones.

3. Extend dispatch in `services/index.py`. Either:

   - keep the current pattern and add `elif medicine == "TB medicines": ...`, or
   - add a `disease` field to `CalculationRequest` defaulting to `"dengue"`, and update the frontend `CalculationInput` and calculator form to send it.

   The first option is the smaller change and matches the existing API. The frontend currently sends only `medicine`, `current_stock`, `yearly_sales`, and `days`.

4. If the disease has no weather term, skip the automatic rainfall lookup for it in `routers/calculate.py`. Note that the frontend does not currently send `state`, so the automatic lookup is only exercised by direct API callers today.

5. Make an unknown disease/medicine return a clear error (or a documented `{"status": "received"}` response) instead of silently using dengue numbers.

There are **no** dengue-specific stock-conversion constants to replicate. `calculate_dengue` works like this:

```text
annual_mean     = mean of the 12 monthly seasonal values
seasonal_factor = requested_month_value / annual_mean   (clamped to 0.25–4.0)
daily_average   = yearly_sales / 365
target_stock    = ceil(daily_average * seasonal_factor * days)
shortfall       = max(0, target_stock - current_stock)
```

`yearly_sales` and `current_stock` come from the request, so the same conversion is valid for any disease; only the model's seasonal table and optional coefficients differ.

If you add a new state spelling, update `NAME_MAPPING` in **all three** places: both preparation notebooks and `backend/src/app/services/dengue_data.py`.

---

## 7. Validation checklist

Pipeline:

- [ ] Disease spelling filter returns a non-trivial number of rows
- [ ] Row counts after each cleaning step look reasonable
- [ ] Any "Only in..." name mismatch lists are empty or understood
- [ ] Train and test rows are both non-zero, and test has 30 or more rows
- [ ] Both MAE values print (baseline, and adjusted if weather applies)
- [ ] `python3 -m json.tool dataProcessing/data_used/<disease>_model.json > /dev/null` passes

Backend:

- [ ] Model JSON copied and backend restarted
- [ ] A dengue request still returns the same result as before the change
- [ ] A request for the new disease returns a sensible `seasonal_factor`, `target_stock`, and `baseline_source`
- [ ] A request with an unknown disease returns a clear error
- [ ] A state with no seasonal row falls back (`baseline_source` shows it) instead of crashing

---

## 8. Common pitfalls

| Symptom | Likely cause |
|---|---|
| Zero rows after filtering | `Disease` spelling or case does not match exactly |
| Far fewer rows than expected | Name mismatch between sources, or (with weather) missing previous-month rainfall |
| Test set under 30 rows | `TRAIN_END_YEAR` too high, or the disease has little recent data |
| New disease returns dengue numbers | Backend still reads the hardcoded dengue model |
| Predictions unchanged after retraining | JSON not copied, or backend not restarted |
| Weather has no effect | State-month not complete in `rain_latest.json`, or weather is intentionally off for this disease |

---

## 9. Out of scope

- A shared parameterized pipeline script
- A model registry or database
- Per-district models
- Any disease-specific feature beyond rainfall