from typing import Literal


SupportedCurrency = Literal[
    "SAR",
    "USD",
    "EUR",
    "GBP",
    "AED",
    "EGP",
    "KWD",
    "QAR",
    "BHD",
    "OMR",
]

MINOR_UNIT_DIGITS: dict[str, int] = {
    "SAR": 2,
    "USD": 2,
    "EUR": 2,
    "GBP": 2,
    "AED": 2,
    "EGP": 2,
    "KWD": 3,
    "QAR": 2,
    "BHD": 3,
    "OMR": 3,
}
