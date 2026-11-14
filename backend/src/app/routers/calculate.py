from datetime import date

from fastapi import APIRouter

from ..schemas import CalculationRequest, CalculationResult
from ..services.index import calculate

router = APIRouter(prefix="/api", tags=["calculation"])

from ..services.helpers.rain import get_rain_prev_departure

@router.post("/calculate", response_model=CalculationResult, response_model_exclude_none=True)
def calculate_request(payload: CalculationRequest):
    today = date.today()
    month = payload.month if payload.month is not None else today.month

    rain_prev_departure = payload.rain_prev_departure
    if rain_prev_departure is None and payload.state:
        rain_prev_departure = get_rain_prev_departure(payload.state, today.year, month)

    return calculate(
        medicine=payload.medicine,
        current_stock=payload.current_stock,
        yearly_sales=payload.yearly_sales,
        days=payload.days,
        state=payload.state,
        month=month,
        rain_prev_departure=rain_prev_departure,
    )

