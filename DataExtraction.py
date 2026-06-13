import pickle
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data"


def load_csv(filename, columns):
    path = DATA_PATH / filename
    if path.exists():
        return pd.read_csv(path)
    return pd.DataFrame(columns=columns)


orders = load_csv(
    "orders.csv",
    ["order_id", "user_id", "eval_set", "order_number", "order_dow", "order_hour_of_day", "days_since_prior_order"],
)
products = load_csv(
    "products.csv",
    ["product_id", "product_name", "aisle_id", "department_id"],
)
order_products_prior = load_csv(
    "order_products__prior.csv",
    ["order_id", "product_id", "add_to_cart_order", "reordered"],
)
order_products_train = load_csv(
    "order_products__train.csv",
    ["order_id", "product_id", "add_to_cart_order", "reordered"],
)
aisles = load_csv("aisles.csv", ["aisle_id", "aisle"])
departments = load_csv("departments.csv", ["department_id", "department"])
rules = load_csv(
    "FPgrowth/rules.csv",
    ["antecedents", "consequents", "support", "confidence", "lift"],
)

model_path = DATA_PATH / "ALS" / "model.pkl"
matrix_path = DATA_PATH / "ALS" / "matrix.pkl"
mappings_path = DATA_PATH / "ALS" / "mappings.pkl"

als_model = None
mappings = {
    "user_map": pd.Series([], dtype="category"),
    "item_map": pd.Series([], dtype="category"),
}

if model_path.exists() and matrix_path.exists() and mappings_path.exists():
    try:
        with open(model_path, "rb") as f:
            als_model = pickle.load(f)
        with open(matrix_path, "rb") as f:
            user_item_matrix = pickle.load(f)
        with open(mappings_path, "rb") as f:
            mappings = pickle.load(f)
    except (ImportError, ModuleNotFoundError, pickle.UnpicklingError, Exception):
        als_model = None
        mappings = {
            "user_map": pd.Series([], dtype="category"),
            "item_map": pd.Series([], dtype="category"),
        }